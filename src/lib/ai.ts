import "server-only";

/**
 * Optional AI helpers. Everything works without them: when AI_ENABLED isn't
 * "true" (or there's no key), the UI hides the buttons entirely.
 */
export function isAiEnabled(): boolean {
  return (
    process.env.AI_ENABLED?.trim().toLowerCase() === "true" &&
    Boolean(process.env.DEEPSEEK_API_KEY?.trim())
  );
}

const SYSTEM_PROMPT = `You write headlines for small local radio station news websites in Vermont and New Hampshire.
Style: plain, factual, specific. Say who/what/where. Sentence case. No clickbait, no questions, no exclamation marks, no puns, no "you won't believe", no emojis. Under 90 characters.
Only use facts that are in the story. Do not invent names, numbers or places.
Respond with JSON only: {"titles": ["...", "...", "..."]} with exactly 3 different options.`;

export async function suggestTitles(body: string, currentTitle?: string | null): Promise<string[]> {
  if (!isAiEnabled()) throw new Error("AI suggestions are turned off (AI_ENABLED).");
  const apiKey = process.env.DEEPSEEK_API_KEY!.trim();

  const story = body.trim().slice(0, 6000);
  if (!story) throw new Error("Add the story text first.");

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `${currentTitle?.trim() ? `Current working title: ${currentTitle.trim()}\n\n` : ""}Story:\n${story}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 401) throw new Error("DeepSeek rejected the API key. Check DEEPSEEK_API_KEY.");
  if (res.status === 402) throw new Error("The DeepSeek account is out of credit.");
  if (!res.ok) throw new Error(`DeepSeek request failed (HTTP ${res.status}).`);

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "";
  let titles: unknown;
  try {
    titles = (JSON.parse(content) as { titles?: unknown }).titles;
  } catch {
    throw new Error("DeepSeek returned something that wasn't valid JSON. Try again.");
  }
  if (!Array.isArray(titles)) throw new Error("DeepSeek didn't return any titles. Try again.");

  const cleaned = titles
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean)
    .slice(0, 3);
  if (cleaned.length === 0) throw new Error("DeepSeek didn't return any titles. Try again.");
  return cleaned;
}
