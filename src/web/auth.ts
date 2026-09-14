import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { page, esc, type User } from "./layout.ts";
import { signIn, sign, unsign } from "./session.ts";

const CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] ?? "";
const CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] ?? "";
const BASE_URL = process.env["BASE_URL"] ?? process.env["RENDER_EXTERNAL_URL"] ?? "http://localhost:8787";

export const googleConfigured = Boolean(CLIENT_ID && CLIENT_SECRET);
export const redirectUri = `${BASE_URL}/auth/callback`;

export function userFromEmail(email: string, name?: string): User {
  return {
    id: createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 24),
    email: email.toLowerCase(),
    name: name || email.split("@")[0] || "there",
  };
}

export function authStartUrl(next: string): string {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: sign(next),
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/** Dev stand-in until the Google OAuth client exists. Deliberately obvious about what it is. */
export function stubSignInPage(next: string): string {
  return page({
    title: "Sign in — Atlan Scan",
    user: null,
    body: `<div class="narrow" style="padding:60px 0">
      <span class="eyebrow">Sign in</span>
      <h1 style="font-size:34px;margin-top:14px">Sign in to see the detail</h1>
      <div class="card" style="padding:26px 28px;margin-top:24px">
        <p class="muted" style="font-size:14px">Google sign-in is not wired up on this instance yet — <span class="mono">GOOGLE_CLIENT_ID</span> and <span class="mono">GOOGLE_CLIENT_SECRET</span> are unset. Use any email to continue; the rest of the flow is the real one.</p>
        <form method="POST" action="/auth/stub" class="field" style="margin-top:18px">
          <input type="hidden" name="next" value="${esc(next)}">
          <input type="text" name="email" placeholder="you@company.com" required aria-label="Email">
          <button class="btn btn-blue" type="submit">Continue</button>
        </form>
      </div>
    </div>`,
  });
}

export async function completeGoogleCallback(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<{ next: string } | { error: string }> {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const next = unsign(state ?? undefined) ?? "/";
  if (!code) return { error: "Google did not return an authorization code." };

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return { error: `Google token exchange failed (${tokenRes.status}).` };
  const token = (await tokenRes.json()) as { id_token?: string };
  if (!token.id_token) return { error: "Google did not return an id_token." };

  const payloadRaw = token.id_token.split(".")[1] ?? "";
  const claims = JSON.parse(Buffer.from(payloadRaw, "base64url").toString()) as {
    email?: string;
    name?: string;
    email_verified?: boolean;
  };
  if (!claims.email) return { error: "No email on the Google account." };

  signIn(res, userFromEmail(claims.email, claims.name));
  return { next };
}
