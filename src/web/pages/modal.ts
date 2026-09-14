/** Not a paywall — a queue. These scan types are not built yet; this counts who wants which. */
export function enterpriseModal(): string {
  return `<div class="mask" id="mask">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle">
    <button class="x" id="mx" aria-label="Close">×</button>
    <div class="lk">⏳</div>
    <h3 id="mtitle">Not built yet</h3>
    <p id="mbody">MCP, plugin and sub-agent scanning are not live yet. Tell us which one you want and we will build it next — we are counting.</p>
    <form method="POST" action="/api/interest">
      <input type="hidden" name="feature" id="mfeature" value="">
      <input type="text" name="first" placeholder="First name" required>
      <input type="text" name="last" placeholder="Last name" required>
      <input type="email" name="email" placeholder="Work email" required>
      <textarea name="note" id="mnote" rows="2" placeholder="What would you want it to catch? (optional)"></textarea>
      <label class="ck"><input type="checkbox" name="consent" required style="width:auto;margin:3px 0 0">
        Email me when it ships.</label>
      <button class="sub2" type="submit">Submit</button>
    </form>
    <p class="fine">One email when it ships. Nothing else.</p>
  </div>
</div>`;
}

export const MODAL_SCRIPT = `
const COPY={
  'mcp':['MCP scanning is not built yet','Server config, tool definitions and credential handling. Tell us you want it and it moves up the queue.'],
  'plugin':['Plugin scanning is not built yet','Every bundled skill, command and hook read together. Tell us you want it and it moves up the queue.'],
  'sub-agent':['Sub-agent scanning is not built yet','Agent definitions and the tools they are granted. Tell us you want it and it moves up the queue.'],
  'more':['Not built yet','Continuous re-scanning, your whole team\\'s library in one inventory, and a policy gate on install. Tell us what you would use.']
};
function openModal(kind){
  const m=document.getElementById('mask'); if(!m) return;
  document.getElementById('mfeature').value=kind||'';
  const c=COPY[kind];
  if(c){ document.getElementById('mtitle').textContent=c[0];
         document.getElementById('mbody').textContent=c[1];
         const n=document.getElementById('mnote');
         if(n) n.placeholder=(kind&&kind!=='more'?'What would you want it to catch? (optional)':'What would you use it for? (optional)'); }
  m.classList.add('on');
}
function closeModal(){ document.getElementById('mask').classList.remove('on'); }
document.addEventListener('click',e=>{
  if(e.target.id==='mx'||e.target.id==='mask') closeModal();
  const t=e.target.closest('[data-lock]');
  if(t){ e.preventDefault(); openModal(t.dataset.lock); }
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModal(); });
async function copyText(t){
  try{ await navigator.clipboard.writeText(t); return true; }
  catch{}
  const ta=document.createElement('textarea');
  ta.value=t; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select();
  let ok=false; try{ ok=document.execCommand('copy'); }catch{}
  ta.remove(); return ok;
}
function flash(b,msg){
  if(b.dataset.busy) return;
  const was=b.innerHTML; b.dataset.busy='1'; b.classList.add('ok'); b.innerHTML=msg;
  setTimeout(()=>{ b.innerHTML=was; b.classList.remove('ok'); delete b.dataset.busy; },1600);
}
/* One share action, wherever it sits: the phone's own share sheet if there is one,
   the clipboard everywhere else. */
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-share]'); if(!b) return;
  const url=b.dataset.share;
  if(navigator.share){
    try{ await navigator.share({title:document.title,url}); return; }
    catch(err){ if(err&&err.name==='AbortError') return; }
  }
  flash(b, await copyText(url) ? 'Link copied' : 'Press \u2318C to copy');
});
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-copy]'); if(!b) return;
  const el=document.getElementById(b.dataset.copy); if(!el) return;
  const ok=await copyText(el.textContent.trim());
  if(!ok){ const r=document.createRange(); r.selectNodeContents(el);
           const s=getSelection(); s.removeAllRanges(); s.addRange(r); }
  flash(b, ok?'Copied':'Select it');
});
`;
