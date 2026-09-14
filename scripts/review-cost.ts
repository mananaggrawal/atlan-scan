// Reviews one folder and prints what it cost. Use it to watch spend while testing.
//   npm run cost -- fixtures/demo-library
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { runScan } from "../src/engine/index.ts";
import { reviewCache } from "../src/store/reviewcache.ts";
import { reviewEnabled } from "../src/engine/review/index.ts";
import { budgetUsd, costOf, spentSoFar } from "../src/engine/review/client.ts";

const root = process.argv[2];
if (!root) {
  console.error("usage: npm run cost -- <folder>");
  process.exit(2);
}
if (!reviewEnabled()) {
  console.error("ANTHROPIC_API_KEY is not set — nothing would be spent, and nothing reviewed.");
  process.exit(2);
}

const files: { path: string; data: Buffer }[] = [];
(function walk(dir: string): void {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else files.push({ path: relative(join(root, ".."), p), data: readFileSync(p) });
  }
})(root);

const started = Date.now();
const r = await runScan({ files, source: { kind: "upload", label: root } }, reviewCache);
const secs = ((Date.now() - started) / 1000).toFixed(1);

const u = r.audit.usage ?? { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
const usd = costOf(u);

const rows: [string, string][] = [
  ["skills", String(r.totals.skills)],
  ["findings", String(r.totals.findings)],
  ["audited", String(r.audit.reviewed)],
  ["served from cache", String(r.audit.cached)],
  ["dropped (unverifiable)", String(r.audit.dropped)],
  ["not audited", String(r.audit.failures.length)],
  ["files shown in part", String(r.notFullyRead.length)],
  ["", ""],
  ["input tokens", u.input.toLocaleString()],
  ["cache write", u.cacheWrite.toLocaleString()],
  ["cache read", u.cacheRead.toLocaleString()],
  ["output tokens", u.output.toLocaleString()],
  ["cost", `$${usd.toFixed(5)}`],
  ["per skill", r.audit.reviewed ? `$${(usd / r.audit.reviewed).toFixed(5)}` : "—"],
  ["elapsed", `${secs}s`],
  ["budget", budgetUsd() ? `$${spentSoFar().toFixed(5)} of $${budgetUsd().toFixed(2)} spent` : "none set"],
];

console.log("");
for (const [k, v] of rows) console.log(k ? `  ${k.padEnd(26)} ${v}` : "");
for (const f of r.audit.failures) console.log(`  ! ${f.skill}: ${f.reason}`);
console.log("");
