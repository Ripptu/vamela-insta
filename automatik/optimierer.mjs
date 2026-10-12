// Optimierer: lernt aus den Messwerten, welche Merkmale eines Beitrags Follower bringen, und steuert damit Auswahl
// und Neuschreiben. Alles deterministisch im Code (fester Zufallsstartwert je Tag), ohne Claude.
//
//  Wachstumswert je Beitrag = (follows × 10 + profile_visits × 2 + shares × 3 + saved × 2) je 100 erreichte Konten,
//  erst ab einer Mindestreichweite (sonst zählt der Beitrag nicht).
//  Gewichte je Merkmal (Säule, Hook-Stil, Format, Cover-Vorlage, Wochentag, Uhrzeit, Caption-Länge) stehen in
//  plan/params.json unter „gewichte“, als Anteile, die sich je Merkmal zu 1 summieren. Ein Wert bewegt sich erst,
//  wenn er mindestens EINSTELLUNGEN.minStichprobe gemessene Beiträge hat; er bewegt sich höchstens um die Lernrate
//  in Richtung des Messwerts und bleibt in den Grenzen (keine Säule unter 15 %, kein Wert auf 0).
//  Auswahl: ε-greedy mit 20 % Erkunden (Beitrag mit den am wenigsten erprobten Merkmalen), sonst der Beitrag mit dem
//  höchsten Produkt seiner Gewichte.
//
// Aufruf: node automatik/optimierer.mjs [--trocken]   (aktualisiert plan/params.json und data/optimierer-verlauf.json)
import fs from 'node:fs'
import path from 'node:path'
import { berlin } from './zeit.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)

export const MERKMALE = ['saeule', 'hook_stil', 'format', 'cover_vorlage', 'wochentag', 'uhrzeit', 'caption_laenge']
/** Feste Wertelisten; Cover-Vorlage, Wochentag und Uhrzeit kommen aus den Daten. */
export const WERTE = {
  saeule: ['tipps', 'werkzeuge', 'design'],
  hook_stil: ['frage', 'fehler', 'mythos', 'kontrast', 'vorher-nachher', 'liste', 'provokation'],
  format: ['karussell', 'reel', 'story'],
  caption_laenge: ['kurz', 'mittel', 'lang'],
}
/** Unter- und Obergrenzen der Anteile je Merkmal (feste Regel, auch der Denk-Lauf kann sie nicht ändern). */
export const GRENZEN = {
  saeule: { min: 0.15, max: 0.6 },
  hook_stil: { min: 0.05, max: 0.4 },
  format: { min: 0.1, max: 0.8 },
  standard: { min: 0.05, max: 0.6 },
}
export const EINSTELLUNGEN = {
  minReichweite: 30, // darunter ist der Wachstumswert Zufall
  minStichprobe: 3, // gemessene Beiträge je Wert, bevor sich sein Gewicht bewegt
  minGesamt: 6, // gemessene Beiträge je Merkmal, bevor sich überhaupt etwas bewegt
  lernrate: 0.3, // höchstens 30 % des Abstands zum Messwert pro Lauf
  glaettung: 3, // Beiträge Vorwissen (Schrumpfung zum Gesamtmittel)
  epsilon: 0.2, // Anteil Erkunden
  minAlterStunden: 48, // Kennzahlen jüngerer Beiträge sind noch nicht stabil
}
export const grenzeFuer = (m) => GRENZEN[m] || GRENZEN.standard

const rund = (x, n = 4) => Math.round(x * 10 ** n) / 10 ** n
const summe = (l) => l.reduce((a, b) => a + b, 0)

/** Wachstumswert (Punkte je 100 erreichte Konten) oder null, wenn die Reichweite zu klein ist. */
export function wachstumswert(w = {}, { minReichweite = EINSTELLUNGEN.minReichweite } = {}) {
  const reach = +w.reach || 0
  if (reach < minReichweite) return null
  const punkte = (+w.follows || 0) * 10 + (+w.profile_visits || 0) * 2 + (+w.shares || 0) * 3 + (+w.saved || 0) * 2
  return rund((punkte / reach) * 100, 2)
}

export const captionLaenge = (c) => { const n = String(c || '').length; return n < 400 ? 'kurz' : n < 900 ? 'mittel' : 'lang' }
const WT = ['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa']
/** Merkmale eines Queue-Eintrags; Wochentag und Uhrzeit (volle Stunde, Berliner Zeit) aus dem Veröffentlichungszeitpunkt. */
export function merkmaleVon(item = {}, zeit = item.ig?.am) {
  const b = zeit ? berlin(new Date(zeit)) : null
  return {
    saeule: item.saeule ?? null,
    hook_stil: item.hook_stil ?? null,
    format: item.format || item.typ || null,
    cover_vorlage: item.cover_vorlage ?? null,
    wochentag: b ? WT[b.wochentag] : item.wochentag ?? null,
    uhrzeit: b ? `${String(b.stunde).padStart(2, '0')}:00` : item.uhrzeit ?? null,
    caption_laenge: item.caption_laenge ?? (item.caption != null ? captionLaenge(item.caption) : null),
  }
}

/** Gemessene Beiträge mit Merkmalen und Wachstumswert (nur ab Mindestreichweite und Mindestalter). */
export function beobachtungen(messwerte = {}, { jetzt = new Date(), ...o } = {}) {
  const e = { ...EINSTELLUNGEN, ...o }
  const out = []
  for (const [mediaId, b] of Object.entries(messwerte.beitraege || {})) {
    if (!b.merkmale || !b.verlauf?.length) continue
    if (b.zeit && jetzt - new Date(b.zeit) < e.minAlterStunden * 36e5) continue
    const l = b.verlauf[b.verlauf.length - 1]
    const wert = wachstumswert(l, e)
    if (wert == null) continue
    out.push({ mediaId, id: b.id, titel: b.titel, hook: b.hook || null, caption: b.caption || null, merkmale: b.merkmale, wert, reach: +l.reach, follows: +l.follows || 0 })
  }
  return out
}

/** Je Merkmal und Wert: Anzahl und Mittel des Wachstumswerts. */
export function statistik(beob) {
  const s = {}
  const gesamt = beob.length ? summe(beob.map((b) => b.wert)) / beob.length : 0
  for (const m of MERKMALE) {
    s[m] = {}
    for (const b of beob) {
      const v = b.merkmale?.[m]
      if (v == null) continue
      const z = (s[m][v] ||= { n: 0, summe: 0 })
      z.n++
      z.summe += b.wert
    }
    for (const z of Object.values(s[m])) { z.mittel = rund(z.summe / z.n, 2); delete z.summe }
  }
  return { gesamt: rund(gesamt, 2), n: beob.length, merkmale: s }
}

/** Anteile auf Summe 1 bringen und in [min, max] halten (Wasserstands-Verfahren, kein Wert fällt auf 0). */
export function begrenze(roh, { min, max }) {
  const k = Object.keys(roh)
  if (!k.length) return {}
  const lo = Math.min(min, 1 / k.length), hi = Math.max(max, 1 / k.length)
  const basis = Object.fromEntries(k.map((x) => [x, Math.max(+roh[x] || 0, 1e-9)]))
  const fest = {}
  for (let runde = 0; runde <= k.length; runde++) {
    const frei = k.filter((x) => !(x in fest))
    if (!frei.length) break
    const rest = 1 - summe(Object.values(fest))
    const s = summe(frei.map((x) => basis[x]))
    // je Runde nur den am stärksten verletzenden Wert festsetzen, sonst wird zu viel auf einmal fixiert
    let schlimmster = null, abstand = 1e-12
    for (const x of frei) {
      const v = (basis[x] / s) * rest
      const d = v < lo ? lo - v : v > hi ? v - hi : 0
      if (d > abstand) { abstand = d; schlimmster = [x, v < lo ? lo : hi] }
    }
    if (schlimmster) fest[schlimmster[0]] = schlimmster[1]
    else {
      const out = { ...fest }
      for (const x of frei) out[x] = (basis[x] / s) * rest
      return Object.fromEntries(k.map((x) => [x, rund(out[x])]))
    }
  }
  const t = summe(Object.values(fest))
  return Object.fromEntries(k.map((x) => [x, rund((fest[x] ?? lo) / t)]))
}

const gleichverteilt = (werte) => Object.fromEntries(werte.map((v) => [v, 1 / werte.length]))

/**
 * Neue Gewichte aus den Beobachtungen. alt = bisherige gewichte aus params.json.
 * Rückgabe { gewichte, aenderungen: [{merkmal, wert, von, nach, n, mittel}], statistik }.
 */
export function berechneGewichte(beob, alt = {}, o = {}) {
  const e = { ...EINSTELLUNGEN, ...o }
  const st = statistik(beob)
  const gewichte = {}
  const aenderungen = []
  for (const m of MERKMALE) {
    const gesehen = Object.keys(st.merkmale[m])
    const werte = [...new Set([...(WERTE[m] || []), ...Object.keys(alt[m] || {}), ...gesehen])]
    if (!werte.length) continue
    const g = grenzeFuer(m)
    const vorher = begrenze({ ...gleichverteilt(werte), ...(alt[m] || {}) }, g)
    const nGesamt = summe(Object.values(st.merkmale[m]).map((z) => z.n))
    let ziel = vorher
    if (nGesamt >= e.minGesamt && st.gesamt > 0) {
      // Geschrumpftes Mittel je Wert relativ zum Gesamtmittel; Werte ohne genug Stichprobe behalten ihren Anteil.
      const reif = werte.filter((v) => (st.merkmale[m][v]?.n || 0) >= e.minStichprobe)
      if (reif.length) {
        const frei = summe(reif.map((v) => vorher[v]))
        const score = Object.fromEntries(reif.map((v) => { const z = st.merkmale[m][v]; return [v, (z.n * z.mittel + e.glaettung * st.gesamt) / (z.n + e.glaettung)] }))
        const sScore = summe(Object.values(score)) || 1
        ziel = { ...vorher }
        for (const v of reif) ziel[v] = (score[v] / sScore) * frei
      }
    }
    const neu = begrenze(Object.fromEntries(werte.map((v) => [v, vorher[v] + e.lernrate * (ziel[v] - vorher[v])])), g)
    gewichte[m] = neu
    for (const v of werte) {
      const von = alt[m]?.[v] ?? null
      if (von == null || Math.abs(neu[v] - von) >= 0.005) {
        if (von == null && !st.merkmale[m][v]) continue // neu aufgenommener Wert ohne Daten: keine Meldung
        aenderungen.push({ merkmal: m, wert: v, von, nach: neu[v], n: st.merkmale[m][v]?.n || 0, mittel: st.merkmale[m][v]?.mittel ?? null })
      }
    }
  }
  return { gewichte, aenderungen, statistik: st }
}

// ---------------------------------------------------------------- Zufall (deterministisch)

/** Zufallszahlen 0..1 aus einem Startwert (mulberry32 über einen FNV-Hash), gleich bei gleichem Startwert. */
export function zufall(seed = 'vamela') {
  let h = 2166136261
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------- Auswahl

const AUSWAHL_MERKMALE = ['saeule', 'hook_stil', 'format', 'cover_vorlage', 'caption_laenge']
/** Punktzahl eines Kandidaten: Produkt der Gewichte relativ zur Gleichverteilung (1 = neutral). */
export function punktzahl(x, gewichte = {}) {
  const mk = merkmaleVon(x, null)
  let p = 1
  for (const m of AUSWAHL_MERKMALE) {
    const g = gewichte[m]
    const v = mk[m]
    if (!g || v == null || g[v] == null) continue
    p *= g[v] * Object.keys(g).length
  }
  return p
}
/** Wie gut sind die Merkmale eines Kandidaten schon erprobt (Summe der Stichproben). */
const erprobt = (x, st) => { const mk = merkmaleVon(x, null); return summe(['saeule', 'hook_stil', 'format'].map((m) => st?.merkmale?.[m]?.[mk[m]]?.n || 0)) }

/**
 * ε-greedy: mit Wahrscheinlichkeit epsilon der am wenigsten erprobte Kandidat, sonst der mit der höchsten Punktzahl.
 * Gleichstand: der erste in der Liste (Queue-Reihenfolge). Rückgabe { item, modus, punktzahl } oder null.
 */
export function waehleKandidat(kandidaten, gewichte = {}, { rng = zufall(), epsilon = EINSTELLUNGEN.epsilon, statistik: st = null } = {}) {
  if (!kandidaten.length) return null
  if (kandidaten.length === 1) return { item: kandidaten[0], modus: 'einziger', punktzahl: punktzahl(kandidaten[0], gewichte) }
  const r = rng()
  if (r < epsilon) {
    let best = kandidaten[0]
    for (const x of kandidaten) if (erprobt(x, st) < erprobt(best, st)) best = x
    return { item: best, modus: 'erkunden', punktzahl: punktzahl(best, gewichte) }
  }
  let best = kandidaten[0], bp = punktzahl(best, gewichte)
  for (const x of kandidaten) { const p = punktzahl(x, gewichte); if (p > bp + 1e-12) { best = x; bp = p } }
  return { item: best, modus: 'ausnutzen', punktzahl: bp }
}

/** Säulen-Untergrenze im Veröffentlichten: fällt eine Säule in den letzten `fenster` Beiträgen unter min, kommt sie dran. */
export function saeulenZwang(veroeffentlicht, pool, { min = GRENZEN.saeule.min, fenster = 10 } = {}) {
  const letzte = veroeffentlicht.slice(-fenster).filter((x) => x.saeule)
  if (letzte.length < 4) return { pool, grund: null }
  const anteil = (s) => letzte.filter((x) => x.saeule === s).length / letzte.length
  const zuWenig = WERTE.saeule.filter((s) => anteil(s) < min).sort((a, b) => anteil(a) - anteil(b))
  for (const s of zuWenig) {
    const mit = pool.filter((x) => x.saeule === s)
    if (mit.length) return { pool: mit, grund: `Säule ${s} nur ${Math.round(anteil(s) * 100)} % der letzten ${letzte.length} Beiträge` }
  }
  return { pool, grund: null }
}

// ---------------------------------------------------------------- Plan für neue Inhalte

/** Größte-Reste-Verteilung von n Plätzen nach Anteilen. */
function verteile(anteile, n) {
  const k = Object.keys(anteile)
  const roh = k.map((x) => anteile[x] * n)
  const ganz = roh.map(Math.floor)
  let rest = n - summe(ganz)
  const ordnung = k.map((x, i) => [i, roh[i] - ganz[i]]).sort((a, b) => b[1] - a[1] || a[0] - b[0])
  for (const [i] of ordnung) { if (rest-- <= 0) break; ganz[i]++ }
  return Object.fromEntries(k.map((x, i) => [x, ganz[i]]))
}

/**
 * Säule und Hook-Stil für `anzahl` neue Beiträge: Säulen nach Gewicht (Größte Reste, nie zweimal dieselbe hintereinander,
 * wenn es anders geht), Hook-Stil je Platz mit epsilon der am wenigsten erprobte, sonst nach Gewicht gezogen, nie derselbe
 * wie davor. `vorher` = Merkmale der zuletzt geschriebenen Beiträge (für die Reihenfolge).
 */
export function planeMerkmale(anzahl, gewichte = {}, { seed = 'plan', statistik: st = null, vorher = [], epsilon = EINSTELLUNGEN.epsilon, saeule = null } = {}) {
  const rng = zufall(seed)
  const gs = begrenze({ ...gleichverteilt(WERTE.saeule), ...(gewichte.saeule || {}) }, GRENZEN.saeule)
  const gh = begrenze({ ...gleichverteilt(WERTE.hook_stil), ...(gewichte.hook_stil || {}) }, GRENZEN.hook_stil)
  const zahl = verteile(gs, anzahl)
  const saeulen = []
  let letzte = vorher.at(-1)?.saeule ?? null
  for (let i = 0; i < anzahl; i++) {
    const offen = Object.keys(zahl).filter((s) => zahl[s] > 0).sort((a, b) => zahl[b] - zahl[a] || gs[b] - gs[a])
    const s = saeule || offen.find((x) => x !== letzte) || offen[0] || WERTE.saeule[0]
    if (zahl[s] > 0) zahl[s]--
    saeulen.push(s)
    letzte = s
  }
  let hookVorher = vorher.at(-1)?.hook_stil ?? null
  const benutzt = {}
  return saeulen.map((s) => {
    let h
    const moeglich = WERTE.hook_stil.filter((x) => x !== hookVorher)
    if (rng() < epsilon) {
      h = [...moeglich].sort((a, b) => ((st?.merkmale?.hook_stil?.[a]?.n || 0) + (benutzt[a] || 0)) - ((st?.merkmale?.hook_stil?.[b]?.n || 0) + (benutzt[b] || 0)))[0]
    } else {
      const s2 = summe(moeglich.map((x) => gh[x]))
      let r = rng() * s2
      h = moeglich.find((x) => (r -= gh[x]) <= 0) || moeglich.at(-1)
    }
    benutzt[h] = (benutzt[h] || 0) + 1
    hookVorher = h
    return { saeule: s, hook_stil: h }
  })
}

/** Beste und schwächste Beiträge nach Wachstumswert (für Neuschreiben und Bericht). */
export function rangliste(beob, { oben = 5, unten = 3 } = {}) {
  const s = [...beob].sort((a, b) => b.wert - a.wert)
  return { beste: s.slice(0, oben), schwaechste: s.length > oben ? s.slice(-unten).reverse() : [] }
}

// ---------------------------------------------------------------- Lauf

export function aktualisiere({ messwerte, params, jetzt = new Date() }) {
  const beob = beobachtungen(messwerte, { jetzt })
  const { gewichte, aenderungen, statistik: st } = berechneGewichte(beob, params.gewichte || {})
  const neu = { ...params, gewichte: { ...gewichte, stand: berlin(jetzt).datum, stichprobe: beob.length } }
  return { params: neu, eintrag: { datum: berlin(jetzt).datum, stichprobe: beob.length, gesamtmittel: st.gesamt, aenderungen } }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const trocken = process.argv.includes('--trocken')
  const lies = (f, d) => (fs.existsSync(path.join(ROOT, f)) ? JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')) : d)
  const params = lies('plan/params.json', {})
  const messwerte = lies('data/messwerte.json', { konto: [], beitraege: {} })
  const { params: neu, eintrag } = aktualisiere({ messwerte, params })
  console.log(`Optimierer ${eintrag.datum}: ${eintrag.stichprobe} gemessene Beiträge, Gesamtmittel ${eintrag.gesamtmittel}`)
  if (!eintrag.aenderungen.length) console.log(eintrag.stichprobe < EINSTELLUNGEN.minGesamt ? `Zu wenig Daten (mindestens ${EINSTELLUNGEN.minGesamt} je Merkmal), Gewichte bleiben.` : 'Keine Änderung.')
  for (const a of eintrag.aenderungen) console.log(`- ${a.merkmal} ${a.wert}: ${a.von ?? '–'} → ${a.nach} (n=${a.n}, Mittel ${a.mittel ?? '–'})`)
  if (!trocken) {
    fs.writeFileSync(path.join(ROOT, 'plan/params.json'), JSON.stringify(neu, null, 2) + '\n')
    const verlauf = lies('data/optimierer-verlauf.json', [])
    verlauf.push(eintrag)
    fs.writeFileSync(path.join(ROOT, 'data/optimierer-verlauf.json'), JSON.stringify(verlauf.slice(-104), null, 1) + '\n')
  }
}
