// Hält den Puffer gefüllt: repariert abgelehnte Beiträge, produziert nach, prüft, wiederholt bis genug geprüfte Beiträge da sind.
//
// Eine Runde: 1. reparieren.mjs, wenn reparierbare Ablehnungen existieren (repariert werden sie sofort neu gerendert),
//             2. ungeprüfte Beiträge prüfen (qa-lauf.mjs), 3. fehlt noch Puffer: nachproduzieren.
// Damit läuft Reparieren → Rendern → Prüfen mehrfach hintereinander, bis alles durch ist, aufgegeben wurde oder die Zeit knapp wird.
//
// Sicher beenden (keine Endlosschleife):
//  - Zeitbudget: FILL_BUDGET_MIN Minuten (Standard 80) ab Start; danach beginnt keine Runde mehr, Reparatur und Prüfung bekommen
//    die Frist als --bis und starten dann keinen neuen Beitrag. Der Workflow produzieren.yml hat 120 Minuten Zeitlimit; in den
//    Minuten davor laufen Fakten-Abgleich und Vorrat.
//  - höchstens FILL_MAX_RUNDEN Runden (Standard 60),
//  - Reparaturen sind je Beitrag auf 3 begrenzt (automatik/reparatur-historie.mjs), danach „aufgegeben“,
//  - ein Reparaturlauf, der nichts verändert hat (Claude weg, GitHub nicht erreichbar), wird in diesem Lauf nicht wiederholt,
//  - Exit-Code 3 der Prüfung (Claude nicht erreichbar) beendet die Schleife.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { ladeQueue, speichereQueue } from './queue.mjs'
import { zaehlePuffer, verjaehrte } from './puffer-zaehlen.mjs'
import { ladeHistorie } from './reparatur-historie.mjs'

const params = JSON.parse(fs.readFileSync(new URL('../plan/params.json', import.meta.url), 'utf8'))
const START = Date.now()
const BUDGET_MS = (+process.env.FILL_BUDGET_MIN || 80) * 60_000
const FRIST = START + BUDGET_MS
const MAX_RUNDEN = +process.env.FILL_MAX_RUNDEN || 60
/** Weniger Zeit als das: keine neue Runde mehr. */
const MINDEST_RUNDE_MS = 6 * 60_000
const minuten = (ms) => Math.round(ms / 60_000)

// In Actions nach jedem Schritt speichern, damit ein Abbruch keine Arbeit kostet (sichern.mjs führt parallele Änderungen zusammen)
const sichern = () => {
  if (!process.env.GITHUB_ACTIONS) return
  try { execFileSync('node', ['automatik/sichern.mjs', 'Produktion: Zwischenstand', 'plan', 'out', 'data', 'docs', 'bilder'], { stdio: 'inherit' }) } catch (e) { console.log('Zwischenspeichern fehlgeschlagen: ' + e.message) }
}
const run = (args) => {
  let code = 0
  try { execFileSync('node', args, { stdio: 'inherit' }) } catch (e) { code = e.status ?? 1; console.log(`Schritt ${args.join(' ')} endete mit Code ${code}`) }
  sichern()
  return code
}
const zaehle = async () => zaehlePuffer(await ladeQueue(), params, new Date(), ladeHistorie())
const stand = async () => JSON.stringify([await ladeQueue(), ladeHistorie()])

// Veraltete Freigaben (älter als 21 Tage, bald fällig) erneut prüfen lassen
{
  const q = await ladeQueue()
  const alt = verjaehrte(q)
  if (alt.length) {
    for (const x of alt) { x.status = 'neu'; x.qa = null; x.qa_versuche = 0 }
    await speichereQueue(q)
    console.log(`Freigabe veraltet, neu prüfen: ${alt.map((x) => x.id).join(', ')}`)
  }
}

let reparierenAus = false // Claude weg oder ohne Wirkung: in diesem Lauf nicht noch einmal versuchen
let runde = 1
for (; runde <= MAX_RUNDEN; runde++) {
  if (FRIST - Date.now() < MINDEST_RUNDE_MS) { console.log(`Zeitbudget (${minuten(BUDGET_MS)} min) fast aufgebraucht, keine weitere Runde.`); break }
  const z = await zaehle()
  console.log(`Runde ${runde} (noch ${minuten(FRIST - Date.now())} min): Feed ${z.feed}/${params.puffer_min}, Stories ${z.stories}/6, ungeprüft ${z.neu}, reparierbar ${z.reparierbar}, aufgegeben ${z.aufgegeben}`)

  // 1. Abgelehnte reparieren; was repariert wurde, verschwindet aus der Queue und wird gleich neu gerendert
  if ((z.reparierbar || z.aufzugeben) && !reparierenAus) {
    const vorher = await stand()
    const idsVorher = new Set((await ladeQueue()).map((x) => x.id))
    const code = run(['automatik/reparieren.mjs', '--max', '12', '--parallel', '3', '--bis', String(FRIST - 3 * 60_000)])
    if (code === 3) { console.log('Claude für die Reparatur nicht erreichbar, in diesem Lauf kein Reparaturversuch mehr.'); reparierenAus = true }
    else if (vorher === await stand()) { console.log('Reparatur hat nichts verändert, in diesem Lauf kein weiterer Versuch.'); reparierenAus = true }
    const idsNachher = new Set((await ladeQueue()).map((x) => x.id))
    const entfernt = [...idsVorher].filter((id) => !idsNachher.has(id))
    for (const [kuerzel, typ] of [['k', 'karussell'], ['s', 'story']]) {
      const ids = entfernt.filter((id) => id.startsWith(kuerzel))
      if (ids.length) { console.log(`Neu rendern: ${ids.join(', ')}`); run(['automatik/produce.mjs', '--typ', typ, '--nur', ids.join(',')]) }
    }
    continue
  }

  // 2. Ungeprüfte prüfen
  if (z.neu) {
    if (run(['automatik/qa-lauf.mjs', '--max', '16', '--bis', String(FRIST - 2 * 60_000)]) === 3) { console.log('Prüf-Agent nicht erreichbar, Abbruch (kein Fortschritt).'); break }
    continue
  }
  if (z.feed >= params.puffer_min && z.stories >= 6) break

  // 3. Nachproduzieren
  let neuProduziert = false
  // Exit-Code 4: für den Typ gibt es keinen Renderer (heute nur Reels, der Scroll-Reel-Rekorder fehlt). Dann nicht weiter versuchen.
  const codes = []
  if (z.feed < params.puffer_min) {
    // So viele auf einmal, wie fehlen (3 bis 6): abgelehnte Beiträge brauchen Reserve, und jede Runde kostet Prüfzeit
    const anzahl = String(Math.min(6, Math.max(3, params.puffer_min - z.feed)))
    codes.push(run(['automatik/produce.mjs', '--typ', 'karussell', '--anzahl', anzahl]))
    if (params.reels_aktiv) codes.push(run(['automatik/produce.mjs', '--typ', 'reel', '--anzahl', '3']))
    neuProduziert = true
  }
  if (params.stories_aktiv !== false && z.stories < 6) { codes.push(run(['automatik/produce.mjs', '--typ', 'story', '--anzahl', '3'])); neuProduziert = true }
  if (codes.length && codes.every((c) => c === 4)) { console.log('Kein Renderer für die angeforderten Typen (Reel-Rekorder fehlt), Abbruch.'); break }
  const nachher = await zaehle()
  if (!nachher.neu && neuProduziert) { console.log('Nichts Neues produzierbar (Vorrat leer oder Renderer fehlt?), Abbruch.'); break }
}
if (runde > MAX_RUNDEN) console.log(`Rundengrenze (${MAX_RUNDEN}) erreicht.`)
const z = await zaehle()
console.log(`Ende nach ${minuten(Date.now() - START)} min: Feed ${z.feed} nutzbar, Stories ${z.stories}, ungeprüft ${z.neu}, reparierbar ${z.reparierbar}, aufgegeben ${z.aufgegeben}`)
if (z.feed < params.puffer_min) console.log('HINWEIS: Vorrat erschöpft oder Prüfung lehnt ab. Neue Inhalte nötig (neu-schreiben.mjs).')
