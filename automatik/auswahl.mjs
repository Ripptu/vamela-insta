// Wählt den nächsten Beitrag. Feste Regeln zuerst: nur geprüfte Beiträge, „Frühestens“ beachten (Berliner Datum), höchstens
// drei Versuche, nie dieselbe Säule und nie derselbe Hook-Stil wie beim letzten Beitrag, „Entwurf“-Hinweis nie zweimal
// hintereinander, dasselbe Werkzeug nicht zweimal in 30 Tagen, keine Säule unter 10 % der letzten zehn Beiträge.
// Ist eine Regel mangels Auswahl nicht erfüllbar, wird sie der Reihe nach gelockert und das gemeldet.
// Unter den übrigen entscheidet der Optimierer (automatik/optimierer.mjs, ε-greedy mit festem Startwert je Tag und Typ).
import { berlin } from './zeit.mjs'
import { waehleKandidat, saeulenZwang, zufall } from './optimierer.mjs'

const zahl = (id) => Number(String(id).replace(/\D/g, '')) || 0
const norm = (a) => {
  const s = String(a ?? 'keins').toLowerCase().trim()
  return s === '' ? 'keins' : s
}
export const hatAngebot = (x) => norm(x.angebot) !== 'keins'
const sortiert = (l) => [...l].sort((a, b) => zahl(a.id) - zahl(b.id))

export function veroeffentlichteFeed(q) {
  return q.filter((x) => x.status === 'veroeffentlicht' && (x.typ === 'karussell' || x.typ === 'reel')).sort((a, b) => (a.ig?.am || '').localeCompare(b.ig?.am || ''))
}

export function waehle(q, { typ, serie = false, jetzt = new Date(), log = () => {}, gewichte = {}, epsilon, themenfenster = [] } = {}) {
  const heute = berlin(jetzt).datum
  let kand = q.filter((x) => x.status === 'geprueft' && x.typ === typ && (!x.fruehestens || x.fruehestens <= heute) && (!x.spaetestens || x.spaetestens >= heute) && (x.versuche || 0) < 3)
  // Serie „5 GitHub-Repos“ (Thema repos5, Christian 14.10.2026): täglich genau ein Beitrag, im Abend-Termin ab 17 Uhr,
  // der älteste fällige zuerst; sonst nie (auch nicht in anderen Terminen). Gilt auch in Themenfenstern.
  if (typ === 'karussell') {
    const serie = kand.filter((x) => x.thema === 'repos5')
    const schonHeute = q.some((x) => x.thema === 'repos5' && x.status === 'veroeffentlicht' && x.ig?.am && berlin(new Date(x.ig.am)).datum === heute)
    if (serie.length && !schonHeute && berlin(jetzt).stunde >= 17) {
      const w = sortiert(serie).sort((a, b) => String(a.fruehestens || '').localeCompare(String(b.fruehestens || '')))[0]
      log(`Serie „5 GitHub-Repos“: ${w.id} (Abend-Termin)`)
      return w
    }
    kand = kand.filter((x) => x.thema !== 'repos5')
  }
  // Themenfenster (plan/params.json themenfenster, z. B. Halloween-Woche): im Fenster kommt nur Beitrag mit diesem Thema,
  // davor und danach nie. Der Tagesplan (Frühestens/Spätestens je Beitrag) bestimmt, welcher Tag welchen Beitrag bekommt.
  const fenster = themenfenster.find((f) => f.von <= heute && heute <= f.bis)
  if (fenster) {
    const thematisch = kand.filter((x) => x.thema === fenster.thema)
    if (thematisch.length) {
      const amTag = thematisch.filter((x) => x.fruehestens === heute)
      kand = amTag.length ? amTag : thematisch
    } else kand = kand.filter((x) => !x.thema)
  } else kand = kand.filter((x) => !x.thema)
  if (typ === 'reel') kand = kand.filter((x) => (serie ? !!x.serie : !x.serie))
  if (!kand.length) return null
  const hist = typ === 'story'
    ? q.filter((x) => x.status === 'veroeffentlicht' && x.typ === 'story').sort((a, b) => (a.ig?.am || '').localeCompare(b.ig?.am || ''))
    : veroeffentlichteFeed(q)
  const letzter = hist[hist.length - 1]
  const vor30 = new Date(jetzt.getTime() - 30 * 864e5).toISOString()
  const werkzeugeKuerzlich = new Set(q.filter((x) => x.status === 'veroeffentlicht' && x.werkzeug && (x.ig?.am || '') >= vor30).map((x) => x.werkzeug))
  const regeln = [
    ['dasselbe Werkzeug nicht zweimal in 30 Tagen', (x) => !(x.werkzeug && werkzeugeKuerzlich.has(x.werkzeug))],
    ['nicht dieselbe Säule wie der letzte Beitrag', (x) => !(letzter && x.saeule && x.saeule === letzter.saeule)],
    ['nicht derselbe Hook-Stil wie der letzte Beitrag', (x) => !(letzter && x.hook_stil && x.hook_stil === letzter.hook_stil)],
    ['Entwurf-Hinweis nie zweimal hintereinander', (x) => !(letzter && norm(x.angebot) === 'entwurf' && norm(letzter.angebot) === 'entwurf')],
  ]
  let pool = sortiert(kand)
  for (const [name, ok] of regeln) {
    const n = pool.filter(ok)
    if (n.length) pool = n
    else log(`Regel gelockert (zu wenig Auswahl): ${name}`)
  }
  if (typ !== 'story') {
    const z = saeulenZwang(hist, pool)
    if (z.grund) { pool = z.pool; log(`Säulen-Untergrenze: ${z.grund}`) }
  }
  const wahl = waehleKandidat(pool, gewichte, { rng: zufall(`${heute}|${typ}`), ...(epsilon != null ? { epsilon } : {}) })
  if (wahl && pool.length > 1) log(`Optimierer (${wahl.modus}): ${wahl.item.id} aus ${pool.length} Kandidaten, Punktzahl ${wahl.punktzahl.toFixed(2)}`)
  return wahl?.item ?? null
}
