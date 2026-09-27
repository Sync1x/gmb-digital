/**
 * The small allowlist of users who may log in, from the ALLOWED_EMAILS
 * env var (comma-separated, case-insensitive). Anyone with a valid
 * Supabase Auth account but an email not in this list is signed out by
 * the middleware.
 */
function getAllowedEmails(): string[] {
  const raw = process.env.ALLOWED_EMAILS ?? "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string): boolean {
  return getAllowedEmails().includes(email.trim().toLowerCase());
}
