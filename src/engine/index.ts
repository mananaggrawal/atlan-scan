import { randomBytes } from "node:crypto";
import type {
  CategoryResult, Finding, ScanResult, Severity, SkillSummary, ReviewSummary,
} from "./types.ts";
import { CATEGORIES, ENGINE_VERSION, SEVERITY_ORDER, worstOf } from "./types.ts";
import { libraryFacts, skillFacts } from "./facts.ts";
import { parseTree, type RawFile } from "./parse.ts";
import { auditSkills, reviewEnabled, REVIEW_MODEL, type AuditReport, type ReviewCache } from "./review/index.ts";

export function newRunId(): string {
  return randomBytes(9).toString("base64url");
}

export interface ScanInput {
  files: RawFile[];
  source: { kind: "upload" | "github" | "cli"; label: string };
}

const NO_AUDIT: AuditReport = {
  ran: false, model: REVIEW_MODEL, cached: 0, reviewed: 0, dropped: 0,
  failures: [], clipped: [], partial: [], findings: [], usage: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  limits: { readChars: 0, readDefault: 0, outputTokens: 0, outputDefault: 0 },
};

/**
 * Assemble the report.
 *
 * This function decides nothing. It parses the upload, measures what can be
 * measured, hands every file to the auditor, and arranges what comes back into
 * the fixed shape the report renders. Every finding in the result was written by
 * a model reading the skill; every number beside it was counted from the files.
 * If you find yourself adding a rule here about what is or is not a problem, it
 * belongs in skills/skill-audit/SKILL.md instead — that is the whole point.
 */
export function assemble({ files, source }: ScanInput, audit: AuditReport): ScanResult {
  const tree = parseTree(files);
  const findings = [...audit.findings];

  findings.sort((a, b) => {
    const s = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (s !== 0) return s;
    return a.skill.localeCompare(b.skill) || a.title.localeCompare(b.title);
  });

  const skills: SkillSummary[] = tree.skills.map((s) => {
    const facts = skillFacts(s);
    const mine = findings.filter((f) => f.skill === s.name);
    return {
      name: s.name,
      path: s.skillPath,
      files: s.files.length,
      descriptionChars: facts.descriptionChars,
      bodyLines: facts.bodyLines,
      findings: mine.length,
      worst: worstOf(mine.map((f) => f.severity)),
      sha256: s.sha256,
    };
  });

  // Every category is reported on every run, cleared or not. A category that was
  // skipped and a category that came back clean must never look the same, and the
  // fixed skeleton is what makes two reports comparable.
  const categories: CategoryResult[] = CATEGORIES.map((c) => {
    const mine = findings.filter((f) => f.categoryId === c.id);
    return {
      id: c.id,
      name: c.name,
      ast: c.ast,
      blurb: c.blurb,
      count: mine.length,
      worst: worstOf(mine.map((f) => f.severity)),
      findings: mine,
    };
  });

  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as Record<Severity, number>;
  for (const f of findings) bySeverity[f.severity]++;

  const summary: ReviewSummary = {
    ran: audit.ran,
    model: audit.model,
    reviewed: audit.reviewed,
    cached: audit.cached,
    dropped: audit.dropped,
    failures: audit.failures,
    findings: audit.findings,
    usage: audit.usage,
    limits: audit.limits,
  };

  return {
    runId: newRunId(),
    scannedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    source,
    objectType: "skill",
    skills,
    findings,
    unreadable: tree.unreadable,
    notFullyRead: audit.clipped,
    partial: audit.partial,
    categories,
    totals: {
      skills: tree.skills.length,
      files: tree.fileCount,
      findings: findings.length,
      nonText: tree.nonTextCount,
      ignored: tree.ignored,
      bySeverity,
    },
    library: libraryFacts(tree.skills),
    audit: summary,
  };
}

/**
 * Scan a folder: parse it, audit it, render it.
 *
 * With no ANTHROPIC_API_KEY there is no audit — the model is the audit — so the
 * result comes back with `audit.ran: false` and no findings. That is not a clean
 * report and must never be shown as one; every surface that renders a result
 * checks `audit.ran` and says so.
 */
export async function runScan(input: ScanInput, cache?: ReviewCache): Promise<ScanResult> {
  const tree = parseTree(input.files);
  const audit = reviewEnabled() ? await auditSkills(tree.skills, cache) : NO_AUDIT;
  return assemble(input, audit);
}

export { CATEGORIES, ENGINE_VERSION, SEVERITY_ORDER, worstOf };
export { reviewEnabled, REVIEW_MODEL } from "./review/index.ts";
export type { AuditReport, ReviewCache } from "./review/index.ts";
export type { Finding };
