"use client";

import { useState } from "react";
import { CalendarClockIcon } from "lucide-react";
import { getStationBySlug } from "@/config/stations";
import { useNow } from "@/hooks/use-now";
import {
  SCHEDULE_TZ,
  TIME_OPTIONS,
  checkScheduleTime,
  fromWallTime,
  formatWhen,
  isAmbiguousWallTime,
  schedulePresets,
  toWallTime,
  type WallTime,
} from "@/lib/schedule-time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The story headline, for the dialog subtitle. */
  title: string;
  stationSlugs: string[];
  /** Existing schedule (UTC ISO) when rescheduling. */
  currentIso?: string | null;
  /** False = PUBLISH_MODE isn't live: at the scheduled time it only saves WordPress drafts. */
  liveEnabled: boolean;
  /** Saves the schedule. Return the error text to show it in the dialog, or null when done. */
  onConfirm: (scheduledForIso: string) => Promise<string | null>;
};

/** A calendar date with no time zone: local midnight of the New York date. */
const toCalendarDate = (w: WallTime) => new Date(w.year, w.month - 1, w.day);

const pad = (n: number) => String(n).padStart(2, "0");
const timeValue = (w: WallTime) => `${pad(w.hour)}:${pad(w.minute)}`;

export function ScheduleDialog({ open, onOpenChange, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {/* Mounted only while open, so it starts fresh each time. */}
        {open && <ScheduleForm onOpenChange={onOpenChange} {...rest} />}
      </DialogContent>
    </Dialog>
  );
}

function ScheduleForm({
  onOpenChange,
  title,
  stationSlugs,
  currentIso,
  liveEnabled,
  onConfirm,
}: Omit<Props, "open">) {
  const [initial] = useState(() => {
    const now = new Date();
    if (currentIso) {
      const w = toWallTime(new Date(currentIso));
      // Keep the old date if it's still ahead; otherwise start from the first preset.
      if (new Date(currentIso).getTime() > now.getTime()) return w;
    }
    const first = schedulePresets(now).find((p) => p.label.startsWith("Tomorrow"));
    return toWallTime(first?.date ?? new Date(now.getTime() + 24 * 3_600_000));
  });
  const [day, setDay] = useState<Date>(toCalendarDate(initial));
  const [time, setTime] = useState(timeValue(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow(30_000);

  const [hour, minute] = time.split(":").map(Number);
  const wall: WallTime = {
    year: day.getFullYear(),
    month: day.getMonth() + 1,
    day: day.getDate(),
    hour,
    minute,
  };
  const when = fromWallTime(wall);
  const ambiguous = isAmbiguousWallTime(wall);

  // Problems that block saving. Checked against the clock so it stays accurate.
  const problem = !when
    ? "That time doesn't exist on that date, because the clocks jump forward. Pick another time."
    : now
      ? checkScheduleTime(when, now)
      : null;

  const names = stationSlugs.map((s) => getStationBySlug(s)?.name ?? s).join(", ");
  const today = now ? toWallTime(now) : null;
  const todayDate = today ? toCalendarDate(today) : undefined;

  function applyPreset(date: Date) {
    const w = toWallTime(date);
    setDay(toCalendarDate(w));
    setTime(timeValue(w));
    setError(null);
  }

  async function submit() {
    if (!when) return;
    // Re-check with the real clock at the moment of saving.
    const late = checkScheduleTime(when);
    if (late) {
      setError(late);
      return;
    }
    setSaving(true);
    setError(null);
    const failure = await onConfirm(when.toISOString());
    setSaving(false);
    if (failure) setError(failure);
    else onOpenChange(false);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{currentIso ? "Reschedule" : "Schedule for later"}</DialogTitle>
        <DialogDescription className="line-clamp-2">
          &ldquo;{title.trim() || "Untitled"}&rdquo;
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="mx-auto rounded-lg border">
          <Calendar
            mode="single"
            required
            selected={day}
            onSelect={(next) => {
              setDay(next);
              setError(null);
            }}
            defaultMonth={day}
            today={todayDate}
            disabled={todayDate ? { before: todayDate } : undefined}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-time">Time (Eastern)</Label>
            <Select
              value={time}
              onValueChange={(v) => {
                if (v) setTime(v);
                setError(null);
              }}
              items={TIME_OPTIONS}
            >
              <SelectTrigger id="schedule-time" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} className="max-h-72">
                {TIME_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Quick picks</span>
            <div className="flex flex-wrap gap-2">
              {(now ? schedulePresets(now) : []).map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => applyPreset(preset.date)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            All times are {SCHEDULE_TZ.replace("_", " ")} time, including around daylight saving
            changes. The scheduler checks every 5 minutes, so a post can go out a few minutes after
            its time.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2" aria-live="polite">
        {problem ? (
          <Alert variant="destructive">
            <AlertDescription>{problem}</AlertDescription>
          </Alert>
        ) : (
          when && (
            <Alert>
              <CalendarClockIcon aria-hidden="true" />
              <AlertDescription className="text-foreground">
                Goes out <strong>{formatWhen(when)}</strong> to {names || "no stations"}.
                {ambiguous &&
                  " That hour happens twice when the clocks go back; the first one is used."}
                {!liveEnabled &&
                  " Live publishing is off, so it will only be saved as WordPress drafts."}
              </AlertDescription>
            </Alert>
          )
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" className="h-11 px-5" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button className="h-11 px-6 text-base" onClick={submit} disabled={saving || Boolean(problem) || !when}>
          {saving && <Spinner />}
          {currentIso ? "Reschedule" : "Schedule"}
        </Button>
      </DialogFooter>
    </>
  );
}
