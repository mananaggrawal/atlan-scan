import { CSS } from "./theme.ts";

export function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface PageOpts {
  title: string;
  description?: string;
  user: User | null;
  body: string;
  script?: string;
}

export const DISCLAIMER =
  "Atlan Scan reads what is visible in the text a skill ships. A packed, encoded or remotely fetched payload can hide from any static scanner — the SkillCloak technique (HKUST, Jul 2026) evaded all eight scanners it was tested against. We report findings and the files we could not read. We never issue a safety verdict.";

export function page(o: PageOpts): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description ?? "Read what is actually in the skills you install.")}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='22' height='22' x='2' y='2' rx='5' fill='%232026D2'/%3E%3Crect width='13' height='13' x='17' y='17' rx='3.5' fill='%2362E1FC'/%3E%3C/svg%3E">
<style>${CSS}</style>
</head><body>
<header class="top"><div class="wrap topin">
  <a class="brand" href="/"><span class="sq"></span>Atlan <em>Scan</em></a>
  <nav class="topnav">
    <a href="/scan">Scan</a>
    ${o.user ? `<a href="/history">Your scans</a><a href="/auth/signout" title="${esc(o.user.email)}">Sign out</a>` : `<a href="/auth/google?next=%2Fhistory">Sign in</a>`}
  </nav>
</div></header>
<main class="growmain">
${o.body}
</main>
<footer class="bot"><div class="wrap">
  <div class="fcols">
    <div class="fbrand">
      <a class="brand" href="/"><span class="sq"></span>Atlan <em>Scan</em></a>
      <p>Read what is actually in the skills, MCPs and plugins your agents install — before they run.</p>
    </div>
    <div>
      <h5>Product</h5>
      <ul>
        <li><a href="/scan">Scan a skill</a> <span class="flive">free</span></li>
        <li><a href="/scan">Scan an MCP</a></li>
        <li><a href="/scan">Scan a plugin</a></li>
        <li><a href="/scan">Scan a sub-agent</a></li>
      </ul>
    </div>
    <div>
      <h5>Resources</h5>
      <ul>
        <li><a href="/#how">How it works</a></li>
        <li><a href="/#platform">What gets checked</a></li>
        <li><a href="/#faq">Questions</a></li>
        <li><a href="/history">Your scans</a></li>
        <li><a href="/privacy">Privacy</a></li>
        <li><a href="/terms">Terms</a></li>
      </ul>
    </div>
  </div>
  <div class="fbot">
    <span>Atlan Scan — the free scanner in front of <a href="https://atlan.com" rel="noreferrer">Atlan</a> Agent Registry.</span>
    <span class="sp"><span class="mono">engine scan-1.0.0</span></span>
  </div>
</div></footer>
${o.script ? `<script>${o.script}</script>` : ""}
</body></html>`;
}
