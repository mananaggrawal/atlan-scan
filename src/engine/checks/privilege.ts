import type { Check, Finding } from "../types.ts";
import { mk, firstMatch } from "./util.ts";

const BYPASS =
  /(--dangerously-skip-permissions|--yolo\b|--no-confirm\b|--force-approve\b|autoApprove|bypassPermissions|"acceptEdits"|'acceptEdits'|`acceptEdits`|permission-?mode\s*[:=]\s*["'`]?(accept|bypass))/;
const SUDO = /\bsudo\s+\S/;
const BROAD_PATH = /(^|["'\s])(\/etc\/|\/usr\/|\/var\/|\/System\/|~\/\.(?!claude\b)[a-z]|\$HOME\/\.(?!claude\b)[a-z])/;

function toolList(raw: string): string[] {
  return raw
    .replace(/^\[|\]$/g, "")
    .split(/[,\n]/)
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

export const privilegeChecks: Check[] = [
  ({ skill }) => {
    const raw = skill.frontmatter["allowed-tools"] ?? skill.frontmatter["allowed_tools"] ?? "";
    if (!raw) return [];
    const tools = toolList(raw);
    const out: Finding[] = [];
    const line = skill.lines.findIndex((l) => /allowed[-_]tools/i.test(l)) + 1 || null;

    if (tools.some((t) => t === "*" || t === "all")) {
      out.push(
        mk({
          checkId: "privilege-wildcard-tools",
          categoryId: "over-privilege",
          severity: "critical",
          skill,
          line,
          title: "Grants every tool",
          evidence: `allowed-tools: ${raw}`,
          why: "allowed-tools runs without a permission prompt. A wildcard means this skill can do anything your agent can do, with no moment where you get asked.",
          fix: "List only the tools the task needs, and constrain Bash to specific commands.",
          ast: ["AST03"],
        }),
      );
    }
    const bareBash = tools.find((t) => /^Bash$/i.test(t) || /^Bash\(\s*\*?\s*\)$/i.test(t));
    if (bareBash) {
      out.push(
        mk({
          checkId: "privilege-unconstrained-shell",
          categoryId: "over-privilege",
          severity: "critical",
          skill,
          line,
          title: "Unconstrained shell access",
          evidence: `allowed-tools: ${raw}`,
          why: "Bash without a command filter is arbitrary code execution on your machine, granted at install time and never prompted again.",
          fix: 'Constrain it, e.g. Bash(git status:*), Bash(npm test:*). One entry per command you actually need.',
          ast: ["AST03"],
        }),
      );
    }
    const cats = {
      shell: tools.some((t) => /^Bash/i.test(t)),
      net: tools.some((t) => /^(WebFetch|WebSearch|Fetch)/i.test(t)),
      write: tools.some((t) => /^(Write|Edit|MultiEdit|NotebookEdit)/i.test(t)),
    };
    if (cats.shell && cats.net && cats.write && !bareBash) {
      out.push(
        mk({
          checkId: "privilege-combo",
          categoryId: "over-privilege",
          severity: "high",
          skill,
          line,
          title: "Shell, network and write access in one skill",
          evidence: `allowed-tools: ${raw}`,
          why: "Individually reasonable, together a complete path: read anything, change anything, send it anywhere. Most skills need at most two of the three.",
          fix: "Split the skill, or drop the capability the task can do without.",
          ast: ["AST03"],
        }),
      );
    }
    return out;
  },
  ({ skill }) => {
    const hit = firstMatch(skill, BYPASS);
    if (!hit) return [];
    return [
      mk({
        checkId: "privilege-permission-bypass",
        categoryId: "over-privilege",
        severity: "critical",
        skill,
        file: hit.path,
        line: hit.line,
        title: "Tells the agent to skip permission prompts",
        evidence: hit.text,
        why: "The permission prompt is the last place a human can stop an action. A skill that asks you to disable it is asking for unreviewed execution.",
        fix: "Remove the flag. If a step genuinely needs standing approval, say which step and why, and let the user grant it themselves.",
        ast: ["AST03", "AST06"],
      }),
    ];
  },
  ({ skill, commandLines }) => {
    const hit = commandLines.find((c) => SUDO.test(c.text));
    if (!hit) return [];
    return [
      mk({
        checkId: "privilege-sudo",
        categoryId: "over-privilege",
        severity: "high",
        skill,
        line: hit.line,
        title: "Requests root",
        evidence: hit.text,
        why: "Root turns a mistake in a skill into a mistake on the whole machine. Very little a skill does needs it.",
        fix: "Drop sudo, or move the privileged step out of the skill and into a documented one-time setup the user performs.",
        ast: ["AST03", "AST06"],
      }),
    ];
  },
  ({ skill, commandLines }) => {
    const out: Finding[] = [];
    for (const c of commandLines) {
      if (!BROAD_PATH.test(c.text)) continue;
      if (!/\b(rm|mv|cp|tee|chmod|chown|>|>>|write|install)\b/.test(c.text)) continue;
      out.push(
        mk({
          checkId: "privilege-writes-outside-workspace",
          categoryId: "over-privilege",
          severity: "high",
          skill,
          line: c.line,
          title: "Writes outside the workspace",
          evidence: c.text,
          why: "Changes to system or home-level paths outlive the project and are invisible when you later delete the skill.",
          fix: "Keep writes inside the project directory, or state the path and ask before touching it.",
          ast: ["AST03"],
        }),
      );
      if (out.length >= 4) break;
    }
    return out;
  },
];
