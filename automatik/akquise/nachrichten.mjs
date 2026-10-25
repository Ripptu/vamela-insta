// Läuft mit jedem Veröffentlichen-Lauf (alle 15 Minuten):
//  1. Jeder neue Kommentar unter den eigenen Beiträgen der letzten 7 Tage bekommt eine private Antwort-DM (Danke + kostenloser
//     Entwurf). Pro Person höchstens einmal, nicht auf eigene Kommentare, nicht auf Spam. Erlaubt über die API (Private Replies).
//  2. Neue Nachrichten in den Instagram-Direktnachrichten werden gesammelt; vorschlaege.mjs meldet sie mit Antwortvorschlag
//     per Telegram. Antwortet ein angeschriebener Lead, ist er erledigt (kein Nachfassen mehr).
// Braucht einen Instagram-Token mit instagram_business_manage_comments und instagram_business_manage_messages.
// Fehlt eine Berechtigung, wird das gemeldet und übersprungen; Veröffentlichen bleibt unberührt.
import fs from 'node:fs'
import { lade, speichere } from './daten.mjs'

const API = `https://graph.instagram.com/${process.env.IG_API_VERSION || 'v25.0'}`
const TOKEN = process.env.IG_ACCESS_TOKEN || ''
const UID = process.env.IG_USER_ID || ''
const EIGEN = (process.env.IG_USERNAME || 'vamela.de').toLowerCase()
const log = (...a) => console.log(new Date().toISOString(), ...a)
const SPAM = /https?:\/\/|www\.|promo|collab|dm (me|us)|send (pic|photo)|followers|crypto|bitcoin|investment|giveaway|onlyfans/i

async function get(pfad, params = {}) {
  const u = new URL(`${API}/${pfad}`)
  for (const [k, v] of Object.entries({ ...params, access_token: TOKEN })) u.searchParams.set(k, v)
  const r = await fetch(u, { signal: AbortSignal.timeout(30000) })
  const j = await r.json().catch(() => ({}))
  if (j.error) { const e = new Error(j.error.message || 'Instagram-Fehler'); e.code = j.error.code; throw e }
  return j
}
async function post(pfad, body) {
  const r = await fetch(`${API}/${pfad}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })
  const j = await r.json().catch(() => ({}))
  if (j.error) { const e = new Error(j.error.message || 'Instagram-Fehler'); e.code = j.error.code; throw e }
  return j
}

const kommentarDm = (name) => `Danke für deinen Kommentar${name ? ', ' + name : ''}! Falls du für deinen Betrieb gerade über eine neue Website nachdenkst: Ich mach dir gern einen kostenlosen Entwurf, ganz unverbindlich. Schreib mir einfach kurz, was du machst und wo. Christian von VAMELA`

if (!TOKEN || !UID || !process.env.AKQUISE_KEY) { log('Akquise-Nachrichten: Token, Konto oder AKQUISE_KEY fehlt, übersprungen.'); process.exit(0) }
const z = lade()
let geaendert = false

// 1. Kommentare
try {
  const seit = Date.now() - 7 * 864e5
  const medien = (await get(`${UID}/media`, { fields: 'id,timestamp', limit: 25 })).data || []
  for (const m of medien.filter((x) => new Date(x.timestamp).getTime() >= seit)) {
    const kom = (await get(`${m.id}/comments`, { fields: 'id,text,username,timestamp', limit: 50 })).data || []
    for (const k of kom) {
      if (z.kommentare_erledigt.includes(k.id)) continue
      z.kommentare_erledigt.push(k.id); geaendert = true
      const user = String(k.username || '').toLowerCase()
      if (!user || user === EIGEN || SPAM.test(k.text || '') || z.kommentar_dm[user]) continue
      try {
        await post(`${UID}/messages`, { recipient: { comment_id: k.id }, message: { text: kommentarDm('') } })
        z.kommentar_dm[user] = new Date().toISOString()
        log(`Kommentar-DM an @${user}`)
      } catch (e) { log(`Kommentar-DM an @${user} nicht gesendet: ${e.message}`) }
    }
  }
} catch (e) { log(`Kommentare nicht lesbar (${e.message}). Fehlt die Berechtigung instagram_business_manage_comments?`) }

// 2. Neue Direktnachrichten
try {
  const konv = (await get(`${UID}/conversations`, { platform: 'instagram', fields: 'id,updated_time', limit: 20 })).data || []
  const igLeads = new Map(Object.values(z.leads).filter((l) => l.ig).map((l) => [l.ig, l]))
  for (const c of konv) {
    const msgs = (await get(c.id, { fields: 'messages.limit(5){id,from,message,created_time}' })).messages?.data || []
    for (const msg of msgs) {
      if (z.nachrichten_gesehen.includes(msg.id)) continue
      z.nachrichten_gesehen.push(msg.id); geaendert = true
      const von = String(msg.from?.username || '').toLowerCase()
      if (!von || von === EIGEN || !msg.message) continue
      const lead = igLeads.get(von)
      if (lead && !lead.antwort_am) lead.antwort_am = new Date().toISOString()
      z.vorschlaege_offen.push({ von, text: msg.message.slice(0, 1500), lead: lead ? lead.name : null, am: msg.created_time })
    }
  }
} catch (e) { log(`Nachrichten nicht lesbar (${e.message}). Fehlt die Berechtigung instagram_business_manage_messages?`) }

if (geaendert || z.vorschlaege_offen.length) speichere(z)
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `vorschlaege=${z.vorschlaege_offen.length ? 'true' : 'false'}\n`)
log(`Akquise-Nachrichten: ${z.vorschlaege_offen.length} neue Nachrichten für Vorschläge`)
