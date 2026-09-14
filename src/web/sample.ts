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

export async function ensureSampleRun(): Promise<void> {
  if (getRun(SAMPLE_RUN_ID)) return;
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
    putRun({ ...result, runId: SAMPLE_RUN_ID }, "sample-session", null);
    setPublic(SAMPLE_RUN_ID, true);
  } catch (err) {
    console.warn(`[sample] could not build the example report: ${(err as Error).message}`);
  }
}
