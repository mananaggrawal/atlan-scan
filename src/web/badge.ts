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
  const flagged = r
    ? r.categories.reduce((n, c) => n + c.checks.filter((k) => k.count > 0).length, 0)
    : 0;
  const total = r ? r.categories.reduce((n, c) => n + c.checks.length, 0) : 45;
  const right = r
    ? `${r.totals.skills} skill${r.totals.skills === 1 ? "" : "s"} · ${flagged}/${total} flagged${ageDays !== null ? ` · ${ageDays}d` : ""}`
    : "not published";
  const lw = width(left, 20);
  const rw = width(right, 22);
  const w = lw + rw;
  const accent = !r ? "#77778E" : flagged === 0 ? "#2E8B57" : flagged > total * 0.25 ? "#D01B49" : "#B06A08";
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
