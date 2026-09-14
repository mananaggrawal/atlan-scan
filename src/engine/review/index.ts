import type { Finding, SkillDoc } from "../types.ts";
import { PROMPT_VERSION, SYSTEM, userMessage } from "./prompt.ts";
import { MAX_REVIEW_CHARS, REVIEW_MODEL, ReviewUnavailable, askReviewer, reviewEnabled } from "./client.ts";
import { verifyReview } from "./verify.ts";

export { reviewEnabled, REVIEW_MODEL, PROMPT_VERSION };

export interface ReviewCache {
  get(key: string): Finding[] | undefined;
  put(key: string, findings: Finding[]): void;
}

export interface ReviewReport {
  ran: boolean;
  model: string;
  /** Skills whose review came from cache rather than a fresh call. */
  cached: number;
  reviewed: number;
  /** Model findings that failed verification — reported as a number, never as results. */
  dropped: number;
  /** Skills the reviewer could not complete, by name and reason. Never silently skipped. */
  failures: { skill: string; reason: string }[];
  findings: Finding[];
}

const EMPTY: ReviewReport = { ran: false, model: REVIEW_MODEL, cached: 0, reviewed: 0, dropped: 0, failures: [], findings: [] };

/**
 * The cache key is the skill's content hash plus the model and prompt version.
 * Same bytes, same model, same prompt means the same answer is served without
 * another call — which is what lets a re-scan stay both cheap and identical.
 */
export function cacheKey(skill: SkillDoc): string {
  return `${skill.sha256}:${REVIEW_MODEL}:${PROMPT_VERSION}`;
}

/** How many skills are reviewed concurrently. Small on purpose — this is someone else's rate limit. */
const CONCURRENCY = 4;

/**
 * Ceiling on model calls per run. This is a free tool pointed at a public URL,
 * so an unbounded per-skill spend is a hole someone will find. Skills past the
 * ceiling are reported as unreviewed rather than dropped — the engine still read
 * every one of them, and a skipped skill must never read as a clean one.
 */
const maxSkills = (): number => Number(process.env["SCAN_REVIEW_MAX_SKILLS"] ?? 25);

export async function reviewSkills(skills: SkillDoc[], cache?: ReviewCache): Promise<ReviewReport> {
  if (!reviewEnabled() || !skills.length) return { ...EMPTY };

  const out: ReviewReport = { ran: true, model: REVIEW_MODEL, cached: 0, reviewed: 0, dropped: 0, failures: [], findings: [] };

  // Anything already reviewed is free to serve, so the ceiling applies only to
  // skills that would cost a call. A re-scan of a large folder stays complete.
  const cached = cache ? skills.filter((s) => cache.get(cacheKey(s))) : [];
  const fresh = skills.filter((s) => !cached.includes(s));
  const ceiling = maxSkills();
  const over = fresh.slice(ceiling);
  const queue = [...cached, ...fresh.slice(0, ceiling)];

  for (const s of over) {
    out.failures.push({ skill: s.name, reason: `past the ${ceiling}-skill review ceiling for one run` });
  }

  const worker = async (): Promise<void> => {
    for (;;) {
      const skill = queue.shift();
      if (!skill) return;

      const key = cacheKey(skill);
      const hit = cache?.get(key);
      if (hit) {
        out.cached++;
        out.findings.push(...hit);
        continue;
      }

      try {
        const text = skill.lines.join("\n").slice(0, MAX_REVIEW_CHARS);
        const raw = await askReviewer(SYSTEM, userMessage(skill.name, skill.skillPath, text));
        const { findings, dropped } = verifyReview(skill, raw);
        out.reviewed++;
        out.dropped += dropped.length;
        out.findings.push(...findings);
        cache?.put(key, findings);
      } catch (err) {
        const reason = err instanceof ReviewUnavailable ? err.message : (err as Error).message;
        // A skill the reviewer could not read is reported as unreviewed. It is never
        // rolled into the pass column, because a silent skip reads exactly like a clean result.
        out.failures.push({ skill: skill.name, reason });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, skills.length) }, worker));
  out.findings.sort((a, b) => a.skill.localeCompare(b.skill) || a.title.localeCompare(b.title));
  return out;
}
