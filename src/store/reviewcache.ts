import type { Finding } from "../engine/types.ts";
import type { ReviewCache } from "../engine/review/index.ts";
import { reviewDatabase } from "./runs.ts";

/**
 * Review results, keyed by content hash + model + prompt version.
 *
 * The same skill bytes, reviewed by the same model under the same prompt, give
 * the same answer without another call. That is what keeps a re-scan both free
 * and identical to the one before — and on a public scanner it means the tenth
 * person to scan a popular repo costs nothing at all.
 *
 * Persisted in the runs database when there is one, so a restart does not buy
 * every review again; memory otherwise, which is correct but forgetful.
 */
const TTL_MS = 1000 * 60 * 60 * 24 * 30;
const MAX_MEMORY_ENTRIES = 5_000;

const mem = new Map<string, Finding[]>();

function memoryGet(key: string): Finding[] | undefined {
  const hit = mem.get(key);
  if (!hit) return undefined;
  mem.delete(key);
  mem.set(key, hit); // refresh recency
  return hit;
}

function memoryPut(key: string, findings: Finding[]): void {
  mem.set(key, findings);
  while (mem.size > MAX_MEMORY_ENTRIES) {
    const oldest = mem.keys().next().value;
    if (oldest === undefined) break;
    mem.delete(oldest);
  }
}

export const reviewCache: ReviewCache = {
  get(key) {
    const db = reviewDatabase();
    if (!db) return memoryGet(key);
    try {
      const row = db.prepare("SELECT findings FROM review_cache WHERE key = ? AND created_at > ?")
        .get(key, Date.now() - TTL_MS) as { findings?: string } | undefined;
      return row?.findings ? (JSON.parse(row.findings) as Finding[]) : undefined;
    } catch {
      // A cache that throws must never fail a scan; the worst case is paying again.
      return memoryGet(key);
    }
  },
  put(key, findings) {
    const db = reviewDatabase();
    if (!db) return memoryPut(key, findings);
    try {
      db.prepare("DELETE FROM review_cache WHERE created_at < ?").run(Date.now() - TTL_MS);
      db.prepare("INSERT OR REPLACE INTO review_cache (key, created_at, findings) VALUES (?,?,?)")
        .run(key, Date.now(), JSON.stringify(findings));
    } catch {
      memoryPut(key, findings);
    }
  },
};

export function reviewCacheSize(): number {
  const db = reviewDatabase();
  if (!db) return mem.size;
  try {
    const row = db.prepare("SELECT COUNT(*) AS n FROM review_cache").get() as { n?: number } | undefined;
    return Number(row?.n ?? 0);
  } catch {
    return mem.size;
  }
}

export function clearReviewCache(): void {
  mem.clear();
  try {
    reviewDatabase()?.exec("DELETE FROM review_cache");
  } catch {
    /* nothing to clear */
  }
}
