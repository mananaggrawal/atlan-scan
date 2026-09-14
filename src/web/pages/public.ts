import { esc } from "../layout.ts";

/**
 * No publish step: a report is shareable the moment it exists, at an unguessable id.
 * The panel just hands over the two things worth copying — the link and the badge.
 */
export function sharePanel(runId: string, base: string): string {
  const url = `${base}/p/${runId}`;
  const md = `[![Atlan Scan](${base}/badge/${runId}.svg)](${url})`;
  // GitHub fetches README images through its own proxy, which cannot reach a private
  // host and refuses plain http. Saying so beats letting someone paste a broken badge.
  const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0|\.local(?::|$)/i.test(base);
  const isHttp = base.startsWith("http://");
  const warning = isLocal
    ? `This link points at <span class="mono">${esc(base)}</span>, which only exists on this machine — the badge will show as a broken image in a README. Deploy Atlan Scan and set <span class="mono">BASE_URL</span> to its public address, then copy it again.`
    : isHttp
      ? `GitHub loads README images over HTTPS only. Serve Atlan Scan over HTTPS and set <span class="mono">BASE_URL</span> accordingly, or the badge will not render.`
      : "";

  return `<div class="card sharecard" id="share">
    <h3>Share this report</h3>
    <p class="muted">Anyone with the link can read it — there is nothing else to switch on. The badge states what was scanned and when, never that anything is safe.</p>

    <span class="sharelbl">Link</span>
    <div class="snip">
      <code id="share-url">${esc(url)}</code>
      <button class="btn btn-ghost snipbtn" type="button" data-copy="share-url">Copy</button>
    </div>

    <span class="sharelbl">Badge for your README</span>
    <div class="snip">
      <code id="badge-md">${esc(md)}</code>
      <button class="btn btn-ghost snipbtn" type="button" data-copy="badge-md">Copy</button>
    </div>
    <p class="muted" style="font-size:13px;margin-top:12px">Renders as
      <img src="/badge/${esc(runId)}.svg" alt="Atlan Scan badge" style="vertical-align:-4px;margin-left:6px"></p>
    ${warning ? `<p class="badgewarn">${warning}</p>` : ""}
  </div>`;
}

export function publicBanner(isSample = false): string {
  const text = isSample
    ? `An example report — every finding below is real output.`
    : `A report is only true for the moment it ran. Skills change.`;
  const cta = "Scan your own skills";
  return `<div class="card" style="padding:18px 22px;margin:22px 0 0;border-color:var(--blue-line);background:var(--blue-soft)">
    <p style="font-size:14.5px;color:var(--ink);line-height:1.55">${text}
    <a href="/scan" style="font-weight:500">${cta} →</a></p>
  </div>`;
}
