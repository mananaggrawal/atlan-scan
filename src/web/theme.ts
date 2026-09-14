/** Atlan design tokens, carried over from the decision deck so Scan matches everything else. */
export const CSS = String.raw`
:root{
  --page:#F9F9FC; --surface:#FFFFFF; --surface-2:#F2F2F7;
  --ink:#3E4C59; --ink-strong:#1B1C24; --muted:#77778E; --faint:#A3A3B8;
  --blue:#2026D2; --blue-soft:#EDEEFD; --blue-line:#B9BBEC;
  --cyan:#62E1FC; --pink:#F34D77; --pink-soft:#FDEDF1;
  --line:#DDDDE3; --line-soft:#E9E9F0;
  --crit:#D01B49; --crit-bg:#FDEDF1; --high:#B06A08; --high-bg:#FBF0E4;
  --med:#8A7413; --med-bg:#F8F4E4; --low:#5A6270; --low-bg:#F1F2F5;
  --info:#77778E; --info-bg:#F2F2F7; --clear:#2E8B57;
  --display:"Funnel Display",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --body:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
}
*,*::before,*::after{box-sizing:border-box}
[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--page);color:var(--ink);font-family:var(--body);font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased}
a{color:var(--blue);text-decoration:none}
a:hover{text-decoration:underline}
h1,h2,h3,h4{font-family:var(--display);color:var(--ink-strong);letter-spacing:-.028em;margin:0;font-weight:600;text-wrap:balance}
h1{font-size:clamp(33px,4.5vw,53px);line-height:1.05;letter-spacing:-.034em}
h2{font-size:clamp(24px,3vw,32px);line-height:1.12}
h3{font-size:19px;line-height:1.25;letter-spacing:-.018em}
p{margin:0}
.mono{font-family:var(--mono)}
.wrap{width:min(1120px,calc(100% - 40px));margin:0 auto}
.narrow{width:min(760px,calc(100% - 40px));margin:0 auto}

/* header */
header.top{border-bottom:1px solid var(--line);background:rgba(249,249,252,.92);backdrop-filter:blur(8px);position:sticky;top:0;z-index:20}
.topin{display:flex;align-items:center;gap:20px;height:60px}
.brand{font-family:var(--display);font-weight:600;font-size:19px;letter-spacing:-.03em;color:var(--ink-strong);display:flex;align-items:center;gap:7px;word-spacing:-3.5px}
.brand:hover{text-decoration:none}
.brand .sq{width:15px;height:15px;border-radius:3px;background:var(--blue);position:relative;display:inline-block}
.brand .sq::after{content:"";position:absolute;right:-4px;bottom:-4px;width:9px;height:9px;border-radius:2px;background:var(--cyan)}
.brand em{font-style:normal;color:var(--blue)}
.topnav{margin-left:auto;display:flex;align-items:center;gap:18px;font-size:13.5px}
.topnav a{color:var(--muted)}
.topnav a:hover{color:var(--ink-strong);text-decoration:none}

/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:var(--body);font-weight:500;font-size:14.5px;padding:11px 20px;border-radius:7px;border:1px solid transparent;cursor:pointer;transition:.15s;text-decoration:none;white-space:nowrap}
.btn:hover{text-decoration:none}
.btn-primary{background:var(--ink-strong);color:#fff}
.btn-primary:hover{background:#000}
.btn-blue{background:var(--blue);color:#fff}
.btn-blue:hover{background:#171CA8}
.btn-ghost{background:var(--surface);color:var(--ink-strong);border-color:var(--line)}
.btn-ghost:hover{border-color:#C2C2D0}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn-lg{font-size:16px;padding:14px 26px}

.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--faint)}
.scanhead .eyebrow,.pagehead .eyebrow{display:block;padding-top:14px;position:relative}
.scanhead .eyebrow::before,.pagehead .eyebrow::before{content:"";position:absolute;top:0;left:0;width:34px;height:2px;background:var(--blue)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:11px}
.muted{color:var(--muted)}
.faint{color:var(--faint)}
.tnum{font-variant-numeric:tabular-nums}

/* landing */
.hero{padding:74px 0 60px}
.hero .lede{font-size:19px;line-height:1.5;color:var(--ink);max-width:36em;margin-top:20px}
.hero .cta{display:flex;gap:12px;margin-top:32px;flex-wrap:wrap}
.hero mark{background:linear-gradient(transparent 62%,var(--cyan) 62%);color:inherit;padding:0 .06em}
.strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:11px;overflow:hidden;margin-top:52px}
.strip>div{background:var(--surface);padding:22px 22px 20px;display:flex;flex-direction:column}
.strip .v{font-family:var(--display);font-size:29px;font-weight:600;color:var(--ink-strong);letter-spacing:-.03em;display:block;line-height:1.1}
.strip .k{font-size:12.5px;color:var(--muted);display:block;margin-top:8px;line-height:1.45;max-width:20em}
.strip .s{font-family:var(--mono);font-size:10.5px;color:var(--faint);display:block;margin-top:auto;padding-top:14px}
section.band{padding:64px 0}
.cats{display:grid;grid-template-columns:repeat(auto-fit,minmax(268px,1fr));gap:14px;margin-top:30px}
.cat{padding:19px 20px}
.cat .n{font-family:var(--mono);font-size:10.5px;letter-spacing:.13em;color:var(--blue)}
.cat h3{margin:9px 0 7px;font-size:16.5px}
.cat p{font-size:13.5px;color:var(--muted);line-height:1.5}
.honest{background:var(--blue-soft);border:1px dashed var(--blue-line);border-radius:11px;padding:26px 28px;margin-top:30px}
.honest h3{color:var(--blue)}
.honest p{font-size:14.5px;color:var(--ink);margin-top:10px;max-width:60em}

/* scan page */
.types{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:12px;margin:26px 0}
.type{position:relative;padding:18px 18px 16px;cursor:pointer;display:block;background:var(--surface);border:1px solid var(--line);border-radius:11px;transition:.15s}
.type.on{border-color:var(--ink-strong);box-shadow:0 0 0 1px var(--ink-strong)}
.type.locked{background:var(--surface-2);cursor:default;border-style:dashed}
.type .t{font-family:var(--display);font-weight:600;font-size:17px;color:var(--ink-strong)}
.type .d{font-size:12px;color:var(--muted);margin-top:5px}
.type .tag{position:absolute;top:12px;right:12px;font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--blue);background:var(--blue-soft);border-radius:4px;padding:3px 7px}
.drop{border:1.5px dashed var(--line);border-radius:11px;background:var(--surface);padding:40px 28px;text-align:center;transition:.15s}
.drop.hot{border-color:var(--blue);background:var(--blue-soft)}
.drop h3{margin-bottom:6px}
.or{display:flex;align-items:center;gap:14px;color:var(--faint);font-family:var(--mono);font-size:11px;letter-spacing:.16em;margin:20px 0}
.or::before,.or::after{content:"";height:1px;background:var(--line);flex:1}
.field{display:flex;gap:10px}
input[type=text]{flex:1;font-family:var(--mono);font-size:14px;padding:12px 14px;border:1px solid var(--line);border-radius:7px;background:var(--surface);color:var(--ink-strong);min-width:0}
input[type=text]:focus{outline:2px solid var(--blue);outline-offset:-1px;border-color:var(--blue)}
.privacy{font-size:12.5px;color:var(--muted);margin-top:18px;line-height:1.55}
.err{background:var(--pink-soft);border:1px solid #F6BFCE;color:#9E1338;border-radius:8px;padding:12px 15px;font-size:14px;margin-top:18px}
.spin{display:inline-block;width:13px;height:13px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:sp .7s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}

/* result */
.rhead{padding:40px 0 26px}
.verdict{font-family:var(--display);font-weight:600;font-size:clamp(27px,3.6vw,40px);line-height:1.14;letter-spacing:-.032em;color:var(--ink-strong);max-width:19em}
.verdict b{color:var(--crit);font-weight:600}
.verdict i{font-style:normal;color:var(--blue)}
.rmeta{display:flex;gap:9px;flex-wrap:wrap;margin-top:18px;font-family:var(--mono);font-size:11.5px;color:var(--muted)}
.rmeta span{background:var(--surface);border:1px solid var(--line);border-radius:5px;padding:5px 9px}
.sevrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:12px;margin-top:30px}
.sev{border-radius:10px;padding:16px 17px;border:1px solid}
.sev .v{font-family:var(--display);font-size:27px;font-weight:600;line-height:1;letter-spacing:-.03em}
.sev .k{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;margin-top:10px;display:block}
.sev.critical{border-color:#F3C3D2;background:var(--crit-bg);color:var(--crit)}
.sev.high{border-color:#EBD3B4;background:var(--high-bg);color:var(--high)}
.sev.medium{border-color:#E7DEB9;background:var(--med-bg);color:var(--med)}
.sev.low{border-color:var(--line);background:var(--low-bg);color:var(--low)}
.sev.info{border-color:var(--line);background:var(--info-bg);color:var(--info)}
.sev.zero{opacity:.5}

.gate{margin:28px 0;background:var(--surface);border:1px solid var(--blue-line);border-radius:12px;padding:28px 30px;display:flex;gap:26px;align-items:center;flex-wrap:wrap}
.gate .g1{flex:1;min-width:260px}
.gate h3{font-size:21px}
.gate p{font-size:14.5px;color:var(--muted);margin-top:9px;max-width:44em}
.gbtn{display:inline-flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:11px 18px;font-size:14.5px;font-weight:500;color:var(--ink-strong);cursor:pointer;transition:.15s}
.gbtn:hover{border-color:#C2C2D0;text-decoration:none;box-shadow:0 1px 3px rgba(20,20,50,.07)}

.catgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin-top:16px}
.cr{padding:16px 17px;display:flex;flex-direction:column;gap:6px}
.cr .top{display:flex;align-items:baseline;gap:9px}
.cr .nm{font-family:var(--display);font-weight:600;font-size:15px;color:var(--ink-strong);letter-spacing:-.015em;flex:1}
.cr .ast{font-family:var(--mono);font-size:9.5px;color:var(--faint);letter-spacing:.06em}
.cr .ct{font-family:var(--mono);font-size:12px;font-weight:500}
.cr .bl{font-size:12.5px;color:var(--muted);line-height:1.45}
.pill{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;border-radius:4px;padding:3px 7px;border:1px solid}
.pill.critical{color:var(--crit);background:var(--crit-bg);border-color:#F3C3D2}
.pill.high{color:var(--high);background:var(--high-bg);border-color:#EBD3B4}
.pill.medium{color:var(--med);background:var(--med-bg);border-color:#E7DEB9}
.pill.low{color:var(--low);background:var(--low-bg);border-color:var(--line)}
.pill.info{color:var(--info);background:var(--info-bg);border-color:var(--line)}
.pill.none{color:var(--clear);background:#EAF5EF;border-color:#C4E2D2}

.f{padding:19px 21px;margin-top:11px;border-left-width:3px}
.f.critical{border-left-color:var(--crit)}
.f.high{border-left-color:var(--high)}
.f.medium{border-left-color:var(--med)}
.f.low{border-left-color:var(--line)}
.f.info{border-left-color:var(--line)}
.f .fh{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.f .ft{font-family:var(--display);font-weight:600;font-size:16.5px;color:var(--ink-strong);letter-spacing:-.016em}
.f .loc{font-family:var(--mono);font-size:11.5px;color:var(--muted);margin-left:auto}
.quote{font-family:var(--mono);font-size:12.5px;line-height:1.6;background:var(--surface-2);border:1px solid var(--line-soft);border-radius:6px;padding:11px 13px;margin:12px 0;color:var(--ink-strong);overflow-x:auto;white-space:pre-wrap;word-break:break-word}
.f .why{font-size:14px;color:var(--ink);line-height:1.55}
.f .fix{font-size:13.5px;color:var(--ink);line-height:1.55;margin-top:9px;padding-left:13px;border-left:2px solid var(--cyan)}
.f .fix b{font-family:var(--mono);font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:3px;font-weight:500}

table.tbl{width:100%;border-collapse:collapse;margin-top:16px;font-size:13.5px}
table.tbl th{text-align:left;font-family:var(--mono);font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--faint);font-weight:500;padding:0 12px 9px;border-bottom:1px solid var(--line)}
table.tbl td{padding:11px 12px;border-bottom:1px solid var(--line-soft);vertical-align:baseline}
table.tbl tr:last-child td{border-bottom:0}
table.tbl td.r{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums;color:var(--muted)}
table.tbl td.nm{font-family:var(--mono);color:var(--ink-strong)}

.locked-panel{background:var(--surface-2);border:1px dashed var(--line);border-radius:11px;padding:24px 26px;margin-top:14px}
.locked-panel ul{margin:14px 0 0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:11px}
.locked-panel li{font-size:13.5px;color:var(--muted);padding-left:20px;position:relative;line-height:1.45}
.locked-panel li::before{content:"";position:absolute;left:0;top:6px;width:10px;height:10px;border:1.5px solid var(--faint);border-radius:2px}
.note{font-size:12.5px;color:var(--muted);line-height:1.6;margin-top:14px}
footer.bot{border-top:1px solid var(--line);margin-top:70px;padding:30px 0 44px;font-size:12.5px;color:var(--faint)}
footer.bot .disc{max-width:62em;line-height:1.6}
.secthead{display:flex;align-items:baseline;gap:12px;margin-top:44px}
.secthead h2{font-size:23px}
.secthead .c{font-family:var(--mono);font-size:11.5px;color:var(--faint);margin-left:auto}
@media (max-width:640px){
  .hero{padding:48px 0 40px}
  .gate{padding:22px}
  .f .loc{margin-left:0;width:100%}
}

/* ---- AIR-shaped layout: type picker, result rail, category cards, locks ---- */
.pagehead{display:flex;align-items:flex-start;gap:28px;padding:52px 0 4px;flex-wrap:wrap}
.orb{width:88px;height:88px;border-radius:22px;flex:none;position:relative;
   background:linear-gradient(150deg,var(--blue) 0%,#4A50E8 52%,var(--cyan) 100%);
   box-shadow:0 10px 26px rgba(32,38,210,.22)}
.orb::after{content:"";position:absolute;left:50%;top:50%;width:34%;height:34%;border-radius:7px;
   background:#fff;transform:translate(-58%,-58%) rotate(14deg);opacity:.92}
.orb::before{content:"";position:absolute;right:13%;bottom:13%;width:17%;height:17%;border-radius:4px;background:rgba(255,255,255,.55)}
.pagehead .ph{flex:1;min-width:260px}
.pagehead h1{font-size:clamp(36px,5.4vw,62px);line-height:1}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px;align-items:center}
.chip{font-family:var(--mono);font-size:12px;color:var(--ink-strong);background:var(--surface-2);border-radius:5px;padding:5px 9px}
.chip .lbl{color:var(--muted);margin-right:7px}

.pick{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin:26px 0 22px}
.pk{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:22px 20px 20px;cursor:pointer;transition:.15s;min-height:118px;display:flex;flex-direction:column;justify-content:flex-end}
.pk:hover{border-color:#C2C2D0}
.pk.on{border-color:var(--ink-strong);box-shadow:inset 0 0 0 1px var(--ink-strong)}
.pk.off{cursor:default;background:var(--surface);opacity:.72}
.pk .dot{position:absolute;top:16px;right:16px;width:17px;height:17px;border-radius:50%;border:1.5px solid var(--line);display:grid;place-items:center}
.pk.on .dot{border-color:var(--ink-strong)}
.pk.on .dot::after{content:"";width:9px;height:9px;border-radius:50%;background:var(--ink-strong)}
.pk .ic{font-size:17px;color:var(--muted);margin-bottom:auto}
.pk .t{font-family:var(--display);font-weight:600;font-size:20px;color:var(--ink-strong);letter-spacing:-.02em}
.pk .d{font-size:12.5px;color:var(--muted);margin-top:4px;line-height:1.4}
.pk .ent{position:absolute;top:15px;left:18px;font-family:var(--mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--blue)}
.wide{width:100%;justify-content:center;padding:17px 24px;font-size:16px;border-radius:10px}

/* result: main + rail */
.cols{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:26px;align-items:start}
.rail{position:sticky;top:80px;display:flex;flex-direction:column;gap:14px}
.rail .rc{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:20px 20px}
.rail .rc h4{font-family:var(--display);font-weight:600;font-size:17px;color:var(--ink-strong)}
.rail .rc p{font-size:12.5px;color:var(--muted);margin-top:5px;line-height:1.45}
.rail .kv{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid var(--line-soft);font-size:13px}
.rail .kv:first-of-type{border-top:0}
.rail .kv b{font-family:var(--mono);font-weight:400;color:var(--ink-strong);font-variant-numeric:tabular-nums}
.rail .rlabel{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);display:block;margin:16px 0 8px}

/* category cards */
.catcard{background:var(--surface);border:1px solid var(--line);border-radius:12px;margin-bottom:14px;overflow:hidden}
.cathead{display:flex;align-items:center;gap:12px;padding:19px 22px;flex-wrap:wrap}
.cathead h3{font-size:21px;letter-spacing:-.022em}
.astbadge{font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--muted);border:1px solid var(--line);border-radius:20px;padding:3px 9px 3px 7px;display:inline-flex;align-items:center;gap:5px}
.astbadge::before{content:"◈";color:var(--faint);font-size:9px}
.status{margin-left:auto;font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;display:inline-flex;align-items:center;gap:6px}
.status.clear{color:var(--clear)}
.status.flag{color:var(--crit)}
.status.flag.high{color:var(--high)}
.status.flag.medium{color:var(--med)}
.status.flag.low{color:var(--low)}
.catbody{border-top:1px solid var(--line-soft);padding:4px 22px 8px}
.catbody .sub{padding:17px 0;border-top:1px solid var(--line-soft)}
.catbody .sub:first-child{border-top:0}
.catbody .sub .sh{display:flex;align-items:baseline;gap:10px}
.catbody .sub .st{font-family:var(--display);font-weight:600;font-size:15.5px;color:var(--ink-strong);letter-spacing:-.012em}
.catbody .sub .sc{margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--faint);letter-spacing:.06em}
.catbody .sub .sc.hit{color:var(--crit)}
.catbody .sub .sd{font-size:13.5px;color:var(--muted);margin-top:5px;line-height:1.5}

.lockrow{margin:14px 0 4px;border-radius:9px;background:var(--surface-2);border:1px solid var(--line-soft);padding:18px;display:grid;place-items:center;position:relative;overflow:hidden}
.lockrow .bars{position:absolute;inset:14px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;opacity:.5}
.lockrow .bars i{display:block;height:7px;border-radius:4px;background:var(--line);margin-bottom:8px}
.lockrow .bars i:nth-child(2){width:72%}
.lockrow .bars i:nth-child(3){width:54%}
.lockbtn{position:relative;z-index:1;display:inline-flex;align-items:center;gap:8px;background:var(--ink-strong);color:#fff;border:0;border-radius:8px;padding:11px 20px;font-family:var(--body);font-size:14px;font-weight:500;cursor:pointer}
.lockbtn:hover{background:#000;text-decoration:none;color:#fff}

.ribbon{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:44px 26px 34px;text-align:center;overflow:hidden;margin-top:22px}
.ribbon::before{content:"Registry plan";position:absolute;left:-52px;top:20px;transform:rotate(-45deg);background:#FBF0C4;color:#7A6410;font-family:var(--mono);font-size:10px;letter-spacing:.1em;padding:6px 60px}
.ribbon h3{font-size:23px}
.ribbon p{font-size:14.5px;color:var(--muted);margin:10px auto 0;max-width:34em;line-height:1.55}
.ribbon .lk{width:52px;height:52px;margin:0 auto 14px;border-radius:12px;background:var(--blue-soft);display:grid;place-items:center;font-size:23px}

/* modal */
.mask{position:fixed;inset:0;background:rgba(20,20,40,.5);display:none;place-items:center;z-index:60;padding:20px}
.mask.on{display:grid}
.modal{background:#fff;border-radius:16px;max-width:430px;width:100%;padding:34px 32px 26px;position:relative;overflow:hidden}
.modal::before{content:"Registry plan";position:absolute;left:-52px;top:20px;transform:rotate(-45deg);background:#FBF0C4;color:#7A6410;font-family:var(--mono);font-size:10px;letter-spacing:.1em;padding:6px 60px}
.modal .x{position:absolute;top:14px;right:14px;border:1px solid var(--line);background:#fff;border-radius:7px;width:30px;height:30px;cursor:pointer;color:var(--muted);font-size:16px;line-height:1}
.modal h3{font-size:25px;text-align:center;margin-top:6px}
.modal>p{font-size:14px;color:var(--muted);text-align:center;margin-top:9px;line-height:1.5}
.modal .lk{width:60px;height:60px;margin:0 auto;border-radius:14px;background:var(--blue-soft);display:grid;place-items:center;font-size:27px}
.modal input{width:100%;font-family:var(--body);font-size:14.5px;padding:13px 14px;border:1px solid var(--line);border-radius:9px;background:var(--surface-2);margin-top:11px}
.modal label.ck{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;color:var(--muted);margin-top:15px;line-height:1.45}
.modal button.sub2{width:100%;margin-top:16px;background:var(--ink-strong);color:#fff;border:0;border-radius:26px;padding:14px;font-size:15px;font-weight:500;cursor:pointer}
.modal .fine{font-size:11.5px;color:var(--faint);text-align:center;margin-top:12px}

/* landing tabs */
.tabs{display:flex;gap:4px;background:var(--blue-soft);border-radius:12px;padding:6px;flex-wrap:wrap}
.tab{flex:1;min-width:130px;border:1.5px solid transparent;background:transparent;border-radius:9px;padding:13px 14px;font-family:var(--body);font-size:15px;font-weight:500;color:var(--ink-strong);cursor:pointer;transition:.15s}
.tab.on{background:#fff;border-color:var(--blue)}
.tabwrap{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:34px;align-items:start;margin-top:34px}
.tabwrap .td{font-size:15.5px;color:var(--ink);line-height:1.55}
.tabwrap .td b{color:var(--ink-strong)}
.mock{margin-top:26px;border:1px solid var(--line);border-radius:12px;background:var(--surface);overflow:hidden}
.mock .bar{height:34px;background:var(--surface-2);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:6px;padding:0 13px}
.mock .bar i{width:9px;height:9px;border-radius:50%;background:#D7D7E2;display:block}
.mock .in{padding:18px 20px}
.mrow{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--line-soft);font-size:13.5px}
.mrow:first-child{border-top:0}
.mrow .nm{font-family:var(--mono);color:var(--ink-strong);font-size:12.5px}
.mrow .sp{margin-left:auto}
@media (max-width:900px){.cols{grid-template-columns:1fr}.rail{position:static}.tabwrap{grid-template-columns:1fr;gap:20px}}


/* ---- landing, Atlan-shaped ---- */
body{display:flex;flex-direction:column;min-height:100vh}
.growmain{flex:1}
.herowrap{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,.88fr);gap:52px;align-items:center;padding:66px 0 54px}
.herowrap .hl .lede{font-size:18.5px;line-height:1.5;color:var(--muted);max-width:30em;margin-top:18px}
.herowrap .cta{display:flex;gap:11px;margin-top:30px;flex-wrap:wrap}
.sectop{max-width:34em}
.sectop h2{margin-top:13px}
.sectop p{font-size:16px;color:var(--muted);margin-top:13px;line-height:1.55}
.sectop.w{max-width:56em}
.sectop.w h2{max-width:15em}
.sectop p.wide{max-width:none}
.steps4{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:0;margin-top:34px;border-top:1px solid var(--line)}
.st4{padding:22px 24px 24px;border-right:1px solid var(--line-soft);position:relative}
.st4:last-child{border-right:0}
.st4 .n{font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;color:var(--blue)}
.st4 h4{font-family:var(--display);font-weight:600;font-size:17.5px;color:var(--ink-strong);letter-spacing:-.018em;margin-top:11px}
.st4 p{font-size:13.5px;color:var(--muted);line-height:1.5;margin-top:7px}
.st4::after{content:"";position:absolute;top:-1px;left:0;width:34%;height:2px;background:var(--blue)}
.obs{background:var(--ink-strong);color:#fff;border-radius:16px;padding:52px 52px 46px;margin-top:8px}
.obs .eyebrow{color:#8A8CC8}
.obs h2{color:#fff;font-size:clamp(25px,3.1vw,36px);margin-top:14px;max-width:19em;line-height:1.18}
.obs h2 em{font-style:normal;color:var(--cyan)}
.obs .cite{font-family:var(--mono);font-size:11.5px;color:#9A9AB4;margin-top:22px;line-height:1.7}
.beliefs{display:grid;grid-template-columns:repeat(auto-fit,minmax(268px,1fr));gap:16px;margin-top:34px}
.bel{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:26px 24px}
.bel{padding:28px 26px 26px}
/* stacked, with a floor under it, so the rule lands at the same height in all three cards */
.belstat{display:flex;flex-direction:column;gap:9px;min-height:92px;padding-bottom:18px;margin-bottom:18px;border-bottom:1px solid var(--line-soft)}
.belstat .v{font-family:var(--display);font-weight:600;font-size:42px;line-height:.95;letter-spacing:-.045em;color:var(--blue);font-variant-numeric:tabular-nums}
.belstat .l{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);line-height:1.6;max-width:20em}
.bel h4{font-family:var(--display);font-weight:600;font-size:21px;color:var(--ink-strong);letter-spacing:-.022em;line-height:1.2;min-height:2.4em;display:flex;align-items:flex-end}
.bel p{font-size:14.5px;color:var(--muted);line-height:1.55;margin-top:10px}
.bel p b{color:var(--ink-strong);font-weight:600;background:linear-gradient(transparent 64%,var(--cyan) 64%);padding:0 .08em}
.faqfoot{font-size:14px;color:var(--muted);margin-top:22px}
.faq{margin-top:30px;border-top:1px solid var(--line)}
.faq details{border-bottom:1px solid var(--line-soft)}
.faq summary{list-style:none;cursor:pointer;padding:20px 44px 20px 0;font-family:var(--display);font-weight:600;font-size:17.5px;color:var(--ink-strong);letter-spacing:-.015em;position:relative}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";position:absolute;right:8px;top:18px;font-family:var(--body);font-weight:400;font-size:21px;color:var(--faint);line-height:1}
.faq details[open] summary::after{content:"–"}
/* a readable measure, and no hyphen-breaking mid-word */
.faq p{font-size:15px;color:var(--muted);line-height:1.62;padding:0 44px 22px 0;max-width:none;text-wrap:pretty;margin-top:-2px;hyphens:none;overflow-wrap:normal}
.finalcta{background:var(--blue-soft);border:1px solid var(--blue-line);border-radius:16px;padding:62px 40px 54px;text-align:center;margin-top:8px}
.ctabrand{display:inline-flex;align-items:center;gap:9px;font-family:var(--display);font-weight:600;
  font-size:22px;letter-spacing:-.03em;word-spacing:-3.5px;color:var(--ink-strong);margin-bottom:22px}
.ctabrand em{font-style:normal;color:var(--blue)}
.ctabrand .sq{width:17px;height:17px;border-radius:4px;background:var(--blue);position:relative;display:inline-block}
.ctabrand .sq::after{content:"";position:absolute;right:-5px;bottom:-5px;width:10px;height:10px;border-radius:2.5px;background:var(--cyan)}
.finalcta h2{max-width:15em;margin:0 auto}
.finalcta p{font-size:16.5px;color:var(--ink);margin:16px auto 0;max-width:34em}
.ctarow{display:flex;gap:11px;justify-content:center;flex-wrap:wrap;margin-top:28px}
.ctanote{font-size:13px!important;color:var(--muted)!important;margin-top:18px!important}

/* footer, Atlan-shaped */
footer.bot{border-top:1px solid var(--line);margin-top:74px;padding:48px 0 34px;font-size:13.5px;color:var(--muted);background:var(--surface)}
.fcols{display:grid;grid-template-columns:1.5fr repeat(3,1fr);gap:34px}
.fcols h5{font-family:var(--mono);font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--faint);font-weight:500;margin:0 0 13px}
.fcols ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px}
.fcols a{color:var(--muted)}
.fcols a:hover{color:var(--ink-strong);text-decoration:none}
.fbrand p{font-size:13.5px;color:var(--muted);line-height:1.55;margin-top:12px;max-width:26em}
.fbot{border-top:1px solid var(--line-soft);margin-top:36px;padding-top:22px;display:flex;gap:18px;flex-wrap:wrap;align-items:center;font-size:12.5px;color:var(--faint)}
.fbot .sp{margin-left:auto;display:flex;gap:16px}
.fdisc{font-size:12.5px;color:var(--faint);line-height:1.6;max-width:70em;margin-top:14px}
@media (max-width:860px){.herowrap{grid-template-columns:1fr;gap:30px;padding:44px 0 36px}.fcols{grid-template-columns:1fr 1fr;gap:26px}.obs{padding:34px 26px}}

/* cleared categories collapse so a clean scan LOOKS clean */
.catcard.cleared{background:transparent;border-style:dashed}
.catcard.cleared .cathead{padding:15px 22px}
.catcard.cleared h3{font-size:17px;color:var(--muted);font-weight:500}
.resultlede{font-size:17px;color:var(--ink);margin-top:18px;max-width:44em;line-height:1.55}
.resultlede b{color:var(--ink-strong)}


.scanhead{display:flex;align-items:flex-start;gap:26px;padding:56px 0 34px}
.scanhead .ph{flex:1;min-width:240px}
.scanhead h1{font-size:clamp(32px,4.4vw,50px);line-height:1.02;margin-top:16px}
.scanhead h1 i{font-style:italic;font-weight:500;color:var(--ink-strong)}
.scanhead .sub{font-size:16px;color:var(--muted);margin-top:16px}
.scanhead .btn{margin-top:6px;flex:none}
.orb.sm{width:84px;height:84px}
.pick{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin:6px 0 22px;align-items:stretch}
.pk{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:13px;
    padding:20px 20px 18px;cursor:pointer;transition:.15s;display:flex;flex-direction:column;min-height:172px}
.pk .ic{font-size:20px;color:var(--faint);line-height:1;height:24px}
.pk .t{font-family:var(--display);font-weight:600;font-size:21px;color:var(--ink-strong);letter-spacing:-.022em;margin-top:auto}
.pk .d{font-size:13px;color:var(--muted);margin-top:6px;line-height:1.45;min-height:38px}
.pk .tagfree,.pk .tagent{font-family:var(--mono);font-size:9.5px;letter-spacing:.11em;text-transform:uppercase;
    border-radius:4px;padding:3px 7px;align-self:flex-start;margin-top:13px}
.pk .tagfree{color:var(--clear);background:#EAF5EF}
.pk .tagent{color:#7A6410;background:#FBF0C4}
.pk.off .ic,.pk.off .t{opacity:.72}
.undernote{font-size:13px;color:var(--faint);margin-top:16px;text-align:center}
.drop{padding:52px 28px}
.dropic{font-size:26px;color:var(--faint);margin-bottom:12px}
.or{margin:26px 0}


.catcard.cleared>summary{list-style:none;cursor:pointer}
.catcard.cleared>summary::-webkit-details-marker{display:none}
.catcard.cleared>summary .cathead::after{content:"▾";color:var(--faint);font-size:11px;margin-left:10px}
.catcard.cleared[open]>summary .cathead::after{content:"▴"}
.catcard.cleared .catbody{border-top:1px solid var(--line-soft)}
.pagehead{padding:46px 0 4px}
.pagehead .ph h1{font-family:var(--mono);font-size:clamp(22px,2.9vw,34px);font-weight:500;letter-spacing:-.01em;line-height:1.2;word-break:break-word;margin-top:14px!important}

.pickrow{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:22px}
.fcols{grid-template-columns:1.6fr 1fr 1fr}
.flive{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--clear);background:#EAF5EF;border-radius:3px;padding:2px 5px;margin-left:6px}
@media (max-width:860px){.fcols{grid-template-columns:1fr 1fr}}

.fcols li.fsub{padding-left:14px;position:relative}
.fcols li.fsub::before{content:"";position:absolute;left:2px;top:9px;width:6px;height:1px;background:var(--line)}
.tabwrap .td b{color:var(--ink-strong)}
.tabwrap .td b:last-of-type{background:linear-gradient(transparent 64%,var(--cyan) 64%);padding:0 .08em}

.snip{display:flex;align-items:center;gap:12px;margin-top:14px;background:var(--surface-2);
  border:1px solid var(--line-soft);border-radius:8px;padding:11px 11px 11px 14px}
.snip code{font-family:var(--mono);font-size:12px;color:var(--ink-strong);white-space:nowrap;
  overflow-x:auto;flex:1;min-width:0;scrollbar-width:thin}
.snipbtn{flex:none;padding:7px 14px;font-size:13px}

.regcta{background:var(--ink-strong);border-radius:14px;padding:38px 38px 34px;margin-top:22px;color:#fff}
.regcta .eyebrow{color:#8A8CC8}
.regcta h3{font-family:var(--display);font-weight:600;font-size:clamp(21px,2.4vw,28px);line-height:1.2;
  letter-spacing:-.028em;color:#fff;margin-top:14px}
.regcta ul{list-style:none;margin:26px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px 34px}
.regcta li{font-size:14.5px;line-height:1.5;color:#C8C9E0;padding-left:24px;position:relative}
.regcta .rk{display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#7B7DB8;margin-bottom:4px}
.regcta li,.regcta .btn{white-space:nowrap}
@media (max-width:760px){.regcta li{white-space:normal}}
.regcta li::before{content:"";position:absolute;left:0;top:4px;width:9px;height:9px;border-radius:2px;
  background:linear-gradient(140deg,var(--cyan),var(--blue))}
.regrow{display:flex;gap:11px;flex-wrap:wrap;margin-top:30px}
.regghost{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.28)}
.regghost:hover{border-color:rgba(255,255,255,.6);background:rgba(255,255,255,.06)}
@media (max-width:640px){.regcta{padding:28px 24px}}

.badgewarn{font-size:12.5px;line-height:1.55;color:var(--high);background:var(--high-bg);
  border:1px solid #EBD3B4;border-radius:8px;padding:11px 13px;margin-top:12px}

.sharecard{padding:26px 28px;margin-top:22px}
.sharecard h3{font-size:19px}
.sharecard>p.muted{font-size:14px;margin-top:9px;max-width:56em;line-height:1.55}
.sharelbl{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--faint);margin:20px 0 8px}

.platcta{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:24px}
.platcta span{font-size:13.5px;color:var(--muted)}

/* pillar panels: a different shape per capability, so four tabs read as four products */
.mock .fleet{width:100%;height:auto;display:block}
.mock .fleet .ch{font-family:var(--mono);font-size:8.5px;letter-spacing:.16em;fill:var(--faint)}
.mock .fleet .rule{stroke:var(--line-soft);stroke-width:1}
.mock .fleet .w{stroke:#BFC0D8;stroke-width:1.3}
.mock .fleet .w.bad{stroke:var(--crit);stroke-dasharray:4 3}
.mock .fleet .box{fill:var(--surface);stroke:var(--line);stroke-width:1;rx:9}
.mock .fleet .box.shadow{stroke:#E9B9C7;stroke-dasharray:4 3}
.mock .fleet .leaf{fill:var(--surface-2);stroke:var(--line-soft);stroke-width:1;rx:8}
.mock .fleet .nm{font-family:var(--mono);font-size:11.5px;fill:var(--ink-strong)}
.mock .fleet .sub{font-family:var(--body);font-size:10px;fill:var(--muted)}
.mock .fleet .tag{rx:4}
.mock .fleet .tag.crit{fill:var(--crit-bg);stroke:#F3C3D2}
.mock .fleet .tag.ok{fill:#EAF5EF;stroke:#C4E2D2}
.mock .fleet .tag.warn{fill:var(--med-bg);stroke:#E7DEB9}
.mock .fleet .tagt{font-family:var(--mono);font-size:9px;text-anchor:middle;letter-spacing:.04em}
.mock .fleet .tagt.crit{fill:var(--crit)}
.mock .fleet .tagt.ok{fill:var(--clear)}
.mock .fleet .tagt.warn{fill:var(--med)}

.scanp .hd,.scanp .rw{display:grid;grid-template-columns:130px 1fr 92px;gap:16px;align-items:center}
.scanp .hd{font-family:var(--mono);font-size:8.5px;letter-spacing:.16em;color:var(--faint);padding-bottom:10px;border-bottom:1px solid var(--line-soft)}
.scanp .hd .r,.scanp .rw .pill{justify-self:end}
.scanp .rw{padding:11px 0;border-bottom:1px solid var(--line-soft);font-size:13.5px}
.scanp .rw:last-child{border-bottom:0}
.scanp .nm{font-family:var(--mono);font-size:12.5px;color:var(--ink-strong)}
.scanp .d{color:var(--ink)}
.scanp .d.faint,.scanp .nm.faint{color:var(--faint)}
.scanp code{font-family:var(--mono);font-size:11.5px;background:var(--surface-2);padding:1px 5px;border-radius:4px;color:var(--ink-strong)}
@media (max-width:700px){.scanp .hd,.scanp .rw{grid-template-columns:1fr auto;gap:8px}.scanp .d{grid-column:1/-1;font-size:12.5px}.scanp .hd span:nth-child(2){display:none}}

.flow{display:flex;flex-direction:column;gap:1px}
.flow .fhd{display:flex;gap:14px;font-family:var(--mono);font-size:8.5px;letter-spacing:.16em;color:var(--faint);padding-bottom:10px;border-bottom:1px solid var(--line-soft)}
.flow .fhd .g{flex:1}
.flow .fr{display:flex;align-items:center;gap:14px;padding:13px 2px;border-top:1px solid var(--line-soft);font-size:13.5px}
.flow .fr:first-child{border-top:0}
.flow .fr .t{font-family:var(--mono);font-size:11px;color:var(--faint);flex:none}
.flow .fr .a{color:var(--ink);flex:1}
.flow .fr code{font-family:var(--mono);font-size:12px;color:var(--ink-strong);background:var(--surface-2);padding:1px 5px;border-radius:4px}
.flow .fr.bad{background:var(--crit-bg);border-radius:7px;padding-left:10px;padding-right:10px;margin-top:2px}
.flow .p{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;border-radius:4px;padding:3px 8px;flex:none}
.flow .p.ok{color:var(--clear);background:#EAF5EF}
.flow .p.no{color:#fff;background:var(--crit)}
.fnote{font-size:12.5px;color:var(--muted);margin-top:12px;line-height:1.5}

.shelf{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:11px}
.shelf .sc{border:1px solid var(--line);border-radius:10px;padding:14px 14px 12px;display:flex;flex-direction:column;gap:3px;background:var(--surface)}
.shelf .sc.dim{background:var(--surface-2);border-style:dashed}
.shelf .k{font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}
.shelf b{font-family:var(--mono);font-size:13px;color:var(--ink-strong);font-weight:500}
.shelf .v{font-size:11.5px;color:var(--muted)}
.shelf .badge{margin-top:9px;align-self:flex-start;font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;border-radius:4px;padding:3px 7px}
.shelf .badge.ok{color:var(--clear);background:#EAF5EF}
.shelf .badge.wait{color:var(--med);background:var(--med-bg)}

/* The semantic review block. Marked apart from the deterministic cards on purpose. */
.catcard.review{border-color:var(--blue-line);background:linear-gradient(180deg,var(--blue-soft) 0,transparent 120px)}
.catcard.review .revnote{font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:14px}
.catcard.review .revfail{font-size:13px;color:var(--high);background:var(--high-bg);border-radius:7px;padding:10px 12px;margin-bottom:14px;line-height:1.55}
.catcard.review .revempty{font-size:13.5px;color:var(--muted)}
`;
