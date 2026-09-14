import type { Finding, LibraryStats, SkillDoc } from "./types.ts";
import { DESCRIPTION_BUDGET } from "./checks/metadata.ts";
import { quote } from "./parse.ts";

const STOP = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "with", "when", "use",
  "this", "that", "it", "is", "are", "be", "user", "users", "you", "your", "should",
  "skill", "using", "used", "from", "by", "as", "at", "into", "any", "all",
]);

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function shingles(s: string): Set<string> {
  const words = s.toLowerCase().split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 4 < words.length; i++) out.add(words.slice(i, i + 5).join(" "));
  return out;
}

function lf(checkId: string, severity: Finding["severity"], title: string, evidence: string, why: string, fix: string, ast: string[]): Finding {
  return {
    checkId,
    categoryId: "library",
    severity,
    skill: "(library)",
    file: "(whole folder)",
    line: null,
    title,
    evidence: quote(evidence),
    why,
    fix,
    ast,
  };
}

export function libraryFindings(skills: SkillDoc[]): { findings: Finding[]; stats: LibraryStats } {
  const findings: Finding[] = [];
  const overlapPairs: LibraryStats["overlapPairs"] = [];

  let listingChars = 0;
  for (const s of skills) {
    const desc = s.frontmatter["description"] ?? "";
    const when = s.frontmatter["when_to_use"] ?? s.frontmatter["when-to-use"] ?? "";
    listingChars += (s.frontmatter["name"] ?? s.name).length + desc.length + when.length;
  }

  // Trigger collisions: two skills whose descriptions compete for the same prompts.
  const descTokens = skills.map((s) => ({
    name: s.name,
    tok: tokens(`${s.frontmatter["description"] ?? ""} ${s.frontmatter["when_to_use"] ?? ""}`),
    desc: s.frontmatter["description"] ?? "",
  }));
  for (let i = 0; i < descTokens.length; i++) {
    for (let j = i + 1; j < descTokens.length; j++) {
      const a = descTokens[i]!;
      const b = descTokens[j]!;
      if (a.tok.size < 4 || b.tok.size < 4) continue;
      const sim = jaccard(a.tok, b.tok);
      if (sim < 0.5) continue;
      overlapPairs.push({ a: a.name, b: b.name, similarity: Math.round(sim * 100) / 100 });
      findings.push(
        lf(
          "library-trigger-collision",
          sim >= 0.7 ? "medium" : "low",
          `"${a.name}" and "${b.name}" describe ${Math.round(sim * 100)}% the same trigger`,
          `${a.name}: ${a.desc.slice(0, 70)}  ·  ${b.name}: ${b.desc.slice(0, 70)}`,
          "When two descriptions compete, which one fires is effectively arbitrary, and it can change between sessions. This is the failure that only shows up when you look at the folder rather than the file.",
          "Narrow one description, or merge the two skills.",
          ["AST09"],
        ),
      );
      if (overlapPairs.length >= 12) break;
    }
    if (overlapPairs.length >= 12) break;
  }

  // Near-duplicate bodies.
  const bodies = skills.map((s) => ({ name: s.name, sh: shingles(s.body) }));
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]!;
      const b = bodies[j]!;
      if (a.sh.size < 12 || b.sh.size < 12) continue;
      const sim = jaccard(a.sh, b.sh);
      if (sim < 0.6) continue;
      findings.push(
        lf(
          "library-duplicate-body",
          "low",
          `"${a.name}" and "${b.name}" are ${Math.round(sim * 100)}% the same file`,
          `${a.name} ↔ ${b.name}`,
          "Two copies drift apart. Whichever one you fix, the other keeps the bug, and the agent may load either.",
          "Keep one and delete the other, or extract the shared part into a reference file both load.",
          ["AST09", "AST07"],
        ),
      );
    }
  }

  // Total always-loaded listing cost.
  if (skills.length >= 3) {
    const budget = DESCRIPTION_BUDGET * skills.length;
    const pct = Math.round((listingChars / budget) * 100);
    if (pct >= 60) {
      findings.push(
        lf(
          "library-listing-cost",
          pct >= 100 ? "medium" : "low",
          `Listing metadata is ${listingChars.toLocaleString()} chars across ${skills.length} skills`,
          `${listingChars.toLocaleString()} chars — ${pct}% of the ${budget.toLocaleString()}-char budget for this many skills`,
          "Every description is loaded on every turn whether the skill fires or not. This is the part of the bill you pay for skills you never use.",
          "Trim the descriptions of the skills that fire least. Deleting one unused skill is worth more than shortening five used ones.",
          ["AST09"],
        ),
      );
    }
  }

  // References that point at files which are not here.
  for (const s of skills) {
    const refs = [...s.body.matchAll(/\[[^\]]*\]\(([^)]+\.(?:md|txt|json|ya?ml|py|sh|js|ts))\)/g)]
      .map((m) => (m[1] ?? "").trim())
      .filter((p) => !/^https?:/.test(p));
    if (refs.length === 0) continue;
    const have = new Set(s.files.map((f) => f.path));
    for (const ref of refs.slice(0, 20)) {
      const clean = ref.replace(/^\.\//, "").split("#")[0] ?? ref;
      const candidate = s.dir ? `${s.dir}/${clean}` : clean;
      if (have.has(candidate) || [...have].some((h) => h.endsWith(`/${clean}`))) continue;
      findings.push(
        lf(
          "library-orphan-reference",
          "low",
          `"${s.name}" points at a file that is not here`,
          `${s.skillPath} → ${ref}`,
          "The agent will try to load it, fail, and carry on with whatever it already had. Silent, and easy to miss until the output is quietly worse.",
          "Add the file, or remove the reference.",
          ["AST09"],
        ),
      );
      break;
    }
  }

  return { findings, stats: { listingChars, budgetChars: DESCRIPTION_BUDGET, overlapPairs } };
}
