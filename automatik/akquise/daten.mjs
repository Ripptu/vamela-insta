// Zustand der Akquise (Leads, gesendete DMs, Kommentar-DMs, gelesene Nachrichten) in data/akquise.enc.
// Das Repo ist öffentlich, deshalb verschlüsselt (AES-256-GCM, Schlüssel aus dem Secret AKQUISE_KEY).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname)
export const DATEI = path.join(ROOT, 'data/akquise.enc')

const LEER = () => ({ chat_id: null, pool_am: null, pool: [], leads: {}, kommentar_dm: {}, kommentare_erledigt: [], nachrichten_gesehen: [], vorschlaege_offen: [], letzte_liste: null })

function schluessel() {
  const k = process.env.AKQUISE_KEY
  if (!k || k.length < 20) throw new Error('AKQUISE_KEY fehlt (Secret im Repo).')
  return crypto.scryptSync(k, 'vamela-akquise', 32)
}

export function lade() {
  if (!fs.existsSync(DATEI)) return LEER()
  const j = JSON.parse(fs.readFileSync(DATEI, 'utf8'))
  const d = crypto.createDecipheriv('aes-256-gcm', schluessel(), Buffer.from(j.iv, 'base64'))
  d.setAuthTag(Buffer.from(j.tag, 'base64'))
  return { ...LEER(), ...JSON.parse(Buffer.concat([d.update(Buffer.from(j.data, 'base64')), d.final()]).toString('utf8')) }
}

export function speichere(z) {
  // Listen begrenzen, damit die Datei nicht endlos wächst
  z.kommentare_erledigt = z.kommentare_erledigt.slice(-3000)
  z.nachrichten_gesehen = z.nachrichten_gesehen.slice(-3000)
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', schluessel(), iv)
  const data = Buffer.concat([c.update(JSON.stringify(z), 'utf8'), c.final()])
  fs.mkdirSync(path.dirname(DATEI), { recursive: true })
  fs.writeFileSync(DATEI, JSON.stringify({ iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') }))
}
