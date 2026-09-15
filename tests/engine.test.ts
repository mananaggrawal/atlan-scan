import test from "node:test";
import assert from "node:assert/strict";
import { parseTree, type RawFile } from "../src/engine/parse.ts";
import { libraryFacts, skillFacts, DESCRIPTION_BUDGET } from "../src/engine/facts.ts";
import { assemble, runScan } from "../src/engine/index.ts";
import { CATEGORIES, type Finding } from "../src/engine/types.ts";
import type { AuditReport } from "../src/engine/review/index.ts";
import { resultPage } from "../src/web/pages/result.ts";
import { CSS } from "../src/web/theme.ts";

/**
 * The engine no longer decides anything, so these are tests of measurement and
 * assembly — not of judgement. Judgement lives in skills/skill-audit/SKILL.md and
 * is exercised through the verifier in review.test.ts.
 */

const f = (path: string, body: string): RawFile => ({ path, data: Buffer.from(body) });

const SKILL = [
  "---",
  "name: deploy-helper",
  "description: Use when the user asks to deploy the service.",
  "---",
  "",
  "# Deploy",
  "",
  "See [the runbook](runbook.md) and [the missing one](gone.md).",
  "",
].join("\n");

function tree(files: RawFile[]) {
  return parseTree(files);
}

const NO_AUDIT: AuditReport = {
  ran: false, model: "test", cached: 0, reviewed: 0, dropped: 0,
  failures: [], clipped: [], partial: [], findings: [],
  usage: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  limits: { readChars: 160_000, readDefault: 160_000, outputTokens: 16_000, outputDefault: 16_000 },
};

function auditWith(findings: Finding[]): AuditReport {
  return { ...NO_AUDIT, ran: true, reviewed: 1, findings };
}

const finding = (over: Partial<Finding> = {}): Finding => ({
  checkId: "audit",
  categoryId: "injection",
  severity: "high",
  skill: "deploy-helper",
  file: "deploy-helper/SKILL.md",
  line: 6,
  title: "A title",
  evidence: "# Deploy",
  why: "Because.",
  fix: "Do the thing.",
  ast: [],
  origin: "model",
  ...over,
});

test("facts: the file inventory and the frontmatter keys are measured, not judged", () => {
  const t = tree([f("deploy-helper/SKILL.md", SKILL), f("deploy-helper/runbook.md", "# Runbook\n")]);
  const facts = skillFacts(t.skills[0]!);

  assert.equal(facts.files.length, 2);
  assert.ok(facts.keysPresent.includes("name"));
  assert.ok(facts.keysPresent.includes("description"));
  // Absent keys are reported as absent. Nothing here says that is a problem.
  assert.ok(facts.keysMissing.includes("version"));
  assert.ok(facts.keysMissing.includes("license"));
  assert.ok(facts.keysMissing.includes("allowed-tools"));
});

test("facts: a link to a file that is not in the upload is measured by path", () => {
  const t = tree([f("deploy-helper/SKILL.md", SKILL), f("deploy-helper/runbook.md", "# Runbook\n")]);
  const facts = skillFacts(t.skills[0]!);

  const refs = facts.danglingRefs.map((d) => d.ref);
  assert.deepEqual(refs, ["gone.md"], "runbook.md is present, gone.md is not");
});

test("facts: an unreadable file is recorded, never dropped", () => {
  const t = tree([
    f("deploy-helper/SKILL.md", SKILL),
    { path: "deploy-helper/blob.bin", data: Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]) },
  ]);
  const facts = skillFacts(t.skills[0]!);
  const blob = facts.files.find((x) => x.path.endsWith("blob.bin"));

  assert.ok(blob, "the binary is still in the inventory");
  assert.equal(blob.readable, false);
  assert.ok(blob.note, "and it says why");
});

test("facts: similarity is a number with no threshold attached", () => {
  const a = ["---", "name: alpha", "description: Use when the user asks to deploy the service to production.", "---", "", "body"].join("\n");
  const b = ["---", "name: beta", "description: Use when the user asks to deploy the service to production.", "---", "", "body"].join("\n");
  const t = tree([f("alpha/SKILL.md", a), f("beta/SKILL.md", b)]);
  const facts = libraryFacts(t.skills);

  assert.equal(facts.skills, 2);
  assert.equal(facts.budgetChars, DESCRIPTION_BUDGET);
  assert.equal(facts.overlapPairs.length, 1);
  assert.ok(facts.overlapPairs[0]!.similarity > 0.9, "identical descriptions measure near 1");
  // The pair carries no severity, title or verdict — only the number.
  assert.deepEqual(Object.keys(facts.overlapPairs[0]!).sort(), ["a", "b", "similarity"]);
});

test("assemble: with no audit there are no findings, and the report says so", () => {
  const r = assemble({ files: [f("deploy-helper/SKILL.md", SKILL)], source: { kind: "upload", label: "t" } }, NO_AUDIT);

  assert.equal(r.audit.ran, false);
  assert.equal(r.totals.findings, 0);
  // The invariant that matters: an unaudited run must be distinguishable from a clean one.
  assert.equal(r.findings.length, 0);
  assert.equal(r.categories.length, CATEGORIES.length);
});

test("assemble: every category is present on every run, cleared or not", () => {
  const r = assemble(
    { files: [f("deploy-helper/SKILL.md", SKILL)], source: { kind: "upload", label: "t" } },
    auditWith([finding()]),
  );

  assert.equal(r.categories.length, CATEGORIES.length);
  assert.deepEqual(r.categories.map((c) => c.id), CATEGORIES.map((c) => c.id));

  const injection = r.categories.find((c) => c.id === "injection")!;
  assert.equal(injection.count, 1);
  assert.equal(injection.findings.length, 1);

  const empty = r.categories.filter((c) => c.count === 0);
  assert.ok(empty.length === CATEGORIES.length - 1, "the rest are still rendered, at zero");
  for (const c of empty) assert.deepEqual(c.findings, []);
});

test("assemble: findings sort worst-first and roll up into totals", () => {
  const r = assemble(
    { files: [f("deploy-helper/SKILL.md", SKILL)], source: { kind: "upload", label: "t" } },
    auditWith([
      finding({ severity: "low", title: "Low one" }),
      finding({ severity: "critical", title: "Critical one", categoryId: "exfiltration" }),
      finding({ severity: "medium", title: "Medium one", categoryId: "opacity" }),
    ]),
  );

  assert.deepEqual(r.findings.map((x) => x.severity), ["critical", "medium", "low"]);
  assert.equal(r.totals.findings, 3);
  assert.equal(r.totals.bySeverity.critical, 1);
  assert.equal(r.totals.bySeverity.high, 0);
  assert.equal(r.skills[0]!.worst, "critical");
  assert.equal(r.skills[0]!.findings, 3);
});

/**
 * The live sample report read "Nothing reported across 8 skills. All 8 categories
 * were audited and came back empty" on a run where all nine calls returned 400 and
 * nothing was read. The caveat strip said so and was outvoted by the headline.
 */
test("assemble: a run where every audit failed never reads as a clean one", () => {
  const audit: AuditReport = {
    ...NO_AUDIT,
    ran: true,
    reviewed: 0,
    failures: [{ skill: "deploy-helper", reason: "reviewer returned 400: credit balance is too low" }],
  };
  const r = assemble({ files: [f("deploy-helper/SKILL.md", SKILL)], source: { kind: "upload", label: "t" } }, audit);
  const html = resultPage(r, { id: "u", email: "a@b.c", name: "A" });

  assert.match(html, /Not audited/i, "the headline has to carry it, not just the small print");
  assert.ok(!/came back empty/.test(html), "a failed audit is not an empty one");
  assert.ok(!/✓ nothing reported/.test(html), "and no category may claim a clean tick");
  assert.match(html, /credit balance is too low/, "and it says why");
});

test("assemble: a truncated audit is reported as partial, never as complete", () => {
  const audit: AuditReport = { ...auditWith([finding()]), partial: [{ skill: "deploy-helper", kept: 1, reason: "the model's output limit" }] };
  const r = assemble({ files: [f("deploy-helper/SKILL.md", SKILL)], source: { kind: "upload", label: "t" } }, audit);

  assert.equal(r.partial.length, 1);
  assert.equal(r.partial[0]!.kept, 1);
  assert.equal(r.totals.findings, 1, "what it did write is still reported");
});

test("assemble: clipped files reach the report, because a clipped file is not a clean one", () => {
  const audit: AuditReport = {
    ...auditWith([]),
    clipped: [{ skill: "deploy-helper", path: "deploy-helper/big.md", shown: 100, of: 900 }],
  };
  const r = assemble({ files: [f("deploy-helper/SKILL.md", SKILL)], source: { kind: "upload", label: "t" } }, audit);

  assert.equal(r.notFullyRead.length, 1);
  assert.equal(r.notFullyRead[0]!.of, 900);
});

test("runScan: with no API key it returns an unaudited result rather than throwing", async () => {
  const had = process.env["ANTHROPIC_API_KEY"];
  delete process.env["ANTHROPIC_API_KEY"];
  try {
    const r = await runScan({ files: [f("deploy-helper/SKILL.md", SKILL)], source: { kind: "upload", label: "t" } });
    assert.equal(r.audit.ran, false);
    assert.equal(r.findings.length, 0);
    assert.equal(r.totals.skills, 1);
  } finally {
    if (had !== undefined) process.env["ANTHROPIC_API_KEY"] = had;
  }
});

test("the page survives output no designer would have chosen", () => {
  // Every string on a report is written by a model or copied out of someone else's
  // file. This is the worst case: an unbreakable 600-character token, a title at the
  // clip limit, a path deeper than the column is wide. It must render, and it must
  // not smuggle markup through.
  const wall = "A".repeat(600);
  const url = `https://example.com/${"seg/".repeat(60)}?q=${"x".repeat(200)}`;
  const nasty = assemble(
    { files: [f("deploy-helper/SKILL.md", SKILL)], source: { kind: "upload", label: `<img src=x onerror=alert(1)> ${wall}` } },
    {
      ...auditWith([
        finding({ title: "T".repeat(90), evidence: wall, why: url, fix: wall, file: `${"deep/".repeat(20)}SKILL.md` }),
        finding({ severity: "info", categoryId: "library", title: "<script>alert(1)</script>", evidence: "# Deploy", why: url, fix: url }),
      ]),
      partial: [{ skill: wall, kept: 99, reason: wall }],
      clipped: [{ skill: wall, path: `${"deep/".repeat(20)}big.md`, shown: 1, of: 9_999_999 }],
    },
  );

  for (const html of [resultPage(nasty, null), resultPage(nasty, { id: "u", email: "a@b.c", name: "A" })]) {
    assert.ok(html.length > 1000);
    assert.ok(!html.includes("<img src=x onerror"), "the source label was not escaped");
    assert.ok(!html.includes("<script>alert(1)</script>"), "a finding title was not escaped");
    assert.ok(!/undefined|\[object Object\]|NaN/.test(html), "a placeholder reached the page");
  }
});

test("the stylesheet carries the rules that stop long output pushing the page sideways", () => {
  // min-width:auto on grid and flex children is the cause of almost every broken
  // layout: the child refuses to shrink below its longest unbreakable word. These
  // three declarations are load-bearing, so a refactor that drops them fails here.
  assert.ok(CSS.includes(".cols > *{min-width:0}"), "grid children must be allowed to shrink");
  assert.ok(/overflow-wrap:anywhere/.test(CSS), "long unbroken strings must be breakable");
  assert.ok(/\.wrap\{overflow-x:clip\}/.test(CSS), "the page body must never scroll sideways");
});
