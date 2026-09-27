// Only block-level structure counts as "already HTML"; a stray <b> in
// pasted text shouldn't skip paragraph conversion.
const HTML_TAG = /<\/(p|div|h[1-6]|ul|ol|li|blockquote)>|<br\s*\/?>/i;

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Turns the plain text from the queue/composer into WordPress post HTML:
 * blank lines become paragraphs, single line breaks become <br>. Text that
 * already contains HTML (e.g. from Make) is passed through unchanged.
 */
export function textToHtml(text: string): string {
  const trimmed = text.replace(/\r\n?/g, "\n").trim();
  if (HTML_TAG.test(trimmed)) return trimmed;
  return trimmed
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br />\n")}</p>`)
    .join("\n\n");
}
