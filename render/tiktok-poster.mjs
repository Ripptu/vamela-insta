// TikTok-Cover im Poster-Stil (Christian, 13.10.2026, Vorlage: Tierporträts mit Sonnenbrille vor blauem Himmel):
// Vollbild-Foto 1080 × 1920, darüber eine kleine Handschrift-Zeile (gelb), riesige Überschrift in Großbuchstaben, jede Zeile auf
// die volle Breite gezogen, optional eine gelbe Pille, Metazeile oben und unten, weiße Sternformen in zwei Ecken, Filmkorn.
//
//   import { renderPoster } from './tiktok-poster.mjs'
//   await renderPoster(eng, { bild: '/abs/k02-tiktok.png', kicker: 'Heute gratis …', zeilen: ['NACH DEM ABO', 'TOT!'], pille: 'DEIN QR-CODE', datei: 'out/k02/tiktok/01.jpg' })
import fs from 'node:fs'
import path from 'node:path'

const BASIS = path.resolve(new URL('.', import.meta.url).pathname)
const MONATE = ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ']
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Sternform (Starburst) als SVG, n Zacken. */
function stern(n = 12, r1 = 1, r2 = 0.58) {
  const pkt = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1
    const a = (Math.PI * i) / n - Math.PI / 2
    pkt.push(`${(50 + 50 * r * Math.cos(a)).toFixed(2)},${(50 + 50 * r * Math.sin(a)).toFixed(2)}`)
  }
  return `<svg viewBox="0 0 100 100"><polygon points="${pkt.join(' ')}" fill="#fff"/></svg>`
}

export const GH = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg>'
export const sterneText = (t) => { const m = String(t || '').match(/rund\s+([\d.]+)|([\d.]+)/); if (!m) return ''; const z = Number((m[1] || m[2]).replace(/\./g, '')); return z >= 1000 ? (Math.round(z / 100) / 10).toString().replace('.', ',') + 'k' : String(z) }

export function posterHtml({ bild, kicker = '', zeilen = [], pille = '', pilleNach = 0, meta = null, repo = null }) {
  const d = new Date()
  const [links, mitte, rechts] = meta || [`${MONATE[d.getMonth()]}©${d.getFullYear()}`, '@VAMELA.DE', 'WEBDESIGN']
  const mark = -1 // Christian 13.10.2026: Hero wie anfangs, ohne Markierung
  const zeilenHtml = zeilen.map((z, i) => `<div class=zeile><span${i === mark ? ' class=sel' : ''}>${i === mark ? '<i class=gl></i>' : ''}${esc(z)}${i === mark ? '<i class=gr></i>' : ''}</span></div>${pille && i === pilleNach ? `<div class=pille-wrap><span class=pille>${esc(pille)}</span></div>` : ''}`).join('')
  return `<!doctype html><html><head><meta charset=utf-8><base href="file://${BASIS}/">
<link rel=stylesheet href="orange/fonts.css">
<style>
@font-face{font-family:'Reenie Beanie';src:url(fonts/ReenieBeanie-400.woff2) format('woff2')}
@font-face{font-family:Caveat;font-weight:400 700;src:url(fonts/Caveat.woff2) format('woff2')}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:#2f7fd8}
.foto{position:absolute;inset:0;width:1080px;height:1920px;object-fit:cover;object-position:center 60%}
.himmel{position:absolute;inset:0 0 auto 0;height:900px;background:linear-gradient(180deg,rgba(10,40,90,.28),rgba(10,40,90,0))}
.korn{position:absolute;inset:0;background:url(orange/noise.png);opacity:.22;mix-blend-mode:overlay}
.meta{position:absolute;left:84px;right:84px;display:flex;justify-content:space-between;font:700 25px/1 Poppins,sans-serif;letter-spacing:.14em;color:#f2b33d}
.meta span:last-child{color:#fff}
.meta.oben{top:150px}.meta.unten{bottom:96px}
.stern{position:absolute;width:300px;height:300px}
.stern.a{top:-150px;right:-150px;transform:rotate(8deg)}.stern.b{bottom:150px;left:-110px;width:330px;height:330px;transform:rotate(-6deg)}
.stern svg{width:100%;height:100%;filter:drop-shadow(0 6px 18px rgba(0,0,0,.12))}
.gh-badge{position:absolute;left:84px;top:196px;display:flex;align-items:center;gap:14px;background:#0d1117;color:#fff;font:700 30px/1 Poppins,sans-serif;padding:14px 26px 14px 20px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.25)}
.gh-badge svg{font-size:40px}.gh-badge b{color:#3fb950;font-weight:800}
.repo-karte{position:absolute;left:84px;right:150px;top:1445px;background:rgba(13,17,23,.94);border:2px solid #30363d;border-radius:30px;padding:26px 32px;color:#e6edf3;box-shadow:0 14px 40px rgba(0,0,0,.35)}
.repo-karte .name{display:flex;align-items:center;gap:16px;font:700 42px/1 'DejaVu Sans Mono',Menlo,monospace;color:#58a6ff;letter-spacing:-.02em;white-space:nowrap}
.repo-karte .name svg{font-size:46px;color:#e6edf3;flex:none}
.repo-karte .zeile2{display:flex;gap:14px;margin-top:20px;font:600 27px/1 Poppins,sans-serif;align-items:center}
.repo-karte .chip{border:2px solid #30363d;border-radius:999px;padding:9px 18px;white-space:nowrap}
.repo-karte .gratis{background:#238636;border-color:#238636;color:#fff;font-weight:800}
.block{position:absolute;left:70px;right:70px;top:215px;text-align:center;color:#f6f1e6}
.kicker{font:700 96px/1 Caveat,cursive;color:#ffe45e;letter-spacing:.02em;margin-bottom:6px;-webkit-text-stroke:2px #0a2f73;paint-order:stroke fill;text-shadow:0 4px 0 #0a2f73,0 6px 22px rgba(0,30,80,.45);transform:rotate(-2deg)}
.zeile{white-space:nowrap;line-height:.9;font-family:Poppins,sans-serif;font-weight:800;letter-spacing:-.025em;text-transform:uppercase;text-shadow:0 6px 30px rgba(0,20,60,.28)}
.zeile span{display:inline-block}
.pille-wrap{position:relative;height:64px;z-index:2}
.pille{position:absolute;left:50%;top:2px;transform:translateX(-50%) rotate(-2deg);background:#ffc93c;color:#1b1b1b;font:800 italic 40px/1 Poppins,sans-serif;padding:14px 34px 12px;border-radius:999px;letter-spacing:.02em;white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,.18)}
</style></head><body>
<img class=foto src="file://${bild}"><div class=himmel></div><div class=korn></div>
<div class="stern a">${stern(12)}</div><div class="stern b">${stern(11)}</div>
<div class="meta oben"><span>${esc(links)}</span><span>${esc(mitte)}</span><span>${esc(rechts)}</span></div>
<div class="meta unten"><span>${esc(links)}</span><span>${esc(mitte)}</span><span>${esc(rechts)}</span></div>
<div class=block${repo ? ' style="top:290px" data-max="440"' : ''}>${kicker ? `<div class=kicker>${esc(kicker)}</div>` : ''}${zeilenHtml}</div>
${repo ? `<div class=gh-badge>${GH}<span>GitHub-Tool · <b>0 €</b></span></div><div class=repo-karte><div class=name>${GH}<span>${esc(repo.name)}</span></div><div class=zeile2>${repo.sterne ? `<span class=chip>★ ${esc(repo.sterne)}</span>` : ''}${repo.lizenz ? `<span class=chip>${esc(repo.lizenz)}</span>` : ''}<span class="chip gratis">GRATIS</span></div></div>` : ''}
<script>
// Jede Zeile auf die volle Breite (940 px) ziehen, höchstens 260 px Schrift: kurze Zeilen werden riesig, lange kleiner
document.fonts.ready.then(() => {
  for (const z of document.querySelectorAll('.zeile span')) {
    z.style.fontSize = '100px'
    const f = Math.min(260, 100 * 940 / z.getBoundingClientRect().width)
    z.style.fontSize = f.toFixed(1) + 'px'
  }
  // Gesicht frei halten: Textblock höchstens 510 px hoch (Tier beginnt bei ~35 % der Höhe)
  const block = document.querySelector('.block'), maxH = Number(block.dataset.max || 510)
  for (let i = 0; i < 6 && block.getBoundingClientRect().height > maxH; i++) {
    const f = maxH / block.getBoundingClientRect().height
    for (const z of document.querySelectorAll('.zeile span')) z.style.fontSize = (parseFloat(z.style.fontSize) * f * 0.98).toFixed(1) + 'px'
  }
  document.body.dataset.fertig = '1'
})
</script></body></html>`
}

/** Rendert das Poster als JPG. eng aus render/engine.mjs (createEngine). */
export async function renderPoster(eng, { datei, ...opts }) {
  const page = await eng._i.ctx.newPage()
  try {
    await page.setViewportSize({ width: 1080, height: 1920 })
    const tmp = path.join(path.dirname(datei), `.poster-${path.basename(datei)}.html`)
    fs.mkdirSync(path.dirname(datei), { recursive: true })
    fs.writeFileSync(tmp, posterHtml(opts))
    await page.goto('file://' + tmp)
    await page.waitForFunction(() => document.body.dataset.fertig === '1' && [...document.images].every((i) => i.complete), null, { timeout: 20000 })
    await page.waitForTimeout(150)
    fs.writeFileSync(datei, await page.screenshot({ type: 'jpeg', quality: 92 }))
    fs.rmSync(tmp, { force: true })
    return datei
  } finally { await page.close() }
}

/**
 * Innenseiten im Poster-Look (Christian, 13.10.2026: „die Karussells sollen alle in diesem Stil bleiben mit dem Himmel“):
 * gemalter Himmel mit Wolken (SVG-Rauschen, je Beitrag ein anderes Muster), Kicker in Handschrift, Überschrift in
 * Großbuchstaben, Fließtext weiß, optional gelbe Pille. Sicherer Bereich: oben 230, unten 480, rechts 150 (TikTok-Leiste).
 */
const STOP = new Set(['dass', 'eine', 'einen', 'einer', 'nicht', 'nur', 'auch', 'oder', 'aber', 'wenn', 'dein', 'deine', 'deinen', 'damit', 'wird', 'sind', 'mehr', 'viele', 'alle'])
/** *x* wird blau und fett, _x_ kursiv in Serif (Instrument Serif). Ohne Markup: das längste Wort wird hervorgehoben. */
export function markiere(t) {
  let h = esc(t)
  if (!/\*[^*\n]+\*|_[^_\n]+_/.test(h)) {
    const w = (h.match(/[\p{L}\d][\p{L}\d'’-]{4,}/gu) || []).filter((x) => !STOP.has(x.toLowerCase())).sort((x, y) => y.length - x.length)[0]
    if (w) h = h.replace(w, `*${w}*`)
  }
  return h.replace(/\*([^*\n]+)\*/g, '<mark>$1</mark>').replace(/_([^_\n]+)_/g, '<em>$1</em>').replace(/==([^=\n]+)==/g, '<mark>$1</mark>')
}

const ICONS = {
  herz: '<path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.2 2.9 4.5 6.4 4.5c2 0 3.6 1 5.6 3.2 2-2.2 3.6-3.2 5.6-3.2 3.5 0 5.6 3.7 4 7.3C19.5 16.4 12 21 12 21Z" fill="#fff"/>',
  merk: '<path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15.2c0 .6-.7 1-1.2.6L12 17l-5.3 3.8c-.5.4-1.2 0-1.2-.6V5A1.5 1.5 0 0 1 7 3.5Z" fill="#fff"/>',
  stern: '<path d="m12 2.8 2.8 5.9 6.4.9-4.6 4.5 1.1 6.4L12 17.5l-5.7 3 1.1-6.4L2.8 9.6l6.4-.9L12 2.8Z" fill="#fff"/>',
  code: '<path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
}
/** Glänzendes 3D-Symbol in Blau (oder Grau). */
const pop = (art, { x, y, g = 260, r = 0, grau = false, z = 1 }) => `<div class=pop style="left:${x}px;top:${y}px;width:${g}px;height:${g}px;transform:rotate(${r}deg);z-index:${z}${grau ? ';--a:#e4e8ee;--b:#9aa3b2;--c:rgba(60,70,90,.4)' : ''}"><svg viewBox="0 0 24 24">${ICONS[art]}</svg></div>`
const CURSOR = ['X...........', 'XX..........', 'XOX.........', 'XOOX........', 'XOOOX.......', 'XOOOOX......', 'XOOOOOX.....', 'XOOOOOOX....', 'XOOOOOOOX...', 'XOOOOOOOOX..', 'XOOOOOXXXXX.', 'XOOXOOX.....', 'XOX.XOOX....', 'XX..XOOX....', 'X....XOOX...', '.....XOOX...', '......XX....']
const cursor = (x, y, px = 20, r = -8) => `<svg style="position:absolute;left:${x}px;top:${y}px;transform:rotate(${r}deg);filter:drop-shadow(0 14px 18px rgba(20,50,120,.3));z-index:5" width="${12 * px}" height="${CURSOR.length * px}" viewBox="0 0 12 ${CURSOR.length}" shape-rendering="crispEdges">${CURSOR.map((z, j) => [...z].map((c, i) => c === '.' ? '' : `<rect x="${i}" y="${j}" width="1" height="1" fill="${c === 'X' ? '#101828' : (i + j) % 2 ? '#fff' : '#d9e6fb'}"/>`).join('')).join('')}</svg>`

/**
 * Innenseiten im Carousel-Look (Christian 13.10.2026, Vorlage „Carousel Design“, aber in Blau): heller Pixel-Verlauf mit blauen
 * Farbwolken, fette Überschrift mit blauem Akzent und kursivem Serif-Wort, 3D-Symbole, Pixel-Mauszeiger, Pillen, „Swipe“-Label.
 * Sicherer Bereich: oben 230, unten 480, rechts 150 (TikTok-Leiste); Deko darf in den Rand laufen.
 */
export function innenHtml({ seed = 1, kicker = '', kopf = '', text = '', pille = '', nr = 2, von = 6, repo = null, link = '', letzte = false }) {
  const R = (n) => ((seed * 9301 + n * 49297) % 233280) / 233280
  const deko = letzte
    ? pop('merk', { x: 700, y: 1240, g: 290, r: 8 }) + pop('herz', { x: -100, y: 1290, g: 260, r: -14, grau: true }) + cursor(800, 1500, 22, -6)
    : [
      pop('herz', { x: nr % 2 ? -110 : 880, y: 290 + R(1) * 70, g: 280, r: nr % 2 ? -14 : 12 }),
      pop(['merk', 'stern', 'code'][nr % 3], { x: nr % 2 ? 840 : -90, y: 1130 + R(2) * 50, g: 240, r: nr % 2 ? 10 : -12, grau: nr % 3 === 0 }),
    ].join('') + (nr % 2 === 0 ? cursor(800, 1260, 17, -6) : '')
  return `<!doctype html><html><head><meta charset=utf-8><base href="file://${BASIS}/">
<link rel=stylesheet href="orange/fonts.css">
<style>
@font-face{font-family:'Instrument Serif';font-style:italic;src:url(orange/fonts/instrument-serif-400-italic.woff2) format('woff2')}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:#eef3fa}
canvas{position:absolute;inset:0;width:1080px;height:1920px}
.korn{position:absolute;inset:0;background:url(orange/noise.png);opacity:.10;mix-blend-mode:multiply}
.kopf{position:absolute;left:84px;right:150px;top:170px;display:flex;justify-content:space-between;align-items:center;font:700 26px/1 Poppins,sans-serif;color:#1b2a4a;z-index:6}
.kopf span:last-child{font-weight:600;color:#3a5a99}
.pillen{position:absolute;left:84px;right:150px;top:262px;display:flex;gap:14px;flex-wrap:wrap;z-index:6}
.pille-k{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.78);border:2px solid rgba(255,255,255,.95);box-shadow:0 8px 22px rgba(40,90,190,.14);border-radius:999px;padding:13px 24px 13px 18px;font:700 28px/1 Poppins,sans-serif;color:#1b2a4a;backdrop-filter:blur(6px)}
.pille-k i{width:18px;height:18px;border-radius:50%;background:linear-gradient(145deg,#6fb6ff,#1f63c4)}
.pille-k svg{font-size:30px}
.pille-k.mono{font:700 27px/1 'DejaVu Sans Mono',Menlo,monospace}
.block{position:absolute;left:84px;right:150px;top:390px;bottom:470px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;color:#14213d;z-index:6}
h1{font:800 112px/1.0 Poppins,sans-serif;letter-spacing:-.03em;word-spacing:.08em;overflow-wrap:normal;hyphens:none;text-wrap:balance}
h1 mark,p mark{background:linear-gradient(180deg,#3d8df0,#1b57b8);-webkit-background-clip:text;background-clip:text;color:transparent}
h1 em,p em{font:italic 400 1.18em/1 'Instrument Serif',serif;letter-spacing:0;background:linear-gradient(180deg,#3d8df0,#1b57b8);-webkit-background-clip:text;background-clip:text;color:transparent}
p{font:500 46px/1.32 Poppins,sans-serif;margin-top:38px;color:#26324d;max-width:800px;text-wrap:balance}
p mark{font-weight:700}
.knopf{margin-top:52px;display:flex;align-items:center;gap:14px;background:linear-gradient(180deg,#4a9bf5,#1f63c4);color:#fff;font:700 38px/1 Poppins,sans-serif;padding:24px 42px;border-radius:22px;box-shadow:0 14px 30px rgba(31,99,196,.4),inset 0 2px 0 rgba(255,255,255,.4)}
.link{margin-top:44px;max-width:100%;background:#fff;border:2px solid #d5e2f7;border-radius:26px;padding:24px 30px;color:#14213d;font:700 33px/1.25 'DejaVu Sans Mono',Menlo,monospace;box-shadow:0 14px 34px rgba(40,90,190,.18);text-align:left}
.link small{display:block;font:600 22px/1 Poppins,sans-serif;color:#6b7a99;margin-bottom:12px;letter-spacing:.08em}
.link b{color:#1f63c4;overflow-wrap:anywhere}
.swipe{position:absolute;left:84px;top:1520px;transform:skewX(-14deg);background:linear-gradient(180deg,#5aa6f7,#2a74d6);color:#fff;font:700 28px/1 Poppins,sans-serif;padding:13px 26px;border-radius:6px;box-shadow:0 8px 18px rgba(31,99,196,.35);z-index:6}
.swipe span{display:inline-block;transform:skewX(14deg)}
.pop{position:absolute;border-radius:30%;background:linear-gradient(150deg,var(--a,#8ec6ff),var(--b,#1f63c4));box-shadow:inset 0 -14px 28px var(--c,rgba(0,40,130,.5)),inset 0 14px 24px rgba(255,255,255,.6),0 34px 50px rgba(30,90,200,.3);display:grid;place-items:center}
.pop svg{width:52%;height:52%;filter:drop-shadow(0 6px 8px rgba(0,30,110,.4))}
</style></head><body>
<canvas id=bg width=1080 height=1920></canvas><div class=korn></div>
${deko}
<div class=kopf><span>VAMELA</span><span>Follow</span></div>
<div class=pillen>${repo ? `<span class="pille-k mono">${GH}${esc(repo)}</span>` : ''}${kicker ? `<span class=pille-k><i></i>${esc(kicker)}</span>` : ''}</div>
<div class=block><h1>${markiere(kopf)}</h1>${text ? `<p>${markiere(text)}</p>` : ''}${link ? `<div class=link><small>SUCH IN GITHUB ODER GIB EIN</small>${GH.replace('<svg', '<svg style="font-size:34px;vertical-align:-6px;margin-right:12px"')}<b>github.com/${esc(link)}</b></div>` : ''}${pille ? `<span class=knopf>${pille}</span>` : ''}</div>
${letzte ? '' : '<div class=swipe><span>Swipe</span></div>'}
<script>
const c = document.getElementById('bg'), x = c.getContext('2d'), seed = ${seed}
const r = (n) => ((seed * 9301 + n * 49297) % 233280) / 233280
x.fillStyle = '#f1f5fb'; x.fillRect(0, 0, 1080, 1920)
const blob = (cx, cy, rad, col) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 1080, 1920) }
blob(900 - r(1) * 200, 260 + r(2) * 200, 640, 'rgba(70,150,245,.75)')
blob(80 + r(3) * 160, 1500 + r(4) * 200, 720, 'rgba(60,140,245,.8)')
blob(540 + r(5) * 300 - 150, 1000 + r(6) * 200, 520, 'rgba(150,200,255,.7)')
blob(120, 520, 420, 'rgba(190,220,255,.7)')
// Pixel-Mosaik wie in der Vorlage: auf 40 × 71 Kacheln verkleinern und hart wieder aufziehen
const k = document.createElement('canvas'); k.width = 40; k.height = 71
k.getContext('2d').drawImage(c, 0, 0, 40, 71)
x.imageSmoothingEnabled = false; x.clearRect(0, 0, 1080, 1920); x.drawImage(k, 0, 0, 1080, 1920)
const bl = document.createElement('canvas'); bl.width = 1080; bl.height = 1920
document.fonts.ready.then(() => {
  const b = document.querySelector('.block'), h = document.querySelector('h1'), p = document.querySelector('p')
  let s = 120
  for (; s > 54; s -= 4) { h.style.fontSize = s + 'px'; if (p) p.style.fontSize = Math.max(38, Math.min(48, s * .44)) + 'px'; if (b.scrollHeight <= b.clientHeight + 1 && h.scrollWidth <= h.clientWidth + 1) break }
  document.body.dataset.fertig = '1'; document.body.dataset.passt = b.scrollHeight <= b.clientHeight + 1 ? '1' : '0'
})
</script></body></html>`
}

export async function renderInnen(eng, { datei, ...opts }) {
  const page = await eng._i.ctx.newPage()
  try {
    await page.setViewportSize({ width: 1080, height: 1920 })
    const tmp = path.join(path.dirname(datei), `.innen-${path.basename(datei)}.html`)
    fs.mkdirSync(path.dirname(datei), { recursive: true })
    fs.writeFileSync(tmp, innenHtml(opts))
    await page.goto('file://' + tmp)
    await page.waitForFunction(() => document.body.dataset.fertig === '1', null, { timeout: 20000 })
    if (await page.evaluate(() => document.body.dataset.passt) !== '1') throw new Error(`${path.basename(datei)}: Text passt nicht in den sicheren Bereich`)
    await page.waitForTimeout(150)
    fs.writeFileSync(datei, await page.screenshot({ type: 'jpeg', quality: 92 }))
    fs.rmSync(tmp, { force: true })
    return datei
  } finally { await page.close() }
}
