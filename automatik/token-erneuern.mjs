// Erneuert das Instagram-Token (verschlüsselt in data/ig-token.enc). Wöchentlich per Workflow.
import { erneuereToken } from './instagram.mjs'
const r = await erneuereToken()
// Das Token selbst wird nie ausgegeben, nur Zeitpunkte.
const tage = r.ablaufAm ? Math.round((new Date(r.ablaufAm) - Date.now()) / 864e5) : null
console.log(`Token erneuert am ${r.erneuertAm}, gültig bis ${r.ablaufAm ?? 'unbekannt'} (in ${tage ?? '?'} Tagen). Verschlüsselt gespeichert in data/ig-token.enc.`)
