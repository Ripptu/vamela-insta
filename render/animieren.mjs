// Mikro-Animationen für die Karussell-Folien (Christian, 14.10.2026: „mega smooth, Stil gleich, nur Micro-Animations“).
// Folien im Look „Klar“: dieselbe HTML-Seite wie das Standbild (render/stil-klar.mjs), dazu Web-Animations auf vorhandene
// Elemente; jedes Bild wird mit gesetzter Animationszeit fotografiert (deterministisch, keine ruckelnde Bildschirmaufnahme)
// und mit ffmpeg zu einem Video zusammengesetzt. Cover: das fertige Standbild mit langsamem, nahtlosem Zoom (2 %).
//   animiereKlar(eng, spec, 'out/k02/02.mp4')   → 6 s, 30 fps, H.264, nahtlose Schleife
//   animiereStandbild('out/k02/01.jpg', 'out/k02/01.mp4')
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { klarHtml, HOEHEN } from './stil-klar.mjs'

export const SEK = 6, FPS = 30

function ffmpeg(args) {
  return new Promise((ok, fail) => {
    const c = spawn(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', ...args])
    let err = ''; c.stderr.on('data', (d) => { err += d }); c.on('error', fail)
    c.on('close', (k) => (k === 0 ? ok() : fail(new Error(`ffmpeg ${k}: ${err.slice(-300)}`))))
  })
}

// Choreografie in Millisekunden; alles Wiederkehrende hat eine Periode, die in 6 s aufgeht (nahtlose Schleife)
const CHOREO = `(() => {
  const D = ${SEK * 1000}, weich = 'cubic-bezier(.22,1,.36,1)'
  const an = (el, kf, o) => el && el.animate(kf, { duration: D, iterations: Infinity, fill: 'both', ...o })
  // Ein- und Ausblenden innerhalb der Schleife: 0–0,9 s rein, 3,6–4 s leicht zurück, damit der Übergang zum Anfang weich bleibt
  const rein = (el, verz, dy = 26) => an(el, [
    { opacity: 0, transform: 'translateY(' + dy + 'px)', offset: 0 },
    { opacity: 0, transform: 'translateY(' + dy + 'px)', offset: verz / D },
    { opacity: 1, transform: 'none', offset: (verz + 700) / D, easing: weich },
    { opacity: 1, transform: 'none', offset: 0.93 },
    { opacity: 0, transform: 'translateY(-' + dy / 3 + 'px)', offset: 1 },
  ], { easing: 'linear' })
  const h = document.getElementById('h'), block = document.getElementById('block')
  rein(h, 0)
  ;[...block.children].filter((e) => e !== h).forEach((e, i) => rein(e, 260 + i * 140, 18))
  block.querySelectorAll('li').forEach((e, i) => rein(e, 360 + i * 120, 14))
  // Markierung zieht sich auf, Griffe ploppen
  h.querySelectorAll('.sel').forEach((s, i) => {
    const v = 520 + i * 160
    s.animate([{ transform: 'scaleX(0)', transformOrigin: 'left center', offset: 0 }, { transform: 'scaleX(0)', transformOrigin: 'left center', offset: v / D }, { transform: 'scaleX(1)', transformOrigin: 'left center', offset: (v + 520) / D, easing: weich }, { transform: 'scaleX(1)', transformOrigin: 'left center', offset: 0.93 }, { transform: 'scaleX(0)', transformOrigin: 'left center', offset: 1 }],
      { duration: D, iterations: Infinity, fill: 'both', pseudoElement: '::before' })
    s.querySelectorAll('.gl,.gr').forEach((g) => an(g, [{ opacity: 0, transform: 'scaleY(0)', offset: 0 }, { opacity: 0, transform: 'scaleY(0)', offset: (v + 380) / D }, { opacity: 1, transform: 'scaleY(1.15)', offset: (v + 620) / D }, { opacity: 1, transform: 'scaleY(1)', offset: (v + 760) / D }, { opacity: 1, transform: 'scaleY(1)', offset: 0.9 }, { opacity: 0, transform: 'scaleY(0)', offset: 1 }]))
  })
  h.querySelectorAll('.kreis .kr path').forEach((p) => { const l = p.getTotalLength(); p.style.strokeDasharray = l; an(p, [{ strokeDashoffset: l, offset: 0 }, { strokeDashoffset: l, offset: .2 }, { strokeDashoffset: 0, offset: .45, easing: weich }, { strokeDashoffset: 0, offset: .9 }, { strokeDashoffset: l, offset: 1 }]) })
  // Funkeln: zweimal pro Schleife kurz aufblitzen und drehen
  document.querySelectorAll('.funkel').forEach((f, i) => {
    const r = parseFloat((f.style.transform.match(/-?[\\d.]+/) || [0])[0])
    an(f, [{ transform: 'rotate(' + r + 'deg) scale(1)' }, { transform: 'rotate(' + (r + 18) + 'deg) scale(1.22)' }, { transform: 'rotate(' + r + 'deg) scale(1)' }], { duration: D / 2, delay: -i * 350, easing: 'ease-in-out' })
  })
  // Dialogblase schwebt, Pfeil »» schubst nach rechts, Knopf atmet
  document.querySelectorAll('.dialog').forEach((d) => { const t = d.style.transform; an(d, [{ transform: t + ' translateY(0)' }, { transform: t + ' translateY(-10px)' }, { transform: t + ' translateY(0)' }], { duration: D / 2, easing: 'ease-in-out' }) })
  document.querySelectorAll('.chev').forEach((c) => an(c, [{ transform: 'translateX(0)' }, { transform: 'translateX(10px)', offset: .5 }, { transform: 'translateX(0)' }], { duration: D / 4, easing: 'ease-in-out' }))
  document.querySelectorAll('.knopf').forEach((k) => an(k, [{ transform: 'scale(1)' }, { transform: 'scale(1.045)' }, { transform: 'scale(1)' }], { duration: D / 2, easing: 'ease-in-out' }))
  document.querySelectorAll('.blase').forEach((b) => an(b, [{ transform: 'rotate(-3deg) translateY(0)' }, { transform: 'rotate(-3deg) translateY(-8px)' }, { transform: 'rotate(-3deg) translateY(0)' }], { duration: D / 2, easing: 'ease-in-out' }))
  document.getAnimations().forEach((a) => a.pause())
  window.__setze = (ms) => document.getAnimations().forEach((a) => { a.currentTime = ms })
})()`

/** Eine Folie im Look „Klar“ als Video (Format aus spec.format: feed 1080 × 1350, tiktok/story 1080 × 1920). */
export async function animiereKlar(eng, spec, ziel, { sek = SEK, fps = FPS } = {}) {
  const page = await eng._i.ctx.newPage()
  const tmp = path.join(path.dirname(ziel), `.anim-${path.basename(ziel, '.mp4')}`)
  try {
    const H = HOEHEN[spec.format] || 1350
    await page.setViewportSize({ width: 1080, height: H })
    fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true })
    const html = path.join(tmp, 'seite.html')
    fs.writeFileSync(html, klarHtml(spec))
    await page.goto('file://' + html)
    await page.waitForFunction(() => document.body.dataset.fertig === '1', null, { timeout: 20000 })
    await page.evaluate(CHOREO)
    const n = Math.round(sek * fps)
    for (let i = 0; i < n; i++) {
      await page.evaluate((ms) => window.__setze(ms), (i * 1000) / fps)
      fs.writeFileSync(path.join(tmp, `${String(i).padStart(4, '0')}.jpg`), await page.screenshot({ type: 'jpeg', quality: 92 }))
    }
    await ffmpeg(['-framerate', String(fps), '-i', path.join(tmp, '%04d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', ziel])
    return ziel
  } finally { await page.close(); fs.rmSync(tmp, { recursive: true, force: true }) }
}

/** Standbild (z. B. Cover) mit langsamem, nahtlosem Zoom um 2 % (hin und zurück). */
export async function animiereStandbild(bild, ziel, { sek = SEK, fps = FPS, zoom = 0.02 } = {}) {
  const n = Math.round(sek * fps)
  const { height = 1350 } = await (await import('sharp')).default(bild).metadata()
  // zoompan rechnet auf einem vergrößerten Bild, damit der Zoom nicht ruckelt
  const vf = `scale=iw*4:ih*4,zoompan=z='1+${zoom / 2}*(1-cos(2*PI*on/${n}))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=1080x${height}:fps=${fps}`
  await ffmpeg(['-loop', '1', '-i', bild, '-vf', vf, '-frames:v', String(n), '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', ziel])
  return ziel
}
