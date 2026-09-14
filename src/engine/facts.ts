import type { SkillDoc } from "./types.ts";

/**
 * Measurement, not judgement.
 *
 * Everything in this file is a fact anyone can check by opening the folder: how
 * many files there are, which ones would not decode, which frontmatter keys are
 * present, how similar two descriptions are as a number. Nothing here decides
 * whether any of it is a problem, how serious it is, or what to do about it —
 * that is the auditor's job, and the auditor is a model reading the files.
 *
 * The split is deliberate. A parser is strictly better than a model at counting
 * files and noticing that one of them is a 4MB binary; a model is strictly
 * better than a regex at reading a sentence and seeing what it would make an
 * agent do. So the parser measures and the model judges, and neither does the
 * other's job.
 */

/** Anthropic truncates description + when_to_use at this many chars per skill. */
export const DESCRIPTION_BUDGET = 1536;

/** Frontmatter keys a governable skill is expected to carry. Presence is measured; absence is the model's to weigh. */
export const EXPECTED_KEYS = ["name", "description", "version", "author", "license", "allowed-tools"] as const;

export interface FileFact {
  path: string;
  bytes: number;
  readable: boolean;
  /** Present when the file could not be decoded as text, or was clipped for length. */
  note?: string;
}

export interface SkillFacts {
  name: string;
  path: string;
  files: FileFact[];
  /** Frontmatter keys actually present, in file order. */
  keysPresent: string[];
  /** Keys from EXPECTED_KEYS that are absent. A measurement — not yet a finding. */
  keysMissing: string[];
  descriptionChars: number;
  bodyLines: number;
  sha256: string;
  /** Markdown links to local files that are not in the upload. Measured by path, not judged. */
  danglingRefs: { ref: string; from: string }[];
}

export interface LibraryFacts {
  /** Chars of name + description + when_to_use across all skills — what is loaded on every turn. */
  listingChars: number;
  budgetChars: number;
  skills: number;
  /** Description overlap, as a 0-1 Jaccard over content words. A number, with no threshold attached. */
  overlapPairs: { a: string; b: string; similarity: number }[];
  /** Body overlap, same measure over 5-word shingles. */
  duplicatePairs: { a: string; b: string; similarity: number }[];
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "with", "when", "use",
  "this", "that", "it", "is", "are", "be", "user", "users", "you", "your", "should",
  "skill", "using", "used", "from", "by", "as", "at", "into", "any", "all",
]);

function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)));
}

function shingles(s: string): Set<string> {
  const words = s.toLowerCase().split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 4 < words.length; i++) out.add(words.slice(i, i + 5).join(" "));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

const descOf = (s: SkillDoc): string => s.frontmatter["description"] ?? "";
const whenOf = (s: SkillDoc): string => s.frontmatter["when_to_use"] ?? s.frontmatter["when-to-use"] ?? "";

/** Markdown links pointing at a local file, resolved against the skill's own folder. */
function danglingRefs(skill: SkillDoc): { ref: string; from: string }[] {
  const have = new Set(skill.files.map((f) => f.path));
  const out: { ref: string; from: string }[] = [];
  const seen = new Set<string>();

  for (const f of skill.files) {
    const text = f.text;
    if (!text) continue;
    const refs = [...text.matchAll(/\[[^\]]*\]\(([^)]+\.(?:md|txt|json|ya?ml|py|sh|js|ts))\)/g)]
      .map((m) => (m[1] ?? "").trim())
      .filter((p) => !/^https?:/.test(p));
    for (const ref of refs) {
      const clean = (ref.replace(/^\.\//, "").split("#")[0] ?? ref).trim();
      if (!clean) continue;
      const candidate = skill.dir ? `${skill.dir}/${clean}` : clean;
      if (have.has(candidate) || [...have].some((h) => h.endsWith(`/${clean}`))) continue;
      const key = `${f.path}→${clean}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ref: clean, from: f.path });
      if (out.length >= 20) return out;
    }
  }
  return out;
}

export function skillFacts(skill: SkillDoc): SkillFacts {
  const keysPresent = Object.keys(skill.frontmatter).filter((k) => (skill.frontmatter[k] ?? "").trim() !== "");
  return {
    name: skill.name,
    path: skill.skillPath,
    files: skill.files.map((f) => ({
      path: f.path,
      bytes: f.bytes,
      readable: f.readable,
      ...(f.readable ? {} : { note: f.reason ?? "could not be decoded as text" }),
    })),
    keysPresent,
    keysMissing: EXPECTED_KEYS.filter((k) => !keysPresent.includes(k)),
    descriptionChars: descOf(skill).length + whenOf(skill).length,
    bodyLines: skill.body.split(/\r?\n/).length,
    sha256: skill.sha256,
    danglingRefs: danglingRefs(skill),
  };
}

export function libraryFacts(skills: SkillDoc[]): LibraryFacts {
  let listingChars = 0;
  for (const s of skills) {
    listingChars += (s.frontmatter["name"] ?? s.name).length + descOf(s).length + whenOf(s).length;
  }

  const overlapPairs: LibraryFacts["overlapPairs"] = [];
  const duplicatePairs: LibraryFacts["duplicatePairs"] = [];

  const desc = skills.map((s) => ({ name: s.name, tok: tokens(`${descOf(s)} ${whenOf(s)}`) }));
  const body = skills.map((s) => ({ name: s.name, sh: shingles(s.body) }));

  for (let i = 0; i < skills.length; i++) {
    for (let j = i + 1; j < skills.length; j++) {
      const da = desc[i]!;
      const db = desc[j]!;
      // Below four content words there is nothing to compare and the ratio is noise.
      if (da.tok.size >= 4 && db.tok.size >= 4) {
        const sim = jaccard(da.tok, db.tok);
        // Reported from 0.3 so the model sees the near-misses too and decides for itself.
        if (sim >= 0.3) overlapPairs.push({ a: da.name, b: db.name, similarity: Math.round(sim * 100) / 100 });
      }
      const ba = body[i]!;
      const bb = body[j]!;
      if (ba.sh.size >= 12 && bb.sh.size >= 12) {
        const sim = jaccard(ba.sh, bb.sh);
        if (sim >= 0.3) duplicatePairs.push({ a: ba.name, b: bb.name, similarity: Math.round(sim * 100) / 100 });
      }
    }
  }

  overlapPairs.sort((a, b) => b.similarity - a.similarity);
  duplicatePairs.sort((a, b) => b.similarity - a.similarity);

  return {
    listingChars,
    budgetChars: DESCRIPTION_BUDGET,
    skills: skills.length,
    overlapPairs: overlapPairs.slice(0, 20),
    duplicatePairs: duplicatePairs.slice(0, 20),
  };
}
