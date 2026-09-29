"use client";

/* eslint-disable @next/next/no-img-element -- WordPress thumbnails from each
   station's own site; next/image would need every host allow-listed. */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { pickImageAction, listStationMediaAction } from "@/app/image-actions";
import { stations } from "@/config/stations";
import type { WpMediaItem } from "@/lib/wordpress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATION_ITEMS = stations.map((s) => ({ value: s.slug, label: s.name }));

/**
 * Browse a station's WordPress media library and pick an image for the post.
 * The chosen file is downloaded, converted to JPEG and stored like any other
 * pick, so the rest of the publish flow doesn't change.
 */
export function WpMediaDialog({
  open,
  onOpenChange,
  draftId,
  stationSlugs,
  onPicked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftId: string | null;
  /** Ticked stations; the first one is opened by default. */
  stationSlugs: string[];
  onPicked: (url: string) => void;
}) {
  const [station, setStation] = useState(
    () => stationSlugs.find((s) => stations.some((x) => x.slug === s)) ?? stations[0].slug
  );
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState(""); // the term the current results are for
  const [items, setItems] = useState<WpMediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isLoading, startLoad] = useTransition();
  const [pickingId, setPickingId] = useState<number | null>(null);
  const latest = useRef(0);

  const load = useCallback((slug: string, term: string, pageNo: number, append: boolean) => {
    const token = ++latest.current;
    startLoad(async () => {
      const result = await listStationMediaAction(slug, term, pageNo);
      if (token !== latest.current) return; // a newer request replaced this one
      setLoaded(true);
      if (!result.ok) {
        setError(result.error);
        if (!append) setItems([]);
        return;
      }
      setError(null);
      setSearch(term);
      setPage(result.data.page);
      setTotalPages(result.data.totalPages);
      setTotal(result.data.total);
      setItems((prev) => (append ? [...prev, ...result.data.items] : result.data.items));
    });
  }, []);

  // First page of the default station when the dialog opens.
  const started = useRef(false);
  useEffect(() => {
    if (open && !started.current) {
      started.current = true;
      load(station, "", 1, false);
    }
  }, [open, station, load]);

  function changeStation(slug: string | null) {
    if (!slug || slug === station) return;
    setStation(slug);
    setItems([]);
    load(slug, query, 1, false);
  }

  async function pick(item: WpMediaItem) {
    setPickingId(item.id);
    const res = await pickImageAction(item.fullUrl, draftId);
    setPickingId(null);
    if (res.ok) onPicked(res.data);
    else toast.error(res.error);
  }

  const stationName = stations.find((s) => s.slug === station)?.name ?? "";
  const busy = pickingId !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>WordPress media library</DialogTitle>
          <DialogDescription>
            Images already uploaded to a station&apos;s website. Pick one to use as the featured
            image.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setItems([]);
            load(station, query, 1, false);
          }}
        >
          <div className="flex flex-col gap-2 sm:w-52">
            <Label htmlFor="wp-media-station">Station</Label>
            <Select value={station} onValueChange={changeStation} items={STATION_ITEMS}>
              <SelectTrigger id="wp-media-station" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {STATION_ITEMS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="wp-media-search">Search by file name or title</Label>
            <div className="flex gap-2">
              <Input
                id="wp-media-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. town meeting"
                className="h-10"
              />
              <Button type="submit" className="h-10 px-4" disabled={isLoading}>
                {isLoading && items.length === 0 && <Spinner />}
                Search
              </Button>
            </div>
          </div>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((item) => {
            const isPicking = pickingId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => pick(item)}
                disabled={busy}
                title={item.title}
                className="group flex flex-col gap-1.5 text-left disabled:cursor-wait"
              >
                <div className="relative overflow-hidden rounded-md border bg-muted">
                  <img
                    src={item.thumbUrl}
                    alt={item.title}
                    loading="lazy"
                    className="aspect-square w-full object-cover transition-opacity group-hover:opacity-80"
                  />
                  {isPicking && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                      <Spinner className="size-6" />
                    </div>
                  )}
                </div>
                <span className="truncate text-xs text-muted-foreground">{item.title}</span>
              </button>
            );
          })}
          {isLoading &&
            (items.length === 0 || page < totalPages) &&
            Array.from({ length: items.length === 0 ? 12 : 6 }).map((_, i) => (
              <div key={`s${i}`} className="flex flex-col gap-1.5">
                <Skeleton className="aspect-square w-full rounded-md" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
        </div>

        {loaded && !isLoading && !error && items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {search
              ? `No images on ${stationName} match "${search}".`
              : `${stationName} has no images in its media library.`}
          </p>
        )}

        {items.length > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              Showing {items.length} of {total}
              {search ? ` matching "${search}"` : ""}
            </span>
            {page < totalPages && (
              <Button
                variant="outline"
                className="h-10 px-4"
                disabled={isLoading || busy}
                onClick={() => load(station, search, page + 1, true)}
              >
                {isLoading && <Spinner />}
                Load more
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
