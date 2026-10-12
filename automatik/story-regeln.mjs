// Planung, Prompt und harte Formregeln für automatisch geschriebene Stories (neu-schreiben.mjs --typ story).
// Nur reine Funktionen (kein Netz, kein Dateizugriff), damit alles ohne Claude testbar ist (automatik/test/stories.test.mjs).
// Die Regeln stammen aus CLAUDE.md. Die inhaltliche Prüfung (Ton, Belegbarkeit) macht danach der Prüf-Agent (qa.mjs);
// hier stehen nur die Dinge, die sich maschinell sicher erkennen lassen.
import { planeMerkmale, WERTE } from './optimierer.mjs'

export const INTERAKTIONEN = ['Umfrage', 'Fragebox', 'Quiz', 'Schieberegler']
export const SCHLUSSSATZ = 'Schreib mir ein Wort als Nachricht.'
/** Zeichenlängen der Texte auf dem Bild. */
export const LAENGE = { text: [60, 320], aufloesung: [60, 440] }
export const HINTERGRUENDE = ['Farbfläche nach Gestaltung', 'Bildschirmfoto von vamela.de', 'Eigene Zeichnung (Schrift, Farbe oder Layout)']

/** Nächste freie Nummer: höher als jede Story in den Dateien und höher als jede Queue-ID s<Nr>. */
export function naechsteStoryNr(vorhanden, queueIds = []) {
  const ausQueue = queueIds.map((id) => /^s(\d+)$/.exec(String(id))?.[1]).filter(Boolean).map(Number)
  return Math.max(0, ...vorhanden.map((s) => s.nr), ...ausQueue) + 1
}

/**
 * Plan für die nächsten `anzahl` Stories: fortlaufende Nummern, Interaktion in der Reihenfolge Umfrage, Fragebox, Quiz,
 * Schieberegler (weiter nach der letzten vorhandenen), Säule und Hook-Stil vom Optimierer (nach Gewicht, nie dieselbe
 * Säule und nie derselbe Hook-Stil wie die Story davor, 20 % Erkunden).
 */
export function planeStories(vorhanden, anzahl, queueIds = [], { gewichte = {}, seed = 'stories', statistik = null } = {}) {
  const start = naechsteStoryNr(vorhanden, queueIds)
  const letzte = vorhanden.reduce((a, s) => (!a || s.nr > a.nr ? s : a), null)
  const i0 = INTERAKTIONEN.indexOf(letzte?.interaktion)
  const merkmale = planeMerkmale(anzahl, gewichte, { seed: `${seed}|${start}`, statistik, vorher: letzte ? [letzte] : [] })
  return merkmale.map((m, i) => ({ nr: start + i, interaktion: INTERAKTIONEN[(i0 + 1 + i) % INTERAKTIONEN.length], ...m }))
}

// ---------------------------------------------------------------------------------------------------------------------
// Harte Regeln
// ---------------------------------------------------------------------------------------------------------------------

/** [Name, Test] auf jedem Text, der auf dem Bild oder in der Sticker-Fassung steht. Wahr = Verstoß. */
const TEXTREGELN = [
  ['Preis (Stories nennen keine Preise)', (t) => /€|\bEuro\b|\bEUR\b/i.test(t)],
  ['Studie oder Statistik', (t) => /%|\bProzent\b|\bStudie(n)?\b|\bStatistik\b|wissenschaftlich|Forschung(en)? zeig/i.test(t)],
  ['Emoji auf dem Bild', (t) => /\p{Extended_Pictographic}/u.test(t)],
  ['Deko-Nummerierung', (t) => /(^|\s)0\d\b/.test(t)],
  ['Aufgabe-Schema', (t) => /Aufgabe\s*[12]/i.test(t)],
  ['Erfolgsversprechen', (t) => /garantier|Platz (1|eins)\b|ganz oben bei Google|sofort mehr (Kunden|Anfragen)|nie wieder|rechtssicher|abmahnsicher/i.test(t)],
  ['Marktschreier-Ton', (t) => /!!|jetzt zuschlagen|nur heute|unschlagbar|\b(der|die|das) beste\b|Nr\.\s?1\b/i.test(t)],
  ['Kundenstimme oder Zitat mit Namen', (t) => /[„"][^“"]{3,}[“"]\s*[–—-]\s*[A-ZÄÖÜ][a-zäöüß]+/.test(t)],
]
/** Rechtsthemen nur mit Verweis auf eine Anwältin oder einen Anwalt (keine Rechtsberatung, CLAUDE.md). */
const RECHTSTHEMA = /Impressum|Datenschutz|DSGVO|\bAGB\b|Abmahn|Cookie-Banner|Widerruf/i
const ANWALT = /Anwalt|Anwältin|Rechtsanwalt|Rechtsanwältin|Kanzlei/i

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-zäöüß0-9]+/g, ' ').trim()
const woerter = (t) => new Set(String(t || '').replace(SCHLUSSSATZ, '').toLowerCase().split(/[^a-zäöüß]+/).filter((w) => w.length > 3))
/** Jaccard-Ähnlichkeit der Wortmengen (0 bis 1), der Schlusssatz zählt nicht mit. */
export function aehnlichkeit(a, b) {
  const A = woerter(a), B = woerter(b)
  if (!A.size || !B.size) return 0
  let n = 0
  for (const w of A) if (B.has(w)) n++
  return n / (A.size + B.size - n)
}
export const AEHNLICH_AB = 0.5

/** Verstöße gegen die Textregeln einer einzelnen Story (Automatik-Text, Auflösung, Text auf dem Hintergrund). */
export function textProbleme(s) {
  const out = []
  const felder = [['Automatik-Fassung', s.text], ['Auflösung', s.aufloesung], ['Text auf dem Hintergrund', s.textHg]].filter(([, t]) => t)
  for (const [feld, t] of felder) for (const [name, test] of TEXTREGELN) if (test(t)) out.push(`${feld}: ${name}`)
  const alles = felder.map(([, t]) => t).join(' ')
  if (RECHTSTHEMA.test(alles) && !ANWALT.test(alles)) out.push('Rechtsthema (Impressum, Datenschutz, AGB) ohne Verweis auf Anwalt oder Anwältin: keine Rechtsberatung')
  if (/Link in der Bio/i.test(alles) && s.saeule !== 'werkzeuge') out.push('„Link in der Bio“ nur in Werkzeug-Stories')
  if (s.text && !/\b(du|dir|dich|dein\w*)\b/i.test(s.text)) out.push('Automatik-Fassung: keine Du-Form')
  return out
}

/** Verstöße im Feld "Hintergrund": nur eigene Flächen, eigene Zeichnungen oder Bildschirmfotos von vamela.de. */
export function hintergrundProbleme(hg) {
  if (!hg) return ['Hintergrund fehlt']
  const out = []
  if (!/Farbfläche|Bildschirmfoto von vamela\.de|Eigene Zeichnung/i.test(hg)) out.push(`Hintergrund: nur ${HINTERGRUENDE.join(', ')}`)
  if (/fremd|Logo von|Screenshot von (?!vamela)|Instagram-Profil|Stockfoto/i.test(hg)) out.push('Hintergrund: keine fremden Marken, Logos, Profile oder Stockfotos')
  return out
}

/** Alle Verstöße einer Story gegen Plan und Regeln (Liste, leer = in Ordnung). `kontext.titel/texte` sind schon Vorhandenes. */
export function storyProbleme(g, p, kontext = {}) {
  const out = []
  const mit = (m) => out.push(`Story ${g.nr}: ${m}`)
  if (g.interaktion !== p.interaktion) mit(`Interaktion ist „${g.interaktion}“, verlangt ist „${p.interaktion}“`)
  if (g.saeule !== p.saeule) mit(`Säule ist „${g.saeule}“, verlangt ist „${p.saeule}“`)
  if (g.hook_stil !== p.hook_stil) mit(`Hook-Stil ist „${g.hook_stil}“, verlangt ist „${p.hook_stil}“`)
  if (!g.ziel || g.ziel.length < 10) mit('Ziel fehlt')
  if (!g.titel || g.titel.length < 3 || g.titel.length > 60) mit('Titel fehlt oder ist zu lang (3 bis 60 Zeichen)')
  if (!g.textHg) mit('Zeile „Text auf dem Hintergrund“ fehlt')
  if (!g.sticker || !g.sticker.startsWith(p.interaktion)) mit(`Zeile „Sticker (von Hand in der App, freiwillig)“ muss mit „${p.interaktion}.“ beginnen`)
  const [tmin, tmax] = LAENGE.text
  if (!g.text) mit('Automatik-Fassung fehlt oder steht nicht in „…“')
  else {
    if (g.text.length < tmin || g.text.length > tmax) mit(`Automatik-Fassung hat ${g.text.length} Zeichen, erlaubt sind ${tmin} bis ${tmax}`)
    if (!g.text.endsWith(SCHLUSSSATZ)) mit(`Automatik-Fassung muss mit „${SCHLUSSSATZ}“ enden`)
  }
  if (p.interaktion === 'Quiz') {
    const [amin, amax] = LAENGE.aufloesung
    if (!g.aufloesung) mit('Quiz braucht die Zeile „Auflösung (zweite Story, …)“ mit dem Text in „…“')
    else {
      if (!g.aufloesung.startsWith('Meine Sicht:')) mit('Auflösung muss mit „Meine Sicht:“ beginnen')
      if (g.aufloesung.length < amin || g.aufloesung.length > amax) mit(`Auflösung hat ${g.aufloesung.length} Zeichen, erlaubt sind ${amin} bis ${amax}`)
    }
  } else if (g.aufloesung) mit('nur Quiz-Stories haben eine Auflösung')
  for (const m of hintergrundProbleme(g.hintergrund)) mit(m)
  for (const m of textProbleme(g)) mit(m)
  if ((kontext.titel || []).some((t) => norm(t) === norm(g.titel))) mit(`Titel „${g.titel}“ gibt es schon`)
  for (const t of kontext.texte || []) {
    for (const eigen of [g.text, g.aufloesung].filter(Boolean)) {
      if (aehnlichkeit(eigen, t) >= AEHNLICH_AB) { mit(`Text ähnelt einer vorhandenen Story zu stark („${String(t).slice(0, 50)}…“), anderes Thema oder anderer Hook`); break }
    }
  }
  return out
}

/**
 * Prüft die vom Parser gelesenen Blöcke gegen den Plan. Rückgabe: null (in Ordnung) oder ein Text mit den Gründen,
 * den der nächste Versuch als Korrektur bekommt.
 */
export function pruefeStories(gelesen, plan, { titel = [], texte = [] } = {}) {
  if (gelesen.length !== plan.length) {
    return `${gelesen.length} statt ${plan.length} lesbare Story-Blöcke (Pflicht: Überschrift „## Story N: Titel“ und die Zeile „- Automatik-Fassung (ohne Sticker): „…““ mit dem Text in „…“)`
  }
  const probleme = []
  const bekannteTitel = [...titel], bekannteTexte = [...texte]
  const nummern = new Set()
  for (const g of gelesen) {
    const p = plan.find((x) => x.nr === g.nr)
    if (!p) { probleme.push(`unerwartete Nummer ${g.nr}`); continue }
    if (nummern.has(g.nr)) { probleme.push(`Nummer ${g.nr} doppelt`); continue }
    nummern.add(g.nr)
    probleme.push(...storyProbleme(g, p, { titel: bekannteTitel, texte: bekannteTexte }))
    bekannteTitel.push(g.titel)
    bekannteTexte.push(...[g.text, g.aufloesung].filter(Boolean))
  }
  return probleme.length ? probleme.slice(0, 8).join(' | ') : null
}

// ---------------------------------------------------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------------------------------------------------

/** Erster vorhandener Story-Block mit der gewünschten Interaktion (Formatvorlage für den Prompt). */
export function beispielBlock(md, interaktion) {
  const bloecke = String(md || '').split(/^(?=## Story \d+:)/m).filter((b) => b.startsWith('## Story '))
  const b = bloecke.find((x) => new RegExp(`^- Interaktion: ${interaktion}\\s*$`, 'm').test(x))
  return b ? b.replace(/\n(---|# [^\n]*)[\s\S]*$/, '').trim() : null
}

export function baueStoryPrompt({ regeln = '', strategie = '', learnings = '', themen = [], plan, beispiele = [], fehler = null, gewinner = '' }) {
  const nrn = plan.map((p) => `Story ${p.nr} (Interaktion: ${p.interaktion}, Säule: ${p.saeule}, Hook-Stil: ${p.hook_stil})`).join('; ')
  return `Du schreibst neue Stories für den Instagram-Account @vamela.de (VAMELA, Christian Stockmeier: Webdesign und Grafikdesign für kleine Betriebe aus Haag an der Amper, Landkreis Freising).

Was eine Story hier ist: ein einzelnes Bild (1080 × 1920) mit kurzem Text; bei Quiz-Stories kommt als zweites Bild die Auflösung dazu. Die Instagram-API kann keine Sticker. Deshalb veröffentlicht die Automatik nur die Zeile „Automatik-Fassung (ohne Sticker)“, sie bittet um eine Antwort per Nachricht, und genau dieser Text wird auf das Bild gesetzt. Die übrigen Zeilen (Text auf dem Hintergrund, Sticker) sind die freiwillige Fassung, die Christian von Hand in der App setzen kann.

VERBINDLICHE REGELN (CLAUDE.md):
${regeln}

STRATEGIE (Säulen, Zielgruppe, Ton):
${strategie}

BISHERIGE ERKENNTNISSE:
${learnings}
${gewinner ? `\nWAS FOLLOWER BRINGT (Optimierer, nach Wachstumswert):\n${gewinner}\n` : ''}
BEREITS VERWENDETE THEMEN/TITEL/HOOKS (nicht wiederholen, auch nicht sinngemäß): ${themen.join(' | ')}

AUFGABE: Schreibe ${plan.length} neue Story-Blöcke mit diesen Nummern, Interaktionen, Säulen und Hook-Stilen: ${nrn}.
Säulen: tipps = kurz und sofort umsetzbar zu Website, Google-Profil, Bewertungen, lokaler Sichtbarkeit; werkzeuge = ein Gratis-Werkzeug auf vamela.de (nur Adressen aus data/fakten.json); design = Schrift, Farbe, Layout, gut gegen schlecht an selbst gesetzten Beispielen. Hook-Stile: frage, fehler, mythos, kontrast, vorher-nachher, liste, provokation (provokant heißt pointiert, nie herabsetzend). Jede Story hat eine Mitnahme, die ein Betrieb sofort nutzen kann, und hört mit der Bitte um eine Antwort auf.

FORMAT je Block, exakt wie im Beispiel (jede Zeile außer der Überschrift beginnt mit „- “, die Texte stehen in „…“):
## Story N: Titel
- Interaktion: Umfrage | Fragebox | Quiz | Schieberegler
- Säule: tipps | werkzeuge | design
- Hook-Stil: frage | fehler | mythos | kontrast | vorher-nachher | liste | provokation
- Ziel: ein Satz, was die Story bei den Lesenden bewirkt
- Text auf dem Hintergrund: „…“ (die Sticker-Fassung: Frage und Mitnahme, kein Emoji)
- Sticker (von Hand in der App, freiwillig): <Interaktion>. Frage: „…“ Antworten: „…“ / „…“ (Quiz: dazu „Als richtig markieren: „…“.“; Fragebox: „Antwort: frei“; Schieberegler: „Emoji des Reglers: 👍“ und im Text auf dem Hintergrund „Unter dem Reglerbereich links „…“, rechts „…“.“)
- Auflösung (zweite Story, einige Stunden später, in beiden Fassungen gleich): „Meine Sicht: …“ (nur bei Quiz)
- Hintergrund: ${HINTERGRUENDE.join(' | ')}
- Automatik-Fassung (ohne Sticker): „…“ (ohne Sticker lesbar: die Frage mit den Antwortmöglichkeiten im Satz, die Mitnahme, am Ende genau: ${SCHLUSSSATZ})

HARTE REGELN (werden maschinell geprüft, ein Verstoß lässt den Versuch scheitern):
- Automatik-Fassung ${LAENGE.text[0]} bis ${LAENGE.text[1]} Zeichen, endet mit „${SCHLUSSSATZ}“. Quiz-Auflösung ${LAENGE.aufloesung[0]} bis ${LAENGE.aufloesung[1]} Zeichen, beginnt mit „Meine Sicht:“. Nur Quiz hat eine Auflösung.
- Du-Form, klar, bayerisch-bodenständig, kein Marktschreier-Ton (kein „!!“, kein „der beste“, kein „nur heute“).
- Keine Preise, keine Prozentangaben, Studien oder Statistiken, keine erfundenen Kundenstimmen oder Zitate mit Namen, keine Erfolgsversprechen („Platz 1 bei Google“, „sofort mehr Kunden“, „rechtssicher“).
- Keine Rechtsberatung: Impressum, Datenschutz, AGB nur mit dem Hinweis, das mit einer Anwältin oder einem Anwalt zu klären.
- Kein Emoji im Text (nur in der Sticker-Zeile beim Schieberegler), keine Deko-Nummerierung („01“). „Link in der Bio“ nur in Werkzeug-Stories.
- Zeile „Hintergrund“: nur eine der drei Möglichkeiten oben. Keine fremden Logos, Marken, Profile oder Screenshots fremder Seiten.
- Interaktion, Säule und Hook-Stil genau wie oben verlangt. Titel neu, kurz (3 bis 60 Zeichen), ohne Nummerierung.
${fehler ? `\nDEIN LETZTER VERSUCH WURDE ABGELEHNT WEGEN: ${fehler}\nKorrigiere genau das.\n` : ''}
BEISPIELBLÖCKE (Format! Nur das Format übernehmen, nicht den Inhalt):
${beispiele.join('\n\n')}

Gib NUR die neuen Blöcke aus, ohne Vorwort und ohne Codeblock, getrennt durch eine Zeile "---".`
}

export { WERTE }
