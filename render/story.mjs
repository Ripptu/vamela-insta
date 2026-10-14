// Story im Look „Orange“: 1080 × 1920 als JPG nach out/<id>/01.jpg (Quiz zusätzlich 02.jpg mit der Auflösung).
// Aufbau wie die Innenseiten der Karussells, Block vertikal mittig: Pille (Art der Frage), Überschrift (erster Satz,
// Einpassen 120–72 px), Fließtext 48 px; der Interaktionssatz („Schreib mir ein Wort als Nachricht“) als Knopf unten.
// Nacht schwarz mit Glut, Tag weiß mit orangem Verlauf; gibt es ein Motivbild (bilder/<id>.png, Vorrat oder Schlüssel),
// liegt es als ruhiger Streifen unten. Text bleibt im Story-Sicherheitsbereich 80–1000 × 250–1580 (render/pruefen.mjs).
//
//   import { renderStory } from './story.mjs'
//   const r = await renderStory(eng, story, 'out/s01')   // r = { dateien, familie, gegenmassnahmen, bild? }
import fs from 'node:fs'
import path from 'node:path'
import { klarAktiv, renderKlar } from './stil-klar.mjs'
import { familieVon, kopfUndRumpf, textSpec, renderSeite, neueSeite } from './orange.mjs'
import { beschaffeBild, BildFehlt } from './bilder.mjs'

const PILLE = { Umfrage: 'Kurze Umfrage', Fragebox: 'Deine Meinung', Quiz: 'Was glaubst du?', Schieberegler: 'Schätz mal' }

export async function renderStory(eng, story, outDir, { trocken = false } = {}) {
  const familie = familieVon(story)
  // Der Schlusssatz steht immer fett für sich, auch wenn davor nur ein Satz steht
  const SCHLUSS = 'Schreib mir ein Wort als Nachricht.'
  const ohneSchluss = String(story.text || '').endsWith(SCHLUSS) ? story.text.slice(0, -SCHLUSS.length).trim() : story.text
  const seiten = [{ text: ohneSchluss, knopf: ohneSchluss !== story.text ? SCHLUSS.replace(/\.$/, '') : '', pille: PILLE[story.interaktion] || 'Kurze Frage' }]
  if (story.aufloesung) seiten.push({ text: story.aufloesung, pille: 'Auflösung' })
  if (!story.text) throw new Error('Story ohne Automatik-Fassung')
  if (klarAktiv()) {
    let bildS = null
    try { bildS = await beschaffeBild({ id: path.basename(outDir), motiv: story.motiv, familie }, { trocken, log: () => {} }) } catch (e) { if (!(e instanceof BildFehlt)) throw e }
    const seed = Number(String(path.basename(outDir)).replace(/\D/g, '')) || 1
    fs.mkdirSync(outDir, { recursive: true })
    const dateien = []
    try {
      for (let i = 0; i < seiten.length; i++) {
        const [kopf, text] = kopfUndRumpf(String(seiten[i].text).replace(/\*\*/g, '*'))
        const datei = path.join(outDir, `${String(i + 1).padStart(2, '0')}.jpg`)
        const spec = { typ: 'text', format: 'story', kopf, text, blase: `(${seiten[i].pille})`, knopf: seiten[i].knopf ? seiten[i].knopf.replace(/&/g, '&amp;') : '', seed: seed + i, datei }
        // Mit Bild, wenn der Text daneben passt; sonst ohne Bild (lange Fragen)
        if (i === 0 && bildS) { try { await renderKlar(eng, { ...spec, bild: path.resolve(bildS.datei) }) } catch { await renderKlar(eng, spec) } } else await renderKlar(eng, spec)
        dateien.push(datei)
      }
    } catch (e) { for (const f of dateien) fs.rmSync(f, { force: true }); throw e }
    return { dateien, familie: 'klar', gegenmassnahmen: [], ...(bildS ? { bild: { datei: bildS.datei, prompt: bildS.prompt ?? null, anbieter: bildS.anbieter, modell: bildS.modell } } : {}) }
  }
  // Motivbild nur, wenn eins da ist (schon beschafft, Vorrat oder mit Schlüssel); ohne Bild bleibt der Grund Glut bzw. Weiß→Orange
  let bild = null
  try { bild = await beschaffeBild({ id: path.basename(outDir), motiv: story.motiv, familie }, { trocken, log: () => {} }) } catch (e) { if (!(e instanceof BildFehlt)) throw e }
  fs.mkdirSync(outDir, { recursive: true })
  const page = await neueSeite(eng)
  const dateien = [], gegenmassnahmen = []
  try {
    for (let i = 0; i < seiten.length; i++) {
      const spec = textSpec({ familie, thema: seiten[i].pille, text: seiten[i].text, knopf: seiten[i].knopf, format: 'story', weiter: false, bild, ausschnitt: i + 2 })
      const r = await renderSeite(page, spec, path.join(outDir, `${String(i + 1).padStart(2, '0')}.jpg`), { name: i ? 'Auflösung' : 'Story' })
      dateien.push(r.datei)
      gegenmassnahmen.push(...r.gegenmassnahmen)
    }
  } catch (e) {
    for (const f of dateien) fs.rmSync(f, { force: true })
    throw e
  } finally {
    await page.close()
  }
  return { dateien, familie, gegenmassnahmen, ...(bild ? { bild: { datei: bild.datei, prompt: bild.prompt ?? null, anbieter: bild.anbieter, modell: bild.modell } } : {}) }
}
