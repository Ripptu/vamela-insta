// TikTok-Folien 2–6 der Serie „5 GitHub-Repos“: je Folie ein Repo (Christian, 14.10.2026, Vorlage „Workflow Blueprint“):
// heller Grund mit weichem Blauverlauf in den Ecken und feinem Gitter, große Grotesk mit blauem Akzent, leichter Fließtext mit blauen
// Schlagwörtern, Glas-Fenster mit Repo-Karte und git-clone-Zeile. Sicherer Bereich: x 60–930, y 226–1440.
import fs from 'node:fs'
import path from 'node:path'
import { esc, GH } from './stil-klar.mjs'

const BASIS = path.resolve(new URL('.', import.meta.url).pathname)
const md = (t) => esc(t).replace(/\*([^*\n]+)\*/g, '<b class=bl>$1</b>').replace(/_([^_\n]+)_/g, '<i>$1</i>')
const titelHtml = (t) => esc(t).replace(/\*([^*\n]+)\*/g, '<span class=blau>$1</span>')
const PFEIL = '<svg viewBox="0 0 60 40" width="64" height="42"><path d="M4 20h50M38 5l16 15-16 15" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>'

/** Spezifikation: { nr (1–5), von (5), serie, repo 'owner/name', titel, text, sterne, lizenz, letzte, seed } */
export function repoFolieHtml({ nr = 1, von = 5, serie = '5 GitHub-Repos', repo = '', titel = '', text = '', sterne = '', lizenz = '', letzte = false, seed = 1 }) {
  const R = (n) => ((seed * 9301 + n * 49297) % 233280) / 233280
  const ecke = nr % 2 ? 'left' : 'right'
  return `<!doctype html><html><head><meta charset=utf-8><base href="file://${BASIS}/">
<style>
@font-face{font-family:'Inter Tight';font-weight:300;src:url(fonts/InterTight-400.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:400;src:url(fonts/InterTight-400.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:600;src:url(fonts/InterTight-600.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:700;src:url(fonts/InterTight-700.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:800;src:url(fonts/InterTight-800.woff2) format('woff2')}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;font-family:'Inter Tight',sans-serif;color:#141414}
.grund{position:absolute;inset:0;background:radial-gradient(ellipse at ${ecke === 'left' ? '0% 100%' : '100% 100%'},rgba(70,135,235,.55),transparent 55%),radial-gradient(ellipse at ${ecke === 'left' ? '100% 0%' : '0% 0%'},rgba(120,175,245,.5),transparent 48%),linear-gradient(180deg,#e9eaec,#e4e6e9)}
.gitter{position:absolute;left:0;right:0;bottom:0;height:900px;background:linear-gradient(rgba(255,255,255,.55) 1.5px,transparent 1.5px) 0 0/46px 46px,linear-gradient(90deg,rgba(255,255,255,.55) 1.5px,transparent 1.5px) 0 0/46px 46px;-webkit-mask-image:linear-gradient(180deg,transparent,#000 70%);mask-image:linear-gradient(180deg,transparent,#000 70%)}
.korn{position:absolute;inset:0;background:url(orange/noise.png);opacity:.12;mix-blend-mode:multiply}
.kopf{position:absolute;left:60px;right:150px;top:232px;display:flex;justify-content:space-between;font:700 36px/1 'Inter Tight';letter-spacing:.01em}
.kopf .a{color:#0a63d6}.kopf .n{color:#141414;font-variant-numeric:tabular-nums}
h1{position:absolute;left:60px;right:150px;top:330px;font:800 150px/.98 'Inter Tight';letter-spacing:-.04em;background:linear-gradient(95deg,#6a6c70,#141414 55%);-webkit-background-clip:text;color:transparent;white-space:nowrap}
h1 .blau{background:none;-webkit-text-fill-color:#0a63d6;color:#0a63d6}
.txt{position:absolute;left:60px;right:150px;top:560px;font:400 58px/1.28 'Inter Tight';letter-spacing:-.01em;color:#2a2d33}
.txt .bl{font-weight:700;color:#0a63d6}.txt i{font-style:italic}
.fenster{position:absolute;left:60px;right:150px;top:930px;border-radius:44px;background:linear-gradient(160deg,rgba(255,255,255,.78),rgba(255,255,255,.42));border:2px solid rgba(255,255,255,.85);box-shadow:0 30px 70px rgba(30,70,140,.28),inset 0 2px 0 rgba(255,255,255,.9);padding:44px 46px 50px;backdrop-filter:blur(10px)}
.ampel{display:flex;gap:16px;margin-bottom:30px}.ampel i{width:40px;height:40px;border-radius:50%}
.rname{display:flex;align-items:center;gap:18px;font:700 52px/1.1 'DejaVu Sans Mono',Menlo,monospace;color:#0a63d6;letter-spacing:-.03em;overflow-wrap:anywhere}.rname svg{flex:none;font-size:68px;color:#141414}
.chips{display:flex;flex-wrap:wrap;gap:14px;margin-top:28px}.chip{font:700 42px/1 'Inter Tight';padding:18px 32px;border-radius:999px;background:rgba(255,255,255,.8);border:2px solid rgba(20,20,20,.1)}.chip.g{background:#238636;border-color:#238636;color:#fff}
.cmd{margin-top:32px;border-radius:24px;background:#0d1117;color:#e6edf3;padding:26px 28px;font:600 33px/1.5 'DejaVu Sans Mono',Menlo,monospace;overflow-wrap:anywhere;box-shadow:inset 0 0 0 2px #30363d}.cmd .p{color:#ff7b72}.cmd .b{color:#58a6ff}
.fuss{position:absolute;left:60px;right:150px;top:1360px;display:flex;justify-content:space-between;align-items:center;font:700 38px/1 'Inter Tight';color:#141414}
.fuss .pfeil{display:flex;align-items:center;gap:14px}
.fuss .knopf{background:#f0532d;color:#fff;padding:22px 36px;border-radius:20px;font-weight:800;box-shadow:0 14px 28px rgba(240,83,45,.4)}
</style></head><body>
<div class=grund></div><div class=gitter></div><div class=korn></div>
<div class=kopf><span class=a>${esc(serie)}</span><span class=n>${String(nr).padStart(2, '0')} / ${String(von).padStart(2, '0')}</span></div>
<h1 id=h>${titelHtml(titel)}</h1>
<div class=txt id=t>${md(text)}</div>
<div class=fenster id=f><div class=ampel><i style=background:#ff5f56></i><i style=background:#ffbd2e></i><i style=background:#27c93f></i></div>
<div class=rname>${GH}<span>${esc(repo)}</span></div>
<div class=chips>${sterne ? `<span class=chip>★ ${esc(sterne)}</span>` : ''}${lizenz ? `<span class=chip>${esc(lizenz)}</span>` : ''}<span class="chip g">GRATIS</span></div>
<div class=cmd><span class=p>$</span> git clone <span class=b>github.com/${esc(repo)}</span></div></div>
<div class=fuss><span>${letzte ? 'Speichern, damit du sie wiederfindest' : ''}</span>${letzte ? '<span class=knopf>Speichern &amp; folgen</span>' : `<span class=pfeil>Weiter ${PFEIL}</span>`}</div>
<script>
document.fonts.ready.then(() => {
  const h = document.getElementById('h'), t = document.getElementById('t'), f = document.getElementById('f')
  // Titel schrumpfen, bis er in eine Zeile oder zwei passt und das Textfeld darunter Platz hat
  let s = 150; h.style.fontSize = s + 'px'
  while (h.scrollWidth > h.clientWidth + 1 && s > 70) { s -= 6; h.style.fontSize = s + 'px' }
  const hb = h.getBoundingClientRect().bottom
  t.style.top = (hb + 34) + 'px'
  let ts = 58; t.style.fontSize = ts + 'px'
  const tb = () => t.getBoundingClientRect().bottom
  while (tb() > 960 && ts > 38) { ts -= 2; t.style.fontSize = ts + 'px' }
  f.style.top = Math.max(tb() + 56, 800) + 'px'
  document.body.dataset.passt = f.getBoundingClientRect().bottom <= 1340 ? '1' : '0'
  document.body.dataset.fertig = '1'
})
</script></body></html>`
}

export async function renderRepoFolie(eng, { datei, ...o }) {
  const page = await eng._i.ctx.newPage()
  try {
    await page.setViewportSize({ width: 1080, height: 1920 })
    const tmp = path.join(path.dirname(datei), `.repo-${path.basename(datei)}.html`)
    fs.mkdirSync(path.dirname(datei), { recursive: true })
    fs.writeFileSync(tmp, repoFolieHtml(o))
    await page.goto('file://' + tmp)
    await page.waitForFunction(() => document.body.dataset.fertig === '1', null, { timeout: 20000 })
    if (await page.evaluate(() => document.body.dataset.passt) !== '1') throw new Error(`${path.basename(datei)}: Inhalt passt nicht in den sicheren Bereich`)
    await page.waitForTimeout(120)
    fs.writeFileSync(datei, await page.screenshot({ type: 'jpeg', quality: 93 }))
    fs.rmSync(tmp, { force: true })
    return datei
  } finally { await page.close() }
}
