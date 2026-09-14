import { CATEGORIES, SEVERITY_ORDER, type CategoryId, type Finding, type Severity, type SkillDoc } from "../types.ts";

const CATEGORY_IDS = new Set<string>(CATEGORIES.map((c) => c.id));
const SEVERITIES = new Set<string>(SEVERITY_ORDER);

/** A model is allowed this many findings per skill. Past that it is padding. */
export const MAX_PER_SKILL = 6;
const MAX_TITLE = 90;
const MAX_TEXT = 400;

export interface RawReviewFinding {
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
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

/**
 * Find the 1-based line where `needle` occurs in `lines`, exactly first, then on
 * whitespace-collapsed text so a model that reflowed a wrapped sentence is not
 * punished for it. Returns null when the quote is not in the file at all — and a
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

/**
 * Turn what the model said into findings we are willing to show, or into nothing.
 *
 * This is the trust boundary. The model's output is a claim about a file we hold,
 * so every claim is checked back against that file and anything unverifiable is
 * dropped. A model cannot invent a finding here, because a finding without a real
 * quote does not survive this function.
 */
export function verifyReview(skill: SkillDoc, raw: unknown): VerifyOutcome {
  const findings: Finding[] = [];
  const dropped: { reason: string; title: string }[] = [];

  const list = Array.isArray((raw as { findings?: unknown })?.findings) ? ((raw as { findings: RawReviewFinding[] }).findings) : [];
  const seen = new Set<string>();

  for (const r of list) {
    const title = typeof r.title === "string" ? r.title.trim() : "";
    const label = title || "(untitled)";

    if (findings.length >= MAX_PER_SKILL) {
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
    if (typeof r.severity !== "string" || !SEVERITIES.has(r.severity)) {
      dropped.push({ reason: "severity is not one of ours", title: label });
      continue;
    }
    const evidence = typeof r.evidence === "string" ? r.evidence : "";
    const line = locate(skill.lines, evidence);
    if (line === null) {
      // The single most important branch in this file.
      dropped.push({ reason: "quote is not in the file", title: label });
      continue;
    }
    const why = typeof r.why === "string" ? r.why.trim() : "";
    const fix = typeof r.fix === "string" ? r.fix.trim() : "";
    if (!why || !fix) {
      dropped.push({ reason: "no consequence or no fix", title: label });
      continue;
    }
    const key = `${r.categoryId}:${collapse(evidence).toLowerCase()}`;
    if (seen.has(key)) {
      dropped.push({ reason: "duplicate of an earlier finding", title: label });
      continue;
    }
    seen.add(key);

    findings.push({
      checkId: "review-semantic",
      categoryId: r.categoryId as CategoryId,
      severity: r.severity as Severity,
      skill: skill.name,
      file: skill.skillPath,
      line,
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
