"use client";

/* eslint-disable @next/next/no-img-element -- external search thumbnails and
   Supabase URLs; next/image would need every remote host allow-listed. */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ImageIcon, ImagesIcon, SearchIcon, UploadIcon, XIcon } from "lucide-react";
import { pickImageAction, removeImageAction, searchImagesAction } from "@/app/image-actions";
import type { ImageResult } from "@/lib/image-search";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { WpMediaDialog } from "@/components/wp-media-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  /** When set, picks/removals are saved on this draft immediately. */
  draftId: string | null;
  imageUrl: string | null;
  onChange: (url: string | null) => void;
  /** Prefills the search box (usually the title). */
  defaultQuery: string;
  /** Ticked stations; the WordPress library opens on the first one. */
  stationSlugs?: string[];
  disabled?: boolean;
};

const SHRINK_OVER_BYTES = 3.5 * 1024 * 1024;

/** Big phone photos are shrunk in the browser so the upload fits Vercel's limit. */
async function shrinkIfLarge(file: File): Promise<Blob> {
  if (file.size <= SHRINK_OVER_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    );
    return blob ?? file;
  } catch {
    return file; // e.g. HEIC the browser can't decode; let the server try.
  }
}

/** Uploads one file through /api/images/upload; shared by the drop zone and the dialog. */
function useImageUpload(draftId: string | null, onPicked: (url: string) => void) {
  const [isUploading, setIsUploading] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
        toast.error("That file isn't an image.");
        return;
      }
      setIsUploading(true);
      try {
        const body = new FormData();
        body.append("file", await shrinkIfLarge(file), file.name || "pasted.jpg");
        if (draftId) body.append("draftId", draftId);
        const res = await fetch("/api/images/upload", { method: "POST", body });
        const isJson = res.headers.get("content-type")?.includes("application/json");
        if (!isJson) throw new Error("Your session expired. Reload the page and sign in again.");
        const json = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !json.url) throw new Error(json.error ?? `Upload failed (HTTP ${res.status}).`);
        onPicked(json.url);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [draftId, onPicked]
  );

  return { upload, isUploading };
}

export function ImagePicker({
  draftId,
  imageUrl,
  onChange,
  defaultQuery,
  stationSlugs = [],
  disabled,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSession, setSearchSession] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaSession, setMediaSession] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  function openSearch() {
    setSearchSession((n) => n + 1);
    setSearchOpen(true);
  }
  function openMedia() {
    setMediaSession((n) => n + 1);
    setMediaOpen(true);
  }
  const [isRemoving, startRemove] = useTransition();

  function handleRemove() {
    if (!imageUrl) return;
    startRemove(async () => {
      const result = await removeImageAction(draftId, imageUrl);
      if (result.ok) {
        onChange(null);
        toast.success("Image removed");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handlePicked(url: string) {
    onChange(url);
    setSearchOpen(false);
    setUploadOpen(false);
    setMediaOpen(false);
    toast.success("Image added");
  }

  const { upload, isUploading } = useImageUpload(draftId, handlePicked);
  const canDrop = !disabled && !isUploading;

  return (
    <div className="flex flex-col gap-3">
      {/* Drop an image anywhere on this area: no need to open the upload dialog first. */}
      <div
        className="relative"
        onDragOver={(e) => {
          if (!canDrop || !e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false);
        }}
        onDrop={(e) => {
          if (!canDrop) return;
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void upload(file);
        }}
      >
        {imageUrl ? (
          <div className="overflow-hidden rounded-lg border bg-muted">
            <img
              src={imageUrl}
              alt="Featured image"
              draggable={false}
              className="aspect-video w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-[3/1] flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <ImageIcon className="size-4" />
              No image yet
            </span>
            {!disabled && <span className="text-xs">Drag an image here to add it</span>}
          </div>
        )}
        {(isDragging || isUploading) && (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm font-medium",
              isDragging ? "border-primary bg-background/90" : "border-transparent bg-background/80"
            )}
          >
            {isUploading ? (
              <>
                <Spinner className="size-5" />
                Converting and uploading…
              </>
            ) : (
              <>
                <UploadIcon className="size-5" />
                {imageUrl ? "Drop to replace the image" : "Drop to add the image"}
              </>
            )}
          </div>
        )}
      </div>

      {!disabled && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 px-4" onClick={openSearch}>
            <SearchIcon />
            {imageUrl ? "Find another image" : "Find image"}
          </Button>
          <Button variant="outline" className="h-10 px-4" onClick={() => setUploadOpen(true)}>
            <UploadIcon />
            Upload image
          </Button>
          <Button variant="outline" className="h-10 px-4" onClick={openMedia}>
            <ImagesIcon />
            WordPress library
          </Button>
          {imageUrl && (
            <Button
              variant="ghost"
              className="h-10 px-4 text-destructive hover:text-destructive"
              onClick={handleRemove}
              disabled={isRemoving}
            >
              {isRemoving ? <Spinner /> : <XIcon />}
              Remove
            </Button>
          )}
        </div>
      )}

      <SearchDialog
        key={searchSession}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        defaultQuery={defaultQuery}
        draftId={draftId}
        onPicked={handlePicked}
      />
      <WpMediaDialog
        key={`media-${mediaSession}`}
        open={mediaOpen}
        onOpenChange={setMediaOpen}
        draftId={draftId}
        stationSlugs={stationSlugs}
        onPicked={handlePicked}
      />
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        upload={upload}
        isUploading={isUploading}
      />
    </div>
  );
}

function SearchDialog({
  open,
  onOpenChange,
  defaultQuery,
  draftId,
  onPicked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultQuery: string;
  draftId: string | null;
  onPicked: (url: string) => void;
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<ImageResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [pickingUrl, setPickingUrl] = useState<string | null>(null);

  const runSearch = useCallback((q: string) => {
    if (!q.trim()) return;
    startSearch(async () => {
      const result = await searchImagesAction(q);
      setError(result.ok ? null : result.error);
      setResults(result.ok ? result.data : null);
    });
  }, []);

  // The parent remounts this dialog (new `key`) each time it opens, so state
  // starts from the current title; search right away.
  useEffect(() => {
    if (open) runSearch(defaultQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, []);

  async function pick(result: ImageResult) {
    setPickingUrl(result.imageUrl);
    const res = await pickImageAction(result.imageUrl, draftId);
    setPickingUrl(null);
    if (res.ok) {
      onPicked(res.data);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Find an image</DialogTitle>
          <DialogDescription>
            Edit the search if the results aren&apos;t right. Check you&apos;re allowed to use an
            image before picking it.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query);
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Brattleboro town meeting"
            className="h-10"
            aria-label="Search query"
          />
          <Button type="submit" className="h-10 px-4" disabled={isSearching || !query.trim()}>
            {isSearching && <Spinner />}
            Search again
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {isSearching &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="aspect-[4/3] w-full rounded-md" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          {!isSearching &&
            results?.map((result) => {
              const isPicking = pickingUrl === result.imageUrl;
              return (
                <button
                  key={result.imageUrl}
                  type="button"
                  onClick={() => pick(result)}
                  disabled={pickingUrl !== null}
                  className="group flex flex-col gap-1.5 text-left disabled:cursor-wait"
                  title={result.title}
                >
                  <div className="relative overflow-hidden rounded-md border bg-muted">
                    <img
                      src={result.thumbnailUrl}
                      alt={result.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="aspect-[4/3] w-full object-cover transition-opacity group-hover:opacity-80"
                    />
                    {isPicking && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                        <Spinner className="size-6" />
                      </div>
                    )}
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {result.sourceDomain || "unknown source"}
                  </span>
                </button>
              );
            })}
        </div>

        {!isSearching && results?.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No images found. Try a shorter or different search.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  upload,
  isUploading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  upload: (file: File) => Promise<void>;
  isUploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Paste from clipboard while the dialog is open.
  useEffect(() => {
    if (!open) return;
    function onPaste(e: ClipboardEvent) {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith("image/")
      );
      if (file) {
        e.preventDefault();
        void upload(file);
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [open, upload]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload an image</DialogTitle>
          <DialogDescription>
            Drop a file, click to choose one, or paste an image (Ctrl/Cmd+V).
          </DialogDescription>
        </DialogHeader>

        <div
          role="button"
          tabIndex={0}
          onClick={() => !isUploading && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !isUploading) inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void upload(file);
          }}
          className={cn(
            "flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            isDragging ? "border-primary bg-muted" : "border-border hover:bg-muted/50"
          )}
        >
          {isUploading ? (
            <>
              <Spinner className="size-6" />
              <span>Converting and uploading…</span>
            </>
          ) : (
            <>
              <UploadIcon className="size-6 text-muted-foreground" />
              <span className="font-medium">Drop an image here or click to choose</span>
              <span className="text-muted-foreground">or paste from the clipboard</span>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
