// TikTok-Folien 2–6 mit wechselnden Layouts (Christian, 14.10.2026: „zu langweilig, mehr Effekte und Formatierungen“).
// Themen: hell (grauer Grund mit Punktraster), blau (Verlauf), dunkel (GitHub-Dunkel mit Gitter).
// Layouts: aussage, karten, terminal, zahl, abschluss. Auszeichnung wie in stil-klar.mjs: *blau markiert*, ==Kringel==, _unterstrichen_.
import fs from 'node:fs'
import path from 'node:path'
import { auszeichnen, esc, GH } from './stil-klar.mjs'

const BASIS = path.resolve(new URL('.', import.meta.url).pathname)
const THEMEN = {
  hell: { bg: '#ecede9', text: '#141414', zweit: '#2a2f3a', chip: '#fff', chipText: '#141414', kante: '#d7d9de', akzent: '#0a63d6' },
  blau: { bg: '#1f63c4', text: '#ffffff', zweit: '#e6f0ff', chip: 'rgba(255,255,255,.16)', chipText: '#fff', kante: 'rgba(255,255,255,.35)', akzent: '#ffe45e' },
  dunkel: { bg: '#0d1117', text: '#f0f6fc', zweit: '#c9d1d9', chip: '#161b22', chipText: '#c9d1d9', kante: '#30363d', akzent: '#58a6ff' },
}
const ZIERDE = {
  stern: (c = '#f7b500') => `<svg viewBox="0 0 40 40"><path d="M20 1c1.5 9 4 14 19 19-15 5-17.5 10-19 19-1.5-9-4-14-19-19C16 15 18.5 10 20 1Z" fill="${c}"/></svg>`,
  haken: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pfeil: (c) => `<svg viewBox="0 0 160 120"><path d="M10 14C60 6 130 30 124 96" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/><path d="m98 78 26 28 26-30" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  merk: '<svg viewBox="0 0 24 24"><path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15.2c0 .6-.7 1-1.2.6L12 17l-5.3 3.8c-.5.4-1.2 0-1.2-.6V5A1.5 1.5 0 0 1 7 3.5Z" fill="#fff"/></svg>',
  herz: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.2 2.9 4.5 6.4 4.5c2 0 3.6 1 5.6 3.2 2-2.2 3.6-3.2 5.6-3.2 3.5 0 5.6 3.7 4 7.3C19.5 16.4 12 21 12 21Z" fill="#fff"/></svg>',
}
const chev = (c) => `<svg viewBox="0 0 56 36" width="62" height="40"><path d="m4 4 14 14L4 32M26 4l14 14-14 14" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`

/** Spezifikation: { layout, thema, nr, von, repo, sticker, kopf, text, punkte[], befehl, kommentar, zahl{stern,lizenz,forks}, link, knopf, seed } */
export function folieHtml(o) {
  const { layout = 'aussage', thema = 'hell', nr = 2, von = 6, repo = '', sticker = '', kopf = '', text = '', punkte = [], befehl = '', kommentar = '', zahl = null, link = '', knopf = '', seed = 1 } = o
  const T = THEMEN[thema]
  const R = (n) => ((seed * 9301 + n * 49297) % 233280) / 233280
  const punktBalken = Array.from({ length: von }, (_, i) => `<i class="${i + 1 === nr ? 'an' : i + 1 < nr ? 'war' : ''}"></i>`).join('')
  const grund = {
    hell: `radial-gradient(circle at 1px 1px,rgba(20,20,20,.13) 1.6px,transparent 1.7px) 0 0/38px 38px,radial-gradient(ellipse at 100% 0%,#cfe2fb,transparent 55%),#ecede9`,
    blau: `radial-gradient(ellipse at 85% 8%,rgba(160,205,255,.55),transparent 55%),radial-gradient(ellipse at 10% 95%,rgba(10,50,140,.55),transparent 60%),linear-gradient(170deg,#3d8df0,#1f63c4 55%,#174a9c)`,
    dunkel: `linear-gradient(rgba(48,54,61,.45) 1px,transparent 1px) 0 0/54px 54px,linear-gradient(90deg,rgba(48,54,61,.45) 1px,transparent 1px) 0 0/54px 54px,radial-gradient(ellipse at 80% 0%,rgba(31,111,235,.28),transparent 55%),#0d1117`,
  }[thema]
  const kopfH = auszeichnen(kopf)
  let inhalt = ''
  if (layout === 'aussage') {
    inhalt = `<div class=sticker style="transform:rotate(${-5 + R(1) * 4}deg)">${esc(sticker || 'Gratis')}</div>
<div class=geist>${String(nr).padStart(2, '0')}</div>
<h1>${kopfH}</h1>${text ? `<p>${auszeichnen(text, { auto: false })}</p>` : ''}
<div class=zeig>${ZIERDE.pfeil('#f0532d')}<span>${esc(sticker ? 'weiter' : 'wisch')}</span></div>`
  } else if (layout === 'karten') {
    inhalt = `<div class=sticker style="transform:rotate(-4deg)">${esc(sticker || 'Das kann sie')}</div>
<h1 class=klein>${kopfH}</h1>
<div class=karten>${punkte.map((p, i) => `<div class=karte style="transform:rotate(${i % 2 ? 1.1 : -1.1}deg)"><span class=ico>${ZIERDE.haken}</span><span>${auszeichnen(p, { auto: false })}</span></div>`).join('')}</div>`
  } else if (layout === 'terminal') {
    inhalt = `<h1 class=klein>${kopfH}</h1>
<div class=term><div class=balkenkopf><i style=background:#ff5f56></i><i style=background:#ffbd2e></i><i style=background:#27c93f></i><span>Terminal</span></div>
<div class=code><div><span class=g>~</span> <span class=p>$</span> git clone <span class=g>\\</span><br>&nbsp;&nbsp;<span class=b>https://github.com/${esc(repo)}</span></div><div class=kom># ${esc(kommentar || 'Fertig. Mehr braucht es nicht.')}</div><div><span class=g>~</span> <span class=p>$</span> <span class=cur></span></div></div></div>
${text ? `<p class=zweit>${auszeichnen(text, { auto: false })}</p>` : ''}`
  } else if (layout === 'zahl') {
    inhalt = `<div class=sticker style="transform:rotate(3deg)">${esc(sticker || 'Nachher')}</div>
<h1>${kopfH}</h1>
<div class=repokarte><div class=rname>${GH}<span>${esc(repo)}</span></div>${text ? `<div class=rtext>${esc(text)}</div>` : ''}
<div class=rchips>${zahl?.stern ? `<span class=rc>★ ${esc(zahl.stern)}</span>` : ''}${zahl?.forks ? `<span class=rc>⑂ ${esc(zahl.forks)}</span>` : ''}${zahl?.lizenz ? `<span class=rc>${esc(zahl.lizenz)}</span>` : ''}<span class="rc gruen">GRATIS</span></div></div>`
  } else {
    inhalt = `<div class=pop>${ZIERDE.merk}</div>
<h1>${kopfH}</h1>${text ? `<p>${auszeichnen(text, { auto: false })}</p>` : ''}
${link ? `<div class=linkbox><small>SUCH IN GITHUB ODER GIB EIN</small>${GH}<b>github.com/${esc(link)}</b></div>` : ''}
<div class=knopfzeile><span class=knopf>${knopf || 'Speichern'}</span><span class=folgen>+ Folgen</span></div>`
  }
  const deko = layout === 'abschluss'
    ? `<div class=fk style="right:150px;top:560px;width:150px;transform:rotate(14deg)">${ZIERDE.stern('#ffe45e')}</div>`
    : `<div class=fk style="right:${150 + R(2) * 20}px;top:${372 + R(3) * 24}px;width:84px;transform:rotate(${R(4) * 20}deg)">${ZIERDE.stern(thema === 'hell' ? '#f7b500' : '#ffe45e')}</div>`
  return `<!doctype html><html><head><meta charset=utf-8><base href="file://${BASIS}/">
<style>
@font-face{font-family:'Inter Tight';font-weight:400;src:url(fonts/InterTight-400.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:600;src:url(fonts/InterTight-600.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:700;src:url(fonts/InterTight-700.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:800;src:url(fonts/InterTight-800.woff2) format('woff2')}
@font-face{font-family:Caveat;font-weight:400 700;src:url(fonts/Caveat.woff2) format('woff2')}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;font-family:'Inter Tight',sans-serif;color:${T.text}}
.grund{position:absolute;inset:0;background:${grund}}
.korn{position:absolute;inset:0;background:url(orange/noise.png);opacity:${thema === 'hell' ? .12 : .16};mix-blend-mode:${thema === 'hell' ? 'multiply' : 'overlay'}}
.kopf{position:absolute;left:84px;right:150px;top:226px;display:flex;flex-direction:column;gap:22px;z-index:6}
.repo{align-self:flex-start;display:flex;align-items:center;gap:12px;background:${T.chip};color:${T.chipText};border:2px solid ${T.kante};border-radius:18px;padding:13px 22px 13px 16px;font:700 28px/1 'DejaVu Sans Mono',Menlo,monospace;letter-spacing:-.02em;box-shadow:0 8px 22px rgba(0,0,0,.14)}
.repo svg{font-size:34px}
.bal{display:flex;gap:10px}.bal i{flex:1;height:8px;border-radius:99px;background:${thema === 'hell' ? 'rgba(20,20,20,.18)' : 'rgba(255,255,255,.28)'}}.bal i.war{background:${thema === 'hell' ? 'rgba(20,20,20,.55)' : 'rgba(255,255,255,.75)'}}.bal i.an{background:#f0532d}
.inhalt{position:absolute;left:84px;right:150px;top:350px;bottom:480px;display:flex;flex-direction:column;justify-content:center;z-index:5}
h1{font:800 112px/1.0 'Inter Tight';letter-spacing:-.025em;word-spacing:.06em;text-wrap:balance;hyphens:none;overflow-wrap:normal;color:${T.text}}
h1.klein{font-size:92px}
p{font:500 46px/1.32 'Inter Tight';margin-top:40px;color:${T.zweit};max-width:810px}
p.zweit{font-size:42px}
.nw,.sel,.kreis{white-space:nowrap}
.sel{position:relative;display:inline-block;padding:0 .14em;margin:0 .06em}.sel b{font-weight:800;position:relative;z-index:1;color:${thema === 'hell' ? '#3b6aa0' : thema === 'dunkel' ? '#9ec5ff' : '#1b4f9e'}}
.sel::before{content:'';position:absolute;inset:.06em 0;background:${thema === 'dunkel' ? 'rgba(56,139,253,.28)' : '#b9d6fb'};border-radius:3px}
.sel .gl,.sel .gr{position:absolute;top:.04em;bottom:.04em;width:.045em;background:#0a63d6;z-index:2}.sel .gl{left:0}.sel .gr{right:0}
.sel .gl::before,.sel .gr::before{content:'';position:absolute;left:50%;width:.2em;height:.2em;border-radius:50%;background:#0a63d6;transform:translateX(-50%)}.sel .gl::before{top:-.14em}.sel .gr::before{bottom:-.14em}
.kreis{position:relative;display:inline-block;padding:.06em .3em;margin:.02em -.1em;color:#f0532d}.kreis b{font-weight:800;position:relative;z-index:1}.kreis .kr{position:absolute;inset:-.12em -.14em;width:calc(100% + .28em);height:calc(100% + .24em);overflow:visible}
.unter{position:relative;display:inline-block}.unter::after{content:'';position:absolute;left:0;right:0;bottom:-.04em;height:.07em;background:#f0532d;border-radius:4px}
.sticker{align-self:flex-start;margin-bottom:34px;background:#ffe45e;color:#141414;font:800 36px/1 'Inter Tight';text-transform:uppercase;letter-spacing:.02em;padding:16px 28px;border-radius:10px;box-shadow:6px 8px 0 rgba(20,20,20,.9)}
.geist{position:absolute;right:-20px;top:-40px;font:800 420px/1 'Inter Tight';letter-spacing:-.06em;color:transparent;-webkit-text-stroke:3px ${thema === 'hell' ? 'rgba(20,20,20,.16)' : 'rgba(255,255,255,.22)'};z-index:-1}
.zeig{margin-top:46px;display:flex;align-items:flex-end;gap:10px;color:#f0532d}.zeig svg{width:110px;height:84px}.zeig span{font:700 52px/1 Caveat;transform:rotate(-4deg);margin-bottom:6px}
.karten{display:flex;flex-direction:column;gap:26px;margin-top:50px}
.karte{display:flex;align-items:center;gap:26px;background:${T.chip};border:2px solid ${T.kante};border-radius:28px;padding:30px 34px;font:600 44px/1.22 'Inter Tight';color:${T.chipText};box-shadow:0 14px 34px rgba(0,0,0,.14)}
.ico{flex:none;width:68px;height:68px;border-radius:50%;background:linear-gradient(145deg,#4a9bf5,#1f63c4);display:grid;place-items:center;box-shadow:0 8px 16px rgba(31,99,196,.4)}.ico svg{width:60%;height:60%}
.term{margin-top:50px;background:#010409;border:2px solid #30363d;border-radius:24px;overflow:hidden;box-shadow:0 24px 54px rgba(0,0,0,.45)}
.balkenkopf{display:flex;align-items:center;gap:12px;padding:18px 24px;background:#161b22;border-bottom:2px solid #30363d}.balkenkopf i{width:20px;height:20px;border-radius:50%}.balkenkopf span{margin-left:14px;font:600 24px/1 'DejaVu Sans Mono',Menlo,monospace;color:#8b949e}
.code{padding:30px 26px 34px;font:600 29px/1.55 'DejaVu Sans Mono',Menlo,monospace;color:#e6edf3}.code .g{color:#3fb950}.code .p{color:#ff7b72}.code .b{color:#58a6ff}.code .kom{color:#8b949e;margin:6px 0}
.cur{display:inline-block;width:18px;height:34px;background:#e6edf3;vertical-align:-6px}
.repokarte{margin-top:52px;background:${T.chip};border:2px solid ${T.kante};border-radius:30px;padding:34px 36px;box-shadow:0 20px 46px rgba(0,0,0,.28);color:${T.chipText}}
.rname{display:flex;align-items:center;gap:16px;font:700 44px/1 'DejaVu Sans Mono',Menlo,monospace;color:${thema === 'blau' ? '#fff' : '#0a63d6'};letter-spacing:-.02em}.rname svg{font-size:48px}
.rtext{margin-top:20px;font:500 34px/1.3 'Inter Tight';opacity:.9}
.rchips{display:flex;flex-wrap:wrap;gap:14px;margin-top:26px}.rc{border:2px solid ${T.kante};border-radius:999px;padding:12px 24px;font:700 32px/1 'Inter Tight'}.rc.gruen{background:#238636;border-color:#238636;color:#fff}
.pop{width:230px;height:230px;border-radius:30%;background:linear-gradient(150deg,#8ec6ff,#1f63c4);box-shadow:inset 0 -14px 28px rgba(0,40,130,.5),inset 0 14px 24px rgba(255,255,255,.6),0 34px 50px rgba(0,30,110,.4);display:grid;place-items:center;margin-bottom:40px;transform:rotate(-8deg)}.pop svg{width:52%;height:52%;filter:drop-shadow(0 6px 8px rgba(0,30,110,.4))}
.linkbox{margin-top:44px;background:#fff;color:#141414;border-radius:24px;padding:24px 30px;font:700 32px/1.25 'DejaVu Sans Mono',Menlo,monospace;box-shadow:0 14px 34px rgba(0,0,0,.28);align-self:flex-start;max-width:100%}.linkbox small{display:block;font:700 21px/1 'Inter Tight';letter-spacing:.1em;color:#6b6f78;margin-bottom:12px}.linkbox svg{font-size:32px;vertical-align:-6px;margin-right:10px}.linkbox b{color:#0a63d6;overflow-wrap:anywhere}
.knopfzeile{display:flex;align-items:center;gap:20px;margin-top:46px}.knopf{background:#f0532d;color:#fff;font:800 42px/1 'Inter Tight';padding:28px 48px;border-radius:22px;box-shadow:0 16px 30px rgba(240,83,45,.45),inset 0 2px 0 rgba(255,255,255,.35)}.folgen{background:#fff;color:#141414;font:800 42px/1 'Inter Tight';padding:28px 40px;border-radius:22px;box-shadow:0 12px 26px rgba(0,0,0,.25)}
.fk{position:absolute;z-index:4;filter:drop-shadow(0 6px 10px rgba(0,0,0,.25))}.fk svg{width:100%;height:auto}
.fuss{position:absolute;left:84px;right:150px;bottom:410px;display:flex;justify-content:space-between;align-items:center;font:600 28px/1 'DejaVu Sans Mono',Menlo,monospace;letter-spacing:.06em;color:${thema === 'hell' ? '#3a3a3a' : 'rgba(255,255,255,.8)'};z-index:6}
</style></head><body>
<div class=grund></div><div class=korn></div>${deko}
<div class=kopf>${repo ? `<span class=repo>${GH}${esc(repo)}</span>` : ''}<div class=bal>${punktBalken}</div></div>
<div class=inhalt id=block>${inhalt}</div>
<script>
document.fonts.ready.then(() => {
  const b = document.getElementById('block'), h = b.querySelector('h1')
  const ok = () => b.scrollHeight <= b.clientHeight + 1 && [...h.querySelectorAll('.nw,.sel,.kreis')].every((e) => e.getBoundingClientRect().right <= 1080 - 150 + 2) && h.scrollWidth <= h.clientWidth + 1
  let s = parseFloat(getComputedStyle(h).fontSize)
  for (; s > 48 && !ok(); s -= 3) h.style.fontSize = s + 'px'
  document.body.dataset.fertig = '1'; document.body.dataset.passt = ok() ? '1' : '0'
})
</script></body></html>`
}

export async function renderFolie(eng, { datei, ...o }) {
  const page = await eng._i.ctx.newPage()
  try {
    await page.setViewportSize({ width: 1080, height: 1920 })
    const tmp = path.join(path.dirname(datei), `.folie-${path.basename(datei)}.html`)
    fs.mkdirSync(path.dirname(datei), { recursive: true })
    fs.writeFileSync(tmp, folieHtml(o))
    await page.goto('file://' + tmp)
    await page.waitForFunction(() => document.body.dataset.fertig === '1', null, { timeout: 20000 })
    if (await page.evaluate(() => document.body.dataset.passt) !== '1') throw new Error(`${path.basename(datei)}: Text passt nicht in den sicheren Bereich`)
    await page.waitForTimeout(120)
    fs.writeFileSync(datei, await page.screenshot({ type: 'jpeg', quality: 93 }))
    fs.rmSync(tmp, { force: true })
    return datei
  } finally { await page.close() }
}
