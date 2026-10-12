// Tests für automatik/trends.mjs ohne Netz und ohne Claude: Kandidaten aus Such-API und Trending-HTML, Vorfilter,
// Hacker-News-Themen, Prüfung der Claude-Auswahl (nichts Erfundenes) und Zusammenführen mit der alten Datei.
import test from 'node:test'
import assert from 'node:assert/strict'
import { suchen, kandidatenAusSuche, kandidatenAusTrending, vorfilter, hnThemen, pruefeAuswahl, fuehreZusammen, baueTrendsPrompt, EINSTELLUNGEN } from '../trends.mjs'

const JETZT = new Date('2026-10-12T10:00:00Z')
const item = (name, x = {}) => ({ full_name: name, description: `Beschreibung ${name}`, stargazers_count: 1000, language: 'Rust', topics: ['photo'], created_at: '2026-10-01T00:00:00Z', pushed_at: '2026-10-10T00:00:00Z', license: { spdx_id: 'MIT' }, archived: false, fork: false, ...x })

test('suchen: drei Zeiträume (7, 30, 90 Tage), nach Sternen', () => {
  const s = suchen(JETZT)
  assert.deepEqual(s.map((x) => x.q), ['created:>2026-10-05 stars:>50', 'created:>2026-09-12 stars:>200', 'created:>2026-07-14 stars:>1000'])
})

test('kandidatenAusSuche und vorfilter: Lizenz, Pflege, kein Fork, nicht archiviert, nicht benutzt, eindeutig, nach Sternen', () => {
  const k = kandidatenAusSuche({ items: [
    item('a/gut', { stargazers_count: 500 }), item('b/archiv', { archived: true }), item('c/fork', { fork: true }),
    item('d/ohne', { license: { spdx_id: 'NOASSERTION' } }), item('e/alt', { pushed_at: '2025-01-01T00:00:00Z' }), item('f/benutzt'),
    item('g/stark', { stargazers_count: 9000 }), item('A/GUT'),
  ] }, 'Suche', JETZT)
  assert.equal(k[0].lizenz, 'MIT')
  assert.equal(k[0].gefunden_am, '2026-10-12')
  assert.equal(k[3].lizenz, null)
  const v = vorfilter(k, { jetzt: JETZT, benutzt: new Set(['f/benutzt']) })
  assert.deepEqual(v.map((x) => x.slug), ['g/stark', 'a/gut'])
})

test('kandidatenAusTrending: Name, Beschreibung und Sterne aus dem HTML, ungeprüft markiert', () => {
  const html = `<article class="Box-row">
  <h2 class="h3 lh-condensed">
    <a data-x="1" href="/muster/werkzeug" class="Link"><svg></svg> muster / werkzeug</a></h2>
  <p class="col-9 color-fg-muted my-1 tmp-pr-4">Ein <b>freies</b> Werkzeug</p>
  <a href="/muster/werkzeug/stargazers" class="Link"><svg class="octicon"></svg>
        12,345</a></article><article class="Box-row"><p>kaputt</p></article>`
  assert.deepEqual(kandidatenAusTrending(html, JETZT), [{ slug: 'muster/werkzeug', beschreibung: 'Ein freies Werkzeug', sterne: 12345, quelle: 'github.com/trending?since=weekly', gefunden_am: '2026-10-12', ungeprueft: true }])
  assert.equal(vorfilter(kandidatenAusTrending(html, JETZT), { jetzt: JETZT }).length, 1, 'ungeprüfte bleiben bis zur Live-Prüfung')
})

test('hnThemen: Titel, Quelle, Hacker-News-Link, Datum, nach Punkten', () => {
  const t = hnThemen({ hits: [{ objectID: '1', title: 'A', url: 'https://a.example/x', points: 300, created_at: '2026-10-06T13:15:49Z' }, { objectID: '2', title: 'Ask HN: B', points: 900, created_at: '2026-10-07T00:00:00Z' }, { title: 'ohne id' }] })
  assert.deepEqual(t.map((x) => [x.titel, x.url, x.datum]), [['Ask HN: B', 'https://news.ycombinator.com/item?id=2', '2026-10-07'], ['A', 'https://a.example/x', '2026-10-06']])
  assert.equal(t[1].hn, 'https://news.ycombinator.com/item?id=1')
})

test('pruefeAuswahl: nur Repos aus der Liste, nur Themen mit Quelle aus der Liste und gültigem Motiv', () => {
  const kandidaten = vorfilter(kandidatenAusSuche({ items: [item('a/gut'), item('b/auch')] }, 'Suche', JETZT), { jetzt: JETZT })
  const themen = hnThemen({ hits: [{ objectID: '7', title: 'Neues KI-Modell', url: 'https://ki.example/neu', points: 500, created_at: '2026-10-08T00:00:00Z' }] })
  const r = pruefeAuswahl({
    repos: [{ slug: 'A/Gut', warum: 'Fotos schneller bearbeiten.', zielgruppe: 'betriebe' }, { slug: 'x/erfunden' }, { slug: 'a/gut' }],
    themen: [
      { thema: 'Neues KI-Modell', quelle: 'https://news.ycombinator.com/item?id=7', motiv_idee: 'a small glowing robot assembling orange blocks in a dark workshop', familie: 'nacht' },
      { thema: 'Erfunden', quelle: 'https://anders.example', motiv_idee: 'a cat on a roof at night with stars', familie: 'tag' },
      { thema: 'Mit Marke', quelle: 'https://ki.example/neu', motiv_idee: 'Minecraft Steve building a house in the sunset', familie: 'nacht' },
    ],
  }, kandidaten, themen)
  assert.deepEqual(r.repos.map((x) => [x.slug, x.warum, x.lizenz]), [['a/gut', 'Fotos schneller bearbeiten.', 'MIT']])
  assert.deepEqual(r.themen, [{ thema: 'Neues KI-Modell', quelle: 'https://ki.example/neu', hn: 'https://news.ycombinator.com/item?id=7', datum: '2026-10-08', motiv_idee: 'a small glowing robot assembling orange blocks in a dark workshop', familie: 'nacht' }])
  assert.equal(r.verworfen.length, 3)
  assert.ok(r.verworfen.some((v) => /x\/erfunden/.test(v)) && r.verworfen.some((v) => /Minecraft/.test(v)))
  assert.deepEqual(pruefeAuswahl(null, kandidaten, themen), { repos: [], themen: [], verworfen: [] })
})

test('fuehreZusammen: neue zuerst, alte bis 60 Tage, Benutztes fliegt raus, alte Themen nur ohne neue', () => {
  const alt = { repos: [{ slug: 'alt/frisch', gefunden_am: '2026-09-20' }, { slug: 'alt/uralt', gefunden_am: '2026-07-01' }, { slug: 'neu/eins', gefunden_am: '2026-09-01' }, { slug: 'alt/benutzt', gefunden_am: '2026-10-01' }], themen: [{ thema: 'alt' }] }
  const neu = { stand: '2026-10-12', repos: [{ slug: 'neu/eins', gefunden_am: '2026-10-12' }], themen: [] }
  const z = fuehreZusammen(alt, neu, { jetzt: JETZT, benutzt: new Set(['alt/benutzt']) })
  assert.deepEqual(z.repos.map((x) => [x.slug, x.gefunden_am]), [['neu/eins', '2026-10-12'], ['alt/frisch', '2026-09-20']])
  assert.deepEqual(z.themen, [{ thema: 'alt' }])
  assert.deepEqual(fuehreZusammen(alt, { ...neu, themen: [{ thema: 'neu' }] }, { jetzt: JETZT }).themen, [{ thema: 'neu' }])
})

test('Prompt: Zielgruppe, Ausschlüsse, Markenverbot im Motiv, beide Listen', () => {
  const p = baueTrendsPrompt({ kandidaten: [{ slug: 'a/gut', beschreibung: 'X', sterne: 5 }], themen: [{ titel: 'T', url: 'https://t.example', datum: '2026-10-10', punkte: 1 }], heute: '2026-10-12' })
  assert.match(p, /Selbstständigen, kleinen Betrieben/)
  assert.match(p, /Erfinde keine Repos/)
  assert.match(p, /voxel-style/)
  assert.match(p, /"slug":"a\/gut"/)
  assert.match(p, /"quelle":"https:\/\/t\.example"/)
  assert.equal(EINSTELLUNGEN.maxRepos, 10)
})
