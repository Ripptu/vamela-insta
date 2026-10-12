// Gemeinsame Bausteine für das automatische Reparieren abgelehnter Beiträge (automatik/reparieren.mjs):
// Einteilung der Ablehnungsgründe, Zählung der Reparaturversuche und die kleine Historie data/reparaturen.json.
// Nur reine Funktionen und Dateizugriff auf die Historie, kein Netz, kein Claude (damit puffer.mjs, fill.mjs, produce.mjs
// und die Tests sie ohne Nebenwirkung laden können).
//
// Warum eine Historie: Ein repariertes Stück wird aus der Queue entfernt und neu gerendert, damit verschwindet sein Eintrag
// samt Zähler. Die Historie hält fest, wie oft schon repariert wurde (id, Datum, Gründe, Versuch-Nr.); produce.mjs schreibt
// die Zahl als Feld `reparaturen` in den neuen Queue-Eintrag zurück.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
export const HISTORIE_DATEI = path.join(ROOT, 'data', 'reparaturen.json')
/** Nach so vielen Reparaturversuchen ohne Erfolg wird ein Beitrag aufgegeben (Status „aufgegeben“). */
export const MAX_REPARATUREN = 3
/** Ausfall der Prüfung selbst (Claude nicht erreichbar o. Ä.): keine Ablehnung des Beitrags, nicht zu reparieren. */
export const AUSFALL = 'Prüfung nicht durchführbar'
/** Typen, für die es einen Renderer und einen Reparaturweg gibt (Reels: Rekorder fehlt noch). */
export const REPARIERBARE_TYPEN = ['karussell', 'story']

/**
 * Art der Ablehnung nach ihren Gründen:
 *  - 'ausfall'     mindestens ein Grund „Prüfung nicht durchführbar“ (nicht reparieren, qa-lauf wiederholt die Prüfung)
 *  - 'format'      nur „Format: …“ (Datei fehlt, falsche Größe): neu rendern genügt
 *  - 'gestaltung'  nur „GESTALTUNG: …“ (und Format): Renderer-Prüfung durchgefallen, Texte kürzen und neu rendern
 *  - 'inhalt'      alles andere (REPO, MEHRWERT, SPRACHE, FAKTEN …), auch gemischt: Block inhaltlich korrigieren
 *  - 'leer'        keine Gründe (nichts, woran man reparieren könnte)
 */
export function gruendeArt(gruende) {
  const g = (gruende || []).map(String)
  if (!g.length) return 'leer'
  if (g.some((x) => x.startsWith(AUSFALL))) return 'ausfall'
  if (g.every((x) => /^Format:/.test(x))) return 'format'
  if (g.every((x) => /^(GESTALTUNG|Format):/.test(x))) return 'gestaltung'
  return 'inhalt'
}

/** Gründe, die nach der Regelkorrektur für Stories keine mehr sind (Stories haben keine Caption, siehe qa/regeln.md). */
export function veralteteStoryGruende(item) {
  if (item?.typ !== 'story') return []
  const g = item.qa?.gruende || []
  return g.filter((x) => /^CAPTION:/.test(x) || (/^ANGEBOT:/.test(x) && item.saeule === 'werkzeuge'))
}

export function ladeHistorie(datei = HISTORIE_DATEI) {
  try {
    const h = JSON.parse(fs.readFileSync(datei, 'utf8'))
    return Array.isArray(h) ? h : []
  } catch { return [] }
}

export function speichereHistorie(h, datei = HISTORIE_DATEI) {
  fs.mkdirSync(path.dirname(datei), { recursive: true })
  const tmp = `${datei}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(h, null, 2) + '\n', 'utf8')
  fs.renameSync(tmp, datei)
}

/** Bisherige Reparaturversuche eines Beitrags: das Queue-Feld `reparaturen` oder die Historie, was größer ist. */
export function versuche(item, historie = []) {
  const ausHistorie = historie.filter((h) => h.id === item?.id).length
  return Math.max(Number(item?.reparaturen) || 0, ausHistorie)
}

/**
 * Wartet dieser Queue-Eintrag auf eine Reparatur? Abgelehnt, Typ mit Reparaturweg, Gründe keine Prüfungsausfälle und
 * weniger als MAX_REPARATUREN Versuche.
 */
export function istReparierbar(item, historie = []) {
  if (!item || item.status !== 'abgelehnt' || !REPARIERBARE_TYPEN.includes(item.typ)) return false
  if (['ausfall', 'leer'].includes(gruendeArt(item.qa?.gruende))) return false
  return versuche(item, historie) < MAX_REPARATUREN
}

/** Abgelehnt, nicht Ausfall, aber alle Versuche verbraucht: muss auf „aufgegeben“ gesetzt werden. */
export function istAufzugeben(item, historie = []) {
  if (!item || item.status !== 'abgelehnt' || !REPARIERBARE_TYPEN.includes(item.typ)) return false
  if (['ausfall', 'leer'].includes(gruendeArt(item.qa?.gruende))) return false
  return versuche(item, historie) >= MAX_REPARATUREN
}

/** Neuer Historieneintrag. ergebnis: 'repariert' | 'neu gerendert' | 'gescheitert'. */
export const historienEintrag = ({ id, versuch, gruende, ergebnis, art, detail = null, jetzt = new Date() }) => ({
  id, am: jetzt.toISOString(), versuch, art, gruende: (gruende || []).map((g) => String(g).slice(0, 600)), ergebnis, ...(detail ? { detail: String(detail).slice(0, 400) } : {}),
})
