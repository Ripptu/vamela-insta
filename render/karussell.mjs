// Karussell im Look „Orange“: 6 Seiten 1080 × 1350 als JPG nach out/<id>/01.jpg … 06.jpg.
// Seite 1 Cover (Bild + Überschrift + Unterzeile), Seiten 2–5 Innenseiten (Pille mit Thema, Überschrift, Fließtext ab 42 px),
// Seite 6 Schluss (Nacht: Knopf, Tag: Pille und Folgen-Satz). Familie, Akzent-Markup und Gegenmaßnahmen: render/orange.mjs.
// Jede Seite muss render/pruefen.mjs bestehen, sonst wirft buildCarousel einen PruefFehler (Gründe in e.gruende).
//
//   import { buildCarousel } from './karussell.mjs'
//   const r = await buildCarousel(eng, post, 'out/k01')   // eng aus render/engine.mjs (createEngine)
//   r = { files, cover_vorlage, familie, hinweise, bild: { datei, prompt, anbieter, modell }, gegenmassnahmen: [...] }
// Innenseiten zeigen unten je einen anderen, ruhigen Ausschnitt des Cover-Bilds (orange.mjs, AUSSCHNITTE).
import fs from 'node:fs'
import path from 'node:path'
import { familieVon, coverVorlage, thema, coverSpec, textSpec, ctaSpec, renderSeite, randFarbe, neueSeite, coverHinweise } from './orange.mjs'
import { beschaffeBild } from './bilder.mjs'

// format 'story' rendert dieselben Seiten nativ in 1080 × 1920 (TikTok-Fotoslideshow, Christian 13.10.2026).
export async function buildCarousel(eng, post, outDir, { bild: bildVorgabe = null, trocken = false, format = 'feed' } = {}) {
  const id = path.basename(outDir)
  const familie = familieVon(post)
  const vorlage = coverVorlage(post, familie)
  const cover = post.pages.find((p) => p.role === 'cover') || post.pages[0]
  const innen = post.pages.filter((p) => p !== cover && p.role !== 'close')
  const schluss = post.pages.find((p) => p.role === 'close')
  if (!cover || !schluss || innen.length !== 4) throw new Error(`${id}: erwartet Cover, vier Innenseiten und Schlussseite (gefunden ${post.pages.length} Seiten)`)

  // Bild zuerst: fehlt es, wird nichts gerendert (BildFehlt geht an produce.mjs)
  const bild = bildVorgabe || (await beschaffeBild({ id, motiv: post.motiv, familie }, { trocken }))
  const rf = await randFarbe(bild.datei)
  const unter = cover.sub || (post.mehrwert && post.mehrwert.length <= 110 && familie === 'nacht' ? post.mehrwert : '')

  const specs = [
    coverSpec({ familie, vorlage, head: cover.head ?? cover.text, sub: unter, bild: { datei: bild.datei, ...rf }, format, vollbild: format === 'story' }),
    ...innen.map((p, i) => textSpec({ familie, thema: thema(post), text: p.roh ?? p.text, bild: { datei: bild.datei }, ausschnitt: i, format })),
    ctaSpec({ familie, text: schluss.roh ?? schluss.text, angebot: post.angebot, format }),
  ]
  fs.mkdirSync(outDir, { recursive: true })
  const page = await neueSeite(eng)
  const files = [], gegenmassnahmen = []
  try {
    for (let i = 0; i < specs.length; i++) {
      const name = `${String(i + 1).padStart(2, '0')}.jpg`
      const r = await renderSeite(page, specs[i], path.join(outDir, name), { name: `Seite ${i + 1}` })
      files.push(r.datei)
      for (const g of r.gegenmassnahmen) gegenmassnahmen.push(`Seite ${i + 1}: ${g}`)
    }
  } catch (e) {
    for (const f of files) fs.rmSync(f, { force: true })
    throw e
  } finally {
    await page.close()
  }
  const { datei, prompt, prompt_vorschlag, anbieter, modell, quelle } = bild
  const hinweise = coverHinweise(cover.head ?? cover.text)
  return { files, cover_vorlage: vorlage, familie, hinweise, bild: { datei, prompt: prompt ?? null, ...(prompt ? {} : { prompt_vorschlag }), anbieter, modell, ...(quelle ? { quelle } : {}) }, gegenmassnahmen }
}
