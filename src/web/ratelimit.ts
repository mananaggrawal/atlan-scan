import type { IncomingMessage } from "node:http";

/**
 * A ceiling on how much of someone else's money a stranger can spend.
 *
 * `/api/scan` takes a public URL, audits up to twenty-five skills with a paid
 * model, and asks nobody who they are. That is the whole product and it should
 * stay that way — but unmetered it means anyone who finds the address can point
 * it at a large repository in a loop and bill it to the owner. There was no limit
 * of any kind on it.
 *
 * In-memory and per-process on purpose: it needs no storage, and this instance has
 * none. A restart clears it, which a visitor cannot cause.
 */
const WINDOW_MS = 60 * 60 * 1000;

/** Fresh audits one visitor may buy per hour. A cached re-scan costs nothing and is not counted here. */
const PER_HOUR = Number(process.env["SCAN_RATE_PER_HOUR"] ?? 8);

const hits = new Map<string, number[]>();

/** Session first, address second: a cookie identifies a browser, the address catches a script that drops it. */
export function scanKey(req: IncomingMessage, sessionId: string): string {
  const fwd = String(req.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim();
  return `${sessionId}|${fwd || req.socket.remoteAddress || "unknown"}`;
}

export interface RateVerdict {
  ok: boolean;
  /** Seconds until the next scan is allowed. Only meaningful when ok is false. */
  retryAfter: number;
  remaining: number;
}

export function takeScanSlot(key: string, now = Date.now()): RateVerdict {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_HOUR) {
    const oldest = recent[0] ?? now;
    hits.set(key, recent);
    return { ok: false, retryAfter: Math.ceil((WINDOW_MS - (now - oldest)) / 1000), remaining: 0 };
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep the map from growing without bound on a long-lived process.
  if (hits.size > 5_000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return { ok: true, retryAfter: 0, remaining: PER_HOUR - recent.length };
}

export function scansPerHour(): number {
  return PER_HOUR;
}
