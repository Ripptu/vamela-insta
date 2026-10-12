// QA-Agent: unabhängige Prüfung eines fertigen Beitrags gegen die festen Regeln aus CLAUDE.md.
//
//   import { pruefe } from './qa.mjs'
//   const { verdikt, gruende } = await pruefe(item, absVerzeichnis)
//
// Ablauf:
//  1. Harte Messungen im Code (Format 1080×1350 bzw. 1080×1920, Dateien vorhanden, Hashtag-Zählung, „Link in der Bio",
//     Preise und vamela.de-Adressen nur aus data/fakten.json, Pflichtzeile „Mehrwert“ im Vorratsblock, jedes genannte
//     GitHub-Repo live geprüft: existiert, gepflegt, Lizenz, Angaben zu Lizenz und Sternen stimmen; automatik/repo-check.mjs).
//     Mehrwert-Satz und Repo-Fakten (Beschreibung, README-Auszug) bekommt der Prüf-Agent als Beitragsdaten.
//  2. Eigener Claude-Aufruf über die Claude-CLI (`claude -p`, nur Werkzeug Read, temporäres Arbeitsverzeichnis mit
//     Bildkopien). Er bekommt KEIN Herstellungswissen: nur die Prüfliste (qa/regeln.md), die Bilder bzw. Videoframes,
//     eine Übersicht in Daumennagelgröße und die Caption samt Hashtags.
//  3. Das Verdikt wird im Code aus der Punkteliste abgeleitet. Jeder Fehler (auch Aufruf-, Parse- oder Vollständigkeitsfehler)
//     führt zu 'abgelehnt', nie stillschweigend zu 'ok'.
//
// Kosten: nur Abo. ANTHROPIC_API_KEY (und verwandte Schlüssel) werden aus der Umgebung des Kindprozesses entfernt;
// angemeldet wird über CLAUDE_CODE_OAUTH_TOKEN (Action) bzw. die Anmeldung der Claude-App/CLI.
//
// Umgebungsvariablen: CLAUDE_BIN (Pfad zur CLI), QA_MODEL (Standard „sonnet"), QA_TIMEOUT_MS (Standard 600000),
// QA_BEHALTEN=1 (temporäres Verzeichnis nicht löschen, zum Debuggen), FFMPEG_DIR (Ordner mit ffmpeg/ffprobe).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import sharp from 'sharp'
import { pruefeText } from './fakten.mjs'
import { felderFuer } from './block-felder.mjs'
import { pruefeRepo, holeReadme, kostenHinweise, pruefeRepoAngaben, repoAdressen } from './repo-check.mjs'

const HERE = new URL('.', import.meta.url).pathname
const REGELN_DATEI = path.join(HERE, 'qa/regeln.md')
const NICHT_DURCHFUEHRBAR = 'Prüfung nicht durchführbar'
const MODELL = process.env.QA_MODEL || 'sonnet'
const TIMEOUT_MS = +process.env.QA_TIMEOUT_MS || 600_000
const VIDEO = /\.(mp4|mov|m4v)$/i

/** Findet die Claude-CLI: CLAUDE_BIN, `claude` im PATH, sonst die der Desktop-App (höchste Version). */
export function findeClaude() {
  const ok = (p) => { try { fs.accessSync(p, fs.constants.X_OK); return fs.statSync(p).isFile() } catch { return false } }
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN
  for (const dir of (process.env.PATH || '').split(path.delimiter)) if (dir && ok(path.join(dir, 'claude'))) return path.join(dir, 'claude')
  const root = path.join(os.homedir(), 'Library/Application Support/Claude/claude-code')
  if (fs.existsSync(root)) {
    const versionen = fs.readdirSync(root).filter((v) => /^\d+(\.\d+)*$/.test(v))
      .sort((a, b) => { const A = a.split('.').map(Number), B = b.split('.').map(Number); for (let i = 0; i < Math.max(A.length, B.length); i++) if ((A[i] || 0) !== (B[i] || 0)) return (A[i] || 0) - (B[i] || 0); return 0 })
    for (const v of versionen.reverse()) { const p = path.join(root, v, 'claude.app/Contents/MacOS/claude'); if (ok(p)) return p }
  }
  return null
}

function ffTool(name) {
  const dirs = [process.env.FFMPEG_DIR, path.join(os.homedir(), '.local/ffmpeg/bin')].filter(Boolean)
  for (const d of dirs) if (fs.existsSync(path.join(d, name))) return path.join(d, name)
  return name
}

/** Prüfpunkte aus der Regeldatei: Zeilen der Form „- **KENNUNG**: Text". */
function ladeRegeln() {
  const text = fs.readFileSync(REGELN_DATEI, 'utf8')
  const ids = [...text.matchAll(/^- \*\*([A-ZÄÖÜ]+)\*\*:/gm)].map((m) => m[1])
  if (!ids.length) throw new Error('keine Prüfpunkte in qa/regeln.md')
  return { text, ids }
}

function findeDatei(datei, basis) {
  const kandidaten = path.isAbsolute(datei) ? [datei] : [path.resolve(basis, datei), path.resolve(basis, path.basename(datei))]
  return kandidaten.find((k) => fs.existsSync(k)) || null
}

/** Hashtags aus Feld und Caption zählen (eindeutig). */
export function zaehleHashtags(item) {
  const feld = Array.isArray(item.hashtags) ? item.hashtags.join(' ') : String(item.hashtags || '')
  const alle = `${feld}\n${item.caption || ''}`.match(/#[\p{L}\p{N}_]+/gu) || []
  return [...new Set(alle.map((h) => h.toLowerCase()))]
}

/** Bereitet Bilder vor: kopiert sie ins temporäre Verzeichnis, extrahiert Videoframes, misst Formate. */
async function bereiteVor(item, basis, tmp) {
  const gruende = []
  const dateien = Array.isArray(item.dateien) ? item.dateien : []
  const soll = item.typ === 'story' || item.typ === 'reel' ? [1080, 1920] : [1080, 1350]
  const seiten = [] // { name, quelle, rolle }
  if (!dateien.length) gruende.push('Format: keine Dateien im Beitrag')
  let nr = 0
  for (const d of dateien) {
    const abs = findeDatei(d, basis)
    if (!abs) { gruende.push(`Format: Datei fehlt (${d})`); continue }
    if (VIDEO.test(abs)) {
      try {
        const probe = JSON.parse(execFileSync(ffTool('ffprobe'), ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', abs], { maxBuffer: 1e7 }).toString())
        const v = probe.streams.find((s) => s.codec_type === 'video')
        const a = probe.streams.find((s) => s.codec_type === 'audio')
        const dauer = +probe.format.duration || 0
        if (!v) throw new Error('kein Videostrom')
        if (v.width !== soll[0] || v.height !== soll[1]) gruende.push(`Format: Video ${v.width}×${v.height}, erwartet ${soll[0]}×${soll[1]}`)
        if (v.codec_name !== 'h264') gruende.push(`Format: Videocodec ${v.codec_name}, erwartet h264`)
        if (item.typ === 'reel' && a && a.codec_name !== 'aac') gruende.push(`Format: Audiocodec ${a.codec_name}, erwartet aac`)
        const n = Math.min(6, Math.max(3, Math.round(dauer / 3)))
        for (let i = 0; i < n; i++) {
          const t = Math.max(0, Math.min(dauer - 0.1, (dauer * (i + 0.5)) / n))
          nr++
          const name = `frame-${String(nr).padStart(2, '0')}.jpg`
          execFileSync(ffTool('ffmpeg'), ['-v', 'error', '-y', '-ss', t.toFixed(2), '-i', abs, '-frames:v', '1', '-q:v', '2', path.join(tmp, name)])
          seiten.push({ name, rolle: `Videoframe bei ${t.toFixed(1)} s (${path.basename(abs)})` })
        }
      } catch (e) {
        gruende.push(`Format: Video nicht lesbar (${path.basename(abs)}: ${String(e.message).split('\n')[0]})`)
      }
      continue
    }
    try {
      const meta = await sharp(abs).metadata()
      if (meta.width !== soll[0] || meta.height !== soll[1]) gruende.push(`Format: Seite ${nr + 1} ist ${meta.width}×${meta.height}, erwartet ${soll[0]}×${soll[1]}`)
      nr++
      const name = `seite-${String(nr).padStart(2, '0')}.jpg`
      // Immer als JPG kopieren (ohne Skalierung), damit Namen und Format für die Prüfung einheitlich sind.
      await sharp(abs).rotate().flatten({ background: '#000' }).jpeg({ quality: 95 }).toFile(path.join(tmp, name))
      seiten.push({ name, rolle: `Seite ${nr}` })
    } catch (e) {
      gruende.push(`Format: Bild nicht lesbar (${path.basename(abs)})`)
    }
  }
  if (item.typ === 'karussell' && dateien.length > 10) gruende.push(`Format: ${dateien.length} Seiten, Instagram erlaubt höchstens 10`)
  if (item.typ === 'karussell' && dateien.length === 1) gruende.push('Format: Karussell mit nur einer Seite')

  // Übersicht in Daumennagelgröße (wie im Profilraster / Feed-Vorschau)
  if (seiten.length) {
    const TW = 270, TH = Math.round((TW * soll[1]) / soll[0]), spalten = Math.min(4, seiten.length)
    const zeilen = Math.ceil(seiten.length / spalten), gap = 8
    const teile = []
    for (let i = 0; i < seiten.length; i++) {
      const buf = await sharp(path.join(tmp, seiten[i].name)).resize(TW, TH, { fit: 'fill' }).jpeg({ quality: 88 }).toBuffer()
      teile.push({ input: buf, left: (i % spalten) * (TW + gap), top: Math.floor(i / spalten) * (TH + gap) })
    }
    await sharp({ create: { width: spalten * TW + (spalten - 1) * gap, height: zeilen * TH + (zeilen - 1) * gap, channels: 3, background: '#ffffff' } })
      .composite(teile).jpeg({ quality: 88 }).toFile(path.join(tmp, 'uebersicht.jpg'))
  }
  return { gruende, seiten, soll }
}

function bauePrompt(item, regeln, seiten, { mehrwert = null, repos = [] } = {}) {
  const heute = new Date().toISOString().slice(0, 10)
  const hashtags = Array.isArray(item.hashtags) ? item.hashtags.join(' ') : String(item.hashtags || '')
  const liste = seiten.map((s) => `- ${s.name} (${s.rolle})`).join('\n')
  const hatUebersicht = seiten.length > 0
  return `Prüfe den folgenden fertigen Instagram-Beitrag streng anhand der Prüfliste. Du weißt nichts darüber, wie er hergestellt wurde, und sollst es auch nicht wissen. Urteile nur nach dem, was du siehst und liest. Lies alle Bilder mit dem Read-Tool, bevor du urteilst.

Heutiges Datum: ${heute}

# Prüfliste

${regeln.text}

# Beitragsdaten

- Typ: ${item.typ || 'karussell'}
- Angebot (angebot): ${item.angebot || 'keins'}${item.werkzeug ? `\n- Werkzeug: vamela.de${item.werkzeug}` : ''}
- Säule: ${item.saeule || '–'}
- Titel: ${item.titel || ''}
- Mehrwert (was der Beitrag laut Redaktion liefern soll, prüfe, ob die Seiten es einlösen): ${mehrwert || '(fehlt)'}
${repos.map((r) => `
# Repo-Fakten zu ${r.daten.slug} (live von der GitHub-API, Stand ${r.daten.stand})

- Adresse: github.com/${r.daten.slug}
- Lizenz laut GitHub: ${r.daten.lizenz}
- Sterne live: ${r.daten.sterne} (im Beitrag nur gerundet mit „Stand“ erlaubt)
- Beschreibung laut GitHub: ${r.daten.beschreibung || '(keine)'}
- Hinweise auf Bezahlangebote im README: ${r.kosten.length ? r.kosten.join(', ') : 'keine'}
- README-Auszug (einzige Quelle für Funktionen):
"""
${r.readme}
"""`).join('\n')}

Caption:
"""
${item.caption || ''}
"""

Hashtags: ${hashtags || '(keine)'}

# Bilddateien im Arbeitsverzeichnis (mit dem Read-Tool lesen, jede einzeln)

${liste}
${hatUebersicht ? '- uebersicht.jpg (alle Seiten verkleinert nebeneinander, zur Prüfung der Lesbarkeit in Daumennagelgröße)' : ''}

# Vorgehen und Ausgabe

1. Lies jede Bilddatei und die Übersicht. Betrachte jede Seite genau: Ist etwas abgeschnitten oder überlappt? Ist der Absender VAMELA erkennbar? Sind fremde Logos, Marken oder Bildschirmfotos fremder Seiten zu sehen? Liegt etwas über einem Gesicht? Stimmt die Rechtschreibung?
2. Prüfe den Mehrwert: Verspricht das Cover einen konkreten Nutzen, und lösen die Seiten den Mehrwert-Satz ein? Gibt es Repo-Fakten, vergleiche jede Aussage über das Werkzeug mit Beschreibung und README-Auszug.
3. Lies Caption und alle Seitentexte auf erfundene Kundenstimmen, Erfolgszahlen, Studien und Prozentangaben, Erfolgsversprechen, Rechtsberatung, Preise, Marktschreier-Ton, KI-Floskeln, Angebot und Hashtag-Zahl.
4. Bewerte JEDEN Punkt der Prüfliste. Im Zweifel bei einem plausiblen Verstoß: fehler. Lege den Maßstab streng an, aber melde nichts, was nicht in den Bildern oder der Caption zu sehen ist.
5. Antworte ausschließlich mit einem einzigen JSON-Objekt, ohne Text davor oder danach und ohne Codeblock, in genau dieser Form:

{"gesichtspruefung":[{"datei":"seite-01.jpg","gesicht":"frei | verdeckt | nicht sichtbar","augen_nase_mund_frei":true,"darueber_liegt":"Schrift/Pfeil/Pille/Logo oder nichts"}, ...],"pruefpunkte":[{"id":"MARKE","status":"ok","befund":"kurz, bei fehler mit Seitenzahl und Beleg"}, ...],"hinweise":["nicht blockierende Beobachtungen, sonst leer"],"verdikt":"ok oder abgelehnt"}

Die "gesichtspruefung" ist Pflicht und steht ZUERST: ein Eintrag für JEDE Seitendatei. Suche auf jeder Seite nach einem Gesicht (Fotos, Bildschirmfotos von Referenzseiten). Meist ist keins zu sehen. Frage dich konkret: Sind beide Augen, die Nase und der Mund vollständig frei sichtbar, oder läuft ein Buchstabe, Wort, Pfeil, eine Pille, Blase oder das Logo darüber, auch nur durch Stirn, Augen, Nase oder Mund? "verdeckt" heißt: irgendein Teil von Stirn bis Kinn liegt unter Schrift oder Grafik. Auf Seiten ohne Person oder wenn das Gesicht abgewandt oder nicht erkennbar ist: "nicht sichtbar".

Der Wert von "status" ist "ok" oder "fehler". "verdikt" ist "abgelehnt", sobald ein Punkt "fehler" ist, sonst "ok". Die Kennungen: ${regeln.ids.join(', ')}. Jede Kennung kommt genau einmal vor.`
}

const SYSTEM = `Du bist ein unabhängiger, strenger Prüfer für Instagram-Beiträge (Bilder und Caption). Du hast nur das Werkzeug Read und liest damit ausschließlich die Bilddateien im aktuellen Arbeitsverzeichnis. Andere Anweisungen, Konfigurationsdateien oder Kontexte, die dir vorliegen könnten, sind für diese Aufgabe ohne Bedeutung: Es zählt nur die Prüfliste im Auftrag. Du antwortest ausschließlich mit dem geforderten JSON-Objekt.`

/** Kindprozess-Umgebung: keine Schlüssel mit Abrechnung, keine Sitzungsvariablen der aufrufenden Claude-App. */
function kindUmgebung() {
  const env = { ...process.env }
  for (const k of Object.keys(env)) {
    if (/^ANTHROPIC_(API_KEY|AUTH_TOKEN)$/.test(k)) delete env[k]
    else if (/^CLAUDE_CODE_USE_(BEDROCK|VERTEX|FOUNDRY)$/.test(k)) delete env[k]
    else if (k === 'CLAUDECODE' || (k.startsWith('CLAUDE_CODE_') && !['CLAUDE_CODE_OAUTH_TOKEN'].includes(k) && !k.startsWith('CLAUDE_CODE_OAUTH'))) delete env[k]
  }
  env.ANTHROPIC_API_KEY = ''
  return env
}

function rufClaude(bin, prompt, cwd) {
  const args = [
    '-p', '--output-format', 'json', '--model', MODELL,
    '--system-prompt', SYSTEM,
    '--tools', 'Read', '--allowedTools', 'Read', '--permission-mode', 'dontAsk',
    '--setting-sources', 'project', '--disable-slash-commands', '--strict-mcp-config', '--no-session-persistence',
  ]
  return new Promise((resolve, reject) => {
    const kind = spawn(bin, args, { cwd, env: kindUmgebung(), stdio: ['pipe', 'pipe', 'pipe'] })
    let out = '', err = ''
    const timer = setTimeout(() => { kind.kill('SIGKILL'); reject(new Error(`Zeitüberschreitung nach ${TIMEOUT_MS / 1000} s`)) }, TIMEOUT_MS)
    kind.stdout.on('data', (d) => (out += d))
    kind.stderr.on('data', (d) => (err += d))
    kind.on('error', (e) => { clearTimeout(timer); reject(e) })
    kind.on('close', (code) => { clearTimeout(timer); resolve({ code, out, err }) })
    kind.stdin.on('error', () => {})
    kind.stdin.end(prompt)
  })
}

/** Erstes vollständiges JSON-Objekt aus einem Text holen (toleriert Codeblöcke und Text davor/danach). */
export function extrahiereJson(text) {
  if (typeof text !== 'string') return null
  const s = text.replace(/```(?:json)?/gi, '')
  for (let start = s.indexOf('{'); start !== -1; start = s.indexOf('{', start + 1)) {
    let tiefe = 0, inStr = false, esc = false
    for (let i = start; i < s.length; i++) {
      const c = s[i]
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue }
      if (c === '"') inStr = true
      else if (c === '{') tiefe++
      else if (c === '}' && --tiefe === 0) {
        try { const o = JSON.parse(s.slice(start, i + 1)); if (o && typeof o === 'object' && Array.isArray(o.pruefpunkte)) return o } catch { /* nächster Anfang */ }
        break
      }
    }
  }
  return null
}

/** Ergebnis der CLI (`--output-format json`) auslesen und validieren. Wirft bei Problemen. */
export function wertAus(stdout, ids) {
  let huelle
  try { huelle = JSON.parse(stdout) } catch { huelle = null }
  // Neuere CLI-Versionen liefern ein Objekt, ältere ein Array von Ereignissen; beides abdecken.
  const eintrag = Array.isArray(huelle) ? [...huelle].reverse().find((e) => e && e.type === 'result') : huelle
  if (!eintrag) throw new Error('CLI-Ausgabe ist kein JSON')
  if (eintrag.is_error) throw new Error(`CLI meldet Fehler: ${String(eintrag.result || eintrag.subtype || '').slice(0, 200)}`)
  const antwort = eintrag.structured_output ?? eintrag.result
  const o = typeof antwort === 'object' && antwort && Array.isArray(antwort.pruefpunkte) ? antwort : extrahiereJson(antwort)
  if (!o) throw new Error('kein auswertbares JSON im Ergebnisfeld')
  const punkte = new Map()
  for (const p of o.pruefpunkte) {
    if (p && typeof p.id === 'string') punkte.set(p.id.toUpperCase(), { status: String(p.status).toLowerCase(), befund: String(p.befund || '') })
  }
  const gesichter = Array.isArray(o.gesichtspruefung) ? o.gesichtspruefung : []
  const fehlend = ids.filter((id) => !punkte.has(id))
  if (fehlend.length) throw new Error(`Prüfpunkte fehlen in der Antwort: ${fehlend.join(', ')}`)
  for (const [id, p] of punkte) if (!['ok', 'fehler'].includes(p.status)) throw new Error(`Ungültiger Status bei ${id}: ${p.status}`)
  return { punkte, gesichter, hinweise: Array.isArray(o.hinweise) ? o.hinweise.map(String) : [], modellVerdikt: String(o.verdikt || '').toLowerCase() }
}

/**
 * Prüft einen Queue-Eintrag.
 * @param item  Queue-Eintrag (typ, angebot, caption, hashtags, dateien, titel, …)
 * @param absVerzeichnis  Ordner, gegen den `item.dateien` aufgelöst wird (Repo-Wurzel oder Ausgabeordner;
 *                        gefunden wird auch der bloße Dateiname im Ordner). Absolute Dateipfade gehen ebenfalls.
 * @returns {{verdikt:'ok'|'abgelehnt', gruende:string[], hinweise?:string[], dauerMs?:number}}
 */
export async function pruefe(item, absVerzeichnis) {
  const t0 = Date.now()
  const nichtDurchfuehrbar = (grund) => ({ verdikt: 'abgelehnt', gruende: [`${NICHT_DURCHFUEHRBAR}: ${grund}`], dauerMs: Date.now() - t0 })
  let tmp
  try {
    const regeln = ladeRegeln()
    const bin = findeClaude()
    if (!bin) return nichtDurchfuehrbar('Claude-CLI nicht gefunden (CLAUDE_BIN setzen)')
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vamela-qa-'))
    const basis = path.resolve(absVerzeichnis || '.')

    // 1. harte Messungen
    const gruende = []
    const { gruende: formatGruende, seiten } = await bereiteVor(item, basis, tmp)
    gruende.push(...formatGruende)
    if (!seiten.length) return { verdikt: 'abgelehnt', gruende: gruende.length ? gruende : ['Format: keine prüfbaren Bilder'], dauerMs: Date.now() - t0 }
    const tags = zaehleHashtags(item)
    if (tags.length > 5) gruende.push(`HASHTAGS: ${tags.length} Hashtags, erlaubt sind höchstens 5`)
    if (item.typ !== 'story' && !String(item.caption || '').trim()) gruende.push('CAPTION: Caption fehlt')
    if (item.angebot && item.angebot !== 'keins' && !/link in der bio/i.test(item.caption || '')) gruende.push('ANGEBOT: Angebot ohne den Hinweis „Link in der Bio“ in der Caption')
    for (const f of pruefeText(`${item.caption || ''}\n${item.hook || ''}${item.werkzeug ? `\nvamela.de${item.werkzeug}` : ''}`)) gruende.push(`FAKTEN: ${f}`)
    // Mehrwert (Pflichtzeile im Vorratsblock) und GitHub-Repos (Säule fundstuecke oder jede github.com-Adresse in der Caption)
    const felder = felderFuer(item) || {}
    const mehrwert = item.mehrwert || felder.mehrwert || null
    if (!mehrwert) gruende.push('MEHRWERT: Pflichtzeile „Mehrwert“ fehlt im Vorratsblock')
    const eigenesRepo = item.repo || felder.repo || null
    const slugs = [...new Map([eigenesRepo, ...repoAdressen(`${item.caption || ''}\n${item.hook || ''}`)].filter(Boolean).map((x) => [x.toLowerCase(), x])).values()]
    if (item.saeule === 'fundstuecke' && !eigenesRepo) gruende.push('REPO: Säule fundstuecke ohne Zeile „Repo“ im Vorratsblock')
    const repos = []
    for (const slug of slugs) {
      const r = await pruefeRepo(slug)
      if (r.voruebergehend) return nichtDurchfuehrbar(`GitHub: ${r.probleme[0]}`)
      if (!r.ok) { gruende.push(...r.probleme.map((p) => `REPO: ${p}`)); continue }
      let readme
      try { readme = await holeReadme(r.daten.slug, { max: 4000 }) } catch (e) { return nichtDurchfuehrbar(`GitHub: ${e.message}`) }
      const kosten = kostenHinweise(`${r.daten.beschreibung}\n${readme}`)
      if (eigenesRepo && slug.toLowerCase() === eigenesRepo.toLowerCase()) {
        for (const p of pruefeRepoAngaben({ repo: eigenesRepo, lizenz: felder.lizenz ?? item.lizenz, sterne: felder.sterne ?? item.sterne, caption: item.caption }, r.daten, { kosten })) gruende.push(`REPO: ${p}`)
      }
      repos.push({ daten: r.daten, readme, kosten })
    }

    // 2. Claude-Aufruf (ein Wiederholungsversuch bei Aufruf- oder Parsefehlern)
    const prompt = bauePrompt(item, regeln, seiten, { mehrwert, repos })
    let ergebnis = null, letzterFehler = ''
    for (let versuch = 1; versuch <= 2 && !ergebnis; versuch++) {
      try {
        const r = await rufClaude(bin, prompt, tmp)
        if (r.code !== 0 && !r.out.trim()) throw new Error(`CLI beendet mit Code ${r.code}: ${r.err.trim().slice(0, 200)}`)
        ergebnis = wertAus(r.out, regeln.ids)
      } catch (e) {
        letzterFehler = String(e.message || e)
      }
    }
    if (!ergebnis) return { verdikt: 'abgelehnt', gruende: [`${NICHT_DURCHFUEHRBAR}: ${letzterFehler}`, ...gruende], dauerMs: Date.now() - t0 }

    // 3. Verdikt im Code ableiten
    const schonGemessen = new Set(gruende.map((g) => g.split(':')[0]))
    for (const id of regeln.ids) {
      const p = ergebnis.punkte.get(id)
      if (p.status === 'fehler' && !(id === 'HASHTAGS' && schonGemessen.has(id))) gruende.push(`${id}: ${p.befund || 'Verstoß (ohne Beleg)'}`)
    }
    // Gesichtsprüfung je Seite: jede verdeckte Seite ist ein Fehler, unabhängig vom Gesamturteil des Modells
    for (const g of ergebnis.gesichter) {
      const status = String(g.gesicht || '').toLowerCase()
      const darueber = String(g.darueber_liegt || '').toLowerCase().trim()
      const nichtsDarueber = !darueber || /^(nichts|keine?s?|-|n\/a)\b/.test(darueber)
      // abgewandtes oder nicht erkennbares Gesicht ist kein Fehler; verdeckt heißt: etwas liegt darüber
      const verdeckt = !nichtsDarueber && (status.startsWith('verdeckt') || (g.augen_nase_mund_frei === false && !status.startsWith('nicht')))
      if (verdeckt && !gruende.some((x) => x.startsWith('GESICHT'))) gruende.push(`GESICHT: ${g.datei}: ${g.darueber_liegt || 'Text oder Grafik liegt über dem Gesicht'}`)
    }
    if (ergebnis.modellVerdikt === 'abgelehnt' && !gruende.length) gruende.push('Prüf-Agent hat abgelehnt, ohne einen Punkt zu nennen')
    return { verdikt: gruende.length ? 'abgelehnt' : 'ok', gruende, hinweise: ergebnis.hinweise, dauerMs: Date.now() - t0 }
  } catch (e) {
    return nichtDurchfuehrbar(String(e.message || e))
  } finally {
    if (tmp && !process.env.QA_BEHALTEN) fs.rmSync(tmp, { recursive: true, force: true })
  }
}
