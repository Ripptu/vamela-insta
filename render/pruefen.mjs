// Prüfungen für gerenderte Seiten im Look „Orange“ (übernommen aus website/vamela-social/insta-entwuerfe/render.mjs).
// Jede Seite muss alle bestehen, sonst gilt der Beitrag als nicht produzierbar (render/orange.mjs wirft PruefFehler).
//
//   import { pruefeSeite, aufwaermen, RAND } from './pruefen.mjs'
//   const { fehler, kontrast, bild } = await pruefeSeite(page, { format: 'feed' })
//
// Prüfungen je Seite:
//  - Schriften und Bilder geladen, Einpassen (orange.js, [data-fit]) gelungen
//  - Text im Sicherheitsrand: Feed 80–1000 × 64–1290 (das Profilraster schneidet 4:5 auf 3:4, also links und rechts je
//    etwa 67 px weg), Story 80–1000 × 250–1580 (oben 250 px Fortschrittsbalken und Profilname, unten 340 px Antwortfeld frei)
//  - Mindestschriftgröße 30 px (1080 px sind auf dem Handy etwa 390 pt, 30 px ≈ 11 pt)
//  - keine Überlappung zwischen Textblöcken (außer [data-ueberlappt]) und kein Überlauf aus dem eigenen Kasten
//  - Freiraum (nur Seiten mit Bild als Hintergrund, also Cover): Text darf nicht auf dem Motiv liegen. Im textfreien Render
//    wird je Überschrift- und Unterzeilen-Zeile (+ 24 px Rand) der Anteil der Pixel gemessen, die deutlich vom Hintergrund
//    der jeweiligen Bildzeile abweichen (Median der Zeile, Farbabstand über Schwelle); über 4 % = „Text auf Motiv“.
//    Glut, Funken und weiche Verläufe bleiben darunter, Köpfe und Objekte nicht. Fußzeile und Logo sind ausgenommen.
//  - Kontrast hinter jeder Textzeile (WCAG: 3:1 für große Schrift ab 40 px bzw. ab 32 px fett, sonst 4,5:1), gemessen am
//    10. Perzentil der Hintergrundpixel, damit ein heller Fleck im Bild nicht im Mittelwert verschwindet
// Elemente mit [data-frei] sind von Rand und Überlauf ausgenommen, [data-kontrast-ok] vom Kontrast, [data-klein-ok] von der Mindestgröße.

import sharp from 'sharp'

export const RAND = { feed: { x0: 80, x1: 1000, y0: 64, y1: 1290 }, story: { x0: 80, x1: 1000, y0: 250, y1: 1580 } }
export const MIN_PX = 30
export const HOEHE = { feed: 1350, story: 1920 }

/** Wartet, bis Schriften, Bilder und das Einpassen (orange.js setzt body[data-fertig]) durch sind, dann zwei Frames. */
export async function warteBisFertig(page) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => [...document.images].every((i) => i.complete) && (!document.querySelector('script[src]') || document.body.dataset.fertig), null, { timeout: 20000 })
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}

/**
 * Aufwärmlauf: Der erste Screenshot nach dem Start malt den unteren Rand sonst teils nicht fertig (halb gemalte Bilder).
 * Einmal je Browser-Kontext eine Seite laden und kurz warten.
 */
const gewaermt = new WeakSet()
export async function aufwaermen(ctx, url) {
  if (gewaermt.has(ctx)) return
  const p = await ctx.newPage()
  try { await p.goto(url); await warteBisFertig(p); await p.waitForTimeout(600) } finally { await p.close() }
  gewaermt.add(ctx)
}

/** Layout-Prüfungen (Bilder, Schriften, Einpassen, Rand, Größe, Überlauf, Überlappung). Liste der Fehler, leer = gut. */
export function pruefeLayout(page, format = 'feed') {
  return page.evaluate(({ RAND, MIN_PX }) => {
    const out = []
    for (const i of document.images) if (!i.naturalWidth) out.push(`Bild fehlt: ${i.getAttribute('src')}`)
    for (const fam of ['Poppins', 'Instrument Serif']) {
      if ([...document.fonts].some((ff) => ff.family.replace(/"/g, '') === fam && ff.status === 'error')) out.push(`Schrift ${fam} nicht geladen`)
    }
    for (const e of document.querySelectorAll('[data-passt-nicht]')) out.push(`passt nicht trotz Mindestgröße: ${e.textContent.trim().slice(0, 30)}`)
    const bloecke = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const t = walker.currentNode
      if (!t.textContent.trim()) continue
      const el = t.parentElement
      const st = getComputedStyle(el)
      if (st.visibility === 'hidden' || st.display === 'none' || parseFloat(st.opacity) === 0) continue
      const r = document.createRange()
      r.selectNodeContents(t)
      const rects = [...r.getClientRects()].filter((q) => q.width > 1 && q.height > 1)
      const block = el.closest('[data-block]') || el
      const name = (el.className || el.tagName.toLowerCase()) + ` „${t.textContent.trim().slice(0, 24)}“`
      const px = parseFloat(st.fontSize)
      if (px < MIN_PX && !el.closest('[data-klein-ok]')) out.push(`zu klein (${px}px): ${name}`)
      for (const q of rects) {
        if (!el.closest('[data-frei]') && (q.left < RAND.x0 - 1 || q.right > RAND.x1 + 1 || q.top < RAND.y0 - 1 || q.bottom > RAND.y1 + 1))
          out.push(`außerhalb Sicherheitsrand: ${name} (${Math.round(q.left)},${Math.round(q.top)}–${Math.round(q.right)},${Math.round(q.bottom)})`)
      }
      if (!el.closest('[data-frei]') && el.scrollWidth > el.clientWidth + 2 && st.display !== 'inline' && st.overflow !== 'visible') out.push(`Überlauf: ${name}`)
      bloecke.push({ block, name, rects, ok: !!el.closest('[data-ueberlappt]') })
    }
    // Glyphenboxen sind höher als die Buchstaben: oben und unten je 18 % der Zeilenhöhe abziehen
    const schrumpf = (q) => { const d = q.height * 0.18; return { l: q.left, r: q.right, t: q.top + d, b: q.bottom - d } }
    for (let i = 0; i < bloecke.length; i++) for (let j = i + 1; j < bloecke.length; j++) {
      const A = bloecke[i], B = bloecke[j]
      if (A.block === B.block || A.block.contains(B.block) || B.block.contains(A.block) || A.ok || B.ok) continue
      let treffer = false
      for (const a of A.rects.map(schrumpf)) {
        for (const b of B.rects.map(schrumpf)) {
          const w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t)
          if (w > 2 && h > 2) { out.push(`Überlappung: ${A.name} ↔ ${B.name}`); treffer = true; break }
        }
        if (treffer) break
      }
    }
    return [...new Set(out)]
  }, { RAND: RAND[format], MIN_PX })
}

/**
 * Kontrast hinter jeder Textzeile. Rendert die Seite ohne Text (Hintergründe wie Pillen und Markierungen bleiben)
 * und rechnet die Pixel gegen die Schriftfarbe. VERÄNDERT DIE SEITE: erst fotografieren, dann prüfen.
 * Rückgabe: { fehler: [Kontrast], texte: [Textzeilen mit Rechteck], png: Buffer (der textfreie Render) }.
 */
export async function pruefeKontrast(page) {
  const texte = await page.evaluate(() => {
    const liste = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const t = walker.currentNode
      if (!t.textContent.trim()) continue
      const el = t.parentElement
      if (el.closest('[data-frei],[data-kontrast-ok]')) continue
      const st = getComputedStyle(el)
      let farbe = st.color
      // Verlaufsschrift (.o): gerechnet wird mit dem Orange, das sie im Mittel hat
      if (st.backgroundClip === 'text' || st.webkitBackgroundClip === 'text' || /rgba\(0, 0, 0, 0\)/.test(farbe)) farbe = 'rgb(255, 91, 20)'
      const r = document.createRange()
      r.selectNodeContents(t)
      for (const q of r.getClientRects()) if (q.width > 4 && q.height > 4)
        liste.push({ x: q.left, y: q.top, w: q.width, h: q.height, farbe, px: parseFloat(st.fontSize), fett: parseInt(st.fontWeight) >= 600, text: t.textContent.trim().slice(0, 28), fuss: !!el.closest('.fuss,.logo') })
    }
    for (const el of document.querySelectorAll('*')) {
      const st = getComputedStyle(el)
      if (st.backgroundClip === 'text' || st.webkitBackgroundClip === 'text') el.style.background = 'none'
    }
    const s = document.createElement('style')
    s.textContent = '*{color:transparent!important;-webkit-text-fill-color:transparent!important;-webkit-text-stroke:0!important;text-shadow:none!important}'
    document.head.append(s)
    return liste
  })
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const png = await page.screenshot()
  const bild = png.toString('base64')
  const fehler = await page.evaluate(async ({ texte, bild }) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + bild
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width; c.height = img.height
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const px = ctx.getImageData(0, 0, c.width, c.height).data
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    const out = []
    for (const t of texte) {
      const [r, g, b] = t.farbe.match(/\d+/g).map(Number)
      const lt = lum(r, g, b)
      const werte = []
      const y0 = Math.max(0, Math.round(t.y + t.h * 0.2)), y1 = Math.min(c.height - 1, Math.round(t.y + t.h * 0.8))
      for (let y = y0; y <= y1; y += 3) for (let x = Math.max(0, Math.round(t.x)); x <= Math.min(c.width - 1, t.x + t.w); x += 3) {
        const i = (y * c.width + x) * 4
        const lb = lum(px[i], px[i + 1], px[i + 2])
        werte.push((Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05))
      }
      if (!werte.length) continue
      werte.sort((a, b) => a - b)
      const p10 = werte[Math.floor(werte.length * 0.1)]
      const soll = t.px >= 40 || (t.px >= 32 && t.fett) ? 3 : 4.5
      if (p10 < soll) out.push(`Kontrast ${p10.toFixed(1)}:1 (Soll ${soll}:1): „${t.text}“`)
    }
    return [...new Set(out)]
  }, { texte, bild })
  return { fehler, texte, png }
}

export const FREIRAUM = { rand: 24, schwelle: 60, anteil: 0.04 }

/** Median je Farbkanal einer Bildzeile (jeder zweite Pixel). */
function zeilenMedian(data, breite, kanaele, y) {
  const m = [0, 0, 0]
  for (let c = 0; c < 3; c++) {
    const v = []
    for (let x = 0; x < breite; x += 2) v.push(data[(y * breite + x) * kanaele + c])
    v.sort((a, b) => a - b)
    m[c] = v[v.length >> 1]
  }
  return m
}

/**
 * Anteil abweichender Pixel (Motiv) um jede Textzeile. raw: { data, width, height, channels } (z. B. sharp(...).raw()),
 * zeilen: [{ x, y, w, h, text }]. Hintergrund einer Bildzeile = Median dieser Zeile (trägt vertikale Verläufe, Glut-
 * Streifen und Vignette bleiben unter der Schwelle); Abweichung = Farbabstand (RGB, euklidisch) über `schwelle`.
 * Rückgabe: [{ text, anteil, y }] je Zeile, nach Anteil absteigend.
 */
export function freiraumAnteile(raw, zeilen, { rand = FREIRAUM.rand, schwelle = FREIRAUM.schwelle } = {}) {
  const { data, width, height, channels } = raw
  const med = new Map()
  const bg = (y) => { if (!med.has(y)) med.set(y, zeilenMedian(data, width, channels, y)); return med.get(y) }
  const out = []
  for (const z of zeilen) {
    const x0 = Math.max(0, Math.round(z.x - rand)), x1 = Math.min(width - 1, Math.round(z.x + z.w + rand))
    const y0 = Math.max(0, Math.round(z.y - rand)), y1 = Math.min(height - 1, Math.round(z.y + z.h + rand))
    let n = 0, abw = 0
    for (let y = y0; y <= y1; y += 2) {
      const [r, g, b] = bg(y)
      for (let x = x0; x <= x1; x += 2) {
        const i = (y * width + x) * channels
        const d = Math.hypot(data[i] - r, data[i + 1] - g, data[i + 2] - b)
        n++
        if (d > schwelle) abw++
      }
    }
    if (n) out.push({ text: z.text, anteil: abw / n, y: z.y })
  }
  return out.sort((a, b) => b.anteil - a.anteil)
}

/** Fehlertexte „Text auf Motiv“ aus dem textfreien Render (PNG-Buffer) und den Textzeilen. */
export async function pruefeFreiraum(png, texte, opt = {}) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const zeilen = texte.filter((t) => !t.fuss)
  const anteile = freiraumAnteile({ data, width: info.width, height: info.height, channels: info.channels }, zeilen, opt)
  const grenze = opt.anteil ?? FREIRAUM.anteil
  return { fehler: anteile.filter((a) => a.anteil > grenze).map((a) => `Text auf Motiv: „${a.text}“ (${Math.round(a.anteil * 100)} % Motiv um die Zeile, erlaubt ${Math.round(grenze * 100)} %)`), anteile }
}

/**
 * Alle Prüfungen einer geladenen Seite. Fotografiert zwischen Layout- und Kontrastprüfung (JPG, Qualität 92).
 * Mit freiraum: true zusätzlich die Freiraumprüfung (Seiten mit Bildhintergrund).
 * Rückgabe: { fehler: [Layout], kontrast: [Kontrast], freiraum: [Text auf Motiv], anteile, textlos: PNG, bild: Buffer (JPG) }.
 */
export async function pruefeSeite(page, { format = 'feed', freiraum = false } = {}) {
  await warteBisFertig(page)
  const fehler = await pruefeLayout(page, format)
  const bild = await page.screenshot({ type: 'jpeg', quality: 92 })
  const k = await pruefeKontrast(page)
  const f = freiraum ? await pruefeFreiraum(k.png, k.texte) : { fehler: [], anteile: [] }
  return { fehler, kontrast: k.fehler, freiraum: f.fehler, anteile: f.anteile, textlos: k.png, bild }
}

/** Fehler, der produce.mjs sagt: dieser Beitrag besteht die Prüfung nicht. `gruende` geht an die Queue (qa.gruende). */
export class PruefFehler extends Error {
  constructor(gruende, meldung) {
    super(meldung || `Gestaltungsprüfung nicht bestanden: ${gruende.slice(0, 3).join(' | ')}`)
    this.gruende = gruende
  }
}
