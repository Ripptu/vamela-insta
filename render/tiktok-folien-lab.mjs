// Entwürfe für die Folgeseiten (Christian, 14.10.2026): fünf grundverschiedene Looks, je Inhaltsseite und Schlussseite.
// Sicherheitsbereich TikTok: y 210–1440, x 60–930.
import fs from 'node:fs'
import path from 'node:path'
import { esc, GH } from './stil-klar.mjs'

const BASIS = path.resolve(new URL('.', import.meta.url).pathname)
const hl = (t, f) => esc(t).replace(/\*([^*\n]+)\*/g, f)
const FONTS = `
@font-face{font-family:'Inter Tight';font-weight:400;src:url(fonts/InterTight-400.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:600;src:url(fonts/InterTight-600.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:700;src:url(fonts/InterTight-700.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:800;src:url(fonts/InterTight-800.woff2) format('woff2')}
@font-face{font-family:Caveat;font-weight:400 700;src:url(fonts/Caveat.woff2) format('woff2')}
@font-face{font-family:'Instrument Serif';font-style:italic;src:url(orange/fonts/instrument-serif-400-italic.woff2) format('woff2')}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;font-family:'Inter Tight',sans-serif}
.korn{position:absolute;inset:0;background:url(orange/noise.png);opacity:.14;mix-blend-mode:multiply;pointer-events:none}`
const page = (css, body) => `<!doctype html><html><head><meta charset=utf-8><base href="file://${BASIS}/"><style>${FONTS}${css}</style></head><body>${body}</body></html>`
const FIT = (sel, min = 44, maxH = 1180) => `<script>document.fonts.ready.then(()=>{const b=document.querySelector('${sel}');let s=parseFloat(getComputedStyle(b).fontSize);const ok=()=>b.parentElement.scrollHeight<=b.parentElement.clientHeight+1&&b.scrollWidth<=b.clientWidth+1;for(;s>${min}&&!ok();s-=3)b.style.fontSize=s+'px';document.body.dataset.fertig='1'})</script>`

// 1 Notizblock ---------------------------------------------------------------------------------------------------
function notiz(o) {
  const css = `
body{background:#fbf7e6}
.linien{position:absolute;inset:0;background:repeating-linear-gradient(180deg,transparent 0 77px,#c9dcef 77px 80px);background-position:0 40px}
.rand{position:absolute;left:150px;top:0;bottom:0;width:4px;background:#e8837a}
.loch{position:absolute;left:46px;width:46px;height:46px;border-radius:50%;background:#2f7fd8;box-shadow:inset 0 6px 10px rgba(0,0,0,.3)}
.tape{position:absolute;width:260px;height:76px;background:rgba(240,214,150,.75);box-shadow:0 4px 10px rgba(0,0,0,.15);z-index:5}
.in{position:absolute;left:190px;right:150px;top:300px;bottom:640px;display:flex;flex-direction:column;justify-content:center;font-family:Caveat;color:#1b2a8a}
h1{font:700 128px/1.0 Caveat;letter-spacing:-.01em}
h1 mark{background:linear-gradient(180deg,transparent 52%,#ffe45e 52% 92%,transparent 92%);color:inherit;padding:0 .08em}
.pt{display:flex;align-items:center;gap:22px;font:600 62px/1.1 Caveat;margin-top:26px;color:#1b2a8a}.pt i{flex:none;width:54px;height:54px;border:5px solid #1b2a8a;border-radius:8px;position:relative;transform:rotate(-3deg)}.pt i::after{content:'';position:absolute;left:10px;top:-14px;width:24px;height:44px;border-right:9px solid #e5322d;border-bottom:9px solid #e5322d;transform:rotate(40deg)}
.sticky{position:absolute;right:150px;top:1180px;width:270px;padding:34px 28px;background:#ffe45e;box-shadow:0 18px 30px rgba(0,0,0,.25);transform:rotate(5deg);font:700 58px/1.05 Caveat;color:#1b2a8a;z-index:6}
.sticky.gross{left:190px;right:auto;top:760px;width:560px;font-size:110px;text-align:center;transform:rotate(-4deg)}
.kopf{position:absolute;left:190px;top:215px;font:700 40px/1 'DejaVu Sans Mono',Menlo,monospace;color:#5a6a8a}`
  const inhalt = o.typ === 'cta'
    ? `<div class=in style="bottom:900px"><h1>${hl(o.kopf, '<mark>$1</mark>')}</h1></div><div class=pt style="position:absolute;left:190px;top:690px;right:150px">${esc(o.text)}</div><div class="sticky gross" style="top:880px">Speichern ★</div><div class="sticky" style="top:1170px;right:150px;width:260px;font-size:50px">Teilen!<br>→ an wen?</div>`
    : `<div class=in><h1 id=h>${hl(o.kopf, '<mark>$1</mark>')}</h1>${o.punkte.map((p) => `<div class=pt><i></i><span>${esc(p)}</span></div>`).join('')}</div><div class=sticky>0 €<br>kein Abo</div>`
  return page(css, `<div class=linien></div><div class=rand></div>${[300, 640, 980, 1320].map((y) => `<div class=loch style="top:${y}px"></div>`).join('')}<div class=tape style="left:620px;top:196px;transform:rotate(-4deg)"></div><div class=kopf>${esc(o.repo)}</div>${inhalt}<div class=korn></div>${FIT('#h', 70)}`)
}

// 2 Kommentare -----------------------------------------------------------------------------------------------------
function kommentare(o) {
  const css = `
body{background:radial-gradient(ellipse at 20% 0%,#2a2f4a,#0d0f1a 70%)}
.blatt{position:absolute;left:60px;right:150px;top:240px;background:#fff;border-radius:34px;box-shadow:0 30px 70px rgba(0,0,0,.55);padding:34px 36px 40px;color:#161823}
.kh{text-align:center;font:700 32px/1 'Inter Tight';color:#555;padding-bottom:26px;border-bottom:2px solid #eee}
.k{display:flex;gap:22px;margin-top:34px}.av{flex:none;width:76px;height:76px;border-radius:50%;display:grid;place-items:center;font:800 36px/1 'Inter Tight';color:#fff}
.nm{font:700 28px/1 'Inter Tight';color:#888;display:flex;gap:12px;align-items:center}.nm b{background:#fe2c55;color:#fff;border-radius:6px;padding:5px 10px;font-size:22px}.nm em{font-style:normal;color:#20a0f0}
.tx{font:600 40px/1.22 'Inter Tight';margin-top:10px;letter-spacing:-.01em}.tx mark{background:#ffe45e;color:inherit;padding:0 .1em;border-radius:6px}
.me{display:flex;gap:26px;margin-top:16px;font:600 26px/1 'Inter Tight';color:#999}
.herz{margin-left:auto;text-align:center;font:600 24px/1.1 'Inter Tight';color:#999;flex:none}.herz svg{width:34px;height:34px;display:block;margin:0 auto 6px}
.re{margin-left:98px}
.eingabe{margin-top:34px;display:flex;gap:16px;align-items:center;background:#f1f1f2;border-radius:999px;padding:20px 28px;font:500 32px/1.1 'Inter Tight';color:#161823}
.ic{display:flex;gap:44px;margin-top:34px;justify-content:space-around}.ic div{text-align:center;font:700 32px/1 'Inter Tight'}.ic svg{width:92px;height:92px;display:block;margin:0 auto 12px}`
  const HERZ = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.2 2.9 4.5 6.4 4.5c2 0 3.6 1 5.6 3.2 2-2.2 3.6-3.2 5.6-3.2 3.5 0 5.6 3.7 4 7.3C19.5 16.4 12 21 12 21Z" fill="COL"/></svg>'
  const inhalt = o.typ === 'cta'
    ? `<div class=blatt><div class=kh>12,4k Kommentare</div>
<div class=k><div class=av style="background:linear-gradient(145deg,#4a9bf5,#1f63c4)">V</div><div style="flex:1"><div class=nm>@vamela.de <b>Autor</b></div><div class=tx>${hl(o.kopf, '<mark>$1</mark>')}</div></div></div>
<div class=eingabe><span style="color:#999">Schreib:</span> <b>${esc(o.text)}</b></div>
<div class=ic><div>${HERZ.replace('COL', '#fe2c55')}12,4k</div><div><svg viewBox="0 0 24 24"><path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15.2c0 .6-.7 1-1.2.6L12 17l-5.3 3.8c-.5.4-1.2 0-1.2-.6V5A1.5 1.5 0 0 1 7 3.5Z" fill="#f7b500"/></svg>Speichern</div><div><svg viewBox="0 0 24 24"><path d="M3 11.5 21 3l-5.5 18-4-7.5L3 11.5Z" fill="#20a0f0"/></svg>Teilen</div></div></div>`
    : `<div class=blatt><div class=kh>12,4k Kommentare</div>
<div class=k><div class=av style="background:#c05a9a">L</div><div style="flex:1"><div class=nm>@lena.designt</div><div class=tx>Wie kriege ich mein Foto größer ohne Pixel?</div><div class=me><span>vor 2 Std.</span><span>Antworten</span></div></div><div class=herz>${HERZ.replace('COL', '#bbb')}842</div></div>
<div class="k re"><div class=av style="background:linear-gradient(145deg,#4a9bf5,#1f63c4)">V</div><div style="flex:1"><div class=nm>@vamela.de <b>Autor</b> <em>· Angepinnt</em></div><div class=tx id=h>${hl(o.kopf, '<mark>$1</mark>')}</div><div class=tx style="font-weight:500;font-size:36px;color:#444">${esc(o.text)}</div><div class=me><span>vor 1 Std.</span><span>Antworten</span></div></div><div class=herz>${HERZ.replace('COL', '#fe2c55')}3,1k</div></div></div>`
  return page(css, `${inhalt}<div class=korn style="mix-blend-mode:overlay;opacity:.12"></div>${FIT('#h', 30)}`)
}

// 3 Warnband --------------------------------------------------------------------------------------------------------
function warnband(o) {
  const css = `
body{background:#0e0e10}
.band{position:absolute;left:-100px;right:-100px;height:120px;background:repeating-linear-gradient(-45deg,#ffd400 0 46px,#111 46px 92px);transform:rotate(-5deg);box-shadow:0 12px 30px rgba(0,0,0,.6)}
.in{position:absolute;left:60px;right:150px;top:470px;bottom:700px;display:flex;flex-direction:column;justify-content:center;color:#fff}
h1{font:800 124px/.98 'Inter Tight';letter-spacing:-.035em;text-transform:uppercase}
h1 mark{background:#ffd400;color:#111;padding:0 .1em;box-shadow:8px 8px 0 #fff}
p{font:600 46px/1.28 'Inter Tight';margin-top:40px;color:#e8e8ea;max-width:800px}
.stk{position:absolute;left:60px;top:300px;background:#e5322d;color:#fff;font:800 44px/1 'Inter Tight';letter-spacing:.08em;padding:16px 28px;transform:rotate(-4deg);box-shadow:6px 8px 0 #fff;z-index:5}
.stop{position:absolute;right:150px;top:1000px;width:330px;height:330px;transform:rotate(8deg)}
.stop svg{position:absolute;inset:0;width:100%;height:100%;filter:drop-shadow(0 18px 24px rgba(0,0,0,.6))}.stop span{position:absolute;inset:0;display:grid;place-items:center;font:800 62px/1 'Inter Tight';color:#fff;letter-spacing:.02em;text-align:center}`
  const okt = '<svg viewBox="0 0 100 100"><polygon points="30,3 70,3 97,30 97,70 70,97 30,97 3,70 3,30" fill="#e5322d" stroke="#fff" stroke-width="5"/></svg>'
  const inhalt = o.typ === 'cta'
    ? `<div class=stk>BEVOR DU WEGWISCHST</div><div class=in style="bottom:640px"><h1>${hl(o.kopf, '<mark>$1</mark>')}</h1><p>${esc(o.text)}</p></div><div class=stop>${okt}<span>SPEI-<br>CHERN</span></div>`
    : `<div class=stk>ACHTUNG</div><div class=in><h1 id=h>${hl(o.kopf, '<mark>$1</mark>')}</h1><p>${esc(o.text)}</p></div><div class=stop style="width:230px;height:230px;top:1090px;right:150px">${okt}<span style="font-size:46px">0 €</span></div>`
  return page(css, `<div class=band style="top:190px"></div><div class=band style="top:1330px;transform:rotate(3deg)"></div>${inhalt}<div class=korn style="mix-blend-mode:screen;opacity:.08"></div>${FIT('#h', 60)}`)
}

// 4 GitHub-README ----------------------------------------------------------------------------------------------------
function readme(o) {
  const css = `
body{background:#f6f8fa;font-family:-apple-system,'Inter Tight',sans-serif}
.kopf{position:absolute;left:60px;right:150px;top:230px;display:flex;align-items:center;gap:14px;font:600 36px/1 'Inter Tight';color:#0969da}.kopf svg{font-size:44px;color:#1f2328}.kopf b{color:#1f2328;font-weight:800}.pub{border:2px solid #d0d7de;border-radius:999px;font:600 24px/1 'Inter Tight';color:#59636e;padding:7px 14px}
.karte{position:absolute;left:60px;right:150px;top:330px;background:#fff;border:2px solid #d0d7de;border-radius:18px;box-shadow:0 20px 50px rgba(31,35,40,.18);overflow:hidden}
.dk{display:flex;align-items:center;gap:14px;padding:20px 28px;background:#f6f8fa;border-bottom:2px solid #d0d7de;font:600 30px/1 'Inter Tight';color:#1f2328}
.rm{padding:36px 40px 44px;color:#1f2328}
h1{font:800 76px/1.1 'Inter Tight';letter-spacing:-.02em;padding-bottom:20px;border-bottom:2px solid #d0d7de}
h1 mark{background:none;color:#0969da}
.bd{display:flex;flex-wrap:wrap;gap:12px;margin:26px 0 10px}.b{display:flex;font:700 24px/1 'DejaVu Sans Mono',Menlo,monospace;border-radius:6px;overflow:hidden}.b i{font-style:normal;background:#555;color:#fff;padding:9px 12px}.b u{text-decoration:none;color:#fff;padding:9px 12px}
p{font:400 42px/1.5 'Inter Tight';margin-top:20px;color:#1f2328}
.cd{margin-top:26px;background:#f6f8fa;border-radius:14px;padding:22px 26px;font:600 30px/1.5 'DejaVu Sans Mono',Menlo,monospace;color:#1f2328}
.star{display:inline-flex;align-items:center;gap:16px;background:#f6f8fa;border:2px solid #d0d7de;border-radius:14px;font:700 44px/1 'Inter Tight';padding:24px 38px;color:#1f2328;box-shadow:0 4px 0 rgba(31,35,40,.1)}.star b{color:#bf8700}
.grn{display:inline-flex;background:#1f883d;color:#fff;font:800 44px/1 'Inter Tight';padding:24px 40px;border-radius:14px;box-shadow:0 12px 26px rgba(31,136,61,.45)}`
  const CUR = '<svg style="position:absolute;right:210px;top:XXpx;z-index:9;filter:drop-shadow(0 8px 10px rgba(0,0,0,.3))" width="96" height="136" viewBox="0 0 12 17" shape-rendering="crispEdges"><path d="M0 0h1v1H0zM0 1h2v1H0zM0 2h3v1H0zM0 3h4v1H0zM0 4h5v1H0zM0 5h6v1H0zM0 6h7v1H0zM0 7h8v1H0zM0 8h9v1H0zM0 9h10v1H0zM0 10h5v1H0zM0 11h3v1H0zM0 12h2v1H0zM0 13h2v1H0z" fill="#fff" stroke="#101828" stroke-width=".35"/></svg>'
  const inhalt = o.typ === 'cta'
    ? `<div class=kopf>${GH}<span>vamela / <b>deine-Liste</b></span><span class=pub>Public</span></div>
<div class=karte><div class=dk>README.md</div><div class=rm><h1>${hl(o.kopf, '<mark>$1</mark>')}</h1><p>${esc(o.text)}</p><div style="display:flex;gap:20px;margin-top:40px;flex-wrap:wrap"><span class=star>☆ Star <b>12,4k</b></span><span class=grn>Speichern</span></div></div></div>${CUR.replace('XX', '800')}`
    : `<div class=kopf>${GH}<span>${esc(o.repo.split('/')[0])} / <b>${esc(o.repo.split('/')[1])}</b></span><span class=pub>Public</span></div>
<div class=karte><div class=dk><svg viewBox="0 0 16 16" width="30" height="30"><path d="M2 4h12M2 8h12M2 12h8" stroke="#59636e" stroke-width="1.6" stroke-linecap="round"/></svg> README.md</div><div class=rm><h1 id=h>${hl(o.kopf, '<mark>$1</mark>')}</h1>
<div class=bd><span class=b><i>license</i><u style=background:#1f6feb>AGPL-3.0</u></span><span class=b><i>stars</i><u style=background:#bf8700>50k</u></span><span class=b><i>platform</i><u style=background:#1f883d>win | mac | linux</u></span></div>
<p>${esc(o.text)}</p><div class=cd>$ download &amp;&amp; install<br># fertig. kostenlos.</div></div></div>`
  return page(css, `${inhalt}<div class=korn style="opacity:.06"></div>${FIT('#h', 40)}`)
}

// 5 Collage -----------------------------------------------------------------------------------------------------------
function collage(o) {
  const css = `
body{background:#eee4d2}
.papier{position:absolute;inset:0;background:radial-gradient(ellipse at 15% 10%,#f6eee0,transparent 60%),repeating-linear-gradient(90deg,rgba(120,90,50,.03) 0 3px,transparent 3px 7px)}
.blau{position:absolute;left:-30px;top:560px;width:560px;height:900px;background:#2f7fd8;clip-path:polygon(0 4%,8% 0,18% 3%,30% 0,44% 4%,56% 1%,64% 5%,70% 30%,66% 55%,72% 80%,62% 100%,0 100%);box-shadow:0 20px 40px rgba(0,0,0,.2)}
.streifen{position:absolute;left:60px;background:#fff;padding:14px 26px;box-shadow:0 10px 22px rgba(60,40,10,.25);font:800 84px/1 'Inter Tight';letter-spacing:-.03em;text-transform:uppercase;color:#141414;white-space:nowrap}
.streifen.s{font:italic 400 140px/1 'Instrument Serif';text-transform:none;letter-spacing:-.01em;color:#fff;background:#2f7fd8;padding:0 30px 12px}
.pola{position:absolute;right:170px;top:860px;width:380px;background:#fff;padding:20px 20px 74px;box-shadow:0 24px 40px rgba(60,40,10,.35);transform:rotate(6deg);z-index:4}.pola img{width:100%;height:440px;object-fit:cover;object-position:center 40%;display:block}.pola span{position:absolute;left:0;right:0;bottom:16px;text-align:center;font:700 52px/1 Caveat;color:#1b2a8a}
.tape{position:absolute;width:200px;height:62px;background:rgba(240,214,150,.8);box-shadow:0 4px 10px rgba(0,0,0,.15);z-index:6}
.txt{position:absolute;left:60px;top:1150px;width:430px;font:600 44px/1.3 'Inter Tight';color:#141414;background:#fff;padding:26px 30px;box-shadow:0 10px 22px rgba(60,40,10,.25);transform:rotate(-1.5deg)}
.rep{position:absolute;left:60px;top:215px;font:700 32px/1 'DejaVu Sans Mono',Menlo,monospace;color:#5a4a30}
.kr{position:absolute;left:40px;top:650px;width:360px;height:150px}`
  const kreis = '<svg class=kr viewBox="0 0 300 100" preserveAspectRatio="none"><path d="M40 20C90 -2 230 -2 275 28 305 52 270 90 150 95 55 98 4 72 12 44 20 14 120 4 200 8 262 12 298 32 292 58" fill="none" stroke="#e5322d" stroke-width="3" stroke-linecap="round"/></svg>'
  const bild = `<div class=pola><img src="file://${path.resolve(o.bild)}"><span>${o.typ === 'cta' ? 'schick es weiter' : 'Pixel? Nö.'}</span></div><div class=tape style="right:300px;top:836px;transform:rotate(-5deg)"></div>`
  const inhalt = o.typ === 'cta'
    ? `<div class=rep>${esc(o.repo)}</div><div class=streifen style="top:300px;transform:rotate(-2deg)">Speicher dir</div><div class="streifen s" style="top:420px;transform:rotate(1.5deg)">den Beitrag.</div><div class=txt style="top:640px;width:440px">${esc(o.text)}</div>${bild}<div class=streifen style="top:1230px;left:60px;font-size:44px;transform:rotate(-2deg);background:#ffe45e">Speichern · Teilen</div>`
    : `<div class=blau></div><div class=rep>${esc(o.repo)}</div><div class="streifen s" style="top:300px;transform:rotate(-3deg)">Upscayl</div><div class=streifen style="top:470px;transform:rotate(1.2deg)">rechnet kleine</div><div class=streifen style="top:575px;transform:rotate(-1deg)">Bilder mit KI</div><div class=streifen style="top:680px;transform:rotate(1.6deg)">größer.</div>${kreis}<div class=txt>${esc(o.text)}</div>${bild}`
  return page(css, `<div class=papier></div>${inhalt}<div class=korn></div><script>document.fonts.ready.then(()=>document.body.dataset.fertig='1')</script>`)
}

export const FOLIEN = { notiz, kommentare, warnband, readme, collage }

export async function renderLab(eng, art, o, datei) {
  const pg = await eng._i.ctx.newPage()
  try {
    await pg.setViewportSize({ width: 1080, height: 1920 })
    const tmp = path.join(path.dirname(datei), `.lab-${art}-${o.typ}.html`)
    fs.mkdirSync(path.dirname(datei), { recursive: true })
    fs.writeFileSync(tmp, FOLIEN[art](o))
    await pg.goto('file://' + tmp)
    await pg.evaluate(() => document.fonts.ready.then(() => new Promise((r) => setTimeout(() => { document.body.dataset.fertig = '1'; r() }, 300))))
    await pg.waitForFunction(() => document.body.dataset.fertig === '1' && [...document.images].every((i) => i.complete), null, { timeout: 20000 })
    await pg.waitForTimeout(250)
    fs.writeFileSync(datei, await pg.screenshot({ type: 'jpeg', quality: 92 }))
    fs.rmSync(tmp, { force: true })
  } finally { await pg.close() }
}
