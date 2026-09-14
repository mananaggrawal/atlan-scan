// Atlan Scan — core types.
// Design invariants, do not relax without a decision:
//  1. Every Finding MUST carry a verbatim `evidence` string, located in a file we
//     hold. A finding without a quote is a scare, and scares are what the registry
//     graveyard was made of. This is enforced in review/verify.ts, which is the
//     only place in the scanner allowed to overrule the auditor.
//  0. The audit is a model reading the files, using skills/skill-audit/SKILL.md.
//     Nothing in this engine decides what is a finding. Code measures; the model
//     judges. Do not reintroduce pattern checks that emit findings.
//  2. We never emit a safety verdict, score or "SAFE" badge. SkillCloak (HKUST,
//     Jul 2026) evaded all eight tested scanners >90%. We report what is visible
//     in the text that ships, and we report what we could not read.
//  3. Skill bodies are never persisted. Only findings, counts and a SHA-256.

export const ENGINE_VERSION = "scan-2.0.0";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export function worstOf(severities: Severity[]): Severity | null {
  for (const s of SEVERITY_ORDER) if (severities.includes(s)) return s;
  return null;
}

export type CategoryId =
  | "injection"
  | "external-instructions"
  | "supply-chain"
  | "over-privilege"
  | "exfiltration"
  | "opacity"
  | "metadata"
  | "library";

export interface CategoryDef {
  id: CategoryId;
  name: string;
  ast: string[];
  blurb: string;
}

// Mapped to the OWASP Agentic Skills Top 10 v1.0 (AST01-AST10, 2026 edition).
export const CATEGORIES: CategoryDef[] = [
  {
    id: "injection",
    name: "Prompt injection & instruction hijack",
    ast: ["AST01"],
    blurb: "Text in the skill that tries to override the agent's rules, change its role, or hide what it is doing from you.",
  },
  {
    id: "external-instructions",
    name: "Untrusted external instructions",
    ast: ["AST05"],
    blurb: "The skill pulls text from somewhere else at run time and treats it as instructions. Whoever controls that source controls your agent.",
  },
  {
    id: "supply-chain",
    name: "Supply chain & drift",
    ast: ["AST02", "AST07"],
    blurb: "What this skill installs, from where, and whether the version is pinned to something that cannot change under you.",
  },
  {
    id: "over-privilege",
    name: "Over-privilege",
    ast: ["AST03"],
    blurb: "Tool permissions wider than the job needs. allowed-tools executes without a permission prompt.",
  },
  {
    id: "exfiltration",
    name: "Data-exfiltration paths",
    ast: ["AST05"],
    blurb: "Reads credentials or your codebase, and has a way to send them somewhere. The pairing is the finding.",
  },
  {
    id: "opacity",
    name: "Hidden & unreadable content",
    ast: ["AST08"],
    blurb: "Content a human almost certainly never read: encoded blobs, files in skipped directories, binaries, bulk references.",
  },
  {
    id: "metadata",
    name: "Metadata hygiene",
    ast: ["AST04"],
    blurb: "Frontmatter that is unsafe to parse, oversized, or written to fire on prompts it has no business in.",
  },
  {
    id: "library",
    name: "Library-level findings",
    ast: ["AST09"],
    blurb: "What only shows up when you look at the whole folder at once: collisions, duplicates, total context cost.",
  },
];

export interface Finding {
  checkId: string;
  categoryId: CategoryId;
  severity: Severity;
  /** Skill name, or "(library)" for whole-folder findings. */
  skill: string;
  /** Path relative to the scanned root. */
  file: string;
  line: number | null;
  title: string;
  /** Verbatim from the scanned text. Hard invariant: never empty. */
  evidence: string;
  why: string;
  fix: string;
  ast: string[];
  /**
   * Where this finding came from. Every finding in a report is "model" — a model
   * was shown the skill as data, with the auditor skill as its instructions, and
   * asked what it would make an agent do. The field is kept because a stored run
   * from an older engine version may carry "engine", and because a future
   * second opinion should be attributable rather than blended in.
   */
  origin?: "engine" | "model";
}

export interface FileEntry {
  path: string;
  bytes: number;
  /** null when the file could not be decoded as text. */
  text: string | null;
  readable: boolean;
  reason?: string;
}

export interface SkillDoc {
  name: string;
  dir: string;
  skillPath: string;
  frontmatterRaw: string;
  frontmatter: Record<string, string>;
  body: string;
  lines: string[];
  files: FileEntry[];
  sha256: string;
}

export interface Unreadable {
  path: string;
  bytes: number;
  reason: string;
}

export interface SkillSummary {
  name: string;
  path: string;
  files: number;
  descriptionChars: number;
  bodyLines: number;
  findings: number;
  worst: Severity | null;
  sha256: string;
}

export interface CategoryResult {
  id: CategoryId;
  name: string;
  ast: string[];
  blurb: string;
  count: number;
  worst: Severity | null;
  /** Findings in this category, worst first. Empty means the auditor reported nothing here. */
  findings: Finding[];
}

export interface LibraryStats {
  /** Chars of name+description+when_to_use across all skills — what is always loaded. */
  listingChars: number;
  /** Anthropic truncates description+when_to_use at 1,536 chars per skill. */
  budgetChars: number;
  skills: number;
  /** Measured description overlap, 0-1. No threshold applied — the auditor decides. */
  overlapPairs: { a: string; b: string; similarity: number }[];
  /** Measured body overlap, 0-1, same terms. */
  duplicatePairs: { a: string; b: string; similarity: number }[];
}

export interface ScanResult {
  runId: string;
  scannedAt: string;
  engineVersion: ENGINE_VERSION_T;
  source: { kind: "upload" | "github" | "cli"; label: string };
  objectType: "skill";
  skills: SkillSummary[];
  findings: Finding[];
  unreadable: Unreadable[];
  categories: CategoryResult[];
  totals: {
    skills: number;
    files: number;
    findings: number;
    /** Images, fonts, archives — not text by design. */
    nonText: number;
    /** OS leftovers (.DS_Store and friends) dropped before the scan. */
    ignored: number;
    bySeverity: Record<Severity, number>;
  };
  library: LibraryStats;
  /** Files shown to the auditor only in part, because the skill exceeded the per-skill budget. */
  notFullyRead: { skill: string; path: string; shown: number; of: number }[];
  /** Skills whose audit was cut off at the model's output ceiling. Partial, and said to be. */
  partial: { skill: string; kept: number }[];
  /**
   * The audit itself — who read the files, how many were read, what was dropped
   * for failing verification, and what it cost. Not a footnote to the report:
   * `findings` above is what this returned.
   */
  audit: ReviewSummary;
}

export interface ReviewSummary {
  ran: boolean;
  model: string;
  reviewed: number;
  cached: number;
  /** Claims the model made that could not be verified against the file, and were dropped. */
  dropped: number;
  failures: { skill: string; reason: string }[];
  findings: Finding[];
  /** Tokens this run spent. Kept so cost is visible rather than inferred from a bill. */
  usage?: { input: number; output: number; cacheWrite: number; cacheRead: number };
}

export type ENGINE_VERSION_T = string;

/** Files shown only in part. Reported, because a clipped file must never read as a clean one. */
export interface Clipped {
  skill: string;
  path: string;
  shown: number;
  of: number;
}
