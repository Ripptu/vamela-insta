// Tests für das automatische Reparieren abgelehnter Beiträge (automatik/reparieren.mjs) und die Story-Regel (keine Caption),
// ganz ohne Claude und ohne Netz: frageClaude und die GitHub-Abfrage sind ersetzt, ein falsches "claude" (CLAUDE_BIN) ersetzt
// den Prüf-Agenten. Schreibt nur in temporäre Ordner; das echte plan/, docs/ und data/ wird nur gelesen.
// Aufruf: node --test automatik/test/reparieren.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'
import { lauf, findeBlock, ersetzeBlock, pruefeReparatur, liesBlock, baueReparaturPrompt, ClaudeAus } from '../reparieren.mjs'
import {
  gruendeArt, istReparierbar, istAufzugeben, versuche, veralteteStoryGruende, MAX_REPARATUREN, ladeHistorie,
} from '../reparatur-historie.mjs'
import { zaehlePuffer } from '../puffer-zaehlen.mjs'
import { bauePrompt, ladeRegeln, entfaellt, pruefe } from '../qa.mjs'

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname)
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rep-test-'))
const stumm = () => {}
const params = { puffer_min: 30, reels_aktiv: false }
// Feste Kopien der Blöcke im Stand vor der Reparatur, damit die Tests nicht vom aktuellen Vorrat abhängen
const FIX = { posts: path.join(ROOT, 'automatik/test/fixtures/reparieren-posts.md'), stories: path.join(ROOT, 'automatik/test/fixtures/reparieren-stories.md') }

// ---- Testordner mit Kopien der echten Vorratsdateien ------------------------------------------------------------------
function baueRoot(queue, historie = null) {
  const root = tmpDir()
  for (const d of ['docs', 'plan', 'data', 'out']) fs.mkdirSync(path.join(root, d), { recursive: true })
  fs.copyFileSync(FIX.posts, path.join(root, 'docs/content-posts.md'))
  fs.copyFileSync(FIX.stories, path.join(root, 'docs/content-stories-auto.md'))
  fs.copyFileSync(path.join(ROOT, 'CLAUDE.md'), path.join(root, 'CLAUDE.md'))
  fs.writeFileSync(path.join(root, 'plan/queue.json'), JSON.stringify(queue, null, 2) + '\n')
  if (historie) fs.writeFileSync(path.join(root, 'data/reparaturen.json'), JSON.stringify(historie, null, 2) + '\n')
  return root
}
const lies = (root, f) => fs.readFileSync(path.join(root, f), 'utf8')
const queueVon = (root) => JSON.parse(lies(root, 'plan/queue.json'))
const eintrag = (id, gruende, extra = {}) => {
  const typ = id[0] === 's' ? 'story' : 'karussell'
  const nr = +id.slice(1)
  const saeule = { k07: 'tipps', k08: 'werkzeuge', k13: 'fundstuecke' }[id] ?? (typ === 'story' ? 'design' : 'tipps')
  return {
    id, typ, titel: `Titel ${id}`, saeule, status: 'abgelehnt', quelle: typ === 'story' ? `docs/content-stories-auto.md#Story ${nr}` : `docs/content-posts.md#Karussell ${nr}`,
    dateien: [`out/${id}/01.jpg`], qa: { verdikt: 'abgelehnt', gruende, am: '2026-10-12T10:00:00Z' }, ...extra,
  }
}
/** Originalblock aus dem Prompt (zwischen „# Originalblock“ und der Schlusszeile). */
const blockAusPrompt = (prompt) => /# Originalblock \(Format exakt beibehalten\)\n\n([\s\S]*?)\n\nGib NUR den korrigierten Block aus/.exec(prompt)[1]
/** Falsches Claude: antwortet der Reihe nach mit den Funktionen aus `antworten` (Block → neuer Text). */
function fakeFrage(antworten) {
  const f = async (prompt, opts) => {
    f.prompts.push(prompt)
    const a = antworten[Math.min(f.prompts.length - 1, antworten.length - 1)]
    if (a instanceof Error) throw a
    return a(blockAusPrompt(prompt), prompt)
  }
  f.prompts = []
  return f
}
const repoMock = {
  daten: { slug: 'upscayl/upscayl', lizenz: 'AGPL-3.0', sterne: 50123, sterne_text: 'rund 50.000 (Stand 12.10.2026)', stand: '12.10.2026', beschreibung: 'Free and Open Source AI Image Upscaler' },
  readme: 'UNIQUE_README_MARKER Upscayl is a free image upscaler. Needs a Vulkan compatible GPU.', kosten: [],
}
const ohneRepoNetz = async () => { throw new Error('Netz darf nicht gefragt werden') }

const WLAN_SPRACHE = ["SPRACHE: Seite 5: 'Dazu gibt es einen fertigen Aufsteller für Theke' – grammatikalisch fehlerhaft, es fehlt der Artikel ('für die Theke')."]
const k08Fix = (b) => b.replace('für Theke, Wartezimmer oder Ferienwohnung.', 'für die Theke, das Wartezimmer oder die Ferienwohnung.')

// ---- Einteilung der Gründe, Zählung -----------------------------------------------------------------------------------

test('gruendeArt: Ausfall, Format, Gestaltung, Inhalt, leer', () => {
  assert.equal(gruendeArt(['Prüfung nicht durchführbar: Zeitüberschreitung']), 'ausfall')
  assert.equal(gruendeArt(['REPO: x', 'Prüfung nicht durchführbar: y']), 'ausfall')
  assert.equal(gruendeArt(['Format: Datei fehlt (a.jpg)']), 'format')
  assert.equal(gruendeArt(['GESTALTUNG: Seite 1: Text auf Motiv']), 'gestaltung')
  assert.equal(gruendeArt(['GESTALTUNG: a', 'Format: b']), 'gestaltung')
  assert.equal(gruendeArt(['GESTALTUNG: a', 'MEHRWERT: b']), 'inhalt')
  assert.equal(gruendeArt(['REPO: x']), 'inhalt')
  assert.equal(gruendeArt([]), 'leer')
})

test('istReparierbar / istAufzugeben: Zähler aus Queue-Feld und Historie, Ausfall und fremde Typen zählen nicht', () => {
  const x = eintrag('k08', WLAN_SPRACHE)
  assert.equal(istReparierbar(x), true)
  assert.equal(versuche(x, []), 0)
  assert.equal(versuche({ ...x, reparaturen: 2 }, []), 2)
  const hist = [{ id: 'k08' }, { id: 'k08' }, { id: 'k01' }]
  assert.equal(versuche(x, hist), 2)
  assert.equal(istReparierbar(x, hist), true)
  assert.equal(istReparierbar(x, [...hist, { id: 'k08' }]), false, 'dritter Versuch verbraucht')
  assert.equal(istAufzugeben(x, [...hist, { id: 'k08' }]), true)
  assert.equal(istReparierbar({ ...x, reparaturen: 3 }), false)
  assert.equal(istReparierbar(eintrag('k08', ['Prüfung nicht durchführbar: x'])), false)
  assert.equal(istAufzugeben(eintrag('k08', ['Prüfung nicht durchführbar: x'], { reparaturen: 3 })), false, 'Ausfall wird nie aufgegeben')
  assert.equal(istReparierbar({ ...x, status: 'geprueft' }), false)
  assert.equal(istReparierbar({ ...x, typ: 'reel' }), false)
})

test('Puffer: aufgegebene zählen nicht, reparierbare stehen extra', () => {
  const q = [
    { id: 'k01', typ: 'karussell', status: 'geprueft' }, { id: 'k02', typ: 'karussell', status: 'aufgegeben' },
    eintrag('k03', ['REPO: x']), eintrag('k04', ['REPO: x'], { reparaturen: 3 }), eintrag('k05', ['Prüfung nicht durchführbar: x']),
  ]
  const z = zaehlePuffer(q, params)
  assert.equal(z.feed, 1)
  assert.equal(z.aufgegeben, 1)
  assert.equal(z.reparierbar, 1)
  assert.equal(z.aufzugeben, 1)
})

test('puffer.mjs meldet noetig=true, wenn nur reparierbare Ablehnungen offen sind', () => {
  // Gegen die echte Queue: es gibt abgelehnte Beiträge ohne Ausfall, daher muss noetig=true kommen
  const q = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan/queue.json'), 'utf8'))
  const reparierbar = q.some((x) => istReparierbar(x, ladeHistorie(path.join(ROOT, 'data/reparaturen.json'))))
  const r = spawnSync(process.execPath, ['automatik/puffer.mjs'], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /noetig=(true|false)/)
  if (reparierbar) assert.match(r.stdout, /noetig=true/)
})

// ---- Blöcke in den Dateien --------------------------------------------------------------------------------------------

test('findeBlock/ersetzeBlock: ersetzt genau einen Block, alles andere bleibt Byte für Byte', () => {
  const md = fs.readFileSync(FIX.posts, 'utf8')
  const b = findeBlock(md, 'Karussell', 8)
  assert.ok(b.text.startsWith('## Karussell 8: WLAN ohne Abtippen'))
  assert.ok(b.text.endsWith('#gastronomie #ferienwohnung #qrcode #freising #moosburg'))
  assert.doesNotMatch(b.text, /## Karussell 9/)
  const neu = ersetzeBlock(md, 'Karussell', 8, k08Fix(b.text) + '\n')
  assert.notEqual(neu, md)
  assert.equal(neu.slice(0, b.start), md.slice(0, b.start))
  assert.equal(neu.slice(neu.length - (md.length - b.ende)), md.slice(b.ende))
  assert.equal(ersetzeBlock(md, 'Karussell', 999, 'x'), null)
  const st = fs.readFileSync(FIX.stories, 'utf8')
  const s2 = findeBlock(st, 'Story', 2)
  assert.ok(s2.text.endsWith('- Familie: tag'), 'Story-Block endet vor der Trennlinie')
})

test('pruefeReparatur: gleiche Prüfungen wie neu-schreiben (Nummer, Merkmale, Struktur, Pflichtzeilen, Repo, Story-Regeln)', () => {
  const md = fs.readFileSync(FIX.posts, 'utf8')
  const orig = findeBlock(md, 'Karussell', 8).text
  const o = liesBlock('Karussell', orig)[0]
  assert.equal(pruefeReparatur({ wort: 'Karussell', text: orig, original: o }), null)
  assert.equal(pruefeReparatur({ wort: 'Karussell', text: k08Fix(orig), original: o }), null)
  assert.match(pruefeReparatur({ wort: 'Karussell', text: orig.replace('## Karussell 8', '## Karussell 9'), original: o }), /Nummer 9/)
  assert.match(pruefeReparatur({ wort: 'Karussell', text: orig.replace('- Säule: werkzeuge', '- Säule: tipps'), original: o }), /Säule „tipps“, muss „werkzeuge“ bleiben/)
  assert.match(pruefeReparatur({ wort: 'Karussell', text: orig.replace(/^- Mehrwert: .*\n/m, ''), original: o }), /Mehrwert/)
  assert.match(pruefeReparatur({ wort: 'Karussell', text: orig.replace('| 6 | Schlussseite | Den WLAN-QR-Code machst du kostenlos auf vamela.de. Link in der Bio. |', '| 6 | Schlussseite | Den WLAN-QR-Code machst du kostenlos auf vamela.de. |'), original: o }), /Link in der Bio/)
  assert.match(pruefeReparatur({ wort: 'Karussell', text: 'Hallo, kein Block', original: o }), /Parser|lesbar/)
  // Story
  const sMd = fs.readFileSync(FIX.stories, 'utf8')
  const sOrig = findeBlock(sMd, 'Story', 2).text
  const so = liesBlock('Story', sOrig)[0]
  assert.equal(pruefeReparatur({ wort: 'Story', text: sOrig, original: so }), null)
  assert.match(pruefeReparatur({ wort: 'Story', text: sOrig.replace('Schreib mir ein Wort als Nachricht.', 'Antworte mir.'), original: so }), /Nachricht/)
})

test('Prompt: Gründe wörtlich, Originalblock, Regeln, README-Auszug und Hinweis zum Streichen', () => {
  const md = fs.readFileSync(FIX.posts, 'utf8')
  const t = findeBlock(md, 'Karussell', 13).text
  const p = baueReparaturPrompt({ wort: 'Karussell', nr: 13, blockText: t, gruende: ['REPO: Seite 5 behauptet etwas, das nicht im README steht'], art: 'inhalt', regeln: 'REGELN_MARKER', repo: repoMock })
  assert.ok(p.includes('- REPO: Seite 5 behauptet etwas, das nicht im README steht'))
  assert.ok(p.includes(t))
  assert.ok(p.includes('UNIQUE_README_MARKER'))
  assert.ok(p.includes('REGELN_MARKER'))
  assert.match(p, /Ändere NUR die bemängelten Stellen/)
  assert.match(p, /streichst du im Zweifel/)
  assert.match(p, /Satz an den tatsächlichen Inhalt anpassen/)
})

// ---- Der Lauf ---------------------------------------------------------------------------------------------------------

test('lauf: inhaltlicher Grund → Block in der Quelldatei ersetzt, Eintrag entfernt, Historie geschrieben, Rest unberührt', async () => {
  const root = baueRoot([eintrag('k08', WLAN_SPRACHE), { id: 'k01', typ: 'karussell', status: 'geprueft' }])
  fs.mkdirSync(path.join(root, 'out/k08'), { recursive: true })
  fs.writeFileSync(path.join(root, 'out/k08/01.jpg'), 'x')
  const vorher = lies(root, 'docs/content-posts.md')
  const frage = fakeFrage([k08Fix])
  const e = await lauf({ root, frage, repoLive: ohneRepoNetz, protokoll: stumm, jetzt: new Date('2026-10-12T12:00:00Z') })
  assert.deepEqual(e.repariert, ['k08'])
  const nachher = lies(root, 'docs/content-posts.md')
  assert.match(nachher, /für die Theke, das Wartezimmer oder die Ferienwohnung\./)
  const b = findeBlock(vorher, 'Karussell', 8)
  assert.equal(nachher.slice(0, b.start), vorher.slice(0, b.start))
  assert.equal(nachher.slice(nachher.length - (vorher.length - b.ende)), vorher.slice(b.ende))
  assert.deepEqual(queueVon(root).map((x) => x.id), ['k01'], 'Eintrag entfernt, damit produce.mjs neu rendert')
  assert.equal(fs.existsSync(path.join(root, 'out/k08')), false)
  const h = ladeHistorie(path.join(root, 'data/reparaturen.json'))
  assert.equal(h.length, 1)
  assert.deepEqual({ id: h[0].id, versuch: h[0].versuch, ergebnis: h[0].ergebnis, art: h[0].art, am: h[0].am }, { id: 'k08', versuch: 1, ergebnis: 'repariert', art: 'inhalt', am: '2026-10-12T12:00:00.000Z' })
  assert.deepEqual(h[0].gruende, WLAN_SPRACHE)
  // Der Prompt enthielt Gründe wörtlich, den Originalblock und die festen Regeln aus CLAUDE.md
  assert.equal(frage.prompts.length, 1)
  assert.ok(frage.prompts[0].includes(WLAN_SPRACHE[0]))
  assert.ok(frage.prompts[0].includes('## Karussell 8: WLAN ohne Abtippen'))
  assert.match(frage.prompts[0], /Karussell-Struktur/)
  // Nach dem Rendern und einer erneuten Ablehnung kommt die Zählung aus der Historie zurück (versuche = 1)
  assert.equal(versuche({ id: 'k08' }, h), 1)
})

test('lauf: Fundstück bekommt den README-Auszug; ungültige Antwort wird mit Rückmeldung wiederholt', async () => {
  const gruende = ["REPO: Seite 5 ('Verwackelte oder unscharfe Fotos rettet es aber nicht.') behauptet eine Grenze, die im README-Auszug nicht steht."]
  const root = baueRoot([eintrag('k13', gruende)])
  const frage = fakeFrage([
    (b) => b.replace('- Säule: fundstuecke', '- Säule: tipps'), // Merkmal geändert → Code lehnt ab
    (b) => b.replace(' Verwackelte oder unscharfe Fotos rettet es aber nicht.', '')
      .replace(' Und unscharfe oder verwackelte Fotos macht Upscayl nicht scharf, es hilft bei Bildern mit zu wenig Pixeln.', ''),
  ])
  const e = await lauf({ root, frage, repoLive: async (slug) => { assert.equal(slug, 'upscayl/upscayl'); return repoMock }, protokoll: stumm })
  assert.deepEqual(e.repariert, ['k13'])
  assert.equal(frage.prompts.length, 2)
  assert.ok(frage.prompts[0].includes('UNIQUE_README_MARKER'), 'README-Auszug im Prompt')
  assert.match(frage.prompts[1], /Dein letzter Versuch wurde vom Code abgelehnt/)
  assert.match(frage.prompts[1], /Säule „tipps“, muss „fundstuecke“ bleiben/)
  const neu = lies(root, 'docs/content-posts.md')
  assert.doesNotMatch(findeBlock(neu, 'Karussell', 13).text, /Verwackelte|verwackelte/)
  assert.match(findeBlock(neu, 'Karussell', 13).text, /- Repo: upscayl\/upscayl/)
})

test('lauf: scheitert der Code dreimal, zählt es als Versuch, der Block bleibt, der Eintrag bekommt reparaturen', async () => {
  const root = baueRoot([eintrag('k08', WLAN_SPRACHE)])
  const vorher = lies(root, 'docs/content-posts.md')
  const frage = fakeFrage([(b) => b.replace('- Familie: nacht', '- Familie: bunt')])
  const e = await lauf({ root, frage, repoLive: ohneRepoNetz, protokoll: stumm })
  assert.deepEqual(e.gescheitert, ['k08'])
  assert.equal(frage.prompts.length, 3, 'drei Versuche je Reparatur')
  assert.equal(lies(root, 'docs/content-posts.md'), vorher)
  const q = queueVon(root)
  assert.equal(q[0].status, 'abgelehnt')
  assert.equal(q[0].reparaturen, 1)
  assert.equal(ladeHistorie(path.join(root, 'data/reparaturen.json'))[0].ergebnis, 'gescheitert')
})

test('lauf: nach drei Versuchen aufgegeben (mit Grund), ohne Claude noch einmal zu fragen; Ersatz entsteht über den Puffer', async () => {
  const hist = [1, 2, 3].map((v) => ({ id: 'k08', versuch: v, ergebnis: 'gescheitert', gruende: WLAN_SPRACHE, am: '2026-10-12T09:00:00Z' }))
  const root = baueRoot([eintrag('k08', WLAN_SPRACHE), eintrag('k07', ['Prüfung nicht durchführbar: Zeitüberschreitung'])], hist)
  const frage = fakeFrage([() => { throw new Error('darf nicht gefragt werden') }])
  const e = await lauf({ root, frage, repoLive: ohneRepoNetz, protokoll: stumm, jetzt: new Date('2026-10-12T12:00:00Z') })
  assert.deepEqual(e.aufgegeben, ['k08'])
  assert.equal(frage.prompts.length, 0)
  const q = queueVon(root)
  const k08 = q.find((x) => x.id === 'k08')
  assert.equal(k08.status, 'aufgegeben')
  assert.match(k08.aufgegeben.grund, /Nach 3 Reparaturen weiterhin abgelehnt/)
  assert.match(k08.aufgegeben.grund, /SPRACHE/)
  assert.equal(q.find((x) => x.id === 'k07').status, 'abgelehnt', 'Prüfungsausfall bleibt unberührt')
  assert.equal(zaehlePuffer(q, params).aufgegeben, 1)
  assert.equal(zaehlePuffer(q, params).feed, 0)
})

test('lauf: dritter Fehlversuch gibt sofort auf', async () => {
  const hist = [1, 2].map((v) => ({ id: 'k08', versuch: v, ergebnis: 'gescheitert', gruende: WLAN_SPRACHE, am: '2026-10-12T09:00:00Z' }))
  const root = baueRoot([eintrag('k08', WLAN_SPRACHE)], hist)
  const e = await lauf({ root, frage: fakeFrage([(b) => b]), repoLive: ohneRepoNetz, protokoll: stumm })
  assert.deepEqual(e.gescheitert, ['k08'])
  assert.deepEqual(e.aufgegeben, ['k08'])
  assert.equal(queueVon(root)[0].status, 'aufgegeben')
  assert.equal(ladeHistorie(path.join(root, 'data/reparaturen.json')).length, 3)
})

test('lauf: Stories, deren einziger Grund die leere Caption war, gehen unverändert zurück auf neu (kein Claude)', async () => {
  const leer = 'CAPTION: Caption ist komplett leer; sie endet nicht mit einer Frage an die Lesenden.'
  const angebot = "ANGEBOT: Beitragsdaten nennen Angebot 'keins', Seite 2 enthält jedoch 'Link in der Bio'."
  const root = baueRoot([
    eintrag('s01', [leer]), eintrag('s03', [angebot, leer], { saeule: 'werkzeuge' }), eintrag('s05', [angebot, leer], { saeule: 'tipps' }),
    eintrag('s06', [leer, 'SPRACHE: Tippfehler auf Seite 1']),
  ])
  const vorherDocs = lies(root, 'docs/content-stories-auto.md')
  const frage = fakeFrage([() => { throw new Error('Claude wurde gefragt') }])
  // s05 (Säule tipps, echter Angebots-Widerspruch) und s06 (echter Sprachfehler) brauchen Claude; fürs Rücksetzen nur --nur
  const e = await lauf({ root, frage, repoLive: ohneRepoNetz, protokoll: stumm, nur: ['s01', 's03'] })
  assert.deepEqual(e.zurueckAufNeu.sort(), ['s01', 's03'])
  assert.equal(frage.prompts.length, 0)
  const q = queueVon(root)
  for (const id of ['s01', 's03']) { const x = q.find((y) => y.id === id); assert.equal(x.status, 'neu'); assert.equal(x.qa, null) }
  assert.equal(q.find((x) => x.id === 's05').status, 'abgelehnt')
  assert.equal(lies(root, 'docs/content-stories-auto.md'), vorherDocs, 'Story-Texte unverändert')
  // Bleibt ein echter Grund übrig, werden nur die veralteten gestrichen
  const e2 = await lauf({ root, frage: fakeFrage([(b) => b]), repoLive: ohneRepoNetz, protokoll: stumm, nur: ['s06'], max: 0 })
  assert.deepEqual(e2.zurueckAufNeu, [])
  assert.deepEqual(queueVon(root).find((x) => x.id === 's06').qa.gruende, ['SPRACHE: Tippfehler auf Seite 1'])
  assert.deepEqual(veralteteStoryGruende(eintrag('s05', [angebot, leer], { saeule: 'tipps' })), [leer], 'ANGEBOT bleibt ein Grund, wenn die Säule nicht werkzeuge ist')
})

test('lauf: GESTALTUNG → Claude kürzt (eigener Prompt), dann neu rendern; Format → ohne Claude neu rendern', async () => {
  const root = baueRoot([
    eintrag('k08', ['GESTALTUNG: Seite 1: Text auf Motiv: „Gäste fragen“ (9 % Motiv um die Zeile, erlaubt 4 %)']),
    eintrag('k07', ['Format: Datei fehlt (out/k07/03.jpg)']),
  ])
  const frage = fakeFrage([(b) => b.replace('**Gäste fragen ständig nach dem WLAN? Ein Code erspart das.**', '**Gäste fragen nach dem WLAN? Ein Code hilft.**')])
  const e = await lauf({ root, frage, repoLive: ohneRepoNetz, protokoll: stumm })
  assert.deepEqual(e.repariert, ['k08'])
  assert.deepEqual(e.neuGerendert, ['k07'])
  assert.equal(frage.prompts.length, 1, 'für Format-Fehler kein Claude')
  assert.match(frage.prompts[0], /Gestaltungsprüfung des Renderers durchgefallen/)
  assert.match(lies(root, 'docs/content-posts.md'), /Gäste fragen nach dem WLAN\? Ein Code hilft\./)
  assert.deepEqual(queueVon(root), [])
  assert.deepEqual(ladeHistorie(path.join(root, 'data/reparaturen.json')).map((h) => [h.id, h.ergebnis]).sort(), [['k07', 'neu gerendert'], ['k08', 'repariert']])
})

test('lauf: Claude nicht erreichbar → nichts verändert, claudeAus', async () => {
  const root = baueRoot([eintrag('k08', WLAN_SPRACHE), eintrag('s01', ['CAPTION: leer'])])
  const q0 = lies(root, 'plan/queue.json'), d0 = lies(root, 'docs/content-posts.md')
  const e = await lauf({ root, frage: fakeFrage([new ClaudeAus('nicht angemeldet')]), repoLive: ohneRepoNetz, protokoll: stumm, nur: ['k08'] })
  assert.equal(e.claudeAus, true)
  assert.deepEqual(e.repariert, [])
  assert.equal(lies(root, 'plan/queue.json'), q0)
  assert.equal(lies(root, 'docs/content-posts.md'), d0)
  assert.equal(fs.existsSync(path.join(root, 'data/reparaturen.json')), false, 'ein Fehlschlag wegen Claude zählt nicht als Versuch')
})

test('reparieren.mjs (Kommandozeile): ohne erreichbares Claude Exit-Code 3 und nichts verändert', () => {
  const root = baueRoot([eintrag('k08', WLAN_SPRACHE), eintrag('s01', ['CAPTION: Caption ist komplett leer'])])
  const q0 = lies(root, 'plan/queue.json'), d0 = lies(root, 'docs/content-posts.md')
  const umgebung = { ...process.env, GITHUB_API: 'http://127.0.0.1:9' }
  delete umgebung.CLAUDE_BIN
  // a) keine Claude-CLI auffindbar: sofort Schluss, auch die Regelkorrektur für s01 wird nicht geschrieben
  const a = spawnSync(process.execPath, ['automatik/reparieren.mjs', '--root', root], { cwd: ROOT, encoding: 'utf8', env: { ...umgebung, PATH: '/usr/bin:/bin', HOME: tmpDir() } })
  assert.equal(a.status, 3, a.stdout + a.stderr)
  assert.match(a.stdout, /Claude-CLI nicht gefunden/)
  assert.match(a.stdout, /Claude nicht erreichbar/)
  assert.doesNotMatch(a.stdout + a.stderr, /\n\s+at /, 'kein Stacktrace')
  assert.equal(lies(root, 'plan/queue.json'), q0)
  assert.equal(lies(root, 'docs/content-posts.md'), d0)
  assert.equal(fs.existsSync(path.join(root, 'data/reparaturen.json')), false)
  // b) CLI da, aber nicht lauffähig (abgemeldet, kaputt): der erste Aufruf scheitert, der Versuch zählt nicht
  const b = spawnSync(process.execPath, ['automatik/reparieren.mjs', '--root', root, '--nur', 'k08'], { cwd: ROOT, encoding: 'utf8', env: { ...umgebung, CLAUDE_BIN: path.join(tmpDir(), 'gibt-es-nicht') } })
  assert.equal(b.status, 3, b.stdout + b.stderr)
  assert.match(b.stdout, /Claude nicht erreichbar/)
  assert.equal(lies(root, 'plan/queue.json'), q0)
  assert.equal(lies(root, 'docs/content-posts.md'), d0)
  assert.equal(fs.existsSync(path.join(root, 'data/reparaturen.json')), false)
})

test('reparieren.mjs (Kommandozeile): ohne Aufgaben Exit-Code 0', () => {
  const root = baueRoot([{ id: 'k01', typ: 'karussell', status: 'geprueft' }])
  const r = spawnSync(process.execPath, ['automatik/reparieren.mjs', '--root', root], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, CLAUDE_BIN: path.join(tmpDir(), 'gibt-es-nicht') } })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /Keine reparierbaren Ablehnungen/)
})

// ---- Stories haben keine Caption (Prüfregel) --------------------------------------------------------------------------

test('Prüfregeln: Stories haben keine Caption, Link in der Bio nur in Werkzeug-Stories', () => {
  const regeln = fs.readFileSync(path.join(ROOT, 'automatik/qa/regeln.md'), 'utf8')
  assert.match(regeln, /\*\*Stories haben keine Caption\*\*/)
  assert.match(regeln, /Bei einer Story ist der Punkt CAPTION immer `ok`/)
  assert.match(regeln, /\*\*Stories\*\* haben kein Angebotsfeld/)
  assert.equal(entfaellt({ typ: 'story' }, 'CAPTION'), true)
  assert.equal(entfaellt({ typ: 'story' }, 'caption'), true)
  assert.equal(entfaellt({ typ: 'story' }, 'MEHRWERT'), false)
  assert.equal(entfaellt({ typ: 'karussell' }, 'CAPTION'), false)
})

test('Prüf-Prompt: Story ohne Caption-Block und ohne Angebotsfeld, Karussell mit Caption', () => {
  const regeln = ladeRegeln()
  const seiten = [{ name: 'seite-01.jpg', rolle: 'Seite 1' }]
  const s = bauePrompt({ typ: 'story', angebot: 'keins', saeule: 'werkzeuge', titel: 'T', caption: '', hashtags: [] }, regeln, seiten, { mehrwert: 'Du kannst etwas.' })
  assert.doesNotMatch(s, /Caption:\n"""/)
  assert.match(s, /Stories haben keine Bildunterschrift/)
  assert.match(s, /Punkt CAPTION deshalb immer mit „ok“/)
  assert.match(s, /Angebot: entfällt bei Stories/)
  assert.doesNotMatch(s, /Angebot \(angebot\)/)
  const k = bauePrompt({ typ: 'karussell', angebot: 'keins', saeule: 'tipps', titel: 'T', caption: 'Hallo Welt?', hashtags: ['#a'] }, regeln, seiten, { mehrwert: 'Du kannst etwas.' })
  assert.match(k, /Caption:\n"""\nHallo Welt\?\n"""/)
  assert.match(k, /Angebot \(angebot\): keins/)
})

/** Falsches Claude, das alle Prüfpunkte mit „ok“ bewertet, außer dem in FAKE_BAD (und den Prompt festhält). */
function fakeCli() {
  const dir = tmpDir()
  const bin = path.join(dir, 'claude')
  fs.writeFileSync(bin, `#!${process.execPath}
const fs = require('fs'); let inp = ''
process.stdin.on('data', (d) => (inp += d))
process.stdin.on('end', () => {
  if (process.env.FAKE_PROMPT_OUT) fs.writeFileSync(process.env.FAKE_PROMPT_OUT, inp)
  const bad = process.env.FAKE_BAD || ''
  const o = { gesichtspruefung: [], pruefpunkte: JSON.parse(process.env.FAKE_IDS).map((id) => ({ id, status: id === bad ? 'fehler' : 'ok', befund: id === bad ? 'Caption ist komplett leer' : 'ok' })), hinweise: [], verdikt: bad ? 'abgelehnt' : 'ok' }
  console.log(JSON.stringify({ type: 'result', is_error: false, result: JSON.stringify(o) }))
})
`)
  fs.chmodSync(bin, 0o755)
  return { bin, dir }
}

test('pruefe(): leere Caption bei einer Story ist kein Grund, bei einem Karussell schon', async () => {
  const f = fakeCli()
  const bilder = tmpDir()
  const jpg = async (name, w, h) => { await sharp({ create: { width: w, height: h, channels: 3, background: '#ff5b14' } }).jpeg().toFile(path.join(bilder, name)) }
  await jpg('s.jpg', 1080, 1920); await jpg('k1.jpg', 1080, 1350); await jpg('k2.jpg', 1080, 1350)
  const alt = { ...process.env }
  Object.assign(process.env, { CLAUDE_BIN: f.bin, FAKE_IDS: JSON.stringify(ladeRegeln().ids), FAKE_BAD: 'CAPTION', FAKE_PROMPT_OUT: path.join(f.dir, 'prompt.txt') })
  try {
    const story = { id: 's99', typ: 'story', titel: 'T', saeule: 'werkzeuge', angebot: 'keins', caption: '', hashtags: [], hook: 'Hallo du', mehrwert: 'Du kannst etwas Konkretes tun.', dateien: ['s.jpg'] }
    const rs = await pruefe(story, bilder)
    assert.equal(rs.verdikt, 'ok', rs.gruende.join(' | '))
    assert.doesNotMatch(fs.readFileSync(path.join(f.dir, 'prompt.txt'), 'utf8'), /Caption:\n"""/)
    const kar = { id: 'k99', typ: 'karussell', titel: 'T', saeule: 'tipps', angebot: 'keins', caption: 'Ein Satz zum Beitrag. Was meinst du?', hashtags: ['#a'], hook: 'Hallo du', mehrwert: 'Du kannst etwas Konkretes tun.', dateien: ['k1.jpg', 'k2.jpg'] }
    const rk = await pruefe(kar, bilder)
    assert.equal(rk.verdikt, 'abgelehnt')
    assert.ok(rk.gruende.some((g) => g.startsWith('CAPTION:')))
  } finally {
    for (const k of ['CLAUDE_BIN', 'FAKE_IDS', 'FAKE_BAD', 'FAKE_PROMPT_OUT']) { if (alt[k] === undefined) delete process.env[k]; else process.env[k] = alt[k] }
  }
})

test('Stories: produce.mjs legt keine Caption an, publish.mjs gibt der Story keine mit (Verhalten konsistent mit der Prüfregel)', () => {
  const produce = fs.readFileSync(path.join(ROOT, 'automatik/produce.mjs'), 'utf8')
  assert.match(produce, /typ === 'story' \? \{ caption: '', hashtags: \[\], angebot: 'keins' \}/)
  const publish = fs.readFileSync(path.join(ROOT, 'automatik/publish.mjs'), 'utf8')
  assert.match(publish, /veroeffentlicheStory\(\{ datei: dateien\[0\] \}, opts\)/)
  assert.doesNotMatch(publish, /veroeffentlicheStory\(\{[^}]*caption/)
})
