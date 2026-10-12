// Prüft den Inhaltsvorrat (docs/content-posts.md, docs/content-reels.md, docs/content-stories-auto.md) gegen Parser,
// Formregeln, Merkmale und Fakten, dazu den Abbruch von produce.mjs ohne Renderer. Ohne Netz, ohne Claude.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { readPosts, readReels, readStories } from '../../render/inhalt.mjs'
import { pruefeKarussell } from '../pruefe-block.mjs'
import { pruefeText, beitragsText, ladeFakten, bekanntePfade } from '../fakten.mjs'
import { WERTE } from '../optimierer.mjs'
import { aehnlichkeit } from '../story-regeln.mjs'
import { ergaenze, pruefeZusatz } from '../block-felder.mjs'
import { repoAdressen, STERNE_FORMAT } from '../repo-check.mjs'

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname)
const fakten = ladeFakten()
const md = (d) => fs.readFileSync(path.join(ROOT, 'docs', d), 'utf8')
const posts = () => ergaenze(readPosts(), md('content-posts.md'), 'Karussell')
const reels = () => ergaenze(readReels(), md('content-reels.md'), 'Reel')

test('16 Karussells, je 4 pro Säule, alle bestehen Struktur-, Merkmal-, Fakten- und Zusatzfeld-Prüfung', () => {
  const posts = ergaenze(readPosts(), md('content-posts.md'), 'Karussell')
  assert.equal(posts.length, 16)
  for (const s of WERTE.saeule) assert.equal(posts.filter((p) => p.saeule === s).length, 4, `Säule ${s}`)
  for (const p of posts) assert.deepEqual([...pruefeKarussell(p), ...pruefeZusatz(p)], [], `Karussell ${p.nr} ${p.titel}`)
  for (const f of ['nacht', 'tag']) assert.ok(posts.some((p) => p.familie === f), `Familie ${f}`)
  const werkzeugPfade = new Set(fakten.werkzeuge.map((w) => w.pfad))
  for (const p of posts.filter((x) => x.saeule === 'werkzeuge')) assert.ok(werkzeugPfade.has(p.werkzeug), `Karussell ${p.nr}: ${p.werkzeug}`)
  assert.equal(new Set(posts.map((p) => p.nr)).size, 16)
})

test('Fundstücke: Repo, Lizenz und Sterne in Metazeilen und Caption, kein Angebot, Fundort auf Seite 6, Repos nie doppelt', () => {
  const fund = posts().filter((p) => p.saeule === 'fundstuecke')
  assert.equal(fund.length, 4)
  for (const p of fund) {
    assert.match(p.sterne, STERNE_FORMAT, `Karussell ${p.nr}`)
    assert.deepEqual(repoAdressen(p.caption), [p.repo], `Karussell ${p.nr}: Adresse in der Caption`)
    assert.ok(p.caption.includes(`Lizenz: ${p.lizenz}`), `Karussell ${p.nr}: Lizenz in der Caption`)
    assert.ok(p.caption.includes(p.sterne.replace(/^rund (\S+) \((Stand [^)]+)\)$/, 'rund $1 Sterne auf GitHub ($2)')), `Karussell ${p.nr}: Sterne mit Stand in der Caption`)
    assert.equal(p.angebot, 'keins')
    assert.ok(p.pages[5].text.includes(p.repo), `Karussell ${p.nr}: Fundort auf Seite 6`)
  }
  assert.equal(new Set(fund.map((p) => p.repo.toLowerCase())).size, 4)
})

test('Mehrwert: kein Mehrwert-Satz doppelt (jeder Beitrag hat seinen eigenen Nutzen)', () => {
  const alle = [...posts(), ...reels(), ...ergaenze(readStories(), md('content-stories-auto.md'), 'Story')]
  const saetze = alle.map((x) => x.mehrwert)
  assert.equal(new Set(saetze).size, saetze.length)
})

test('Hooks im Vorrat wiederholen sich nicht', () => {
  const hooks = readPosts().map((p) => `${p.pages[0].head} ${p.pages[0].sub}`)
  for (let i = 0; i < hooks.length; i++) for (let j = i + 1; j < hooks.length; j++) assert.ok(aehnlichkeit(hooks[i], hooks[j]) < 0.5, `${hooks[i]} / ${hooks[j]}`)
})

test('6 Scroll-Reels: URL auf vamela.de, Ablauf 12 bis 30 s, Fakten ok, höchstens 5 Hashtags, Zusatzfelder', () => {
  const reels = ergaenze(readReels(), md('content-reels.md'), 'Reel')
  assert.equal(reels.length, 6)
  const freigegeben = bekanntePfade(fakten)
  for (const r of reels) {
    assert.match(r.url, /^https:\/\/vamela\.de\//, `Reel ${r.nr}`)
    const pfad = new URL(r.url).pathname.replace(/\/+$/, '') || '/'
    assert.ok(freigegeben.has(pfad), `Reel ${r.nr}: ${pfad} nicht freigegeben`)
    assert.ok(r.dauer >= 12 && r.dauer <= 30, `Reel ${r.nr}: ${r.dauer} s`)
    assert.ok(r.ablauf.length >= 3 && r.ablauf.every((a) => a.text), `Reel ${r.nr}: Ablauf`)
    assert.ok(r.hook && r.hook.split(/\s+/).length <= 10, `Reel ${r.nr}: Hook`)
    assert.ok(WERTE.saeule.includes(r.saeule) && WERTE.hook_stil.includes(r.hook_stil), `Reel ${r.nr}: Merkmale`)
    assert.deepEqual(pruefeText(beitragsText(r)), [], `Reel ${r.nr}`)
    const tags = r.hashtags.split(/\s+/).filter((x) => x.startsWith('#'))
    assert.ok(tags.length >= 1 && tags.length <= 5, `Reel ${r.nr}: ${tags.length} Hashtags`)
    assert.equal(/Link in der Bio/i.test(r.caption), r.angebot !== 'keins', `Reel ${r.nr}: Link in der Bio passt nicht zum Angebot`)
    assert.deepEqual(pruefeZusatz(r), [], `Reel ${r.nr}: Mehrwert, Motiv, Familie`)
    assert.notEqual(r.saeule, 'fundstuecke', `Reel ${r.nr}: Fundstücke nur als Karussell`)
  }
})

test('mindestens 6 Stories im Vorrat (vorrat.mjs schreibt nach), alle Interaktionen vertreten', () => {
  const s = readStories()
  assert.ok(s.length >= 6, `${s.length} Stories`)
  for (const i of ['Umfrage', 'Fragebox', 'Quiz', 'Schieberegler']) assert.ok(s.some((x) => x.interaktion === i), i)
})

test('produce.mjs ohne Renderer (heute nur Reels): klare Meldung, Exit 4, Queue unverändert', () => {
  const qPfad = path.join(ROOT, 'plan/queue.json')
  const vorher = fs.readFileSync(qPfad, 'utf8')
  for (const typ of ['karussell', 'story', 'reel']) {
    if (fs.existsSync(path.join(ROOT, 'render', { karussell: 'karussell.mjs', story: 'story.mjs', reel: 'reel.mjs' }[typ]))) continue
    const r = spawnSync(process.execPath, [path.join(ROOT, 'automatik/produce.mjs'), '--typ', typ], { cwd: ROOT, encoding: 'utf8' })
    assert.equal(r.status, 4, r.stdout + r.stderr)
    assert.match(r.stdout, /Kein Renderer für \w+: render\/\w+\.mjs/)
  }
  assert.equal(fs.readFileSync(qPfad, 'utf8'), vorher)
})
