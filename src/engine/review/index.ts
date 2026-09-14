import { createHash } from "node:crypto";
import type { Finding, SkillDoc } from "../types.ts";
import { libraryFacts, skillFacts } from "../facts.ts";
import {
  PROMPT_VERSION, SYSTEM, LIBRARY_SYSTEM,
  buildSkillDocument, buildLibraryDocument,
} from "./prompt.ts";
import { REVIEW_MODEL, ReviewUnavailable, askReviewer, reviewEnabled, type Usage } from "./client.ts";
import { verifyLibrary, verifySkill } from "./verify.ts";

export { reviewEnabled, REVIEW_MODEL, PROMPT_VERSION };

export interface ReviewCache {
  get(key: string): Finding[] | undefined;
  put(key: string, findings: Finding[]): void;
}

export interface AuditReport {
  ran: boolean;
  model: string;
  /** Skills whose audit came from cache rather than a fresh call. */
  cached: number;
  reviewed: number;
  /** Claims that failed verification — reported as a number, never as results. */
  dropped: number;
  /** Skills the auditor could not complete, by name and reason. Never silently skipped. */
  failures: { skill: string; reason: string }[];
  /** Files shown only in part, because the skill exceeded the per-skill budget. */
  clipped: { skill: string; path: string; shown: number; of: number }[];
  /**
   * Skills where the auditor ran out of output budget mid-answer. What it had
   * written is kept; the rest was never written. Reported, because the skill with
   * the most to say is the one that hits this, and losing it silently would be
   * the worst failure this scanner could have.
   */
  partial: { skill: string; kept: number }[];
  findings: Finding[];
  /** Tokens this run actually spent, summed across calls. Cached skills cost none. */
  usage: Usage;
}

const NO_USAGE: Usage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
const EMPTY: AuditReport = {
  ran: false, model: REVIEW_MODEL, cached: 0, reviewed: 0, dropped: 0,
  failures: [], clipped: [], partial: [], findings: [], usage: { ...NO_USAGE },
};

/**
 * The cache key covers every file of the skill, not just its manifest.
 *
 * The auditor now reads the whole folder, so a change to a reference file has to
 * invalidate the cached answer — keying on SKILL.md alone would serve a stale
 * audit for a skill whose payload moved into a file beside it, which is exactly
 * the shape this scanner exists to catch.
 */
export function cacheKey(skill: SkillDoc): string {
  const h = createHash("sha256");
  for (const f of [...skill.files].sort((a, b) => a.path.localeCompare(b.path))) {
    h.update(f.path).update("\0").update(f.text ?? ` binary:${f.bytes}`).update("\0");
  }
  return `${h.digest("hex")}:${REVIEW_MODEL}:${PROMPT_VERSION}`;
}

/** The library pass is keyed on every skill's key, so any change anywhere re-runs it. */
function libraryKey(skills: SkillDoc[]): string {
  const h = createHash("sha256");
  for (const k of skills.map(cacheKey).sort()) h.update(k).update("\0");
  return `library:${h.digest("hex")}:${REVIEW_MODEL}:${PROMPT_VERSION}`;
}

/** How many skills are audited concurrently. Small on purpose — this is someone else's rate limit. */
const CONCURRENCY = 4;

/**
 * Ceiling on model calls per run. This is a free tool pointed at a public URL,
 * so an unbounded per-skill spend is a hole someone will find. Skills past the
 * ceiling are reported as unaudited rather than dropped — and an unaudited skill
 * must never read as a clean one.
 */
const maxSkills = (): number => Number(process.env["SCAN_REVIEW_MAX_SKILLS"] ?? 25);

export async function auditSkills(skills: SkillDoc[], cache?: ReviewCache): Promise<AuditReport> {
  if (!reviewEnabled() || !skills.length) return { ...EMPTY };

  const out: AuditReport = {
    ran: true, model: REVIEW_MODEL, cached: 0, reviewed: 0, dropped: 0,
    failures: [], clipped: [], partial: [], findings: [], usage: { ...NO_USAGE },
  };

  const spend = (u: Usage): void => {
    out.usage.input += u.input;
    out.usage.output += u.output;
    out.usage.cacheWrite += u.cacheWrite;
    out.usage.cacheRead += u.cacheRead;
  };

  // Anything already audited is free to serve, so the ceiling applies only to
  // skills that would cost a call. A re-scan of a large folder stays complete.
  const cached = cache ? skills.filter((s) => cache.get(cacheKey(s))) : [];
  const fresh = skills.filter((s) => !cached.includes(s));
  const ceiling = maxSkills();
  const over = fresh.slice(ceiling);
  const queue = [...cached, ...fresh.slice(0, ceiling)];

  for (const s of over) {
    out.failures.push({ skill: s.name, reason: `past the ${ceiling}-skill ceiling for one run` });
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
        const doc = buildSkillDocument(skill, skillFacts(skill));
        for (const c of doc.clipped) out.clipped.push({ skill: skill.name, ...c });
        const call = await askReviewer(SYSTEM, doc.text);
        spend(call.usage);
        const { findings, dropped } = verifySkill(skill, call.json);
        out.reviewed++;
        out.dropped += dropped.length;
        out.findings.push(...findings);
        if (call.truncated) out.partial.push({ skill: skill.name, kept: findings.length });
        // A partial answer is not cached: the next run should get the chance to finish.
        if (!call.truncated) cache?.put(key, findings);
      } catch (err) {
        const reason = err instanceof ReviewUnavailable ? err.message : (err as Error).message;
        // A skill the auditor could not read is reported as unaudited. It is never
        // rolled into the pass column, because a silent skip reads exactly like a clean result.
        out.failures.push({ skill: skill.name, reason });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, skills.length) }, worker));

  // The cross-skill pass. Runs last, and only when there is a collection to judge:
  // one skill cannot collide with anything, so there is nothing to ask.
  if (skills.length > 1) {
    const lkey = libraryKey(skills);
    const hit = cache?.get(lkey);
    if (hit) {
      out.cached++;
      out.findings.push(...hit);
    } else {
      try {
        const call = await askReviewer(LIBRARY_SYSTEM, buildLibraryDocument(skills, libraryFacts(skills)));
        spend(call.usage);
        const { findings, dropped } = verifyLibrary(skills, call.json);
        out.dropped += dropped.length;
        out.findings.push(...findings);
        if (call.truncated) out.partial.push({ skill: "(the folder as a whole)", kept: findings.length });
        else cache?.put(lkey, findings);
      } catch (err) {
        const reason = err instanceof ReviewUnavailable ? err.message : (err as Error).message;
        out.failures.push({ skill: "(the folder as a whole)", reason });
      }
    }
  }

  out.findings.sort((a, b) => a.skill.localeCompare(b.skill) || a.title.localeCompare(b.title));
  return out;
}
