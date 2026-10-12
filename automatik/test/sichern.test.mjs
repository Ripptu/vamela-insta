import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeQueue } from '../queue-merge.mjs'
import { waehle } from '../auswahl.mjs'

const it = (id, status, extra = {}) => ({ id, typ: 'karussell', status, ...extra })

test('mergeQueue: eigene Änderung bleibt, fremde bleiben', () => {
  const basis = [it('k01', 'geprueft'), it('k02', 'neu')]
  const meine = [it('k01', 'veroeffentlicht', { ig: { id: 'x' } }), it('k02', 'neu')]
  const gegen = [it('k01', 'geprueft'), it('k02', 'geprueft', { qa: { verdikt: 'ok' } }), it('k03', 'neu')]
  const m = mergeQueue(basis, meine, gegen)
  assert.equal(m.find((x) => x.id === 'k01').status, 'veroeffentlicht')
  assert.equal(m.find((x) => x.id === 'k02').status, 'geprueft')
  assert.ok(m.find((x) => x.id === 'k03'))
})
test('mergeQueue: neue Beiträge von mir kommen dazu, gelöschte gehen', () => {
  const basis = [it('k01', 'neu'), it('k02', 'abgelehnt')]
  const meine = [it('k01', 'neu'), it('k03', 'neu')]
  const gegen = [it('k01', 'neu'), it('k02', 'abgelehnt')]
  const m = mergeQueue(basis, meine, gegen).map((x) => x.id)
  assert.deepEqual(m, ['k01', 'k03'])
})
test('waehle: Frühestens, numerische Sortierung, ohne Gewichte der erste', () => {
  const q = [it('k100', 'geprueft'), it('k11', 'geprueft'), it('k05', 'geprueft', { fruehestens: '2099-01-01' })]
  assert.equal(waehle(q, { typ: 'karussell', epsilon: 0 }).id, 'k11')
})
test('waehle: nicht dieselbe Säule und nicht derselbe Hook-Stil wie zuletzt', () => {
  const v = it('k01', 'veroeffentlicht', { ig: { am: '2026-10-01T17:00:00Z' }, saeule: 'tipps', hook_stil: 'frage' })
  const q = [v, it('k02', 'geprueft', { saeule: 'tipps', hook_stil: 'fehler' }), it('k03', 'geprueft', { saeule: 'design', hook_stil: 'frage' }), it('k04', 'geprueft', { saeule: 'werkzeuge', hook_stil: 'mythos' })]
  assert.equal(waehle(q, { typ: 'karussell', epsilon: 0 }).id, 'k04')
})
test('waehle: Entwurf-Hinweis nie zweimal hintereinander, Werkzeug nicht zweimal in 30 Tagen', () => {
  const jetzt = new Date('2026-11-10T18:00:00Z')
  const v1 = it('k01', 'veroeffentlicht', { ig: { am: '2026-11-01T17:00:00Z' }, werkzeug: '/qr-code-generator', saeule: 'werkzeuge' })
  const v2 = it('k02', 'veroeffentlicht', { ig: { am: '2026-11-09T17:00:00Z' }, angebot: 'Entwurf', saeule: 'tipps' })
  const q = [v1, v2, it('k03', 'geprueft', { angebot: 'Entwurf', saeule: 'design' }), it('k04', 'geprueft', { werkzeug: '/qr-code-generator', saeule: 'werkzeuge' }), it('k05', 'geprueft', { werkzeug: '/dpi-pruefen', saeule: 'werkzeuge' })]
  assert.equal(waehle(q, { typ: 'karussell', jetzt, epsilon: 0 }).id, 'k05')
})
test('waehle: Regeln werden gelockert statt keinen Beitrag zu wählen', () => {
  const v = (id, am) => it(id, 'veroeffentlicht', { ig: { am }, saeule: 'tipps', hook_stil: 'frage' })
  const q = [v('k01', '2026-10-01'), it('k04', 'geprueft', { saeule: 'tipps', hook_stil: 'frage' })]
  const meldungen = []
  assert.equal(waehle(q, { typ: 'karussell', log: (m) => meldungen.push(m) }).id, 'k04')
  assert.ok(meldungen.some((m) => /gelockert/.test(m)))
})
test('waehle: der Optimierer bevorzugt das stärkere Gewicht', () => {
  const q = [it('k01', 'geprueft', { saeule: 'tipps' }), it('k02', 'geprueft', { saeule: 'design' })]
  const gewichte = { saeule: { tipps: 0.2, werkzeuge: 0.3, design: 0.5 } }
  assert.equal(waehle(q, { typ: 'karussell', gewichte, epsilon: 0 }).id, 'k02')
  assert.equal(waehle(q, { typ: 'karussell', gewichte: { saeule: { tipps: 0.6, werkzeuge: 0.2, design: 0.2 } }, epsilon: 0 }).id, 'k01')
})
test('waehle: Säulen-Untergrenze holt eine vernachlässigte Säule zurück', () => {
  const pub = Array.from({ length: 8 }, (_, i) => it(`k${i + 1}`, 'veroeffentlicht', { ig: { am: `2026-10-0${i + 1}T17:00:00Z` }, saeule: i % 2 ? 'tipps' : 'werkzeuge' }))
  const q = [...pub, it('k20', 'geprueft', { saeule: 'werkzeuge' }), it('k21', 'geprueft', { saeule: 'design' })]
  const meldungen = []
  const gewichte = { saeule: { tipps: 0.25, werkzeuge: 0.6, design: 0.15 } }
  assert.equal(waehle(q, { typ: 'karussell', gewichte, epsilon: 0, log: (m) => meldungen.push(m) }).id, 'k21')
  assert.ok(meldungen.some((m) => /Säulen-Untergrenze/.test(m)))
})
