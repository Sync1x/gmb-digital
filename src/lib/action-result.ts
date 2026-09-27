/**
 * Server actions return this instead of throwing: in production Next.js
 * replaces thrown error messages with a generic one, and staff need to see
 * the real reason (e.g. "MainWP rejected the API key").
 */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
