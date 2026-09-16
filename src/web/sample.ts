import { existsSync, readFileSync } from "node:fs";
import { ENGINE_VERSION } from "../engine/index.ts";
import type { ScanResult } from "../engine/types.ts";
import { getRun, putRun, setPublic } from "../store/runs.ts";

/**
 * The permanently published example report at /p/sample.
 *
 * It exists so a visitor can read a real result — actual findings, actual quoted
 * lines — before deciding to upload anything of their own. Both landing CTAs point
 * at it, so when it is missing the page's strongest proof is a 404.
 *
 * It is NOT audited here. Building it costs a full audit of the demo library, and
 * on a free instance with no disk that was being bought again on every deploy and
 * every wake from idle — the largest line on the bill, and invisible, because
 * nobody asked it to run. So the audit happens once, on a developer's machine, via
 * `npm run build:sample`, and the result is committed. Boot only reads a file.
 */
export const SAMPLE_RUN_ID = "sample";

export const SAMPLE_PATH = new URL("../../fixtures/sample-report.json", import.meta.url).pathname;

/**
 * A sample built by an older engine is worse than no sample. The report page reads
 * fields that arrived with the audit rewrite — a 1.0 result has no `audit` block at
 * all — so serving a stale one throws on render instead of 404ing, and the visitor
 * gets a stack trace where the proof was meant to be. Refuse, loudly, and say what
 * to run.
 */
export function ensureSampleRun(): void {
  if (getRun(SAMPLE_RUN_ID)) return;
  if (!existsSync(SAMPLE_PATH)) {
    console.warn(`[sample] fixtures/sample-report.json is missing — /p/sample will 404. Run: npm run build:sample`);
    return;
  }
  let result: ScanResult;
  try {
    result = JSON.parse(readFileSync(SAMPLE_PATH, "utf8")) as ScanResult;
  } catch (err) {
    console.warn(`[sample] fixtures/sample-report.json could not be parsed: ${(err as Error).message}`);
    return;
  }
  if (result.engineVersion !== ENGINE_VERSION) {
    console.warn(
      `[sample] the committed sample is ${result.engineVersion} but this engine is ${ENGINE_VERSION} — not serving a report`
        + ` the page cannot render. Rebuild it: npm run build:sample`,
    );
    return;
  }
  putRun({ ...result, runId: SAMPLE_RUN_ID }, "sample-session", null);
  setPublic(SAMPLE_RUN_ID, true);
  console.log(`[sample] /p/sample ready — ${result.totals.findings} findings across ${result.totals.skills} skills, no model calls.`);
}
