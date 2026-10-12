// Tests für den Look „Orange“ ohne Browser: Text-Markup, Umbruch, Familie, Bildbeschaffung (ohne bezahlte Anfrage).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { ohneLinkHinweis, coverHinweise, woerter, ohneMarkup, saetze, kopfUndRumpf, umbrechen, nachtAkzente, zweiTeile, familieVon, coverVorlage, ctaLabel, fliessHtml, zeileHtml, thema, seiteHtml, textSpec } from '../../render/orange.mjs'
import { bildPrompt, higgsfield, higgsfieldZugang, beschaffeBild, BildFehlt } from '../../render/bilder.mjs'
import { readPosts } from '../../render/inhalt.mjs'
import { freiraumAnteile, pruefeFreiraum, FREIRAUM } from '../../render/pruefen.mjs'

const text = (zeilen) => zeilen.map((z) => z.map((x) => x.w).join(' '))

test('Markup: *serif*, _orange_, ==markiert== und ohneMarkup', () => {
  const ws = woerter('Zeig, wie es *heute* _aussieht._')
  assert.deepEqual(ws.map((x) => x.st), [null, null, null, 'ser', 'o'])
  assert.equal(ohneMarkup('Kein ==Technik-Stress.== Nur *Ergebnisse.*'), 'Kein Technik-Stress. Nur Ergebnisse.')
  assert.equal(zeileHtml(ws, 'tag'), 'Zeig, wie es <span class=ser>heute</span> <span class=oo>aussieht.</span>')
  assert.equal(fliessHtml('Das ist *wichtig* hier.', 'nacht'), 'Das ist <b>wichtig</b> hier.')
  assert.equal(fliessHtml('Erster Satz. Zweiter Satz.', 'nacht'), 'Erster Satz. <b>Zweiter Satz.</b>')
})

test('Sätze: Abkürzungen trennen nicht, Kopf / Rest', () => {
  assert.deepEqual(saetze('Wähl z. B. Gartenbau. Dann passt es.'), ['Wähl z. B. Gartenbau.', 'Dann passt es.'])
  assert.deepEqual(kopfUndRumpf('Formulare fallen still aus. Für Besucher sieht alles normal aus.'), ['Formulare fallen still aus.', 'Für Besucher sieht alles normal aus.'])
  assert.deepEqual(kopfUndRumpf('QR-Code ohne Abo / Der Inhalt steckt im Muster.'), ['QR-Code ohne Abo', 'Der Inhalt steckt im Muster.'])
  assert.deepEqual(kopfUndRumpf('Nur ein Satz.'), ['Nur ein Satz.', ''])
})

test('Umbruch: wenige, ausgeglichene Zeilen', () => {
  // gleichmäßig statt „Den WLAN-QR-Code / machst / du kostenlos / auf vamela.de.“
  const cta = text(umbrechen(woerter('Den WLAN-QR-Code machst du kostenlos auf vamela.de.'), { maxZeichen: 18, maxZeilen: 5 }))
  assert.equal(cta.length, 4)
  assert.ok(cta.every((z) => z.length >= 9 && z.length <= 18), cta.join(' | '))
  const z = umbrechen(woerter('Schnelle Websites gewinnen.'), { maxZeichen: 18, maxZeilen: 4 })
  assert.deepEqual(text(z), ['Schnelle Websites', 'gewinnen.'])
  for (const zeile of text(umbrechen(woerter('Diese Plätze kommen aus Unternehmensprofilen, nicht aus Websites.'), { maxZeichen: 18, maxZeilen: 5 }))) assert.ok(zeile.length <= 21, zeile)
})

test('Akzente Nacht: letztes starkes Wort orange, Tag teilt am Satzzeichen', () => {
  assert.deepEqual(nachtAkzente(woerter('Dein Formular kann kaputt sein.')).map((x) => x.st), [null, null, null, 'o', 'o'])
  assert.deepEqual(nachtAkzente(woerter('Schnelle Websites gewinnen.')).map((x) => x.st), [null, null, 'o'])
  assert.deepEqual(nachtAkzente(woerter('Schon *markiert* hier.')).map((x) => x.st), [null, 'ser', null], 'Markup des Autors gewinnt')
  const [a, b] = zweiTeile('Vier Schriften auf einem Flyer? Zwei reichen.')
  assert.equal(a.map((x) => x.w).join(' '), 'Vier Schriften auf einem Flyer?')
  assert.equal(b.map((x) => x.w).join(' '), 'Zwei reichen.')
})

test('Familie, Cover-Vorlage, Thema, Knopf', () => {
  assert.equal(familieVon({ familie: 'Nacht' }), 'nacht')
  assert.equal(familieVon({ saeule: 'werkzeuge', nr: 2 }), 'nacht')
  assert.equal(familieVon({ saeule: 'design', nr: 1 }), 'tag')
  assert.equal(familieVon({ saeule: 'tipps', nr: 3 }), 'nacht')
  assert.equal(coverVorlage({ cover_vorlage: 'tag-schwarz' }, 'tag'), 'tag-schwarz')
  assert.equal(coverVorlage({ cover_vorlage: 'tag-schwarz' }, 'nacht').startsWith('nacht'), true)
  assert.equal(thema({ titel: 'Die Kategorie im Google-Profil', saeule: 'tipps' }), 'Tipp für Betriebe')
  assert.equal(thema({ titel: 'QR-Code ohne Abo' }), 'QR-Code ohne Abo')
  assert.equal(ctaLabel('Speichere dir den Beitrag.', 'keins'), 'Speichern')
  assert.equal(ctaLabel('Gratis, Link in der Bio.', 'Werkzeug'), 'Link in der Bio')
  assert.equal(ctaLabel('Schick das jemandem.', 'keins'), 'Teilen')
  assert.equal(ctaLabel('Mehr davon gibt es hier.', 'keins'), 'Folgen')
})

test('Seiten-HTML: keine Deko-Nummern, Gegenmaßnahmen als Klassen', () => {
  const spec = textSpec({ familie: 'nacht', thema: 'Gratis-Werkzeug', text: 'Ein Satz hier. Und noch einer.' })
  const h0 = seiteHtml(spec, {}), h3 = seiteHtml(spec, { v1: true, stark: true })
  assert.match(h0, /class="s nacht feed"/)
  assert.match(h3, /class="s nacht feed v1 stark"/)
  assert.doesNotMatch(h0.replace(/<[^>]+>/g, ' '), /\b0[1-9]\b|\d\/6/)
})

test('Parser liest mehrwert, motiv, familie und Rohtext mit „ / “', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orange-'))
  const f = path.join(dir, 'p.md')
  fs.writeFileSync(f, `# Karussells

## Karussell 1: Probe
- Säule: tipps
- Hook-Stil: frage
- Angebot: keins
- Mehrwert: Du weißt danach, wie es geht.
- Motiv: „a paper airplane in a spider web“
- Familie: Nacht

| Seite | Vorlage | Text |
|---|---|---|
| 1 | Cover | **Kopf** / Unterzeile |
| 2 | Textseite | Überschrift / Rest mit *Akzent*. |
`)
  const [p] = readPosts(f)
  assert.equal(p.mehrwert, 'Du weißt danach, wie es geht.')
  assert.equal(p.motiv, 'a paper airplane in a spider web')
  assert.equal(p.familie, 'nacht')
  assert.equal(p.pages[1].roh, 'Überschrift / Rest mit *Akzent*.')
  assert.equal(p.pages[1].text, 'Überschrift Rest mit *Akzent*.')
})

test('Bild-Prompt je Familie', () => {
  assert.match(bildPrompt('a rocket', 'nacht'), /^Cinematic 3D render, pitch black background, a rocket, .*top 40 percent dark empty space, no text/)
  assert.match(bildPrompt('an elephant.', 'tag'), /^Bright surreal studio photograph, an elephant, .*35 to 40 percent plain empty background/)
  assert.throws(() => bildPrompt('', 'tag'))
})

test('Higgsfield-Zugang: getrennt oder als id:secret', () => {
  assert.equal(higgsfieldZugang({}), null)
  assert.deepEqual(higgsfieldZugang({ HIGGSFIELD_API_KEY: 'a', HIGGSFIELD_API_SECRET: 'b' }), { id: 'a', secret: 'b' })
  assert.deepEqual(higgsfieldZugang({ HIGGSFIELD_API_KEY: 'a:b' }), { id: 'a', secret: 'b' })
})

const testBild = (w = 300, h = 400) => sharp({ create: { width: w, height: h, channels: 3, background: '#203040' } }).png().toBuffer()

test('Higgsfield-Client: Anfrage, Statusabfrage, Download (gestellte Antworten, kein Netz)', async () => {
  const aufrufe = []
  const png = await testBild()
  const antworten = [
    { status: 200, json: { status: 'queued', request_id: 'r1', status_url: 'https://api.higgsfield.ai/requests/r1/status' } },
    { status: 200, json: { status: 'in_progress', request_id: 'r1' } },
    { status: 200, json: { status: 'completed', request_id: 'r1', images: [{ url: 'https://cdn.example/r1.png' }] } },
    { status: 200, bytes: png },
  ]
  const fetch = async (url, init = {}) => {
    aufrufe.push({ url, init })
    const a = antworten.shift()
    return { ok: a.status < 300, status: a.status, json: async () => a.json, text: async () => '', arrayBuffer: async () => a.bytes }
  }
  const c = higgsfield({ zugang: { id: 'ID', secret: 'SEC' }, fetch, warte: async () => {} })
  const r = await c.erzeugen('ein Prompt')
  assert.equal(r.request_id, 'r1')
  assert.deepEqual(r.bytes, png)
  assert.equal(aufrufe[0].url, 'https://api.higgsfield.ai/marketing-studio/image/flare')
  assert.equal(aufrufe[0].init.headers.Authorization, 'Key ID:SEC')
  assert.deepEqual(JSON.parse(aufrufe[0].init.body), { prompt: 'ein Prompt', aspect_ratio: '3:4', resolution: '1k', quality: 'low', enhance_prompt: false })
  assert.equal(aufrufe[1].url, 'https://api.higgsfield.ai/requests/r1/status')
})

test('beschaffeBild: Vorrat wird auf 1080 Breite gebracht, ohne Vorrat und Schlüssel klare Meldung', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bilder-'))
  fs.mkdirSync(path.join(dir, 'vorrat'))
  fs.writeFileSync(path.join(dir, 'vorrat', 'k01.png'), await testBild(880, 1168))
  const b = await beschaffeBild({ id: 'k01', motiv: 'a lamp', familie: 'tag' }, { dir, log: () => {} })
  assert.equal(b.anbieter, 'vorrat')
  assert.equal((await sharp(b.datei).metadata()).width, 1080)
  assert.equal(b.prompt, null)
  assert.match(b.prompt_vorschlag, /^Bright surreal/)
  // zweiter Aufruf nimmt das schon beschaffte Bild
  assert.equal((await beschaffeBild({ id: 'k01', motiv: 'a lamp', familie: 'tag' }, { dir })).am, b.am)
  const alt = process.env.HIGGSFIELD_API_KEY
  delete process.env.HIGGSFIELD_API_KEY
  await assert.rejects(beschaffeBild({ id: 'k02', motiv: 'a lamp', familie: 'nacht' }, { dir }), (e) => e instanceof BildFehlt && /HIGGSFIELD_API_KEY/.test(e.message))
  await assert.rejects(beschaffeBild({ id: 'k02', motiv: 'a lamp', familie: 'nacht' }, { dir, trocken: true }), (e) => e instanceof BildFehlt && /Trockenlauf/.test(e.message))
  await assert.rejects(beschaffeBild({ id: 'k03', familie: 'nacht' }, { dir }), /kein Feld „motiv:“/)
  if (alt) process.env.HIGGSFIELD_API_KEY = alt
})

test('Schlussseite: „Link in der Bio“ nur einmal (im Knopf), Hinweis bei langem Hook', () => {
  assert.equal(ohneLinkHinweis('Den Code machst du kostenlos auf vamela.de. Link in der Bio.'), 'Den Code machst du kostenlos auf vamela.de.')
  assert.equal(ohneLinkHinweis('Gratis im Browser. Link in der Bio, speicher dir den Beitrag.'), 'Gratis im Browser. Speicher dir den Beitrag.')
  assert.equal(ohneLinkHinweis('Probier es aus, Link in der Bio.'), 'Probier es aus.')
  assert.equal(ohneLinkHinweis('Speichere dir den Beitrag. Das Werkzeug findest du über den Link in der Bio.'), 'Speichere dir den Beitrag. Das Werkzeug findest du über den Link in der Bio.', 'Satzteil bleibt heil')
  assert.deepEqual(coverHinweise('Drei Orte für deinen Bewertungs-Code.'), [])
  assert.match(coverHinweise('Gäste fragen ständig nach dem WLAN? Ein Code erspart das.')[0], /^Hook zu lang \(> 9 Wörter\)/)
})

test('Umbruch: kein kurzes Wort allein in einer Zeile', () => {
  const z = umbrechen(woerter('Eine Schrift für Überschriften,'), { maxZeichen: 17, maxZeilen: 5 })
  assert.ok(z.every((l) => !(l.length === 1 && l[0].w.length <= 4)), z.map((l) => l.map((x) => x.w).join(' ')).join(' | '))
})

/** Synthetisches Seitenbild 1080 × 600: senkrechter Farbverlauf (Hintergrund), optional ein Objekt oben und Funken. */
const synth = ({ objekt = null, funken = 0 } = {}) => {
  const w = 1080, h = 600, ch = 3, data = Buffer.alloc(w * h * ch)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * ch
    // Hintergrund: weicher senkrechter Verlauf von dunkel nach etwas heller, dazu leichte Vignette
    const v = 12 + Math.round(y / 30) - Math.round(Math.abs(x - 540) / 120)
    data[i] = v + 4; data[i + 1] = v; data[i + 2] = v
    if (objekt && x >= objekt.x && x < objekt.x + objekt.w && y >= objekt.y && y < objekt.y + objekt.h) { data[i] = 200; data[i + 1] = 110; data[i + 2] = 60 }
  }
  for (let k = 0; k < funken; k++) { const x = (k * 97) % w, y = 60 + ((k * 53) % 90); for (let d = 0; d < 3; d++) { const i = (y * w + x + d) * ch; data[i] = 255; data[i + 1] = 140; data[i + 2] = 40 } }
  return { data, width: w, height: h, channels: ch }
}
const zeile = (y, text = 'Zeile') => ({ x: 80, y, w: 700, h: 80, text })

test('Freiraum: Objekt unter dem Text wird erkannt, leerer Grund und Funken bleiben unter der Grenze', () => {
  // Objekt (Kopf) hinter der zweiten Zeile
  const mitObjekt = freiraumAnteile(synth({ objekt: { x: 300, y: 220, w: 300, h: 160 } }), [zeile(60, 'frei'), zeile(260, 'auf Motiv')])
  assert.equal(mitObjekt[0].text, 'auf Motiv')
  assert.ok(mitObjekt[0].anteil > 0.2, String(mitObjekt[0].anteil))
  assert.ok(mitObjekt.find((a) => a.text === 'frei').anteil < 0.01)
  // nur Verlauf und Vignette
  assert.ok(freiraumAnteile(synth(), [zeile(60), zeile(260)]).every((a) => a.anteil === 0))
  // vereinzelte Funken (Glut) bleiben unter 4 %
  assert.ok(freiraumAnteile(synth({ funken: 400 }), [zeile(80)])[0].anteil < FREIRAUM.anteil)
  // der Rand von 24 px zählt mit: Objekt knapp unter der Zeile
  assert.ok(freiraumAnteile(synth({ objekt: { x: 300, y: 150, w: 400, h: 100 } }), [zeile(60)])[0].anteil > FREIRAUM.anteil)
})

test('Freiraum aus Bild: PNG und Fehlertext „Text auf Motiv“, Fußzeile ausgenommen', async () => {
  const { data, width, height, channels } = synth({ objekt: { x: 300, y: 220, w: 300, h: 160 } })
  const png = await sharp(data, { raw: { width, height, channels } }).png().toBuffer()
  const r = await pruefeFreiraum(png, [zeile(260, 'Überschrift'), { ...zeile(230, 'vamela.de'), fuss: true }])
  assert.equal(r.fehler.length, 1)
  assert.match(r.fehler[0], /^Text auf Motiv: „Überschrift“/)
})
