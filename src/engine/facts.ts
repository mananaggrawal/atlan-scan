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
  /** How each file is reached when the skill is used. Measured; nothing is judged by it. */
  reach: Map<string, Reach>;
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

/**
 * How a file is reached when somebody installs this skill and uses it.
 *
 * A measurement, like every other thing in this file — it says where a file sits
 * and whether anything points at it, not whether it is dangerous. It exists
 * because the read budget has to be spent somewhere, and spending it evenly over
 * a folder that is 39% test fixtures means the manifest's own scripts arrive
 * clipped while a JSON fixture arrives whole. Nothing is ever excluded on the
 * strength of this: every file still reaches the auditor, carrying its label, and
 * the auditor is free to find the payload in a fixture and say so.
 */
export type Reach = "manifest" | "named" | "conventional" | "aside";

/** Places that execute or configure by convention, whether or not the manifest names them. */
const EXEC_DIR = /(^|\/)(scripts?|bin|hooks?|tools?|\.tools|cmd)\//i;
const CONFIG_FILE = /(^|\/)(requirements[^/]*\.txt|package(-lock)?\.json|pyproject\.toml|Pipfile(\.lock)?|poetry\.lock|go\.(mod|sum)|Gemfile(\.lock)?|Cargo\.(toml|lock)|setup\.(py|cfg)|Makefile|Dockerfile|docker-compose\.ya?ml|\.env[^/]*)$/i;
/** Material that does not run when a user invokes the skill. Being named by the manifest overrides this. */
const ASIDE_DIR = /(^|\/)(tests?|__tests__|testdata|fixtures?|examples?|samples?|snapshots?)\//i;

export function reachOf(skill: SkillDoc): Map<string, Reach> {
  // What the instructions talk about: the manifest and any markdown beside it.
  // A bare mention counts, not only a markdown link — "run scripts/run.sh" in a
  // numbered step is how a skill usually points at the thing that executes.
  const prose = skill.files
    .filter((f) => f.text && (f.path === skill.skillPath || f.path.endsWith(".md")))
    .map((f) => f.text ?? "")
    .join("\n");

  const out = new Map<string, Reach>();
  for (const f of skill.files) {
    if (f.path === skill.skillPath) { out.set(f.path, "manifest"); continue; }
    const rel = skill.dir && f.path.startsWith(`${skill.dir}/`) ? f.path.slice(skill.dir.length + 1) : f.path;
    // The path, never the bare filename. A manifest that documents a data format
    // called `agg_rows.json` is not pointing at the eight fixtures that happen to
    // use that name, and matching on the basename marked all of them as reached.
    if (prose.includes(rel)) { out.set(f.path, "named"); continue; }
    if (EXEC_DIR.test(rel) || CONFIG_FILE.test(rel)) { out.set(f.path, "conventional"); continue; }
    out.set(f.path, ASIDE_DIR.test(rel) ? "aside" : "conventional");
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
    reach: reachOf(skill),
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
