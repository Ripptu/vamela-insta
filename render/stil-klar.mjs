// Look „Klar“ (Christian, 13.10.2026, Vorlagen lazohdesign und Ella Content Club): heller Grund, schwarze Grotesk, Textmarkierung in Blau mit
// Griffpunkten, Sprechblasen, handgezeichneter Kringel und Unterstreichung in Orange, Funkelsterne, Handschrift-Notiz mit Pfeil.
// Ein Baustein für alle Formate: feed 1080 × 1350, story und tiktok 1080 × 1920.
//
// Auszeichnung im Text:  *Wort*  blaue Markierung   ==Wort==  orangefarbener Kringel   _Wort_  orange Unterstreichung
import fs from 'node:fs'
import path from 'node:path'

const BASIS = path.resolve(new URL('.', import.meta.url).pathname)
export const HOEHEN = { feed: 1350, story: 1920, tiktok: 1920 }
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const GH = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg>'
const STOP = new Set(['dass', 'eine', 'einen', 'einer', 'nicht', 'nur', 'auch', 'oder', 'aber', 'wenn', 'dein', 'deine', 'deinen', 'damit', 'wird', 'sind', 'mehr', 'viele', 'alle', 'wieder', 'diese', 'dieser'])

const KREIS = '<svg class=kr viewBox="0 0 300 100" preserveAspectRatio="none"><path d="M40 20C90 -2 230 -2 275 28 305 52 270 90 150 95 55 98 4 72 12 44 20 14 120 4 200 8 262 12 298 32 292 58" fill="none" stroke="#f0532d" stroke-width="3.2" stroke-linecap="round"/><path d="M52 12C110 -6 240 4 282 34 300 58 250 94 140 92 60 90 10 66 22 38 34 14 130 8 215 14" fill="none" stroke="#f0532d" stroke-width="2.4" stroke-linecap="round" opacity=".85"/></svg>'
const SPARK = (g, x, y, r = 0) => `<svg class=funkel style="left:${x};top:${y};width:${g}px;height:${g}px;transform:rotate(${r}deg)" viewBox="0 0 40 40"><defs><linearGradient id="sg${g}${x}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#f0a81a"/></linearGradient></defs><path d="M20 1c1.5 9 4 14 19 19-15 5-17.5 10-19 19-1.5-9-4-14-19-19C16 15 18.5 10 20 1Z" fill="url(#sg${g}${x})"/></svg>`
const DIALOG = '<svg viewBox="0 0 64 48" width="100%" height="100%"><path d="M8 2h48a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6H30L16 46V36H8a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6Z" fill="#b9bcc2"/><circle cx="20" cy="19" r="3.4" fill="#4a4d55"/><circle cx="32" cy="19" r="3.4" fill="#4a4d55"/><circle cx="44" cy="19" r="3.4" fill="#4a4d55"/></svg>'
const CHEV = (c = '#9a9ca2') => `<svg class=chev viewBox="0 0 56 36"><path d="m4 4 14 14L4 32M26 4l14 14-14 14" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`

/** Auszeichnung in HTML umsetzen. Ohne Auszeichnung wird das längste Wort blau markiert. */
export function auszeichnen(t, { auto = true } = {}) {
  let h = esc(t).replace(/\*\*/g, '*')
  if (auto && !/\*[^*\n]+\*|==[^=\n]+==|_[^_\n]+_/.test(h)) {
    const w = (h.match(/[\p{L}\d][\p{L}\d'’-]{4,}/gu) || []).filter((x) => !STOP.has(x.toLowerCase()) && x.length <= 14).sort((x, y) => y.length - x.length)[0]
    if (w) h = h.replace(w, `*${w}*`)
  }
  return h
    .replace(/\*([^*\n]+)\*/g, '<span class=sel><i class=gl></i><b>$1</b><i class=gr></i></span>')
    .replace(/==([^=\n]+)==/g, `<span class=kreis><b>$1</b>${KREIS}</span>`)
    .replace(/_([^_\n]+)_/g, '<span class=unter>$1</span>')
    .replace(/(<span class=(?:sel|kreis|unter)>.*?<\/span>)([.,:;!?…]+)/g, '<span class=nw>$1$2</span>')
}

/**
 * spec: { typ: 'cover' | 'text' | 'cta', format: 'feed' | 'story' | 'tiktok', kopf, text, blase, notiz, nr, repo, link, knopf, seed }
 *  - blase: kleine Sprechblase am Kopf („(GRATIS-TOOL!)“), notiz: Handschrift mit Pfeil, nr: Zähler links oben („2.“)
 */
export function klarHtml({ typ = 'text', format = 'feed', kopf = '', text = '', blase = '', notiz = '', nr = '', repo = '', link = '', knopf = '', marke = 'vamela.de', seed = 1, bild = '' }) {
  const H = HOEHEN[format] || 1350
  const hoch = H > 1400
  const sicher = format === 'feed' ? { o: 70, u: 110, r: 84 } : { o: 190, u: 470, r: 150 }
  // Zeilen: Absätze mit „→“ werden zur Liste (Text nach „ / “ oder mehrere Sätze)
  const saetze = String(text || '').split(/(?<=[.!?])\s+/).filter(Boolean)
  const liste = saetze.length >= 3 ? saetze : null
  // Mit Motivbild (Cover, Story): Überschrift oben, das Bild als Karte darunter
  const karte = bild ? (format === 'feed' ? { top: 690, h: H - 690 } : { top: 1000, h: H - 1000 }) : null
  const kopfHtml = typ === 'cover' || typ === 'cta' ? auszeichnen(kopf) : auszeichnen(kopf)
  const woerter = String(kopf).replace(/[*_=]/g, '').split(/\s+/).filter(Boolean).length
  const satz = woerter > (typ === 'cover' ? 6 : 4)
  const kopfKlasse = (typ === 'cover' ? 'gross' : 'mittel') + (satz ? ' satz' : '')
  const absatz = text && !liste ? `<p>${auszeichnen(text, { auto: false })}</p>` : ''
  const lst = liste ? `<ul>${liste.map((x) => `<li>${auszeichnen(x, { auto: false }).replace(/^(.{1,28}?)([:,.])/, '<b>$1</b>$2')}</li>`).join('')}</ul>` : ''
  return `<!doctype html><html><head><meta charset=utf-8><base href="file://${BASIS}/">
<style>
@font-face{font-family:'Inter Tight';font-weight:400;src:url(fonts/InterTight-400.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:500;src:url(fonts/InterTight-500.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:600;src:url(fonts/InterTight-600.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:700;src:url(fonts/InterTight-700.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:800;src:url(fonts/InterTight-800.woff2) format('woff2')}
@font-face{font-family:Caveat;src:url(fonts/Caveat.woff2) format('woff2')}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:${H}px;overflow:hidden;background:#ecede9;font-family:'Inter Tight',sans-serif;color:#141414}
.grund{position:absolute;inset:0;background:radial-gradient(ellipse at 20% 0%,#f5f5f2,#e9eae6 70%)}
.korn{position:absolute;inset:0;background:url(orange/noise.png);opacity:.13;mix-blend-mode:multiply}
.kopfzeile{position:absolute;left:${sicher.r}px;right:${sicher.r + (hoch ? 0 : 0)}px;top:${sicher.o}px;padding-bottom:22px;border-bottom:3px solid #141414;display:flex;justify-content:${nr ? 'space-between' : 'center'};align-items:center;font:700 38px/1 'Inter Tight'}
.kopfzeile .marke{font-weight:800;letter-spacing:-.02em;font-size:40px}.kopfzeile .marke b{font-weight:500}
.repo{display:flex;align-items:center;gap:10px;font:600 26px/1 'DejaVu Sans Mono',Menlo,monospace;color:#3b4a66}.repo svg{font-size:30px}
.block{position:absolute;left:${sicher.r}px;right:${sicher.r}px;top:${sicher.o + 110}px;bottom:${karte ? H - karte.top + 20 : sicher.u}px;display:flex;flex-direction:column;justify-content:center;${typ === 'cover' ? '' : 'align-items:flex-start'}}
h1{font-weight:800;letter-spacing:-.022em;word-spacing:.07em;line-height:1.0;text-wrap:balance;overflow-wrap:normal;hyphens:none}
h1.gross{text-transform:uppercase;font-size:150px;line-height:.98}
h1.mittel{font-size:96px;text-transform:uppercase;line-height:1.02}
h1.satz{text-transform:none;letter-spacing:-.03em;line-height:1.04;font-size:104px}
h1.satz.gross{font-size:150px}
p{margin-top:44px;font:400 ${hoch ? 46 : 42}px/1.34 'Inter Tight';max-width:820px;letter-spacing:-.01em;color:#202020}
ul{list-style:none;margin-top:48px}li{font:400 ${hoch ? 44 : 40}px/1.28 'Inter Tight';margin-bottom:34px;padding-left:62px;position:relative;letter-spacing:-.01em}
li::before{content:'→';position:absolute;left:0;top:-2px;font-weight:600}li b{font-weight:800}
.nw,.sel,.kreis{white-space:nowrap}
.sel{position:relative;display:inline-block;padding:0 .14em;margin:0 .06em}.sel b{font-weight:800;position:relative;z-index:1;color:#3b6aa0}
.sel::before{content:'';position:absolute;inset:.06em 0;background:#b9d6fb;border-radius:3px}
.sel .gl,.sel .gr{position:absolute;top:.04em;bottom:.04em;width:.045em;background:#0a63d6;z-index:2}.sel .gl{left:0}.sel .gr{right:0}
.sel .gl::before{content:'';position:absolute;left:50%;top:-.14em;width:.2em;height:.2em;border-radius:50%;background:#0a63d6;transform:translateX(-50%)}
.sel .gr::before{content:'';position:absolute;left:50%;bottom:-.14em;width:.2em;height:.2em;border-radius:50%;background:#0a63d6;transform:translateX(-50%)}
.kreis{position:relative;display:inline-block;padding:.06em .3em;margin:.02em -.1em;color:#f0532d}.kreis b{font-weight:800;position:relative;z-index:1}
.kreis .kr{position:absolute;inset:-.12em -.14em;width:calc(100% + .28em);height:calc(100% + .24em);overflow:visible}
.unter{position:relative;display:inline-block}.unter::after{content:'';position:absolute;left:0;right:0;bottom:-.04em;height:.07em;background:#f0532d;border-radius:4px}
p .unter::after,li .unter::after{height:3px;bottom:-4px}
.blase{position:absolute;background:#fff;color:#141414;font:700 ${hoch ? 30 : 28}px/1 'Inter Tight';text-transform:uppercase;padding:18px 28px;border-radius:26px;box-shadow:0 10px 28px rgba(20,20,20,.16);white-space:nowrap;z-index:5}
.blase::after{content:'';position:absolute;left:44px;bottom:-12px;width:26px;height:26px;background:#fff;transform:rotate(45deg);border-radius:4px}
.funkel{position:absolute;filter:drop-shadow(0 6px 8px rgba(200,140,0,.35));z-index:4}
.dialog{position:absolute;width:118px;height:90px;z-index:4;filter:drop-shadow(0 8px 10px rgba(0,0,0,.18))}
.notiz{position:absolute;font:700 ${hoch ? 50 : 44}px/1.05 Caveat,cursive;color:#f0532d;transform:rotate(-4deg);text-transform:uppercase;letter-spacing:.02em;max-width:420px;z-index:5}
.pfeil{position:absolute;z-index:5}
.karte{position:absolute;left:0;right:0;top:${karte ? karte.top : 0}px;height:${karte ? karte.h : 0}px;overflow:hidden;background:#d8d9d4;z-index:2}
.karte img{width:100%;height:100%;object-fit:cover;display:block}
.fuss{position:absolute;left:${sicher.r}px;right:${sicher.r}px;bottom:${format === 'feed' ? 64 : sicher.u - 70}px;display:flex;justify-content:space-between;align-items:center;font:500 30px/1 'DejaVu Sans Mono',Menlo,monospace;letter-spacing:.06em;color:#3a3a3a}
.chev{width:60px;height:38px}
.fuss.aufbild{color:#fff;z-index:6;text-shadow:0 2px 12px rgba(0,0,0,.4)}
.link{margin-top:48px;background:#fff;border:2px solid #d9dbe0;border-radius:24px;padding:24px 30px;font:700 33px/1.2 'DejaVu Sans Mono',Menlo,monospace;color:#141414;box-shadow:0 12px 30px rgba(20,20,20,.1);max-width:100%}
.link small{display:block;font:700 22px/1 'Inter Tight';letter-spacing:.1em;color:#6b6f78;margin-bottom:12px}.link b{color:#0a63d6;overflow-wrap:anywhere}.link svg{font-size:32px;vertical-align:-6px;margin-right:12px}
.knopf{margin-top:50px;background:#f0532d;color:#fff;font:700 40px/1 'Inter Tight';padding:26px 46px;border-radius:20px;box-shadow:0 14px 30px rgba(240,83,45,.35);display:inline-block}
</style></head><body>
<div class=grund></div><div class=korn></div>
<div class=kopfzeile>${nr ? `<span>${esc(nr)}</span>${repo ? `<span class=repo>${GH}${esc(repo)}</span>` : ''}` : `<span class=marke>vamela<b>.de</b></span>`}</div>
<div class=block id=block style="${blase ? 'padding-top:76px;' : ''}"><h1 class="${kopfKlasse}" id=h>${kopfHtml}</h1>${absatz}${lst}${link ? `<div class=link><small>SUCH IN GITHUB ODER GIB EIN</small>${GH}<b>github.com/${esc(link)}</b></div>` : ''}${knopf ? `<span class=knopf>${knopf}</span>` : ''}</div>
${karte ? `<div class=karte><img src="file://${esc(bild)}"></div>` : ''}
<div id=deko></div>
<div class="fuss${karte ? ' aufbild' : ''}"><span>${typ === 'cta' || karte ? '' : esc(marke)}</span>${typ === 'cta' ? '' : CHEV(karte ? '#ffffff' : '#9a9ca2')}</div>
<script>
const typ = ${JSON.stringify(typ)}, hoch = ${hoch}, seed = ${seed}, blaseT = ${JSON.stringify(blase)}, notizT = ${JSON.stringify(notiz)}, R = ${sicher.r}
document.fonts.ready.then(() => {
  const b = document.getElementById('block'), h = document.getElementById('h')
  let s = typ === 'cover' ? ${hoch ? 168 : 150} : ${hoch ? 108 : 100}
  const breitOk = () => [...h.querySelectorAll('.nw,.sel,.kreis')].every((e) => e.getBoundingClientRect().right <= 1080 - R + 2) && h.scrollWidth <= h.clientWidth + 1
  for (; s > 46; s -= 3) { h.style.fontSize = s + 'px'; if (b.scrollHeight <= b.clientHeight + 1 && breitOk()) break }
  window.__breitOk = breitOk()
  const d = document.getElementById('deko'), hb = h.getBoundingClientRect()
  // Sprechblase rechts oben an der Überschrift
  if (blaseT) { const e = document.createElement('div'); e.className = 'blase'; e.textContent = blaseT; d.appendChild(e); e.style.left = Math.min(1080 - R - e.offsetWidth, hb.left + Math.min(hb.width, 520) - 40) + 'px'; e.style.top = Math.max(${sicher.o + 96}, hb.top - 74) + 'px' }
  // Dialog-Blase und Funkelsterne als Zierde, je nach Seite wechselnd
  const z = (seed % 3)
  if (typ === 'cover') {
    d.insertAdjacentHTML('beforeend', ${JSON.stringify(SPARK(64, '0', '0', 8))}.replace('left:0;top:0', 'left:' + (1080 - R - 70) + 'px;top:' + (hb.bottom - 40) + 'px'))
    d.insertAdjacentHTML('beforeend', ${JSON.stringify(SPARK(36, '0', '0', -6))}.replace('left:0;top:0', 'left:' + (1080 - R - 20) + 'px;top:' + (hb.bottom - 90) + 'px'))
  } else if (typ === 'text' && !blaseT && hb.top > ${sicher.o + 260}) {
    d.insertAdjacentHTML('beforeend', '<div class=dialog style="left:' + (z === 0 ? R : 1080 - R - 118) + 'px;top:' + Math.max(hb.top - 130, ${sicher.o + 130}) + 'px;transform:rotate(' + (z === 0 ? -6 : 8) + 'deg)">' + ${JSON.stringify(DIALOG)} + '</div>')
    d.insertAdjacentHTML('beforeend', ${JSON.stringify(SPARK(54, '0', '0', 6))}.replace('left:0;top:0', 'left:' + (1080 - R - 60) + 'px;top:' + (hb.top - 30) + 'px'))
  } else if (typ === 'cta') {
    d.insertAdjacentHTML('beforeend', ${JSON.stringify(SPARK(80, '0', '0', 6))}.replace('left:0;top:0', 'left:' + (1080 - R - 90) + 'px;top:' + (hb.top - 70) + 'px'))
  }
  // Handschrift-Notiz mit gezeichnetem Pfeil
  if (notizT) {
    const n = document.createElement('div'); n.className = 'notiz'; n.textContent = notizT; d.appendChild(n)
    const bb = b.getBoundingClientRect(), last = [...b.children].pop().getBoundingClientRect()
    const nx = R + 110, ny = Math.min(last.bottom + 70, ${H - sicher.u} - 120)
    n.style.left = nx + 'px'; n.style.top = ny + 'px'
    d.insertAdjacentHTML('beforeend', '<svg class=pfeil style="left:' + (R + 30) + 'px;top:' + (ny - 62) + 'px" width="110" height="90" viewBox="0 0 110 90"><path d="M95 78C60 80 30 62 28 18" fill="none" stroke="#f0532d" stroke-width="4" stroke-linecap="round"/><path d="m12 32 16-20 14 22" fill="none" stroke="#f0532d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>')
  }
  document.body.dataset.fertig = '1'; document.body.dataset.passt = b.scrollHeight <= b.clientHeight + 1 && window.__breitOk ? '1' : '0'
})
</script></body></html>`
}

export async function renderKlar(eng, { datei, ...spec }) {
  const page = await eng._i.ctx.newPage()
  try {
    await page.setViewportSize({ width: 1080, height: HOEHEN[spec.format] || 1350 })
    const tmp = path.join(path.dirname(datei), `.klar-${path.basename(datei)}.html`)
    fs.mkdirSync(path.dirname(datei), { recursive: true })
    fs.writeFileSync(tmp, klarHtml(spec))
    await page.goto('file://' + tmp)
    await page.waitForFunction(() => document.body.dataset.fertig === '1', null, { timeout: 20000 })
    if (await page.evaluate(() => document.body.dataset.passt) !== '1') throw new Error(`${path.basename(datei)}: Text passt nicht in den sicheren Bereich`)
    await page.waitForTimeout(120)
    fs.writeFileSync(datei, await page.screenshot({ type: 'jpeg', quality: 93 }))
    fs.rmSync(tmp, { force: true })
    return datei
  } finally { await page.close() }
}

/** Schalter in plan/params.json: "look": "klar" (Standard) oder "orange" (alter Look). */
export const klarAktiv = () => { try { return (JSON.parse(fs.readFileSync(path.join(BASIS, '../plan/params.json'), 'utf8')).look ?? 'klar') !== 'orange' } catch { return true } }
export const BLASE = { tipps: '(Tipp!)', werkzeuge: '(Gratis-Tool!)', fundstuecke: '(Gratis auf GitHub!)', design: '(Design-Tipp)' }
