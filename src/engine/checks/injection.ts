import type { Check, Finding } from "../types.ts";
import { mk, allMatches, eachLine } from "./util.ts";

const OVERRIDE =
  /\b(ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|any|your|the)\b[^.\n]{0,30}\b(instruction|instructions|rule|rules|prompt|guidance|direction|constraint)/i;
const ROLE_REWRITE =
  /\b(you are now|from now on,? you|your new (role|identity|purpose)|act as if you (are|were)|pretend (to be|you are)|disregard your (role|identity|system))\b/i;
const SYSTEM_CLAIM =
  /\b(system prompt|system message|developer message)\b[^.\n]{0,40}\b(says|instructs|requires|overrides|replace|update)/i;
// Must read as an instruction at the head of a sentence or bullet, not as prose describing behaviour.
const DECEPTION =
  /^\s*(?:[-*+]\s*|\d+[.)]\s*|>\s*)?(?:\*\*)?(do not (tell|mention|inform|reveal|show)|don'?t (tell|mention|inform|reveal|show)|never (tell|mention|reveal)|silently|secretly|hide (this|it|the fact))\b[^.\n]{0,50}\b(user|human|owner|operator|them|it happened)\b/i;
const DECEPTION_BARE = /\b(do not (tell|mention|reveal) the user|never tell the user|keep this hidden)\b/i;
const TRUST_REMOTE =
  /\b(follow|execute|obey|apply|comply with)\b[^.\n]{0,30}\b(the )?(instructions?|directives?|commands?)\b[^.\n]{0,30}\b(at|from|in|on)\b[^.\n]{0,20}(https?:\/\/|the (page|url|site|response|endpoint|file at))/i;
const INVISIBLE = /[​-‏‪-‮⁠-⁤⁪-⁯﻿]/;


/**
 * Documentation about injection is not injection. Calibrated against anthropics/skills,
 * whose own guidance quotes override phrasing in order to warn against it.
 */
const META_PROSE =
  /\b(avoid|avoids|avoiding|do not use|don'?t use|never use|never write|instead of|rather than|for example|e\.g\.|anti-pattern|bad example|counter-?example|phrase (these|it|them)|wording|is not supported|by default|prompt injection|injection attack|never instructions|not instructions|as data|data to analy[sz]e|treat .{0,20}as data|aimed at (ai |llm )?agents?|could contain|may contain|if .{0,30}contains?|watch out for|beware)\b/i;

/** True when the match only survives inside backticks or quotes — i.e. it is being quoted, not issued. */
function onlyQuoted(line: string, re: RegExp): boolean {
  // Typographic quotes count too — a warning that quotes an example payload uses them.
  const stripped = line
    .replace(/`[^`]*`/g, " ")
    .replace(/"[^"]*"/g, " ")
    .replace(/'[^']*'/g, " ")
    .replace(/\u201c[^\u201d]*\u201d/g, " ")
    .replace(/\u2018[^\u2019]*\u2019/g, " ");
  re.lastIndex = 0;
  return !re.test(stripped);
}

function isProse(line: string, re: RegExp): boolean {
  return META_PROSE.test(line) || onlyQuoted(line, re);
}

export const injectionChecks: Check[] = [
  ({ skill }) => {
    const hits = allMatches(skill, OVERRIDE, 8).filter((h) => !isProse(h.text, OVERRIDE)).slice(0, 5);
    return hits.map((h) =>
      mk({
        checkId: "injection-override",
        categoryId: "injection",
        severity: "critical",
        skill,
        file: h.path,
        line: h.line,
        title: "Instruction-override language",
        evidence: h.text,
        why: "This is the classic shape of a prompt-injection payload: text that tells the agent to set aside the rules it was given before this skill loaded.",
        fix: "Delete the line. A legitimate skill describes what to do, it never tells the agent to ignore what it was already told.",
        ast: ["AST01"],
      }),
    );
  },
  ({ skill }) => {
    const hits = allMatches(skill, ROLE_REWRITE, 8).filter((h) => !isProse(h.text, ROLE_REWRITE)).slice(0, 5);
    return hits.map((h) =>
      mk({
        checkId: "injection-role-rewrite",
        categoryId: "injection",
        severity: "high",
        skill,
        file: h.path,
        line: h.line,
        title: "Rewrites the agent's role",
        evidence: h.text,
        why: "A skill that reassigns the agent's identity can move it outside the guardrails the operator set, for every turn after it loads.",
        fix: "Scope the instruction to the task ('when formatting a changelog, …') instead of redefining who the agent is.",
        ast: ["AST01"],
      }),
    );
  },
  ({ skill }) => {
    const hits = allMatches(skill, SYSTEM_CLAIM, 6).filter((h) => !isProse(h.text, SYSTEM_CLAIM)).slice(0, 3);
    return hits.map((h) =>
      mk({
        checkId: "injection-system-claim",
        categoryId: "injection",
        severity: "high",
        skill,
        file: h.path,
        line: h.line,
        title: "Claims to speak for the system prompt",
        evidence: h.text,
        why: "Impersonating a higher-privilege message is how a skill borrows authority it was never granted.",
        fix: "Remove the claim. A skill has no standing to describe or amend the system prompt.",
        ast: ["AST01"],
      }),
    );
  },
  ({ skill }) => {
    const hits = [...allMatches(skill, DECEPTION, 6), ...allMatches(skill, DECEPTION_BARE, 6)].filter(
      (h) => !META_PROSE.test(h.text),
    );
    const seen = new Set<string>();
    const out: Finding[] = [];
    for (const h of hits) {
      const key = `${h.path}:${h.line}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(
        mk({
          checkId: "injection-deception",
          categoryId: "injection",
          severity: "critical",
          skill,
          file: h.path,
          line: h.line,
          title: "Instructs the agent to conceal its behaviour",
          evidence: h.text,
          why: "An instruction to act without telling you is the difference between a tool and a backdoor. Everything else this skill does becomes unverifiable.",
          fix: "Remove it. If an action is worth taking, it is worth the agent saying it took it.",
          ast: ["AST01"],
        }),
      );
    }
    return out;
  },
  ({ skill }) => {
    const hits = allMatches(skill, TRUST_REMOTE, 6).filter((h) => !META_PROSE.test(h.text)).slice(0, 3);
    return hits.map((h) =>
      mk({
        checkId: "injection-trusts-remote-text",
        categoryId: "injection",
        severity: "critical",
        skill,
        file: h.path,
        line: h.line,
        title: "Treats fetched content as instructions",
        evidence: h.text,
        why: "Whoever can edit that source can steer your agent, at any time, without touching this repo. This is indirect prompt injection by design rather than by accident.",
        fix: "Fetch data, never directives. If remote text must be read, state explicitly that it is data and is not to be followed.",
        ast: ["AST01", "AST05"],
      }),
    );
  },
  ({ skill }) => {
    const out: Finding[] = [];
    for (const l of eachLine(skill)) {
      if (!INVISIBLE.test(l.text)) continue;
      const codes = [...l.text]
        .filter((ch) => INVISIBLE.test(ch))
        .slice(0, 6)
        .map((ch) => `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`);
      out.push(
        mk({
          checkId: "injection-invisible-characters",
          categoryId: "injection",
          severity: "high",
          skill,
          file: l.path,
          line: l.line,
          title: "Invisible characters in the instruction text",
          evidence: `${l.text.replace(INVISIBLE, "␠") || "(line is entirely invisible characters)"} — contains ${codes.join(", ")}`,
          why: "Zero-width and bidirectional-control characters let text read one way to a human reviewer and another way to the model. It is the cheapest way to hide an instruction in plain sight.",
          fix: "Strip the characters listed. No legitimate SKILL.md needs zero-width or bidi controls.",
          ast: ["AST01"],
        }),
      );
      if (out.length >= 5) break;
    }
    return out;
  },
  ({ skill }) => {
    const out: Finding[] = [];
    for (const f of skill.files) {
      if (f.text === null) continue;
      const re = /<!--([\s\S]{0,600}?)-->/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(f.text))) {
        const inner = (m[1] ?? "").trim();
        const STRONG = /\b(ignore|override|execute|run|fetch|send|curl|wget|post|do not tell|don'?t tell|api[- ]?key|token|secret|append to every|in every response)\b/i;
        const WEAK = /\b(you must|always|never|instruction)\b/i;
        if (!STRONG.test(inner) && !WEAK.test(inner)) continue;
        if (!STRONG.test(inner) && inner.length < 70) continue;
        const severity = STRONG.test(inner) ? "high" : "medium";
        const line = f.text.slice(0, m.index).split(/\r?\n/).length;
        out.push(
          mk({
            checkId: "injection-html-comment",
            categoryId: "injection",
            severity,
            skill,
            file: f.path,
            line,
            title: "Imperative text inside an HTML comment",
            evidence: inner,
            why: "Comments are invisible in a rendered README but fully visible to the model. Instructions placed there are aimed at the agent and hidden from the reviewer.",
            fix: "Move it into the visible body, or delete it.",
            ast: ["AST01"],
          }),
        );
        if (out.length >= 4) break;
      }
      if (out.length >= 4) break;
    }
    return out;
  },
];
