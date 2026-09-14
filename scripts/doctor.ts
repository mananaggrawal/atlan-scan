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
  "semantic review",
  process.env["ANTHROPIC_API_KEY"]
    ? `on (${process.env["SCAN_REVIEW_MODEL"] ?? "claude-haiku-4-5"})`
    : "off — 50 deterministic checks only (set ANTHROPIC_API_KEY in .env)",
]);
rows.push(["session secret", process.env["SESSION_SECRET"] ? "set" : "default — fine locally, change in production"]);

console.log("");
for (const [k, v] of rows) console.log(`  ${k.padEnd(17)} ${v}`);
console.log("");
process.exit(ok ? 0 : 1);
