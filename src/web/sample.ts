import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { reviewEnabled, runScan } from "../engine/index.ts";
import type { RawFile } from "../engine/parse.ts";
import { getRun, putRun, setPublic } from "../store/runs.ts";

/**
 * A permanently published example report at /p/sample.
 *
 * It exists so a visitor can read a real result — actual findings, actual quoted
 * lines — before deciding to upload anything of their own. Built from the bundled
 * demo library, and audited like any other upload: with no ANTHROPIC_API_KEY the
 * sample is not built at all, because a sample report with no findings would be
 * the most misleading page on the site.
 */
export const SAMPLE_RUN_ID = "sample";

function collect(root: string): RawFile[] {
  const out: RawFile[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (statSync(full).isFile()) {
        out.push({ path: relative(root, full).split("\\").join("/"), data: readFileSync(full) });
      }
    }
  };
  walk(root);
  return out;
}

/**
 * Building the sample costs a full audit of the demo library — eight skills and a
 * library pass, about $0.50 — and on free hosting it was paying that on every
 * restart. The run is stored in /tmp and so is the review cache, so a restart
 * wipes both and the next boot buys all nine calls again. With six deploys in a
 * day and an instance that sleeps whenever nobody is looking, that quietly became
 * the largest line on the bill, and it was invisible because nobody asked it to run.
 *
 * So it is off unless asked for. Set SCAN_SAMPLE=1 to build it, on a deploy where
 * you want it rebuilt, and unset it afterwards.
 */
export async function ensureSampleRun(): Promise<void> {
  if (getRun(SAMPLE_RUN_ID)) return;
  if (process.env["SCAN_SAMPLE"] !== "1") return;
  if (!reviewEnabled()) {
    console.warn("[sample] no ANTHROPIC_API_KEY — the example report is not built, rather than published empty.");
    return;
  }
  try {
    const root = new URL("../../fixtures/demo-library", import.meta.url).pathname;
    const result = await runScan({
      files: collect(root),
      source: { kind: "upload", label: "example-skill-library" },
    });
    // A sample where nothing could be audited is the most misleading page on the
    // site — it is the one visitors read to decide whether this tool does anything.
    if (result.audit.ran && result.audit.reviewed === 0) {
      console.warn(`[sample] every skill failed to audit (${result.audit.failures[0]?.reason ?? "unknown"}) — not publishing an empty example.`);
      return;
    }
    putRun({ ...result, runId: SAMPLE_RUN_ID }, "sample-session", null);
    setPublic(SAMPLE_RUN_ID, true);
  } catch (err) {
    console.warn(`[sample] could not build the example report: ${(err as Error).message}`);
  }
}
