import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { storeFeaturedImage } from "@/lib/images";

// Uploads go through a route handler, not a server action, because server
// actions cap request bodies at 1 MB. The browser pre-shrinks big photos so
// they fit Vercel's ~4.5 MB request limit.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let supabase;
  try {
    ({ supabase } = await requireUser());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form upload." }, { status: 400 });
  }

  const file = form.get("file");
  const draftId = form.get("draftId");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No image file received." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "That file is over 10 MB." }, { status: 413 });
  }

  try {
    const url = await storeFeaturedImage(Buffer.from(await file.arrayBuffer()));

    if (typeof draftId === "string" && draftId) {
      const { error } = await supabase
        .from("drafts")
        .update({ featured_image_url: url })
        .eq("id", draftId);
      if (error) {
        return NextResponse.json(
          { error: `Image saved but couldn't update the draft: ${error.message}` },
          { status: 500 }
        );
      }
      revalidatePath("/");
    }

    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }
}
