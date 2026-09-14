/** The locked-feature capture, in the shape the category has taught people to expect. */
export function enterpriseModal(): string {
  return `<div class="mask" id="mask">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle">
    <button class="x" id="mx" aria-label="Close">×</button>
    <div class="lk">🔒</div>
    <h3 id="mtitle">This is a Registry feature</h3>
    <p id="mbody">MCP, plugin and sub-agent scanning ship with Atlan Registry. Tell us where to send it.</p>
    <form method="POST" action="/api/interest">
      <input type="hidden" name="feature" id="mfeature" value="">
      <input type="text" name="first" placeholder="First name" required>
      <input type="text" name="last" placeholder="Last name" required>
      <input type="email" name="email" placeholder="Work email" required>
      <label class="ck"><input type="checkbox" name="consent" required style="width:auto;margin:3px 0 0">
        I'd like to hear about Atlan Registry.</label>
      <button class="sub2" type="submit">Submit</button>
    </form>
    <p class="fine">One email when it ships. Nothing else.</p>
  </div>
</div>`;
}

export const MODAL_SCRIPT = `
const COPY={
  'mcp':'MCP scanning — server config, tool definitions and credential handling — ships with Atlan Registry.',
  'plugin':'Plugin scanning — every bundled skill, command and hook read together — ships with Atlan Registry.',
  'sub-agent':'Sub-agent scanning — definitions and the tools they are granted — ships with Atlan Registry.',
  'more':'Continuous re-scanning, your whole team\\'s skills in one inventory, and a policy gate on install.'
};
function openModal(kind){
  const m=document.getElementById('mask'); if(!m) return;
  document.getElementById('mfeature').value=kind||'';
  if(COPY[kind]) document.getElementById('mbody').textContent=COPY[kind];
  m.classList.add('on');
}
function closeModal(){ document.getElementById('mask').classList.remove('on'); }
document.addEventListener('click',e=>{
  if(e.target.id==='mx'||e.target.id==='mask') closeModal();
  const t=e.target.closest('[data-lock]');
  if(t){ e.preventDefault(); openModal(t.dataset.lock); }
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModal(); });
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-copy]'); if(!b) return;
  const el=document.getElementById(b.dataset.copy); if(!el) return;
  try{ await navigator.clipboard.writeText(el.textContent.trim()); }
  catch{ const r=document.createRange(); r.selectNodeContents(el);
         const s=getSelection(); s.removeAllRanges(); s.addRange(r); }
  const was=b.textContent; b.textContent='Copied'; setTimeout(()=>{b.textContent=was;},1400);
});
`;
