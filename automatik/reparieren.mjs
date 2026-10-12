// Repariert abgelehnte Beiträge automatisch, bis sie durch die Prüfung kommen (Christian, 12.10.2026: „Alle abgelehnten sollen
// automatisch nochmal gemacht werden, bis es klappt!“). Claude nur über das Abo (automatik/claude.mjs).
//
// Aufruf: node automatik/reparieren.mjs [--max N] [--parallel P] [--bis <Epoch-ms>] [--nur k13,s02] [--trocken] [--root <Ordner>]
//   --trocken: nichts schreiben; --root: anderer Projektordner (Tests)
//
// Was passiert mit jedem Queue-Eintrag `status: 'abgelehnt'` (Typ karussell oder story), dessen Gründe nicht
// „Prüfung nicht durchführbar“ sind und der weniger als 3 Reparaturen hinter sich hat (Queue-Feld `reparaturen`, Standard 0,
// sonst die Zahl in data/reparaturen.json):
//   0. Regelkorrektur für Stories: Stories haben keine Caption. Alte Gründe „CAPTION: …“ (und „ANGEBOT: …“ bei Werkzeug-Stories)
//      sind keine Mängel; bleibt nichts übrig, geht der Eintrag unverändert zurück auf „neu“ (wird nur neu geprüft).
//   1. Inhaltliche Gründe (alles außer GESTALTUNG und Format): Claude bekommt den Originalblock aus der Quelldatei
//      (docs/content-posts*.md bzw. docs/content-stories-auto.md), die Prüfgründe wörtlich, die festen Regeln und bei Fundstücken
//      den README-Auszug, den die Prüfung gesehen hat. Er ändert nur die bemängelten Stellen, streicht im Zweifel Unbelegtes und
//      gibt den Block im selben Format mit derselben Nummer zurück. Der Code prüft ihn wie neu-schreiben.mjs (Parser,
//      Pflichtzeilen, karussell-/story-regeln, Fakten, Repo-Angaben live). Bei Erfolg ersetzt er den Block in der Quelldatei,
//      der Queue-Eintrag wird entfernt (produce.mjs rendert ihn neu) und data/reparaturen.json hält den Versuch fest.
//   2. Nur GESTALTUNG: Claude kürzt Hook und Texte (gleiche Regeln), danach wie oben neu rendern. Nur Format: einfach neu rendern.
//      Das Bild wird nicht neu erzeugt (kostet Geld), außer HIGGSFIELD-Zugang ist gesetzt, der Grund heißt „Text auf Motiv“ und
//      die Kopie bilder/<id>.png ist nicht aus dem Vorrat: dann wird sie gelöscht, damit beschaffeBild ein neues holt.
//   3. Nach 3 Reparaturen ohne Erfolg: Status `aufgegeben` mit Grund im Eintrag (`aufgegeben: { am, grund }`), der Wochenbericht
//      listet sie, vorrat.mjs schreibt Ersatz. Aufgegebene zählen weder zum Puffer noch zum Vorrat.
//
// Ohne erreichbares Claude: Meldung und Exit-Code 3, nichts wird verändert (wie qa-lauf.mjs).
// Umgebung: CLAUDE_BIN / CLAUDE_CODE_OAUTH_TOKEN (siehe claude.mjs), GITHUB_TOKEN (Repo-Prüfung), HIGGSFIELD_API_KEY/_SECRET.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { ladeQueue, speichereQueue } from './queue.mjs'
import { frageClaude } from './claude.mjs'
import { findeClaude } from './qa.mjs'
import { readPosts, readStories } from '../render/inhalt.mjs'
import { ergaenze, pruefeZusatz } from './block-felder.mjs'
import { pruefeKarussell } from './pruefe-block.mjs'
import { storyProbleme, aehnlichkeit, AEHNLICH_AB, LAENGE, SCHLUSSSATZ, HINTERGRUENDE } from './story-regeln.mjs'
import { pruefeRepo, holeReadme, kostenHinweise, pruefeRepoAngaben } from './repo-check.mjs'
import { higgsfieldZugang } from '../render/bilder.mjs'
import {
  MAX_REPARATUREN, REPARIERBARE_TYPEN, gruendeArt, veralteteStoryGruende, ladeHistorie, speichereHistorie, versuche,
  istReparierbar, istAufzugeben, historienEintrag,
} from './reparatur-historie.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const DATEIEN = { Karussell: ['docs/content-posts.md', 'docs/content-posts-auto.md'], Story: ['docs/content-stories-auto.md'] }
const ABSCHNITT = { Karussell: '# Karussells\n\n', Story: '# Stories\n\n' }
const LESER = { Karussell: readPosts, Story: readStories }

/** Claude ist nicht erreichbar (Abmeldung, Ratenlimit, CLI fehlt): der ganze Lauf endet mit Exit-Code 3. */
export class ClaudeAus extends Error {}
/** GitHub vorübergehend nicht erreichbar: der Versuch zählt nicht. */
export class RepoVorlaeufig extends Error {}

// ------------------------------------------------------------------------------------------------- Blöcke in den Dateien

/** Block „## Karussell 13: …“ bis vor die nächste Überschrift oder Trennlinie „---“. Gibt { start, ende, text } oder null. */
export function findeBlock(md, wort, nr) {
  const m = new RegExp(`^## ${wort} ${+nr}:[^\\n]*`, 'm').exec(md)
  if (!m) return null
  const rest = md.slice(m.index + m[0].length)
  const stopp = rest.search(/^(?:## |# |---\s*$)/m)
  const roh = md.slice(m.index, stopp < 0 ? md.length : m.index + m[0].length + stopp)
  const text = roh.replace(/\s+$/, '')
  return { start: m.index, ende: m.index + text.length, text }
}

/** Ersetzt den Block durch `neu` (alles drumherum bleibt Byte für Byte erhalten). Null, wenn der Block fehlt. */
export function ersetzeBlock(md, wort, nr, neu) {
  const b = findeBlock(md, wort, nr)
  return b ? md.slice(0, b.start) + neu.trim() + md.slice(b.ende) : null
}

/** Quelldatei und Block eines Queue-Eintrags („docs/content-posts.md#Karussell 13“; sucht auch in der Auto-Datei). */
export function findeQuelle(item, root = ROOT) {
  const m = /^(.*?)#(Karussell|Story) (\d+)$/.exec(String(item.quelle || ''))
  if (!m) return null
  const [, datei, wort, nr] = m
  for (const d of [datei, ...DATEIEN[wort].filter((x) => x !== datei)]) {
    const p = path.join(root, d)
    if (!fs.existsSync(p)) continue
    const md = fs.readFileSync(p, 'utf8')
    const b = findeBlock(md, wort, +nr)
    if (b) return { datei: d, pfad: p, wort, nr: +nr, ...b }
  }
  return null
}

/** Liest einen einzelnen Block mit dem Parser des Renderers (inkl. Zusatzfelder Mehrwert, Motiv, Familie, Repo …). */
export function liesBlock(wort, text) {
  const tmp = path.join(os.tmpdir(), `rep-${process.pid}-${Math.random().toString(36).slice(2)}.md`)
  const md = ABSCHNITT[wort] + text.trim() + '\n'
  try {
    fs.writeFileSync(tmp, md)
    return ergaenze(LESER[wort](tmp), md, wort)
  } finally { fs.rmSync(tmp, { force: true }) }
}

const alleSeiten = (g) => (g.pages || []).map((s) => [s.head, s.sub, s.text].filter(Boolean).join(' ')).join('\n')

/**
 * Prüft einen von Claude zurückgegebenen Block wie neu-schreiben.mjs: Parser, genau ein Block mit der Nummer des Originals,
 * Pflichtzeilen, unveränderte Merkmale (Säule, Hook-Stil, Angebot, Werkzeug, Interaktion), Karussell- bzw. Story-Regeln, Fakten
 * und bei Fundstücken die Repo-Angaben gegen die Live-Daten. Rückgabe: null (in Ordnung) oder die Gründe als Text.
 * original: geparster Originalblock; andere: die übrigen Story-Blöcke (Titel und Texte dürfen sich nicht wiederholen);
 * repo: { daten, kosten } bei Fundstücken.
 */
export function pruefeReparatur({ wort, text, original, andere = [], repo = null }) {
  let gelesen
  try { gelesen = liesBlock(wort, text) } catch (e) { return `Parser: ${e.message}` }
  if (gelesen.length !== 1) return `${gelesen.length} statt 1 lesbarer Block (gib genau den einen Block aus, mit Überschrift „## ${wort} ${original.nr}: Titel“)`
  const g = gelesen[0]
  const f = []
  const mit = (m) => f.push(m)
  if (g.nr !== original.nr) return `Nummer ${g.nr}, verlangt ist ${original.nr}`
  for (const z of pruefeZusatz(g)) mit(z)
  if (g.saeule !== original.saeule) mit(`Säule „${g.saeule}“, muss „${original.saeule}“ bleiben`)
  if (g.hook_stil !== original.hook_stil) mit(`Hook-Stil „${g.hook_stil}“, muss „${original.hook_stil}“ bleiben`)
  if (wort === 'Karussell') {
    if (String(g.angebot).toLowerCase() !== String(original.angebot).toLowerCase()) mit(`Angebot „${g.angebot}“, muss „${original.angebot}“ bleiben`)
    if ((g.werkzeug || null) !== (original.werkzeug || null)) mit(`Werkzeug „${g.werkzeug}“, muss „${original.werkzeug}“ bleiben`)
    for (const z of pruefeKarussell(g)) mit(z)
    if (repo) for (const z of pruefeRepoAngaben({ ...g, text: alleSeiten(g) }, repo.daten, { kosten: repo.kosten })) mit(z)
  } else {
    const p = { nr: original.nr, interaktion: original.interaktion, saeule: original.saeule, hook_stil: original.hook_stil }
    const fremd = andere.filter((s) => s.nr !== original.nr)
    for (const z of storyProbleme(g, p, { titel: fremd.map((s) => s.titel), texte: fremd.flatMap((s) => [s.text, s.aufloesung]).filter(Boolean) })) mit(z)
  }
  return f.length ? f.slice(0, 8).join(' | ') : null
}

// ------------------------------------------------------------------------------------------------- Prompt

const claudeRegeln = (root) => {
  try {
    const t = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8')
    const a = t.indexOf('**Marke**'), b = t.indexOf('**System**')
    return a >= 0 && b > a ? t.slice(a, b).trim() : t
  } catch { return '' }
}

const FORMREGELN = {
  Karussell: `- Genau 6 Seiten in der Tabelle „| Seite | Vorlage | Text |“ (Vorlagen Cover, Textseite, Schlussseite). Seite 1 Hook mit höchstens 10 Wörtern. Seiten 2 bis 5: ein Kerngedanke, höchstens zwei kurze Sätze und 20 Wörter (eine Vorher/Nachher-Seite bis 30), keine Aufzählung, keine Nummerierung. Seite 6: Schlussseite mit klarer Handlungsaufforderung (Speichern, Teilen, Kommentieren), höchstens 26 Wörter; „Link in der Bio“ nur mit Angebot Werkzeug oder Entwurf, sonst nie.
- Caption: endet mit einer Frage an die Lesenden, höchstens 2100 Zeichen, „Link in der Bio“ nur mit Angebot. Hashtags: 1 bis 5 in der Zeile „**Hashtags:**“.
- Keine Emojis auf den Seiten, keine Deko-Nummern („01“, „1/6“), kein „Aufgabe 1/Aufgabe 2“.
- Zeile „- Mehrwert:“ ein Satz von 30 bis 220 Zeichen, beginnt mit „Du kannst“, „Du weißt“ oder „Du hast“ (oder bekommst, erkennst, findest, sparst, vermeidest). Zeilen „- Motiv:“ (englisch, 5 bis 45 Wörter, keine Marken, Personen, Schrift) und „- Familie: nacht|tag“ bleiben, wie sie sind, solange kein Grund sie betrifft.`,
  Story: `- Automatik-Fassung ${LAENGE.text[0]} bis ${LAENGE.text[1]} Zeichen in „…“, endet mit „${SCHLUSSSATZ}“. Quiz-Auflösung ${LAENGE.aufloesung[0]} bis ${LAENGE.aufloesung[1]} Zeichen, beginnt mit „Meine Sicht:“ (nur Quiz hat eine).
- Du-Form, keine Preise, keine Prozentangaben, Studien oder Statistiken, keine erfundenen Kundenstimmen, keine Erfolgsversprechen, keine Emojis im Text (nur in der Sticker-Zeile beim Schieberegler), keine Deko-Nummern. „Link in der Bio“ nur in Werkzeug-Stories. Rechtsthemen nur mit Verweis auf Anwältin oder Anwalt.
- Hintergrund bleibt eine von: ${HINTERGRUENDE.join(' | ')}. Zeilen Interaktion, Säule, Hook-Stil, Ziel, Text auf dem Hintergrund, Sticker, Automatik-Fassung, Mehrwert (ein Satz ab „Du kannst/weißt/hast“), Motiv und Familie bleiben vollständig im selben Format.
- Stories haben keine Caption und keine Hashtags: dazu nichts schreiben.`,
}

/** Prompt an Claude für die Korrektur (art: 'inhalt' oder 'gestaltung'). */
export function baueReparaturPrompt({ wort, nr, blockText, gruende, art, regeln = '', repo = null, fehler = null }) {
  const kopf = art === 'gestaltung'
    ? `Der folgende Beitrag ist bei der Gestaltungsprüfung des Renderers durchgefallen (Text passt nicht ins Bild, lässt sich nicht lesbar setzen oder liegt auf dem Motiv). Kürze Hook und Texte so, dass sie sicher passen: kürzere Hook-Zeile, kürzere Sätze, weniger Wörter pro Seite. Der Inhalt, der Mehrwert und die Fakten bleiben erhalten.`
    : `Der folgende Beitrag wurde vom unabhängigen Prüf-Agenten abgelehnt. Korrigiere ihn so, dass die genannten Gründe behoben sind.`
  return `Du bist Lektor und Faktenprüfer für den Instagram-Account @vamela.de (VAMELA, Christian Stockmeier: Webdesign und Grafikdesign für kleine Betriebe aus Haag an der Amper, Landkreis Freising).

${kopf}

# Prüfgründe (wörtlich vom Prüf-Agenten bzw. Renderer)

${gruende.map((g) => `- ${g}`).join('\n')}

# So änderst du

- Ändere NUR die bemängelten Stellen. Alles andere (Überschrift mit Nummer ${nr}, Metazeilen Säule, Hook-Stil, Angebot, Werkzeug, Repo, Lizenz, Sterne, übrige Seiten, Caption, hashtags) bleibt Wort für Wort stehen, soweit kein Grund es betrifft.
- Was nicht belegt ist, streichst du im Zweifel, statt es umzuformulieren oder zu raten. Eine Aussage über ein Werkzeug, die nicht im README-Auszug oder in der Beschreibung unten steht, fliegt raus, auf den Seiten UND in der Caption.
- Streichst du etwas und die Seite wird dadurch zu kurz, ersetze es NICHT durch eine neue Behauptung. Nimm höchstens einen Satz, der fast wörtlich im README-Auszug bzw. im Originalblock steht, oder lass die Seite kürzer. Jede neue Aussage über das Werkzeug ohne Beleg im README-Auszug (auch Verweise wie „steht im README“, „im Repo findest du …“) ist genau der Fehler, den der Prüf-Agent beim nächsten Mal wieder findet. Neue Fakten oder Zahlen ohne Beleg im Originalblock sind ebenso tabu.
- Beim Grund MEHRWERT: Der Mehrwert-Satz darf nur versprechen, was die Seiten einlösen. Entweder den Satz an den tatsächlichen Inhalt anpassen (weiterhin ein Satz, beginnt mit „Du kannst“, „Du weißt“ oder „Du hast“) oder die Seiten um den fehlenden Schritt ergänzen, ohne die Wortgrenzen zu sprengen. Das Cover verspricht den Nutzen konkret.
- Beim Grund SPRACHE: Grammatik, Artikel und Zeichensetzung auf den Seiten und in der Caption korrigieren.
- Beim Grund ANGEBOT oder CAPTION: Seiten und Caption in Einklang mit dem Angebot bringen (ohne Angebot nie „Link in der Bio“).
- Änderst du den Wortlaut einer Seite, ziehe Caption und Mehrwert-Satz nach, wenn sie dasselbe sagen.

# Feste Regeln (maschinell geprüft, ein Verstoß lässt den Versuch scheitern)

${FORMREGELN[wort]}

Auszug aus den Projektregeln (CLAUDE.md, Marke und Inhalt):

${regeln}
${repo ? `
# Quelle für das Werkzeug (GitHub, live geprüft am ${repo.daten.stand}; der Prüf-Agent hat genau diese Angaben gesehen)

- Repo: ${repo.daten.slug} (https://github.com/${repo.daten.slug})
- Lizenz: ${repo.daten.lizenz}, Sterne: ${repo.daten.sterne_text}
- Beschreibung laut GitHub: ${repo.daten.beschreibung || '(keine)'}
- ${repo.kosten.length ? `KOSTEN: Das README nennt ${repo.kosten.join(', ')}. Der Beitrag MUSS klar sagen, was davon Geld kostet.` : 'Keine Hinweise auf Bezahlangebote im README.'}
- README-Auszug (EINZIGE Quelle für Funktionen, Geräte und Grenzen; was hier nicht steht, darfst du nicht behaupten):
"""
${repo.readme}
"""
` : ''}${fehler ? `
# Dein letzter Versuch wurde vom Code abgelehnt

${fehler}
Korrigiere genau das.
` : ''}
# Originalblock (Format exakt beibehalten)

${blockText}

Gib NUR den korrigierten Block aus, mit derselben Überschrift „## ${wort} ${nr}: …“, ohne Vorwort, ohne Erklärung, ohne Codeblock und ohne Trennlinie.`
}

const SYSTEM = 'Du bist Lektor und Faktenprüfer. Du gibst ausschließlich den korrigierten Block im verlangten Format aus, ohne Vorwort und ohne Codeblock.'
const bereinige = (t) => String(t || '').trim().replace(/^```\w*\n?|```\s*$/g, '').trim().split(/\n---\s*(?:\n|$)/)[0].trim()

// ------------------------------------------------------------------------------------------------- Einzelner Beitrag

/** Live-Daten zu einem Fundstück-Repo: { daten, readme, kosten }. Wirft RepoVorlaeufig (Netz) oder gibt { fehler } zurück. */
export async function repoLiveStandard(slug) {
  const r = await pruefeRepo(slug)
  if (r.voruebergehend) throw new RepoVorlaeufig(r.probleme[0])
  if (!r.ok) return { fehler: r.probleme.join('; ') }
  let readme
  try { readme = await holeReadme(r.daten.slug, { max: 4000 }) } catch (e) { throw new RepoVorlaeufig(e.message) }
  return { daten: r.daten, readme, kosten: kostenHinweise(`${r.daten.beschreibung}\n${readme}`) }
}

/**
 * Lässt Claude einen Block korrigieren (bis zu 3 Versuche mit Rückmeldung des Codes).
 * Rückgabe: { text } bei Erfolg, { fehler } wenn alle Versuche scheiterten. Wirft ClaudeAus oder RepoVorlaeufig.
 */
export async function korrigiereBlock({ item, quelle, gruende, art, frage = frageClaude, root = ROOT, repoLive = repoLiveStandard, maxVersuche = 3 }) {
  const wort = quelle.wort
  let original
  try { original = liesBlock(wort, quelle.text)[0] } catch (e) { return { endgueltig: true, fehler: `Originalblock nicht lesbar: ${e.message}` } }
  if (!original) return { endgueltig: true, fehler: 'Originalblock nicht lesbar' }
  let repo = null
  if (wort === 'Karussell' && original.saeule === 'fundstuecke' && original.repo) {
    repo = await repoLive(original.repo)
    if (repo.fehler) return { endgueltig: true, fehler: `Repo nicht mehr verwendbar: ${repo.fehler}` }
  }
  const andere = wort === 'Story' && fs.existsSync(path.join(root, 'docs/content-stories-auto.md'))
    ? (() => { try { return readStories(path.join(root, 'docs/content-stories-auto.md')) } catch { return [] } })() : []
  const regeln = claudeRegeln(root)
  let fehler = null
  for (let i = 1; i <= maxVersuche; i++) {
    let antwort
    try {
      antwort = await frage(baueReparaturPrompt({ wort, nr: quelle.nr, blockText: quelle.text, gruende, art, regeln, repo, fehler }), { system: SYSTEM, modell: 'sonnet', timeoutMs: 600_000 })
    } catch (e) { throw new ClaudeAus(e.message) }
    const text = bereinige(antwort)
    fehler = !text.startsWith(`## ${wort} ${quelle.nr}:`)
      ? `Die Ausgabe muss mit der Überschrift „## ${wort} ${quelle.nr}: Titel“ beginnen.`
      : pruefeReparatur({ wort, text, original, andere, repo })
    if (!fehler) {
      if (text.replace(/\s+/g, ' ') === quelle.text.replace(/\s+/g, ' ')) { fehler = 'Der Block ist unverändert. Behebe die genannten Gründe.'; continue }
      return { text }
    }
  }
  return { fehler }
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Lauf über alle Kandidaten. Optionen: root, frage (zum Mocken), repoLive, max, parallel, bis (Epoch-ms), nur (Liste ids),
 * trocken, jetzt, protokoll, nachJeDrei (Rückruf zum Zwischenspeichern). Rückgabe: { repariert[], neuGerendert[], gescheitert[],
 * aufgegeben[], zurueckAufNeu[], uebersprungen, claudeAus }.
 */
export async function lauf({
  root = ROOT, frage = frageClaude, repoLive = repoLiveStandard, max = 99, parallel = 3, bis = Infinity, nur = [], trocken = false,
  jetzt = new Date(), protokoll = console.log, nachJeDrei = null, higgsfield = !!higgsfieldZugang(),
} = {}) {
  const queuePfad = path.join(root, 'plan/queue.json')
  const histPfad = path.join(root, 'data/reparaturen.json')
  const ergebnis = { repariert: [], neuGerendert: [], gescheitert: [], aufgegeben: [], zurueckAufNeu: [], uebersprungen: 0, claudeAus: false }
  const log = (m) => protokoll(m)
  const nurAuswahl = (x) => !nur.length || nur.includes(x.id)

  // --- 0. Regelkorrektur (Stories ohne Caption) und Aufgeben (alle Versuche verbraucht), im Speicher und dann gespeichert ---
  const q0 = await ladeQueue(queuePfad)
  const hist0 = ladeHistorie(histPfad)
  // Ohne Claude-CLI wird nichts verändert (auch die Regelkorrektur nicht): erst prüfen, ob überhaupt Claude gebraucht wird
  if (frage === frageClaude && !findeClaude() && q0.some((x) => {
    if (!nurAuswahl(x) || !istReparierbar(x, hist0)) return false
    const alt = veralteteStoryGruende(x)
    const rest = (x.qa?.gruende || []).filter((g) => !alt.includes(g))
    return rest.length && gruendeArt(rest) !== 'format'
  })) {
    log('Claude-CLI nicht gefunden (CLAUDE_BIN setzen oder anmelden). Nichts verändert.')
    ergebnis.claudeAus = true
    return ergebnis
  }
  {
    let geaendert = false
    for (const x of q0) {
      if (x.status !== 'abgelehnt' || !nurAuswahl(x)) continue
      const alt = veralteteStoryGruende(x)
      if (alt.length) {
        const rest = (x.qa?.gruende || []).filter((g) => !alt.includes(g))
        if (!rest.length) {
          log(`${x.id} ${x.titel}: Grund war die leere Caption bzw. der Hinweis „Link in der Bio“ in einer Werkzeug-Story, beides ist bei Stories kein Mangel mehr (Prüfregel korrigiert). Zurück auf „neu“, wird nur neu geprüft.`)
          Object.assign(x, { status: 'neu', qa: null, qa_versuche: 0, fehler: null })
          ergebnis.zurueckAufNeu.push(x.id)
        } else {
          log(`${x.id} ${x.titel}: ${alt.length} veraltete Gründe (Caption/Angebot bei Stories) gestrichen, ${rest.length} bleiben.`)
          x.qa = { ...x.qa, gruende: rest }
        }
        geaendert = true
        continue
      }
      if (istAufzugeben(x, hist0)) {
        const grund = `Nach ${MAX_REPARATUREN} Reparaturen weiterhin abgelehnt: ${(x.qa?.gruende || []).join(' | ').slice(0, 500)}`
        log(`${x.id} ${x.titel}: aufgegeben. ${grund.slice(0, 160)}`)
        Object.assign(x, { status: 'aufgegeben', reparaturen: versuche(x, hist0), aufgegeben: { am: jetzt.toISOString(), grund }, fehler: grund.slice(0, 300) })
        ergebnis.aufgegeben.push(x.id)
        geaendert = true
      }
    }
    if (geaendert && !trocken) await speichereQueue(q0, queuePfad)
  }

  // --- Kandidaten ---
  const todo = q0.filter((x) => nurAuswahl(x) && istReparierbar(x, hist0)).slice(0, max)
  if (!todo.length) { log('Keine reparierbaren Ablehnungen.'); return ergebnis }
  log(`${todo.length} Ablehnungen zu reparieren: ${todo.map((x) => `${x.id} (${gruendeArt(x.qa?.gruende)}, Versuch ${versuche(x, hist0) + 1}/${MAX_REPARATUREN})`).join(', ')}`)

  // --- Schreibzugriffe nacheinander ---
  let kette = Promise.resolve()
  const seriell = (fn) => (kette = kette.then(fn))
  let erledigt = 0
  const anHistorie = (e) => seriell(async () => {
    const h = ladeHistorie(histPfad)
    h.push(e)
    if (!trocken) speichereHistorie(h, histPfad)
  })
  const ausQueue = (id, aendern = null) => seriell(async () => {
    const q = await ladeQueue(queuePfad)
    const i = q.findIndex((x) => x.id === id)
    if (i < 0) return
    if (aendern) aendern(q[i]); else q.splice(i, 1)
    if (!trocken) await speichereQueue(q, queuePfad)
  })
  const aufgeben = (x, n, grund) => ausQueue(x.id, (e) => {
    Object.assign(e, { status: 'aufgegeben', reparaturen: n, aufgegeben: { am: jetzt.toISOString(), grund }, fehler: grund.slice(0, 300) })
  }).then(() => ergebnis.aufgegeben.push(x.id))
  const bildNeuHolen = (x, gruende) => {
    // Nur mit Higgsfield-Zugang und nur bei „Text auf Motiv“; eine Kopie aus dem Vorrat bleibt (beschaffeBild kopiert sie wieder)
    if (!higgsfield || !gruende.some((g) => /Text auf Motiv/.test(g)) || !x.bild || x.bild.anbieter === 'vorrat') return
    for (const ext of ['png', 'json']) fs.rmSync(path.join(root, 'bilder', `${x.id}.${ext}`), { force: true })
    log(`${x.id}: Bildkopie gelöscht, beschaffeBild holt ein neues Motiv.`)
  }

  const bearbeite = async (x) => {
    const gruende = x.qa?.gruende || []
    const art = gruendeArt(gruende)
    const n = versuche(x, ladeHistorie(histPfad)) + 1
    const quelle = findeQuelle(x, root)
    const eintrag = (ergebnisText, detail) => historienEintrag({ id: x.id, versuch: n, gruende, ergebnis: ergebnisText, art, detail, jetzt })
    const rendern = async (text, detail) => {
      await anHistorie(eintrag(text, detail))
      await ausQueue(x.id)
      if (!trocken) fs.rmSync(path.join(root, 'out', x.id), { recursive: true, force: true })
    }
    // Format-Fehler allein: einfach neu rendern, Claude nicht nötig
    if (art === 'format') {
      bildNeuHolen(x, gruende)
      await rendern('neu gerendert', 'Format')
      ergebnis.neuGerendert.push(x.id)
      log(`${x.id} ${x.titel}: Format-Fehler, wird neu gerendert (Versuch ${n}).`)
      return
    }
    if (!quelle) {
      const grund = `Quellblock nicht gefunden (${x.quelle}), nicht reparierbar`
      await anHistorie(eintrag('gescheitert', grund))
      await aufgeben(x, n, grund)
      log(`${x.id} ${x.titel}: ${grund}`)
      return
    }
    let r
    try { r = await korrigiereBlock({ item: x, quelle, gruende, art, frage, root, repoLive }) } catch (e) {
      if (e instanceof ClaudeAus) { ergebnis.claudeAus = true; log(`${x.id}: Claude nicht erreichbar (${String(e.message).slice(0, 160)}), Versuch zählt nicht.`); return }
      if (e instanceof RepoVorlaeufig) { log(`${x.id}: GitHub vorübergehend nicht erreichbar (${String(e.message).slice(0, 120)}), Versuch zählt nicht.`); ergebnis.uebersprungen++; return }
      throw e
    }
    if (r.endgueltig) {
      await anHistorie(eintrag('gescheitert', r.fehler))
      await aufgeben(x, n, r.fehler)
      log(`${x.id} ${x.titel}: aufgegeben. ${r.fehler}`)
      return
    }
    if (!r.text) {
      await anHistorie(eintrag('gescheitert', r.fehler))
      if (n >= MAX_REPARATUREN) {
        await aufgeben(x, n, `Nach ${MAX_REPARATUREN} Reparaturen weiterhin abgelehnt (letzter Versuch scheiterte am Code: ${String(r.fehler).slice(0, 200)}): ${gruende.join(' | ').slice(0, 300)}`)
        log(`${x.id} ${x.titel}: Reparatur ${n}/${MAX_REPARATUREN} gescheitert (${String(r.fehler).slice(0, 160)}), aufgegeben.`)
      } else {
        await ausQueue(x.id, (e) => { e.reparaturen = n })
        log(`${x.id} ${x.titel}: Reparatur ${n}/${MAX_REPARATUREN} gescheitert: ${String(r.fehler).slice(0, 200)}`)
      }
      ergebnis.gescheitert.push(x.id)
      return
    }
    // Block in der Quelldatei ersetzen (frisch gelesen, nacheinander, Gesamtdatei danach noch einmal geparst)
    let geschrieben = false
    await seriell(async () => {
      const md = fs.readFileSync(quelle.pfad, 'utf8')
      const neu = ersetzeBlock(md, quelle.wort, quelle.nr, r.text)
      if (neu == null) return
      const pruefDatei = path.join(os.tmpdir(), `rep-ganz-${process.pid}-${x.id}.md`)
      try {
        fs.writeFileSync(pruefDatei, neu)
        LESER[quelle.wort](pruefDatei)
      } catch (e) { log(`${x.id}: Gesamtdatei nach dem Ersetzen nicht lesbar (${e.message}), nichts geschrieben.`); return } finally { fs.rmSync(pruefDatei, { force: true }) }
      if (!trocken) fs.writeFileSync(quelle.pfad, neu)
      geschrieben = true
    })
    if (!geschrieben) { await anHistorie(eintrag('gescheitert', 'Block konnte nicht geschrieben werden')); ergebnis.gescheitert.push(x.id); return }
    bildNeuHolen(x, gruende)
    await rendern('repariert')
    ergebnis.repariert.push(x.id)
    log(`${x.id} ${x.titel}: repariert (Versuch ${n}/${MAX_REPARATUREN}), wird neu gerendert und geprüft. Gründe waren: ${gruende.join(' | ').slice(0, 200)}`)
  }

  let next = 0
  const worker = async () => {
    while (next < todo.length) {
      if (Date.now() >= bis || ergebnis.claudeAus) { ergebnis.uebersprungen += todo.length - next; return }
      const x = todo[next++]
      try { await bearbeite(x) } catch (e) {
        // Unerwarteter Fehler zählt als Versuch, damit derselbe Fehler nicht endlos wiederholt wird
        log(`${x.id}: Fehler beim Reparieren: ${String(e.message).slice(0, 200)}`)
        const n = versuche(x, ladeHistorie(histPfad)) + 1
        await anHistorie(historienEintrag({ id: x.id, versuch: n, gruende: x.qa?.gruende, ergebnis: 'gescheitert', art: gruendeArt(x.qa?.gruende), detail: e.message, jetzt }))
        await ausQueue(x.id, (q) => { q.reparaturen = n })
        ergebnis.gescheitert.push(x.id)
      }
      if (++erledigt % 3 === 0 && nachJeDrei) { await kette; nachJeDrei() }
      await pause(0)
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallel, todo.length) }, worker))
  await kette
  return ergebnis
}

// ------------------------------------------------------------------------------------------------- Kommandozeile

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2)
  const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d)
  const trocken = args.includes('--trocken')
  const gitSichern = () => {
    if (!process.env.GITHUB_ACTIONS) return
    try { execFileSync('node', ['automatik/sichern.mjs', 'Reparatur: Zwischenstand', 'plan', 'docs', 'data', 'out'], { cwd: ROOT, stdio: 'inherit' }) } catch (e) { console.log('Zwischenspeichern fehlgeschlagen: ' + String(e.message).slice(0, 120)) }
  }
  const e = await lauf({
    root: path.resolve(opt('--root', ROOT)), max: +opt('--max', 99), parallel: +opt('--parallel', 3), bis: +opt('--bis', Infinity), nur: (opt('--nur', '') || '').split(',').filter(Boolean),
    trocken, nachJeDrei: gitSichern,
  })
  gitSichern()
  console.log(`Reparatur: ${e.repariert.length} repariert (${e.repariert.join(', ') || '–'}), ${e.neuGerendert.length} neu zu rendern, ${e.gescheitert.length} gescheitert (${e.gescheitert.join(', ') || '–'}), ${e.aufgegeben.length} aufgegeben (${e.aufgegeben.join(', ') || '–'}), ${e.zurueckAufNeu.length} zurück auf „neu“ (${e.zurueckAufNeu.join(', ') || '–'}), ${e.uebersprungen} übersprungen.`)
  // Wie qa-lauf.mjs: Exit-Code 3 nur, wenn wegen Claude gar nichts voranging (fill.mjs bricht dann ab statt zu wiederholen)
  if (e.claudeAus && !e.repariert.length && !e.neuGerendert.length) { console.log('Claude nicht erreichbar: Exit-Code 3.'); process.exit(3) }
}
