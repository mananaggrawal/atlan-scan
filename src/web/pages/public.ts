import { esc } from "../layout.ts";

/** GitHub proxies README images: a private host or plain http renders as a broken badge. */
function badgeWarning(base: string): string {
  const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0|\.local(?::|$)/i.test(base);
  if (isLocal) {
    return `This link points at <span class="mono">${esc(base)}</span>, which only exists on this machine — the badge will show as a broken image in a README. Deploy Atlan Scan and set <span class="mono">BASE_URL</span> to its public address, then copy it again.`;
  }
  if (base.startsWith("http://")) {
    return `GitHub loads README images over HTTPS only. Serve Atlan Scan over HTTPS and set <span class="mono">BASE_URL</span> accordingly, or the badge will not render.`;
  }
  return "";
}

export function shareUrl(runId: string, base: string): string {
  return `${base}/p/${runId}`;
}

/**
 * No publish step: a report is shareable the moment it exists, at an unguessable id.
 *
 * This sits in the rail, beside "run new scan" and the metadata, because sharing is
 * something you do to a report rather than something you read at the end of one —
 * it should be in reach from the top of the page and stay in reach while you scroll.
 */
export function shareRail(runId: string, base: string): string {
  const url = shareUrl(runId, base);
  const md = `[![Atlan Scan](${base}/badge/${runId}.svg)](${url})`;
  const warning = badgeWarning(base);

  return `<div class="rc sharerc" id="share">
    <h4>Share this report</h4>
    <p>Anyone with the link can read it. Nothing to switch on.</p>

    <button class="btn btn-primary sharemain" type="button" data-share="${esc(url)}">Copy link</button>

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
    <p style="margin-top:10px"><img src="/badge/${esc(runId)}.svg" alt="Atlan Scan badge" style="vertical-align:-4px"></p>
    ${warning ? `<p class="badgewarn">${warning}</p>` : ""}
  </div>`;
}

/** The same action, at the top of the report, next to what was scanned. */
export function shareButton(runId: string, base: string): string {
  return `<button class="btn btn-ghost headshare" type="button" data-share="${esc(shareUrl(runId, base))}">
    <span class="shareic" aria-hidden="true">⇗</span>Share report</button>`;
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
