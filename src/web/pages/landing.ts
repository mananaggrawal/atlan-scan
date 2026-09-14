import { page, type User } from "../layout.ts";
import { CHECK_COUNT } from "../../engine/catalog.ts";

const PILLARS = [
  { id: "scan", tab: "Atlan Scan", lead: "Vets what agents install",
    body: "skills, MCPs, plugins and sub-agents read line by line before they install.",
    mock: `<div class="scanp">
      <div class="hd"><span>SKILL</span><span>WHAT THE SCAN FOUND</span><span class="r">RESULT</span></div>
      <div class="rw"><span class="nm">data-sync</span><span class="d">reads <code>~/.aws/credentials</code>, then posts out</span><span class="pill critical">critical</span></div>
      <div class="rw"><span class="nm">deploy-helper</span><span class="d"><code>curl | bash</code> in the setup steps</span><span class="pill critical">critical</span></div>
      <div class="rw"><span class="nm">ui-design</span><span class="d">instruction hidden in an HTML comment</span><span class="pill high">high</span></div>
      <div class="rw"><span class="nm">invoice-parse</span><span class="d">competes with <code>invoice-extract</code> for the same prompts</span><span class="pill low">low</span></div>
      <div class="rw"><span class="nm">changelog</span><span class="d faint">nothing flagged across ${CHECK_COUNT} checks</span><span class="pill none">cleared</span></div>
      <div class="rw"><span class="nm faint">render.bin</span><span class="d faint">binary — we could not read it</span><span class="pill medium">unreadable</span></div>
    </div>` },
  { id: "control", tab: "Atlan Control", lead: "Governs the agent fleet",
    body: "every agent found, sanctioned or shadow, held to one policy.",
    mock: `<div class="scanp ctl">
      <div class="hd"><span>AGENT</span><span>IDENTITY, SCOPE AND POLICY</span><span class="r">STATUS</span></div>
      <div class="rw"><span class="nm">Claude Code</span><span class="d">runs as <code>sarah@acme.io</code>, auto mode, reaches prod</span><span class="pill critical">off policy</span></div>
      <div class="rw"><span class="nm">Cursor</span><span class="d">sanctioned, policy applied across 12 seats</span><span class="pill none">on policy</span></div>
      <div class="rw"><span class="nm">unnamed agent</span><span class="d">shadow — found on a laptop this morning</span><span class="pill medium">unknown</span></div>
      <div class="rw"><span class="nm">n8n workflow</span><span class="d">service account, no human owner</span><span class="pill high">no owner</span></div>
      <div class="rw"><span class="nm">Copilot</span><span class="d faint">read-only scope, no write tools</span><span class="pill none">on policy</span></div>
    </div>` },
  { id: "defend", tab: "Atlan Defend", lead: "Secures every action the agent takes",
    body: "detect, respond and protect while the run happens, not in the post-mortem.",
    mock: `<div class="flow">
      <div class="fhd"><span>TIME</span><span class="g">ACTION THE AGENT TOOK</span><span>RESULT</span></div>
      <div class="fr"><span class="t">14:18:02</span><span class="a">Read <code>~/profile.yaml</code></span><span class="p ok">allowed</span></div>
      <div class="fr"><span class="t">14:18:04</span><span class="a">Query <code>accounts</code> — 50 rows</span><span class="p ok">allowed</span></div>
      <div class="fr bad"><span class="t">14:18:09</span><span class="a">Email <code>accounts.csv</code> → personal address</span><span class="p no">blocked</span></div>
      <div class="fnote">Customer data leaving for an address outside the org. Stopped mid-run, before the send.</div>
    </div>` },
  { id: "marketplace", tab: "Atlan Marketplace", lead: "Supplies what agents install",
    body: "one trusted shelf of vetted add-ons, each with an owner and a version.",
    mock: `<div class="shelf">
      <div class="sc"><span class="k">skill</span><b>brainstorming</b><span class="v">v2.1 · design team</span><span class="badge ok">certified</span></div>
      <div class="sc"><span class="k">mcp</span><b>slack</b><span class="v">v3.0 · external</span><span class="badge ok">vetted</span></div>
      <div class="sc"><span class="k">plugin</span><b>skill-creator</b><span class="v">v1.4 · platform</span><span class="badge ok">certified</span></div>
      <div class="sc dim"><span class="k">skill</span><b>canvas-design</b><span class="v">v0.9 · unowned</span><span class="badge wait">in review</span></div>
    </div>` },
];

const STEPS = [
  { n: "01", h: "Point", p: "Drop a folder, or paste a public repo. Nothing is installed and nothing is run." },
  { n: "02", h: "Read", p: `${CHECK_COUNT} checks over every file — and an honest list of anything that could not be read.` },
  { n: "03", h: "See the line", p: "Each finding names the skill, the line, the quoted text and the fix." },
  { n: "04", h: "Re-scan", p: "Run it again after the fix, or when the skill's author ships a change." },
];

const FAQ = [
  { q: "What does it actually read?",
    a: `Every file in the folder — the SKILL.md, its frontmatter, reference files, scripts, and anything sitting beside them. ${CHECK_COUNT} named checks across 8 categories.` },
  { q: "Will two scans of the same folder match?",
    a: "Exactly. Pattern analysis, no model in the loop, and every check runs whether it fires or not. Re-scan next month and the diff is real." },
  { q: "What do I pay for?",
    a: "Nothing, for skills \u2014 every finding, every quoted line, every fix. MCPs, plugins, sub-agents and continuous monitoring ship with Atlan Registry." },
  { q: "Why sign in to see the detail?",
    a: "So the scan is still there next week, and so re-running it means something. Counts and category results are visible before you do." },
  { q: "Can a clean report be wrong?",
    a: "Yes. A payload can be encoded, fetched at run time, or parked where reviewers do not look — which is why unreadable files are reported as findings." },
  { q: "What happens to my skills afterwards?",
    a: "Nothing. Files are read in memory and dropped. What persists is the finding list, counts, a SHA-256 per skill, and each quoted line." },
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
  <div class="sectop w">
    <span class="eyebrow">Atlan Registry</span>
    <h2>The full platform for everything your agents install.</h2>
    <p class="wide">Four capabilities over one inventory of every skill, MCP, plugin and sub-agent.</p>
  </div>
  <div style="margin-top:30px">
    <div class="tabs">
      ${PILLARS.map((p) => `<button class="tab${p.id === "scan" ? " on" : ""}" data-tab="${p.id}">${p.tab}</button>`).join("")}
    </div>
    ${PILLARS.map(
      (p) => `<p class="td" data-panel="${p.id}"${p.id === "scan" ? "" : " hidden"} style="margin-top:22px;max-width:66em"><b>${p.lead}</b> — ${p.body}</p>`,
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
