// Prüft alle Beiträge mit Status „neu“ mit dem unabhängigen Prüf-Agenten, mehrere gleichzeitig.
// Aufruf: node automatik/qa-lauf.mjs [--max N] [--parallel P] [--bis <Epoch-ms>]   (--bis: danach keinen neuen Beitrag mehr beginnen)
// Ergebnisse werden je Beitrag in die frisch geladene Queue eingetragen (nie die ganze Queue aus dem Speicher überschreiben)
// und in Actions laufend hochgeladen (automatik/sichern.mjs führt parallele Änderungen zusammen).
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { ladeQueue, speichereQueue } from './queue.mjs'
import { pruefe } from './qa.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const arg = (n, d) => (process.argv.includes(n) ? +process.argv[process.argv.indexOf(n) + 1] : d)
const max = arg('--max', 99)
const parallel = arg('--parallel', 8)
const bis = arg('--bis', Infinity)
const NICHT_DURCHFUEHRBAR = 'Prüfung nicht durchführbar'
const q0 = await ladeQueue()
const todo = q0.filter((x) => x.status === 'neu').slice(0, max)
let n = 0, next = 0, ausfaelle = 0
let kette = Promise.resolve()

const gitSichern = () => {
  if (!process.env.GITHUB_ACTIONS) return
  try { execFileSync('node', ['automatik/sichern.mjs', 'Prüfung: Zwischenstand', 'plan'], { cwd: ROOT, stdio: 'inherit' }) } catch (e) { console.log('Zwischenspeichern fehlgeschlagen: ' + String(e.message).slice(0, 120)) }
}
/** Ergebnis eines Beitrags in die aktuelle Datei schreiben (nur wenn er dort noch „neu“ ist). */
const eintragen = (id, ergebnis) => (kette = kette.then(async () => {
  const q = await ladeQueue()
  const x = q.find((y) => y.id === id)
  if (x && x.status === 'neu') Object.assign(x, ergebnis)
  await speichereQueue(q)
  if (++n % 4 === 0) gitSichern()
}))

const worker = async () => {
  while (next < todo.length && Date.now() < bis) {
    const item = todo[next++]
    let v
    try { v = await pruefe(item, ROOT) } catch (e) { v = { verdikt: 'abgelehnt', gruende: [`${NICHT_DURCHFUEHRBAR}: ${String(e.message).slice(0, 200)}`] } }
    const ausfall = v.gruende?.[0]?.startsWith(NICHT_DURCHFUEHRBAR)
    if (ausfall) {
      // Ausfall der Prüfung (Claude nicht erreichbar, Ratenlimit, Zeitüberschreitung) ist keine Ablehnung des Beitrags:
      // er bleibt „neu“ und wird beim nächsten Lauf geprüft, höchstens dreimal.
      ausfaelle++
      const versuche = (item.qa_versuche || 0) + 1
      console.log(`${item.id}: ${v.gruende[0].slice(0, 200)} (Versuch ${versuche})`)
      // Fiel in diesem Lauf die gesamte Prüfung aus, wird nichts hochgezählt (der Vorrat darf nicht verbrennen)
      const alleFallenAus = () => todo.length && ausfaelle >= Math.min(todo.length, next)
      await eintragen(item.id, alleFallenAus() ? {} : versuche >= 3 ? { qa: { verdikt: 'abgelehnt', gruende: v.gruende, am: new Date().toISOString() }, status: 'abgelehnt', qa_versuche: versuche } : { qa_versuche: versuche })
      continue
    }
    await eintragen(item.id, { qa: { verdikt: v.verdikt, gruende: v.gruende, am: new Date().toISOString() }, status: v.verdikt === 'ok' ? 'geprueft' : 'abgelehnt' })
    console.log(`${item.id} ${item.titel}: ${v.verdikt}${v.gruende.length ? ' – ' + v.gruende.join(' | ') : ''}`)
  }
}
await Promise.all(Array.from({ length: Math.min(parallel, todo.length) }, worker))
await kette
gitSichern()
console.log(`${n} bearbeitet, ${ausfaelle} Ausfälle der Prüfung.`)
// Kein Fortschritt (alles ausgefallen): Fehlercode, damit fill.mjs nicht endlos wiederholt
if (todo.length && ausfaelle === todo.length) process.exit(3)
