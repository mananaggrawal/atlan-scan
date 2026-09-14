import { CATEGORIES, SEVERITY_ORDER, type CategoryId, type Finding, type Severity, type SkillDoc } from "../types.ts";

const CATEGORY_IDS = new Set<string>(CATEGORIES.map((c) => c.id));
const SEVERITIES = new Set<string>(SEVERITY_ORDER);

/**
 * A ceiling on findings from one skill. Not a judgement about how many problems a
 * skill may have — it is a guard against a model that has started padding. It sits
 * well above anything a real audit produces, so a skill that genuinely trips it is
 * telling you something. Findings past it are counted and reported, never silently lost.
 */
export const MAX_PER_SKILL = 40;
const MAX_TITLE = 90;
const MAX_TEXT = 400;

export interface RawReviewFinding {
  file?: unknown;
  categoryId?: unknown;
  severity?: unknown;
  title?: unknown;
  evidence?: unknown;
  why?: unknown;
  fix?: unknown;
}

export interface VerifyOutcome {
  findings: Finding[];
  /** Findings the model produced that did not survive. Counted, never shown as results. */
  dropped: { reason: string; title: string }[];
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Take a quote out of the markdown fence the model wrapped it in.
 *
 * Models fence anything that looks like code, so evidence arrives as
 * ```python\n<the real line>\n``` — and the fence markers are not in the file, so
 * a verbatim search fails and a true finding is discarded as invented. On one
 * skill this silently dropped eight of nine over-privilege findings, including
 * the LibreOffice subprocess and the shell script, which is the whole audit.
 *
 * Unwrapping is safe in a way that loosening the match would not be: what is
 * inside the fence still has to appear in the file character for character. This
 * corrects presentation and concedes nothing about content, which is the rule the
 * verifier lives by — it overrules the evidence, never the judgement.
 */
export function unfenceQuote(s: string): string {
  const t = s.trim();
  if (!t.startsWith("```")) return s;
  const firstLine = t.indexOf("\n");
  if (firstLine === -1) return s;
  const close = t.lastIndexOf("```");
  if (close <= firstLine) return s;
  // Only a single fenced block. Two of them joined by prose is an assembled
  // quote, and an assembled quote is exactly what this check exists to catch.
  if (t.slice(firstLine, close).includes("```")) return s;
  return t.slice(firstLine + 1, close).replace(/\n$/, "");
}
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

/**
 * Find the 1-based line where `needle` occurs in `lines`, exactly first, then on
 * whitespace-collapsed text so a model that reflowed a wrapped sentence is not
 * punished for it. Returns null when the quote is not in the text at all — and a
 * quote that is not in the file is the one thing we never let through.
 */
export function locate(lines: string[], needle: string): number | null {
  const want = needle.trim();
  if (!want) return null;

  for (let i = 0; i < lines.length; i++) if ((lines[i] ?? "").includes(want)) return i + 1;

  const flat = collapse(want);
  if (flat.length < 12) return null; // too short to match loosely without inviting coincidence
  for (let i = 0; i < lines.length; i++) if (collapse(lines[i] ?? "").includes(flat)) return i + 1;

  // A quote that spans a line break: slide a window over the joined text. Span is the
  // outer loop so the tightest window wins — otherwise a wide window starting earlier
  // matches first and reports a line several above the one the text is actually on.
  for (let span = 2; span <= 6; span++) {
    for (let i = 0; i + span <= lines.length; i++) {
      if (collapse(lines.slice(i, i + span).join(" ")).includes(flat)) return i + 1;
    }
  }
  return null;
}

/** Every readable file of a skill, by path, as lines. The corpus a quote is checked against. */
export interface Corpus {
  /** Ordered so the manifest is tried first when the model names no file we recognise. */
  files: { path: string; skill: string; lines: string[] }[];
}

export function corpusOf(skills: SkillDoc[]): Corpus {
  const files: Corpus["files"] = [];
  for (const s of skills) {
    const manifest = s.files.find((f) => f.path === s.skillPath);
    if (manifest?.text != null) files.push({ path: s.skillPath, skill: s.name, lines: manifest.text.split(/\r?\n/) });
    for (const f of s.files) {
      if (f.path === s.skillPath || f.text == null) continue;
      files.push({ path: f.path, skill: s.name, lines: f.text.split(/\r?\n/) });
    }
  }
  return { files };
}

interface Located {
  file: string;
  skill: string;
  line: number;
}

/**
 * Where this quote really is.
 *
 * The file the model named is tried first. If the quote is not there, every other
 * file is tried before giving up: a model that read the right line and wrote down
 * the wrong filename has still found something real, and the report corrects the
 * path rather than throwing the finding away. A quote in none of them is dropped.
 */
function place(corpus: Corpus, named: string, evidence: string): Located | null {
  const want = String(named ?? "").trim();
  const exact = corpus.files.find((f) => f.path === want);
  const suffix = exact ?? corpus.files.find((f) => want && (f.path.endsWith(`/${want}`) || want.endsWith(`/${f.path}`)));

  if (suffix) {
    const line = locate(suffix.lines, evidence);
    if (line !== null) return { file: suffix.path, skill: suffix.skill, line };
  }
  for (const f of corpus.files) {
    if (f === suffix) continue;
    const line = locate(f.lines, evidence);
    if (line !== null) return { file: f.path, skill: f.skill, line };
  }
  return null;
}

/**
 * Turn what the model said into findings we are willing to show, or into nothing.
 *
 * This is the trust boundary, and the only place in the scanner that overrules the
 * model. It does not second-guess the judgement — it checks that the thing being
 * judged exists. Every claim is a claim about a file we hold, so every claim is
 * checked back against that file and anything unverifiable is dropped. A model
 * cannot invent a finding here, because a finding without a real quote does not
 * survive this function.
 */
export function verifyFindings(
  corpus: Corpus,
  raw: unknown,
  opts: { defaultSkill?: string; only?: CategoryId; cap?: number } = {},
): VerifyOutcome {
  const findings: Finding[] = [];
  const dropped: { reason: string; title: string }[] = [];
  const cap = opts.cap ?? MAX_PER_SKILL;

  const list = Array.isArray((raw as { findings?: unknown })?.findings)
    ? (raw as { findings: RawReviewFinding[] }).findings
    : [];
  const seen = new Set<string>();

  for (const r of list) {
    const title = typeof r.title === "string" ? r.title.trim() : "";
    const label = title || "(untitled)";

    if (findings.length >= cap) {
      dropped.push({ reason: "over the per-skill cap", title: label });
      continue;
    }
    if (!title) {
      dropped.push({ reason: "no title", title: label });
      continue;
    }
    if (typeof r.categoryId !== "string" || !CATEGORY_IDS.has(r.categoryId)) {
      dropped.push({ reason: "category is not one of ours", title: label });
      continue;
    }
    if (opts.only && r.categoryId !== opts.only) {
      dropped.push({ reason: `not a ${opts.only} finding`, title: label });
      continue;
    }
    if (typeof r.severity !== "string" || !SEVERITIES.has(r.severity)) {
      dropped.push({ reason: "severity is not one of ours", title: label });
      continue;
    }
    const evidence = unfenceQuote(typeof r.evidence === "string" ? r.evidence : "");
    const at = place(corpus, typeof r.file === "string" ? r.file : "", evidence);
    if (at === null) {
      // The single most important branch in this file.
      dropped.push({ reason: "quote is not in any file we hold", title: label });
      continue;
    }
    const why = typeof r.why === "string" ? r.why.trim() : "";
    const fix = typeof r.fix === "string" ? r.fix.trim() : "";
    if (!why || !fix) {
      dropped.push({ reason: "no consequence or no fix", title: label });
      continue;
    }
    // The title is part of the key on purpose. Several distinct findings legitimately
    // quote one line — a frontmatter block with no version, no author and no licence is
    // three separate things wrong in the same four lines — and keying on the quote alone
    // silently collapsed them into one. Only a claim that repeats both the quote and the
    // point it is making is a repeat.
    const key = `${r.categoryId}:${at.file}:${collapse(evidence).toLowerCase()}:${collapse(title).toLowerCase()}`;
    if (seen.has(key)) {
      dropped.push({ reason: "duplicate of an earlier finding", title: label });
      continue;
    }
    seen.add(key);

    findings.push({
      checkId: "audit",
      categoryId: r.categoryId as CategoryId,
      severity: r.severity as Severity,
      skill: opts.defaultSkill ?? at.skill,
      file: at.file,
      line: at.line,
      title: clip(title, MAX_TITLE),
      evidence: clip(evidence.trim(), MAX_TEXT),
      why: clip(why, MAX_TEXT),
      fix: clip(fix, MAX_TEXT),
      ast: [],
      origin: "model",
    });
  }

  return { findings, dropped };
}

/** One skill's audit: the corpus is that skill's files, and every finding is attributed to it. */
export function verifySkill(skill: SkillDoc, raw: unknown): VerifyOutcome {
  return verifyFindings(corpusOf([skill]), raw, { defaultSkill: skill.name });
}

/** The cross-skill pass: quotes may come from any skill, and only library findings survive. */
export function verifyLibrary(skills: SkillDoc[], raw: unknown): VerifyOutcome {
  return verifyFindings(corpusOf(skills), raw, { only: "library", cap: MAX_PER_SKILL });
}
