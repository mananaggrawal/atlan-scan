// Builds the frozen example report served at /p/sample.
//
//   npm run build:sample
//
// The sample used to be audited at boot, which meant a free instance bought a
// full audit of the demo library every time it woke up — the largest line on the
// bill, and invisible, because nobody asked it to run. So the audit happens here,
// once, on a developer's machine, and the result is committed. The server then
// only has to read a file.
//
// Re-run this when the demo library changes, when the auditor's prompt version
// changes, or when ScanResult gains a field the report page needs. The committed
// JSON records the engine version it was built with, and the server refuses to
// serve a sample from a different one rather than render a report with holes in it.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { ENGINE_VERSION, runScan } from "../src/engine/index.ts";
import { reviewEnabled } from "../src/engine/review/index.ts";
import { costOf } from "../src/engine/review/client.ts";
import { SAMPLE_PATH, SAMPLE_RUN_ID } from "../src/web/sample.ts";

const root = new URL("../fixtures/demo-library", import.meta.url).pathname;

if (!reviewEnabled()) {
  console.error("ANTHROPIC_API_KEY is not set. The sample is the page visitors read to decide");
  console.error("whether this tool does anything — it is not written without a real audit.");
  process.exit(2);
}

// The per-run skill ceiling exists to bound what a stranger can spend on the
// public instance. The sample is audited once, by us, and must cover the whole
// library, so it is lifted here and nowhere else.
const skillCount = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
process.env["SCAN_REVIEW_MAX_SKILLS"] = String(Math.max(skillCount, 25));

const files: { path: string; data: Buffer }[] = [];
(function walk(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (statSync(full).isFile()) {
      files.push({ path: relative(root, full).split("\\").join("/"), data: readFileSync(full) });
    }
  }
})(root);

const started = Date.now();
// No cache is passed on purpose: a frozen sample should be the product of a real
// audit at the current prompt, not a stitch-up of answers from older ones.
const result = await runScan({ files, source: { kind: "upload", label: "example-skill-library" } });
const secs = ((Date.now() - started) / 1000).toFixed(1);

// A sample where nothing could be audited is the most misleading page on the site.
if (!result.audit.ran || result.audit.reviewed === 0) {
  console.error(`Nothing was audited (${result.audit.failures[0]?.reason ?? "unknown"}) — not writing an empty example.`);
  process.exit(1);
}
if (result.totals.findings === 0) {
  console.error("The audit came back with no findings at all. That is either a broken run or a");
  console.error("changed fixture; either way it is not the report to show a first-time visitor.");
  process.exit(1);
}

writeFileSync(SAMPLE_PATH, `${JSON.stringify({ ...result, runId: SAMPLE_RUN_ID }, null, 2)}\n`);

const usd = costOf(result.audit.usage ?? { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });
console.log(`\n  wrote      fixtures/sample-report.json`);
console.log(`  engine     ${ENGINE_VERSION}`);
console.log(`  skills     ${result.totals.skills} (${result.audit.reviewed} audited, ${result.audit.dropped} claims dropped)`);
console.log(`  findings   ${result.totals.findings}`);
console.log(`  cost       $${usd.toFixed(5)} in ${secs}s\n`);
console.log(`  Commit it. The server reads this file at boot and spends nothing.\n`);
