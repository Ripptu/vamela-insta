// Erzeugt Beiträge aus dem Vorrat und trägt sie als Status „neu“ in die Queue ein, mit den Merkmalen für den Optimierer
// (Säule, Hook-Stil, Format, Cover-Vorlage, Caption-Länge; Wochentag und Uhrzeit setzt publish.mjs).
// Aufruf: node automatik/produce.mjs [--typ karussell|story|reel] [--anzahl N] [--nur k1,k2] [--trocken]
//   --trocken: keine bezahlte Bildanfrage (nur bilder/<id>.png und bilder/vorrat/<id>.png)
//
// Renderer im Look „Orange“ (CLAUDE.md, Abschnitt Gestaltung):
//   render/karussell.mjs  buildCarousel(eng, post, outDir) -> { files, cover_vorlage, familie, bild, gegenmassnahmen, hinweise }
//   render/story.mjs      renderStory(eng, story, outDir)  -> { dateien, familie, gegenmassnahmen, bild? }
// Hinweise (z. B. „Hook zu lang (> 9 Wörter)“) sind keine Fehler; sie stehen am Queue-Eintrag unter `hinweise`.
//   render/reel.mjs       renderReel(eng, reel, outDir)    -> { video, cover }   (Scroll-Reel-Rekorder, fehlt noch)
// Ausgänge je Beitrag:
//   - Bild fehlt (render/bilder.mjs: kein Vorrat, kein Schlüssel): nichts eingetragen, Meldung, beim nächsten Lauf neu versucht.
//   - Gestaltungsprüfung nicht bestanden (render/pruefen.mjs, auch nach den Gegenmaßnahmen): Eintrag mit Status
//     „abgelehnt“, qa.gruende mit den Prüfgründen („GESTALTUNG: …“), keine Dateien. Löschen des Eintrags lässt neu produzieren.
// Für Reels fehlt der Rekorder noch: dann Meldung und Exit-Code 4 (fill.mjs hört auf, solange nur Reels fehlen).
import fs from 'node:fs'
import path from 'node:path'
import { ladeQueue, speichereQueue } from './queue.mjs'
import { allePosts, alleStories, alleReels } from '../render/inhalt.mjs'
import { pruefeStruktur } from './karussell-regeln.mjs'
import { pruefeText, beitragsText } from './fakten.mjs'
import { captionLaenge } from './optimierer.mjs'
import { BildFehlt } from '../render/bilder.mjs'
import { PruefFehler } from '../render/pruefen.mjs'
import { ohneMarkup } from '../render/orange.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const args = process.argv.slice(2)
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d)
const typ = opt('--typ', 'karussell')
const anzahl = +opt('--anzahl', 99)
const nur = opt('--nur', '')?.split(',').filter(Boolean)
const trocken = args.includes('--trocken')
const rel = (f) => path.relative(ROOT, f)
const tags = (h) => (h || '').split(/\s+/).filter((x) => x.startsWith('#'))

export const RENDERER = { karussell: ['karussell.mjs', 'buildCarousel'], story: ['story.mjs', 'renderStory'], reel: ['reel.mjs', 'renderReel'] }
if (!RENDERER[typ]) { console.log(`Unbekannter Typ „${typ}“ (karussell, story oder reel).`); process.exit(1) }
const [datei, fn] = RENDERER[typ]
const renderPfad = path.join(ROOT, 'render', datei)
if (!fs.existsSync(renderPfad)) {
  console.log(`Kein Renderer für ${typ}: render/${datei} mit ${fn}() fehlt (für Reels der Scroll-Reel-Rekorder, docs/architektur.md „Offenes“). Nichts produziert.`)
  process.exit(4)
}
const renderer = (await import(renderPfad))[fn]
if (typeof renderer !== 'function') { console.log(`render/${datei} exportiert kein ${fn}(). Nichts produziert.`); process.exit(4) }

/** Gemeinsame Felder jedes Queue-Eintrags (Vertrag: docs/architektur.md). */
const eintrag = (id, quelle, x, extra) => ({
  id, typ, quelle, titel: x.titel, format: typ, saeule: x.saeule ?? null, hook_stil: x.hook_stil ?? null, cover_vorlage: x.cover_vorlage ?? null,
  familie: x.familie ?? null, caption_laenge: typ === 'story' ? null : captionLaenge(x.caption),
  hook: ohneMarkup(x.hook ?? x.pages?.[0]?.head ?? x.text ?? '') || null,
  angebot: x.angebot || 'keins', werkzeug: x.werkzeug || null, fruehestens: x.fruehestens && /^\d{4}-\d{2}-\d{2}$/.test(x.fruehestens) ? x.fruehestens : null,
  caption: x.caption || '', hashtags: tags(x.hashtags), status: 'neu', geplant: null, qa: null, ig: null, fehler: null, ...extra,
})

const q = await ladeQueue()
const vorhanden = new Set(q.map((x) => x.id))
const { createEngine } = await import('../render/engine.mjs')
const eng = await createEngine()
let neu = 0
try {
  const vorrat = typ === 'karussell' ? allePosts() : typ === 'story' ? alleStories() : alleReels()
  for (const x of vorrat) {
    const id = `${typ[0]}${String(x.nr).padStart(2, '0')}`
    if (vorhanden.has(id) || (nur.length && !nur.includes(id) && !nur.includes(String(x.nr)))) continue
    if (neu >= anzahl) break
    const fehler = [...(typ === 'karussell' ? pruefeStruktur(x) : []), ...pruefeText(beitragsText(x))]
    if (fehler.length) { console.log(`${id} ${x.titel} nicht produziert (Regel): ${fehler[0]}`); process.exitCode = 1; continue }
    const out = path.join(ROOT, 'out', id)
    fs.rmSync(out, { recursive: true, force: true })
    const quelle = typ === 'karussell' ? `docs/content-posts.md#Karussell ${x.nr}` : typ === 'story' ? `${x.datei}#Story ${x.nr}` : `docs/content-reels.md#Reel ${x.nr}`
    let r
    try {
      r = await renderer(eng, x, out, { trocken })
    } catch (e) {
      process.exitCode = 1
      if (e instanceof BildFehlt) { console.log(`${id} ${x.titel} nicht produziert (Bild): ${e.message}`); continue }
      if (e instanceof PruefFehler) {
        // Für den Prüf-Agenten und den Bericht festhalten, warum die Gestaltung durchfiel
        const gruende = e.gruende.map((g) => `GESTALTUNG: ${g}`)
        q.push(eintrag(id, quelle, x, { dateien: [], status: 'abgelehnt', fehler: e.message.slice(0, 300), qa: { verdikt: 'abgelehnt', gruende, am: new Date().toISOString(), von: 'render/pruefen.mjs' } }))
        await speichereQueue(q)
        console.log(`${id} ${x.titel} abgelehnt (Gestaltungsprüfung):\n  ${gruende.join('\n  ')}`)
        continue
      }
      console.log(`${id} ${x.titel} nicht produziert: ${e.message}`)
      continue
    }
    const dateien = (r.files || r.dateien || [r.video, r.cover]).filter(Boolean).map(rel)
    const bild = r.bild ? { ...r.bild, datei: rel(r.bild.datei) } : null
    q.push(eintrag(id, quelle, { ...x, cover_vorlage: r.cover_vorlage ?? x.cover_vorlage, familie: r.familie ?? x.familie }, {
      dateien, ...(bild ? { bild } : {}), ...(r.gegenmassnahmen?.length ? { gegenmassnahmen: r.gegenmassnahmen } : {}), ...(r.hinweise?.length ? { hinweise: r.hinweise } : {}),
      ...(typ === 'story' ? { caption: '', hashtags: [], angebot: 'keins' } : {}),
    }))
    await speichereQueue(q)
    neu++
    console.log(`Produziert ${id} ${x.titel} (${dateien.length} Dateien${r.familie ? `, ${r.familie}` : ''}${bild ? `, Bild ${bild.anbieter}` : ''})${r.hinweise?.length ? `\n  Hinweis: ${r.hinweise.join('; ')}` : ''}`)
  }
} finally {
  await eng.close()
}
console.log(`${neu} neu produziert.`)
