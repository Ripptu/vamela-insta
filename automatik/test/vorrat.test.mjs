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

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname)
const fakten = ladeFakten()

test('12 Karussells, je 4 pro Säule, alle bestehen Struktur-, Merkmal- und Faktenprüfung', () => {
  const posts = readPosts()
  assert.equal(posts.length, 12)
  for (const s of WERTE.saeule) assert.equal(posts.filter((p) => p.saeule === s).length, 4, `Säule ${s}`)
  for (const p of posts) assert.deepEqual(pruefeKarussell(p), [], `Karussell ${p.nr} ${p.titel}`)
  const werkzeugPfade = new Set(fakten.werkzeuge.map((w) => w.pfad))
  for (const p of posts.filter((x) => x.saeule === 'werkzeuge')) assert.ok(werkzeugPfade.has(p.werkzeug), `Karussell ${p.nr}: ${p.werkzeug}`)
  assert.equal(new Set(posts.map((p) => p.nr)).size, 12)
})

test('Hooks im Vorrat wiederholen sich nicht', () => {
  const hooks = readPosts().map((p) => `${p.pages[0].head} ${p.pages[0].sub}`)
  for (let i = 0; i < hooks.length; i++) for (let j = i + 1; j < hooks.length; j++) assert.ok(aehnlichkeit(hooks[i], hooks[j]) < 0.5, `${hooks[i]} / ${hooks[j]}`)
})

test('6 Scroll-Reels: URL auf vamela.de, Ablauf 12 bis 30 s, Fakten ok, höchstens 5 Hashtags', () => {
  const reels = readReels()
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
  }
})

test('6 Stories im Vorrat, alle Interaktionen vertreten', () => {
  const s = readStories()
  assert.equal(s.length, 6)
  for (const i of ['Umfrage', 'Fragebox', 'Quiz', 'Schieberegler']) assert.ok(s.some((x) => x.interaktion === i), i)
})

test('produce.mjs ohne Renderer: klare Meldung, Exit 4, Queue unverändert', () => {
  const qPfad = path.join(ROOT, 'plan/queue.json')
  const vorher = fs.readFileSync(qPfad, 'utf8')
  for (const typ of ['karussell', 'story', 'reel']) {
    if (fs.existsSync(path.join(ROOT, 'render', { karussell: 'karussell.mjs', story: 'story.mjs', reel: 'reel.mjs' }[typ]))) continue
    const r = spawnSync(process.execPath, [path.join(ROOT, 'automatik/produce.mjs'), '--typ', typ], { cwd: ROOT, encoding: 'utf8' })
    assert.equal(r.status, 4, r.stdout + r.stderr)
    assert.match(r.stdout, /Kein Renderer für .* konfiguriert/)
  }
  assert.equal(fs.readFileSync(qPfad, 'utf8'), vorher)
})
