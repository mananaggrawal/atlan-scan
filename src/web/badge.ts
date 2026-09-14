import type { ScanResult } from "../engine/types.ts";

/**
 * A DISCLOSURE badge, not a safety badge.
 *
 * It states what was scanned and when, and links to the findings. It must never
 * render the word "safe", a tick, or a pass/fail — a static scanner cannot earn
 * that claim (SkillCloak, Trail of Bits), and a maintainer who publishes findings
 * and fixes is more trustworthy than one who publishes a green tick.
 */
const CHAR_W = 6.2;

function width(text: string, pad = 18): number {
  return Math.round(text.length * CHAR_W + pad);
}

export function badgeSvg(r: ScanResult | null, ageDays: number | null): string {
  const left = "atlan scan";
  // The badge counts findings, not checks. There is no fixed check count any more —
  // the audit is a model reading the files — so a "3/50" badge would be inventing a
  // denominator, and an unaudited run must say so rather than render a zero.
  const right = !r
    ? "not published"
    : !r.audit.ran
      ? "not audited"
      : `${r.totals.skills} skill${r.totals.skills === 1 ? "" : "s"} · ${
          r.totals.findings === 0 ? "nothing reported" : `${r.totals.findings} finding${r.totals.findings === 1 ? "" : "s"}`
        }${ageDays !== null ? ` · ${ageDays}d` : ""}`;
  const lw = width(left, 20);
  const rw = width(right, 22);
  const w = lw + rw;
  // Colour follows the worst severity actually reported. Green never means safe here —
  // it means the auditor read the files and reported nothing, which the badge text says.
  const worst = r?.totals.bySeverity;
  const accent = !r || !r.audit.ran
    ? "#77778E"
    : worst && (worst.critical > 0 || worst.high > 0)
      ? "#D01B49"
      : worst && (worst.medium > 0 || worst.low > 0)
        ? "#B06A08"
        : "#2E8B57";
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${esc(left)}: ${esc(right)}">
  <title>${esc(left)}: ${esc(right)}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-opacity=".08"/></linearGradient>
  <clipPath id="c"><rect width="${w}" height="20" rx="3"/></clipPath>
  <g clip-path="url(#c)">
    <rect width="${lw}" height="20" fill="#1B1C24"/>
    <rect x="${lw}" width="${rw}" height="20" fill="${accent}"/>
    <rect width="${w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="11">
    <text x="${lw / 2}" y="14">${esc(left)}</text>
    <text x="${lw + rw / 2}" y="14">${esc(right)}</text>
  </g>
</svg>`;
}
