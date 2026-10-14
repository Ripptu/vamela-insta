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
import { klarAktiv, renderKlar, BLASE } from './stil-klar.mjs'
import { familieVon, coverVorlage, thema, coverSpec, textSpec, ctaSpec, renderSeite, randFarbe, neueSeite, coverHinweise, kopfUndRumpf, ctaLabel } from './orange.mjs'
import { beschaffeBild } from './bilder.mjs'

// format 'story' rendert dieselben Seiten nativ in 1080 × 1920 (TikTok-Fotoslideshow, Christian 13.10.2026).
export async function buildCarousel(eng, post, outDir, { bild: bildVorgabe = null, trocken = false, format = 'feed', ohneCover = false } = {}) {
  const id = path.basename(outDir)
  const familie = familieVon(post)
  const vorlage = coverVorlage(post, familie)
  const cover = post.pages.find((p) => p.role === 'cover') || post.pages[0]
  const innen = post.pages.filter((p) => p !== cover && p.role !== 'close')
  const schluss = post.pages.find((p) => p.role === 'close')
  if (!cover || !schluss || innen.length !== 4) throw new Error(`${id}: erwartet Cover, vier Innenseiten und Schlussseite (gefunden ${post.pages.length} Seiten)`)

  // Look „Klar“: typografisch, ohne Motivbild (Christian, 13.10.2026); format 'story' ist die 9:16-Fassung für TikTok
  if (klarAktiv()) {
    const fm = format === 'story' ? 'tiktok' : 'feed'
    const seed = Number(String(id).replace(/\D/g, '')) || 1
    const plain = (t) => String(t ?? '').replace(/\*\*/g, '*')
    fs.mkdirSync(outDir, { recursive: true })
    const seiten = [
      { typ: 'cover', kopf: plain(cover.head ?? cover.text), blase: BLASE[post.saeule] || '', notiz: cover.sub && cover.sub.length <= 36 ? cover.sub : '' },
      ...innen.map((p, i) => { const [kopf, text] = kopfUndRumpf(plain(p.roh ?? p.text)); return { typ: 'text', nr: `${i + 2}.`, repo: post.repo || '', kopf, text } }),
      (() => { const [kopf, text] = kopfUndRumpf(plain(schluss.roh ?? schluss.text)); return { typ: 'cta', nr: '6.', repo: post.repo || '', kopf, text, link: post.repo || '', knopf: post.repo ? 'Speichern &amp; folgen' : ctaLabel(schluss.roh ?? schluss.text, post.angebot).replace(/&/g, '&amp;') } })(),
    ]
    // Das Cover trägt die Grafik (Motivbild); die TikTok-Fassung mit Tier-Poster (ohneCover) braucht sie nicht
    const bildK = ohneCover ? null : (bildVorgabe || await beschaffeBild({ id, motiv: post.motiv, familie }, { trocken }))
    if (bildK) seiten[0].bild = path.resolve(bildK.datei)
    const files = []
    try {
      for (let i = 0; i < seiten.length; i++) {
        const datei = path.join(outDir, `${String(i + 1).padStart(2, '0')}.jpg`)
        if (ohneCover && i === 0) { files.push(datei); continue }
        if (i === 0 && bildK) {
          // Cover wie anfangs im Look „Orange“ mit vollflächigem Motivbild (Christian, 13.10.2026)
          const rf = await randFarbe(bildK.datei)
          const unter = cover.sub || (post.mehrwert && post.mehrwert.length <= 110 && familie === 'nacht' ? post.mehrwert : '')
          const pg = await neueSeite(eng)
          try { await renderSeite(pg, coverSpec({ familie, vorlage, head: cover.head ?? cover.text, sub: unter, bild: { datei: bildK.datei, ...rf }, format, vollbild: format === 'story' }), datei, { name: 'Seite 1' }) } finally { await pg.close() }
          files.push(datei); continue
        }
        await renderKlar(eng, { ...seiten[i], format: fm, seed: seed + i, datei }).catch((e) => { throw Object.assign(new Error(`Seite ${i + 1}: ${e.message}`), { gruende: [`Seite ${i + 1}: ${e.message}`] }) })
        files.push(datei)
      }
    } catch (e) { for (const f of files) fs.rmSync(f, { force: true }); throw e }
    const bi = bildK ? { datei: bildK.datei, prompt: bildK.prompt ?? null, ...(bildK.prompt ? {} : { prompt_vorschlag: bildK.prompt_vorschlag }), anbieter: bildK.anbieter, modell: bildK.modell, ...(bildK.quelle ? { quelle: bildK.quelle } : {}) } : null
    return { files, cover_vorlage: bildK ? vorlage : 'klar', familie, hinweise: coverHinweise(cover.head ?? cover.text), ...(bi ? { bild: bi } : {}), gegenmassnahmen: [] }
  }

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
      if (ohneCover && i === 0) { files.push(path.join(outDir, name)); continue } // Bild 1 ersetzt das Tier-Poster
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
