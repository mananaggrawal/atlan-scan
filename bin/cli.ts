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
import { reviewEnabled, runScan } from "../src/engine/index.ts";
import { reviewCache, reviewCacheSize } from "../src/store/reviewcache.ts";
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
  const flagged = r.categories.filter((c) => c.count > 0).length;
  console.log("");
  console.log(C.b(`  ${r.source.label}`));
  console.log(
    `  ${r.totals.findings} finding${r.totals.findings === 1 ? "" : "s"} across ${r.totals.skills} skill${
      r.totals.skills === 1 ? "" : "s"
    }, in ${flagged} of ${r.categories.length} categories` +
      (r.unreadable.length ? `, ${r.unreadable.length} file${r.unreadable.length === 1 ? "" : "s"} could not be read` : ""),
  );
  console.log(C.grey(`  read by ${r.audit.model}${r.audit.dropped ? ` · ${r.audit.dropped} unverifiable claim${r.audit.dropped === 1 ? "" : "s"} discarded` : ""}`));
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
  if (r.audit.failures.length || r.partial.length || r.notFullyRead.length) {
    console.log(`  ${C.yellow("!")} ${C.b("Not fully audited")}`);
    for (const x of r.audit.failures) console.log(`      ${C.grey(`${x.skill} — ${x.reason}`)}`);
    for (const x of r.partial) {
      const why = x.reason ?? "the model's output limit";
      console.log(`      ${C.grey(`${x.skill} — incomplete after ${x.kept} finding${x.kept === 1 ? "" : "s"}: ${why}`)}`);
    }
    // A file shown only in part is the same admission as a skill that was skipped,
    // and the web report has always made it. The CLI had not, so a clipped file
    // came out of a local scan looking exactly like a clean one. Worst first: the
    // file that lost the most is the one worth naming.
    const part = [...r.notFullyRead].sort((a, b) => b.of - b.shown - (a.of - a.shown));
    for (const x of part.slice(0, 6)) {
      console.log(`      ${C.grey(`${x.path} — shown to the auditor in part only, ${x.shown.toLocaleString()} of ${x.of.toLocaleString()} chars`)}`);
    }
    if (part.length > 6) console.log(`      ${C.grey(`…and ${part.length - 6} more file${part.length - 6 === 1 ? "" : "s"} shown in part`)}`);
    // The counts above are the symptom. When a limit was set below what this build
    // expects, it is also the cause, and saying so is the difference between a
    // report someone reads and a report someone can act on.
    const lim = r.audit.limits;
    if (lim && lim.readChars > 0 && lim.readChars < lim.readDefault) {
      console.log(`      ${C.grey(`Read budget was ${lim.readChars.toLocaleString()} chars per skill, not the usual ${lim.readDefault.toLocaleString()} — unset SCAN_REVIEW_MAX_CHARS`)}`);
    }
    if (lim && lim.outputTokens > 0 && lim.outputTokens < lim.outputDefault) {
      console.log(`      ${C.grey(`Auditor output cap was ${lim.outputTokens.toLocaleString()} tokens, not the usual ${lim.outputDefault.toLocaleString()} — unset SCAN_REVIEW_MAX_TOKENS`)}`);
    }
    console.log(`      ${C.grey("These were not counted as clear.")}`);
    console.log("");
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
    --no-cache    audit again even if this exact skill was audited before

  A skill that has not changed is served from cache and costs nothing.
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

  if (!reviewEnabled()) {
    console.error(`
  No ANTHROPIC_API_KEY set, so there is nothing to audit with.

  The audit is a model reading every file of every skill, using the skill-audit
  skill as its instructions. There is no pattern fallback behind it — printing an
  empty report here would read as a clean one, which is the one thing this tool
  will not do.

  Either set ANTHROPIC_API_KEY, or open this folder in Claude Code and run the
  skill-audit skill directly. It produces the same report without this CLI.
`);
    process.exit(2);
  }

  /**
   * Local scans are cached too, the way the server's always have been.
   *
   * They were not, and iterating on this tool meant paying for the same audit
   * every time: on one day of work that was fifty-odd scans of one skill and most
   * of a five-dollar bill. The key already covers every file of the skill, the
   * model and the prompt version, so a real change still costs a real call — what
   * stops costing is re-running the identical thing.
   *
   * `--no-cache` exists because a cached answer is byte-identical by definition,
   * which is exactly wrong when what you are measuring is how much the auditor
   * varies between runs. Use it for that, and only for that.
   */
  const fresh = args.includes("--no-cache");
  const before = fresh ? 0 : reviewCacheSize();
  const result = await runScan(
    { files, source: { kind: "cli", label: target.split("/").pop() || target } },
    fresh ? undefined : reviewCache,
  );

  if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else if (!args.includes("--quiet")) {
    print(result);
    if (result.audit.cached > 0) {
      console.log(C.dim(`  ${result.audit.cached} of ${result.audit.cached + result.audit.reviewed} served from cache — identical to the run that filled it. --no-cache to force a fresh audit.`));
      console.log("");
    } else if (!fresh && reviewCacheSize() > before) {
      console.log(C.dim("  Cached. Scanning this again, unchanged, costs nothing."));
      console.log("");
    }
  }

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
