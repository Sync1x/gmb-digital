"use client";

import { Fragment } from "react";
import { stations } from "@/config/stations";
import { Label } from "@/components/ui/label";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";

type Option = { name: string; missingFrom: string[] };

/**
 * WordPress categories for the ticked stations, like MainWP's post screen:
 * the list is every category found on the selected sites. A category that
 * only some sites have is still offered; the others simply skip it.
 */
export function CategoryPicker({
  id,
  selectedStations,
  categoriesByStation,
  value,
  onChange,
  disabled,
}: {
  id: string;
  selectedStations: string[];
  categoriesByStation: Record<string, string[] | null>;
  value: string[];
  onChange: (names: string[]) => void;
  disabled?: boolean;
}) {
  const anchor = useComboboxAnchor();
  const picked = stations.filter((s) => selectedStations.includes(s.slug));
  const unreadable = picked.filter((s) => categoriesByStation[s.slug] === null);

  const options = (() => {
    const byKey = new Map<string, Option>();
    const readable = picked.filter((s) => categoriesByStation[s.slug]);
    for (const station of readable) {
      for (const name of categoriesByStation[station.slug] ?? []) {
        if (!byKey.has(name.toLowerCase())) byKey.set(name.toLowerCase(), { name, missingFrom: [] });
      }
    }
    for (const option of byKey.values()) {
      option.missingFrom = readable
        .filter(
          (s) =>
            !(categoriesByStation[s.slug] ?? []).some(
              (n) => n.toLowerCase() === option.name.toLowerCase()
            )
        )
        .map((s) => s.name);
    }
    return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
  })();

  const optionByName = new Map(options.map((o) => [o.name, o]));
  // Keep already-chosen names selectable even if no ticked station has them.
  const items = [...options.map((o) => o.name), ...value.filter((v) => !optionByName.has(v))];
  const noStations = picked.length === 0;
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        Categories{" "}
        {value.length > 0 && (
          <span className="font-normal text-muted-foreground">({value.length})</span>
        )}
      </Label>
      <Combobox
        multiple
        autoHighlight
        items={items}
        value={value}
        onValueChange={(next: string[]) => onChange(next)}
        disabled={disabled || noStations}
      >
        <ComboboxChips ref={anchor} className="min-h-10 w-full">
          <ComboboxValue>
            {(values: string[]) => (
              <Fragment>
                {values.map((name) => (
                  <ComboboxChip key={name}>{name}</ComboboxChip>
                ))}
                <ComboboxChipsInput
                  id={id}
                  aria-describedby={hintId}
                  placeholder={
                    noStations
                      ? "Pick stations first"
                      : values.length
                        ? ""
                        : "Choose categories…"
                  }
                  disabled={disabled || noStations}
                />
              </Fragment>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>No matching categories.</ComboboxEmpty>
          <ComboboxList>
            {(name: string) => {
              const option = optionByName.get(name);
              const note = !option
                ? "Not on the ticked stations"
                : option.missingFrom.length
                  ? `Not on ${option.missingFrom.join(", ")}`
                  : null;
              return (
                <ComboboxItem key={name} value={name} className="py-1.5">
                  <div className="flex min-w-0 flex-col">
                    <span>{name}</span>
                    {note && <span className="text-xs text-muted-foreground">{note}</span>}
                  </div>
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <p id={hintId} className="text-xs text-muted-foreground">
        {unreadable.length > 0
          ? `Couldn't load categories from ${unreadable.map((s) => s.name).join(", ")}.`
          : "Each station only gets the categories its site has."}
      </p>
    </div>
  );
}
