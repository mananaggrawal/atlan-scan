/**
 * The only place Atlan Scan talks to a model. Zero dependencies: one fetch.
 *
 * Inactive until ANTHROPIC_API_KEY is set. With no key there is no audit at all —
 * the model IS the audit — so the report says plainly that the skills were not
 * audited, rather than rendering an empty result that reads as clean.
 */

export const REVIEW_MODEL = process.env["SCAN_REVIEW_MODEL"] ?? "claude-haiku-4-5";
/**
 * Read per call, not at import: the end-to-end tests stand a stub in front of this
 * and set the variable after the module graph has already loaded.
 */
const endpoint = (): string => process.env["SCAN_REVIEW_ENDPOINT"] ?? "https://api.anthropic.com/v1/messages";
/**
 * Output tokens cost several times what input tokens do. The auditor now owns the
 * whole report rather than a semantic footnote to it, so this has to cover a real
 * finding list — a badly-written skill legitimately produces a dozen.
 */
const MAX_TOKENS = Number(process.env["SCAN_REVIEW_MAX_TOKENS"] ?? 16_000);
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
  /** The model ran out of output budget before finishing. What came back is partial. */
  truncated: boolean;
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

/**
 * Recover the findings from a JSON array that was cut off mid-object.
 *
 * This is not politeness about malformed output — it is the difference between a
 * report and a blank page. The dirtiest skill in a library produces the longest
 * answer, so it is the one that hits the output ceiling, and a strict parse throws
 * away every finding it had already written. That failure is silent and it lands
 * on exactly the file that mattered.
 *
 * So: walk the array, keep every object that closed, stop at the one that did not.
 * Quotes and escapes are tracked so a brace inside a quoted line does not fool it.
 */
export function salvageFindings(body: string): Record<string, unknown>[] | null {
  const key = body.indexOf('"findings"');
  if (key === -1) return null;
  const open = body.indexOf("[", key);
  if (open === -1) return null;

  const out: Record<string, unknown>[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = open + 1; i < body.length; i++) {
    const ch = body[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") { if (depth === 0) start = i; depth++; continue; }
    if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          out.push(JSON.parse(body.slice(start, i + 1)) as Record<string, unknown>);
        } catch {
          // One unparseable object does not invalidate the ones around it.
        }
        start = -1;
      }
      continue;
    }
    if (ch === "]" && depth === 0) break;
  }
  return out;
}

/** Pull the JSON object out of a model turn that may have wrapped it in a fence. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? text).trim();
  const start = body.indexOf("{");
  if (start === -1) throw new ReviewUnavailable("the reviewer did not return JSON");
  const end = body.lastIndexOf("}");
  if (end > start) {
    try {
      return JSON.parse(body.slice(start, end + 1));
    } catch {
      // Fall through to salvage.
    }
  }
  const salvaged = salvageFindings(body.slice(start));
  if (salvaged && salvaged.length) return { findings: salvaged, truncated: true };
  throw new ReviewUnavailable("the reviewer returned JSON we could not parse");
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
    const res = await fetch(endpoint(), {
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
        // caching. It is the whole skill-audit skill now rather than a short review
        // brief, which should put it past Haiku 4.5's 4,096-token minimum — check
        // the cache fields in the usage block rather than assuming, because the API
        // reports a prefix that was too short by returning zero, not by erroring.
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ReviewUnavailable(`reviewer returned ${res.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`);
    }
    const body = (await res.json()) as {
      stop_reason?: string;
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
    const json = extractJson(text);
    // An answer cut off at the output ceiling is incomplete by definition. Whatever
    // was salvaged is still reported, but the run has to say the auditor did not finish.
    const truncated = body.stop_reason === "max_tokens" || Boolean((json as { truncated?: boolean }).truncated);
    return { json, usage, truncated };
  } catch (err) {
    if (err instanceof ReviewUnavailable) throw err;
    if ((err as Error).name === "AbortError") throw new ReviewUnavailable("the reviewer timed out");
    throw new ReviewUnavailable((err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}
