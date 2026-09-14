import { page, type User } from "../layout.ts";

const PILLARS = [
  { id: "scan", tab: "Atlan Scan", lead: "Vets what agents install",
    body: "skills, MCPs, plugins and sub-agents read line by line before they install.",
    mock: `<div class="mrow"><span class="nm">data-sync</span><span class="sp pill critical">critical</span></div>
      <div class="mrow"><span class="nm">deploy-helper</span><span class="sp pill critical">critical</span></div>
      <div class="mrow"><span class="nm">ui-design</span><span class="sp pill high">high</span></div>
      <div class="mrow"><span class="nm">changelog</span><span class="sp pill none">cleared</span></div>
      <div class="mrow"><span class="nm">pr-review</span><span class="sp pill none">cleared</span></div>
      <div class="mrow"><span class="nm faint">render.bin</span><span class="sp pill medium">unreadable</span></div>` },
  { id: "control", tab: "Atlan Control", lead: "Governs the agent fleet",
    body: "every agent found, sanctioned or shadow, held to policy on config, identity and permissions.",
    mock: `<svg class="fleet" viewBox="0 0 640 236" role="img" aria-label="One person, the agents running under their identity, and what each one can reach">
      <defs><marker id="a1" markerWidth="6" markerHeight="6" refX="5.4" refY="3" orient="auto">
        <path d="M0 0 L6 3 L0 6 z" fill="#BFC0D8"/></marker>
        <marker id="a2" markerWidth="6" markerHeight="6" refX="5.4" refY="3" orient="auto">
        <path d="M0 0 L6 3 L0 6 z" fill="#D01B49"/></marker></defs>

      <text class="ch" x="16" y="20">PERSON</text>
      <text class="ch" x="212" y="20">AGENTS RUNNING AS THEM</text>
      <text class="ch" x="486" y="20">CAN REACH</text>
      <line class="rule" x1="0" y1="30" x2="640" y2="30"/>

      <path d="M170 118 C 192 118, 192 66, 212 66" fill="none" class="w" marker-end="url(#a1)"/>
      <path d="M170 118 C 192 118, 192 118, 212 118" fill="none" class="w" marker-end="url(#a1)"/>
      <path d="M170 118 C 192 118, 192 170, 212 170" fill="none" class="w" marker-end="url(#a1)"/>
      <path d="M446 66 C 466 66, 466 62, 486 62" fill="none" class="w bad" marker-end="url(#a2)"/>
      <path d="M446 118 C 466 118, 466 114, 486 114" fill="none" class="w" marker-end="url(#a1)"/>
      <path d="M446 170 C 466 170, 466 166, 486 166" fill="none" class="w" marker-end="url(#a1)"/>

      <g><rect class="box" x="16" y="94" width="154" height="48"/>
        <text class="nm" x="32" y="116">sarah@acme.io</text><text class="sub" x="32" y="132">identity root</text></g>

      <g><rect class="box" x="212" y="44" width="234" height="44"/>
        <text class="nm" x="228" y="64">Claude Code</text><text class="sub" x="228" y="79">auto mode · high autonomy</text>
        <rect class="tag crit" x="368" y="56" width="62" height="19" rx="4"/>
        <text class="tagt crit" x="399" y="69">2 critical</text></g>

      <g><rect class="box" x="212" y="96" width="234" height="44"/>
        <text class="nm" x="228" y="116">Cursor</text><text class="sub" x="228" y="131">sanctioned · policy applied</text>
        <rect class="tag ok" x="380" y="108" width="50" height="19" rx="4"/>
        <text class="tagt ok" x="405" y="121">on policy</text></g>

      <g><rect class="box shadow" x="212" y="148" width="234" height="44"/>
        <text class="nm" x="228" y="168">unnamed agent</text><text class="sub" x="228" y="183">shadow · found this morning</text>
        <rect class="tag warn" x="374" y="160" width="56" height="19" rx="4"/>
        <text class="tagt warn" x="402" y="173">unknown</text></g>

      <g><rect class="leaf" x="486" y="44" width="138" height="36"/><text class="nm" x="500" y="66">prod database</text></g>
      <g><rect class="leaf" x="486" y="96" width="138" height="36"/><text class="nm" x="500" y="118">customer records</text></g>
      <g><rect class="leaf" x="486" y="148" width="138" height="36"/><text class="nm" x="500" y="170">source repos</text></g>
    </svg>` },
  { id: "defend", tab: "Atlan Defend", lead: "Secures every action the agent takes",
    body: "detect, respond and protect while the run is happening, not in the post-mortem.",
    mock: `<div class="flow">
      <div class="fr"><span class="t">14:18:02</span><span class="a">Read <code>~/profile.yaml</code></span><span class="p ok">allowed</span></div>
      <div class="fr"><span class="t">14:18:04</span><span class="a">Query <code>accounts</code> — 50 rows</span><span class="p ok">allowed</span></div>
      <div class="fr bad"><span class="t">14:18:09</span><span class="a">Email <code>accounts.csv</code> → personal address</span><span class="p no">blocked</span></div>
      <div class="fnote">Customer data leaving for an address outside the org. Stopped mid-run, before the send.</div>
    </div>` },
  { id: "marketplace", tab: "Atlan Marketplace", lead: "Supplies what agents install",
    body: "one trusted shelf of vetted external and certified internal add-ons, each with an owner and a version.",
    mock: `<div class="shelf">
      <div class="sc"><span class="k">skill</span><b>brainstorming</b><span class="v">v2.1 · design team</span><span class="badge ok">certified</span></div>
      <div class="sc"><span class="k">mcp</span><b>slack</b><span class="v">v3.0 · external</span><span class="badge ok">vetted</span></div>
      <div class="sc"><span class="k">plugin</span><b>skill-creator</b><span class="v">v1.4 · platform</span><span class="badge ok">certified</span></div>
      <div class="sc dim"><span class="k">skill</span><b>canvas-design</b><span class="v">v0.9 · unowned</span><span class="badge wait">in review</span></div>
    </div>` },
];

const STEPS = [
  { n: "01", h: "Point", p: "Drop a folder, or paste a public repo. Nothing is installed and nothing is run." },
  { n: "02", h: "Read", p: "45 checks over every file — and an honest list of anything that could not be read." },
  { n: "03", h: "See the line", p: "Each finding names the skill, the line, the quoted text and the fix." },
  { n: "04", h: "Re-scan", p: "Run it again after the fix, or when the skill's author ships a change." },
];

const FAQ = [
  { q: "What does it actually read?",
    a: "Every file in the folder — the SKILL.md, its frontmatter, reference files, scripts, and anything sitting beside them. 45 named checks across 8 categories." },
  { q: "Will two scans of the same folder match?",
    a: "Exactly. Pattern analysis, no model in the loop, and every check runs every time whether it fires or not. Re-scan next month and the diff is real." },
  { q: "What do I pay for?",
    a: "Nothing, for skills \u2014 every finding, every quoted line, every fix. MCP servers, plugins, sub-agents and continuous monitoring ship with Atlan Registry." },
  { q: "Why sign in to see the detail?",
    a: "So the scan is still there next week, and so re-running it means something. Counts and category results are visible before you do." },
  { q: "Can a clean report be wrong?",
    a: "Yes — and we would rather say so than sell you a tick. A payload can be encoded, fetched at run time, or parked where reviewers do not look. That is why unreadable files are reported as findings." },
  { q: "What happens to my skills afterwards?",
    a: "Nothing. Files are read in memory and dropped. What persists is the finding list, counts, a SHA-256 per skill, and the one line each finding quotes." },
];

const SCRIPT = `
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('[data-panel]').forEach(x=>x.hidden=true);
  t.classList.add('on');
  document.querySelectorAll('[data-panel="'+t.dataset.tab+'"]').forEach(x=>x.hidden=false);
}));`;

export function landingPage(user: User | null): string {
  return page({
    title: "Atlan Scan — read what is actually in the skills you install",
    user,
    script: SCRIPT,
    body: `
<div class="wrap herowrap">
  <div class="hl">
    <h1>Your agent trusts every skill you install.<br><span style="color:var(--blue)">Should you?</span></h1>
    <p class="lede">Point Atlan Scan at a folder of skills. Every finding comes back with the skill, the line, and the text that caused it.</p>
    <div class="cta">
      <a class="btn btn-primary btn-lg" href="/scan">Scan your skills</a>
      <a class="btn btn-ghost btn-lg" href="/p/sample">See a real report</a>
    </div>
  </div>
  <div class="mock" style="margin-top:0">
    <div class="bar"><i></i><i></i><i></i></div>
    <div class="in">
      <div class="mrow"><span class="nm">Prompt injection</span><span class="sp pill critical">2</span></div>
      <div class="mrow"><span class="nm">External instructions</span><span class="sp pill critical">1</span></div>
      <div class="mrow"><span class="nm">Supply chain &amp; drift</span><span class="sp pill high">5</span></div>
      <div class="mrow"><span class="nm">Over-privilege</span><span class="sp pill none">cleared</span></div>
      <div class="mrow"><span class="nm">Exfiltration paths</span><span class="sp pill critical">3</span></div>
      <div class="mrow"><span class="nm">Hidden content</span><span class="sp pill medium">4</span></div>
      <div class="mrow"><span class="nm">Metadata hygiene</span><span class="sp pill none">cleared</span></div>
      <div class="mrow"><span class="nm">Library-level</span><span class="sp pill low">2</span></div>
    </div>
  </div>
</div>

<div class="wrap"><div class="strip" style="margin-top:0">
  <div><span class="v tnum">36.8%</span><span class="k">of 3,984 popular skills carried a flaw</span><span class="s">Snyk ToxicSkills</span></div>
  <div><span class="v tnum">26.1%</span><span class="k">of 42,447 skills had a vulnerability</span><span class="s">NVIDIA</span></div>
  <div><span class="v tnum">335</span><span class="k">malicious skills in one marketplace</span><span class="s">ClawHavoc · ~300k users</span></div>
  <div><span class="v">0</span><span class="k">prompts before an <span class="mono">allowed-tools</span> command runs</span><span class="s">Reversec</span></div>
</div></div>

<section class="band" id="how"><div class="wrap">
  <div class="sectop">
    <span class="eyebrow">How it works</span>
    <h2>Four steps, about a minute.</h2>
  </div>
  <div class="steps4">
    ${STEPS.map((s) => `<div class="st4"><span class="n">${s.n}</span><h4>${s.h}</h4><p>${s.p}</p></div>`).join("")}
  </div>
</div></section>

<section class="band"><div class="wrap">
  <div class="obs">
    <span class="eyebrow">The observation</span>
    <h2>A skill is an instruction your agent follows without asking. <em>You installed it in one line, and nobody read it.</em></h2>
  </div>
</div></section>

<section class="band" id="platform"><div class="wrap">
  <div class="sectop">
    <span class="eyebrow">Atlan Registry</span>
    <h2>The full platform for everything your agents install.</h2>
    <p>Four capabilities over one inventory of every skill, MCP, plugin and sub-agent your teams run.</p>
  </div>
  <div style="margin-top:30px">
    <div class="tabs">
      ${PILLARS.map((p) => `<button class="tab${p.id === "scan" ? " on" : ""}" data-tab="${p.id}">${p.tab}</button>`).join("")}
    </div>
    ${PILLARS.map(
      (p) => `<p class="td" data-panel="${p.id}"${p.id === "scan" ? "" : " hidden"} style="margin-top:22px;max-width:48em"><b>${p.lead}</b> — ${p.body}</p>`,
    ).join("")}
    ${PILLARS.map(
      (p) => `<div class="mock" data-panel="${p.id}"${p.id === "scan" ? "" : " hidden"}><div class="bar"><i></i><i></i><i></i></div><div class="in">${p.mock}</div></div>`,
    ).join("")}
    <div class="platcta">
      <a class="btn btn-primary" href="https://atlan.com" target="_blank" rel="noreferrer">Explore Atlan Registry</a>
    </div>
  </div>
</div></section>

<section class="band"><div class="wrap">
  <div class="sectop" id="faq"><span class="eyebrow">Questions</span><h2>The ones worth asking.</h2></div>
  <div class="faq">
    ${FAQ.map((f, i) => `<details${i === 0 ? " open" : ""}><summary>${f.q}</summary><p>${f.a}</p></details>`).join("")}
  </div>
  <p class="faqfoot">Something not here? The scanner is the answer to most of it — <a href="/scan">run one</a> and see what comes back.</p>
</div></section>

<section class="band" style="border-top:0"><div class="wrap">
  <div class="finalcta">
    <span class="ctabrand"><span class="sq"></span>Atlan <em>Scan</em></span>
    <h2>You didn't read it.<br>Your agent will.</h2>
    <p>One folder, about a minute, and you'll know exactly what's in there.</p>
    <div class="ctarow">
      <a class="btn btn-primary btn-lg" href="/scan">Scan a folder</a>
      <a class="btn btn-ghost btn-lg" href="/p/sample">See a real report first</a>
    </div>
  </div>
</div></section>`,
  });
}
