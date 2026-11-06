// Hook und Cover-Text je Post (Christian, 06.11.2026: „Hooks umbauen“). Grund: 8 von 16 Titeln enthielten „Geheimtipp“, „Fehler kostet“
// oder „Trick“ und begannen mit dem Suchwort plus Doppelpunkt; das liest sich wie Suchmaschinentext.
// Ablauf wie im Skill ig-reel: Claude schreibt Kandidaten aus den Formeln in tools/ig/hooks.json, der Code filtert und bewertet, der beste gewinnt.
// Wirft nie: Findet sich nichts, bleibt der Entwurf aus dem Inhalt stehen und das Log sagt es. Ein Post scheitert nicht am Hook.
// Der Suchbegriff bleibt fürs Finden in der Suche im ersten Satz der Beschreibung, nur nicht mehr als Vorspann im Titel.
import fs from 'node:fs'
import path from 'node:path'
import { bewerteHook } from './ig-pruefen.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)

// ---- Regeln auf einen Blick ----
export const MAX_WOERTER = 10
export const MIN_SCORE = 55 // darunter gilt ein Hook als schwach
const KANDIDATEN = 6
const AEHNLICH_AB = 0.5 // Wortüberlappung zu einem früheren Hook
const VERGLEICH_POSTS = 30 // so viele frühere Hooks zählen für Wiederholungen
const COVER_SPERRE = 8 // dasselbe große Cover-Wort nicht innerhalb so vieler Posts
export const VERBOTEN = [/geheimtipp/i, /kaum (wer|jemand|einer|ein betrieb)/i, /dieser fehler kostet/i, /\btrick\b/i, /keiner kennt/i, /niemand kennt/i, /musst du wissen/i, /so machst du es richtig/i, /garantiert/i, /platz 1/i, /rechtssicher/i, /abmahnsicher/i]
// Stile zu den Formeln: Feld `hook_stil` in hooks.json. Formel 26 (Superlativ) fehlt absichtlich, „der einzige Weg“ ist selten belegbar.
const AUSGENOMMEN = new Set([26])

const norm = (t) => String(t || '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim()
const woerter = (t) => norm(t).split(' ').filter(Boolean)

export function formeln(stil) {
  const { hooks } = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/ig/hooks.json'), 'utf8'))
  const frei = hooks.filter((h) => !h.beleg && !AUSGENOMMEN.has(h.id))
  return stil ? frei.filter((h) => h.hook_stil === stil) : frei
}

const felder = (h) => `- ${h.name}: ${h.vorlage || h.template} Beispiel: „${h.beispiel || h.example}“`

/** Gründe, warum ein Kandidat ausscheidet. Leer = zulässig. */
export function pruefeKandidat(k, { suchbegriff, inhaltText = '', frueher = [], frueherCover = [] }) {
  const f = []
  const hook = String(k.hook || '').trim()
  const w = woerter(hook)
  if (!w.length) return ['leer']
  if (w.length > MAX_WOERTER) f.push(`${w.length} Wörter, erlaubt ${MAX_WOERTER}`)
  for (const v of VERBOTEN) if (v.test(hook)) f.push(`verbotene Floskel ${v.source}`)
  if (/#/.test(hook)) f.push('Hashtag im Titel')
  // Die Beispiele aus hooks.json sind Muster, keine Titel: wörtlich übernommen wären sie bald auf jedem Post
  if (formeln().some((h) => norm(h.beispiel) === norm(hook))) f.push('wörtliches Formel-Beispiel')
  const vor = hook.split(/[:–—]/)[0]
  if (/[:–—]/.test(hook) && suchbegriff && norm(vor) === norm(suchbegriff)) f.push('Suchwort als Vorspann')
  // Zahlen nur, wenn sie im Inhalt stehen oder dessen Anzahl sind (nichts erfinden)
  for (const z of hook.match(/\d+/g) || []) if (!new RegExp(`\\b${z}\\b`).test(inhaltText)) f.push(`Zahl ${z} steht nicht im Inhalt`)
  const start = w.slice(0, 2).join(' ')
  for (const alt of frueher) {
    const a = woerter(alt)
    if (a.slice(0, 2).join(' ') === start) { f.push(`gleicher Anfang wie „${alt}“`); break }
    const gemeinsam = w.filter((x) => a.includes(x)).length
    if (gemeinsam / Math.max(w.length, a.length) >= AEHNLICH_AB) { f.push(`zu nah an „${alt}“`); break }
  }
  const oben = k.oben || []
  if (oben.length !== 2 || String(oben[0]).length > 18 || String(oben[1]).length > 20) f.push('Cover-Zeilen passen nicht (2 Zeilen, 18 und 20 Zeichen)')
  const gross = String(k.gross || '').trim()
  if (!gross || /\s/.test(gross) || gross.length > 10) f.push('großes Cover-Wort: ein Wort, höchstens 10 Zeichen')
  if (frueherCover.map((x) => String(x).toLowerCase()).includes(gross.toLowerCase())) f.push(`Cover-Wort „${gross}“ lief gerade erst`)
  return f
}

/**
 * Wählt Hook und Cover. Gibt { hook, oben, gross, formel, score, kandidaten } zurück, oder null, wenn der Entwurf bleiben soll.
 * `frage` und `json` werden übergeben, damit der Baustein ohne Claude testbar ist.
 */
export async function waehleHook({ inhalt, stil, posts = [], frage, json, zaehler = {}, runden = 2 }) {
  const frueher = posts.map((p) => p.hook).filter(Boolean).slice(-VERGLEICH_POSTS)
  const frueherCover = posts.map((p) => p.cover_gross).filter(Boolean).slice(-COVER_SPERRE)
  const kern = JSON.stringify({ schritte: (inhalt.schritte || []).map((s) => [s.etikett, s.titel, s.unter, s.karte]), repos: inhalt.repos })
  const inhaltText = `${kern} ${inhalt.beschreibung || ''} ${(inhalt.schritte || []).length} ${Object.values(zaehler).join(' ')}`
  const eigene = formeln(stil)
  const andere = formeln().filter((h) => h.hook_stil !== stil).filter((_, i) => i % 3 === 0)
  let grund = ''
  for (let runde = 0; runde < runden; runde++) {
    let roh
    try {
      roh = json(await frage(`Du schreibst den Einstieg für einen TikTok- und Instagram-Beitrag von @vamela.de (Webdesign und Grafik für kleine Betriebe, Du-Form, bodenständig).

Der Beitrag, den der Einstieg einlösen muss:
Thema: ${inhalt.thema || inhalt.suchbegriff}
${kern}

Schreib ${KANDIDATEN} verschiedene Kandidaten. Jeder Kandidat hat:
- "hook": die Titelzeile, höchstens ${MAX_WOERTER} Wörter, normale Groß- und Kleinschreibung. So, wie du es einem Bekannten sagen würdest, keine Überschrift aus einem Ratgeber.
- "oben": zwei kurze Zeilen fürs Cover (höchstens 18 und 20 Zeichen). Sie wecken Spannung oder nennen das Problem, nicht bloß das Thema.
- "gross": EIN Wort fürs Cover (höchstens 10 Zeichen), das zusammen mit "oben" einen Satz oder eine Spannung ergibt. Nicht immer „GRATIS“.
- "formel": Name der benutzten Formel.

Bau mindestens 4 Kandidaten aus diesen Formeln:
${eigene.map(felder).join('\n')}

Die übrigen dürfen aus diesen kommen:
${andere.map(felder).join('\n')}

Wichtig:
- Die Beispiele sind nur Muster, übernimm sie nie wörtlich. Schreib aus dem Thema dieses Beitrags heraus.
- Fang nie mit dem Suchwort plus Doppelpunkt an. Suchwort-Titel wie „Google Bewertungen Fehler: …“ sind verboten.
- Ein konkretes Ding im Hook (Logo, Kontaktformular, Öffnungszeiten, Flyer) schlägt „dein Betrieb“ oder „deine Website“.
- Spanne etwas auf, das erst im Beitrag aufgelöst wird, und halte das Versprechen.
- Verboten: Geheimtipp, Trick, „kaum jemand kennt“, „dieser Fehler kostet“, Ausrufe, Emojis, Erfolgsversprechen. Zahlen nur, wenn sie im Beitrag stehen.
- Klingt nicht wie diese letzten Hooks, auch nicht mit denselben ersten zwei Wörtern:
${frueher.slice(-15).map((h) => `  „${h}“`).join('\n') || '  keine'}
${frueherCover.length ? `- Nicht diese Cover-Wörter: ${frueherCover.join(', ')}` : ''}${grund ? `\n\nDein letzter Versuch fiel durch:\n${grund}` : ''}

Antworte nur mit JSON: {"kandidaten":[{"hook":"…","oben":["…","…"],"gross":"…","formel":"…"}]}`))
    } catch (e) { console.log(`Hook-Wahl: Claude-Antwort unbrauchbar (${String(e.message).slice(0, 120)})`); continue }
    const liste = (roh.kandidaten || []).map((k) => {
      const gruende = pruefeKandidat(k, { suchbegriff: inhalt.suchbegriff, inhaltText, frueher, frueherCover })
      const b = gruende.length ? null : bewerteHook(k.hook)
      if (b?.dealbreaker) gruende.push(b.dealbreaker)
      return { ...k, gruende, score: b?.score ?? null }
    })
    const gut = liste.filter((k) => !k.gruende.length && (k.score === null || k.score >= MIN_SCORE)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    for (const k of liste) console.log(`  Hook-Kandidat ${k.score ?? '–'} „${k.hook}“${k.gruende.length ? ` (raus: ${k.gruende.join('; ')})` : ''}`)
    if (gut.length) return { hook: gut[0].hook.trim(), oben: gut[0].oben, gross: gut[0].gross.trim(), formel: gut[0].formel || null, score: gut[0].score }
    grund = liste.map((k) => `„${k.hook}“: ${k.gruende.join('; ') || `Score ${k.score} zu niedrig`}`).join('\n')
  }
  return null
}
