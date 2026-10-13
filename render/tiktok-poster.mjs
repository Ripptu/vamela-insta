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
.stern.a{top:-70px;right:-80px;transform:rotate(8deg)}.stern.b{bottom:150px;left:-110px;width:330px;height:330px;transform:rotate(-6deg)}
.stern svg{width:100%;height:100%;filter:drop-shadow(0 6px 18px rgba(0,0,0,.12))}
.block{position:absolute;left:70px;right:70px;top:270px;text-align:center;color:#f6f1e6}
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
