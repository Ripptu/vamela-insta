// Hält den Puffer gefüllt: produziert nach, prüft, wiederholt bis genug geprüfte Beiträge da sind.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { ladeQueue, speichereQueue } from './queue.mjs'
import { zaehlePuffer, verjaehrte } from './puffer-zaehlen.mjs'

const params = JSON.parse(fs.readFileSync(new URL('../plan/params.json', import.meta.url), 'utf8'))
// In Actions nach jedem Schritt speichern, damit ein Abbruch keine Arbeit kostet (sichern.mjs führt parallele Änderungen zusammen)
const sichern = () => {
  if (!process.env.GITHUB_ACTIONS) return
  try { execFileSync('node', ['automatik/sichern.mjs', 'Produktion: Zwischenstand', 'plan', 'out', 'data', 'docs'], { stdio: 'inherit' }) } catch (e) { console.log('Zwischenspeichern fehlgeschlagen: ' + e.message) }
}
const run = (args) => {
  let code = 0
  try { execFileSync('node', args, { stdio: 'inherit' }) } catch (e) { code = e.status ?? 1; console.log(`Schritt ${args.join(' ')} endete mit Code ${code}`) }
  sichern()
  return code
}
const zaehle = async () => zaehlePuffer(await ladeQueue(), params)

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
for (let runde = 1; runde <= 14; runde++) {
  const z = await zaehle()
  console.log(`Runde ${runde}: Feed ${z.feed}/${params.puffer_min}, Stories ${z.stories}/6, ungeprüft ${z.neu}`)
  if (z.neu) {
    if (run(['automatik/qa-lauf.mjs', '--max', '16']) === 3) { console.log('Prüf-Agent nicht erreichbar, Abbruch (kein Fortschritt).'); break }
    continue
  }
  if (z.feed >= params.puffer_min && z.stories >= 6) break
  let neuProduziert = false
  // Exit-Code 4: für den Typ ist noch kein Renderer konfiguriert (Gestaltung nicht gewählt). Dann nicht weiter versuchen.
  const codes = []
  if (z.feed < params.puffer_min) {
    codes.push(run(['automatik/produce.mjs', '--typ', 'karussell', '--anzahl', '3']))
    if (params.reels_aktiv) codes.push(run(['automatik/produce.mjs', '--typ', 'reel', '--anzahl', '3']))
    neuProduziert = true
  }
  if (params.stories_aktiv !== false && z.stories < 6) { codes.push(run(['automatik/produce.mjs', '--typ', 'story', '--anzahl', '3'])); neuProduziert = true }
  if (codes.length && codes.every((c) => c === 4)) { console.log('Kein Renderer konfiguriert (Gestaltung noch nicht gewählt), Abbruch.'); break }
  const nachher = await zaehle()
  if (!nachher.neu && neuProduziert) { console.log('Nichts Neues produzierbar (Vorrat leer oder Renderer fehlt?), Abbruch.'); break }
}
const z = await zaehle()
console.log(`Ende: Feed ${z.feed} nutzbar, Stories ${z.stories}`)
if (z.feed < params.puffer_min) console.log('HINWEIS: Vorrat erschöpft oder Prüfung lehnt ab. Neue Inhalte nötig (neu-schreiben.mjs).')
