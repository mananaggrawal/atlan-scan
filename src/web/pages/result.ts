import { esc, page, type User } from "../layout.ts";
import type { CategoryResult, Finding, ScanResult, Severity } from "../../engine/types.ts";
import { enterpriseModal, MODAL_SCRIPT } from "./modal.ts";
import { publicBanner, sharePanel } from "./public.ts";

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

const GOOGLE_SVG = `<svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-4H24v7.5h12c-.2 2-1.5 5-4.4 7l6.7 5.2C42.2 36 45 30.6 45 24z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4C29.7 36.6 27.1 37.5 24 37.5c-5.8 0-10.7-3.9-12.5-9.2l-7.1 5.5C8 41.3 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.5 28.3c-.5-1.4-.7-2.8-.7-4.3s.3-3 .7-4.3l-7.1-5.5C2.9 17.1 2 20.4 2 24s.9 6.9 2.4 9.8l7.1-5.5z"/><path fill="#EA4335" d="M24 10.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.3 29.9 2 24 2 15.4 2 8 6.7 4.4 14.2l7.1 5.5c1.8-5.3 6.7-9.2 12.5-9.2z"/></svg>`;

function findingBlock(f: Finding): string {
  const loc = f.line ? `${f.file}:${f.line}` : f.file;
  return `<div class="card f ${f.severity}" style="margin-top:12px">
    <div class="fh"><span class="pill ${f.severity}">${f.severity}</span><span class="ft">${esc(f.title)}</span><span class="loc">${esc(loc)}</span></div>
    <div class="quote">${esc(f.evidence)}</div>
    <p class="why">${esc(f.why)}</p>
    <p class="fix"><b>Fix</b>${esc(f.fix)}</p>
  </div>`;
}

function lockRow(runId: string, label: string): string {
  return `<div class="lockrow">
    <div class="bars"><div><i></i><i></i><i></i></div><div><i></i><i></i><i></i></div><div><i></i><i></i><i></i></div></div>
    <a class="lockbtn" href="/auth/google?next=${encodeURIComponent(`/r/${runId}`)}">${GOOGLE_SVG} ${esc(label)}</a>
  </div>`;
}

function categoryCard(c: CategoryResult, r: ScanResult, full: boolean): string {
  const status = c.count === 0
    ? `<span class="status clear">✓ nothing reported</span>`
    : `<span class="status flag ${c.worst}">${plural(c.count, "finding")}</span>`;

  const head = `<div class="cathead">
      <h3>${esc(c.name)}</h3>
      ${c.ast.map((a) => `<span class="astbadge">${a}</span>`).join("")}
      ${status}
    </div>`;

  // A category with nothing in it collapses to one line, so a clean library looks
  // clean at a glance — but every category is still on the page, because a category
  // that was skipped and a category that came back clean must never look the same.
  if (c.count === 0) {
    return `<details class="catcard cleared"><summary>${head}</summary>
      <div class="catbody"><div class="sub"><div class="sd">${esc(c.blurb)}</div></div></div></details>`;
  }

  const body = full
    ? c.findings.map(findingBlock).join("")
    : lockRow(r.runId, `Sign in to read ${c.count === 1 ? "it" : "them"}`);

  return `<div class="catcard">${head}<div class="catbody">
    <div class="sub"><div class="sd">${esc(c.blurb)}</div></div>
    ${body}
  </div></div>`;
}

/**
 * What the auditor was, and what it did not manage to read.
 *
 * Always rendered. A report that quietly omits this is claiming a completeness it
 * does not have — an unaudited skill, a clipped file and a clean skill look
 * identical unless the page says otherwise.
 */
function auditNote(r: ScanResult, full: boolean): string {
  const a = r.audit;

  if (!a.ran) {
    return `<div class="catcard"><div class="cathead"><h3>These skills were not audited</h3>
      <span class="status flag high">no audit</span></div>
      <div class="catbody"><p class="revnote">The audit is a model reading every file, and no model was available for this run.
      Nothing below is a result. Set <code>ANTHROPIC_API_KEY</code> on the server, or run the
      <code>skill-audit</code> skill yourself in Claude Code against this folder.</p></div></div>`;
  }

  const bits: string[] = [];
  bits.push(`${plural(a.reviewed + a.cached, "skill")} audited by ${esc(a.model)}`);
  if (a.dropped > 0) {
    bits.push(`${plural(a.dropped, "claim")} discarded for quoting text that is not in the files`);
  }

  const problems: string[] = [];
  // The count is shown to everyone; which file it was is detail, and detail is
  // behind the sign-in like every other detail on this page.
  const named = (parts: string[]): string => (full ? `: ${esc(parts.join("; "))}` : "");

  if (a.failures.length) {
    problems.push(`<p class="revfail">${plural(a.failures.length, "skill")} could not be audited${named(
      a.failures.map((f) => `${f.skill} (${f.reason})`),
    )}. ${a.failures.length === 1 ? "It was" : "They were"} not counted as clear.</p>`);
  }
  if (r.partial.length) {
    problems.push(`<p class="revfail">${plural(r.partial.length, "audit")} stopped early, at the model's output limit${named(
      r.partial.map((x) => `${x.skill} (${plural(x.kept, "finding")} written before it stopped)`),
    )}. What it had written is below; what it had not is missing, so ${
      r.partial.length === 1 ? "that skill is" : "those skills are"
    } not fully audited.</p>`);
  }
  if (r.notFullyRead.length) {
    problems.push(`<p class="revfail">${plural(r.notFullyRead.length, "file")} shown only in part${named(
      r.notFullyRead.map((c) => `${c.path} (${c.shown.toLocaleString()} of ${c.of.toLocaleString()} chars)`),
    )}. What was not shown was not audited.</p>`);
  }
  if (r.unreadable.length) {
    problems.push(`<p class="revfail">${plural(r.unreadable.length, "file")} could not be read at all${named(
      r.unreadable.map((u) => `${u.path} (${u.reason})`),
    )}. An unreadable file is never a clear one.</p>`);
  }

  return `<div class="catcard"><div class="cathead"><h3>How this was audited</h3>
    ${problems.length ? `<span class="status flag low">${plural(problems.length, "caveat")}</span>` : `<span class="status clear">✓ read in full</span>`}</div>
    <div class="catbody">
      <p class="revnote">${esc(bits.join(" \u00b7 "))}. Every skill was handed to the model as data — SKILL.md and
      every file beside it — with the <code>skill-audit</code> skill as its instructions. Each quote below was
      then checked back against the file it names, and anything that did not match was dropped before you saw it.</p>
      ${problems.join("")}
      <p class="revnote">This does not tell you the skills are safe. It tells you what a careful reader
      found in the text that ships. A payload can be encoded, fetched at run time, or parked in a file
      nobody opens.</p>
    </div></div>`;
}

function rail(r: ScanResult, full: boolean, isPublic = false): string {
  const grants = r.findings.filter((f) => f.categoryId === "over-privilege").length;
  const meta = full
    ? `<div class="kv"><span>Skills</span><b>${r.totals.skills}</b></div>
       <div class="kv"><span>Files read</span><b>${r.totals.files}</b></div>
       <div class="kv"><span>Could not read</span><b>${r.unreadable.length}</b></div>
       <div class="kv"><span>Images &amp; other assets</span><b>${r.totals.nonText}</b></div>
       <div class="kv"><span>Permission findings</span><b>${grants}</b></div>
       <div class="kv"><span>Listing metadata</span><b>${r.library.listingChars.toLocaleString()}c</b></div>
       <div class="kv"><span>Audited by</span><b>${esc(r.audit.model)}</b></div>
       <div class="kv"><span>Claims discarded</span><b>${r.audit.dropped}</b></div>`
    : lockRow(r.runId, "Sign in with Google");

  return `<aside class="rail">
    <div class="rc" style="padding:0"><a class="btn btn-ghost" style="width:100%;border:0;justify-content:center;padding:17px" href="/scan">${isPublic ? "Scan your own skills" : "↻ Run new scan"}</a></div>
    <div class="rc">
      <h4>Metadata</h4>
      <p>Read from the files you uploaded</p>
      <div style="margin-top:14px">${meta}</div>
    </div>

  </aside>`;
}

function lede(r: ScanResult): string {
  const cats = r.categories.length;
  const flagged = r.categories.filter((c) => c.count > 0).length;
  const unread = r.unreadable.length
    ? ` ${plural(r.unreadable.length, "file")} could not be read.`
    : " Every file was readable.";

  if (!r.audit.ran) {
    return `<b>Not audited.</b> The audit is a model reading every file, and none was available for this run.${unread}`;
  }
  if (r.totals.findings === 0) {
    return `Nothing reported across <b>${plural(r.totals.skills, "skill")}</b>. All ${cats} categories were audited and came back empty.${unread}`;
  }
  return `<b>${plural(r.totals.findings, "finding")}</b> across <b>${plural(r.totals.skills, "skill")}</b>, in ${flagged} of ${cats} categories${
    flagged < cats ? `, with ${cats - flagged} reporting nothing` : ""
  }.${unread}`;
}

function sevRow(r: ScanResult): string {
  const order: Severity[] = ["critical", "high", "medium", "low"];
  return `<div class="sevrow">${order
    .map((s) => {
      const n = r.totals.bySeverity[s];
      return `<div class="sev ${s}${n === 0 ? " zero" : ""}"><span class="v tnum">${n}</span><span class="k">${s}</span></div>`;
    })
    .join("")}
    <div class="sev info${r.unreadable.length === 0 ? " zero" : ""}"><span class="v tnum">${r.unreadable.length}</span><span class="k">unreadable</span></div>
  </div>`;
}

// Kept short enough to sit on one line each in the two-column grid.
// One line per capability, so the card signals the whole platform rather than
// just a bigger version of this scan. Kept short enough not to wrap.
const REGISTRY_FEATURES: [string, string][] = [
  ["Scan", "Re-scans when an author ships a change"],
  ["Control", "Shadow agents found, then held to policy"],
  ["Defend", "Risky actions stopped while they run"],
  ["Marketplace", "A vetted shelf your team installs from"],
];

/** The end of a report is where the limit of a one-folder scan is obvious. Name what fixes it. */
function registryCta(): string {
  return `<div class="regcta">
    <span class="eyebrow">Atlan Registry</span>
    <h3>This scan read one folder.<br>Registry watches all of them.</h3>
    <ul>${REGISTRY_FEATURES.map(([k, v]) => `<li><span class="rk">${esc(k)}</span>${esc(v)}</li>`).join("")}</ul>
    <div class="regrow">
      <a class="btn btn-blue" href="https://atlan.com" target="_blank" rel="noreferrer">Explore Atlan Registry</a>
    </div>
  </div>`;
}

export interface ResultOpts {
  isPublic?: boolean;
  isSample?: boolean;
  isOwner?: boolean;
  published?: boolean;
  baseUrl?: string;
}

export function resultPage(r: ScanResult, user: User | null, opts: ResultOpts = {}): string {
  const full = Boolean(user) || Boolean(opts.isPublic);
  const when = new Date(r.scannedAt).toISOString().replace("T", " ").slice(0, 16);

  return page({
    title: `Scan results — ${r.totals.findings} findings`,
    user,
    script: MODAL_SCRIPT,
    body: `
<div class="wrap">
  <div class="pagehead">
    <div class="ph">
      <span class="eyebrow">Scan results</span>
      <h1 style="margin-top:10px">${esc(r.source.label)}</h1>
      <p class="resultlede">${lede(r)}</p>
      <div class="chips">
        <span class="chip"><span class="lbl">Scanned at</span>${when} UTC</span>
        <span class="chip"><span class="lbl">Engine</span>${esc(r.engineVersion)}</span>
        <span class="chip"><span class="lbl">Files</span>${r.totals.files}</span>
        ${r.source.kind === "cli" ? `<span class="chip" style="background:var(--high-bg);color:var(--high)">Self-reported — scanned on the author's machine</span>` : ""}
      </div>
    </div>
  </div>
  ${sevRow(r)}
  ${opts.isPublic ? publicBanner(Boolean(opts.isSample)) : ""}
  <div class="cols" style="margin-top:26px">
    <div>
      ${auditNote(r, full)}
      ${r.categories.map((c) => categoryCard(c, r, full)).join("")}
      ${opts.isOwner ? sharePanel(r.runId, opts.baseUrl ?? "") : ""}
      ${opts.isPublic ? "" : registryCta()}
    </div>
    ${rail(r, full, Boolean(opts.isPublic))}
  </div>
</div>
${enterpriseModal()}`,
  });
}

export function historyPage(
  runs: { runId: string; label: string; when: string; findings: number; skills: number; worst: Severity | null }[],
  user: User,
): string {
  return page({
    title: "Your scans — Atlan Scan",
    user,
    body: `<div class="wrap" style="padding:44px 0">
      <h1 style="font-size:clamp(30px,4vw,44px)">Your scans</h1>
      ${
        runs.length
          ? `<table class="tbl"><thead><tr><th>Source</th><th style="text-align:right">Skills</th><th style="text-align:right">Findings</th><th style="text-align:right">Worst</th><th style="text-align:right">When</th></tr></thead><tbody>
        ${runs
          .map(
            (x) => `<tr>
          <td class="nm"><a href="/r/${esc(x.runId)}">${esc(x.label)}</a></td>
          <td class="r">${x.skills}</td>
          <td class="r">${x.findings || "—"}</td>
          <td class="r">${x.worst ? `<span class="pill ${x.worst}">${x.worst}</span>` : `<span class="pill none">none</span>`}</td>
          <td class="r">${esc(x.when)}</td>
        </tr>`,
          )
          .join("")}</tbody></table>`
          : `<p class="lede" style="margin-top:18px">Nothing scanned yet. <a href="/scan">Run one</a>.</p>`
      }
    </div>`,
  });
}
