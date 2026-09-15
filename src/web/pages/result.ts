import { esc, page, type User } from "../layout.ts";
import type { CategoryResult, Finding, ScanResult, Severity } from "../../engine/types.ts";
import { enterpriseModal, MODAL_SCRIPT } from "./modal.ts";
import { publicBanner, shareButton, shareRail } from "./public.ts";

/**
 * Nothing on this page is allowed to be arbitrarily long.
 *
 * Titles, skill names, paths and the scan label all come from a model or from
 * somebody's filesystem, and a 600-character one renders as eleven lines of
 * heading before any CSS gets a say. Clamped here, at the last point before the
 * markup, so it holds for runs that were stored before this rule existed.
 */
function short(s: string, n = 90): string {
  const flat = String(s).replace(/\s+/g, " ").trim();
  return flat.length <= n ? flat : `${flat.slice(0, n - 1).trimEnd()}…`;
}

/** Paths are clipped from the front: the filename is the part that identifies it. */
function shortPath(s: string, n = 72): string {
  const flat = String(s).trim();
  return flat.length <= n ? flat : `…${flat.slice(flat.length - (n - 1))}`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

const GOOGLE_SVG = `<svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-4H24v7.5h12c-.2 2-1.5 5-4.4 7l6.7 5.2C42.2 36 45 30.6 45 24z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4C29.7 36.6 27.1 37.5 24 37.5c-5.8 0-10.7-3.9-12.5-9.2l-7.1 5.5C8 41.3 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.5 28.3c-.5-1.4-.7-2.8-.7-4.3s.3-3 .7-4.3l-7.1-5.5C2.9 17.1 2 20.4 2 24s.9 6.9 2.4 9.8l7.1-5.5z"/><path fill="#EA4335" d="M24 10.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.3 29.9 2 24 2 15.4 2 8 6.7 4.4 14.2l7.1 5.5c1.8-5.3 6.7-9.2 12.5-9.2z"/></svg>`;

function findingBlock(f: Finding): string {
  const loc = f.line ? `${shortPath(f.file)}:${f.line}` : shortPath(f.file);
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
  // With a skill unaudited, "✓ nothing reported" overstates what this category knows:
  // nothing was reported by the skills that were read, and the rest were never looked at.
  const incomplete = r.audit.ran && (r.audit.failures.length > 0 || r.partial.length > 0);
  const status = c.count === 0
    ? incomplete
      ? `<span class="status">nothing reported, from what was audited</span>`
      : `<span class="status clear">✓ nothing reported</span>`
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
 * The caveats, and only the caveats.
 *
 * There is no "how this was audited" explainer on the report — the landing page
 * and the repo say how it works, and a reader looking at findings does not need
 * it restated. What cannot be dropped is the list of things this run did NOT
 * cover: an unaudited skill, a clipped file and a clean skill look identical
 * unless the page says otherwise. So this renders when there is something to
 * admit, and renders nothing at all when there is not.
 *
 * Counts are shown to everyone; which file or skill it was is detail, and detail
 * sits behind the sign-in like the findings do.
 */
/**
 * Name the limit that produced a caveat, when it was set below what this build
 * expects.
 *
 * Both limits are environment variables, and an instance configured with a
 * testing profile produces a report that is thin, quiet and entirely plausible:
 * a few findings, some files read in part, nothing obviously wrong. The counts
 * above are the honest half; this is the actionable half. Said only when the
 * setting is actually below the default, so a correctly configured report does
 * not carry a number nobody needs.
 */
function limitNote(a: ScanResult["audit"], which: "read" | "output"): string {
  const l = a.limits;
  if (!l) return "";
  if (which === "read") {
    return l.readDefault > 0 && l.readChars > 0 && l.readChars < l.readDefault
      ? ` This run was configured to read ${l.readChars.toLocaleString()} characters per skill, not the usual ${l.readDefault.toLocaleString()}.`
      : "";
  }
  return l.outputDefault > 0 && l.outputTokens > 0 && l.outputTokens < l.outputDefault
    ? ` This run was configured to let the auditor write ${l.outputTokens.toLocaleString()} tokens, not the usual ${l.outputDefault.toLocaleString()}.`
    : "";
}

function caveats(r: ScanResult, full: boolean): string {
  const a = r.audit;

  if (!a.ran) {
    return `<div class="caveat caveat-hard">
      <b>These skills were not audited.</b> The audit is a model reading every file, and none was
      available for this run. Nothing below is a result.
    </div>`;
  }

  /**
   * The count is the admission; the names are the detail. A skill with fifty
   * files that did not fit produced fifty names in one sentence — a paragraph of
   * paths nobody reads, burying the three lines above it that matter. So the list
   * is capped and says how many it did not print. The number at the front of the
   * line is never capped, because that is the part that must be honest.
   */
  const NAMES = 6;
  const named = (parts: string[]): string => {
    if (!full || !parts.length) return "";
    const head = parts.slice(0, NAMES);
    const rest = parts.length - head.length;
    return ` — ${esc(head.join("; "))}${rest ? esc(`, and ${rest} more`) : ""}`;
  };
  const lines: string[] = [];

  if (a.failures.length) {
    lines.push(`${plural(a.failures.length, "skill")} could not be audited${named(
      a.failures.map((x) => `${short(x.skill, 60)} (${short(x.reason, 80)})`),
    )}. Not counted as clear.`);
  }
  // Two different failures used to be printed as one sentence about the model's
  // output limit. They are grouped by reason now, because "raise the ceiling" and
  // "the scanner could not read the answer" are not the same instruction.
  for (const reason of [...new Set(r.partial.map((x) => x.reason ?? "the model's output limit"))]) {
    const group = r.partial.filter((x) => (x.reason ?? "the model's output limit") === reason);
    lines.push(`${plural(group.length, "audit")} came back incomplete — ${esc(short(reason, 70))}${named(
      group.map((x) => `${short(x.skill, 60)}, after ${plural(x.kept, "finding")}`),
    )}. What was written is below; the rest was not.${
      reason === "the model's output limit" ? limitNote(a, "output") : ""
    }`);
  }
  if (r.notFullyRead.length) {
    // Named worst-first: the file that lost the most characters is the one a reader
    // needs to see, not whichever file happens to sort first.
    const worst = [...r.notFullyRead].sort((a, b) => b.of - b.shown - (a.of - a.shown));
    lines.push(`${plural(r.notFullyRead.length, "file")} shown only in part${named(
      worst.map((x) => `${shortPath(x.path)} (${x.shown.toLocaleString()} of ${x.of.toLocaleString()} chars)`),
    )}. What was not shown was not audited.${limitNote(a, "read")}`);
  }
  if (r.unreadable.length) {
    lines.push(`${plural(r.unreadable.length, "file")} could not be read at all${named(
      r.unreadable.map((x) => `${shortPath(x.path)} (${short(x.reason, 60)})`),
    )}. An unreadable file is never a clear one.`);
  }

  if (!lines.length) return "";
  return `<div class="caveat">
    <span class="caveat-k">Not covered</span>
    <ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>
  </div>`;
}

function rail(r: ScanResult, full: boolean, isPublic = false, share = ""): string {
  const grants = r.findings.filter((f) => f.categoryId === "over-privilege").length;
  const meta = full
    ? `<div class="kv"><span>Skills</span><b>${r.totals.skills}</b></div>
       <div class="kv"><span>Files read</span><b>${r.totals.files}</b></div>
       <div class="kv"><span>Could not read</span><b>${r.unreadable.length}</b></div>
       <div class="kv"><span>Images &amp; other assets</span><b>${r.totals.nonText}</b></div>
       <div class="kv"><span>Permission findings</span><b>${grants}</b></div>
       <div class="kv"><span>Listing metadata</span><b>${r.library.listingChars.toLocaleString()}c</b></div>
       <div class="kv"><span>Audited by</span><b>${esc(r.audit.model)}</b></div>
       <div class="kv"><span>Claims discarded</span><b>${r.audit.dropped}</b></div>
       ${r.audit.limits && r.audit.limits.readChars > 0
         ? `<div class="kv"><span>Read per skill</span><b>${r.audit.limits.readChars.toLocaleString()}c</b></div>
            <div class="kv"><span>Auditor output cap</span><b>${r.audit.limits.outputTokens.toLocaleString()}t</b></div>`
         : ""}`
    : lockRow(r.runId, "Sign in with Google");

  return `<aside class="rail">
    <div class="rc" style="padding:0"><a class="btn btn-ghost" style="width:100%;border:0;justify-content:center;padding:17px" href="/scan">${isPublic ? "Scan your own skills" : "↻ Run new scan"}</a></div>
    ${share}
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
  /**
   * An audit that was attempted and failed is not an audit that came back clean.
   *
   * This read "Nothing reported across 8 skills. All 8 categories were audited and
   * came back empty" on a run where every single call returned 400 and nothing was
   * read at all. The "Not covered" strip said so underneath, and was outvoted by a
   * headline, five zeroes and eight green ticks. An unaudited thing reading as a
   * clean one is the single failure this report exists to prevent, so the headline
   * has to carry it too, not just the small print.
   */
  if (r.audit.reviewed === 0 && r.audit.cached === 0 && r.audit.failures.length) {
    return `<b>Not audited.</b> Every skill here failed to audit — ${esc(short(r.audit.failures[0]!.reason, 120))}. Nothing below is a result.${unread}`;
  }
  if (r.totals.findings === 0) {
    // Only a run where everything was actually read may call itself empty.
    if (r.audit.failures.length) {
      return `Nothing reported from the <b>${plural(r.audit.reviewed + r.audit.cached, "skill")}</b> that were audited, and
        <b>${plural(r.audit.failures.length, "more")}</b> could not be audited at all. That is not the same as clean.${unread}`;
    }
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
  // Sharing belongs beside what was scanned and in the rail that follows you down the
  // page — not in a panel you only meet after scrolling past every finding.
  const canShare = Boolean(opts.baseUrl) && (Boolean(opts.isOwner) || Boolean(opts.isPublic));
  const base = opts.baseUrl ?? "";

  return page({
    title: `Scan results — ${r.totals.findings} findings`,
    user,
    script: MODAL_SCRIPT,
    body: `
<div class="wrap">
  <div class="pagehead">
    <div class="ph">
      <span class="eyebrow">Scan results</span>
      <div class="titlerow">
        <h1 style="margin-top:10px">${esc(short(r.source.label, 80))}</h1>
        ${canShare ? shareButton(r.runId, base) : ""}
      </div>
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
  ${caveats(r, full)}
  ${opts.isPublic ? publicBanner(Boolean(opts.isSample)) : ""}
  <div class="cols" style="margin-top:26px">
    <div>
      ${r.categories.map((c) => categoryCard(c, r, full)).join("")}
      ${opts.isPublic ? "" : registryCta()}
    </div>
    ${rail(r, full, Boolean(opts.isPublic), canShare ? shareRail(r.runId, base) : "")}
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
