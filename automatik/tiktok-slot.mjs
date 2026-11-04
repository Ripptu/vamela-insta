// Welcher Slot ist jetzt dran? (Workflow TikTok-Karussell, Vorab-Job mit schmalem Checkout.) Gibt die Slot-ID aus oder nichts.
// Ein Slot ist dran, wenn er in plan/tiktok-plan.json aktiv ist, die Berliner Uhrzeit höchstens 8 h nach (oder 20 min vor) der
// Sollzeit liegt und für diesen Slot heute noch kein Post im Protokoll steht (siehe Aufholen unten).
// Aufruf: node automatik/tiktok-slot.mjs [--slot <id>]   (mit --slot: nur prüfen, ob dieser Slot heute schon gepostet hat)
import fs from 'node:fs'
const plan = JSON.parse(fs.readFileSync('plan/tiktok-plan.json', 'utf8'))
const log = fs.existsSync('data/tiktok-karussell.json') ? JSON.parse(fs.readFileSync('data/tiktok-karussell.json', 'utf8')) : { posts: [] }
const teile = Object.fromEntries(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((p) => [p.type, p.value]))
const datum = `${teile.year}-${teile.month}-${teile.day}`, jetzt = +teile.hour * 60 + +teile.minute
const schon = (id) => log.posts.some((p) => p.slot === id && new Date(p.am).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }) === datum)
const i = process.argv.indexOf('--slot')
if (i > 0) { const id = process.argv[i + 1]; process.stdout.write(schon(id) ? '' : id); process.exit(0) }
// Aufholen: GitHub lässt geplante Läufe oft ausfallen oder startet sie Stunden zu spät. Ein Slot ist deshalb bis zu 8 h nach der
// Sollzeit noch dran, der früheste verpasste zuerst, und nur, wenn der letzte Post mindestens 100 min her ist (kein Stoß am Abend).
const letzter = log.posts.length ? Math.max(...log.posts.map((p) => new Date(p.am).getTime())) : 0
const abstandOk = Date.now() - letzter >= 100 * 60000
const faellig = plan.slots.filter((s) => { const [h, m] = s.uhrzeit.split(':').map(Number); const d = jetzt - (h * 60 + m); return s.aktiv && d >= -20 && d <= 480 && !schon(s.id) })
  .sort((a, b) => a.uhrzeit.localeCompare(b.uhrzeit))
const slot = abstandOk ? faellig[0] : null
process.stdout.write(slot?.id || '')
