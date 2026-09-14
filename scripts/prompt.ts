// Prints exactly what the reviewer model is sent. Derived from
// skills/skill-audit/SKILL.md, never stored beside it — a checked-in copy of a
// generated prompt is a copy that drifts.
import { PROMPT_VERSION, SKILL_PATH, SYSTEM, userMessage } from "../src/engine/review/prompt.ts";

const arg = process.argv[2];

if (arg === "--user") {
  console.log(userMessage("<skill name>", "<path>/SKILL.md", "<the skill's text, verbatim>"));
} else {
  console.log(SYSTEM);
}

if (process.stderr.isTTY) {
  console.error(`\n— source: ${SKILL_PATH}`);
  console.error(`— version: ${PROMPT_VERSION} (hash of that file; changes invalidate cached reviews)`);
  console.error(`— ${SYSTEM.length} chars, roughly ${Math.round(SYSTEM.length / 3.8)} tokens per skill reviewed`);
}
