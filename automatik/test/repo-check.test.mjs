// Tests für die Repo-Prüfung der Säule fundstuecke (automatik/repo-check.mjs), ohne Netz: pruefeRepo bekommt ein falsches fetch.
import test from 'node:test'
import assert from 'node:assert/strict'
import { pruefeRepo, holeReadme, sterneGerundet, sterneText, repoAdressen, kostenHinweise, pruefeRepoAngaben, STERNE_FORMAT } from '../repo-check.mjs'

const JETZT = new Date('2026-10-12T10:00:00Z')
const repo = (x = {}) => ({ full_name: 'muster/werkzeug', html_url: 'https://github.com/muster/werkzeug', description: 'A free tool', stargazers_count: 12345, archived: false, fork: false, pushed_at: '2026-09-30T12:00:00Z', license: { spdx_id: 'MIT', name: 'MIT License' }, topics: ['image'], ...x })
const antwort = (status, body, headers = {}) => ({ status, headers: { get: (k) => headers[k.toLowerCase()] ?? null }, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) })
const holenMit = (map) => async (url, opt) => { const pfad = new URL(url).pathname; if (!(pfad in map)) throw new Error(`unerwartet ${pfad}`); return typeof map[pfad] === 'function' ? map[pfad](opt) : map[pfad] }

test('sterneGerundet und sterneText: gerundet, mit Tausenderpunkt und Stand', () => {
  assert.equal(sterneGerundet(7), 'rund 7')
  assert.equal(sterneGerundet(874), 'rund 870')
  assert.equal(sterneGerundet(4321), 'rund 4.300')
  assert.equal(sterneGerundet(50469), 'rund 50.000')
  assert.equal(sterneGerundet(182813), 'rund 183.000')
  assert.equal(sterneText(94035, JETZT), 'rund 94.000 (Stand 12.10.2026)')
  assert.match(sterneText(94035, JETZT), STERNE_FORMAT)
})

test('repoAdressen: owner/name aus github.com-Adressen, ohne Unterseiten und Satzzeichen', () => {
  assert.deepEqual(repoAdressen('Repo: github.com/upscayl/upscayl · Lizenz. Releases: https://github.com/upscayl/upscayl/releases/latest, und github.com/a-b/c.d.'), ['upscayl/upscayl', 'a-b/c.d'])
  assert.deepEqual(repoAdressen('nur vamela.de/werkzeuge'), [])
})

test('pruefeRepo: gepflegtes Repo mit Lizenz ist ok, Daten vollständig, Token geht mit', async () => {
  const alt = process.env.GITHUB_TOKEN
  process.env.GITHUB_TOKEN = 'test-token'
  let auth = null
  try {
    const r = await pruefeRepo('muster/werkzeug', { jetzt: JETZT, holen: holenMit({ '/repos/muster/werkzeug': (o) => { auth = o.headers.Authorization; return antwort(200, repo()) } }) })
    assert.equal(r.ok, true, r.probleme.join())
    assert.equal(r.daten.lizenz, 'MIT')
    assert.equal(r.daten.sterne_text, 'rund 12.000 (Stand 12.10.2026)')
    assert.equal(r.daten.stand, '2026-10-12')
    assert.equal(auth, 'Bearer test-token')
  } finally { if (alt == null) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = alt }
})

test('pruefeRepo: archiviert, alt, ohne Lizenz, Fork, umbenannt, fehlt', async () => {
  const pruef = (x, slug = 'muster/werkzeug') => pruefeRepo(slug, { jetzt: JETZT, holen: async () => antwort(200, repo(x)) })
  assert.match((await pruef({ archived: true })).probleme.join(), /archiviert/)
  assert.match((await pruef({ pushed_at: '2025-05-27T20:05:19Z' })).probleme.join(), /älter als 12 Monate/)
  assert.match((await pruef({ license: { spdx_id: 'NOASSERTION', name: 'Other' } })).probleme.join(), /keine eindeutige Lizenz/)
  assert.match((await pruef({ license: null })).probleme.join(), /keine eindeutige Lizenz/)
  assert.match((await pruef({ fork: true })).probleme.join(), /Fork/)
  assert.match((await pruef({ full_name: 'neu/werkzeug' })).probleme.join(), /heißt inzwischen neu\/werkzeug/)
  const weg = await pruefeRepo('muster/weg', { holen: async () => antwort(404, { message: 'Not Found' }) })
  assert.equal(weg.ok, false)
  assert.equal(weg.voruebergehend, false)
  assert.match(weg.probleme[0], /existiert nicht/)
  assert.match((await pruefeRepo('kein slug')).probleme[0], /keine Repo-Angabe/)
})

test('pruefeRepo: Ratenlimit und Netzfehler sind vorübergehend, kein Urteil über das Repo', async () => {
  const limit = await pruefeRepo('muster/werkzeug', { holen: async () => antwort(403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1791800000' }) })
  assert.equal(limit.voruebergehend, true)
  assert.match(limit.probleme[0], /Ratenlimit/)
  const netz = await pruefeRepo('muster/werkzeug', { holen: async () => { throw new Error('getaddrinfo ENOTFOUND') } })
  assert.equal(netz.voruebergehend, true)
  assert.match(netz.probleme[0], /nicht erreichbar/)
})

test('holeReadme: ohne HTML und Bilder, gekürzt; 404 ist leer', async () => {
  const md = '<p align="center"><img src="x.png"></p>\n# Werkzeug\n![Bild](a.png)\nA free tool. <b>Fast.</b>\n\n\n\nPaid plans for teams.'
  const t = await holeReadme('muster/werkzeug', { holen: async (url, o) => { assert.equal(o.headers.Accept, 'application/vnd.github.raw'); return antwort(200, md) } })
  assert.doesNotMatch(t, /<|!\[/)
  assert.match(t, /A free tool\. Fast\./)
  assert.equal((await holeReadme('muster/werkzeug', { max: 10, holen: async () => antwort(200, md) })).length <= 10, true)
  assert.equal(await holeReadme('muster/werkzeug', { holen: async () => antwort(404, '') }), '')
  await assert.rejects(holeReadme('muster/werkzeug', { holen: async () => antwort(403, '', { 'x-ratelimit-remaining': '0' }) }), /Ratenlimit/)
})

test('kostenHinweise erkennt Bezahlangebote', () => {
  assert.deepEqual(kostenHinweise('Penpot Enterprise is our paid plan. See Pricing.'), ['paid plan', 'pricing'])
  assert.deepEqual(kostenHinweise('Free and open source image upscaler'), [])
})

test('pruefeRepoAngaben: Repo, Lizenz, Sterne, Adresse in der Caption und Kosten müssen stimmen', () => {
  const daten = { slug: 'muster/werkzeug', lizenz: 'MIT', sterne: 12345 }
  const gut = { repo: 'muster/werkzeug', lizenz: 'MIT', sterne: 'rund 12.000 (Stand 12.10.2026)', caption: 'Repo: github.com/muster/werkzeug · Lizenz: MIT · rund 12.000 Sterne auf GitHub (Stand 12.10.2026).', text: '' }
  assert.deepEqual(pruefeRepoAngaben(gut, daten, { jetzt: JETZT }), [])
  const f = (x, o = {}) => pruefeRepoAngaben({ ...gut, ...x }, daten, { jetzt: JETZT, ...o }).join(' | ')
  assert.match(f({ repo: 'muster/anders' }), /Zeile „Repo“/)
  assert.match(f({ lizenz: 'GPL-3.0' }), /laut GitHub MIT/)
  assert.match(f({ sterne: '12.345 Sterne' }), /rund N \(Stand/)
  assert.match(f({ sterne: 'rund 40.000 (Stand 12.10.2026)' }), /live nur 12345/)
  assert.match(f({ sterne: 'rund 15.000 (Stand 12.10.2026)' }), /zu hoch gerundet/)
  assert.match(f({ sterne: 'rund 12.000 (Stand 12.12.2026)' }), /Zukunft/)
  assert.match(f({ caption: 'Lizenz: MIT, ohne Adresse.' }), /nennt die Adresse/)
  assert.match(f({ caption: 'github.com/muster/werkzeug ohne Lizenz' }), /nennt die Lizenz/)
  assert.match(f({}, { kosten: ['paid plan'] }), /nennt keine Kosten/)
  assert.deepEqual(pruefeRepoAngaben({ ...gut, caption: gut.caption + ' Für Teams gibt es einen kostenpflichtigen Plan.' }, daten, { jetzt: JETZT, kosten: ['paid plan'] }), [])
})
