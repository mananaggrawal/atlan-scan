// Prints exactly what the auditor model is sent. Derived from
// skills/skill-audit/SKILL.md, never stored beside it — a checked-in copy of a
// generated prompt is a copy that drifts.
import { PROMPT_VERSION, SKILL_PATH, SYSTEM, LIBRARY_SYSTEM, buildSkillDocument } from "../src/engine/review/prompt.ts";
import { skillFacts } from "../src/engine/facts.ts";
import { parseTree } from "../src/engine/parse.ts";

const arg = process.argv[2];

if (arg === "--library") {
  console.log(LIBRARY_SYSTEM);
} else if (arg === "--user") {
  // A worked example of the per-skill message, built through the real code path
  // rather than described — so what this prints is what the model gets.
  const demo = parseTree([
    {
      path: "example-skill/SKILL.md",
      data: Buffer.from(
        ["---", "name: example-skill", "description: Use when the user asks for an example.", "---", "", "# Example", "", "1. Do the thing.", ""].join("\n"),
      ),
    },
    { path: "example-skill/reference.md", data: Buffer.from("# Reference\n\nMore detail lives here.\n") },
  ]).skills[0];

  if (!demo) throw new Error("the example skill did not parse");
  console.log(buildSkillDocument(demo, skillFacts(demo)).text);
} else {
  console.log(SYSTEM);
}

if (process.stderr.isTTY) {
  console.error(`\n— source: ${SKILL_PATH}`);
  console.error(`— version: ${PROMPT_VERSION} (hash of that file; changes invalidate cached audits)`);
  console.error(`— ${SYSTEM.length} chars, roughly ${Math.round(SYSTEM.length / 3.8)} tokens of instructions per skill audited`);
}
