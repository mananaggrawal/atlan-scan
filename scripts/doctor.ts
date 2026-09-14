/** Prints whether this machine can run Atlan Scan, and what is configured. */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const need = [22, 6, 0];
const have = process.versions.node.split(".").map(Number) as [number, number, number];
const ok = have[0] > need[0]! || (have[0] === need[0]! && have[1]! >= need[1]!);

const rows: [string, string][] = [
  ["node", `${process.versions.node} ${ok ? "ok" : `too old — needs ${need.join(".")}+`}`],
  ["dependencies", existsSync(new URL("../node_modules", import.meta.url)) ? "installed" : "run npm install"],
];

try {
  createRequire(import.meta.url)("node:sqlite");
  rows.push(["node:sqlite", "available"]);
} catch {
  rows.push(["node:sqlite", "unavailable — scans will not persist"]);
}

rows.push(["database", process.env["SCAN_DB"] ?? "./data/scan.db"]);
rows.push(["base url", process.env["BASE_URL"] ?? "http://localhost:8787"]);
rows.push([
  "google sign-in",
  process.env["GOOGLE_CLIENT_ID"] && process.env["GOOGLE_CLIENT_SECRET"]
    ? "configured"
    : "dev stub (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env)",
]);
rows.push([
  "auditor",
  process.env["ANTHROPIC_API_KEY"]
    ? `${process.env["SCAN_REVIEW_MODEL"] ?? "claude-haiku-4-5"}`
    : "NONE — the model is the audit, so nothing can be scanned (set ANTHROPIC_API_KEY in .env)",
]);
if (process.env["ANTHROPIC_API_KEY"]) {
  rows.push(["  audit ceiling", `${process.env["SCAN_REVIEW_MAX_SKILLS"] ?? 25} skills per run`]);
  // These two are how a working build produces a thin report. Set below the
  // default, every skill is read in part and every answer stops early, and the
  // result looks like a quiet library rather than a throttled scanner. Flagged
  // here so the machine says so before anyone reads a report and believes it.
  const readChars = Number(process.env["SCAN_REVIEW_MAX_CHARS"] ?? 160_000);
  const outTokens = Number(process.env["SCAN_REVIEW_MAX_TOKENS"] ?? 16_000);
  rows.push([
    "  read per skill",
    readChars < 160_000
      ? `${readChars.toLocaleString()} chars — BELOW the 160,000 default; skills will be read in part (unset SCAN_REVIEW_MAX_CHARS)`
      : `${readChars.toLocaleString()} chars`,
  ]);
  rows.push([
    "  auditor output",
    outTokens < 16_000
      ? `${outTokens.toLocaleString()} tokens — BELOW the 16,000 default; audits will stop early (unset SCAN_REVIEW_MAX_TOKENS)`
      : `${outTokens.toLocaleString()} tokens`,
  ]);
  rows.push([
    "  audit budget",
    process.env["SCAN_REVIEW_BUDGET_USD"]
      ? `$${Number(process.env["SCAN_REVIEW_BUDGET_USD"]).toFixed(2)} per process`
      : "none — set SCAN_REVIEW_BUDGET_USD to cap spend",
  ]);
}
rows.push(["session secret", process.env["SESSION_SECRET"] ? "set" : "default — fine locally, change in production"]);

console.log("");
for (const [k, v] of rows) console.log(`  ${k.padEnd(17)} ${v}`);
console.log("");
process.exit(ok ? 0 : 1);
