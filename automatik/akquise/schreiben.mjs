// Schreibt die erste Instagram-DM an einen Betrieb einzeln mit Claude (Christian, 9.11.2026: „richtig persönlich auf jedes
// Unternehmen angepasst, riesiger Mehrwert, grammatikalisch tiptop“). Ersetzt die feste Vorlage kaltDm.
// Ablauf: Website-Text holen, Nachricht schreiben lassen, im Code prüfen (Zitat steht wirklich auf der Seite, keine fremden
// Zahlen, keine Links, Länge), dann ein Korrektorat. Fällt eine Prüfung durch, ein zweiter Versuch; danach wird der Betrieb
// übersprungen statt eine schwache Nachricht zu schicken.
import { frageClaude, extrahiereJson } from '../claude.mjs'

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const UNTERSEITE = /über|ueber|about|leistung|angebot|team|philosophie|geschichte|speisekarte|karte|menu|service|praxis|wir/i
const MAX_TEXT = 9000

export const LAENGE = { min: 400, max: 900 }

const entities = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&(auml|ouml|uuml|Auml|Ouml|Uuml|szlig);/g, (_, e) => ({ auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß' })[e])

export function sichtbarerText(html) {
  return entities(String(html)
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|h[1-6]|li|section|article|header|footer|br|tr)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\r\f\v]+/g, ' ').replace(/\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim()
}

const norm = (s) => String(s).toLowerCase().replace(/[„“”"‚‘’'«»]/g, '').replace(/\s+/g, ' ').trim()

async function hole(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'de' }, redirect: 'follow', signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return { html: await r.text(), url: r.url || url }
}

/** Startseite plus bis zu zwei passende Unterseiten (Über uns, Leistungen, Speisekarte …) als Klartext. */
export async function websiteMaterial(website) {
  const start = await hole(website)
  const html = start.html
  const titel = entities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim()
  const beschreibung = entities(html.match(/<meta[^>]+name=["']?description["']?[^>]+content=["']([^"']*)/i)?.[1] || '').trim()
  const teile = [`[Startseite ${start.url}]\n${sichtbarerText(html)}`]
  const basis = new URL(start.url)
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => { try { return { url: new URL(m[1], basis).href.split('#')[0], text: sichtbarerText(m[2]) } } catch { return null } })
    .filter((l) => l && new URL(l.url).hostname === basis.hostname && l.url !== start.url && UNTERSEITE.test(l.text + ' ' + l.url) && !/impressum|datenschutz|privacy|agb|cookie|\.(pdf|jpe?g|png)$/i.test(l.url))
  const gesehen = new Set()
  for (const l of links) {
    if (gesehen.size >= 2 || gesehen.has(l.url)) continue
    gesehen.add(l.url)
    try { const s = await hole(l.url); teile.push(`[Unterseite ${s.url}]\n${sichtbarerText(s.html)}`) } catch { /* Unterseite fehlt, egal */ }
  }
  return { titel, beschreibung, text: teile.join('\n\n').slice(0, MAX_TEXT) }
}

const SIEZEN = /praxis|arzt|ärzt|zahn|kanzlei|anwalt|rechtsanw|steuer|notar|versicherung|physio|heilpraktik/i

export const SYSTEM = `Du schreibst für Christian Stockmeier die erste Instagram-Direktnachricht an einen kleinen Betrieb aus der Region Freising und Erding. Christian ist Webdesigner aus Haag an der Amper (VAMELA). Er kopiert deine Nachricht und sendet sie selbst. Ziel: Der Betrieb antwortet und nimmt einen kostenlosen Entwurf seiner Startseite an.

So ist die Nachricht aufgebaut:
1. Einstieg mit etwas Konkretem, das nur auf diesen Betrieb zutrifft und in <website> steht: eine Spezialität, eine Leistung, die Geschichte, das Team, der Ort. Christian stellt sich in einem Halbsatz vor. Kein leeres Lob wie „tolle Seite“.
2. Ein oder zwei Befunde aus <befunde>, in eigenen, einfachen Worten und sachlich. Erfinde keine weiteren Mängel. Rechtliche Befunde als Tatsache mit kurzem Hinweis, nie „ihr verstoßt gegen“.
3. Ein Geschenk, das der Betrieb sofort ohne Christian nutzen kann und das nur zu ihm passt. Zum Beispiel: ein fertiger Text für die Google-Beschreibung (höchstens 155 Zeichen, mit Leistung und Ort aus <website>), eine klarere Überschrift für die Startseite, oder ein konkreter Handgriff zu einem Befund. Schreib das Geschenk vollständig aus.
4. Angebot: ein kostenloser, unverbindlicher Entwurf der Startseite. Schluss mit einer kurzen Frage, auf die man einfach mit Ja antworten kann.
5. Gruß und Name: „Liebe Grüße“ oder „Viele Grüße“, dann „Christian“.

Ton und Sprache:
- Warm und bodenständig wie ein hilfsbereiter Nachbar, nie verkäuferisch, kein Druck.
- Die Anrede steht in <anrede>: „ihr“ (euch, eure) oder „Sie“. Halte sie in der ganzen Nachricht durch.
- Einwandfreies Deutsch nach aktueller Rechtschreibung, mit korrekter Kommasetzung. Ganze Sätze, kurze Absätze mit Leerzeile dazwischen.
- Keine Gedankenstriche, keine Aufzählungszeichen, kein Fettdruck, keine Links, keine Preise. Höchstens ein Emoji.
- Jede Zahl in der Nachricht muss so im Material stehen.
- Keine Floskeln wie „Ich hoffe, ich störe nicht“, „Ich bin begeistert“ oder „Zögert nicht“.
- Länge: ${LAENGE.min} bis ${LAENGE.max} Zeichen.
- Beginne nicht wie die Nachrichten in <schon_begonnen>.

Gib nur JSON zurück: {"detail_zitat": "wörtlicher Ausschnitt aus <website>, auf den sich dein Einstieg bezieht, 3 bis 15 Wörter", "nachricht": "die fertige Nachricht"}

<examples>
<example>
Servus ins Team der Schreinerei Huber!

Ich bin Christian, Webdesigner aus Haag an der Amper. Eure Treppen aus heimischer Eiche auf der Startseite haben mir richtig gut gefallen.

Mir ist aufgefallen, dass auf eurer Startseite Google Analytics läuft, ich aber keinen Cookie-Hinweis gefunden habe. Das ist leider einer der häufigsten Abmahngründe.

Bei Google fehlt außerdem eine Beschreibung. Die könnt ihr direkt so übernehmen: „Schreinerei Huber in Moosburg: Treppen, Türen und Möbel aus heimischer Eiche, geplant und gefertigt in der eigenen Werkstatt.“

Wenn ihr mögt, baue ich euch kostenlos einen Entwurf, wie eure Startseite aussehen könnte, ganz unverbindlich. Soll ich ihn euch schicken?

Liebe Grüße
Christian
</example>
<example>
Guten Tag Frau Dr. Maier,

ich bin Christian, Webdesigner aus Haag an der Amper. Dass Sie in Ihrer Praxis in Erding auch Akupunktur anbieten, habe ich erst auf Ihrer Unterseite „Leistungen“ entdeckt.

Genau das würde ich auf der Startseite ganz nach oben stellen, zum Beispiel so: „Hausärztliche Versorgung und Akupunktur in Erding“. Viele Patienten entscheiden in wenigen Sekunden, ob sie richtig sind.

Außerdem lädt Ihre Seite Schriften direkt von Google. Das klingt harmlos, dafür wurden 2022 aber viele Praxen und Betriebe abgemahnt.

Gern baue ich Ihnen kostenlos einen Entwurf Ihrer Startseite, ohne jede Verpflichtung. Darf ich ihn Ihnen schicken?

Viele Grüße
Christian
</example>
</examples>`

function anredeFuer(lead) {
  return SIEZEN.test(`${lead.name} ${lead.branche}`) ? 'Sie' : 'ihr'
}

/** Prüft eine Nachricht im Code. Gibt eine Liste von Fehlern zurück, leer = bestanden. */
export function pruefeNachricht(n, { zitat, materialText, material, schonBegonnen = [] }) {
  const f = []
  const text = String(n || '')
  if (text.length < LAENGE.min || text.length > LAENGE.max) f.push(`Länge ${text.length} Zeichen, erlaubt ${LAENGE.min} bis ${LAENGE.max}`)
  if (!zitat || norm(zitat).length < 8 || !norm(materialText).includes(norm(zitat))) f.push('detail_zitat steht nicht wörtlich auf der Website')
  if (/https?:\/\/|www\.|\.de\b|\.com\b/i.test(text)) f.push('enthält einen Link oder eine Domain')
  if (/[–—]/.test(text)) f.push('enthält einen Gedankenstrich')
  if (/^\s*[•\-*]\s/m.test(text)) f.push('enthält Aufzählungszeichen')
  if (/\*\*/.test(text)) f.push('enthält Fettdruck')
  if (/antippbar|nicht antippen|abschreiben/i.test(text)) f.push('behauptet, die Telefonnummer sei nicht antippbar (nicht belegt)')
  if (/€|euro\b/i.test(text)) f.push('nennt einen Preis')
  if (/ich hoffe,? ich (störe|nerve)|zögert nicht|zögern sie nicht|ich bin begeistert/i.test(text)) f.push('enthält eine verbotene Floskel')
  const emojis = (text.match(/\p{Extended_Pictographic}/gu) || []).filter((e) => !'©®™'.includes(e))
  if (emojis.length > 1) f.push(`${emojis.length} Emojis, erlaubt ist eins`)
  const mat = norm(material)
  for (const z of text.match(/\d+(?:[.,]\d+)?/g) || []) if (!mat.includes(norm(z))) f.push(`Zahl ${z} steht nicht im Material`)
  const anfang = norm(text.split('\n')[0]).slice(0, 25)
  if (schonBegonnen.some((s) => norm(s).slice(0, 25) === anfang)) f.push('beginnt wie eine andere Nachricht von heute')
  if (!/christian\s*$/i.test(text.trim())) f.push('endet nicht mit dem Namen Christian')
  return f
}

const KORREKTORAT = `Du bist Korrektor für deutsche Texte. Korrigiere ausschließlich Fehler in Rechtschreibung, Grammatik und Zeichensetzung nach aktueller deutscher Rechtschreibung. Ändere weder Inhalt noch Ton noch Satzbau, wenn kein Fehler vorliegt. Gib nur JSON zurück: {"fehler": ["kurze Beschreibung je gefundenem Fehler"], "korrigiert": "der vollständige korrigierte Text"}`

/**
 * Schreibt die DM für einen Lead. Gibt { nachricht, zitat, versuche } zurück oder wirft, wenn nach zwei Versuchen
 * keine Nachricht alle Prüfungen besteht.
 */
export async function schreibeDm(lead, { schonBegonnen = [], modell = process.env.AKQUISE_MODELL || 'opus', log = () => {} } = {}) {
  const w = await websiteMaterial(lead.website)
  const befunde = (lead.befunde || []).filter((b) => !/antippbar/.test(b))
  const material = [lead.name, lead.ort, lead.branche, w.titel, w.beschreibung, befunde.join(' '), w.text].join('\n')
  const eingabe = `<betrieb>${lead.name}${lead.ort ? `, ${lead.ort}` : ''} (${lead.branche || 'Betrieb'})</betrieb>
<anrede>${anredeFuer(lead)}</anrede>
<befunde>
${befunde.map((b) => '- ' + b).join('\n') || '- keine'}
</befunde>
<google_titel>${w.titel}</google_titel>
<google_beschreibung>${w.beschreibung || '(fehlt)'}</google_beschreibung>
<schon_begonnen>
${schonBegonnen.join('\n') || '(noch keine)'}
</schon_begonnen>
<website>
${w.text}
</website>`
  let hinweis = ''
  for (let versuch = 1; versuch <= 2; versuch++) {
    const roh = await frageClaude(eingabe + hinweis, { system: SYSTEM, modell, timeoutMs: 300_000 })
    const j = extrahiereJson(roh)
    if (!j?.nachricht) { hinweis = '\n\nDeine letzte Antwort war kein gültiges JSON. Gib nur das JSON zurück.'; continue }
    let n = String(j.nachricht).trim()
    try {
      const k = extrahiereJson(await frageClaude(n, { system: KORREKTORAT, modell: 'sonnet', timeoutMs: 180_000 }))
      if (k?.korrigiert && Math.abs(k.korrigiert.length - n.length) < 80) {
        if (k.fehler?.length) log(`  Korrektorat ${lead.name}: ${k.fehler.join('; ')}`)
        n = String(k.korrigiert).trim()
      }
    } catch (e) { log(`  Korrektorat übersprungen (${e.message})`) }
    const fehler = pruefeNachricht(n, { zitat: j.detail_zitat, materialText: w.text + '\n' + w.titel + '\n' + w.beschreibung, material, schonBegonnen })
    if (!fehler.length) return { nachricht: n, zitat: j.detail_zitat, versuche: versuch }
    log(`  Versuch ${versuch} für ${lead.name} abgelehnt: ${fehler.join('; ')}`)
    hinweis = `\n\nDeine letzte Nachricht wurde abgelehnt: ${fehler.join('; ')}. Schreib sie neu und behebe genau das.`
  }
  throw new Error('keine Nachricht hat alle Prüfungen bestanden')
}
