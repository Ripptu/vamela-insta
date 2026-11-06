// Ersetzt bei Zernio geplante Karussells, die noch mit altem Hook und altem Bild gebaut wurden (Christian, 06.11.2026: „Ja, ersetzen“).
// Löscht nur Posts, die nachweislich noch nicht raus sind, und nimmt sie aus dem Log, damit der nächste Lauf den Slot neu baut.
// Sicherungen: nur Einträge ohne `cover_gross` (alter Generator), Termin mindestens 30 Minuten voraus, Status jedes Teils `scheduled`.
// Zernio-Doku: DELETE entfernt auch den Datensatz veröffentlichter Einträge, deshalb wird der Status vorher einzeln geprüft.
// Ohne --echt nur Anzeige. Aufruf: node automatik/tiktok-ersetzen.mjs [--echt]
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const LOG = path.join(ROOT, 'data/tiktok-karussell.json')
const Z = 'https://zernio.com/api/v1'
const key = process.env.ZERNIO_API_KEY
if (!key) { console.log('ZERNIO_API_KEY fehlt.'); process.exit(1) }
const echt = process.argv.includes('--echt')
const VORLAUF_MS = 30 * 60000
const berlin = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' }).format(d).replace(' ', 'T')
const anfrage = async (pfad, opt = {}) => {
  const r = await fetch(Z + pfad, { ...opt, headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(60000) })
  return { status: r.status, j: await r.json().catch(() => ({})) }
}
const statusVon = (j) => (j.post || j).status

const log = JSON.parse(fs.readFileSync(LOG, 'utf8'))
const grenze = berlin(new Date(Date.now() + VORLAUF_MS))
const kandidaten = log.posts.filter((p) => p.geplant_fuer && p.geplant_fuer >= grenze && !('cover_gross' in p) && p.zernio_id)
console.log(`${echt ? 'ECHT' : 'Nur Anzeige'}: ${kandidaten.length} Posts ab ${grenze}`)
let ersetzt = 0, fehler = 0
for (const p of kandidaten) {
  const ids = [['TikTok', p.zernio_id], ['Instagram', p.instagram?.zernio_id], ['Story', p.instagram?.story_zernio_id]].filter(([, id]) => id)
  const stand = []
  for (const [art, id] of ids) { const r = await anfrage(`/posts/${id}`); stand.push({ art, id, http: r.status, status: statusVon(r.j) }) }
  console.log(`${p.geplant_fuer} „${p.hook}“: ${stand.map((s) => `${s.art} ${s.http}/${s.status}`).join(', ')}`)
  if (stand.some((s) => s.http !== 200 || s.status !== 'scheduled')) { console.log('  bleibt: nicht alle Teile sind sicher noch geplant'); fehler++; continue }
  if (!echt) continue
  const reste = []
  for (const s of stand) { const r = await anfrage(`/posts/${s.id}`, { method: 'DELETE' }); if (r.status >= 300) { reste.push(`${s.art} HTTP ${r.status} ${JSON.stringify(r.j).slice(0, 120)}`) } }
  if (reste.length) { console.log(`  FEHLER beim Löschen, Eintrag bleibt im Log: ${reste.join('; ')}`); fehler++; continue }
  log.posts = log.posts.filter((x) => x !== p)
  log.heros = (log.heros || []).filter((h) => h !== p.hero) // Bild ging nie raus, zurück in den Vorrat
  ersetzt++
  console.log('  gelöscht, Slot wird neu gebaut')
  fs.writeFileSync(LOG, JSON.stringify(log, null, 2) + '\n')
}
console.log(`Fertig: ${ersetzt} ersetzt, ${fehler} Probleme`)
process.exit(fehler ? 1 : 0)
