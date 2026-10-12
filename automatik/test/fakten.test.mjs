// Tests für die Fakten-Prüfung (Preise und Adressen nur aus data/fakten.json), ohne Netz: pruefeLive bekommt ein falsches fetch.
import test from 'node:test'
import assert from 'node:assert/strict'
import { preiseImText, vamelaPfade, pruefeText, pruefeLive, ladeFakten, beitragsText } from '../fakten.mjs'

const fakten = ladeFakten()

test('preiseImText erkennt €, Euro und Tausenderpunkt', () => {
  assert.deepEqual(preiseImText('ab 49 € im Monat, 1.490 € einmalig, Logo ab 249 Euro, 45€ die Stunde, 12,50 €'), ['49 €', '1.490 €', '249 €', '45 €', '12,50 €'])
  assert.deepEqual(preiseImText('kein Preis, 2 × 2 cm'), [])
})

test('vamelaPfade', () => {
  assert.deepEqual(vamelaPfade('Auf vamela.de/qr-code-generator und vamela.de/werkzeuge.'), ['/qr-code-generator', '/werkzeuge'])
  assert.deepEqual(vamelaPfade('Nur vamela.de, sonst nichts'), [])
})

test('pruefeText: bekannte Preise und Adressen ok, erfundene nicht', () => {
  assert.deepEqual(pruefeText('Website ab 49 € im Monat oder 490 € einmalig. Mehr auf vamela.de/leistungen und vamela.de/projekt/bachmaier/', fakten), [])
  assert.match(pruefeText('Heute nur 39 €!', fakten)[0], /39 €/)
  assert.match(pruefeText('Probier vamela.de/gibt-es-nicht', fakten)[0], /gibt-es-nicht/)
})

test('beitragsText sammelt Seiten, Caption, Werkzeug und Reel-Ablauf', () => {
  const t = beitragsText({ caption: 'C', werkzeug: '/dpi-pruefen', pages: [{ head: 'H', sub: 'S' }, { text: 'T' }], ablauf: [{ text: 'A' }] })
  for (const s of ['C', 'vamela.de/dpi-pruefen', 'H S', 'T', 'A']) assert.ok(t.includes(s), s)
})

test('pruefeLive: findet fehlende Preise und tote Adressen', async () => {
  const f = { basis: 'https://x', preise: [{ text: '49 €', bedeutung: 'Start', seite: '/leistungen' }, { text: '249 €', bedeutung: 'Logo', seite: '/grafikdesign', beleg: 'Logo ab 249 €' }], werkzeuge: [{ name: 'QR', pfad: '/qr' }], referenzen: [], eigene_seiten: [] }
  const seiten = { 'https://x/leistungen': [200, '<p>Start <b>49&nbsp;€</b></p>'], 'https://x/grafikdesign': [200, '<p>Logo ab 299 €</p>'], 'https://x/qr': [404, ''] }
  const holen = async (url) => ({ status: seiten[url][0], text: async () => seiten[url][1] })
  const p = await pruefeLive(f, { holen })
  assert.equal(p.length, 2)
  assert.ok(p.some((x) => /Logo ab 249 €/.test(x)))
  assert.ok(p.some((x) => /\/qr antwortet mit 404/.test(x)))
  assert.deepEqual(await pruefeLive(f, { holen, nurPreise: true }).then((l) => l.length), 1)
})
