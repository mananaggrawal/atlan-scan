/**
 * The only place Atlan Scan talks to a model. Zero dependencies: one fetch.
 *
 * Inactive until ANTHROPIC_API_KEY is set. With no key the scan runs exactly as
 * it does today — 50 deterministic checks — and the report says the semantic
 * review did not run, rather than pretending it passed.
 */

export const REVIEW_MODEL = process.env["SCAN_REVIEW_MODEL"] ?? "claude-haiku-4-5";
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 1400;
/** A skill larger than this is reviewed on its first slice only; the engine still reads all of it. */
export const MAX_REVIEW_CHARS = 24_000;
const TIMEOUT_MS = Number(process.env["SCAN_REVIEW_TIMEOUT_MS"] ?? 25_000);

export function reviewEnabled(): boolean {
  return Boolean(process.env["ANTHROPIC_API_KEY"]);
}

export class ReviewUnavailable extends Error {}

/** Pull the JSON object out of a model turn that may have wrapped it in a fence. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new ReviewUnavailable("the reviewer did not return JSON");
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch (err) {
    throw new ReviewUnavailable(`the reviewer returned JSON we could not parse: ${(err as Error).message}`);
  }
}

export async function askReviewer(system: string, user: string): Promise<unknown> {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new ReviewUnavailable("no API key configured");

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: REVIEW_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ReviewUnavailable(`reviewer returned ${res.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`);
    }
    const body = (await res.json()) as { content?: { type?: string; text?: string }[] };
    const text = (body.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
    if (!text.trim()) throw new ReviewUnavailable("the reviewer returned nothing");
    return extractJson(text);
  } catch (err) {
    if (err instanceof ReviewUnavailable) throw err;
    if ((err as Error).name === "AbortError") throw new ReviewUnavailable("the reviewer timed out");
    throw new ReviewUnavailable((err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}
