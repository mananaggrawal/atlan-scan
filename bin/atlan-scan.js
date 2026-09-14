#!/usr/bin/env node
// Thin launcher so `npx atlan-scan` works: re-exec with type stripping enabled.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath,
  ["--experimental-strip-types", "--no-warnings", join(here, "cli.ts"), ...process.argv.slice(2)],
  { stdio: "inherit" });
process.exit(r.status ?? 1);
