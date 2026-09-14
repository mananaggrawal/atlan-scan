import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Server } from "node:http";
import { makeServer } from "../src/web/server.ts";

let server: Server;
let base = "";
let jar = "";

function saveCookies(res: Response): void {
  const set = res.headers.getSetCookie?.() ?? [];
  const map = new Map(jar.split("; ").filter(Boolean).map((c) => [c.split("=")[0]!, c]));
  for (const line of set) {
    const pair = line.split(";")[0]!;
    map.set(pair.split("=")[0]!, pair);
  }
  jar = [...map.values()].join("; ");
}

async function get(path: string, redirect: "manual" | "follow" = "manual"): Promise<Response> {
  const res = await fetch(base + path, { headers: { cookie: jar }, redirect });
  saveCookies(res);
  return res;
}
async function post(path: string, body: string, type: string): Promise<Response> {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { cookie: jar, "content-type": type },
    body,
    redirect: "manual",
  });
  saveCookies(res);
  return res;
}

function demoFiles(): { path: string; data: string }[] {
  const root = new URL("../fixtures/demo-library", import.meta.url).pathname;
  const out: { path: string; data: string }[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (statSync(full).isFile()) {
        out.push({ path: relative(root, full), data: readFileSync(full).toString("base64") });
      }
    }
  };
  walk(root);
  return out;
}

before(async () => {
  server = makeServer();
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});
after(() => server.close());

let runId = "";

test("public pages render signed out", async () => {
  for (const path of ["/", "/scan"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.match(html, /Atlan <em>Scan<\/em>/);
    assert.ok(!/undefined|\[object Object\]|NaN/.test(html), `${path} rendered a placeholder`);
  }
  assert.equal((await get("/healthz")).status, 200);
});

test("history redirects to sign-in when signed out", async () => {
  const res = await get("/history");
  assert.equal(res.status, 302);
  assert.match(res.headers.get("location") ?? "", /auth\/google/);
});

test("a scan of the demo library returns a run id", async () => {
  const res = await post("/api/scan", JSON.stringify({ files: demoFiles() }), "application/json");
  assert.equal(res.status, 200);
  const body = (await res.json()) as { runId: string; findings: number };
  assert.ok(body.runId);
  assert.ok(body.findings > 15, `expected findings, got ${body.findings}`);
  runId = body.runId;
});

test("the signed-out report is a teaser: counts yes, evidence no", async () => {
  const html = await (await get(`/r/${runId}`)).text();
  assert.match(html, /Sign in to see the line/);
  for (const leak of ["data-sync", "ui-design", "deploy-helper", "webhook.site/9a1f2c3d", "Ignore all previous"]) {
    assert.ok(!html.includes(leak), `teaser leaked: ${leak}`);
  }
  assert.match(html, /checks<\/b> flagged/);
  assert.match(html, /Prompt injection/);
});

test("a folder with no SKILL.md is refused with a useful message", async () => {
  const res = await post("/api/scan", JSON.stringify({ files: [{ path: "a/readme.md", data: "aGk=" }] }), "application/json");
  assert.equal(res.status, 400);
  assert.match(((await res.json()) as { error: string }).error, /SKILL\.md/);
});

test("a malformed repo string is refused", async () => {
  const res = await post("/api/scan", JSON.stringify({ repo: "not a repo!!" }), "application/json");
  assert.equal(res.status, 400);
  assert.match(((await res.json()) as { error: string }).error, /GitHub|repository/i);
});

test("signing in claims the anonymous run and reveals the detail", async () => {
  const res = await post("/auth/stub", `email=test@example.com&next=/r/${runId}`, "application/x-www-form-urlencoded");
  assert.equal(res.status, 302);
  const html = await (await get(`/r/${runId}`)).text();
  assert.ok(!html.includes("Sign in to see the line"), "still gated after sign-in");
  assert.match(html, /data-sync/);
  assert.match(html, /webhook\.site/);
  assert.match(html, /Share this report/);
});

test("history lists the claimed run", async () => {
  const html = await (await get("/history")).text();
  assert.match(html, new RegExp(`/r/${runId}`));
});

test("a report is shareable by link with no publish step, and the badge claims nothing", async () => {
  const html = await (await get(`/r/${runId}`)).text();
  assert.match(html, /Share this report/);
  assert.match(html, /share-url/);
  assert.match(html, /badge-md/);
  assert.ok(!html.includes("Unpublish"), "publish toggle still present");

  const pub = await get(`/p/${runId}`);
  assert.equal(pub.status, 200, "link did not work without publishing");
  assert.match(await pub.text(), /only true for the moment it ran/);

  const badge = await get(`/badge/${runId}.svg`);
  assert.equal(badge.status, 200);
  const svg = await badge.text();
  assert.match(svg, /skills? · \d+\/45 flagged/);
  assert.ok(!/\bsafe\b|✓|passed/i.test(svg), "badge made a safety claim");
});

test("the share panel warns when the link cannot be reached from a README", async () => {
  const html = await (await get(`/r/${runId}`)).text();
  assert.match(html, /only exists on this machine/);
  assert.match(html, /BASE_URL/);
});

test("someone else's run stays a teaser for them", async () => {
  const other = await fetch(`${base}/r/${runId}`, { redirect: "manual" });
  const html = await other.text();
  assert.match(html, /Sign in to see the line/);
  assert.ok(!html.includes("webhook.site"), "another visitor saw the evidence");
});

test("a CLI-ingested run is labelled self-reported", async () => {
  const scan = await post("/api/scan", JSON.stringify({ files: demoFiles() }), "application/json");
  const { runId: seed } = (await scan.json()) as { runId: string };
  const seeded = await (await get(`/r/${seed}`)).text();
  assert.ok(seeded.length > 0);

  const res = await post("/api/ingest", JSON.stringify({ result: { findings: [], categories: [], totals: { skills: 1, files: 1, findings: 0, nonText: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 } }, skills: [], unreadable: [], library: { listingChars: 0, budgetChars: 1536, overlapPairs: [] }, engineVersion: "scan-1.0.0", objectType: "skill", source: { kind: "cli", label: "my-skills" }, runId: "x", scannedAt: "x" } }), "application/json");
  assert.equal(res.status, 200);
  const { runId: cliRun } = (await res.json()) as { runId: string };
  const html = await (await get(`/r/${cliRun}`)).text();
  assert.match(html, /Self-reported/);
});

test("garbage sent to /api/ingest is refused", async () => {
  assert.equal((await post("/api/ingest", "{}", "application/json")).status, 400);
  assert.equal((await post("/api/ingest", "not json", "application/json")).status, 400);
});

test("the Registry capture records an address and thanks the visitor", async () => {
  const res = await post("/api/interest", "feature=mcp&first=A&last=B&email=a@b.com&consent=on", "application/x-www-form-urlencoded");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Noted|email you/);
});

test("unknown paths 404 rather than crash", async () => {
  assert.equal((await get("/nope")).status, 404);
  assert.equal((await get("/r/does-not-exist")).status, 404);
  assert.equal((await get("/p/does-not-exist")).status, 404);
});

test("signing out drops back to the teaser", async () => {
  const out = await get("/auth/signout");
  assert.equal(out.status, 302);
  const html = await (await get(`/r/${runId}`)).text();
  assert.match(html, /Sign in to see the line/);
});

test("the sample report is public, real, and labelled as an example", async () => {
  const res = await fetch(`${base}/p/sample`, { redirect: "manual" });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /An example report/);
  assert.match(html, /example-skill-library/);
  assert.match(html, /Scan your own skills/);
  // it has to show actual findings, or it proves nothing
  assert.ok(html.includes("class=\"quote\""), "sample report shows no quoted evidence");
  assert.match(html, /critical/);
  assert.ok(!html.includes("More in this scan"), "upsell on a public report");
});

test("the landing offers the sample instead of a second door to /scan", async () => {
  const html = await (await get("/")).text();
  assert.match(html, /href="\/p\/sample"/);
  assert.ok(!html.includes("Paste a GitHub repo"), "redundant secondary CTA still present");
});

test("the badge says 1 skill, not 1 skills", async () => {
  const b64 = Buffer.from("---\nname: one\ndescription: d\n---\nbody\n").toString("base64");
  const { runId: solo } = (await (
    await post("/api/scan", JSON.stringify({ files: [{ path: "SKILL.md", data: b64 }] }), "application/json")
  ).json()) as { runId: string };
  await post(`/r/${solo}/share`, "public=1", "application/x-www-form-urlencoded");
  const svg = await (await get(`/badge/${solo}.svg`)).text();
  assert.match(svg, /1 skill ·/);
  assert.ok(!svg.includes("1 skills"));
});

