import type { Finding } from "../engine/types.ts";
import type { ReviewCache } from "../engine/review/index.ts";

/**
 * Review results, keyed by content hash + model + prompt version.
 *
 * The same skill bytes reviewed by the same model under the same prompt give the
 * same answer without another call, which is what keeps a re-scan both free and
 * identical to the one before it. In-process and bounded: this is a cost and
 * latency cache, not a record — the store of record is still the run itself.
 */
const MAX_ENTRIES = 5_000;

const map = new Map<string, Finding[]>();

export const reviewCache: ReviewCache = {
  get(key) {
    const hit = map.get(key);
    if (!hit) return undefined;
    // Refresh recency: re-inserting moves it to the end of the iteration order.
    map.delete(key);
    map.set(key, hit);
    return hit;
  },
  put(key, findings) {
    map.set(key, findings);
    while (map.size > MAX_ENTRIES) {
      const oldest = map.keys().next().value;
      if (oldest === undefined) break;
      map.delete(oldest);
    }
  },
};

export function reviewCacheSize(): number {
  return map.size;
}

export function clearReviewCache(): void {
  map.clear();
}
