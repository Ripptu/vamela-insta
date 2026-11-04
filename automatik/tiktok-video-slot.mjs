// Ist jetzt ein Video dran? Gibt „ja“ oder nichts aus. Slots (Berlin): 09:40 (1. Video) und 16:40 (2. Video); jeder gilt bis 8 h danach.
// Ein Slot ist offen, wenn die Zeit erreicht ist und heute (Berliner Datum) noch nicht so viele Videos gepostet wurden, und der letzte
// Videopost mindestens 100 min her ist. So holt der dichte Cron verpasste Läufe nach, ohne doppelt zu posten.
import fs from 'node:fs'
const liste = fs.existsSync('data/tiktok-videos.json') ? JSON.parse(fs.readFileSync('data/tiktok-videos.json', 'utf8')) : []
const t = Object.fromEntries(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((p) => [p.type, p.value]))
const datum = `${t.year}-${t.month}-${t.day}`, jetzt = +t.hour * 60 + +t.minute
const heute = liste.filter((v) => new Date(v.datum).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }) === datum && /published|SEND_TO_USER_INBOX|PUBLISH_COMPLETE/i.test(v.status || ''))
const letzter = liste.length ? Math.max(...liste.map((v) => new Date(v.datum).getTime())) : 0
const slots = [9 * 60 + 40, 16 * 60 + 40]
const offen = slots.filter((s) => jetzt >= s && jetzt <= s + 480).length
process.stdout.write(heute.length < offen && Date.now() - letzter >= 100 * 60000 ? 'ja' : '')
