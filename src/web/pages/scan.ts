import { page, type User } from "../layout.ts";
import { enterpriseModal, MODAL_SCRIPT } from "./modal.ts";

const SCRIPT = String.raw`
const MAX_FILES=600, MAX_TOTAL=25*1024*1024, MAX_FILE=2*1024*1024;
const SKIP=/(^|\/)(node_modules|\.git|\.venv|venv|__pycache__|\.next|\.cache|dist|build|target)\//;
const $=(s)=>document.querySelector(s);
const drop=$('#drop'), picker=$('#picker'), filepicker=$('#filepicker'), status=$('#status'), err=$('#err');
let busy=false;

function fail(msg){ err.textContent=msg; err.style.display='block'; setBusy(false); }
function setBusy(b,label){ busy=b;
  document.querySelectorAll('button,.btn').forEach(x=>{x.disabled=b});
  status.innerHTML = b ? '<span class="spin"></span> '+(label||'Reading files…') : '';
}
function b64(buf){ let s='',a=new Uint8Array(buf);
  for(let i=0;i<a.length;i+=0x8000) s+=String.fromCharCode.apply(null,a.subarray(i,i+0x8000));
  return btoa(s); }

async function collect(fileList){
  const out=[]; let total=0;
  for(const f of fileList){
    const path=(f.webkitRelativePath||f.relPath||f.name).replace(/^\.\//,'');
    if(SKIP.test('/'+path)||f.size>MAX_FILE) continue;
    if(out.length>=MAX_FILES||total+f.size>MAX_TOTAL) break;
    total+=f.size;
    out.push({path, data:b64(await f.arrayBuffer())});
  }
  return out;
}
async function walk(entry, prefix, acc){
  if(acc.length>MAX_FILES) return;
  if(entry.isFile){ await new Promise(res=>entry.file(f=>{ f.relPath=prefix+entry.name; acc.push(f); res(); }, res)); }
  else if(entry.isDirectory){
    if(SKIP.test('/'+prefix+entry.name+'/')) return;
    const reader=entry.createReader(); let batch;
    do{ batch=await new Promise(res=>reader.readEntries(res,()=>res([])));
        for(const e of batch) await walk(e, prefix+entry.name+'/', acc);
    } while(batch.length);
  }
}
async function send(payload,label){
  setBusy(true,label); err.style.display='none';
  try{
    const r=await fetch('/api/scan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const j=await r.json();
    if(!r.ok||j.error) return fail(j.error||'Scan failed.');
    location.href='/r/'+j.runId;
  }catch(e){ fail('Could not reach the scanner. '+e.message); }
}
async function scanFiles(list){
  const files=await collect(list);
  if(!files.length) return fail('No readable files in that folder.');
  if(!files.some(f=>/(^|\/)SKILL\.md$/i.test(f.path)))
    return fail('No SKILL.md in that selection. Pick a SKILL.md file, the folder that contains one, or a directory of skills.');
  await send({files},'Scanning '+files.length+' files…');
}

document.querySelectorAll('.pk').forEach(el=>el.addEventListener('click',()=>{
  if(el.classList.contains('off')) return openModal(el.dataset.kind);
  document.querySelectorAll('.pk').forEach(x=>x.classList.remove('on'));
  el.classList.add('on');
}));
$('#go').addEventListener('click',()=>{
  $('#step1').hidden=true; $('#step2').hidden=false;
  $('#stepn').textContent='2';
  $('#subline').textContent='Point it at the skills you want read';
  window.scrollTo({top:0,behavior:'smooth'});
});
picker.addEventListener('change',e=>{ if(!busy&&e.target.files.length) scanFiles(e.target.files); });
filepicker.addEventListener('change',e=>{ if(!busy&&e.target.files.length) scanFiles(e.target.files); });
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('hot')}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('hot')}));
drop.addEventListener('drop',async e=>{
  if(busy) return;
  const items=[...e.dataTransfer.items].map(i=>i.webkitGetAsEntry&&i.webkitGetAsEntry()).filter(Boolean);
  if(items.length){ const acc=[]; setBusy(true,'Reading folder…'); for(const it of items) await walk(it,'',acc); return scanFiles(acc); }
  scanFiles(e.dataTransfer.files);
});
$('#repoform').addEventListener('submit',e=>{
  e.preventDefault();
  const v=$('#repo').value.trim();
  if(v) send({repo:v},'Fetching '+v+'…');
});
` + MODAL_SCRIPT;

const TYPES = [
  { kind: "skill", icon: "⚒", t: "Skill", d: "SKILL.md and everything beside it", on: true },
  { kind: "mcp", icon: "⌘", t: "MCP", d: "Server config, tools, credentials", on: false },
  { kind: "plugin", icon: "⧉", t: "Plugin", d: "Bundled skills, commands, hooks", on: false },
  { kind: "sub-agent", icon: "◑", t: "Sub-agent", d: "Agent definitions and tool grants", on: false },
];

export function scanPage(user: User | null, lastRunId: string | null): string {
  return page({
    title: "Scan your AI add-ons — Atlan Scan",
    user,
    script: SCRIPT,
    body: `
<div class="wrap" style="padding-bottom:40px">
  <div class="scanhead">
    <div class="ph">
      <span class="eyebrow">Step <span id="stepn">1</span> of 2</span>
      <h1>Scan your <i>AI add-ons</i></h1>
      <p class="sub" id="subline">Choose the type of AI add-on you would like to scan</p>
    </div>
    ${lastRunId ? `<a class="btn btn-ghost" href="/r/${lastRunId}">View your last scan</a>` : ""}
  </div>

  <div id="step1">
    <div class="pick">
      ${TYPES.map(
        (t) => `<div class="pk ${t.on ? "on" : "off"}" data-kind="${t.kind}">
          <span class="dot"></span>
          <span class="ic">${t.icon}</span>
          <span class="t">${t.t}</span>
          <span class="d">${t.d}</span>
          ${t.on ? `<span class="tagfree">Free</span>` : `<span class="tagent">Not built yet</span>`}
        </div>`,
      ).join("")}
    </div>
    <button class="btn btn-primary wide" id="go">Continue to scan</button>
  </div>

  <div id="step2" hidden>
    <div class="drop" id="drop">
      <div class="dropic">⇪</div>
      <h3>Drop a folder, or a single SKILL.md</h3>
      <p class="muted" style="font-size:14.5px;margin-top:7px">One skill, or your whole library — up to 600 files.</p>
      <div class="pickrow">
        <label class="btn btn-primary" style="cursor:pointer">Choose a folder
          <input type="file" id="picker" webkitdirectory directory multiple hidden>
        </label>
        <label class="btn btn-ghost" style="cursor:pointer">Choose files
          <input type="file" id="filepicker" multiple accept=".md,.txt,.json,.yaml,.yml,.js,.ts,.py,.sh" hidden>
        </label>
      </div>
      <div id="status" class="muted mono" style="font-size:12.5px;margin-top:18px;min-height:18px"></div>
    </div>
    <div class="or">or scan a public repo</div>
    <form id="repoform" class="field" autocomplete="off">
      <input type="text" id="repo" name="repo" placeholder="github.com/owner/repo" aria-label="Public GitHub repository">
      <button class="btn btn-blue" type="submit">Scan repo</button>
    </form>
    <div id="err" class="err" style="display:none"></div>
    <p class="undernote">Your files are read, scored and dropped. We keep the findings, never the files.</p>
  </div>
</div>
${enterpriseModal()}`,
  });
}
