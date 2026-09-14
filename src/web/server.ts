import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { newRunId, runScan } from "../engine/index.ts";
import type { ScanResult } from "../engine/types.ts";
import type { RawFile } from "../engine/parse.ts";
import { fetchRepoFiles, LIMITS, parseRepoInput, repoInputError } from "../ingest/github.ts";
import { claimRuns, getRun, putRun, runsFor, setOwner, storeKind } from "../store/runs.ts";
import { reviewCache } from "../store/reviewcache.ts";
import { badgeSvg } from "./badge.ts";
import { ensureSampleRun, SAMPLE_RUN_ID } from "./sample.ts";
import { landingPage } from "./pages/landing.ts";
import { privacyPage, termsPage } from "./pages/legal.ts";
import { scanPage } from "./pages/scan.ts";
import { historyPage, resultPage } from "./pages/result.ts";
import { page, esc } from "./layout.ts";
import { clearCookie, currentUser, sessionId, signIn } from "./session.ts";
import { authStartUrl, completeGoogleCallback, googleConfigured, stubSignInPage, userFromEmail } from "./auth.ts";

const PORT = Number(process.env["PORT"] ?? 8787);
const MAX_BODY = 34 * 1024 * 1024;

function send(res: ServerResponse, status: number, body: string, type = "text/html; charset=utf-8"): void {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(body);
}

function json(res: ServerResponse, status: number, obj: unknown): void {
  send(res, status, JSON.stringify(obj), "application/json; charset=utf-8");
}

function redirect(res: ServerResponse, to: string): void {
  res.writeHead(302, { location: to, "cache-control": "no-store" });
  res.end();
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("That folder is larger than this scanner accepts. Try one skill directory at a time."));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function baseUrl(req: IncomingMessage): string {
  const configured = process.env["BASE_URL"] ?? process.env["RENDER_EXTERNAL_URL"];
  if (configured) return configured.replace(/\/+$/, "");
  // Behind a proxy the request is http even when the site is https; trust the forwarded header.
  const proto = String(req.headers["x-forwarded-proto"] ?? "http").split(",")[0]!.trim();
  return `${proto}://${req.headers.host ?? "localhost:8787"}`;
}

function notFound(res: ServerResponse, user: ReturnType<typeof currentUser>): void {
  send(
    res,
    404,
    page({
      title: "Not found — Atlan Scan",
      user,
      body: `<div class="narrow" style="padding:80px 0"><h1 style="font-size:36px">Not here.</h1>
      <p class="lede" style="margin-top:14px">That scan has expired, or the link is wrong. <a href="/scan">Run a new one</a>.</p></div>`,
    }),
  );
}

interface ScanPayload {
  files?: { path: string; data: string }[];
  repo?: string;
}

async function handleScan(req: IncomingMessage, res: ServerResponse, sid: string): Promise<void> {
  let payload: ScanPayload;
  try {
    payload = JSON.parse((await readBody(req)).toString("utf8")) as ScanPayload;
  } catch (err) {
    return json(res, 400, { error: (err as Error).message || "Could not read that upload." });
  }

  let files: RawFile[] = [];
  let label = "uploaded folder";
  let kind: "upload" | "github" = "upload";

  if (payload.repo) {
    const ref = parseRepoInput(payload.repo);
    if (!ref) return json(res, 400, { error: repoInputError(payload.repo) });
    try {
      const fetched = await fetchRepoFiles(ref);
      files = fetched.files;
      label = fetched.label;
      kind = "github";
    } catch (err) {
      return json(res, 400, { error: (err as Error).message });
    }
  } else if (Array.isArray(payload.files)) {
    if (payload.files.length > LIMITS.maxFiles) {
      return json(res, 400, { error: `That folder has more than ${LIMITS.maxFiles} files. Point the scan at one skills directory.` });
    }
    files = payload.files.map((f) => ({ path: String(f.path).replace(/^\/+/, ""), data: Buffer.from(String(f.data), "base64") }));
    const first = files[0]?.path ?? "";
    const root = first.split("/")[0];
    if (files.length === 1) label = first;
    else if (root && files.every((f) => f.path.startsWith(`${root}/`))) label = root;
  } else {
    return json(res, 400, { error: "Nothing to scan." });
  }

  if (!files.length) return json(res, 400, { error: "No files found to scan." });
  if (!files.some((f) => /(^|\/)SKILL\.md$/i.test(f.path))) {
    return json(res, 400, {
      error: "No SKILL.md in there. Atlan Scan reads skills — point it at one skill folder, or a directory of them.",
    });
  }

  const result = await runScan({ files, source: { kind, label } }, reviewCache);
  putRun(result, sid, currentUser(req)?.id ?? null);
  return json(res, 200, { runId: result.runId, findings: result.totals.findings });
}

export function makeServer() {
  // Fire-and-forget: the sample costs model calls to build, and the server must
  // come up and answer /healthz whether or not that succeeds.
  void ensureSampleRun().catch((err: unknown) => console.warn(`[sample] ${(err as Error).message}`));
  return createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const sid = sessionId(req, res);
  const user = currentUser(req);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  try {
    if (req.method === "POST" && path === "/api/scan") return await handleScan(req, res, sid);

    // The CLI scans locally and posts findings only — never file contents. Such runs are
    // labelled self-reported everywhere they appear, because we did not read the files.
    if (req.method === "POST" && path === "/api/ingest") {
      let payload: { result?: ScanResult };
      try {
        payload = JSON.parse((await readBody(req)).toString("utf8")) as { result?: ScanResult };
      } catch {
        return json(res, 400, { error: "Unreadable payload." });
      }
      const incoming = payload.result;
      if (!incoming || !Array.isArray(incoming.findings) || !Array.isArray(incoming.categories)) {
        return json(res, 400, { error: "That is not a scan result." });
      }
      // A report published from someone's machine may have been produced by an older
      // CLI. Fill in what a current report carries rather than rendering a broken page,
      // and default the audit block to "did not run" — never to a clean result.
      const result: ScanResult = {
        ...incoming,
        runId: newRunId(),
        scannedAt: new Date().toISOString(),
        source: { kind: "cli", label: String(incoming.source?.label ?? "local folder").slice(0, 120) },
        unreadable: incoming.unreadable ?? [],
        notFullyRead: incoming.notFullyRead ?? [],
        partial: incoming.partial ?? [],
        totals: { ...incoming.totals, ignored: incoming.totals?.ignored ?? 0 },
        library: {
          listingChars: incoming.library?.listingChars ?? 0,
          budgetChars: incoming.library?.budgetChars ?? 1536,
          skills: incoming.library?.skills ?? incoming.totals?.skills ?? 0,
          overlapPairs: incoming.library?.overlapPairs ?? [],
          duplicatePairs: incoming.library?.duplicatePairs ?? [],
        },
        audit: incoming.audit ?? {
          ran: false, model: "unknown", reviewed: 0, cached: 0, dropped: 0, failures: [], findings: [],
        },
      };
      putRun(result, sid, currentUser(req)?.id ?? null);
      return json(res, 200, { runId: result.runId });
    }

    if (req.method === "POST" && path === "/auth/stub") {
      const body = new URLSearchParams((await readBody(req)).toString("utf8"));
      const email = (body.get("email") ?? "").trim();
      if (!email.includes("@")) return redirect(res, "/auth/google");
      signIn(res, userFromEmail(email));
      claimRuns(sid, userFromEmail(email).id);
      return redirect(res, body.get("next") || "/history");
    }

    if (req.method === "GET" && path === "/auth/google") {
      const next = url.searchParams.get("next") ?? "/history";
      if (user) return redirect(res, next);
      if (!googleConfigured) return send(res, 200, stubSignInPage(next));
      return redirect(res, authStartUrl(next));
    }

    if (req.method === "GET" && path === "/auth/callback") {
      const out = await completeGoogleCallback(req, res, url);
      if ("error" in out) {
        return send(
          res,
          400,
          page({
            title: "Sign-in failed",
            user: null,
            body: `<div class="narrow" style="padding:70px 0"><h1 style="font-size:32px">Sign-in failed</h1><p class="lede" style="margin-top:14px">${esc(out.error)}</p><p style="margin-top:20px"><a class="btn btn-ghost" href="/">Back</a></p></div>`,
          }),
        );
      }
      const signedIn = currentUser({ headers: { cookie: String(res.getHeader("Set-Cookie") ?? "").replace(/; [^,]*/g, "") } } as IncomingMessage);
      if (signedIn) claimRuns(sid, signedIn.id);
      return redirect(res, out.next);
    }

    if (path === "/auth/signout") {
      clearCookie(res, "as_uid");
      return redirect(res, "/");
    }

    if (req.method === "GET" && path === "/") return send(res, 200, landingPage(user));
    if (req.method === "GET" && path === "/privacy") return send(res, 200, privacyPage(user));
    if (req.method === "GET" && path === "/terms") return send(res, 200, termsPage(user));
    if (req.method === "GET" && path === "/scan") {
      const last = user ? runsFor(user.id)[0]?.result.runId ?? null : null;
      return send(res, 200, scanPage(user, last));
    }

    if (req.method === "POST" && path === "/api/interest") {
      const body = new URLSearchParams((await readBody(req)).toString("utf8"));
      console.log("[scan-interest]", JSON.stringify({
        feature: body.get("feature"), email: body.get("email"),
        name: `${body.get("first") ?? ""} ${body.get("last") ?? ""}`.trim(),
        note: (body.get("note") ?? "").trim().slice(0, 500) || null,
        at: new Date().toISOString(),
      }));
      return send(res, 200, page({
        title: "Thanks — Atlan Scan", user,
        body: `<div class="narrow" style="padding:80px 0;text-align:center"><h1 style="font-size:36px">Noted.</h1>
        <p class="lede" style="margin-top:14px">You are on the list for ${esc(body.get("feature") || "that")} scanning. It is not built yet \u2014 votes like yours decide what we build next, and you get one email when it ships.</p>
        <p style="margin-top:24px"><a class="btn btn-primary" href="/scan">Back to scanning</a></p></div>`,
      }));
    }

    if (req.method === "GET" && path === "/history") {
      if (!user) return redirect(res, "/auth/google?next=%2Fhistory");
      const runs = runsFor(user.id).map((r) => ({
        runId: r.result.runId,
        label: r.result.source.label,
        when: new Date(r.createdAt).toISOString().replace("T", " ").slice(0, 16),
        findings: r.result.totals.findings,
        skills: r.result.totals.skills,
        worst: r.result.findings[0]?.severity ?? null,
      }));
      return send(res, 200, historyPage(runs, user));
    }

    const badgeMatch = /^\/badge\/([A-Za-z0-9_-]{6,32})\.svg$/.exec(path);
    if (req.method === "GET" && badgeMatch) {
      const run = getRun(badgeMatch[1]!);
      const ok = run ?? null;
      const age = ok ? Math.max(0, Math.floor((Date.now() - ok.createdAt) / 86400000)) : null;
      res.writeHead(200, {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "max-age=300, s-maxage=300",
      });
      return res.end(badgeSvg(ok ? ok.result : null, age));
    }

    const publicMatch = /^\/p\/([A-Za-z0-9_-]{6,32})$/.exec(path);
    if (req.method === "GET" && publicMatch) {
      const run = getRun(publicMatch[1]!);
      if (!run) return notFound(res, user);
      return send(res, 200, resultPage(run.result, user, {
        isPublic: true, isSample: publicMatch[1] === SAMPLE_RUN_ID, baseUrl: baseUrl(req),
      }));
    }

    const runMatch = /^\/r\/([A-Za-z0-9_-]{6,32})$/.exec(path);
    if (req.method === "GET" && runMatch) {
      const run = getRun(runMatch[1]!);
      if (!run) return notFound(res, user);
      // A signed-in visitor sees full detail only for their own runs.
      const owned = Boolean(user && (run.ownerId === user.id || run.sessionId === sid));
      if (user && run.ownerId === null && run.sessionId === sid) setOwner(run.result.runId, user.id);
      return send(res, 200, resultPage(run.result, owned ? user : null, {
        isOwner: owned, published: run.isPublic, baseUrl: baseUrl(req),
      }));
    }

    if (req.method === "GET" && path === "/healthz") return json(res, 200, { ok: true });

    return notFound(res, user);
  } catch (err) {
    console.error(err);
    return send(
      res,
      500,
      page({
        title: "Something broke",
        user,
        body: `<div class="narrow" style="padding:70px 0"><h1 style="font-size:32px">Something broke.</h1><p class="lede" style="margin-top:14px">${esc((err as Error).message ?? "Unknown error")}</p></div>`,
      }),
    );
  }
});

}

const isEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) {
  makeServer().listen(PORT, () => {
    console.log(`Atlan Scan on http://localhost:${PORT}  ·  google=${googleConfigured ? "configured" : "stub"}  ·  store=${storeKind}`);
  });
}
