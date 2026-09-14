import { randomBytes } from "node:crypto";
import type {
  CategoryResult, Finding, ScanResult, Severity, SkillSummary,
} from "./types.ts";
import { CATEGORIES, ENGINE_VERSION, SEVERITY_ORDER, worstOf } from "./types.ts";
import { CHECK_CATALOG } from "./catalog.ts";
import { contextFor, parseTree, type RawFile } from "./parse.ts";
import { injectionChecks } from "./checks/injection.ts";
import { externalChecks } from "./checks/external.ts";
import { supplyChecks } from "./checks/supply.ts";
import { privilegeChecks } from "./checks/privilege.ts";
import { exfilChecks } from "./checks/exfil.ts";
import { opacityChecks } from "./checks/opacity.ts";
import { metadataChecks } from "./checks/metadata.ts";
import { libraryFindings } from "./library.ts";

const PER_SKILL_CHECKS = [
  ...injectionChecks,
  ...externalChecks,
  ...supplyChecks,
  ...privilegeChecks,
  ...exfilChecks,
  ...opacityChecks,
  ...metadataChecks,
];

export function newRunId(): string {
  return randomBytes(9).toString("base64url");
}

export interface ScanInput {
  files: RawFile[];
  source: { kind: "upload" | "github" | "cli"; label: string };
}

export function runScan({ files, source }: ScanInput): ScanResult {
  const tree = parseTree(files);
  const findings: Finding[] = [];

  for (const skill of tree.skills) {
    const ctx = contextFor(skill);
    for (const check of PER_SKILL_CHECKS) {
      try {
        findings.push(...check(ctx));
      } catch (err) {
        // A broken check must never take the scan down, and must never look like a pass.
        findings.push({
          checkId: "engine-check-error",
          categoryId: "opacity",
          severity: "info",
          skill: skill.name,
          file: skill.skillPath,
          line: null,
          title: "A check could not complete on this skill",
          evidence: `${(err as Error).message ?? String(err)}`,
          why: "This part of the skill was not examined. It is reported rather than dropped, because a silent skip is indistinguishable from a clean result.",
          fix: "Re-run the scan. If it recurs, send us the skill name.",
          ast: [],
        });
      }
    }
  }

  const lib = libraryFindings(tree.skills);
  findings.push(...lib.findings);

  findings.sort((a, b) => {
    const s = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (s !== 0) return s;
    return a.skill.localeCompare(b.skill) || a.checkId.localeCompare(b.checkId);
  });

  const skills: SkillSummary[] = tree.skills.map((s) => {
    const mine = findings.filter((f) => f.skill === s.name);
    const desc = s.frontmatter["description"] ?? "";
    const when = s.frontmatter["when_to_use"] ?? s.frontmatter["when-to-use"] ?? "";
    return {
      name: s.name,
      path: s.skillPath,
      files: s.files.length,
      descriptionChars: desc.length + when.length,
      bodyLines: s.body.split(/\r?\n/).length,
      findings: mine.length,
      worst: worstOf(mine.map((f) => f.severity)),
      sha256: s.sha256,
    };
  });

  const categories: CategoryResult[] = CATEGORIES.map((c) => {
    const mine = findings.filter((f) => f.categoryId === c.id);
    // Every check in the catalog is reported, cleared or not — the skeleton never changes.
    const checks = CHECK_CATALOG.filter((m) => m.categoryId === c.id).map((m) => {
      const hits = findings.filter((f) => f.checkId === m.id);
      return {
        id: m.id,
        name: m.name,
        blurb: m.blurb,
        count: hits.length,
        worst: worstOf(hits.map((f) => f.severity)),
      };
    });
    return {
      id: c.id,
      name: c.name,
      ast: c.ast,
      blurb: c.blurb,
      count: mine.length,
      worst: worstOf(mine.map((f) => f.severity)),
      checks,
    };
  });

  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as Record<Severity, number>;
  for (const f of findings) bySeverity[f.severity]++;

  return {
    runId: newRunId(),
    scannedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    source,
    objectType: "skill",
    skills,
    findings,
    unreadable: tree.unreadable,
    categories,
    totals: {
      skills: tree.skills.length,
      files: tree.fileCount,
      findings: findings.length,
      nonText: tree.nonTextCount,
      bySeverity,
    },
    library: lib.stats,
  };
}

export { CATEGORIES, ENGINE_VERSION, SEVERITY_ORDER, worstOf };
export { CHECK_CATALOG } from "./catalog.ts";
