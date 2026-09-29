"use client";

import { useSyncExternalStore } from "react";

/**
 * The current time, refreshed every `intervalMs`. `null` on the server and
 * during hydration, so relative times ("in 3h 20m") never mismatch; render
 * nothing (or a placeholder) until it arrives.
 */
export function useNow(intervalMs = 30_000): Date | null {
  const tick = useSyncExternalStore(
    (onChange) => {
      const id = setInterval(onChange, intervalMs);
      return () => clearInterval(id);
    },
    // Snapshots must be stable between ticks, so round down to the interval.
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => null
  );
  return tick === null ? null : new Date(tick);
}
