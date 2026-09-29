/**
 * Scheduling time helpers. Times are stored in UTC and always shown and picked
 * in America/New_York (the stations' time), including across daylight saving
 * changes. Pure functions, safe on the server and in the browser.
 */

export const SCHEDULE_TZ = "America/New_York";

/** Scheduled times must be at least this far ahead. */
export const MIN_LEAD_MS = 5 * 60 * 1000;

export type WallTime = { year: number; month: number; day: number; hour: number; minute: number };

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: SCHEDULE_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});

/** The wall-clock time in New York at this instant. */
export function toWallTime(date: Date): WallTime {
  const out: Record<string, number> = {};
  for (const part of partsFormat.formatToParts(date)) {
    if (part.type !== "literal") out[part.type] = Number(part.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour,
    minute: out.minute,
  };
}

function wallAsUtcMs(w: WallTime) {
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
}

function instantsFor(w: WallTime): number[] {
  const target = wallAsUtcMs(w);
  const candidates = new Set<number>();
  // Try the offsets in force a day either side; keep the ones that round-trip.
  for (const probe of [target - 86_400_000, target, target + 86_400_000]) {
    const offset = wallAsUtcMs(toWallTime(new Date(probe))) - probe;
    candidates.add(target - offset);
  }
  return [...candidates]
    .filter((ms) => wallAsUtcMs(toWallTime(new Date(ms))) === target)
    .sort((a, b) => a - b);
}

/**
 * The instant when New York's clock reads this wall time, or null if that
 * time doesn't exist (the hour skipped when clocks spring forward). A time
 * that happens twice (clocks fall back) resolves to its first occurrence.
 */
export function fromWallTime(w: WallTime): Date | null {
  const [first] = instantsFor(w);
  return first === undefined ? null : new Date(first);
}

/** True when this wall time happens twice (the hour repeated when clocks fall back). */
export function isAmbiguousWallTime(w: WallTime): boolean {
  return instantsFor(w).length > 1;
}

/** Calendar date arithmetic on a wall date (no time zone involved). */
export function addDays(w: WallTime, days: number): WallTime {
  const d = new Date(Date.UTC(w.year, w.month - 1, w.day + days));
  return { ...w, year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 0 = Sunday … 6 = Saturday, for a wall date. */
export function weekdayOf(w: WallTime): number {
  return new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay();
}

/** "2026-09-29", for grouping by New York day. */
export function dayKey(date: Date): string {
  const w = toWallTime(date);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

const dayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: SCHEDULE_TZ,
  weekday: "short",
  month: "short",
  day: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: SCHEDULE_TZ,
  hour: "numeric",
  minute: "2-digit",
});
const longDayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: SCHEDULE_TZ,
  weekday: "long",
  month: "long",
  day: "numeric",
});

/** "Tue, Sep 29" */
export const formatDay = (date: Date) => dayFormat.format(date);
/** "Tuesday, September 29" */
export const formatLongDay = (date: Date) => longDayFormat.format(date);
/** "6:00 AM" */
export const formatTime = (date: Date) => timeFormat.format(date);
/** "Tue Sep 29 at 6:00 AM" */
export function formatWhen(date: Date): string {
  return `${formatDay(date).replace(",", "")} at ${formatTime(date)}`;
}

/** Heading for a group of scheduled posts: "Today", "Tomorrow", or "Tue, Sep 29". */
export function dayLabel(date: Date, now: Date = new Date()): string {
  const key = dayKey(date);
  const today = toWallTime(now);
  if (key === dayKey(now)) return "Today";
  if (key === dayKey(fromWallTime({ ...addDays(today, 1), hour: 12, minute: 0 })!)) {
    return "Tomorrow";
  }
  return formatDay(date);
}

/** Relative time: "in 3h 20m", "in 45m", "in 2d 4h", "5m ago", "now". */
export function formatRelative(target: Date, now: Date): string {
  const diff = target.getTime() - now.getTime();
  const abs = Math.abs(diff);
  if (abs < 60_000) return "now";
  const totalMinutes = Math.floor(abs / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const text =
    days > 0
      ? `${days}d${hours ? ` ${hours}h` : ""}`
      : hours > 0
        ? `${hours}h${minutes ? ` ${minutes}m` : ""}`
        : `${minutes}m`;
  return diff > 0 ? `in ${text}` : `${text} ago`;
}

/** Rounds up to the next 15-minute mark (the time picker's step). */
export function ceilTo15(date: Date): Date {
  const step = 15 * 60_000;
  return new Date(Math.ceil(date.getTime() / step) * step);
}

export type SchedulePreset = { label: string; date: Date };

/** The quick picks in the schedule dialog. Anything unreachable is left out. */
export function schedulePresets(now: Date = new Date()): SchedulePreset[] {
  const today = toWallTime(now);
  const tomorrow = addDays(today, 1);
  // "Monday" = the next Monday strictly after today.
  const daysToMonday = ((1 - weekdayOf(today) + 7) % 7) || 7;
  const monday = addDays(today, daysToMonday);

  const presets: (SchedulePreset | null)[] = [
    { label: "In 1 hour", date: ceilTo15(new Date(now.getTime() + 60 * 60_000)) },
    at("Tomorrow 6:00 AM", tomorrow, 6),
    at("Tomorrow 10:00 AM", tomorrow, 10),
    at("Monday 6:00 AM", monday, 6),
  ];
  return presets.filter((p): p is SchedulePreset => p !== null);
}

function at(label: string, day: WallTime, hour: number): SchedulePreset | null {
  const date = fromWallTime({ ...day, hour, minute: 0 });
  return date ? { label, date } : null;
}

/** The 96 quarter-hour choices for the time picker. */
export const TIME_OPTIONS: { value: string; label: string }[] = Array.from(
  { length: 96 },
  (_, i) => {
    const hour = Math.floor(i / 4);
    const minute = (i % 4) * 15;
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return {
      value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      label: `${h12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`,
    };
  }
);

/** Validation shared by the dialog and the server action. Returns an error message or null. */
export function checkScheduleTime(date: Date, now: Date = new Date()): string | null {
  if (Number.isNaN(date.getTime())) return "Pick a date and time.";
  if (date.getTime() < now.getTime() + MIN_LEAD_MS) {
    return "Pick a time at least 5 minutes from now.";
  }
  return null;
}
