// Tests für die Sprech-Reels ohne Browser und ohne bezahlte Anfrage: Wortzeiten-Abgleich, Schnittplan, Parser, Regeln, Stimme.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { abgleichen, skriptWoerter, norm, wortzeiten } from '../../render/wortzeiten.mjs'
import { schnittplan, untertitelStuecke, schluesselwoerter, punchFaktor, bewegungAuf, shots, stichproben, BEWEGUNGEN, ENDKARTE_S, SHOT, FPS } from '../../render/schnitt.mjs'
import { readReels, szenenListe } from '../../render/inhalt.mjs'
import { pruefeSprechReel } from '../reel-regeln.mjs'
import { beschaffeStimme, higgsfieldStimme, StimmeFehlt, mcpParameter, STIMME, sprechfassung } from '../../render/stimme.mjs'

const STERLING = 'Jeder Betrieb hat eine Geschichte. Die meisten erzählen sie schlecht. Das ändern wir.'
// Whisper-Ausgabe für stimme/proben/sterling.mp3 (am Satzende oft ende == start)
const W_STERLING = [[' Jeder', 0.26, 0.56], [' Betrieb', 0.56, 0.94], [' hat', 0.94, 1.14], [' eine', 1.14, 1.62], [' Geschichte.', 1.62, 2.32], [' Die', 2.94, 3.32], [' meisten', 3.32, 3.64], [' erzählen', 3.64, 3.92], [' sie', 3.92, 4.3], [' schlecht.', 4.3, 4.8], [' Das', 5.38, 5.66], [' ändern', 5.66, 5.96], [' wir.', 5.96, 5.98]].map(([word, start, end]) => ({ word, start, end }))

test('Wortzeiten: Skriptwörter mit Satznummer, Rechtschreibung aus dem Skript', () => {
  const s = skriptWoerter('Dein *Logo* ist ein JPG? Schick es nie so. Speicher dir das.')
  assert.deepEqual(s.map((x) => x.satz), [0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2])
  assert.equal(s[1].wort, 'Logo')
  assert.equal(norm(' Vektordatei.'), 'vektordatei')
})

test('Wortzeiten: Abgleich übernimmt Whisper-Zeiten und erzwingt Mindestdauer am Satzende', () => {
  const w = abgleichen(skriptWoerter(STERLING), W_STERLING, { dauer: 6.6 })
  assert.equal(w.length, 13)
  assert.ok(w.every((x) => x.quelle === 'whisper'))
  assert.equal(w[0].start, 0.26)
  assert.equal(w[5].wort, 'Die')
  assert.equal(w[5].satz, 1)
  assert.ok(w[12].ende - w[12].start >= 0.15, 'letztes Wort bekommt mindestens 0,15 s')
  for (let i = 1; i < w.length; i++) assert.ok(w[i].start >= w[i - 1].start)
})

test('Wortzeiten: zerlegte und fehlende Wörter', () => {
  const skript = skriptWoerter('Leg das Bild auf vamela.de ab. Fertig.')
  // Whisper zerlegt „vamela.de“ und überhört „das“
  const whisper = [[' Leg', 0.2, 0.4], [' Bild', 0.7, 1.0], [' auf', 1.0, 1.2], [' Vamela', 1.2, 1.6], ['.de', 1.6, 1.9], [' ab.', 1.9, 2.1], [' Fertig.', 2.6, 3.0]].map(([word, start, end]) => ({ word, start, end }))
  const w = abgleichen(skript, whisper, { dauer: 3.2 })
  assert.deepEqual(w.map((x) => x.wort), ['Leg', 'das', 'Bild', 'auf', 'vamela.de', 'ab.', 'Fertig.'])
  assert.equal(w[1].quelle, 'geschaetzt')
  assert.ok(w[1].start >= 0.4 && w[1].ende <= 0.7 + 1e-9, JSON.stringify(w[1]))
  assert.equal(w[4].start, 1.2)
  assert.equal(w[4].ende, 1.9)
})

test('Wortzeiten: Zwischenspeicher je Audio und Text (Whisper nur einmal)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wz-'))
  const audio = path.join(dir, 'a.mp3')
  fs.writeFileSync(audio, 'nicht wirklich audio')
  let aufrufe = 0
  const transkribieren = async () => { aufrufe++; return { text: STERLING, woerter: W_STERLING } }
  const cache = path.join(dir, 'w.json')
  const opt = { cache, transkribieren, dauer: () => 6.6, log: () => {} }
  const a = await wortzeiten(audio, STERLING, opt)
  const b = await wortzeiten(audio, STERLING, opt)
  assert.equal(aufrufe, 1)
  assert.deepEqual(b.map((x) => x.start), a.map((x) => x.start))
  await wortzeiten(audio, STERLING + ' Neu.', opt) // anderer Text: neu erkennen
  assert.equal(aufrufe, 2)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('Schnitt: harter Schnitt je Satz, Shots 1,2–2 s, Endkarte 1,5 s', () => {
  const woerter = abgleichen(skriptWoerter(STERLING), W_STERLING, { dauer: 6.6 })
  // Für den Test einen längeren Text simulieren: Zeiten strecken
  const lang = woerter.map((w) => ({ ...w, start: w.start * 3, ende: w.ende * 3 }))
  const plan = schnittplan({ woerter: lang, dauerAudio: 19.8, szenen: [{ art: 'bild' }, { art: 'aufnahme' }, { art: 'bild' }], sprechtext: STERLING })
  assert.equal(plan.frames, Math.round(plan.T * FPS))
  assert.ok(Math.abs(plan.endkarte.bis - plan.endkarte.von - ENDKARTE_S) < 1e-9)
  assert.equal(plan.szenen[0].von, 0)
  // Schnitt zwei Frames vor dem ersten Wort jedes Satzes
  assert.ok(Math.abs(plan.szenen[1].von - (lang[5].start - 2 / FPS)) < 1e-9)
  assert.ok(plan.szenen[1].aufnahme)
  for (const sz of plan.szenen) {
    for (const s of sz.shots) assert.ok(s.bis - s.von <= SHOT.max + 1e-9, `Shot ${(s.bis - s.von).toFixed(2)} s`)
    assert.equal(sz.shots[0].von, sz.von)
  }
  for (let i = 1; i < plan.szenen.length; i++) assert.equal(plan.szenen[i].von, plan.szenen[i - 1].bis)
  assert.ok(plan.stuecke.every((s) => s.woerter.length >= 1 && s.woerter.length <= 4))
  assert.ok(plan.punches.some((p) => p.staerke === 0.08), 'Punch-Zoom auf Schlüsselwort')
  const proben = stichproben(plan)
  assert.ok(proben.some((p) => p.name === 'Hook') && proben.some((p) => p.name === 'Endkarte'))
})

test('Schnitt: Untertitel 1–4 Wörter, Umbruch an Satzzeichen und Satzgrenzen', () => {
  const w = skriptWoerter('Dann lädst du SVG, PDF, EPS oder DXF herunter, ohne Anmeldung. Speicher dir das.').map((x, i) => ({ ...x, start: i * 0.3, ende: i * 0.3 + 0.25 }))
  const st = untertitelStuecke(w).map((s) => s.woerter.map((x) => x.wort).join(' '))
  assert.ok(st.every((s) => s.split(' ').length <= 4 && s.length <= 20), st.join(' | '))
  assert.ok(st.includes('Speicher dir das.'))
  assert.ok(!st.some((s) => /Anmeldung\. Speicher/.test(s)))
})

test('Schnitt: Schlüsselwörter, Punch-Zoom und Bewegung', () => {
  assert.deepEqual([...schluesselwoerter('Das ist ==wichtig== und _klar_.')], [2, 4])
  const auto = schluesselwoerter('Dein Logo gibt es nur als unscharfes JPG? Schick nie ein Handyfoto.')
  assert.deepEqual([...auto], [6, 11])
  const p = [{ t: 1, staerke: 0.08, dauer: 0.15 }]
  assert.equal(punchFaktor(0.99, p), 1)
  assert.ok(Math.abs(punchFaktor(1, p) - 1.08) < 1e-9)
  assert.ok(punchFaktor(1.1, p) > 1 && punchFaktor(1.1, p) < 1.08)
  assert.equal(punchFaktor(1.2, p), 1)
  const b0 = bewegungAuf(BEWEGUNGEN.rechts, 0), b1 = bewegungAuf(BEWEGUNGEN.rechts, 1)
  assert.equal(b0.x, -46); assert.equal(b1.x, 46)
  // Kein Bildrand sichtbar: Verschiebung kleiner als der Überstand durch die Vergrößerung
  for (const [n, b] of Object.entries(BEWEGUNGEN)) for (const q of [0, 1]) { const m = bewegungAuf(b, q); assert.ok(Math.abs(m.x) <= (m.s - 1) * 540 && Math.abs(m.y) <= (m.s - 1) * 960, n) }
  assert.equal(shots(0, 1, 0).length, 1)
  assert.ok(shots(0, 6.5, 0).every((s) => s.bis - s.von >= SHOT.min - 1e-9 && s.bis - s.von <= SHOT.max + 1e-9))
})

test('Parser: Sprechtext und Szenen der sechs Reels', () => {
  const reels = readReels()
  assert.equal(reels.length, 6)
  for (const r of reels) {
    assert.ok(r.sprechtext && r.szenen.length >= 3, r.id)
    assert.deepEqual(pruefeSprechReel(r), [], r.id)
    assert.ok(r.mehrwert && r.familie, r.id)
  }
  assert.deepEqual(readReels()[0].szenen.slice(0, 3), [{ art: 'bild', vorrat: 'k20' }, { art: 'bild', vorrat: 'k18' }, { art: 'aufnahme', url: 'https://vamela.de/vektorisieren' }])
  assert.deepEqual(szenenListe('**Szenen**\n1. tag: a cat on an orange chair\n\n**Caption:**\n2. nacht: nope'), [{ art: 'bild', familie: 'tag', motiv: 'a cat on an orange chair' }])
})

test('Regeln: Sprech-Reel', () => {
  const gut = readReels()[0]
  assert.deepEqual(pruefeSprechReel(gut), [])
  const f = (x) => pruefeSprechReel({ ...gut, ...x })
  assert.match(f({ sprechtext: 'Zu kurz. Viel zu kurz. Speicher dir das.' })[0], /Wörter/)
  assert.ok(f({ angebot: 'keins' }).some((x) => /Angebot keins/.test(x)))
  assert.ok(f({ sprechtext: gut.sprechtext.replace('vamela.de.', 'vamela.de/vektorisieren.') }).some((x) => /Webadresse/.test(x)))
  assert.ok(f({ szenen: gut.szenen.slice(1) }).some((x) => /Szenen für/.test(x)))
  assert.ok(f({ szenen: [...gut.szenen.slice(1), { art: 'aufnahme', url: 'https://example.com/' }] }).some((x) => /nur von https:\/\/vamela\.de/.test(x)))
  assert.ok(f({ szenen: [...gut.szenen.slice(1), { art: 'bild', familie: 'tag', motiv: 'a Minecraft creeper on an orange floor' }] }).some((x) => /Marke/.test(x)))
})

test('Stimme: Vorrat, Textabgleich, Trockenlauf, fehlender Zugang', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stimme-'))
  fs.mkdirSync(path.join(dir, 'vorrat'))
  const text = 'Dein Logo ist *unscharf*. Speicher dir das.'
  // ohne Aufnahme und ohne Zugang: klare Meldung mit den MCP-Parametern
  const ohne = { HIGGSFIELD_API_KEY: process.env.HIGGSFIELD_API_KEY, HIGGSFIELD_API_SECRET: process.env.HIGGSFIELD_API_SECRET }
  delete process.env.HIGGSFIELD_API_KEY; delete process.env.HIGGSFIELD_API_SECRET
  try {
    await assert.rejects(() => beschaffeStimme({ id: 'r09', text }, { dir, log: () => {} }), (e) => e instanceof StimmeFehlt && e.message.includes(STIMME.voice_id) && e.message.includes('Dein Logo ist unscharf.'))
    await assert.rejects(() => beschaffeStimme({ id: 'r09', text }, { dir, trocken: true, log: () => {} }), (e) => e instanceof StimmeFehlt && /Trockenlauf/.test(e.message))
    await assert.rejects(() => beschaffeStimme({ id: 'r09', text: '' }, { dir }), StimmeFehlt)
  } finally { Object.assign(process.env, Object.fromEntries(Object.entries(ohne).filter(([, v]) => v != null))) }
  // Vorrat mit anderem Text wird abgelehnt, mit passendem Text übernommen
  fs.writeFileSync(path.join(dir, 'vorrat', 'r09.mp3'), 'mp3')
  fs.writeFileSync(path.join(dir, 'vorrat', 'r09.json'), JSON.stringify({ text: 'Etwas anderes.', stimme: 'Sterling' }))
  await assert.rejects(() => beschaffeStimme({ id: 'r09', text }, { dir, log: () => {} }), /anderen Text/)
  fs.writeFileSync(path.join(dir, 'vorrat', 'r09.json'), JSON.stringify({ text: sprechfassung(text), stimme: 'Sterling', job: 'abc' }))
  const r = await beschaffeStimme({ id: 'r09', text }, { dir, log: () => {} })
  assert.equal(r.anbieter, 'vorrat'); assert.equal(r.job, 'abc'); assert.ok(fs.existsSync(path.join(dir, 'r09.mp3')))
  // zweites Mal: schon beschafft
  assert.equal((await beschaffeStimme({ id: 'r09', text }, { dir, log: () => {} })).anbieter, 'vorrat')
  assert.deepEqual(mcpParameter(text), { model: 'text2speech_v2', variant: 'elevenlabs', voice_type: 'preset', voice_id: 'dc382508-c8bd-443c-8cb2-46e57b8d2e6f', prompt: 'Dein Logo ist unscharf. Speicher dir das.' })
  fs.rmSync(dir, { recursive: true, force: true })
})

test('Stimme: REST-Client (Attrappe, keine echte Anfrage)', async () => {
  const anfragen = []
  const fetch = async (url, o = {}) => {
    anfragen.push({ url, o })
    if (o.method === 'POST') return { ok: true, json: async () => ({ request_id: 'q1', status: 'queued', status_url: 'https://api.higgsfield.ai/requests/q1/status' }) }
    if (url.endsWith('/status')) return { ok: true, status: 200, json: async () => ({ status: 'completed', audio: { url: 'https://cdn.example/a.mp3' } }) }
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode('mp3').buffer }
  }
  const c = higgsfieldStimme({ zugang: { id: 'i', secret: 's' }, endpunkt: '/tts/test', fetch, warte: async () => {} })
  const r = await c.erzeugen('Hallo *du*.')
  assert.equal(r.request_id, 'q1')
  assert.equal(String(r.bytes), 'mp3')
  assert.equal(anfragen[0].url, 'https://api.higgsfield.ai/tts/test')
  assert.equal(anfragen[0].o.headers.Authorization, 'Key i:s')
  assert.deepEqual(JSON.parse(anfragen[0].o.body), { text: 'Hallo du.', prompt: 'Hallo du.', variant: 'elevenlabs', voice_type: 'preset', voice_id: STIMME.voice_id })
  await assert.rejects(() => higgsfieldStimme({ zugang: { id: 'i', secret: 's' }, endpunkt: null, fetch }).erzeugen('x'), /HIGGSFIELD_TTS_ENDPUNKT/)
})
