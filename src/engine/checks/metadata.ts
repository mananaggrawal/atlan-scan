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
