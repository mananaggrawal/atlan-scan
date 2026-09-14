import type { Check, Finding } from "../types.ts";
import { mk } from "./util.ts";

/** Anthropic truncates description + when_to_use at 1,536 chars "to reduce context usage". */
export const DESCRIPTION_BUDGET = 1536;
/** Documented SKILL.md ceiling. */
export const BODY_LINE_LIMIT = 500;

const UNSAFE_YAML = /(!!python\/|!!ruby\/|!!java|!!map|<<\s*:\s*\*|&[A-Za-z0-9_]+\s*$|\*[A-Za-z0-9_]+\s*$)/;

export const metadataChecks: Check[] = [
  ({ skill }) => {
    const out: Finding[] = [];
    if (!skill.frontmatterRaw.trim()) {
      out.push(
        mk({
          checkId: "metadata-no-frontmatter",
          categoryId: "metadata",
          severity: "medium",
          skill,
          line: 1,
          title: "No frontmatter block",
          evidence: (skill.lines[0] ?? "(empty file)").trim() || "(file starts with an empty line)",
          why: "Without frontmatter the agent has no name or trigger for this skill, so it will either never fire or fire on everything.",
          fix: "Add a --- block with name and description at the top of the file.",
          ast: ["AST04"],
        }),
      );
      return out;
    }
    if (!skill.frontmatter["name"]) {
      out.push(
        mk({
          checkId: "metadata-missing-name",
          categoryId: "metadata",
          severity: "low",
          skill,
          line: 2,
          title: "No name in frontmatter",
          evidence: skill.frontmatterRaw.split(/\r?\n/)[0] ?? "---",
          why: "The name is how the skill is referenced, pinned and reported on. Without it, tooling falls back to the folder name.",
          fix: "Add name: <slug> to the frontmatter.",
          ast: ["AST04"],
        }),
      );
    }
    if (!skill.frontmatter["description"]) {
      out.push(
        mk({
          checkId: "metadata-missing-description",
          categoryId: "metadata",
          severity: "medium",
          skill,
          line: 2,
          title: "No description in frontmatter",
          evidence: skill.frontmatterRaw.split(/\r?\n/)[0] ?? "---",
          why: "The description is the only thing the agent sees when deciding whether to load this skill. Without one it is effectively invisible.",
          fix: "Add a description that says what the skill does and when it should fire.",
          ast: ["AST04"],
        }),
      );
    }
    return out;
  },
  ({ skill }) => {
    const desc = skill.frontmatter["description"] ?? "";
    const when = skill.frontmatter["when_to_use"] ?? skill.frontmatter["when-to-use"] ?? "";
    const total = desc.length + when.length;
    if (total <= DESCRIPTION_BUDGET) return [];
    const line = skill.lines.findIndex((l) => /^description\s*:/i.test(l)) + 1 || 2;
    return [
      mk({
        checkId: "metadata-over-budget",
        categoryId: "metadata",
        severity: "medium",
        skill,
        line,
        title: `Description is ${total.toLocaleString()} chars, over the ${DESCRIPTION_BUDGET.toLocaleString()} budget`,
        evidence: desc.slice(0, 160),
        why: `description and when_to_use are truncated at ${DESCRIPTION_BUDGET.toLocaleString()} characters. Everything past that is cut, so any trigger wording at the end never reaches the model.`,
        fix: "Cut to the shortest text that still distinguishes this skill from your others. Detail belongs in the body, which loads only when the skill fires.",
        ast: ["AST04"],
      }),
    ];
  },
  ({ skill }) => {
    const desc = skill.frontmatter["description"] ?? "";
    if (desc.length < 80) return [];
    const commas = (desc.match(/,/g) ?? []).length;
    const words = desc.split(/\s+/).filter(Boolean);
    const unique = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, "")));
    const density = commas / Math.max(words.length, 1);
    const repetition = 1 - unique.size / Math.max(words.length, 1);
    if (density < 0.14 && repetition < 0.42) return [];
    const line = skill.lines.findIndex((l) => /^description\s*:/i.test(l)) + 1 || 2;
    return [
      mk({
        checkId: "metadata-keyword-stuffed",
        categoryId: "metadata",
        severity: "low",
        skill,
        line,
        title: "Description reads as a keyword list",
        evidence: desc.slice(0, 160),
        why: "Stuffing trigger words makes the skill fire on prompts it has no business in — which costs context on every turn and crowds out the skill that should have fired.",
        fix: "Write one or two sentences a human would recognise. Precision beats coverage.",
        ast: ["AST04"],
      }),
    ];
  },
  ({ skill }) => {
    const bodyLines = skill.body.split(/\r?\n/).length;
    if (bodyLines <= BODY_LINE_LIMIT) return [];
    return [
      mk({
        checkId: "metadata-body-over-limit",
        categoryId: "metadata",
        severity: "low",
        skill,
        line: BODY_LINE_LIMIT,
        title: `SKILL.md body is ${bodyLines.toLocaleString()} lines`,
        evidence: (skill.body.split(/\r?\n/)[BODY_LINE_LIMIT] ?? "").trim() || `line ${BODY_LINE_LIMIT} of the body`,
        why: `The documented ceiling is ${BODY_LINE_LIMIT} lines. Past that the file is both expensive to load and unlikely to have been read in full by anyone reviewing it.`,
        fix: "Move detail into reference files the skill loads on demand.",
        ast: ["AST04", "AST08"],
      }),
    ];
  },
  ({ skill }) => {
    const lines = skill.frontmatterRaw.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i] ?? "";
      if (!UNSAFE_YAML.test(text)) continue;
      return [
        mk({
          checkId: "metadata-unsafe-yaml",
          categoryId: "metadata",
          severity: "high",
          skill,
          line: i + 2,
          title: "Unsafe YAML construct in frontmatter",
          evidence: text.trim(),
          why: "Type tags, anchors and merge keys are executed or expanded by some parsers. Frontmatter is parsed before anyone decides whether to trust the skill.",
          fix: "Use plain scalar keys and values only.",
          ast: ["AST04"],
        }),
      ];
    }
    return [];
  },
];

// ---------------------------------------------------------------------------
// Provenance and accountability.
//
// These fire on skills that are otherwise well written, and that is the point:
// a skill can carry nothing dangerous in its text and still be impossible to
// govern, because nobody can say who owns it, what version you have, or what
// it is allowed to touch. Every one of these quotes a real line (or the real
// absence of one, anchored to the frontmatter) and is reported at info/low —
// posture, not danger.
// ---------------------------------------------------------------------------

const VERSION_KEYS = ["version", "v", "revision"];
const OWNER_KEYS = ["author", "owner", "maintainer", "team", "contact"];
const LICENSE_FILE = /(^|\/)(LICENSE|LICENCE|COPYING)(\.[A-Za-z0-9]+)?$/i;

/** The frontmatter line to anchor an "absent key" finding to, plus its text. */
function fmAnchor(skill: { frontmatterRaw: string }): { line: number; text: string } {
  const lines = skill.frontmatterRaw.split(/\r?\n/);
  const i = lines.findIndex((l) => /^\s*name\s*:/.test(l));
  const at = i >= 0 ? i : 0;
  return { line: at + 2, text: (lines[at] ?? "---").trim() || "---" };
}

export const provenanceChecks: Check[] = [
  ({ skill }) => {
    if (!skill.frontmatterRaw.trim()) return [];
    if (VERSION_KEYS.some((k) => skill.frontmatter[k])) return [];
    const a = fmAnchor(skill);
    return [
      mk({
        checkId: "metadata-no-version",
        categoryId: "metadata",
        severity: "info",
        skill,
        line: a.line,
        title: "No version in frontmatter",
        evidence: a.text,
        why: "Without a version there is no way to tell whether this is the same skill you reviewed last month. It can be rewritten in place and every scan, diff and approval you have recorded still points at the same name.",
        fix: "Add a version: to the frontmatter and raise it whenever the body changes.",
        ast: ["AST04", "AST07"],
      }),
    ];
  },
  ({ skill }) => {
    if (!skill.frontmatterRaw.trim()) return [];
    if (OWNER_KEYS.some((k) => skill.frontmatter[k])) return [];
    const a = fmAnchor(skill);
    return [
      mk({
        checkId: "metadata-no-owner",
        categoryId: "metadata",
        severity: "info",
        skill,
        line: a.line,
        title: "No owner in frontmatter",
        evidence: a.text,
        why: "Nothing in the file says who is accountable for it. When this skill misfires, there is no one to route it to and no one who has to answer for the next version.",
        fix: "Add an author: or owner: naming a person or a team, not a mailing list.",
        ast: ["AST04"],
      }),
    ];
  },
  ({ skill }) => {
    if (!skill.frontmatterRaw.trim()) return [];
    if (skill.files.some((f) => LICENSE_FILE.test(f.path))) return [];
    if (skill.frontmatter["license"]) return [];
    const a = fmAnchor(skill);
    return [
      mk({
        checkId: "metadata-no-license",
        categoryId: "metadata",
        severity: "info",
        skill,
        line: a.line,
        title: "No license beside the skill",
        evidence: a.text,
        why: "The terms you are installing under are unstated. For a skill that came from outside the company, that is the difference between something legal can sign off and something nobody can.",
        fix: "Add a LICENSE file to the skill folder, or a license: key to the frontmatter.",
        ast: ["AST02"],
      }),
    ];
  },
  ({ skill }) => {
    if (!skill.frontmatterRaw.trim()) return [];
    if (skill.frontmatter["allowed-tools"] || skill.frontmatter["allowed_tools"]) return [];
    const a = fmAnchor(skill);
    return [
      mk({
        checkId: "metadata-tools-undeclared",
        categoryId: "metadata",
        severity: "info",
        skill,
        line: a.line,
        title: "No declared tool list",
        evidence: a.text,
        why: "With no allowed-tools the skill inherits whatever the agent already has — shell, network, file writes — whether it needs them or not. The blast radius is the agent's, not the skill's.",
        fix: "Declare allowed-tools with the smallest set the skill actually uses.",
        ast: ["AST03"],
      }),
    ];
  },
  ({ skill }) => {
    const desc = skill.frontmatter["description"] ?? "";
    if (!desc) return [];
    const clauses = desc.split(/\bor\b/i).length - 1;
    if (clauses < 5) return [];
    const line = skill.lines.findIndex((l) => /^\s*description\s*:/.test(l)) + 1;
    return [
      mk({
        checkId: "metadata-broad-trigger",
        categoryId: "metadata",
        severity: "low",
        skill,
        line: line || 3,
        title: "Trigger covers many alternatives",
        evidence: desc.slice(0, 160),
        why: `The description offers ${clauses + 1} separate ways to fire. The wider the trigger, the more turns this skill loads into, and the more often it wins a prompt that belonged to something else.`,
        fix: "Split it, or narrow the description to the cases this skill is genuinely best at.",
        ast: ["AST04", "AST09"],
      }),
    ];
  },
];
