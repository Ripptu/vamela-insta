// Skriptautor (Christian, 11.11.2026: „ich möchte einen Script Writer, der ein virales Script erstellt“).
// Eigener Schritt vor dem Video-Bau: Claude schreibt als Kurzvideo-Autor einen gesprochenen Text mit Spannungsbogen und fünf Hook-Varianten.
// Der Code wählt den Hook mit dem besten Wert aus tools/ig/hookscore.py, der keine verbotene Floskel enthält, und setzt ihn an den Anfang.
// Danach verteilt automatik/tiktok-video.mjs den Text wörtlich auf die Beats. Fällt der Autor aus, läuft das Video wie vorher ohne Vorlage.
import { bewerteHook } from './ig-pruefen.mjs'
import { VERBOTEN, MAX_WOERTER } from './hook-wahl.mjs'

const woerter = (t) => String(t || '').trim().split(/\s+/).filter(Boolean)

export function auftragAutor({ saeule, letzte, werkzeuge }) {
  return `Du bist Autor für virale Kurzvideos (TikTok, Instagram Reels) auf Deutsch. Kunde: VAMELA (Webdesign und Grafik, Haag an der Amper, Landkreis Freising), Konto @vamela.de.
Zuschauer: Inhaber kleiner Betriebe (Handwerk, Gastronomie, Praxen, Dienstleister), absolute Anfänger bei Website, Google und Design. Sie wischen weiter, sobald ein Satz langweilt oder ein Wort fremd klingt.

Säule: ${saeule} (tipps = Website, Google-Profil, Bewertungen, lokale Sichtbarkeit; werkzeuge = ein Gratis-Werkzeug auf vamela.de; design = Schrift, Farbe, Layout).
${saeule === 'werkzeuge' ? `Werkzeuge auf vamela.de (nur diese): ${werkzeuge}\n` : ''}Diese Themen und Hooks liefen in den letzten 30 Tagen. Nimm ein Thema, das hier weder vorkommt noch ähnlich ist (anderes Werkzeug, anderer Ort im Betrieb, anderes Problem):
${letzte}

Schreib den gesprochenen Text eines 20 bis 28 Sekunden langen Videos als Geschichte, nicht als Erklärung:
- Satz 1 ist der Hook: ein Schmerz oder eine Neugier des Zuschauers, konkret, höchstens ${MAX_WOERTER} Wörter, ohne die Antwort.
- Satz 2 öffnet eine Lücke, die erst kurz vor Schluss geschlossen wird („Und der Grund steckt in einem Wort.“).
- Eine Szene, die der Zuschauer kennt, statt eines Lehrsatzes („Du druckst 500 Flyer, und keiner scannt den Code.“).
- In der Mitte ein Moment, den er nicht erwartet.
- Vorletzter oder drittletzter Satz: die Auflösung, kurz und konkret, ein Handgriff für heute.
- Letzter Satz: ein Grund zum Speichern oder Schicken, der ein Wort aus dem Hook wieder aufnimmt.
- 7 bis 10 Sätze, jeder höchstens 16 Wörter, zusammen 45 bis 80 Wörter. Wechsle kurze Schläge (zwei, drei Wörter) und ganze Sätze.
- Für Anfänger verständlich: Wörter wie am Küchentisch, kein Fachbegriff ohne Erklärung in fünf Wörtern („SVG, also ein Logo, das nie unscharf wird“), keine Abkürzungen.
- Du-Form, bodenständig, kein Marktschreier. Keine Begrüßung, kein „Heute zeige ich dir“, keine Floskeln wie Geheimtipp oder Trick.
- Nur Belegbares: keine erfundenen Zahlen, Studien, Kundenstimmen oder Versprechen. Zahlen nur, wenn sie eine Tatsache sind (Maße, Schritte).
- „vamela.de“ höchstens einmal, nur wenn ein Werkzeug vorkommt.

Gut: „Flyer gedruckt. Geld bezahlt. Null Anfragen. Der Grund steckt in einem winzigen Quadrat. …“
Schlecht: „Heute zeige ich dir, wie QR-Codes funktionieren. Ein QR-Code muss groß genug sein.“

Schreib zusätzlich vier weitere Hooks für denselben Text, jeder mit einer anderen Art: Frage, Gegensatz, Aussage mit Spannung, kleine Geschichte.

Antworte nur mit JSON:
{"thema":"kurzes Thema","saetze":["Hook","…"],"hooks":["…","…","…","…"],"loop_wort":"Wort aus dem Hook, das am Schluss wiederkommt"}`
}

/** Prüft die Vorlage im Code und setzt den besten Hook an den Anfang. Gibt die Vorlage oder null zurück, plus Gründe. */
export function pruefeVorlage(v) {
  const gruende = []
  const saetze = (v?.saetze || []).map((s) => String(s).trim()).filter(Boolean)
  if (saetze.length < 7 || saetze.length > 10) gruende.push(`${saetze.length} Sätze, verlangt 7 bis 10`)
  const lang = saetze.filter((s) => woerter(s).length > 16)
  if (lang.length) gruende.push(`Sätze über 16 Wörter: ${lang.length}`)
  const summe = saetze.reduce((a, s) => a + woerter(s).length, 0)
  if (summe < 45 || summe > 80) gruende.push(`${summe} Wörter, verlangt 45 bis 80`)
  const floskel = saetze.filter((s) => VERBOTEN.some((r) => r.test(s)))
  if (floskel.length) gruende.push(`verbotene Floskel in: ${floskel[0]}`)
  if (/^(heute|hallo|hey|in diesem video)\b/i.test(saetze[0] || '')) gruende.push('Hook beginnt mit Begrüßung oder Vorrede')
  if (gruende.length) return { vorlage: null, gruende }
  // Hook-Wahl: Original und Varianten, nur zulässige, höchster Wert aus hookscore.py
  const kandidaten = [saetze[0], ...(v.hooks || [])].map((h) => String(h).trim())
    .filter((h) => h && woerter(h).length <= MAX_WOERTER && !VERBOTEN.some((r) => r.test(h)))
    .map((h) => ({ h, b: bewerteHook(h) }))
    .filter((k) => !k.b.dealbreaker)
    .sort((a, b) => (b.b.score ?? 0) - (a.b.score ?? 0))
  const hook = kandidaten[0]?.h || saetze[0]
  return { vorlage: { thema: v.thema, saetze: [hook, ...saetze.slice(1)], loop_wort: v.loop_wort, hook_score: kandidaten[0]?.b.score ?? null, hook_varianten: kandidaten.map((k) => `${k.b.score ?? '–'} ${k.h}`) }, gruende }
}

/** Ein Versuch, bei Fehlern ein zweiter mit den Gründen. `claude(prompt)` liefert geparstes JSON. */
export async function schreibeVorlage({ saeule, letzte, werkzeuge, claude, log = console.log }) {
  let zusatz = ''
  for (let versuch = 1; versuch <= 2; versuch++) {
    try {
      const v = await claude(auftragAutor({ saeule, letzte, werkzeuge }) + zusatz)
      const { vorlage, gruende } = pruefeVorlage(v)
      if (vorlage) { log(`Skriptautor: „${vorlage.saetze[0]}“ (Hook-Wert ${vorlage.hook_score ?? '–'}), ${vorlage.saetze.length} Sätze`); return vorlage }
      log(`Skriptautor abgelehnt: ${gruende.join('; ')}`)
      zusatz = `\n\nDein letzter Entwurf fiel durch, behebe das: ${gruende.join('; ')}`
    } catch (e) { log(`Skriptautor: ${String(e.message).slice(0, 200)}`) }
  }
  return null
}
