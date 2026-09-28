"use client";

import { stations } from "@/config/stations";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function StationPicker({
  idPrefix,
  selected,
  onChange,
  disabled,
  showSelectAll,
}: {
  idPrefix: string;
  selected: string[];
  onChange: (slugs: string[]) => void;
  disabled?: boolean;
  showSelectAll?: boolean;
}) {
  const allSelected = selected.length === stations.length;

  function toggle(slug: string, checked: boolean) {
    onChange(checked ? [...selected, slug] : selected.filter((s) => s !== slug));
  }

  return (
    <fieldset className="@container flex min-w-0 flex-col gap-2">
      <legend className="mb-2 flex w-full items-center justify-between gap-2 text-sm font-medium">
        <span>
          Stations{" "}
          <span className="font-normal text-muted-foreground">
            ({selected.length} of {stations.length})
          </span>
        </span>
        {showSelectAll && !disabled && (
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0"
            onClick={() => onChange(allSelected ? [] : stations.map((s) => s.slug))}
          >
            {allSelected ? "Clear all" : "Select all"}
          </Button>
        )}
      </legend>
      <div className="grid grid-cols-1 gap-1.5 @xs:grid-cols-2 @2xl:grid-cols-3">
        {stations.map((station) => {
          const id = `${idPrefix}-${station.slug}`;
          const checked = selected.includes(station.slug);
          return (
            <Label
              key={station.slug}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 font-normal transition-colors has-disabled:cursor-not-allowed has-disabled:opacity-60",
                checked ? "border-primary/40 bg-muted" : "hover:bg-muted/60"
              )}
            >
              <Checkbox
                id={id}
                checked={checked}
                disabled={disabled}
                onCheckedChange={(value) => toggle(station.slug, value === true)}
              />
              {station.name}
            </Label>
          );
        })}
      </div>
    </fieldset>
  );
}
