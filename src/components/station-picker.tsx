"use client";

import { stations } from "@/config/stations";
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">Stations</Label>
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
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stations.map((station) => {
          const id = `${idPrefix}-${station.slug}`;
          return (
            <div key={station.slug} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={selected.includes(station.slug)}
                disabled={disabled}
                onCheckedChange={(checked) => toggle(station.slug, checked === true)}
              />
              <Label htmlFor={id} className="font-normal">
                {station.name}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
