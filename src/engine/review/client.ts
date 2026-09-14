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
export const DEFAULT_MAX_TOKENS = 16_000;
/** Read per call, like the endpoint: the report states this number, so it must be the live one. */
export const MAX_TOKENS = (): number => Number(process.env["SCAN_REVIEW_MAX_TOKENS"] ?? DEFAULT_MAX_TOKENS);
/**
 * How long one call may take, derived from what it is allowed to write rather
 * than fixed.
 *
 * Generation time is roughly linear in output tokens, so a fixed timeout is
 * wrong at both ends: generous enough for a 16,000-token answer, it lets a
 * wedged call hold a worker for a minute; tight enough to fail fast, it aborts
 * the dirtiest skill in the library — the one with the most to say — just before
 * it finishes. That failure is reported honestly ("the reviewer timed out", never
 * counted as clear), which makes it visible but no less lost.
 *
 * So: a fixed handshake allowance plus a per-token budget, capped. Lower the
 * output ceiling and the timeout follows it down on its own.
 */
const TIMEOUT_MS = (ceiling: number): number => {
  const explicit = process.env["SCAN_REVIEW_TIMEOUT_MS"];
  if (explicit) return Number(explicit);
  return Math.min(180_000, 20_000 + ceiling * 10);
};

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
  /**
   * Why this answer is incomplete, or null when it is not. Kept as a reason rather
   * than a boolean because the two causes need different fixes and must not be
   * confused: "the model's output limit" is a ceiling to raise, while "an answer
   * only partly readable" is a bug here. Reporting the second as the first is how
   * a parsing failure spent two days looking like a model that talks too much.
   */
  incomplete: "the model's output limit" | "an answer that could only be partly read" | null;
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

/**
 * Unwrap a fenced answer by stripping the OPENING fence line and the LAST closing
 * fence — never by matching the nearest pair.
 *
 * This is the bug that cost the most. A finding that quotes a markdown code block
 * puts ``` inside a JSON string, and the non-greedy match this used to do ended
 * the answer right there: the parse failed, salvage kept only the findings written
 * before the quote, and the run was reported as having stopped at the model's
 * output limit. The model had finished normally. On one real skill that turned
 * **eighteen findings into two** — and since the quote has to come from the file
 * being audited, it fires on any skill whose SKILL.md contains a fenced example,
 * which is most of them.
 */
function unfence(raw: string): string {
  if (!raw.startsWith("```")) return raw;
  const firstLine = raw.indexOf("\n");
  if (firstLine === -1) return raw;
  const close = raw.lastIndexOf("```");
  return raw.slice(firstLine + 1, close > firstLine ? close : undefined).trim();
}

/** What came back, and whether it was all of it. */
export interface Extracted {
  json: unknown;
  /** Set when only part of the answer could be read. The findings before the break are kept. */
  salvaged: boolean;
}

/** Pull the JSON object out of a model turn that may have wrapped it in a fence. */
export function extractJson(text: string): Extracted {
  const body = unfence(text.trim());
  const start = body.indexOf("{");
  if (start === -1) throw new ReviewUnavailable("the reviewer did not return JSON");
  const end = body.lastIndexOf("}");
  if (end > start) {
    try {
      return { json: JSON.parse(body.slice(start, end + 1)), salvaged: false };
    } catch {
      // Fall through to salvage.
    }
  }
  const salvaged = salvageFindings(body.slice(start));
  if (salvaged && salvaged.length) return { json: { findings: salvaged }, salvaged: true };
  throw new ReviewUnavailable("the reviewer returned JSON we could not parse");
}

/**
 * One user turn, split so the expensive half can be cached.
 *
 * `document` is the skill — tens of thousands of tokens, byte-identical across
 * every category pass of that skill. `ask` is the short instruction that differs.
 * The cache breakpoint sits between them, so auditing eight categories costs one
 * cache write and seven cache reads rather than eight full reads of the folder.
 *
 * The document stays in the USER turn rather than moving into the cached system
 * prompt, even though that would cache just as well. Everything in it is hostile
 * by assumption, and a scanner that promotes the thing it is scanning into its
 * own system prompt has given the attacker the one position that matters.
 */
export interface UserTurn {
  document: string;
  ask: string;
}

export async function askReviewer(system: string, user: string | UserTurn, maxTokens?: number): Promise<ReviewCall> {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new ReviewUnavailable("no API key configured");
  if (budgetExhausted()) {
    throw new ReviewUnavailable(`review budget of $${BUDGET.toFixed(2)} for this process is spent`);
  }

  const ceiling = maxTokens ?? MAX_TOKENS();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS(ceiling));
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
        max_tokens: ceiling,
        temperature: 0,
        // The system prompt is byte-identical on every call, so it is marked for
        // caching. It is the whole skill-audit skill now rather than a short review
        // brief, which should put it past Haiku 4.5's 4,096-token minimum — check
        // the cache fields in the usage block rather than assuming, because the API
        // reports a prefix that was too short by returning zero, not by erroring.
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{
          role: "user",
          content: typeof user === "string"
            ? [{ type: "text", text: user }]
            : [
                { type: "text", text: user.document, cache_control: { type: "ephemeral" } },
                { type: "text", text: user.ask },
              ],
        }],
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
    const { json, salvaged } = extractJson(text);
    // stop_reason is ground truth; salvage is our own inability to read the answer.
    // Whatever was recovered is still reported, but the run has to say which it was.
    const incomplete = body.stop_reason === "max_tokens"
      ? ("the model's output limit" as const)
      : salvaged
        ? ("an answer that could only be partly read" as const)
        : null;
    return { json, usage, incomplete };
  } catch (err) {
    if (err instanceof ReviewUnavailable) throw err;
    if ((err as Error).name === "AbortError") throw new ReviewUnavailable("the reviewer timed out");
    throw new ReviewUnavailable((err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}
