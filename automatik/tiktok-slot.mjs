// Welcher Slot ist jetzt dran? (Workflow TikTok-Karussell, Vorab-Job mit schmalem Checkout.) Gibt die Slot-ID aus oder nichts.
// Ein Slot ist dran, wenn er in plan/tiktok-plan.json aktiv ist, die Berliner Uhrzeit höchstens 75 min nach (oder 20 min vor) der
// Sollzeit liegt (GitHub startet geplante Läufe oft verspätet) und für diesen Slot heute noch kein Post im Protokoll steht.
// Aufruf: node automatik/tiktok-slot.mjs [--slot <id>]   (mit --slot: nur prüfen, ob dieser Slot heute schon gepostet hat)
import fs from 'node:fs'
const plan = JSON.parse(fs.readFileSync('plan/tiktok-plan.json', 'utf8'))
const log = fs.existsSync('data/tiktok-karussell.json') ? JSON.parse(fs.readFileSync('data/tiktok-karussell.json', 'utf8')) : { posts: [] }
const teile = Object.fromEntries(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((p) => [p.type, p.value]))
const datum = `${teile.year}-${teile.month}-${teile.day}`, jetzt = +teile.hour * 60 + +teile.minute
const schon = (id) => log.posts.some((p) => p.slot === id && new Date(p.am).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }) === datum)
const i = process.argv.indexOf('--slot')
if (i > 0) { const id = process.argv[i + 1]; process.stdout.write(schon(id) ? '' : id); process.exit(0) }
const slot = plan.slots.find((s) => { const [h, m] = s.uhrzeit.split(':').map(Number); const d = jetzt - (h * 60 + m); return s.aktiv && d >= -20 && d <= 75 && !schon(s.id) })
process.stdout.write(slot?.id || '')
