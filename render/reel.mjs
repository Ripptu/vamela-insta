// Sprech-Reel im Look „Orange“: 1080 × 1920, H.264/AAC, 15–25 s, KI-Stimme (render/stimme.mjs), wortgenaue Untertitel.
// Auftrag Christian, 12.10.2026: „Krass gut geschnittene Reels mit KI-Stimme, tiefe epische deutsche Stimme.“
//
// Strecke: Sprechtext → Stimme (Vorrat/API) → Wortzeiten (Whisper, abgeglichen auf den Sprechtext, render/wortzeiten.mjs)
//   → Schnittplan (render/schnitt.mjs) → Bilder je Szene (render/bilder.mjs: Vorrat/API; „bild: k20“ = vorhandenes Bild;
//   „aufnahme: URL“ = Bildschirmaufnahme der vamela.de-Seite in Handybreite) → eine HTML-Seite mit allen Ebenen
//   (orange.css, Poppins/Instrument Serif) → Gestaltungsprüfung auf Stichproben-Frames (render/pruefen.mjs: Rand, Größe,
//   Überlappung, Kontrast; Gegenmaßnahmen v1/stark) → jeder Frame per Chromium-Screenshot (CDP) in ffmpeg (libx264)
//   → Ton: Stimme + leiser selbst erzeugter Ambient-Pad (ffmpeg-Synthese, lizenzfrei), loudnorm −14 LUFS → MP4.
// Warum Frames statt Remotion: dieselbe Chromium-Instanz und dasselbe CSS wie Karussell und Story (Look exakt gleich,
// pruefen.mjs läuft auf derselben Seite), kein React/Webpack-Bundle und kein zweiter Browser-Download in Actions,
// jeder Frame deterministisch gesetzt (zeige(t)), keine Echtzeit-Aufnahme.
//
//   import { renderReel } from './reel.mjs'
//   const r = await renderReel(eng, reel, 'out/r01')
//   r = { video, cover, familie, dauer, bild, stimme, gegenmassnahmen, hinweise, renderzeit }
// Fehlt die Stimme: StimmeFehlt; fehlt ein Bild: BildFehlt (produce.mjs überspringt dann); Prüfung durchgefallen: PruefFehler.
//
// Probe ohne Queue: node render/reel.mjs r01 [--stimme stimme/proben/sterling.mp3 --text "…"] [--ziel out/test-reel-r01.mp4]
//                   [--kontaktbogen out/test-reel-r01.jpg] [--trocken]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import sharp from 'sharp'
import { familieVon, coverVorlage, coverSpec, ctaSpec, ohneMarkup, saetze, ORANGE_DIR, neueSeite } from './orange.mjs'
import { pruefeSeite, PruefFehler } from './pruefen.mjs'
import { beschaffeBild, BildFehlt, BILDER_DIR } from './bilder.mjs'
import { beschaffeStimme, StimmeFehlt, STIMME_DIR, sprechfassung } from './stimme.mjs'
import { wortzeiten, audioDauer, ffTool } from './wortzeiten.mjs'
import { schnittplan, stichproben, BEWEGUNGEN, ease, bewegungAuf, punchFaktor, FPS } from './schnitt.mjs'

export { StimmeFehlt, BildFehlt }
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const BASIS = 'file://' + ORANGE_DIR + '/'
export const W = 1080, H = 1920
/** Dauer, die ein Reel haben soll (Auftrag): außerhalb nur Hinweis, kein Fehler. */
export const DAUER = { min: 15, max: 25 }
/** Gegenmaßnahmen bei zu wenig Kontrast: v1 = Verläufe und Untertitel-Kasten kräftiger, stark = Textfarben kräftiger. */
export const STUFEN = [{}, { v1: true }, { v1: true, stark: true }]
/** Leiser Ambient-Pad (lizenzfrei, per ffmpeg synthetisiert); REEL_PAD=0 schaltet ihn ab. */
export const PAD = process.env.REEL_PAD !== '0'

// ---------------------------------------------------------------------------------------------------------------------
// Bilder je Szene
// ---------------------------------------------------------------------------------------------------------------------

/** Bildschirmaufnahme einer vamela.de-Seite in Handybreite (432 CSS-px × 2,5 = 1080 px), höchstens 1800 CSS-px hoch. */
export async function bildschirmAufnahme(eng, url, ziel) {
  if (!/^https:\/\/vamela\.de\//.test(url)) throw new Error(`Aufnahme nur von vamela.de: ${url}`)
  const ctx = await eng._i.ctx.browser().newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true, reducedMotion: 'reduce', colorScheme: 'light', locale: 'de-DE' })
  try {
    const p = await ctx.newPage()
    await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
    // Einmal durchscrollen, damit nachgeladene Bilder und Scroll-Effekte fertig sind
    await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)) } window.scrollTo(0, 0) })
    await p.waitForTimeout(600)
    const hoehe = Math.min(1800, await p.evaluate(() => document.documentElement.scrollHeight))
    fs.mkdirSync(path.dirname(ziel), { recursive: true })
    await p.screenshot({ path: ziel, fullPage: true, clip: { x: 0, y: 0, width: 432, height: hoehe } })
  } finally { await ctx.close() }
  return ziel
}

/** Datei und Angaben einer Szene. */
async function szenenBild(eng, reelId, k, sz, familie, arbeit, { trocken }) {
  if (sz.art === 'aufnahme') return { datei: await bildschirmAufnahme(eng, sz.url, path.join(arbeit, `aufnahme-${k + 1}.png`)), anbieter: 'aufnahme', quelle: sz.url, familie }
  if (sz.vorrat) {
    // Familie des vorhandenen Bilds (für die Logo-Farbe): aus der JSON daneben, sonst am Stil-Präfix des Prompts erkennbar
    const j = (() => { try { return JSON.parse(fs.readFileSync(path.join(BILDER_DIR, 'vorrat', `${sz.vorrat}.json`), 'utf8')) } catch { return {} } })()
    const fam = j.familie || (/^Bright/.test(j.prompt || '') ? 'tag' : /^Cinematic/.test(j.prompt || '') ? 'nacht' : familie)
    for (const d of [path.join(BILDER_DIR, 'vorrat', `${sz.vorrat}.png`), path.join(BILDER_DIR, `${sz.vorrat}.png`)]) if (fs.existsSync(d)) return { datei: d, anbieter: 'vorrat', quelle: sz.vorrat, familie: fam }
    throw new BildFehlt(`${reelId}: Szene ${k + 1} verweist auf bilder/vorrat/${sz.vorrat}.png, das fehlt`)
  }
  const b = await beschaffeBild({ id: `${reelId}-${k + 1}`, motiv: sz.motiv, familie: sz.familie || familie }, { trocken, log: () => {} })
  return { datei: b.datei, anbieter: b.anbieter, modell: b.modell, prompt: b.prompt ?? null, familie: sz.familie || familie }
}

// ---------------------------------------------------------------------------------------------------------------------
// Seite
// ---------------------------------------------------------------------------------------------------------------------

const REEL_CSS = `
.reel{height:${H}px}
.reel .ebene{position:absolute;inset:0;visibility:hidden}
.reel .szene{overflow:hidden;background:#0A0A0A;z-index:1}
.reel .kamera{position:absolute;inset:0;will-change:transform}
.reel .kamera img{position:absolute;display:block}
.reel .aufn .glut,.reel .aufn .hell{z-index:0}
.reel .aufn .kamera{z-index:1}
.reel .karte{position:absolute;overflow:hidden;border-radius:44px;background:#fff;box-shadow:0 40px 90px -20px rgba(0,0,0,.55),0 0 0 2px rgba(255,255,255,.14)}
.reel.tag .karte{box-shadow:0 40px 90px -24px rgba(120,40,0,.45),0 0 0 2px rgba(0,0,0,.06)}
.reel .hook{z-index:3}
.reel .hook .verlauf{z-index:0;opacity:1}
.reel.tag .hook .verlauf{opacity:.0}
.reel.tag.v1 .hook .verlauf{opacity:.92}
.reel .hook .inhalt{z-index:1}
.reel .endkarte{z-index:5}
.reel .endkarte .glut,.reel .endkarte .hell{z-index:0}
.reel .endkarte .vmitte,.reel .endkarte .knopf-unten,.reel .endkarte .fuss{z-index:1}
.reel .logo{z-index:6}
.reel::after{z-index:7;background-position:var(--kx,0) var(--ky,0)}
.reel .fuss{z-index:4}
.ut{position:absolute;left:80px;right:80px;top:1250px;height:130px;display:flex;align-items:center;justify-content:center;z-index:4;visibility:hidden}
.ut-zeile{display:inline-flex;align-items:baseline;gap:.24em;padding:.14em .34em .18em;border-radius:24px;font-weight:700;line-height:1.12;letter-spacing:-.01em;white-space:nowrap;transform-origin:50% 60%}
.nacht .ut-zeile{background:rgba(10,10,10,.74);color:#fff}
.tag .ut-zeile{background:rgba(255,255,255,.9);color:#111;box-shadow:0 12px 34px -8px rgba(0,0,0,.28)}
.nacht.v1 .ut-zeile{background:rgba(10,10,10,.9)}
.tag.v1 .ut-zeile{background:rgba(255,255,255,.97)}
.ut-w{border-radius:12px;padding:0 .1em;margin:0 -.1em}
.ut-w.an{background:var(--od);color:#fff}
.tag.stark .ut-zeile{color:#000}
`

/** Karte für Bildschirmaufnahmen: abgesetzt auf Glut bzw. Hell, damit die Seite als Aufnahme lesbar bleibt (nicht als eigene Oberfläche). */
export const KARTE = { links: 110, oben: 360, breite: 860, hoehe: 1160 }

/** Ebene einer Szene: Bild deckend auf 1080 × 1920 (proportional, nie verzerrt) bzw. Aufnahme als Karte mit Scroll. */
async function szenenHtml(k, bild, aufnahme, familie) {
  const fam = bild.familie || familie
  const m = await sharp(bild.datei).metadata()
  if (aufnahme) {
    const h = Math.round((KARTE.breite * m.height) / m.width)
    const grund = familie === "tag" ? "<div class=hell></div>" : "<div class=glut></div>"
    return { html: `<div class="ebene szene aufn" data-k="${k}" data-fam="${fam}">${grund}<div class=kamera><div class=karte style="left:${KARTE.links}px;top:${KARTE.oben}px;width:${KARTE.breite}px;height:${KARTE.hoehe}px"><img src="file://${bild.datei}" alt="" data-weg="${Math.max(0, h - KARTE.hoehe)}" style="left:0;top:0;width:${KARTE.breite}px;height:${h}px"></div></div></div>`, hoehe: h }
  }
  const s = Math.max(W / m.width, H / m.height)
  const w = Math.round(m.width * s), h = Math.round(m.height * s)
  return { html: `<div class="ebene szene" data-k="${k}" data-fam="${fam}"><div class=kamera><img src="file://${bild.datei}" alt="" style="left:${Math.round((W - w) / 2)}px;top:${Math.round((H - h) / 2)}px;width:${w}px;height:${h}px"></div></div>`, hoehe: h }
}

/** Skript der Seite: zeige(t, { cover }) setzt jede Ebene deterministisch für den Zeitpunkt t. */
const SEITEN_JS = (plan) => `
const PLAN = ${JSON.stringify(plan)};
const BEWEGUNGEN = ${JSON.stringify(BEWEGUNGEN)};
${ease.toString()}
${bewegungAuf.toString()}
${punchFaktor.toString()}
const $ = (s) => document.querySelector(s);
let stueckAlt = null;
function fitUt(z) { let g = 84; z.style.fontSize = g + 'px'; while (g > 64 && z.getBoundingClientRect().width > 920) { g -= 2; z.style.fontSize = g + 'px' } }
window.zeige = function (t, opt = {}) {
  const cover = !!opt.cover;
  const end = !cover && t >= PLAN.endkarte.von;
  const sz = cover ? PLAN.szenen[0] : PLAN.szenen.find((s) => t >= s.von && t < s.bis) || PLAN.szenen[PLAN.szenen.length - 1];
  for (const el of document.querySelectorAll('.szene')) el.style.visibility = !end && sz && +el.dataset.k === sz.quelle ? 'visible' : 'hidden';
  if (sz && !end) {
    const tt = cover ? sz.shots[0].von : t;
    const shot = sz.shots.find((s) => tt >= s.von && tt < s.bis) || sz.shots[sz.shots.length - 1];
    const p = (tt - shot.von) / Math.max(0.001, shot.bis - shot.von);
    const f = cover ? 1 : punchFaktor(t, PLAN.punches);
    const kam = document.querySelector('.szene[data-k="' + sz.quelle + '"] .kamera');
    if (sz.aufnahme) {
      const img = kam.querySelector('img');
      const weg = Math.min(+img.dataset.weg, (sz.bis - sz.von) * 220);
      const q = Math.min(1, Math.max(0, (tt - sz.von) / Math.max(0.001, sz.bis - sz.von)));
      img.style.transform = 'translateY(' + (-weg * q).toFixed(1) + 'px)';
      kam.style.transformOrigin = '50% 20%'; // Kartenoberkante bleibt beim Heranzoomen unter dem Logo
      kam.style.transform = 'scale(' + (shot.zoom * f).toFixed(4) + ')';
    } else {
      const b = bewegungAuf(BEWEGUNGEN[shot.bewegung], p);
      kam.style.transformOrigin = b.ox + '% ' + b.oy + '%';
      kam.style.transform = 'translate(' + b.x.toFixed(1) + 'px,' + b.y.toFixed(1) + 'px) scale(' + (b.s * f).toFixed(4) + ')';
    }
  }
  // Logo hell auf dunklen, dunkel auf hellen Bildern (Familie je Szene, Endkarte nach Familie des Reels)
  const fam = end ? PLAN.familie : (document.querySelector('.szene[data-k="' + (sz ? sz.quelle : -1) + '"]')?.dataset.fam || PLAN.familie);
  $('.logo').style.filter = fam === 'tag' ? 'invert(1)' : 'none';
  $('.hook').style.visibility = cover || (!end && t < PLAN.hook.bis) ? 'visible' : 'hidden';
  $('.endkarte').style.visibility = end ? 'visible' : 'hidden';
  const ut = $('.ut');
  const st = cover || end ? null : PLAN.stuecke.find((s) => t >= s.von && t < s.bis);
  ut.style.visibility = st ? 'visible' : 'hidden';
  if (st && st !== stueckAlt) {
    ut.innerHTML = '<span class=ut-zeile>' + st.woerter.map((w, i) => '<span class=ut-w data-i="' + i + '">' + w.wort.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>').join(' ') + '</span>';
    fitUt(ut.firstChild);
  }
  stueckAlt = st;
  if (st) {
    let an = 0;
    st.woerter.forEach((w, i) => { if (t >= w.start - 0.03) an = i });
    ut.querySelectorAll('.ut-w').forEach((el, i) => el.classList.toggle('an', i === an));
    const q = Math.min(1, (t - st.von) / 0.09);
    ut.firstChild.style.transform = 'scale(' + (0.9 + 0.1 * (1 - Math.pow(1 - q, 3))).toFixed(4) + ')';
  }
  const fr = Math.round(t * ${FPS});
  document.querySelector('.reel').style.setProperty('--kx', ((fr * 37) % 256) + 'px');
  document.querySelector('.reel').style.setProperty('--ky', ((fr * 91) % 256) + 'px');
};
`

/** Komplettes HTML der Reel-Seite. */
async function reelHtml({ plan, bilder, reel, familie, stufe }) {
  const szenen = []
  for (const [k, b] of bilder) szenen.push((await szenenHtml(k, b, b.anbieter === 'aufnahme', familie)).html)
  const vorlage = coverVorlage(reel, familie)
  const ersteBild = bilder.get(plan.szenen[0]?.quelle ?? 0)
  const hook = coverSpec({ familie, vorlage, head: reel.hook || saetze(ohneMarkup(reel.sprechtext))[0], sub: '', bild: { datei: ersteBild?.datei }, format: 'story' })
  const schluss = saetze(ohneMarkup(reel.sprechtext)).at(-1) || 'Folge @vamela.de.'
  const cta = ctaSpec({ familie, text: schluss, angebot: reel.angebot, format: 'story' })
  const grund = cta.grund === 'hell' ? '<div class=hell></div>' : '<div class=glut></div>'
  const klassen = ['s', 'story', 'reel', familie, stufe.v1 && 'v1', stufe.stark && 'stark'].filter(Boolean).join(' ')
  return `<!doctype html><html><head><meta charset=utf-8><base href="${BASIS}"><link rel=stylesheet href=orange.css>` +
    `<style>html,body{height:${H}px}${REEL_CSS}</style><script src=orange.js defer></script></head><body>` +
    `<div class="${klassen}">${szenen.join('')}` +
    `<div class="ebene hook"><div class=verlauf></div>${hook.inhalt}</div>` +
    `<div class=ut></div>` +
    `<div class="ebene endkarte">${grund}${cta.inhalt}${cta.fuss}</div>` +
    `<img class=logo src="${BASIS}logo.png" alt="">` +
    `</div><script>${SEITEN_JS({ ...plan, familie })}</script></body></html>\n`
}

// ---------------------------------------------------------------------------------------------------------------------
// Prüfen, Frames, Ton
// ---------------------------------------------------------------------------------------------------------------------

/** Entfernt unsichtbare Ebenen, damit die Kontrastprüfung nur misst, was im Frame zu sehen ist. */
const nurSichtbares = (page) => page.evaluate(() => {
  for (const el of [...document.querySelectorAll('.ebene,.ut')]) if (getComputedStyle(el).visibility === 'hidden') el.remove()
})

/** Prüft alle Stichproben (und das Cover) mit pruefen.mjs. Rückgabe { fehler (Layout), kontrast }. */
async function pruefeStichproben(page, datei, plan) {
  const fehler = [], kontrast = []
  const proben = [{ name: 'Cover', zeit: 0, cover: true }, ...stichproben(plan)]
  for (const pr of proben) {
    await page.goto('file://' + datei)
    await page.evaluate(({ t, cover }) => window.zeige(t, { cover }), { t: pr.zeit, cover: !!pr.cover })
    await nurSichtbares(page)
    const r = await pruefeSeite(page, { format: 'story', freiraum: false })
    fehler.push(...r.fehler.map((f) => `${pr.name} (${pr.zeit.toFixed(1)} s): ${f}`))
    kontrast.push(...r.kontrast.map((f) => `${pr.name} (${pr.zeit.toFixed(1)} s): ${f}`))
  }
  return { fehler, kontrast, proben: proben.length }
}

/** Ton: Stimme (+ Ambient-Pad), auf −14 LUFS normalisiert, 48 kHz, genau T Sekunden. */
function tonSpur(stimme, T, ziel, { pad = PAD } = {}) {
  const fade = Math.max(0, T - 1.6).toFixed(2)
  const mix = pad
    ? `[0:a]aresample=48000,aformat=channel_layouts=mono,apad[v];` +
      // tiefer Akkord (A1, E2, A2) mit langsamer Schwebung, weich gefiltert, ein- und ausgeblendet, weit unter der Stimme
      `aevalsrc=exprs='0.22*sin(2*PI*55*t)+0.16*sin(2*PI*82.41*t)*(0.8+0.2*sin(2*PI*0.15*t))+0.08*sin(2*PI*110.2*t)':s=48000:d=${T.toFixed(3)},lowpass=f=320,afade=t=in:d=1.2,afade=t=out:st=${fade}:d=1.5,volume=0.10[p];` +
      `[v][p]amix=inputs=2:duration=longest:normalize=0,atrim=0:${T.toFixed(3)}`
    : `[0:a]aresample=48000,aformat=channel_layouts=mono,apad,atrim=0:${T.toFixed(3)}`
  // loudnorm in zwei Durchgängen (erst messen, dann linear angleichen); einfach durchlaufen trifft bei kurzen Clips ±1,5 LU daneben
  const LN = 'I=-14:TP=-1.5:LRA=11'
  const mess = spawnSync(ffTool('ffmpeg'), ['-hide_banner', '-nostats', '-i', stimme, '-filter_complex', `${mix},loudnorm=${LN}:print_format=json[a]`, '-map', '[a]', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 })
  let m = null
  try { m = JSON.parse(String(mess.stderr).slice(String(mess.stderr).lastIndexOf('{'))) } catch {}
  const zweit = m ? `:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true` : ''
  execFileSync(ffTool('ffmpeg'), ['-v', 'error', '-y', '-i', stimme, '-filter_complex', `${mix},loudnorm=${LN}${zweit},aresample=48000[a]`, '-map', '[a]', '-ac', '2', '-c:a', 'pcm_s16le', ziel])
  return ziel
}

/** Integrierte Lautheit einer Datei (LUFS) über ebur128 (ffmpeg schreibt die Zusammenfassung nach stderr). */
export function lufs(datei) {
  const r = spawnSync(ffTool('ffmpeg'), ['-hide_banner', '-nostats', '-i', datei, '-filter_complex', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 })
  const m = [...String(r.stderr || '').matchAll(/I:\s+(-?\d+(?:\.\d+)?) LUFS/g)].at(-1)
  return m ? +m[1] : null
}

/** Rendert alle Frames per CDP-Screenshot in ffmpeg (libx264, yuv420p, 30 fps) und legt den Ton an. */
async function renderFrames(page, datei, plan, ton, ziel) {
  await page.goto('file://' + datei)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => [...document.images].every((i) => i.complete) && document.body.dataset.fertig, null, { timeout: 30000 })
  const cdp = await page.context().newCDPSession(page)
  const ff = spawn(ffTool('ffmpeg'), ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', 'pipe:0', '-i', ton,
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', plan.T.toFixed(3), '-movflags', '+faststart', ziel], { stdio: ['pipe', 'ignore', 'pipe'] })
  let fehler = ''
  ff.stderr.on('data', (d) => { fehler += d })
  const fertig = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg: ${fehler.slice(-400)}`)))))
  fertig.catch(() => {}) // wird unten abgewartet; verhindert „unhandled rejection“, falls ffmpeg mitten im Schreiben abbricht
  let pipeFehler = null
  ff.stdin.on('error', (e) => { pipeFehler = e })
  // Beendet sich ffmpeg vorzeitig, kommt kein 'drain' mehr: dann gewinnt `fertig` (mit der Fehlermeldung)
  const schreibe = (buf) => {
    if (pipeFehler) return Promise.reject(pipeFehler)
    if (ff.stdin.write(buf)) return Promise.resolve()
    return Promise.race([new Promise((res) => ff.stdin.once('drain', res)), fertig.then(() => { throw new Error('ffmpeg hat vorzeitig beendet') })])
  }
  try {
    for (let f = 0; f < plan.frames; f++) {
      await page.evaluate((t) => window.zeige(t), f / FPS)
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true, captureBeyondViewport: false })
      await schreibe(Buffer.from(data, 'base64'))
    }
  } finally { ff.stdin.end() }
  await fertig
  await cdp.detach().catch(() => {})
}

// ---------------------------------------------------------------------------------------------------------------------
// Reel
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Rendert ein Reel nach outDir/reel.mp4 und outDir/cover.jpg (bzw. opts.ziel / opts.cover).
 * opts.stimme = { datei, text } ersetzt die Stimme (Probe mit Platzhalter-Aufnahme), sonst beschaffeStimme().
 */
export async function renderReel(eng, reel, outDir, { id = path.basename(outDir), trocken = false, stimme: stimmeVorgabe = null, ziel = null, cover: coverZiel = null, log = () => {} } = {}) {
  const t0 = Date.now()
  if (!reel.sprechtext) throw new Error(`${id}: kein Sprechtext („- Sprechtext: …“), altes Scroll-Reel-Format`)
  if (!reel.szenen?.length) throw new Error(`${id}: keine Szenen („**Szenen**“ mit je Satz einer Zeile)`)
  const familie = familieVon(reel)
  const hinweise = []
  // 1. Stimme
  const stimme = stimmeVorgabe ? { ...stimmeVorgabe, anbieter: 'vorgabe' } : await beschaffeStimme({ id, text: reel.sprechtext }, { trocken, log })
  const gesprochen = stimmeVorgabe ? stimmeVorgabe.text : reel.sprechtext
  // 2. Wortzeiten (Whisper je Aufnahme nur einmal, Ergebnis neben der Aufnahme bzw. im Ausgabeordner)
  const cache = stimmeVorgabe ? path.join(outDir, '.woerter.json') : path.join(STIMME_DIR, `${id}.woerter.json`)
  fs.mkdirSync(outDir, { recursive: true })
  const woerter = await wortzeiten(stimme.datei, sprechfassung(gesprochen), { cache, log })
  const geschaetzt = woerter.filter((w) => w.quelle === 'geschaetzt').length
  if (geschaetzt > woerter.length * 0.25) hinweise.push(`Wortzeiten: ${geschaetzt} von ${woerter.length} Wörtern nur geschätzt (Whisper: „${woerter.whisper?.slice(0, 80)}“)`)
  const dauerAudio = audioDauer(stimme.datei)
  // 3. Schnittplan
  const anzahlSaetze = woerter.at(-1).satz + 1
  if (!stimmeVorgabe && reel.szenen.length !== anzahlSaetze) hinweise.push(`Szenen: ${reel.szenen.length} für ${anzahlSaetze} Sätze (werden der Reihe nach wiederholt)`)
  const plan = schnittplan({ woerter, dauerAudio, szenen: reel.szenen, sprechtext: sprechfassung(gesprochen) === sprechfassung(reel.sprechtext) ? reel.sprechtext : gesprochen })
  if (plan.T < DAUER.min || plan.T > DAUER.max) hinweise.push(`Dauer ${plan.T.toFixed(1)} s, gewünscht ${DAUER.min} bis ${DAUER.max} s`)
  // 4. Bilder (nur die Szenen, die im Plan vorkommen)
  const arbeit = fs.mkdtempSync(path.join(os.tmpdir(), `reel-${id}-`))
  const bilder = new Map()
  const videoZiel = ziel || path.join(outDir, 'reel.mp4')
  const coverDatei = coverZiel || path.join(outDir, 'cover.jpg')
  const page = await neueSeite(eng)
  try {
    for (const k of [...new Set(plan.szenen.map((s) => s.quelle))]) bilder.set(k, await szenenBild(eng, id, k, reel.szenen[k], familie, arbeit, { trocken }))
    // 5. Seite bauen und prüfen (Stichproben-Frames, Gegenmaßnahmen der Reihe nach)
    await page.setViewportSize({ width: W, height: H })
    const html = path.join(arbeit, 'reel.html')
    let stufe = null, letzte = []
    for (const st of STUFEN) {
      fs.writeFileSync(html, await reelHtml({ plan, bilder, reel, familie, stufe: st }))
      const r = await pruefeStichproben(page, html, plan)
      if (r.fehler.length) throw new PruefFehler(r.fehler)
      if (!r.kontrast.length) { stufe = st; break }
      letzte = r.kontrast
    }
    if (!stufe) throw new PruefFehler(letzte.map((f) => `${f} (auch nach allen Gegenmaßnahmen)`))
    const gegenmassnahmen = [stufe.v1 && 'Verläufe und Untertitel-Kasten verstärkt', stufe.stark && 'Textfarbe kräftiger'].filter(Boolean)
    // 6. Cover (Hook auf dem ersten Bild; Absender ist das Logo, die Abschlusskarte trägt vamela.de)
    await page.goto('file://' + html)
    await page.waitForFunction(() => document.body.dataset.fertig, null, { timeout: 30000 })
    await page.evaluate(() => window.zeige(0, { cover: true }))
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    fs.mkdirSync(path.dirname(coverDatei), { recursive: true })
    fs.writeFileSync(coverDatei, await page.screenshot({ type: 'jpeg', quality: 92 }))
    // 7. Ton und Frames
    const ton = tonSpur(stimme.datei, plan.T, path.join(arbeit, 'ton.wav'))
    fs.mkdirSync(path.dirname(videoZiel), { recursive: true })
    const tf = Date.now()
    await renderFrames(page, html, plan, ton, videoZiel)
    const l = lufs(videoZiel)
    if (l != null && Math.abs(l + 14) > 1.5) hinweise.push(`Lautheit ${l} LUFS statt −14`)
    log(`${id}: ${plan.frames} Frames in ${((Date.now() - tf) / 1000).toFixed(1)} s, ${l ?? '?'} LUFS`)
    const erstes = bilder.get(plan.szenen[0]?.quelle ?? 0)
    return {
      video: videoZiel, cover: coverDatei, familie, dauer: +plan.T.toFixed(2), cover_vorlage: coverVorlage(reel, familie),
      bild: erstes && erstes.anbieter !== 'aufnahme' ? { datei: erstes.datei, prompt: erstes.prompt ?? null, anbieter: erstes.anbieter, modell: erstes.modell ?? null } : null,
      stimme: { anbieter: stimme.anbieter, stimme: stimme.stimme || null, job: stimme.job || null, datei: path.relative(ROOT, stimme.datei) },
      szenen: plan.szenen.length, schnitte: plan.szenen.reduce((s, z) => s + z.shots.length, 0), punches: plan.punches.length,
      gegenmassnahmen, hinweise, renderzeit: +((Date.now() - t0) / 1000).toFixed(1),
    }
  } finally {
    await page.close()
    fs.rmSync(arbeit, { recursive: true, force: true })
  }
}

/** Kontaktbogen: n Frames gleichmäßig aus dem Video (Mitte jedes Abschnitts), 4 je Zeile. */
export async function videoKontaktbogen(video, ziel, { n = 8 } = {}) {
  const { kontaktbogen } = await import('./probe.mjs')
  const d = audioDauer(video)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-bogen-'))
  try {
    const dateien = []
    for (let i = 0; i < n; i++) {
      const f = path.join(tmp, `f${i}.jpg`)
      execFileSync(ffTool('ffmpeg'), ['-v', 'error', '-y', '-ss', ((d * (i + 0.5)) / n).toFixed(2), '-i', video, '-frames:v', '1', '-q:v', '2', f])
      dateien.push(f)
    }
    return await kontaktbogen(null, ziel, { breite: 300, spalten: 4, gruppen: [dateien] })
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
}

// Kommandozeile: Probe ohne Queue
if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2)
  const opt = (n) => (a.includes(n) ? a[a.indexOf(n) + 1] : null)
  const werte = new Set(['--stimme', '--text', '--ziel', '--kontaktbogen'].map(opt))
  const wahl = a.find((x) => !x.startsWith('--') && !werte.has(x))
  if (!wahl) { console.log('Aufruf: node render/reel.mjs r01 [--stimme datei.mp3 --text "…"] [--ziel out/test-reel-r01.mp4] [--kontaktbogen out/test-reel-r01.jpg] [--trocken]'); process.exit(1) }
  const { alleReels } = await import('./inhalt.mjs')
  const nr = +String(wahl).replace(/\D/g, '')
  const reel = alleReels().find((r) => r.nr === nr)
  if (!reel) { console.log(`Reel ${wahl} nicht im Vorrat`); process.exit(1) }
  const id = `r${String(nr).padStart(2, '0')}`
  const ziel = opt('--ziel') ? path.resolve(opt('--ziel')) : null
  const { createEngine } = await import('./engine.mjs')
  const eng = await createEngine()
  try {
    const stimme = opt('--stimme') ? { datei: path.resolve(opt('--stimme')), text: opt('--text') } : null
    if (stimme && !stimme.text) throw new Error('--stimme braucht --text (was in der Aufnahme gesprochen wird)')
    const outDir = ziel ? path.join(ROOT, 'out', `test-${id}-probe`) : path.join(ROOT, 'out', id) // out/test-* ist in .gitignore
    const r = await renderReel(eng, reel, outDir, { id, stimme, ziel, cover: ziel ? ziel.replace(/\.mp4$/, '-cover.jpg') : null, trocken: a.includes('--trocken'), log: console.log })
    console.log(JSON.stringify({ ...r, video: path.relative(ROOT, r.video), cover: path.relative(ROOT, r.cover), bild: r.bild && { ...r.bild, datei: path.relative(ROOT, r.bild.datei) } }, null, 2))
    if (opt('--kontaktbogen')) console.log('Kontaktbogen:', path.relative(ROOT, await videoKontaktbogen(r.video, path.resolve(opt('--kontaktbogen')))))
  } catch (e) {
    console.log(e instanceof PruefFehler ? `Gestaltungsprüfung:\n  ${e.gruende.join('\n  ')}` : e.message)
    process.exitCode = e instanceof StimmeFehlt || e instanceof BildFehlt ? 2 : 1
  } finally { await eng.close() }
}
