// Feste Regeln für Sprech-Reels (render/reel.mjs, Auftrag Christian 12.10.2026: „Krass gut geschnittene Reels mit KI-Stimme“).
// Geprüft beim Schreiben (automatik/neu-schreiben.mjs --typ reel) und im Test der Vorratsdatei.
//   pruefeSprechReel(reel, { angebot, root }) -> Liste der Verstöße (leer = in Ordnung)
//   SPRECH_REGELN                             -> Abschnitt für den Schreib-Prompt
import fs from 'node:fs'
import path from 'node:path'
import { saetze, ohneMarkup } from '../render/orange.mjs'
import { pruefeMotiv } from './block-felder.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
export const SPRECH = { minWoerter: 35, maxWoerter: 60, minSaetze: 3, maxSaetze: 8, hookWoerter: 10 }
const HANDLUNG = /\b(speicher|folg|teil|kommentier|schreib|link in der bio)/i

export const SPRECH_REGELN = `SPRECH-REEL (feste Regeln, 15 bis 25 Sekunden): Eine tiefe KI-Stimme spricht den Text aus "- Sprechtext: …" (eine Zeile, ${SPRECH.minWoerter} bis ${SPRECH.maxWoerter} Wörter, ${SPRECH.minSaetze} bis ${SPRECH.maxSaetze} kurze Sätze, Du-Form, gesprochene Sprache ohne Klammern, Aufzählungszeichen oder Emojis). Satz 1 ist der Hook (höchstens ${SPRECH.hookWoerter} Wörter, in den ersten zwei Sekunden gesprochen, im gewünschten Hook-Stil); danach ein konkreter Tipp mit Mehrwert (genau das, was die Zeile "- Mehrwert" verspricht); der letzte Satz ist kurz und fordert zum Speichern oder Folgen auf (bei Angebot Werkzeug oder Entwurf mit „Link in der Bio“, ohne Angebot nie). Keine erfundenen Zahlen, Fakten nur wie auf vamela.de. Webadressen nur als „vamela.de“, nie mit Pfad (die Stimme liest sonst Schrägstriche vor).
Dazu "**Hook (Cover und erster Satz, wörtlich):** „…“" (Text für Cover und großen Hook-Text, höchstens 10 Wörter) und ein Abschnitt "**Szenen** (je Satz des Sprechtexts eine):" mit genau so vielen nummerierten Zeilen wie der Sprechtext Sätze hat, je Zeile eine Bildidee:
"1. nacht: <englisches Motiv>" bzw. "1. tag: <englisches Motiv>" (KI-Bild, Regeln wie "- Motiv"; nacht = Tech/KI/Gaming dunkel mit oranger Glut, tag = Tier- oder Objekt-Metapher auf Orange und Weiß), oder "2. aufnahme: https://vamela.de/pfad" (Bildschirmaufnahme der Seite, nur vamela.de, Kundenseiten nur die freigegebenen Referenzen; höchstens zwei je Reel). Die Ablauf-Tabelle entfällt.`

/** Verstöße eines Sprech-Reels. */
export function pruefeSprechReel(r, { angebot = r.angebot || 'keins', root = ROOT } = {}) {
  const f = []
  const text = ohneMarkup(String(r.sprechtext || '')).trim()
  if (!text) return ['Zeile „- Sprechtext: …“ fehlt']
  const woerter = text.split(/\s+/).filter(Boolean).length
  if (woerter < SPRECH.minWoerter || woerter > SPRECH.maxWoerter) f.push(`Sprechtext hat ${woerter} Wörter, erlaubt ${SPRECH.minWoerter} bis ${SPRECH.maxWoerter}`)
  const s = saetze(text)
  if (s.length < SPRECH.minSaetze || s.length > SPRECH.maxSaetze) f.push(`Sprechtext hat ${s.length} Sätze, erlaubt ${SPRECH.minSaetze} bis ${SPRECH.maxSaetze}`)
  const hook = s[0]?.split(/\s+/).length || 0
  if (hook > SPRECH.hookWoerter) f.push(`erster Satz (Hook) hat ${hook} Wörter, höchstens ${SPRECH.hookWoerter}`)
  if (!HANDLUNG.test(s.at(-1) || '')) f.push('letzter Satz fordert nicht zum Speichern, Folgen oder „Link in der Bio“ auf')
  const link = /link in der bio/i.test(text)
  if (!/^keins$/i.test(angebot) && !link) f.push('Angebot ohne „Link in der Bio“ im Sprechtext')
  if (/^keins$/i.test(angebot) && link) f.push('„Link in der Bio“ im Sprechtext, aber Angebot keins')
  if (/vamela\.de\/|https?:|www\./i.test(text)) f.push('Webadresse mit Pfad im Sprechtext (nur „vamela.de“)')
  if (/\p{Extended_Pictographic}|[()•]/u.test(text)) f.push('Emoji, Klammer oder Aufzählungszeichen im Sprechtext')
  const sz = r.szenen || []
  if (sz.length !== s.length) f.push(`${sz.length} Szenen für ${s.length} Sätze (je Satz genau eine)`)
  if (sz.filter((x) => x.art === 'aufnahme').length > 2) f.push('mehr als zwei Bildschirmaufnahmen')
  sz.forEach((x, i) => {
    if (x.art === 'aufnahme') { if (!/^https:\/\/vamela\.de\//.test(x.url || '')) f.push(`Szene ${i + 1}: Aufnahme nur von https://vamela.de/…`) }
    else if (x.vorrat) { if (!fs.existsSync(path.join(root, 'bilder', 'vorrat', `${x.vorrat}.png`))) f.push(`Szene ${i + 1}: bilder/vorrat/${x.vorrat}.png fehlt`) }
    else { const m = pruefeMotiv(x.motiv); if (m.length) f.push(`Szene ${i + 1}: ${m[0]}`) }
  })
  if (!r.hook) f.push('Hook-Zeile fehlt')
  return f
}
