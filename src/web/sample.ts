import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { runScan } from "../engine/index.ts";
import type { RawFile } from "../engine/parse.ts";
import { getRun, putRun, setPublic } from "../store/runs.ts";

/**
 * A permanently published example report at /p/sample.
 *
 * It exists so a visitor can read a real result — actual findings, actual quoted
 * lines — before deciding to upload anything of their own. Built from the bundled
 * demo library, so it needs no network and is identical on every deployment.
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

export function ensureSampleRun(): void {
  if (getRun(SAMPLE_RUN_ID)) return;
  try {
    const root = new URL("../../fixtures/demo-library", import.meta.url).pathname;
    const result = runScan({
      files: collect(root),
      source: { kind: "upload", label: "example-skill-library" },
    });
    putRun({ ...result, runId: SAMPLE_RUN_ID }, "sample-session", null);
    setPublic(SAMPLE_RUN_ID, true);
  } catch (err) {
    console.warn(`[sample] could not build the example report: ${(err as Error).message}`);
  }
}
