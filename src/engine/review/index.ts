import { createHash } from "node:crypto";
import type { Finding, SkillDoc } from "../types.ts";
import { libraryFacts, skillFacts } from "../facts.ts";
import { CATEGORIES, SEVERITY_ORDER } from "../types.ts";
import {
  PROMPT_VERSION, SYSTEM, LIBRARY_SYSTEM, DEFAULT_SKILL_CHARS,
  buildSkillDocument, buildLibraryDocument, categoryAsk,
} from "./prompt.ts";
import { MAX_TOKENS, DEFAULT_MAX_TOKENS, REVIEW_MODEL, ReviewUnavailable, askReviewer, reviewEnabled, type Usage } from "./client.ts";
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
  partial: { skill: string; kept: number; reason: string }[];
  findings: Finding[];
  /** Tokens this run actually spent, summed across calls. Cached skills cost none. */
  usage: Usage;
  /**
   * The limits this run was given. Reported rather than assumed: both are
   * environment variables, so an instance can be configured to read a fraction
   * of each skill and stop a fraction of the way through the answer, and every
   * symptom of that looks like a quiet, thin, plausible report.
   */
  limits: { readChars: number; readDefault: number; outputTokens: number; outputDefault: number };
}

const NO_USAGE: Usage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
const limits = (): AuditReport["limits"] => ({
  readChars: 0,
  readDefault: DEFAULT_SKILL_CHARS,
  outputTokens: MAX_TOKENS(),
  outputDefault: DEFAULT_MAX_TOKENS,
});
const EMPTY: AuditReport = {
  ran: false, model: REVIEW_MODEL, cached: 0, reviewed: 0, dropped: 0,
  failures: [], clipped: [], partial: [], findings: [], usage: { ...NO_USAGE }, limits: limits(),
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

/**
 * Content words of a title, for deciding whether two passes said the same thing.
 *
 * Stemmed by truncation, because the difference between two passes reporting one
 * problem is almost always inflection: "No allowed-tools declaration" against "No
 * allowed-tools declared in frontmatter". Crude is right here — a real stemmer
 * would also fold "version" and "versioning", which is fine, while leaving
 * "version" and "author" apart, which is what actually matters.
 */
function titleTokens(t: string): Set<string> {
  const STOP = new Set(["a", "an", "the", "no", "not", "of", "in", "for", "to", "is", "are", "and", "or", "with", "without", "any", "its"]);
  return new Set(
    t.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)
      .filter((w) => w && !STOP.has(w))
      .map((w) => (w.includes("-") ? w : w.slice(0, 5))),
  );
}

/**
 * One problem, reported once, however many passes noticed it.
 *
 * Eight passes over one skill means the same missing `allowed-tools` line gets
 * reported by the over-privilege pass that owns it, by metadata, and by supply
 * chain — three findings, three categories, three wordings of one sentence. That
 * is a direct cost of fanning out, and left alone it reads as three problems.
 *
 * Two findings are the same finding when they quote the same text in the same
 * file AND their titles are mostly the same words. Quote alone is not enough and
 * never has been: no version, no author and no licence are three real findings
 * that quote one frontmatter block, and collapsing those was a bug once already.
 *
 * The survivor is the most serious reading of it, ties going to the earlier
 * category, so the choice does not depend on which pass happened to finish first.
 */
export function collapseAcrossPasses(findings: Finding[]): Finding[] {
  const order = (f: Finding): number => CATEGORIES.findIndex((c) => c.id === f.categoryId);
  const sev = (f: Finding): number => SEVERITY_ORDER.indexOf(f.severity);
  const kept: Finding[] = [];

  for (const f of findings) {
    const mine = titleTokens(f.title);
    const twin = kept.findIndex((k) => {
      if (k.file !== f.file || collapseText(k.evidence) !== collapseText(f.evidence)) return false;
      const theirs = titleTokens(k.title);
      const shared = [...mine].filter((w) => theirs.has(w)).length;
      const union = new Set([...mine, ...theirs]).size;
      return union > 0 && shared / union >= 0.5;
    });
    if (twin === -1) { kept.push(f); continue; }
    const k = kept[twin]!;
    const better = sev(f) < sev(k) || (sev(f) === sev(k) && order(f) < order(k));
    if (better) kept[twin] = f;
  }
  return kept;
}

const collapseText = (s: string): string => s.replace(/\s+/g, " ").trim().toLowerCase();

/** How many skills are audited concurrently. Small on purpose — this is someone else's rate limit. */
const CONCURRENCY = 4;

/**
 * Ceiling on model calls per run. This is a free tool pointed at a public URL,
 * so an unbounded per-skill spend is a hole someone will find. Skills past the
 * ceiling are reported as unaudited rather than dropped — and an unaudited skill
 * must never read as a clean one.
 */
const maxSkills = (): number => Number(process.env["SCAN_REVIEW_MAX_SKILLS"] ?? 25);

/**
 * Output ceiling for one category pass. Far below the whole-skill ceiling, because
 * one category of one skill has far less to say — and a tighter ceiling pulls the
 * request timeout down with it, since that derives from this.
 */
const CATEGORY_TOKENS = (): number => Number(process.env["SCAN_REVIEW_CATEGORY_TOKENS"] ?? 4_000);

export async function auditSkills(skills: SkillDoc[], cache?: ReviewCache): Promise<AuditReport> {
  if (!reviewEnabled() || !skills.length) return { ...EMPTY, limits: limits() };

  const out: AuditReport = {
    ran: true, model: REVIEW_MODEL, cached: 0, reviewed: 0, dropped: 0,
    failures: [], clipped: [], partial: [], findings: [], usage: { ...NO_USAGE }, limits: limits(),
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

      const doc = buildSkillDocument(skill, skillFacts(skill));
      // The largest budget any skill in this run was built to. They differ only
      // by file count, and the biggest is the one worth naming on the report.
      out.limits.readChars = Math.max(out.limits.readChars, doc.budget);
      for (const c of doc.clipped) out.clipped.push({ skill: skill.name, ...c });

      /**
       * One pass, one category.
       *
       * Asking the whole folder one open question returned between 5 and 16
       * findings on identical input at temperature 0 — the headline shell-execution
       * finding present in one run and absent in the next. The structural findings
       * were stable and the open-ended judgement was not, so the fix is to stop
       * asking an open-ended question: eight narrow ones, each naming a single
       * mechanism, over the same cached document.
       *
       * A pass that fails is that category unaudited for that skill, and it is
       * reported by name — never folded in with the categories that came back
       * clean, which is the distinction this whole report exists to keep.
       */
      const pass = async (c: (typeof CATEGORIES)[number]): Promise<Finding[]> => {
        const call = await askReviewer(SYSTEM, { document: doc.text, ask: categoryAsk(c) }, CATEGORY_TOKENS());
        spend(call.usage);
        const { findings, dropped } = verifySkill(skill, call.json);
        out.dropped += dropped.length;
        if (call.incomplete) {
          out.partial.push({ skill: `${skill.name} · ${c.id}`, kept: findings.length, reason: call.incomplete });
        }
        return findings;
      };

      // The first pass alone, so it writes the cache the other seven read. Fired
      // together they would each miss it and each pay to write the folder again.
      const [head, ...rest] = CATEGORIES;
      const collected: Finding[] = [];
      let complete = true;
      const settle = async (c: (typeof CATEGORIES)[number]): Promise<void> => {
        try {
          collected.push(...(await pass(c)));
        } catch (err) {
          complete = false;
          const reason = err instanceof ReviewUnavailable ? err.message : (err as Error).message;
          out.failures.push({ skill: `${skill.name} · ${c.id}`, reason });
        }
      };

      if (head) await settle(head);
      await Promise.all(rest.map(settle));

      out.reviewed++;
      out.findings.push(...collapseAcrossPasses(collected));
      // Only a run where every category answered is worth serving again.
      if (complete && !out.partial.some((x) => x.skill.startsWith(`${skill.name} · `))) cache?.put(key, collected);
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
        if (call.incomplete) out.partial.push({ skill: "(the folder as a whole)", kept: findings.length, reason: call.incomplete });
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
