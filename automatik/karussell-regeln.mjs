// Feste Struktur für Karussell-Texte (übernommen aus der Vorlage, gilt für alle Karussells von @vamela.de):
//  Seite 1  Hook, höchstens 10 Wörter (Neugier oder ein Problem aufgemacht)
//  Seite 2 bis 5  Inhalt, ein Kerngedanke pro Seite, höchstens zwei kurze Sätze, keine Textwüsten
//  Seite 6  CTA, eine klare Handlungsaufforderung (Speichern, Teilen, Kommentieren; bei Werkzeug oder Entwurf „Link in der Bio“)
// Dazu die Formregeln gegen KI-Floskeln: keine Deko-Nummerierung („01“, „02“), keine Aufzählung, keine Emojis auf Seiten.
// Gibt eine Liste von Verstößen zurück (leer = in Ordnung).
export const MAX_HOOK = 10
export const MAX_INHALT = 20
export const MAX_CTA = 26
const woerter = (t) => String(t || '').replace(/\*\*/g, '').split(/\s+/).filter(Boolean).length
// Sätze: Punkt nur als Satzende, wenn direkt danach keine Ziffer und kein Kleinbuchstabe folgt (1.490 €, vamela.de)
const saetze = (t) => (String(t || '').match(/(?:[^.!?]|\.(?=[\da-zäöü]))+[.!?]+["“”]*/g) || [String(t || '')]).length
/** Vorher-nachher-Seite („Vorher: … Nachher: …“) darf etwas länger sein. */
const VORHER_NACHHER = /^Vorher\b[^]*?\bNachher\b/
const CTA_WORT = /speicher|teile|teil |schick|kommentier|schreib|link in der bio/i
const EMOJI = /\p{Extended_Pictographic}/u
const DEKO_NUMMER = /(^|\s)0\d\b|(^|\s)\d+\s?\/\s?\d+\b(?!\s?(cm|mm|px|€))/

export function pruefeStruktur(post) {
  const f = []
  const p = post.pages || []
  if (p.length !== 6) { f.push(`${p.length} statt 6 Seiten`); if (!p.length) return f }
  const cover = p[0]
  if (cover.role !== 'cover') f.push('Seite 1 ist kein Cover')
  const hook = woerter(`${cover.head || ''} ${cover.sub || ''}`)
  if (hook > MAX_HOOK) f.push(`Seite 1: Hook hat ${hook} Wörter (höchstens ${MAX_HOOK})`)
  for (let i = 1; i <= 4 && i < p.length; i++) {
    const t = p[i].text || ''
    const w = woerter(t)
    const max = VORHER_NACHHER.test(t) ? 30 : MAX_INHALT
    if (p[i].role === 'close') f.push(`Seite ${i + 1}: Inhaltsseite darf keine Schlussseite sein`)
    if (w > max) f.push(`Seite ${i + 1}: ${w} Wörter (höchstens ${max}), Textwüste`)
    if (!VORHER_NACHHER.test(t) && saetze(t) > 2) f.push(`Seite ${i + 1}: mehr als zwei Sätze, ein Kerngedanke pro Seite`)
    if (/\|/.test(t) || /(^|\s)[1-9][.)]\s/.test(t)) f.push(`Seite ${i + 1}: Aufzählung oder Nummerierung`)
  }
  p.forEach((s, i) => {
    const t = [s.head, s.sub, s.text].filter(Boolean).join(' ')
    if (EMOJI.test(t)) f.push(`Seite ${i + 1}: Emoji auf der Seite`)
    if (DEKO_NUMMER.test(t)) f.push(`Seite ${i + 1}: Deko-Nummerierung („01“, „1/6“)`)
  })
  const cta = p[5]
  if (cta && cta.role !== 'close') f.push('Seite 6 ist keine Schlussseite (CTA)')
  const ct = cta?.text || ''
  if (woerter(ct) > MAX_CTA) f.push(`Seite 6: CTA hat ${woerter(ct)} Wörter (höchstens ${MAX_CTA})`)
  if (!CTA_WORT.test(ct)) f.push('Seite 6: keine klare Handlungsaufforderung (Speichern, Teilen, Kommentieren oder Link in der Bio)')
  const hatAngebot = post.angebot && !/^keins?$/i.test(String(post.angebot).trim())
  if (hatAngebot && !/link in der bio/i.test(ct)) f.push('Seite 6: Werkzeug oder Entwurf ohne „Link in der Bio“')
  if (!hatAngebot && /link in der bio/i.test(ct)) f.push('Seite 6: „Link in der Bio“ ohne Angebot (Werkzeug oder Entwurf)')
  return f
}
