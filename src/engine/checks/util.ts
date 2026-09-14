import type { CategoryId, Finding, Severity, SkillDoc } from "../types.ts";
import { quote } from "../parse.ts";

export interface MakeArgs {
  checkId: string;
  categoryId: CategoryId;
  severity: Severity;
  skill: SkillDoc;
  file?: string;
  line: number | null;
  title: string;
  evidence: string;
  why: string;
  fix: string;
  ast: string[];
}

export function mk(a: MakeArgs): Finding {
  const evidence = quote(a.evidence);
  if (!evidence) throw new Error(`check ${a.checkId} produced a finding with no evidence`);
  return {
    checkId: a.checkId,
    categoryId: a.categoryId,
    severity: a.severity,
    skill: a.skill.name,
    file: a.file ?? a.skill.skillPath,
    line: a.line,
    title: a.title,
    evidence,
    why: a.why,
    fix: a.fix,
    ast: a.ast,
  };
}

/** Every readable file in the skill, as (path, line, text) triples. */
export function* eachLine(skill: SkillDoc): Generator<{ path: string; line: number; text: string }> {
  for (const f of skill.files) {
    if (f.text === null) continue;
    const lines = f.text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      yield { path: f.path, line: i + 1, text: lines[i] ?? "" };
    }
  }
}

/** First match of a regex anywhere in the skill's readable files. */
export function firstMatch(skill: SkillDoc, re: RegExp): { path: string; line: number; text: string } | null {
  for (const l of eachLine(skill)) {
    re.lastIndex = 0;
    if (re.test(l.text)) return l;
  }
  return null;
}

export function allMatches(skill: SkillDoc, re: RegExp, cap = 25): { path: string; line: number; text: string }[] {
  const out: { path: string; line: number; text: string }[] = [];
  for (const l of eachLine(skill)) {
    re.lastIndex = 0;
    if (re.test(l.text)) {
      out.push(l);
      if (out.length >= cap) break;
    }
  }
  return out;
}
