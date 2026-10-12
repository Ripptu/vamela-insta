// Tests für den Optimierer (automatik/optimierer.mjs): Wachstumswert, Merkmale, Gewichte mit Grenzen und Mindest-Stichprobe,
// deterministische Auswahl (ε-greedy) und Planung neuer Inhalte. Ohne Netz, ohne Claude.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  wachstumswert, captionLaenge, merkmaleVon, beobachtungen, statistik, begrenze, berechneGewichte, zufall,
  waehleKandidat, punktzahl, saeulenZwang, planeMerkmale, rangliste, aktualisiere, GRENZEN, EINSTELLUNGEN, WERTE,
} from '../optimierer.mjs'

const summe = (o) => Object.values(o).reduce((a, b) => a + b, 0)

test('wachstumswert: Formel je 100 Reichweite, unter Mindestreichweite null', () => {
  assert.equal(wachstumswert({ reach: 200, follows: 2, profile_visits: 10, shares: 4, saved: 6 }), ((2 * 10 + 10 * 2 + 4 * 3 + 6 * 2) / 200) * 100)
  assert.equal(wachstumswert({ reach: 29, follows: 5 }), null)
  assert.equal(wachstumswert({ reach: 100 }), 0)
  assert.equal(wachstumswert({}), null)
})

test('captionLaenge und merkmaleVon (Wochentag und Uhrzeit in Berliner Zeit)', () => {
  assert.equal(captionLaenge('x'.repeat(100)), 'kurz')
  assert.equal(captionLaenge('x'.repeat(500)), 'mittel')
  assert.equal(captionLaenge('x'.repeat(1200)), 'lang')
  const m = merkmaleVon({ typ: 'karussell', saeule: 'tipps', hook_stil: 'fehler', caption: 'kurz' }, '2026-10-13T17:05:00Z')
  assert.deepEqual(m, { saeule: 'tipps', hook_stil: 'fehler', format: 'karussell', cover_vorlage: null, wochentag: 'di', uhrzeit: '19:00', caption_laenge: 'kurz' })
})

const beitrag = (i, merkmale, werte, zeit = '2026-10-01T17:00:00Z') => [`M${i}`, { id: `k${i}`, titel: `T${i}`, zeit, merkmale, verlauf: [{ datum: '2026-10-10', ...werte }] }]
const messwerte = (liste) => ({ konto: [], beitraege: Object.fromEntries(liste) })

test('beobachtungen: nur mit Merkmalen, Mindestreichweite und Mindestalter', () => {
  const mw = messwerte([
    beitrag(1, { saeule: 'tipps' }, { reach: 100, follows: 1 }),
    beitrag(2, null, { reach: 100, follows: 1 }),
    beitrag(3, { saeule: 'tipps' }, { reach: 10, follows: 1 }),
    beitrag(4, { saeule: 'tipps' }, { reach: 100, follows: 1 }, new Date().toISOString()),
  ])
  const b = beobachtungen(mw, { jetzt: new Date('2026-10-12T12:00:00Z') })
  assert.deepEqual(b.map((x) => x.id), ['k1'])
})

test('begrenze: Summe 1, Untergrenze und Obergrenze, kein Wert auf 0', () => {
  const g = begrenze({ tipps: 0.9, werkzeuge: 0.1, design: 0 }, GRENZEN.saeule)
  assert.ok(Math.abs(summe(g) - 1) < 1e-3)
  assert.ok(g.design >= 0.15 - 1e-9 && g.werkzeuge >= 0.15 - 1e-9 && g.tipps <= 0.6 + 1e-9)
  const h = begrenze(Object.fromEntries(WERTE.hook_stil.map((x, i) => [x, i === 0 ? 1 : 0])), GRENZEN.hook_stil)
  assert.ok(Object.values(h).every((v) => v >= 0.05 - 1e-9 && v <= 0.4 + 1e-9))
  assert.ok(Math.abs(summe(h) - 1) < 1e-3)
})

/** n Beiträge je Säule mit festem Wachstumsbild: design stark, tipps mittel, werkzeuge schwach. */
const daten = (n) => {
  const l = []
  let i = 0
  for (const [s, f] of [['design', 6], ['tipps', 3], ['werkzeuge', 1]]) for (let k = 0; k < n; k++) l.push(beitrag(++i, { saeule: s, hook_stil: WERTE.hook_stil[k % 7], format: 'karussell' }, { reach: 200, follows: f, saved: 2 }))
  return l
}

test('berechneGewichte: unter Mindest-Stichprobe bewegt sich nichts', () => {
  const beob = beobachtungen(messwerte(daten(1)), { jetzt: new Date('2026-10-12') })
  const alt = { saeule: { tipps: 0.3334, werkzeuge: 0.3333, design: 0.3333 } }
  const { gewichte, aenderungen } = berechneGewichte(beob, alt)
  assert.deepEqual(gewichte.saeule, alt.saeule)
  assert.equal(aenderungen.filter((a) => a.merkmal === 'saeule').length, 0)
})

test('berechneGewichte: starke Säule steigt, schwache sinkt, höchstens um die Lernrate, Grenzen halten', () => {
  const beob = beobachtungen(messwerte(daten(4)), { jetzt: new Date('2026-10-12') })
  const alt = { saeule: { tipps: 0.3334, werkzeuge: 0.3333, design: 0.3333 } }
  const { gewichte, aenderungen } = berechneGewichte(beob, alt)
  assert.ok(gewichte.saeule.design > alt.saeule.design)
  assert.ok(gewichte.saeule.werkzeuge < alt.saeule.werkzeuge)
  assert.ok(Math.abs(summe(gewichte.saeule) - 1) < 1e-3)
  for (const v of Object.values(gewichte.saeule)) assert.ok(v >= GRENZEN.saeule.min - 1e-9)
  // höchstens Lernrate × Abstand: die Änderung bleibt deutlich unter einem vollen Sprung
  assert.ok(gewichte.saeule.design - alt.saeule.design < 0.2)
  assert.ok(aenderungen.some((a) => a.merkmal === 'saeule' && a.wert === 'design' && a.n === 4))
  // viele Läufe hintereinander: Untergrenze 15 % hält
  let g = alt
  for (let k = 0; k < 30; k++) g = berechneGewichte(beob, g).gewichte
  assert.ok(g.saeule.werkzeuge >= 0.15 - 1e-9 && g.saeule.design <= 0.6 + 1e-9)
})

test('zufall ist deterministisch', () => {
  const a = zufall('2026-10-12|karussell'), b = zufall('2026-10-12|karussell'), c = zufall('anders')
  const la = [a(), a(), a()], lb = [b(), b(), b()]
  assert.deepEqual(la, lb)
  assert.notDeepEqual(la, [c(), c(), c()])
  assert.ok(la.every((x) => x >= 0 && x < 1))
})

test('waehleKandidat: Ausnutzen nimmt die höchste Punktzahl, Erkunden die am wenigsten erprobten Merkmale', () => {
  const k = [{ id: 'a', saeule: 'tipps', hook_stil: 'frage' }, { id: 'b', saeule: 'design', hook_stil: 'liste' }]
  const gewichte = { saeule: { tipps: 0.2, werkzeuge: 0.2, design: 0.6 } }
  assert.ok(punktzahl(k[1], gewichte) > punktzahl(k[0], gewichte))
  assert.equal(waehleKandidat(k, gewichte, { epsilon: 0 }).item.id, 'b')
  const st = { merkmale: { saeule: { design: { n: 9 }, tipps: { n: 1 } }, hook_stil: {}, format: {} } }
  const r = waehleKandidat(k, gewichte, { epsilon: 1, statistik: st })
  assert.equal(r.modus, 'erkunden')
  assert.equal(r.item.id, 'a')
  // mit festem Startwert bei 20 % Erkunden: gleiche Eingabe, gleiches Ergebnis
  assert.deepEqual(waehleKandidat(k, gewichte, { rng: zufall('x') }), waehleKandidat(k, gewichte, { rng: zufall('x') }))
})

test('waehleKandidat: rund 20 % Erkunden über viele Tage', () => {
  const k = [{ id: 'a', saeule: 'tipps' }, { id: 'b', saeule: 'design' }]
  let erk = 0
  for (let t = 0; t < 1000; t++) if (waehleKandidat(k, {}, { rng: zufall(`tag${t}`) }).modus === 'erkunden') erk++
  assert.ok(erk > 150 && erk < 250, `Erkunden ${erk} von 1000`)
})

test('saeulenZwang: Säule unter 15 % kommt dran, sonst bleibt der Pool', () => {
  const pub = Array.from({ length: 10 }, (_, i) => ({ saeule: i < 9 ? 'tipps' : 'werkzeuge' }))
  const pool = [{ id: 'x', saeule: 'tipps' }, { id: 'y', saeule: 'design' }]
  const z = saeulenZwang(pub, pool)
  assert.deepEqual(z.pool.map((x) => x.id), ['y'])
  assert.match(z.grund, /design/)
  assert.equal(saeulenZwang(pub.slice(0, 3), pool).grund, null)
})

test('planeMerkmale: Verteilung nach Gewicht, nie zweimal dieselbe Säule hintereinander, deterministisch', () => {
  const gewichte = { saeule: { tipps: 0.5, werkzeuge: 0.3, design: 0.2 } }
  const p = planeMerkmale(10, gewichte, { seed: 'a' })
  assert.equal(p.length, 10)
  const anzahl = (s) => p.filter((x) => x.saeule === s).length
  assert.deepEqual([anzahl('tipps'), anzahl('werkzeuge'), anzahl('design')], [5, 3, 2])
  for (let i = 1; i < p.length; i++) assert.notEqual(p[i].hook_stil, p[i - 1].hook_stil)
  assert.deepEqual(planeMerkmale(10, gewichte, { seed: 'a' }), p)
  for (const x of p) assert.ok(WERTE.hook_stil.includes(x.hook_stil))
  const q = planeMerkmale(3, {}, { seed: 'b', vorher: [{ saeule: 'tipps', hook_stil: 'frage' }] })
  assert.notEqual(q[0].saeule, 'tipps')
  assert.notEqual(q[0].hook_stil, 'frage')
})

test('rangliste und aktualisiere: params bekommen Gewichte und Stand, Verlauf nennt die Änderungen', () => {
  const mw = messwerte(daten(4))
  const r = rangliste(beobachtungen(mw, { jetzt: new Date('2026-10-12') }))
  assert.equal(r.beste[0].merkmale.saeule, 'design')
  assert.equal(r.schwaechste[0].merkmale.saeule, 'werkzeuge')
  const { params, eintrag } = aktualisiere({ messwerte: mw, params: { feed: {}, gewichte: {} }, jetzt: new Date('2026-10-12T10:00:00Z') })
  assert.equal(params.gewichte.stand, '2026-10-12')
  assert.equal(params.gewichte.stichprobe, 12)
  assert.ok(eintrag.aenderungen.length > 0)
  assert.equal(EINSTELLUNGEN.epsilon, 0.2)
})

test('statistik: Mittel je Wert', () => {
  const st = statistik([{ wert: 2, merkmale: { saeule: 'tipps' } }, { wert: 4, merkmale: { saeule: 'tipps' } }, { wert: 9, merkmale: { saeule: 'design' } }])
  assert.equal(st.merkmale.saeule.tipps.mittel, 3)
  assert.equal(st.merkmale.saeule.tipps.n, 2)
  assert.equal(st.gesamt, 5)
})
