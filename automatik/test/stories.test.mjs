// Tests für das automatische Nachschreiben der Stories, ganz ohne Claude:
// Parser (readStories/alleStories), Plan, harte Formregeln und der ganze Ablauf von neu-schreiben.mjs --typ story
// mit einem falschen "claude" (CLAUDE_BIN), dazu vorrat.mjs ohne erreichbares Claude.
// Aufruf: node --test automatik/test/stories.test.mjs
// Schreibt nur in temporäre Ordner; plan/, out/ und data/ werden nur gelesen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { readStories, alleStories, STORIES_BASIS } from '../../render/inhalt.mjs'
import { ladeQueue } from '../queue.mjs'
import {
  planeStories, naechsteStoryNr, pruefeStories, storyProbleme, textProbleme, hintergrundProbleme, beispielBlock, baueStoryPrompt,
  aehnlichkeit, SCHLUSSSATZ, INTERAKTIONEN, STORY_SAEULEN,
} from '../story-regeln.mjs'
import { ergaenze, pruefeZusatz } from '../block-felder.mjs'
import { WERTE } from '../optimierer.mjs'

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname)
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'story-test-'))

// --- Beispielblöcke im Format von docs/content-stories-auto.md --------------------------------------------------------

const block = ({ nr, titel, interaktion, saeule, hook, text, hg = 'Farbfläche nach Gestaltung', aufl = null, textHg, sticker }) => `## Story ${nr}: ${titel}
- Interaktion: ${interaktion}
- Säule: ${saeule}
- Hook-Stil: ${hook}
- Ziel: Ein Satz, der beschreibt, was die Story bewirkt.
- Text auf dem Hintergrund: „${textHg ?? text}“
- Sticker (von Hand in der App, freiwillig): ${sticker ?? `${interaktion}. Frage: „Was meinst du?“`}
${aufl ? `- Auflösung (zweite Story, einige Stunden später, in beiden Fassungen gleich): „${aufl}“\n` : ''}- Hintergrund: ${hg}
- Automatik-Fassung (ohne Sticker): „${text}“`

const SCHIEBER = block({
  nr: 16, titel: 'Wie oft testest du dein Formular', interaktion: 'Schieberegler', saeule: 'tipps', hook: 'frage',
  text: `Wie oft schickst du dir selbst eine Anfrage über dein Kontaktformular, nie oder jeden Monat? Ein stiller Fehler fällt sonst niemandem auf. ${SCHLUSSSATZ}`,
  textHg: 'Wie oft testest du dein Kontaktformular? Unter dem Reglerbereich links „nie“, rechts „jeden Monat“.',
  sticker: 'Schieberegler. Frage: „Wie oft testest du dein Formular?“ Emoji des Reglers: 👍',
})
const QUIZ = block({
  nr: 17, titel: 'Welche Datei will die Druckerei', interaktion: 'Quiz', saeule: 'design', hook: 'mythos',
  text: `Was glaubst du: Welche Logo-Datei will die Druckerei für deine Visitenkarte, ein JPG vom Handy, ein PNG oder ein PDF mit Vektorpfaden? ${SCHLUSSSATZ}`,
  aufl: 'Meine Sicht: Für den Druck gehört das Logo als PDF mit Vektorpfaden in die Datei. Ein JPG vom Handy wird beim Vergrößern unscharf. Frag deine Druckerei, welches Format sie will.',
  sticker: 'Quiz. Frage: „Welche Datei will die Druckerei?“ Antworten: „JPG“ / „PNG“ / „PDF mit Vektorpfaden“. Als richtig markieren: „PDF mit Vektorpfaden“.',
})

const mitKopf = (...bloecke) => `# Stories für @vamela.de\n\nVorrat.\n\n# Stories\n\n${bloecke.join('\n\n---\n\n')}\n\n---\n\n`

// --- Parser -----------------------------------------------------------------------------------------------------------

test('readStories liest Säule, Hook-Stil, Schieberegler und Quiz mit Auflösung', () => {
  const f = path.join(tmpDir(), 'stories.md')
  fs.writeFileSync(f, mitKopf(SCHIEBER, QUIZ))
  const s = readStories(f)
  assert.equal(s.length, 2)
  assert.equal(s[0].nr, 16)
  assert.equal(s[0].id, 's16')
  assert.equal(s[0].interaktion, 'Schieberegler')
  assert.equal(s[0].saeule, 'tipps')
  assert.equal(s[0].hook_stil, 'frage')
  assert.ok(s[0].text.endsWith(SCHLUSSSATZ))
  assert.equal(s[0].aufloesung, null)
  assert.match(s[0].sticker, /^Schieberegler\./)
  assert.equal(s[1].interaktion, 'Quiz')
  assert.match(s[1].aufloesung, /^Meine Sicht:/)
  assert.equal(s[1].hintergrund, 'Farbfläche nach Gestaltung')
})

test('readStories: Datei ohne Abschnitt "# Stories" ist leer, Block ohne Automatik-Fassung wirft', () => {
  const d = tmpDir()
  fs.writeFileSync(path.join(d, 'leer.md'), '# Automatisch geschriebene Stories\n\nNoch nichts.\n')
  assert.deepEqual(readStories(path.join(d, 'leer.md')), [])
  fs.writeFileSync(path.join(d, 'kaputt.md'), '# Stories\n\n## Story 3: Ohne Text\n- Interaktion: Quiz\n')
  assert.throws(() => readStories(path.join(d, 'kaputt.md')), /keine Automatik-Fassung/)
})

test('alleStories: Basis und zweite Datei zusammen, Nummern nie doppelt, kaputte zweite Datei wird übersprungen', () => {
  const d = tmpDir()
  const basis = path.join(d, 'basis.md'), auto = path.join(d, 'auto.md')
  fs.writeFileSync(basis, mitKopf(SCHIEBER.replace('Story 16', 'Story 1')))
  assert.deepEqual(alleStories({ basis, auto }).map((s) => [s.nr, s.datei]), [[1, 'docs/basis.md']])
  fs.writeFileSync(auto, mitKopf(SCHIEBER.replace('Story 16', 'Story 1'), QUIZ))
  const warnungen = []
  const alt = console.warn
  console.warn = (m) => warnungen.push(m)
  try {
    assert.deepEqual(alleStories({ basis, auto }).map((s) => [s.nr, s.datei]), [[1, 'docs/basis.md'], [17, 'docs/auto.md']])
    assert.equal(warnungen.length, 1)
    fs.writeFileSync(auto, '# Stories\n\n## Story 20: Kaputt\n- Interaktion: Quiz\n')
    assert.deepEqual(alleStories({ basis, auto }).map((s) => s.nr), [1])
    assert.equal(warnungen.length, 2)
  } finally { console.warn = alt }
})

test('die echten Stories aus docs/content-stories-auto.md werden gelesen und bestehen die Formregeln', () => {
  const s = ergaenze(readStories(STORIES_BASIS), fs.readFileSync(STORIES_BASIS, 'utf8'), 'Story')
  assert.ok(s.length >= 6)
  for (const x of s) {
    assert.ok(x.text, `Story ${x.nr} ohne Text`)
    assert.ok(WERTE.saeule.includes(x.saeule), `Story ${x.nr}: Säule ${x.saeule}`)
    assert.ok(WERTE.hook_stil.includes(x.hook_stil), `Story ${x.nr}: Hook-Stil ${x.hook_stil}`)
    const p = storyProbleme(x, { interaktion: x.interaktion, saeule: x.saeule, hook_stil: x.hook_stil })
    assert.deepEqual(p, [], `Story ${x.nr}: ${p}`)
    assert.deepEqual(pruefeZusatz(x), [], `Story ${x.nr}: Mehrwert, Motiv, Familie`)
    assert.notEqual(x.saeule, 'fundstuecke', `Story ${x.nr}: Fundstücke nur als Karussell`)
  }
})

// --- Plan -------------------------------------------------------------------------------------------------------------

const vorh = (n, letzte = { interaktion: 'Schieberegler', saeule: 'tipps', hook_stil: 'frage' }) => Array.from({ length: n }, (_, i) => ({ nr: i + 1, ...(i === n - 1 ? letzte : { interaktion: 'Umfrage', saeule: 'design', hook_stil: 'liste' }) }))

test('naechsteStoryNr: höher als Dateien und Queue-IDs', () => {
  assert.equal(naechsteStoryNr([], []), 1)
  assert.equal(naechsteStoryNr(vorh(15)), 16)
  assert.equal(naechsteStoryNr(vorh(15), ['k03', 's09', 's18', 'r05']), 19)
})

test('planeStories: fortlaufend, Interaktion weiter nach der letzten, Säule und Hook-Stil nie doppelt hintereinander', () => {
  const plan = planeStories(vorh(15), 4, ['s01', 's15'])
  assert.deepEqual(plan.map((p) => p.nr), [16, 17, 18, 19])
  assert.deepEqual(plan.map((p) => p.interaktion), ['Umfrage', 'Fragebox', 'Quiz', 'Schieberegler'])
  assert.notEqual(plan[0].saeule, 'tipps')
  assert.notEqual(plan[0].hook_stil, 'frage')
  const viele = planeStories(vorh(15), 30)
  for (const [i, p] of viele.entries()) {
    assert.ok(WERTE.saeule.includes(p.saeule))
    if (i) assert.notEqual(p.hook_stil, viele[i - 1].hook_stil)
  }
  for (const s of STORY_SAEULEN) assert.ok(viele.filter((p) => p.saeule === s).length >= 30 * 0.1, `Säule ${s} zu selten`)
  assert.ok(viele.every((p) => p.saeule !== 'fundstuecke'), 'Stories ohne fundstuecke')
  assert.deepEqual(planeStories([], 2).map((p) => [p.nr, p.interaktion]), [[1, 'Umfrage'], [2, 'Fragebox']])
  assert.deepEqual(planeStories(vorh(3), 5, [], { seed: 'x' }), planeStories(vorh(3), 5, [], { seed: 'x' }))
})

// --- Formregeln -------------------------------------------------------------------------------------------------------

const parse = (...bloecke) => {
  const f = path.join(tmpDir(), 'x.md')
  fs.writeFileSync(f, '# Stories\n\n' + bloecke.join('\n\n---\n\n'))
  return readStories(f)
}
const PLAN = [{ nr: 16, interaktion: 'Schieberegler', saeule: 'tipps', hook_stil: 'frage' }, { nr: 17, interaktion: 'Quiz', saeule: 'design', hook_stil: 'mythos' }]

test('pruefeStories: gültige Blöcke bestehen', () => {
  assert.equal(pruefeStories(parse(SCHIEBER, QUIZ), PLAN, { titel: ['Anderes Thema'], texte: ['Ein ganz anderer Text über Kaffee und Regen am Morgen.'] }), null)
})

test('pruefeStories: jede harte Regel schlägt an', () => {
  const schlecht = (ersatz, plan = PLAN) => pruefeStories(parse(...ersatz), plan, {})
  const s16 = (t) => SCHIEBER.replace(/Automatik-Fassung \(ohne Sticker\): „[^\n]*“/, `Automatik-Fassung (ohne Sticker): „${t}“`)
  const ok = `Wie oft schickst du dir selbst eine Anfrage über dein Kontaktformular, nie oder jeden Monat? Ein stiller Fehler fällt sonst niemandem auf. ${SCHLUSSSATZ}`
  const faelle = [
    [[SCHIEBER], /1 statt 2 lesbare/],
    [[s16(ok.replace(SCHLUSSSATZ, 'Sag mir Bescheid.')), QUIZ], /muss mit „Schreib mir ein Wort als Nachricht\.“ enden/],
    [[s16(ok.replace('jeden Monat', 'für 29 € im Monat')), QUIZ], /Preis/],
    [[s16(ok.replace('Ein stiller Fehler', 'Studien zeigen, ein stiller Fehler')), QUIZ], /Studie/],
    [[s16(ok.replace('Ein stiller Fehler', '80 % der Formulare: ein stiller Fehler')), QUIZ], /Studie oder Statistik/],
    [[s16(ok.replace('Ein stiller Fehler', 'Ein stiller Fehler 😱')), QUIZ], /Emoji/],
    [[s16(ok.replace('Ein stiller Fehler fällt sonst niemandem auf.', 'Dann stehst du garantiert auf Platz 1 bei Google.')), QUIZ], /Erfolgsversprechen/],
    [[s16(ok.replace('Ein stiller Fehler', 'Jetzt zuschlagen!! Ein stiller Fehler')), QUIZ], /Marktschreier/],
    [[s16(ok.replace('Ein stiller Fehler fällt sonst niemandem auf.', '„Seitdem kommen Anfragen“ – Thomas.')), QUIZ], /Kundenstimme/],
    [[s16(ok.replace('Ein stiller Fehler fällt sonst niemandem auf.', 'Und prüf gleich dein Impressum auf Fehler.')), QUIZ], /Rechtsthema/],
    [[s16(ok.replace('Ein stiller Fehler', 'Alles Weitere: Link in der Bio. Ein stiller Fehler')), QUIZ], /nur in Werkzeug-Stories/],
    [[s16('Wie oft testet man das Formular? Ein stiller Fehler fällt sonst niemandem auf. ' + SCHLUSSSATZ), QUIZ], /Du-Form/],
    [[s16('Kurz. ' + SCHLUSSSATZ), QUIZ], /Zeichen, erlaubt sind/],
    [[SCHIEBER.replace('Interaktion: Schieberegler', 'Interaktion: Umfrage'), QUIZ], /Interaktion ist „Umfrage“/],
    [[SCHIEBER.replace('Säule: tipps', 'Säule: design'), QUIZ], /Säule ist „design“/],
    [[SCHIEBER.replace('Hook-Stil: frage', 'Hook-Stil: liste'), QUIZ], /Hook-Stil ist „liste“/],
    [[SCHIEBER.replace('Hintergrund: Farbfläche nach Gestaltung', 'Hintergrund: Foto einer Werkstatt'), QUIZ], /Hintergrund: nur/],
    [[SCHIEBER.replace('Hintergrund: Farbfläche nach Gestaltung', 'Hintergrund: Farbfläche mit Logo von Coca-Cola'), QUIZ], /fremden Marken/],
    [[SCHIEBER.replace(/^- Sticker.*$/m, '- Sticker (von Hand in der App, freiwillig): Quiz. Frage: „x“'), QUIZ], /Sticker/],
    [[SCHIEBER, QUIZ.replace(/^- Auflösung.*\n/m, '')], /Quiz braucht die Zeile/],
    [[SCHIEBER, QUIZ.replace('„Meine Sicht:', '„Ich denke:')], /Meine Sicht/],
    [[SCHIEBER.replace('- Hintergrund', '- Auflösung (zweite Story, einige Stunden später): „Meine Sicht: doch.“\n- Hintergrund'), QUIZ], /nur Quiz-Stories/],
    [[SCHIEBER, QUIZ.replace('Story 17', 'Story 16')], /doppelt|unerwartete/],
    [[SCHIEBER, QUIZ.replace('Story 17', 'Story 30')], /unerwartete Nummer 30/],
  ]
  for (const [bloecke, muster] of faelle) assert.match(schlecht(bloecke) ?? 'null', muster)
})

test('Rechtsthema mit Verweis auf Anwalt ist erlaubt, Link in der Bio in Werkzeug-Stories auch', () => {
  assert.deepEqual(textProbleme({ text: `Dein Impressum klärst du mit deiner Anwältin, nicht mit mir. ${SCHLUSSSATZ}`, saeule: 'tipps' }), [])
  assert.deepEqual(textProbleme({ text: `Den QR-Code baust du dir selbst, Link in der Bio. ${SCHLUSSSATZ}`, saeule: 'werkzeuge' }), [])
})

test('pruefeStories: Titel und Text dürfen nicht wiederholt werden', () => {
  const s = parse(SCHIEBER, QUIZ)
  assert.match(pruefeStories(s, PLAN, { titel: ['Wie OFT testest du dein Formular!'] }), /Titel „Wie oft testest du dein Formular“ gibt es schon/)
  assert.match(pruefeStories(s, PLAN, { texte: [s[0].text.replace('jeden Monat', 'jede Woche')] }), /ähnelt einer vorhandenen Story/)
  assert.ok(aehnlichkeit(s[0].text, s[1].text) < 0.5)
})

test('hintergrundProbleme', () => {
  for (const ok of ['Farbfläche nach Gestaltung', 'Bildschirmfoto von vamela.de', 'Eigene Zeichnung (Schrift, Farbe oder Layout)']) assert.deepEqual(hintergrundProbleme(ok), [])
  assert.ok(hintergrundProbleme('').length)
  assert.ok(hintergrundProbleme('Stockfoto Büro').length)
  assert.ok(hintergrundProbleme('Bildschirmfoto von vamela.de neben Screenshot von wix.com').length)
})

test('Prompt: Nummern, Merkmale, Formregeln, Beispiele, Gewinner-Muster, Korrekturhinweis', () => {
  const md = fs.readFileSync(STORIES_BASIS, 'utf8')
  const beispiele = INTERAKTIONEN.map((i) => beispielBlock(md, i))
  for (const [i, b] of beispiele.entries()) {
    assert.ok(b && b.startsWith('## Story '), `Beispielblock ${INTERAKTIONEN[i]} fehlt`)
    assert.match(b, new RegExp(`^- Interaktion: ${INTERAKTIONEN[i]}$`, 'm'))
    assert.match(b, /^- Automatik-Fassung \(ohne Sticker\): „/m)
    assert.doesNotMatch(b, /\n---/)
  }
  assert.match(beispiele[2], /^- Auflösung \(zweite Story/m)
  const p = baueStoryPrompt({ regeln: 'REGELN', strategie: 'STRATEGIE', learnings: 'LERNEN', themen: ['A', 'B'], plan: PLAN, beispiele, fehler: 'Story 16: Preis', gewinner: 'GEWINNER-MUSTER: x' })
  assert.match(p, /Story 16 \(Interaktion: Schieberegler, Säule: tipps, Hook-Stil: frage\); Story 17 \(Interaktion: Quiz, Säule: design, Hook-Stil: mythos\)/)
  assert.match(p, /DEIN LETZTER VERSUCH WURDE ABGELEHNT WEGEN: Story 16: Preis/)
  assert.match(p, /GEWINNER-MUSTER: x/)
  assert.match(p, /@vamela\.de/)
  assert.match(p, /BEREITS VERWENDETE THEMEN\/TITEL\/HOOKS[^\n]*: A \| B/)
  assert.doesNotMatch(baueStoryPrompt({ plan: PLAN, beispiele }), /ABGELEHNT/)
})

// --- neu-schreiben.mjs --typ story mit falschem claude -----------------------------------------------------------------

// Der falsche "claude" liest den Prompt, holt die Merkmale aus "Story N (Interaktion: X, Säule: S, Hook-Stil: H)" und schreibt
// passende, frische Blöcke (jede Story mit eigenen Wörtern, damit die Ähnlichkeitsprüfung nicht anschlägt).
const FAKE = `#!/usr/bin/env node
import fs from 'node:fs'
const dir = process.env.FAKE_DIR
const prompt = fs.readFileSync(0, 'utf8')
const n = fs.readdirSync(dir).filter((f) => f.startsWith('prompt-')).length + 1
fs.writeFileSync(dir + '/prompt-' + n + '.txt', prompt)
if (process.env.FAKE_MODE === 'nicht-angemeldet') { console.log(JSON.stringify({ is_error: true, result: 'Not logged in' })); process.exit(1) }
const S = ${JSON.stringify(SCHLUSSSATZ)}
const buchst = (x) => String(x).replace(/\\d/g, (d) => 'abcdefghij'[d])
const wort = (nr, k) => 'Wolke' + buchst(nr * 10 + k)
const plan = [...prompt.matchAll(/Story (\\d+) \\(Interaktion: (\\w+), Säule: (\\w+), Hook-Stil: ([\\w-]+)\\)/g)].map((m) => ({ nr: +m[1], i: m[2], s: m[3], h: m[4] }))
const bloecke = plan.map(({ nr, i, s, h }) => {
  const [a, b, c, d, e, f, g, hh, x, y] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((z) => wort(nr, z))
  const text = 'Nutzt du für deinen Betrieb ' + a + ', ' + b + ', ' + c + ', ' + d + ' oder ' + e + '? Beides kann passen. ' + S
  const aufl = i === 'Quiz' ? '- Auflösung (zweite Story, einige Stunden später, in beiden Fassungen gleich): „Meine Sicht: ' + [f, g, hh, x, y, a, b].join(', ') + ' sind für deinen Betrieb ein guter Anfang.“\\n' : ''
  const sticker = i + '. Frage: „Was nutzt du?“' + (i === 'Schieberegler' ? ' Emoji des Reglers: 👍' : '')
  const zusatz = process.env.FAKE_MODE === 'ohne-mehrwert' ? '' : '\\n- Mehrwert: Du weißt, ob ' + a + ' oder ' + b + ' für deinen Betrieb besser passt.\\n- Motiv: a small paper boat floating on a calm orange lake at dawn\\n- Familie: tag'
  return '## Story ' + nr + ': Testthema ' + buchst(nr) + '\\n- Interaktion: ' + i + '\\n- Säule: ' + s + '\\n- Hook-Stil: ' + h + '\\n- Ziel: Ein Satz, der beschreibt, was die Story bewirkt.\\n- Text auf dem Hintergrund: „Nutzt du ' + a + ' oder ' + b + '?“\\n- Sticker (von Hand in der App, freiwillig): ' + sticker + '\\n' + aufl + '- Hintergrund: Farbfläche nach Gestaltung\\n- Automatik-Fassung (ohne Sticker): „' + text + '“' + zusatz
})
const antwort = process.env.FAKE_MODE === 'erst-falsch' && n === 1 ? bloecke.slice(0, 1) : bloecke
console.log(JSON.stringify({ is_error: false, result: antwort.join('\\n\\n---\\n\\n') }))
`

function fakeClaude(modus = '') {
  const dir = tmpDir()
  const bin = path.join(dir, 'claude')
  fs.writeFileSync(bin, FAKE, { mode: 0o755 })
  const state = path.join(dir, 'state')
  fs.mkdirSync(state)
  return { bin, state, env: { CLAUDE_BIN: bin, FAKE_DIR: state, FAKE_MODE: modus } }
}
const laufe = (skript, argv, env) => spawnSync(process.execPath, [path.join(ROOT, skript), ...argv], { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 120_000 })

test('neu-schreiben --typ story: schreibt Datei, die readStories liest; zweiter Lauf hängt an und zählt weiter', async () => {
  const f = fakeClaude()
  const auto = path.join(tmpDir(), 'stories-auto.md')
  const queueIds = (await ladeQueue()).map((x) => x.id)
  const basis = readStories(STORIES_BASIS)

  const erste = naechsteStoryNr(basis, queueIds)
  const r1 = laufe('automatik/neu-schreiben.mjs', ['--typ', 'story', '--anzahl', '4', '--auto', auto], f.env)
  assert.equal(r1.status, 0, r1.stdout + r1.stderr)
  assert.match(r1.stdout, /Versuch 1: ok/)
  assert.match(r1.stdout, /4 neue Story-Beiträge/)
  const s1 = readStories(auto)
  assert.deepEqual(s1.map((s) => s.nr), [erste, erste + 1, erste + 2, erste + 3])
  assert.equal(s1.length, 4)
  assert.ok(s1.every((s) => WERTE.saeule.includes(s.saeule) && WERTE.hook_stil.includes(s.hook_stil)))
  const roh = fs.readFileSync(auto, 'utf8')
  assert.match(roh, /^# Automatisch geschriebene Stories/)
  assert.equal(roh.match(/^# Stories$/gm).length, 1)
  // der Prompt enthielt Regeln und Plan
  const prompt = fs.readFileSync(path.join(f.state, 'prompt-1.txt'), 'utf8')
  assert.match(prompt, new RegExp(`Story ${erste} \\(Interaktion: `))
  assert.match(prompt, /Feste Regeln/)
  assert.match(prompt, /@vamela\.de/)

  const zweite = s1.at(-1).nr + 1
  const r2 = laufe('automatik/neu-schreiben.mjs', ['--typ', 'story', '--anzahl', '2', '--auto', auto], f.env)
  assert.equal(r2.status, 0, r2.stdout + r2.stderr)
  const s2 = readStories(auto)
  assert.deepEqual(s2.map((s) => s.nr), [...s1.map((s) => s.nr), zweite, zweite + 1])
  assert.equal(fs.readFileSync(auto, 'utf8').match(/^# Stories$/gm).length, 1, 'Kopf nur einmal')
  // alle zusammen für den Produzenten lesbar, ohne doppelte Nummern
  const alle = alleStories({ basis: STORIES_BASIS, auto })
  assert.equal(new Set(alle.map((s) => s.nr)).size, alle.length)
})

test('neu-schreiben --typ story: abgelehnter Versuch bekommt den Grund, zweiter Versuch gelingt', () => {
  const f = fakeClaude('erst-falsch')
  const auto = path.join(tmpDir(), 'stories-auto.md')
  const r = laufe('automatik/neu-schreiben.mjs', ['--typ', 'story', '--anzahl', '2', '--auto', auto], f.env)
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /Versuch 1: 1 statt 2 lesbare/)
  assert.match(r.stdout, /Versuch 2: ok/)
  assert.match(fs.readFileSync(path.join(f.state, 'prompt-2.txt'), 'utf8'), /DEIN LETZTER VERSUCH WURDE ABGELEHNT WEGEN: 1 statt 2 lesbare/)
  assert.equal(readStories(auto).length, 2)
})

test('neu-schreiben --typ story ohne Claude: eine Meldung, Exit 2, nichts geschrieben', () => {
  for (const env of [{ CLAUDE_BIN: path.join(tmpDir(), 'gibt-es-nicht') }, fakeClaude('nicht-angemeldet').env]) {
    const auto = path.join(tmpDir(), 'stories-auto.md')
    const r = laufe('automatik/neu-schreiben.mjs', ['--typ', 'story', '--anzahl', '2', '--auto', auto], env)
    assert.equal(r.status, 2, r.stdout + r.stderr)
    assert.match(r.stdout, /Neuschreiben story übersprungen, Claude nicht verfügbar/)
    assert.doesNotMatch(r.stdout + r.stderr, /\n\s+at /, 'kein Stacktrace')
    assert.equal(fs.existsSync(auto), false)
  }
})

test('neu-schreiben --typ story bricht ab, statt auf eine kaputte Datei zu schreiben', () => {
  const f = fakeClaude()
  const auto = path.join(tmpDir(), 'stories-auto.md')
  fs.writeFileSync(auto, '# Stories\n\n## Story 40: Kaputt\n- Interaktion: Quiz\n')
  const r = laufe('automatik/neu-schreiben.mjs', ['--typ', 'story', '--anzahl', '1', '--auto', auto], f.env)
  assert.equal(r.status, 1)
  assert.match(r.stdout, /Vorrat nicht lesbar/)
  assert.equal(fs.readdirSync(f.state).length, 0, 'Claude wurde nicht einmal gefragt')
})

// --- vorrat.mjs ohne Claude ---------------------------------------------------------------------------------------------

test('vorrat.mjs stürzt ohne erreichbares Claude nicht ab und schreibt nichts in docs/', () => {
  const dateien = ['content-posts-auto.md', 'content-reels-auto.md', 'content-stories-auto.md'].map((n) => path.join(ROOT, 'docs', n))
  const stand = () => dateien.map((p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null))
  const vorher = stand()
  const r = laufe('automatik/vorrat.mjs', [], { CLAUDE_BIN: path.join(tmpDir(), 'gibt-es-nicht') })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /Vorrat: \d+ Karussells, \d+ Reels, \d+ Stories unproduziert/)
  assert.doesNotMatch(r.stdout + r.stderr, /\n\s+at /, 'kein Stacktrace')
  assert.doesNotMatch(r.stdout, /fehlgeschlagen/, 'nur die eine Meldung von neu-schreiben.mjs')
  assert.deepEqual(stand(), vorher)
})

test('neu-schreiben --typ story: Blöcke ohne Mehrwert, Motiv und Familie werden abgelehnt', () => {
  const f = fakeClaude('ohne-mehrwert')
  const auto = path.join(tmpDir(), 'stories-auto.md')
  const r = laufe('automatik/neu-schreiben.mjs', ['--typ', 'story', '--anzahl', '1', '--auto', auto], f.env)
  assert.equal(r.status, 1, r.stdout + r.stderr)
  assert.match(r.stdout, /Versuch 1: Story \d+: Zeile „- Mehrwert: …“ fehlt/)
  assert.match(fs.readFileSync(path.join(f.state, 'prompt-2.txt'), 'utf8'), /DEIN LETZTER VERSUCH WURDE ABGELEHNT WEGEN: Story \d+: Zeile „- Mehrwert/)
  assert.equal(fs.existsSync(auto), false)
})

test('Story-Prompt verlangt Mehrwert, Motiv und Familie', () => {
  const p = baueStoryPrompt({ plan: PLAN, beispiele: ['## Story 1: x'] })
  assert.match(p, /- Mehrwert: ein Satz/)
  assert.match(p, /- Motiv: kurze englische Bildbeschreibung/)
  assert.match(p, /- Familie: nacht \| tag/)
})
