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

export function posterHtml({ bild, kicker = '', zeilen = [], pille = '', pilleNach = 0, meta = null }) {
  const d = new Date()
  const [links, mitte, rechts] = meta || [`${MONATE[d.getMonth()]}©${d.getFullYear()}`, '@VAMELA.DE', 'WEBDESIGN']
  const zeilenHtml = zeilen.map((z, i) => `<div class=zeile><span>${esc(z)}</span></div>${pille && i === pilleNach ? `<div class=pille-wrap><span class=pille>${esc(pille)}</span></div>` : ''}`).join('')
  return `<!doctype html><html><head><meta charset=utf-8><base href="file://${BASIS}/">
<link rel=stylesheet href="orange/fonts.css">
<style>
@font-face{font-family:'Reenie Beanie';src:url(fonts/ReenieBeanie-400.woff2) format('woff2')}
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
.block{position:absolute;left:70px;right:70px;top:215px;text-align:center;color:#f6f1e6}
.kicker{font:400 78px/1 'Reenie Beanie',cursive;color:#ffd84d;letter-spacing:.12em;margin-bottom:10px;text-shadow:0 2px 14px rgba(0,30,80,.25)}
.zeile{white-space:nowrap;line-height:.9;font-family:Poppins,sans-serif;font-weight:800;letter-spacing:-.025em;text-transform:uppercase;text-shadow:0 6px 30px rgba(0,20,60,.28)}
.zeile span{display:inline-block}
.pille-wrap{position:relative;height:64px;z-index:2}
.pille{position:absolute;left:50%;top:2px;transform:translateX(-50%) rotate(-2deg);background:#ffc93c;color:#1b1b1b;font:800 italic 40px/1 Poppins,sans-serif;padding:14px 34px 12px;border-radius:999px;letter-spacing:.02em;white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,.18)}
</style></head><body>
<img class=foto src="file://${bild}"><div class=himmel></div><div class=korn></div>
<div class="stern a">${stern(12)}</div><div class="stern b">${stern(11)}</div>
<div class="meta oben"><span>${esc(links)}</span><span>${esc(mitte)}</span><span>${esc(rechts)}</span></div>
<div class="meta unten"><span>${esc(links)}</span><span>${esc(mitte)}</span><span>${esc(rechts)}</span></div>
<div class=block>${kicker ? `<div class=kicker>${esc(kicker)}</div>` : ''}${zeilenHtml}</div>
<script>
// Jede Zeile auf die volle Breite (940 px) ziehen, höchstens 260 px Schrift: kurze Zeilen werden riesig, lange kleiner
document.fonts.ready.then(() => {
  for (const z of document.querySelectorAll('.zeile span')) {
    z.style.fontSize = '100px'
    const f = Math.min(260, 100 * 940 / z.getBoundingClientRect().width)
    z.style.fontSize = f.toFixed(1) + 'px'
  }
  // Gesicht frei halten: Textblock höchstens 510 px hoch (Tier beginnt bei ~35 % der Höhe)
  const block = document.querySelector('.block')
  for (let i = 0; i < 6 && block.getBoundingClientRect().height > 510; i++) {
    const f = 510 / block.getBoundingClientRect().height
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
export function innenHtml({ seed = 1, kicker = '', kopf = '', text = '', pille = '', nr = 2, von = 6, meta = null }) {
  const d = new Date()
  const [links, mitte] = meta || [`${MONATE[d.getMonth()]}©${d.getFullYear()}`, '@VAMELA.DE']
  const sf = (n, o) => `<filter id="${n}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${o.f}" numOctaves="5" seed="${seed * 7 + o.s}"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 ${o.a} ${o.b}"/></filter>`
  return `<!doctype html><html><head><meta charset=utf-8><base href="file://${BASIS}/">
<link rel=stylesheet href="orange/fonts.css">
<style>
@font-face{font-family:'Reenie Beanie';src:url(fonts/ReenieBeanie-400.woff2) format('woff2')}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:#2a7bd6}
.himmel{position:absolute;inset:0;background:linear-gradient(180deg,#1f63c4 0%,#2f7fd8 45%,#6fb0ee 100%)}
.wolken{position:absolute;inset:0;width:1080px;height:1920px}
.korn{position:absolute;inset:0;background:url(orange/noise.png);opacity:.22;mix-blend-mode:overlay}
.schatten{position:absolute;inset:0;background:radial-gradient(ellipse at 40% 45%,rgba(8,35,90,.28),rgba(8,35,90,0) 70%)}
.meta{position:absolute;left:84px;right:150px;display:flex;justify-content:space-between;font:700 25px/1 Poppins,sans-serif;letter-spacing:.14em;color:#f2b33d}
.meta span:last-child{color:#fff}
.meta.oben{top:150px}
.stern{position:absolute;width:280px;height:280px}
.stern.a{top:-150px;right:-150px;transform:rotate(8deg)}.stern.b{bottom:90px;left:-130px;width:300px;height:300px;transform:rotate(-6deg)}
.stern svg{width:100%;height:100%;filter:drop-shadow(0 6px 18px rgba(0,0,0,.12))}
.block{position:absolute;left:84px;right:150px;top:260px;bottom:480px;display:flex;flex-direction:column;justify-content:center;color:#f6f1e6;text-shadow:0 4px 26px rgba(0,25,70,.3)}
.kicker{font:400 74px/1 'Reenie Beanie',cursive;color:#ffd84d;letter-spacing:.1em;margin-bottom:22px}
h1{font:800 120px/.95 Poppins,sans-serif;letter-spacing:-.025em;text-transform:uppercase;overflow-wrap:normal;hyphens:none}
p{font:600 48px/1.28 Poppins,sans-serif;margin-top:40px;color:#fff;max-width:840px}
.pille{align-self:flex-start;margin-top:56px;transform:rotate(-2deg);background:#ffc93c;color:#1b1b1b;font:800 italic 46px/1 Poppins,sans-serif;padding:20px 44px 18px;border-radius:999px;text-shadow:none;box-shadow:0 6px 20px rgba(0,0,0,.18)}
</style></head><body>
<div class=himmel></div>
<svg class=wolken viewBox="0 0 1080 1920"><defs>${sf('g', { f: '0.0028 0.0045', a: 2.6, b: -1.25, s: 1 })}${sf('k', { f: '0.006 0.009', a: 2.2, b: -1.15, s: 2 })}</defs>
<rect width=1080 height=1920 filter="url(#g)" opacity=".92"/><rect width=1080 height=1920 filter="url(#k)" opacity=".55"/></svg>
<div class=schatten></div><div class=korn></div>
<div class="stern a">${stern(12)}</div><div class="stern b">${stern(11)}</div>
<div class="meta oben"><span>${esc(links)}</span><span>${esc(mitte)}</span><span>${nr}/${von}</span></div>
<div class=block>${kicker ? `<div class=kicker>${esc(kicker)}</div>` : ''}<h1>${esc(kopf)}</h1>${text ? `<p>${esc(text)}</p>` : ''}${pille ? `<span class=pille>${esc(pille)}</span>` : ''}</div>
<script>
// Überschrift so groß wie möglich, solange der Block in den sicheren Bereich passt
document.fonts.ready.then(() => {
  const b = document.querySelector('.block'), h = document.querySelector('h1'), p = document.querySelector('p')
  let s = 150
  for (; s > 56; s -= 4) { h.style.fontSize = s + 'px'; if (p) p.style.fontSize = Math.max(40, Math.min(50, s * .42)) + 'px'; if (b.scrollHeight <= b.clientHeight + 1 && h.scrollWidth <= h.clientWidth + 1) break }
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
