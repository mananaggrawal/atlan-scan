#!/usr/bin/env node
/**
 * atlan-scan — read what is in a skills folder, locally.
 *
 * The files never leave the machine. `--publish` uploads the FINDINGS ONLY
 * (no file contents beyond the single line each finding already quotes) to
 * create a shareable report; such reports are labelled self-reported, because
 * the server did not read the files itself.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { runScan } from "../src/engine/index.ts";
import type { RawFile } from "../src/engine/parse.ts";
import type { ScanResult, Severity } from "../src/engine/types.ts";

const SKIP = new Set(["node_modules", ".git", ".venv", "venv", "__pycache__", ".next", ".cache", "dist", "build", "target"]);
const MAX_FILE = 2 * 1024 * 1024;
const MAX_FILES = 2000;

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  b: (s: string) => `\x1b[1m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  grey: (s: string) => `\x1b[90m${s}\x1b[0m`,
};
const SEV_COLOUR: Record<Severity, (s: string) => string> = {
  critical: C.red, high: C.yellow, medium: C.yellow, low: C.grey, info: C.grey,
};

function walk(root: string, dir: string, out: RawFile[]): void {
  if (out.length >= MAX_FILES) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".claude") {
      if (SKIP.has(entry.name) || entry.name === ".git") continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue;
      walk(root, full, out);
    } else if (entry.isFile()) {
      const st = statSync(full);
      if (st.size > MAX_FILE) continue;
      out.push({ path: relative(root, full).split("\\").join("/"), data: readFileSync(full) });
    }
    if (out.length >= MAX_FILES) return;
  }
}

function print(r: ScanResult): void {
  const flagged = r.categories.reduce((n, c) => n + c.checks.filter((k) => k.count > 0).length, 0);
  const total = r.categories.reduce((n, c) => n + c.checks.length, 0);
  console.log("");
  console.log(C.b(`  ${r.source.label}`));
  console.log(`  ${flagged} of ${total} checks flagged across ${r.totals.skills} skill${r.totals.skills === 1 ? "" : "s"}` +
    (r.unreadable.length ? `, ${r.unreadable.length} file${r.unreadable.length === 1 ? "" : "s"} could not be read` : ""));
  console.log("");

  for (const c of r.categories) {
    if (c.count === 0) {
      console.log(`  ${C.green("✓")} ${C.dim(c.name)}`);
      continue;
    }
    console.log(`  ${SEV_COLOUR[c.worst ?? "low"]("●")} ${C.b(c.name)} ${C.grey(`${c.count} finding${c.count === 1 ? "" : "s"}`)}`);
    for (const f of r.findings.filter((x) => x.categoryId === c.id)) {
      const loc = f.line ? `${f.file}:${f.line}` : f.file;
      console.log(`      ${SEV_COLOUR[f.severity](f.severity.padEnd(8))} ${f.title}`);
      console.log(`      ${C.grey(loc)}`);
      console.log(`      ${C.dim("│")} ${f.evidence}`);
      console.log(`      ${C.blue("fix")} ${f.fix}`);
      console.log("");
    }
  }
  if (r.unreadable.length) {
    console.log(`  ${C.yellow("?")} ${C.b("Could not read")} ${C.grey(`${r.unreadable.length} file${r.unreadable.length === 1 ? "" : "s"}`)}`);
    for (const u of r.unreadable.slice(0, 10)) console.log(`      ${C.grey(`${u.path} — ${u.reason}`)}`);
    console.log("");
  }
  console.log(C.dim("  Atlan Scan reads what is visible in the text. It does not certify anything as safe."));
  console.log("");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
  atlan-scan [path] [options]

    --json        print the full result as JSON
    --publish     upload findings only (never your files) and print a report URL
    --server URL  where to publish (default $ATLAN_SCAN_SERVER, else https://scan.atlan.com)
    --quiet       exit code only

  Exit code is 1 when anything critical or high is found, otherwise 0.
`);
    return;
  }
  const target = resolve(args.find((a) => !a.startsWith("--")) ?? ".");
  const files: RawFile[] = [];
  walk(target, target, files);

  if (!files.some((f) => /(^|\/)SKILL\.md$/i.test(f.path))) {
    console.error(`  No SKILL.md under ${target}. Point atlan-scan at a skill folder, or a directory of them.`);
    process.exit(2);
  }

  const result = runScan({ files, source: { kind: "cli", label: target.split("/").pop() || target } });

  if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else if (!args.includes("--quiet")) print(result);

  if (args.includes("--publish")) {
    const i = args.indexOf("--server");
    const server = (i >= 0 ? args[i + 1] : undefined) ?? process.env["ATLAN_SCAN_SERVER"] ?? "https://scan.atlan.com";
    try {
      const res = await fetch(`${server}/api/ingest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ result }),
      });
      const body = (await res.json()) as { runId?: string; error?: string };
      if (body.runId) console.log(`  Report: ${server}/r/${body.runId}\n`);
      else console.error(`  Could not publish: ${body.error ?? res.status}\n`);
    } catch (err) {
      console.error(`  Could not reach ${server}: ${(err as Error).message}\n`);
    }
  }

  const bad = result.totals.bySeverity.critical + result.totals.bySeverity.high;
  process.exit(bad > 0 ? 1 : 0);
}

void main();
