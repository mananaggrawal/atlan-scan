import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import type { ScanResult } from "../engine/types.ts";

/**
 * What is kept, precisely — this wording is also the promise on the site:
 * findings, counts, a SHA-256 per skill, and the single line each finding quotes.
 * Whole skill files are never written anywhere.
 *
 * SQLite via node:sqlite (no dependency). If the database cannot be opened —
 * read-only disk, unsupported build — we fall back to memory rather than fail a scan.
 */
export interface StoredRun {
  result: ScanResult;
  createdAt: number;
  ownerId: string | null;
  sessionId: string;
  /** Owner has published a body-free report anyone can open. */
  isPublic: boolean;
}

const TTL_MS = 1000 * 60 * 60 * 24 * 90;

interface Backend {
  put(run: StoredRun): void;
  get(runId: string): StoredRun | undefined;
  update(runId: string, patch: Partial<Pick<StoredRun, "ownerId" | "isPublic">>): void;
  listFor(ownerId: string): StoredRun[];
  claim(sessionId: string, ownerId: string): number;
  kind: string;
}

function memoryBackend(): Backend {
  const map = new Map<string, StoredRun>();
  return {
    kind: "memory",
    put(run) {
      const cutoff = Date.now() - TTL_MS;
      for (const [id, r] of map) if (r.createdAt < cutoff) map.delete(id);
      map.set(run.result.runId, run);
    },
    get: (id) => map.get(id),
    update(id, patch) {
      const r = map.get(id);
      if (r) Object.assign(r, patch);
    },
    listFor: (owner) => [...map.values()].filter((r) => r.ownerId === owner).sort((a, b) => b.createdAt - a.createdAt),
    claim(sessionId, ownerId) {
      let n = 0;
      for (const r of map.values()) if (r.sessionId === sessionId && r.ownerId === null) { r.ownerId = ownerId; n++; }
      return n;
    },
  };
}

/**
 * The same database, handed to the review cache. A reviewed skill costs a model
 * call once, ever — not once per process. On a public scanner that is the
 * difference between paying for every visitor who scans a popular repo and
 * paying for the first one.
 */
let reviewDb: import("node:sqlite").DatabaseSync | null = null;
export function reviewDatabase(): import("node:sqlite").DatabaseSync | null {
  return reviewDb;
}

function sqliteBackend(path: string): Backend | null {
  try {
    const nodeRequire = createRequire(import.meta.url);
    const { DatabaseSync } = nodeRequire("node:sqlite") as typeof import("node:sqlite");
    mkdirSync(dirname(path), { recursive: true });
    const db = new DatabaseSync(path);
    db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        run_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL,
        owner_id TEXT, session_id TEXT NOT NULL, is_public INTEGER NOT NULL DEFAULT 0,
        result TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS runs_owner ON runs(owner_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS review_cache (
        key TEXT PRIMARY KEY, created_at INTEGER NOT NULL, findings TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS interest (
        id INTEGER PRIMARY KEY AUTOINCREMENT, created_at INTEGER NOT NULL,
        feature TEXT, email TEXT NOT NULL, name TEXT
      );
    `);
    // Write probe: open succeeding is not the same as usable.
    db.exec("CREATE TABLE IF NOT EXISTS probe (id INTEGER PRIMARY KEY)");
    db.prepare("INSERT INTO probe (id) VALUES (1)").run();
    db.prepare("DELETE FROM probe WHERE id = 1").run();

    const row = (r: Record<string, unknown> | undefined): StoredRun | undefined =>
      r
        ? {
            result: JSON.parse(String(r["result"])) as ScanResult,
            createdAt: Number(r["created_at"]),
            ownerId: r["owner_id"] == null ? null : String(r["owner_id"]),
            sessionId: String(r["session_id"]),
            isPublic: Number(r["is_public"]) === 1,
          }
        : undefined;
    reviewDb = db;
    return {
      kind: `sqlite(${path})`,
      put(run) {
        db.prepare("DELETE FROM runs WHERE created_at < ?").run(Date.now() - TTL_MS);
        db.prepare("INSERT OR REPLACE INTO runs (run_id,created_at,owner_id,session_id,is_public,result) VALUES (?,?,?,?,?,?)")
          .run(run.result.runId, run.createdAt, run.ownerId, run.sessionId, run.isPublic ? 1 : 0, JSON.stringify(run.result));
      },
      get: (id) => row(db.prepare("SELECT * FROM runs WHERE run_id = ?").get(id) as Record<string, unknown> | undefined),
      update(id, patch) {
        if (patch.ownerId !== undefined) db.prepare("UPDATE runs SET owner_id = ? WHERE run_id = ?").run(patch.ownerId, id);
        if (patch.isPublic !== undefined) db.prepare("UPDATE runs SET is_public = ? WHERE run_id = ?").run(patch.isPublic ? 1 : 0, id);
      },
      listFor: (owner) =>
        (db.prepare("SELECT * FROM runs WHERE owner_id = ? ORDER BY created_at DESC LIMIT 200").all(owner) as Record<string, unknown>[])
          .map((r) => row(r)!)
          .filter(Boolean),
      claim(sessionId, ownerId) {
        const res = db.prepare("UPDATE runs SET owner_id = ? WHERE session_id = ? AND owner_id IS NULL").run(ownerId, sessionId);
        return Number(res.changes ?? 0);
      },
    };
  } catch (err) {
    console.warn(`[store] sqlite unavailable (${(err as Error).message}); using memory`);
    return null;
  }
}

const backend: Backend = (process.env["SCAN_DB"] !== "memory" ? sqliteBackend(process.env["SCAN_DB"] ?? "./data/scan.db") : null) ?? memoryBackend();

export const storeKind = backend.kind;

export function putRun(result: ScanResult, sessionId: string, ownerId: string | null): void {
  backend.put({ result, createdAt: Date.now(), ownerId, sessionId, isPublic: false });
}
export function getRun(runId: string): StoredRun | undefined {
  return backend.get(runId);
}
export function setOwner(runId: string, ownerId: string): void {
  backend.update(runId, { ownerId });
}
export function setPublic(runId: string, isPublic: boolean): void {
  backend.update(runId, { isPublic });
}
export function claimRuns(sessionId: string, ownerId: string): number {
  return backend.claim(sessionId, ownerId);
}
export function runsFor(ownerId: string): StoredRun[] {
  return backend.listFor(ownerId);
}
