// Atlan Scan — core types.
// Design invariants, do not relax without a decision:
//  1. Every Finding MUST carry a verbatim `evidence` string. A finding without a
//     quote is a scare, and scares are what the registry graveyard was made of.
//  2. We never emit a safety verdict, score or "SAFE" badge. SkillCloak (HKUST,
//     Jul 2026) evaded all eight tested scanners >90%. We report what is visible
//     in the text that ships, and we report what we could not read.
//  3. Skill bodies are never persisted. Only findings, counts and a SHA-256.

export const ENGINE_VERSION = "scan-1.0.0";

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
   * Where this finding came from. "engine" is the fixed 50-check skeleton:
   * deterministic, no model. "model" is the semantic review — a model that was
   * shown the skill as data and asked what it would make an agent do. Model
   * findings are kept in their own block and never counted into the skeleton,
   * because the promise that two scans of one folder match belongs to the
   * engine alone.
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

export interface CheckResult {
  id: string;
  name: string;
  blurb: string;
  count: number;
  worst: Severity | null;
}

export interface CategoryResult {
  id: CategoryId;
  name: string;
  ast: string[];
  blurb: string;
  count: number;
  worst: Severity | null;
  /** Always the full catalog for this category, in catalog order. Cleared checks are listed too. */
  checks: CheckResult[];
}

export interface LibraryStats {
  /** Chars of name+description+when_to_use across all skills — what is always loaded. */
  listingChars: number;
  /** Anthropic truncates description+when_to_use at 1,536 chars per skill. */
  budgetChars: number;
  overlapPairs: { a: string; b: string; similarity: number }[];
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
    bySeverity: Record<Severity, number>;
  };
  library: LibraryStats;
  /**
   * The semantic review, when it ran. Kept beside the engine result rather than
   * merged into it: the 50 checks are the part that is identical every time, and
   * the model's reading is reported as its own, clearly attributed block.
   */
  review?: ReviewSummary;
}

export interface ReviewSummary {
  ran: boolean;
  model: string;
  reviewed: number;
  cached: number;
  /** Claims the model made that could not be verified against the file, and were dropped. */
  dropped: number;
  /** Findings the engine had already reported on the same skill, category and line. */
  duplicates?: number;
  failures: { skill: string; reason: string }[];
  findings: Finding[];
}

export type ENGINE_VERSION_T = string;

export interface CheckContext {
  skill: SkillDoc;
  /** Command-like lines only: fenced code, indented code, or a line starting with a shell verb. */
  commandLines: { line: number; text: string }[];
}

export type Check = (ctx: CheckContext) => Finding[];
