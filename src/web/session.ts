import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { User } from "./layout.ts";

const SECRET = process.env["SESSION_SECRET"] ?? "atlan-scan-dev-secret-change-me";

export function sign(value: string): string {
  const mac = createHmac("sha256", SECRET).update(value).digest("base64url");
  return `${Buffer.from(value).toString("base64url")}.${mac}`;
}

export function unsign(signed: string | undefined): string | null {
  if (!signed) return null;
  const dot = signed.lastIndexOf(".");
  if (dot < 1) return null;
  const value = Buffer.from(signed.slice(0, dot), "base64url").toString();
  const given = Buffer.from(signed.slice(dot + 1));
  const want = Buffer.from(createHmac("sha256", SECRET).update(value).digest("base64url"));
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  return value;
}

export function cookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const COOKIE_OPTS = "Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000";

export function setCookie(res: ServerResponse, name: string, value: string): void {
  const prev = res.getHeader("Set-Cookie");
  const line = `${name}=${encodeURIComponent(value)}; ${COOKIE_OPTS}`;
  const all = Array.isArray(prev) ? [...prev, line] : prev ? [String(prev), line] : [line];
  res.setHeader("Set-Cookie", all);
}

export function clearCookie(res: ServerResponse, name: string): void {
  const prev = res.getHeader("Set-Cookie");
  const line = `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  const all = Array.isArray(prev) ? [...prev, line] : prev ? [String(prev), line] : [line];
  res.setHeader("Set-Cookie", all);
}

/** Anonymous browser session, created on first hit, so a signed-out scan can be claimed later. */
export function sessionId(req: IncomingMessage, res: ServerResponse): string {
  const existing = unsign(cookies(req)["as_sid"]);
  if (existing) return existing;
  const fresh = randomBytes(12).toString("base64url");
  setCookie(res, "as_sid", sign(fresh));
  return fresh;
}

export function currentUser(req: IncomingMessage): User | null {
  const raw = unsign(cookies(req)["as_uid"]);
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as User;
    return u.id && u.email ? u : null;
  } catch {
    return null;
  }
}

export function signIn(res: ServerResponse, user: User): void {
  setCookie(res, "as_uid", sign(JSON.stringify(user)));
}
