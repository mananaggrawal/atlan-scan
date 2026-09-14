/**
 * The only place Atlan Scan talks to a model. Zero dependencies: one fetch.
 *
 * Inactive until ANTHROPIC_API_KEY is set. With no key the scan runs exactly as
 * it does today — 50 deterministic checks — and the report says the semantic
 * review did not run, rather than pretending it passed.
 */

export const REVIEW_MODEL = process.env["SCAN_REVIEW_MODEL"] ?? "claude-haiku-4-5";
const ENDPOINT = "https://api.anthropic.com/v1/messages";
/**
 * Output tokens cost several times what input tokens do, and findings are capped
 * at six per skill, so this only ever needs to cover six compact objects.
 */
const MAX_TOKENS = Number(process.env["SCAN_REVIEW_MAX_TOKENS"] ?? 1000);
/** A skill larger than this is reviewed on its first slice only; the engine still reads all of it. */
export const MAX_REVIEW_CHARS = Number(process.env["SCAN_REVIEW_MAX_CHARS"] ?? 24_000);
const TIMEOUT_MS = Number(process.env["SCAN_REVIEW_TIMEOUT_MS"] ?? 25_000);

export function reviewEnabled(): boolean {
  return Boolean(process.env["ANTHROPIC_API_KEY"]);
}

export class ReviewUnavailable extends Error {}

/** What one call cost, as the API reported it. */
export interface Usage {
  input: number;
  output: number;
  /** Input tokens written to the prompt cache — charged at a premium, once. */
  cacheWrite: number;
  /** Input tokens served from the cache — charged at a tenth of the input rate. */
  cacheRead: number;
}

export interface ReviewCall {
  json: unknown;
  usage: Usage;
}

/** Per-million-token prices, USD. Override when changing model. */
const PRICE = {
  input: Number(process.env["SCAN_REVIEW_PRICE_IN"] ?? 1.0),
  output: Number(process.env["SCAN_REVIEW_PRICE_OUT"] ?? 5.0),
  cacheWrite: Number(process.env["SCAN_REVIEW_PRICE_CACHE_WRITE"] ?? 1.25),
  cacheRead: Number(process.env["SCAN_REVIEW_PRICE_CACHE_READ"] ?? 0.1),
};

export function costOf(u: Usage): number {
  return (u.input * PRICE.input + u.output * PRICE.output + u.cacheWrite * PRICE.cacheWrite + u.cacheRead * PRICE.cacheRead) / 1e6;
}

/**
 * A ceiling on what this process will spend, in USD, across every scan it serves.
 * Unset means no ceiling. Set it while testing: a loop, a large folder or someone
 * hammering the public scanner all spend real money, and a bill is a bad way to
 * find that out. Once reached, reviews stop and say so — scans still run, the
 * engine is untouched, and the report says the skills were not reviewed.
 */
const BUDGET = Number(process.env["SCAN_REVIEW_BUDGET_USD"] ?? 0);
let spent = 0;

export function spentSoFar(): number {
  return spent;
}

export function budgetUsd(): number {
  return BUDGET;
}

export function budgetExhausted(): boolean {
  return BUDGET > 0 && spent >= BUDGET;
}

/** Test seam. */
export function resetSpend(): void {
  spent = 0;
}

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

export async function askReviewer(system: string, user: string): Promise<ReviewCall> {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new ReviewUnavailable("no API key configured");
  if (budgetExhausted()) {
    throw new ReviewUnavailable(`review budget of $${BUDGET.toFixed(2)} for this process is spent`);
  }

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
        // The system prompt is byte-identical on every call, so it is marked for
        // caching. Note this is currently a no-op: Haiku 4.5 will not cache a
        // prefix under 4,096 tokens and ours is about 2,300, and the API says so
        // by returning zero in both cache fields rather than by erroring. It is
        // left in deliberately — it starts paying the moment the prompt grows past
        // that line or the model is switched to a Sonnet, whose minimum is 1,024.
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ReviewUnavailable(`reviewer returned ${res.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`);
    }
    const body = (await res.json()) as {
      content?: { type?: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
    };
    const text = (body.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
    if (!text.trim()) throw new ReviewUnavailable("the reviewer returned nothing");
    const usage = {
      input: body.usage?.input_tokens ?? 0,
      output: body.usage?.output_tokens ?? 0,
      cacheWrite: body.usage?.cache_creation_input_tokens ?? 0,
      cacheRead: body.usage?.cache_read_input_tokens ?? 0,
    };
    // Counted before the JSON is parsed: the call was billed whether or not we
    // can use what came back.
    spent += costOf(usage);
    return { json: extractJson(text), usage };
  } catch (err) {
    if (err instanceof ReviewUnavailable) throw err;
    if ((err as Error).name === "AbortError") throw new ReviewUnavailable("the reviewer timed out");
    throw new ReviewUnavailable((err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}
