import { page, type User } from "../layout.ts";

/**
 * What we keep and what we do not, written plainly enough that a reader can hold
 * us to it. The wording matches the invariant at the top of src/engine/types.ts
 * and the promise on the landing page; if one changes, all three change.
 */
const UPDATED = "14 September 2026";

function legal(user: User | null, title: string, lede: string, body: string): string {
  return page({
    title: `${title} — Atlan Scan`,
    user,
    body: `
<div class="wrap">
  <div class="sectop" style="padding-top:56px">
    <span class="eyebrow">${title === "Privacy" ? "Privacy" : "Terms"}</span>
    <h2>${title === "Privacy" ? "What we keep, and what we do not." : "Terms of use."}</h2>
    <p>${lede}</p>
  </div>
  <div class="legal">${body}</div>
  <p class="legalfoot">Last updated ${UPDATED}. Questions: <a href="mailto:manan190303@gmail.com">manan190303@gmail.com</a></p>
</div>`,
  });
}

export function privacyPage(user: User | null): string {
  return legal(
    user,
    "Privacy",
    "Atlan Scan reads skills you point it at and reports what is in them. This is everything it does with what it reads.",
    `
<h3>Skill files are never stored</h3>
<p>Files are read in memory and dropped when the scan finishes. The contents of your
skills are not written to disk, not logged, and not used to train anything.</p>

<h3>How long a report lasts</h3>
<p><b>This instance runs on free hosting with no disk, so a report lasts until the
server next restarts — often minutes, sometimes hours, never days.</b> A restart
happens on every deploy and whenever the instance idles, and when it does, every
report link stops working and your scan history empties. Treat a report as
something to read now, not somewhere to keep a record. Run the scan again and you
get a fresh one.</p>
<p>We would rather say this plainly than let you find out from a dead link. A
scanner that overstates what it can do is not worth pointing at your skills.</p>

<h3>What a scan keeps while it exists</h3>
<p>Four things, so a report you come back to inside that window still reads
properly:</p>
<ul>
  <li>the list of findings — the check that fired, its category and severity</li>
  <li>counts: skills, files read, files that could not be read</li>
  <li>a SHA-256 for each skill, which identifies the bytes without revealing them</li>
  <li>the single line each finding quotes, because a finding without its evidence is
      worth nothing</li>
</ul>
<p>That last one is the only text from your files that persists, and only where a
check actually fired.</p>

<h3>If you sign in</h3>
<p>Signing in with Google gives us your email address, name and Google account id, so
that scans you ran are still yours next week. That is the entire scope requested — no
access to your Drive, mail, contacts or anything else in your account. Sign-in is
optional; scanning is not gated on it.</p>

<h3>The semantic review</h3>
<p>When the semantic review is enabled, the text of a skill is sent to Anthropic's
API to be read by a model, and the findings come back. It is sent as data to be
audited, it is not used for training, and the model's answer is checked against your
file before anything is shown. Only the findings are kept, under the rules above.</p>

<h3>What we do not do</h3>
<ul>
  <li>No advertising, no trackers, no analytics scripts, no third-party pixels.</li>
  <li>Your scans are not shared with anyone unless you publish a report yourself.</li>
  <li>Nothing is sold, and there is nobody to sell it to.</li>
</ul>

<h3>Deleting things</h3>
<p>Scans are gone at the next restart, which is the shortest retention there is. The
code carries a ninety-day expiry as well, for an instance with a disk under it; on
this one the restart always comes first. To remove an account, email the address
below and it will be deleted.</p>`,
  );
}

export function termsPage(user: User | null): string {
  return legal(
    user,
    "Terms",
    "Short, because there is not much to agree to.",
    `
<h3>What this is</h3>
<p>A free tool that reads skill files and reports what is visible in their text. You
may use it on skills you have the right to read.</p>

<h3>What it is not</h3>
<p>It is not a safety verdict. Atlan Scan never says a skill is safe, clean or
approved, and you should not read a quiet report as one. A payload can be encoded,
fetched at run time, or parked in a file nobody opens — published research shows
scanners miss those most of the time. Files that could not be read are reported as
findings for exactly this reason.</p>
<p>The findings are information to help you make your own decision about installing
something. They are provided as is, with no warranty, and we are not liable for what
you install.</p>

<h3>Fair use</h3>
<p>Do not automate it at a volume that degrades it for other people, and do not use it
to attack anyone. We may rate-limit or block use that does.</p>

<h3>Changes</h3>
<p>If these terms change materially, the date below changes with them.</p>`,
  );
}
