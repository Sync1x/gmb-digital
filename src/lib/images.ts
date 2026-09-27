import "server-only";
import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";

export const FEATURED_BUCKET = "featured";
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 82;

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const a = address.toLowerCase();
    if (a.startsWith("::ffff:")) return isPrivateAddress(a.slice(7));
    return a === "::1" || a === "::" || a.startsWith("fc") || a.startsWith("fd") || a.startsWith("fe80");
  }
  const [a, b] = address.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

async function assertPublicUrl(rawUrl: string | URL): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("That image URL isn't valid.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http(s) image URLs are allowed.");
  }
  const { address } = await lookup(url.hostname).catch(() => {
    throw new Error(`Couldn't resolve ${url.hostname}.`);
  });
  if (isPrivateAddress(address)) {
    throw new Error("That image URL points to a private network address.");
  }
  return url;
}

/** Downloads a remote image, refusing internal addresses and oversized files. */
export async function downloadImage(rawUrl: string): Promise<Buffer> {
  let url = await assertPublicUrl(rawUrl);
  let res: Response | null = null;

  // Follow redirects by hand so every hop is checked against private addresses.
  for (let hop = 0; hop < 4; hop++) {
    res = await fetch(url, {
      headers: {
        // Some hosts refuse requests without a browser-like UA.
        "User-Agent": "Mozilla/5.0 (compatible; GMBDigital/1.0)",
        Accept: "image/*",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    }).catch((err) => {
      throw new Error(`Couldn't download the image: ${err instanceof Error ? err.message : err}`);
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = await assertPublicUrl(new URL(location, url));
      continue;
    }
    break;
  }
  if (!res || (res.status >= 300 && res.status < 400)) {
    throw new Error("The image host redirected too many times.");
  }

  if (!res.ok) {
    throw new Error(`The image host refused the download (HTTP ${res.status}). Try another image.`);
  }
  const type = res.headers.get("content-type") ?? "";
  if (type && !type.startsWith("image/") && !type.startsWith("application/octet-stream")) {
    throw new Error("That link isn't an image. Try another result.");
  }
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_DOWNLOAD_BYTES) {
    throw new Error("That image is too large (over 20 MB).");
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error("That image is too large (over 20 MB).");
  }
  return buffer;
}

/** Converts any supported image to a web-friendly JPEG. */
export async function toFeaturedJpeg(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input, { failOn: "none" })
      .rotate() // honour EXIF orientation from phone photos
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .flatten({ background: "#ffffff" }) // transparent PNGs get a white background
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new Error("Couldn't read that file as an image. Try a JPEG, PNG or WebP.");
  }
}

/** Converts, uploads to the public "featured" bucket and returns the public URL. */
export async function storeFeaturedImage(input: Buffer): Promise<string> {
  const jpeg = await toFeaturedJpeg(input);
  const supabase = createAdminClient();
  const date = new Date().toISOString().slice(0, 10);
  const path = `${date}/${randomUUID()}.jpg`;

  const { error } = await supabase.storage.from(FEATURED_BUCKET).upload(path, jpeg, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    throw new Error(
      `Couldn't save the image to Supabase Storage: ${error.message}. Has the "featured" bucket migration been run?`
    );
  }

  return supabase.storage.from(FEATURED_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Deletes a stored image if the URL points into our bucket. Best-effort. */
export async function deleteFeaturedImage(publicUrl: string): Promise<void> {
  const marker = `/storage/v1/object/public/${FEATURED_BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return;
  const path = decodeURIComponent(publicUrl.slice(index + marker.length));
  await createAdminClient().storage.from(FEATURED_BUCKET).remove([path]);
}
