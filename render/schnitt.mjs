// Schnittplan für die Sprech-Reels (render/reel.mjs): reine Rechnung ohne Browser, damit sie testbar ist.
//
// Regeln („krass gut geschnitten“, Christian 12.10.2026):
//   - harter Schnitt auf jede Satzgrenze (aus den Wortzeiten): jeder Satz bekommt seine Szene
//   - innerhalb einer Szene alle ~1,2–2 s ein Bewegungswechsel (harter Schnitt auf einen anderen Ausschnitt bzw. eine
//     andere Kamerabewegung desselben Bildes), Ken-Burns/Push-in mit leichtem Ease
//   - Punch-Zoom ≈ 1,08× für 150 ms auf Schlüsselwörter, ein kleiner „Einschlag“ (1,05×) auf jedem Satzanfang
//   - Untertitel wortgenau: 1–4 Wörter je Einblendung, Umbruch an Satzzeichen, aktuelles Wort hervorgehoben
//   - Hook groß in den ersten 2 s, Abschlusskarte in den letzten 1,5 s
// Funktionen mit „// im Browser“ laufen auch in der Seite (reel.mjs fügt sie per toString() ein), deshalb ohne Importe.
import { ohneMarkup, woerter as markupWoerter, saetze } from './orange.mjs'

export const FPS = 30
export const ENDKARTE_S = 1.5
export const HOOK_S = 2.1
export const NACHLAUF_S = 0.5
export const SHOT = { min: 1.2, ziel: 1.6, max: 2.0 }
export const PUNCH = { staerke: 0.08, dauer: 0.15 }
export const EINSCHLAG = { staerke: 0.05, dauer: 0.22 }
export const UT = { maxWoerter: 4, maxZeichen: 18 }

/** Kamerabewegungen eines Shots (Start → Ende); Ursprung in Prozent, Verschiebung in px bei 1080 × 1920. */
export const BEWEGUNGEN = {
  push: { s: [1.04, 1.14], x: [0, 0], y: [0, 0], ox: 50, oy: 62 },
  zurueck: { s: [1.18, 1.07], x: [0, 0], y: [0, 0], ox: 50, oy: 58 },
  rechts: { s: [1.15, 1.17], x: [-46, 46], y: [0, 0], ox: 50, oy: 60 },
  links: { s: [1.17, 1.15], x: [46, -46], y: [0, 0], ox: 50, oy: 60 },
  hoch: { s: [1.14, 1.16], x: [0, 0], y: [60, -40], ox: 50, oy: 60 },
  nah: { s: [1.32, 1.42], x: [0, 0], y: [0, 0], ox: 50, oy: 70 },
}
export const FOLGE = ['push', 'rechts', 'nah', 'zurueck', 'hoch', 'links']
/** Bildschirmaufnahmen: durchgehender Scroll, Schnitte wechseln nur den Ausschnitt (ganz bzw. näher). */
export const AUFNAHME_ZOOM = [1, 1.1]

// im Browser
export function ease(p) { p = Math.min(1, Math.max(0, p)); return -(Math.cos(Math.PI * p) - 1) / 2 }
// im Browser
export function bewegungAuf(b, p) {
  const e = ease(p)
  const lin = (a) => a[0] + (a[1] - a[0]) * e
  return { s: lin(b.s), x: lin(b.x), y: lin(b.y), ox: b.ox, oy: b.oy }
}
// im Browser
export function punchFaktor(t, punches) {
  let f = 1
  for (const p of punches) {
    const d = t - p.t
    if (d < 0 || d > p.dauer) continue
    const q = d / p.dauer
    f = Math.max(f, 1 + p.staerke * (1 - (1 - Math.pow(1 - q, 3))))
  }
  return f
}

const norm = (w) => String(w || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const FUELL = new Set(['nicht', 'deinen', 'deiner', 'deinem', 'einfach', 'herunter', 'sondern', 'zeichnet', 'speicher', 'schick', 'wirklich'])

/**
 * Schlüsselwörter für Punch-Zooms: im Sprechtext markierte Wörter (*…*, _…_, ==…==); ohne Markup je Satz das längste
 * Wort ab 7 Buchstaben (kein Füllwort, nicht das erste Wort des Satzes). Rückgabe: Set der Wortpositionen (0-basiert).
 */
export function schluesselwoerter(sprechtext) {
  const positionen = new Set()
  const ws = markupWoerter(sprechtext)
  if (ws.some((x) => x.st)) { ws.forEach((x, i) => { if (x.st) positionen.add(i) }); return positionen }
  let i = 0
  for (const satz of saetze(ohneMarkup(sprechtext))) {
    const teile = satz.split(/\s+/).filter(Boolean)
    let best = -1, laenge = 6
    teile.forEach((w, k) => { const n = norm(w); if (k > 0 && n.length > laenge && !FUELL.has(n)) { best = i + k; laenge = n.length } })
    if (best >= 0) positionen.add(best)
    i += teile.length
  }
  return positionen
}

/** Untertitel-Stücke: 1–4 Wörter, höchstens ~18 Zeichen, neues Stück nach Satzzeichen und an jeder Satzgrenze. */
export function untertitelStuecke(woerter, { maxWoerter = UT.maxWoerter, maxZeichen = UT.maxZeichen } = {}) {
  const stuecke = []
  let akt = []
  const zeichen = (l) => l.reduce((s, w) => s + w.wort.length, 0) + Math.max(0, l.length - 1)
  for (let i = 0; i < woerter.length; i++) {
    const w = woerter[i]
    if (akt.length && (akt.length >= maxWoerter || zeichen([...akt, w]) > maxZeichen || akt.at(-1).satz !== w.satz)) { stuecke.push(akt); akt = [] }
    akt.push({ ...w, i })
    if (/[,;:.!?…]$/.test(w.wort)) { stuecke.push(akt); akt = [] }
  }
  if (akt.length) stuecke.push(akt)
  return stuecke.map((ws, k) => {
    const naechster = stuecke[k + 1]?.[0]?.start
    const bis = naechster != null ? naechster : ws.at(-1).ende + 0.35
    return { von: ws[0].start, bis: Math.max(bis, ws[0].start + 0.2), woerter: ws }
  })
}

/** Shots einer Szene [von, bis): Anzahl so, dass jeder 1,2–2 s dauert; Bewegungen im Wechsel ab `start` in FOLGE. */
export function shots(von, bis, start = 0, { aufnahme = false } = {}) {
  const d = bis - von
  let n = Math.max(1, Math.round(d / SHOT.ziel))
  while (n > 1 && d / n < SHOT.min) n--
  while (d / n > SHOT.max) n++
  return Array.from({ length: n }, (_, k) => ({
    von: von + (d * k) / n, bis: von + (d * (k + 1)) / n,
    ...(aufnahme ? { zoom: AUFNAHME_ZOOM[k % AUFNAHME_ZOOM.length] } : { bewegung: FOLGE[(start + k) % FOLGE.length] }),
  }))
}

/**
 * Gesamter Schnittplan.
 *   woerter: [{ wort, satz, start, ende }] (render/wortzeiten.mjs), dauerAudio: Sekunden, szenen: Liste (je Satz eine,
 *   Art 'bild'|'aufnahme'), sprechtext für die Schlüsselwörter.
 * Rückgabe: { T, frames, szenen: [{ satz, quelle, von, bis, aufnahme, shots }], hook, endkarte, stuecke, punches }
 */
export function schnittplan({ woerter, dauerAudio, szenen, sprechtext }) {
  if (!woerter.length) throw new Error('keine Wortzeiten')
  const T = Math.round(Math.max(dauerAudio, woerter.at(-1).ende) * FPS + NACHLAUF_S * FPS) / FPS
  const endVon = T - ENDKARTE_S
  const anzahlSaetze = woerter.at(-1).satz + 1
  const satzStart = Array.from({ length: anzahlSaetze }, (_, s) => woerter.find((w) => w.satz === s)?.start ?? 0)
  const plan = []
  let folge = 0
  for (let s = 0; s < anzahlSaetze; s++) {
    // Schnitt zwei Frames vor dem ersten Wort: das Bild steht, wenn das Wort kommt
    const von = s === 0 ? 0 : Math.max(plan.at(-1)?.von ?? 0, satzStart[s] - 2 / FPS)
    const bis = s + 1 < anzahlSaetze ? Math.max(von, satzStart[s + 1] - 2 / FPS) : endVon
    if (bis - von < 0.25 || von >= endVon) { if (plan.length) plan.at(-1).bis = Math.min(endVon, Math.max(plan.at(-1).bis, bis)); continue }
    const quelle = szenen.length ? s % szenen.length : 0
    const aufnahme = szenen[quelle]?.art === 'aufnahme'
    const b = Math.min(bis, endVon)
    plan.push({ satz: s, quelle, von, bis: b, aufnahme, shots: shots(von, b, folge, { aufnahme }) })
    folge += plan.at(-1).shots.length
  }
  // Lücken schließen: jede Szene läuft bis zur nächsten
  for (let k = 0; k + 1 < plan.length; k++) { plan[k].bis = plan[k + 1].von; plan[k].shots.at(-1).bis = plan[k].bis }
  if (plan.length) { plan.at(-1).bis = endVon; plan.at(-1).shots.at(-1).bis = endVon }
  const schluessel = schluesselwoerter(sprechtext)
  const punches = [
    ...plan.slice(1).map((p) => ({ t: p.von, ...EINSCHLAG })),
    ...woerter.map((w, i) => (schluessel.has(i) && w.start < endVon ? { t: w.start, ...PUNCH } : null)).filter(Boolean),
  ].sort((a, b) => a.t - b.t)
  const stuecke = untertitelStuecke(woerter).map((st) => ({ ...st, woerter: st.woerter.map((w) => ({ ...w, schluessel: schluessel.has(w.i) })) })).filter((st) => st.von < endVon)
  if (stuecke.length) stuecke.at(-1).bis = Math.min(stuecke.at(-1).bis, endVon)
  return { T, frames: Math.round(T * FPS), szenen: plan, hook: { von: 0, bis: Math.min(HOOK_S, endVon) }, endkarte: { von: endVon, bis: T }, stuecke, punches }
}

/** Zeitpunkte für die Gestaltungsprüfung: Hook, Mitte jeder Szene, jedes Untertitel-Stück mit dem längsten Text, Endkarte. */
export function stichproben(plan) {
  const t = new Map()
  t.set('Hook', Math.min(plan.hook.bis - 0.1, 0.9))
  for (const sz of plan.szenen) t.set(`Szene ${sz.satz + 1}`, (sz.von + sz.bis) / 2)
  const lang = [...plan.stuecke].sort((a, b) => b.woerter.map((w) => w.wort).join(' ').length - a.woerter.map((w) => w.wort).join(' ').length).slice(0, 3)
  for (const st of lang) t.set(`Untertitel „${st.woerter.map((w) => w.wort).join(' ')}“`, st.woerter.at(-1).start + 0.02)
  t.set('Endkarte', plan.T - 0.4)
  return [...t].map(([name, zeit]) => ({ name, zeit: Math.max(0, Math.min(plan.T - 1 / FPS, zeit)) }))
}
