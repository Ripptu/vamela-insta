// TikTok-Videos voll automatisch: Thema und Skript (Claude über das Abo), Regelprüfung im Code, Stimme, HyperFrames-Video
// nach der Vorlage video/tiktok (Baukasten aus video/bewertung), Upload über die Content Posting API.
// Christian, 03.11.2026: jeden Tag 2 TikTok-Videos, öffentlich und ohne Freigabe (bewusst so entschieden).
//
// Aufruf: node automatik/tiktok-video.mjs [--anzahl=1] [--modus=auto|oeffentlich|privat|entwurf] [--echt] [--inhalt=datei.json] [--saeule=tipps] [--nur-skript]
//   auto         öffentlich (Direct Post). Lehnt TikTok das ab, weil die App den Direct-Post-Audit noch nicht hat
//                („unaudited_client_can_only_post_to_private_accounts“, gilt ohne Audit auch für SELF_ONLY, solange das
//                Konto öffentlich ist), geht das Video als Entwurf ins TikTok-Postfach. Mit plan/params.json
//                tiktok.video_ersatz = „privat“ wird vorher SELF_ONLY versucht (klappt nur bei privatem Konto).
//   oeffentlich  nur öffentlich, sonst Fehler
//   privat       Direct Post mit SELF_ONLY, ohne Audit ersatzweise Entwurf
//   entwurf      ins TikTok-Postfach, Christian tippt auf „Posten“ (Titel aus <video>.txt)
// Ohne --echt: alles bis zum fertigen MP4, kein Upload. Mit Datei PAUSE im Repo: nichts.
// Mit ZERNIO_API_KEY postet Zernio öffentlich (eigene App nur noch als Rückfall, dann Entwurf ins Postfach).
// Umgebung: CLAUDE_CODE_OAUTH_TOKEN (Abo), ZERNIO_API_KEY, TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, MEDIA_REPO, MEDIA_TOKEN;
// Stimme siehe video/tiktok/scripts/stimme.mjs (Liam über ElevenLabs mit ELEVENLABS_API_KEY, sonst Piper).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { findeClaude } from './qa.mjs'
import { VERBOTEN as FLOSKELN, MAX_WOERTER, formeln } from './hook-wahl.mjs'
import { gueltigerToken, post, hochladen, aufraeumen, speichereKonto } from './tiktok.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const VORLAGE = path.join(ROOT, 'video/tiktok')
const VERLAUF = path.join(ROOT, 'data/tiktok-videos.json')
const ARBEIT = path.join(ROOT, 'out/tiktok-video')
const HF = 'hyperframes@0.9.8'
const MODELL = process.env.TIKTOK_MODELL || 'sonnet'
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d }
const hat = (k) => process.argv.includes(`--${k}`)
const warte = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(...a)

const fakten = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/fakten.json'), 'utf8'))
const params = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'plan/params.json'), 'utf8')).tiktok || {} } catch { return {} } })()
const ladeVerlauf = () => { try { return JSON.parse(fs.readFileSync(VERLAUF, 'utf8')) } catch { return [] } }
const speichereVerlauf = (v) => fs.writeFileSync(VERLAUF, JSON.stringify(v, null, 2) + '\n')

// ---------- Regeln (fest, im Code geprüft) ----------
const TYPEN = ['hook', 'problem', 'schritte', 'vergleich', 'merksatz', 'werkzeug', 'schluss']
const SYMBOLE = ['herz', 'stern', 'lupe', 'uhr', 'handy', 'warnung', 'haken', 'kreuz', 'blitz', 'idee', 'schloss', 'ort', 'brief', 'auge', 'bild', 'stift', 'daumen', 'chat', 'geschenk']
const WERKZEUG_PFADE = fakten.werkzeuge.map((w) => w.pfad).filter((p) => p !== '/werkzeuge')
const PREISE = fakten.preise.map((p) => p.text)
const VERBOTEN = [/garantiert/i, /platz\s*1\b/i, /rechtssicher/i, /abmahnsicher/i, /\bstudie/i, /prozent/i, /%/, /rabatt/i, /aktion(spreis)?\b/i, /nur heute/i]
const EMOJI = /\p{Extended_Pictographic}/u
const woerter = (s) => String(s || '').trim().split(/\s+/).filter(Boolean)
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\d ]+/gu, ' ')
const STOPP = new Set('der die das und oder mit für fur von auf in im ist sind ein eine einen dein deine deinen du dich dir so wie was warum mehr kein keine nicht zu zum zur am an es bei'.split(' '))
const stich = (s) => new Set(norm(s).split(/\s+/).filter((w) => w.length > 2 && !STOPP.has(w)))
const aehnlich = (a, b) => { const A = stich(a), B = stich(b); if (!A.size || !B.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.min(A.size, B.size) }

export function pruefeSkript(s, verlauf = [], heute = new Date()) {
  const f = []
  if (!s || typeof s !== 'object') return ['kein JSON-Objekt']
  for (const k of ['thema', 'suchbegriff', 'titel', 'beschreibung', 'mehrwert', 'saeule']) if (!String(s[k] || '').trim()) f.push(`Feld ${k} fehlt`)
  if (s.suchbegriff && !norm(s.beschreibung).includes(norm(s.suchbegriff).trim())) f.push('beschreibung enthält den suchbegriff nicht wörtlich')
  if (s.suchbegriff && /[:–—-]/.test(String(s.titel)) && norm(String(s.titel).split(/[:–—-]/)[0]).trim() === norm(s.suchbegriff).trim()) f.push('titel beginnt mit dem suchbegriff als Vorspann, schreib ihn wie einen gesprochenen Satz')
  for (const v of FLOSKELN) if (v.test(String(s.titel)) || v.test(String(s.beats?.[0]?.sprechen || ''))) f.push(`Floskel in Titel oder Hook verboten: ${v.source}`)
  if (String(s.titel || '').trim().split(/\s+/).length > MAX_WOERTER) f.push(`titel länger als ${MAX_WOERTER} Wörter`)
  if (String(s.titel || '').length > 90) f.push('titel länger als 90 Zeichen')
  const saetze = String(s.beschreibung || '').replace(/#\S+/g, '').trim().split(/(?<=[.!?])\s+/).filter(Boolean)
  if (saetze.length !== 3) f.push(`beschreibung muss genau 3 Sätze haben, nicht ${saetze.length}`)
  if (!saetze.some((x) => x.trim().endsWith('?'))) f.push('beschreibung braucht eine echte Frage an die Leser')
  if (woerter(s.beschreibung).length > 45) f.push('beschreibung höchstens 45 Wörter')
  if (/#/.test(String(s.beschreibung || ''))) f.push('keine Hashtags in der beschreibung (eigenes Feld hashtags)')
  if (/folg\w* für teil|teil 2/i.test(String(s.beschreibung || ''))) f.push('kein Köder wie „Folge für Teil 2“')
  if (!['tipps', 'werkzeuge', 'design'].includes(s.saeule)) f.push('saeule muss tipps, werkzeuge oder design sein')
  if (!/^Du (kannst|weißt|hast)\b/.test(String(s.mehrwert || ''))) f.push('mehrwert beginnt nicht mit „Du kannst“, „Du weißt“ oder „Du hast“')
  const beats = Array.isArray(s.beats) ? s.beats : []
  if (beats.length < 7 || beats.length > 10) f.push(`7 bis 10 Beats nötig (schnelle Schnitte, alle 2 bis 3 Sekunden etwas Neues), nicht ${beats.length}`)
  if (beats[0]?.typ !== 'hook') f.push('erster Beat muss hook sein')
  if (beats.at(-1)?.typ !== 'schluss') f.push('letzter Beat muss schluss sein')
  const typen = beats.map((b) => b.typ)
  if (typen.filter((t) => t === 'hook').length !== 1 || typen.filter((t) => t === 'schluss').length !== 1) f.push('genau ein hook und ein schluss')
  if (typen.filter((t) => t === 'werkzeug').length > 1) f.push('höchstens ein werkzeug-Beat')
  if (!beats.some((b) => ['problem', 'schritte', 'vergleich', 'merksatz'].includes(b.typ))) f.push('mindestens ein Inhalts-Beat (problem, schritte, vergleich, merksatz)')
  const mitWerkzeug = typen.includes('werkzeug')
  if (mitWerkzeug && !WERKZEUG_PFADE.includes(s.werkzeug)) f.push(`werkzeug „${s.werkzeug}“ steht nicht in data/fakten.json`)
  if (!mitWerkzeug && s.werkzeug) f.push('werkzeug gesetzt, aber kein werkzeug-Beat')
  if (s.saeule === 'werkzeuge' && !mitWerkzeug) f.push('Säule werkzeuge braucht einen werkzeug-Beat')
  let gesprochen = 0
  beats.forEach((b, i) => {
    const wo = `Beat ${i + 1} (${b.typ})`
    if (!TYPEN.includes(b.typ)) { f.push(`${wo}: unbekannter Typ`); return }
    const sp = String(b.sprechen || '').trim(), n = woerter(sp).length
    gesprochen += n
    if (!sp) f.push(`${wo}: sprechen fehlt`)
    if (n > 16) f.push(`${wo}: sprechen hat ${n} Wörter (höchstens 16, kurze Schläge statt langer Sätze)`)
    if (i > 0 && b.typ === beats[i - 1].typ) f.push(`${wo}: zweimal derselbe Typ hintereinander, wechsle ab`)
    if (/https?:|www\.|\/[a-z]/i.test(sp)) f.push(`${wo}: im Sprechtext keine Adressen außer „vamela.de“`)
    const zeile = String(b.zeile || '')
    const zeilen = zeile.split(' / ')
    if (!zeile.trim()) f.push(`${wo}: zeile fehlt`)
    if (zeilen.length > 2) f.push(`${wo}: zeile höchstens zwei Zeilen`)
    if (woerter(zeile.replace(/ \/ /g, ' ')).length > 6) f.push(`${wo}: zeile höchstens 6 Wörter`)
    for (const z of zeilen) if (z.replace(/_/g, '').trim().length > 16) f.push(`${wo}: Zeile „${z}“ länger als 16 Zeichen`)
    if (['hook', 'merksatz', 'werkzeug'].includes(b.typ) && b.symbol && !SYMBOLE.includes(b.symbol)) f.push(`${wo}: symbol „${b.symbol}“ unbekannt`)
    if (b.typ === 'hook') {
      if (n > 10) f.push(`${wo}: Hook höchstens 10 Wörter`)
      if (!SYMBOLE.includes(b.symbol)) f.push(`${wo}: symbol fehlt`)
    }
    if (b.typ === 'problem' || b.typ === 'schritte') {
      const p = b.karte?.punkte || []
      if (p.length < 2 || p.length > 4) f.push(`${wo}: 2 bis 4 Punkte`)
      p.forEach((x) => { if (String(x).length > 24) f.push(`${wo}: Punkt „${x}“ länger als 24 Zeichen`) })
      if (b.karte?.titel && String(b.karte.titel).length > 22) f.push(`${wo}: Kartentitel länger als 22 Zeichen`)
    }
    if (b.typ === 'vergleich') {
      if (!b.vorher || !b.nachher) f.push(`${wo}: vorher und nachher nötig`)
      if (String(b.vorher || '').length > 20 || String(b.nachher || '').length > 20) f.push(`${wo}: vorher/nachher höchstens 20 Zeichen`)
    }
    if (b.typ === 'merksatz' && (!b.satz || String(b.satz).length > 60)) f.push(`${wo}: satz nötig, höchstens 60 Zeichen`)
    if (b.typ === 'werkzeug') {
      const k = b.karte || {}
      if (!k.titel || String(k.titel).length > 22) f.push(`${wo}: Werkzeugname nötig, höchstens 22 Zeichen`)
      if ((k.punkte || []).length > 3 || (k.punkte || []).some((x) => String(x).length > 10)) f.push(`${wo}: höchstens 3 Merkmale à 10 Zeichen`)
      if (!k.knopf || String(k.knopf).length > 18) f.push(`${wo}: knopf nötig, höchstens 18 Zeichen`)
      if (!/vamela\.de/i.test(sp)) f.push(`${wo}: Sprechtext nennt vamela.de nicht`)
    }
    if (b.typ === 'schluss') {
      const cta = `${sp} ${zeile}`
      const bio = /link in der bio/i.test(cta.replace(/[_/]/g, ' ').replace(/\s+/g, ' '))
      if (bio && !mitWerkzeug) f.push(`${wo}: „Link in der Bio“ nur mit Werkzeug-Angebot`)
      if (!bio && !/folg|speicher|teil|kommentier/i.test(cta)) f.push(`${wo}: klare Handlung nötig (Folgen, Speichern, Teilen, Kommentieren oder mit Werkzeug „Link in der Bio“)`)
    }
  })
  if (gesprochen < 45 || gesprochen > 80) f.push(`Sprechtext gesamt ${gesprochen} Wörter (45 bis 80)`)
  // Erzählbogen (Christian, 11.11.2026: „professionell, kann viral gehen, nicht nur stumpf erklären“): offene Frage, Überraschung, Auflösung erst spät, Grund zum Speichern.
  // Jede Angabe nennt Beat-Nummer und wörtlichen Satzteil, der Code prüft, ob er dort wirklich gesprochen wird.
  const bogen = s.bogen || {}
  const imBeat = (nr, text) => { const b = beats[Number(nr) - 1]; return !!b && !!String(text || '').trim() && norm(b.sprechen).includes(norm(text).trim()) }
  if (!imBeat(bogen.schleife_beat, bogen.schleife)) f.push('bogen.schleife: wörtlicher Satzteil der offenen Frage fehlt im genannten Beat')
  else if (Number(bogen.schleife_beat) > 2) f.push('bogen.schleife_beat: die offene Frage muss in Beat 1 oder 2 aufgehen')
  if (!imBeat(bogen.ueberraschung_beat, bogen.ueberraschung)) f.push('bogen.ueberraschung: wörtlicher Satzteil fehlt im genannten Beat')
  else if (Number(bogen.ueberraschung_beat) < 3 || Number(bogen.ueberraschung_beat) > beats.length - 2) f.push('bogen.ueberraschung_beat: Überraschung in der Mitte (ab Beat 3, vor den letzten zwei)')
  if (!imBeat(bogen.aufloesung_beat, bogen.aufloesung)) f.push('bogen.aufloesung: wörtlicher Satzteil fehlt im genannten Beat')
  else if (Number(bogen.aufloesung_beat) < beats.length - 3) f.push('bogen.aufloesung_beat: Auflösung erst in den letzten drei Beats, sonst bleibt keine Spannung')
  else if (Number(bogen.aufloesung_beat) <= Number(bogen.schleife_beat)) f.push('bogen.aufloesung_beat muss nach der offenen Frage kommen')
  if (!imBeat(beats.length - 1, bogen.speichergrund) && !imBeat(beats.length, bogen.speichergrund)) f.push('bogen.speichergrund: wörtlicher Satzteil fehlt in den letzten zwei Beats')
  else if (!/speicher|merk|teil|schick|zeig/i.test(String(bogen.speichergrund))) f.push('bogen.speichergrund muss einen Grund nennen, das Video zu speichern oder zu schicken')
  if (beats[0] && /^(heute|in diesem video|hallo|hey)\b/i.test(norm(beats[0].sprechen).trim())) f.push('Hook beginnt mit Begrüßung oder Vorrede')
  if (new Set(typen).size < 5) f.push(`mindestens 5 verschiedene Beat-Typen nötig, nicht ${new Set(typen).size}`)
  // Inhalt: keine erfundenen Zahlen, Preise nur aus fakten.json, keine Versprechen, keine Emojis im Bild
  const bild = beats.map((b) => [b.zeile, b.karte?.titel, ...(b.karte?.punkte || []), b.karte?.knopf, b.vorher, b.nachher, b.satz].filter(Boolean).join(' ')).join(' ')
  const alles = [s.titel, s.beschreibung, bild, ...beats.map((b) => b.sprechen)].join(' ')
  for (const r of VERBOTEN) if (r.test(alles)) f.push(`verbotene Aussage: ${r}`)
  if (EMOJI.test(bild)) f.push('keine Emojis im Bild')
  for (const m of alles.matchAll(/\d[\d.,]*\s*(€|euro)/gi)) if (!PREISE.some((p) => p.replace(/\s/g, '') === m[0].replace(/\s/g, '').replace(/euro/i, '€'))) f.push(`Preis „${m[0]}“ steht nicht in data/fakten.json`)
  for (const m of alles.matchAll(/\b\d[\d.,]*\b/g)) if (Number(m[0].replace(/\./g, '').replace(',', '.')) > 10 && !PREISE.some((p) => p.startsWith(m[0])) && !fakten.werkzeuge.some((w) => w.name.includes(m[0]))) f.push(`Zahl „${m[0]}“: keine Statistiken oder erfundenen Zahlen`)
  if (/rechtstext|impressum|datenschutzerklärung|agb/i.test(alles) && !/anw[aä]lt/i.test(alles)) f.push('Rechtsthema nur mit Hinweis auf Anwältin oder Anwalt')
  // Kein Thema doppelt innerhalb von 30 Tagen
  const grenze = heute.getTime() - 30 * 864e5
  for (const v of verlauf) {
    if (new Date(v.datum).getTime() < grenze) continue
    if (aehnlich(s.thema, v.thema) >= 0.6 || aehnlich(beats[0]?.sprechen, v.hook) >= 0.6) f.push(`Thema oder Hook zu nah an „${v.thema}“ vom ${v.datum.slice(0, 10)}`)
    if (mitWerkzeug && v.werkzeug === s.werkzeug) f.push(`Werkzeug ${s.werkzeug} lief schon am ${v.datum.slice(0, 10)}`)
  }
  return [...new Set(f)]
}

// ---------- Skript von Claude (nur Abo) ----------
function kindUmgebung() {
  const env = { ...process.env }
  for (const k of Object.keys(env)) {
    if (/^ANTHROPIC_(API_KEY|AUTH_TOKEN)$/.test(k) || /^CLAUDE_CODE_USE_(BEDROCK|VERTEX|FOUNDRY)$/.test(k)) delete env[k]
    else if (k === 'CLAUDECODE' || (k.startsWith('CLAUDE_CODE_') && !k.startsWith('CLAUDE_CODE_OAUTH'))) delete env[k]
  }
  env.ANTHROPIC_API_KEY = ''
  return env
}
function claude(prompt) {
  const bin = findeClaude()
  if (!bin) throw new Error('Claude-CLI nicht gefunden')
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'tiktok-skript-'))
  const args = ['-p', '--output-format', 'json', '--model', MODELL, '--tools', 'Read', '--allowedTools', 'Read', '--permission-mode', 'dontAsk',
    '--setting-sources', 'project', '--disable-slash-commands', '--strict-mcp-config', '--no-session-persistence']
  return new Promise((resolve, reject) => {
    const kind = spawn(bin, args, { cwd, env: kindUmgebung(), stdio: ['pipe', 'pipe', 'pipe'] })
    let out = '', err = ''
    const timer = setTimeout(() => { kind.kill('SIGKILL'); reject(new Error('Claude: Zeitüberschreitung')) }, 600000)
    kind.stdout.on('data', (d) => (out += d)); kind.stderr.on('data', (d) => (err += d))
    kind.on('error', (e) => { clearTimeout(timer); reject(e) })
    kind.on('close', (code) => {
      clearTimeout(timer)
      fs.rmSync(cwd, { recursive: true, force: true })
      let h; try { h = JSON.parse(out) } catch { return reject(new Error(`Claude (Code ${code}): ${(err || out).slice(0, 300)}`)) }
      const e = Array.isArray(h) ? [...h].reverse().find((x) => x?.type === 'result') : h
      if (!e || e.is_error) return reject(new Error(`Claude meldet Fehler: ${String(e?.result || err).slice(0, 300)}`))
      const t = String(e.result || '').replace(/```(?:json)?/gi, '')
      const a = t.indexOf('{'), b = t.lastIndexOf('}')
      try { resolve(JSON.parse(t.slice(a, b + 1))) } catch { reject(new Error(`Claude-Antwort ist kein JSON: ${t.slice(0, 200)}`)) }
    })
    kind.stdin.on('error', () => {}); kind.stdin.end(prompt)
  })
}

// Je Video die nächste Formel aus tools/ig/hooks.json, damit nicht jeder Hook dieselbe Frage ist
const hookFormel = (verlauf) => { const l = formeln(); const h = l[verlauf.length % l.length]; return `${h.name}: ${h.vorlage} Beispiel: „${h.beispiel}“` }
function auftrag(verlauf, fehler, saeule, gruppe) {
  const letzte = verlauf.filter((v) => Date.now() - new Date(v.datum).getTime() < 30 * 864e5).map((v) => `- ${v.datum.slice(0, 10)}: ${v.thema}${v.werkzeug ? ` (Werkzeug ${v.werkzeug})` : ''}`).join('\n') || '- (noch keine)'
  return `Du schreibst das Skript für ein TikTok-Video (20 bis 28 Sekunden, Hochformat) von VAMELA (Christian Stockmeier, Webdesign und Grafikdesign aus Haag an der Amper, Landkreis Freising, Konto @vamela.de).
Zielgruppe: Inhaber kleiner Betriebe (Handwerk, Gastronomie, Praxen, Dienstleister), wenig Zeit, kein Grafikprogramm. Sie wollen einen Handgriff, den sie heute erledigen können.

Säule für dieses Video: ${saeule} (tipps = Website, Google-Profil, Bewertungen, lokale Sichtbarkeit; werkzeuge = ein Gratis-Werkzeug auf vamela.de; design = Schrift, Farbe, Layout, gut gegen schlecht mit Fantasienamen).

Feste Regeln:
- Jedes Video bietet konkreten, sofort nutzbaren Mehrwert: einen Tipp zum Umsetzen, ein Werkzeug, ein Vorher-Nachher-Prinzip oder eine Checkliste. Keine Image- oder Spruch-Videos.
- Nur belegbare Inhalte: keine Statistiken, Studien, Prozentangaben, Erfolgszahlen, Kundenstimmen, keine Versprechen („Platz 1 bei Google“, „garantiert mehr Kunden“). Keine Zahlen über 10, außer Preisen aus der Liste unten. Lieber allgemein und richtig.
- Preise nur exakt so: ${fakten.preise.map((p) => `${p.text} (${p.bedeutung})`).join('; ')}. Am besten gar keine Preise.
- Keine Rechtsberatung, nichts „rechtssicher“. Rechtsthemen meiden.
- Keine fremden Marken- oder Firmennamen im Bild; Beispiele mit Fantasienamen („Schreinerei Muster“). Google darf als Dienst genannt werden.
- Deutsch, Du-Form, klar, bayerisch-bodenständig, kein Marktschreier-Ton, keine Emojis im Bild, keine Nummerierung wie „01“.
- Gratis-Werkzeuge auf vamela.de (nur diese Pfade, ein Werkzeug nur bei Säule werkzeuge oder wenn es den Tipp direkt löst): ${fakten.werkzeuge.filter((w) => w.pfad !== '/werkzeuge').map((w) => `${w.pfad} = ${w.name}`).join('; ')}.
- Mit Werkzeug endet das Video mit „Link in der Bio“. Ohne Werkzeug nie „Link in der Bio“, sondern Folgen oder Speichern („Folg mir für mehr Tipps.“ / „Speicher dir das.“).
- Im Sprechtext keine Adressen außer „vamela.de“ (ohne Pfad).
- Kein Thema und kein Hook, die in den letzten 30 Tagen liefen:
${letzte}

Aufbau: 7 bis 10 Beats, schnell geschnitten: alle 2 bis 3 Sekunden ein neues Bild, nie zweimal derselbe Typ hintereinander, mindestens 5 verschiedene Typen im Video. Jeder Beat ist eine Szene mit festem Aussehen:
- hook: der Einstieg, höchstens 10 gesprochene Wörter, gebaut nach dieser Formel: ${hookFormel(verlauf)} Der Titel nimmt dieselbe Formel. Keine Frage, außer die Formel verlangt eine. Feld symbol.
- problem: Karte mit 2 bis 4 kurzen Punkten (je höchstens 24 Zeichen) mit rotem Kreuz. Feld karte {titel (höchstens 22 Zeichen, optional), punkte}.
- schritte: Karte mit 2 bis 4 Schritten (je höchstens 24 Zeichen), werden abgehakt. Feld karte {titel, punkte}.
- vergleich: zwei Felder, vorher (durchgestrichen) und besser. Felder vorher, nachher (je höchstens 20 Zeichen).
- merksatz: ein Satz zum Merken (höchstens 60 Zeichen). Felder satz, symbol.
- werkzeug: dunkle Karte des Werkzeugs auf vamela.de. Feld karte {titel = Werkzeugname höchstens 22 Zeichen, punkte = bis 3 Merkmale je höchstens 10 Zeichen, knopf = Knopftext höchstens 18 Zeichen}, symbol. Der Sprechtext nennt „vamela.de“.
- schluss: Logo, die Handlung. Mit Werkzeug: sprechen „Link in der Bio.“, zeile „Link in / der _Bio_“.
Jeder Beat hat „sprechen“ (1 bis 2 kurze Sätze, höchstens 16 Wörter, lieber ein Schlag als ein Satz mit Nebensatz, wird von einer Computerstimme gesprochen, also einfache Sätze ohne Klammern und Abkürzungen) und „zeile“ (2 bis 6 Wörter im Bild, höchstens zwei Zeilen à 16 Zeichen, „ / “ trennt die Zeilen, genau ein Akzentwort als _wort_).
Gesprochen insgesamt 45 bis 80 Wörter. Du schreibst kein Erklärvideo, sondern eine kleine Geschichte mit Spannungsbogen, die man bis zum Ende schaut und danach speichert. Der Zuschauer wird nur dann nicht weitergewischt, wenn er etwas wissen will und alle paar Sekunden etwas passiert:
- Hook: trifft einen Schmerz oder eine Neugier des Zuschauers in höchstens 10 Wörtern, ohne Antwort. Keine Begrüßung, keine Vorrede, kein „Heute zeige ich dir“.
- Offene Frage: Beat 1 oder 2 macht eine Lücke auf („Und der Grund steckt in einem Wort“), die erst in den letzten drei Beats geschlossen wird. Erkläre nichts, bevor die Lücke offen ist.
- Konkrete Szene statt Lehrsatz: Ein Bild, das der Zuschauer kennt („Du druckst 500 Flyer, und keiner scannt den Code“), nicht „QR-Codes sind wichtig“.
- Überraschung in der Mitte: etwas, das er nicht erwartet.
- Auflösung vorletzter oder drittletzter Beat, kurz und konkret, danach sofort der Grund zum Speichern („Speicher dir das, bevor du den nächsten Flyer druckst“).
- Das Schlusswort greift ein Wort aus dem Hook wieder auf, damit das Video im Kreis läuft.
Beschreibe diesen Bogen im JSON-Feld „bogen“. Jeder Satzteil dort muss wörtlich im Sprechtext des genannten Beats stehen (Beat-Nummern zählen ab 1).
- Beat 2 ist der Dreh nach dem Hook: eine Gegenüberstellung (vergleich) oder ein Aufschrei (problem), der den Hook sofort zuspitzt. Kein Füllsatz, keine Begrüßung.
- Setz mindestens einmal einen Überraschungsmoment: etwas, das der Zuschauer so nicht erwartet (ein Gegensatz, eine kleine Zahl, die steht, „und das war es schon“).
- Wechsle die Tonlage: kurzer Schlag, dann zwei Wörter, dann der Satz mit dem Nutzen. Keine zwei gleich langen Beats hintereinander.
- Zeigen statt behaupten: jeder Beat zeigt etwas Konkretes auf der Karte, nie bloß Text.
Erster Beat hook, letzter schluss, dazwischen mindestens ein problem, schritte, vergleich oder merksatz.
Symbole: ${SYMBOLE.join(', ')}.

Titel und Beschreibung (TikTok-Suche): „suchbegriff“ ist das, was Leute eintippen (z. B. „Google Bewertungen bekommen“). Der Titel ist ein gesprochener Satz, höchstens ${MAX_WOERTER} Wörter, nie Suchwort plus Doppelpunkt oder Strich (falsch: „Google Bewertungen bekommen: so geht es“). Die Beschreibung hat genau 3 kurze Sätze, zusammen höchstens 45 Wörter: 1. Kernaussage, die wörtlich den Suchbegriff enthält, 2. was man konkret lernt (Suchbegriff in einer Variante), 3. eine echte Frage an die Leser zum Thema. Kein Köder wie „Folge für Teil 2“, keine Hashtags in der Beschreibung.
Hashtags: genau 1 aus ${HASHTAGS.gruppen[gruppe].join(' ')} und genau 2 aus ${(HASHTAGS.themen[THEMA_JE_SAEULE[saeule]] || []).join(' ')}. Kein #fyp.

Antworte nur mit einem JSON-Objekt:
{"saeule":"${saeule}","thema":"kurzes Thema","suchbegriff":"…","titel":"…","beschreibung":"Satz. Satz. Frage?","hashtags":["#…","#…","#…"],"mehrwert":"Du kannst …","bogen":{"schleife_beat":1,"schleife":"wörtlicher Satzteil der offenen Frage","ueberraschung_beat":4,"ueberraschung":"wörtlicher Satzteil","aufloesung_beat":6,"aufloesung":"wörtlicher Satzteil","speichergrund":"wörtlicher Satzteil mit speicher, merk, teil oder schick"},"werkzeug":"/pfad oder null","beats":[{"typ":"hook","symbol":"…","zeile":"…","sprechen":"…"}, …]}${fehler.length ? `\n\nDein letzter Entwurf verletzte diese Regeln, behebe sie:\n- ${fehler.join('\n- ')}` : ''}`
}

function waehleSaeule(verlauf) {
  // Abwechseln: nie zweimal dieselbe Säule hintereinander, Werkzeuge etwa jedes dritte Video
  const letzte = verlauf.at(-1)?.saeule
  const folge = ['tipps', 'werkzeuge', 'design', 'tipps', 'werkzeuge', 'tipps']
  const k = verlauf.length % folge.length
  for (let i = 0; i < folge.length; i++) { const s = folge[(k + i) % folge.length]; if (s !== letzte) return s }
  return 'tipps'
}

async function schreibeSkript(verlauf, startFehler = [], gruppe = 'lernen') {
  const saeule = arg('saeule', waehleSaeule(verlauf))
  let fehler = startFehler
  for (let versuch = 1; versuch <= 4; versuch++) {
    log(`Skript (${saeule}), Versuch ${versuch} …`)
    let s
    try { s = await claude(auftrag(verlauf, fehler, saeule, gruppe)) } catch (e) { fehler = [String(e.message)]; log(`  ${e.message}`); continue }
    if (s.werkzeug === 'null' || s.werkzeug === '') s.werkzeug = null
    fehler = pruefeSkript(s, verlauf)
    if (!fehler.length) return { ...s, hashtag_gruppe: gruppe }
    log(`  abgelehnt:\n  - ${fehler.join('\n  - ')}`)
  }
  throw new Error(`Kein regelkonformes Skript nach 4 Versuchen: ${fehler.join('; ')}`)
}

// ---------- Video bauen ----------
function lauf(cmd, args, cwd, opts = {}) {
  log(`$ ${[cmd, ...args].join(' ')}`)
  return execFileSync(cmd, args, { cwd, stdio: opts.still ? ['ignore', 'pipe', 'pipe'] : 'inherit', env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: '1', DO_NOT_TRACK: '1' }, maxBuffer: 1e8, timeout: opts.timeout || 1800000 })
}
function baueVideo(id, inhalt) {
  const dir = path.join(ARBEIT, id)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  for (const f of ['hyperframes.json', 'package.json', 'meta.json', 'scripts', 'assets']) fs.cpSync(path.join(VORLAGE, f), path.join(dir, f), { recursive: true, filter: (q) => !/assets\/stimme|ton\.m4a$/.test(q) })
  // Look „orange“ (Christian, 11.11.2026, Referenz Finqube-Spot, alles Grüne in VAMELA-Orange): Verlaufsflächen, hell und dunkel im Wechsel, weiße Karten. VIDEO_LOOK=finn (dunkel, Limette, Punch-ins) oder hell (alter Look) schaltet um.
  const look = ['hell', 'finn', 'orange', 'gruen'].includes(process.env.VIDEO_LOOK) ? (process.env.VIDEO_LOOK === 'hell' ? undefined : process.env.VIDEO_LOOK) : 'orange'
  fs.writeFileSync(path.join(dir, 'inhalt.json'), JSON.stringify({ id, ...(look ? { look } : {}), ...inhalt }, null, 2))
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ id, name: id }) + '\n')
  lauf('node', ['scripts/stimme.mjs'], dir)
  lauf('node', ['scripts/bauen.mjs'], dir)
  lauf('node', ['scripts/ton.mjs'], dir)
  lauf('node', ['scripts/bauen.mjs'], dir) // jetzt mit Tonspur
  try { lauf('npx', ['--yes', HF, 'check'], dir, { timeout: 900000 }) } catch {
    // Fehler aus dem Prüfbericht als Rückmeldung fürs nächste Skript (meist zu langer Text in einem Feld)
    const ordner = path.join(dir, '.hyperframes/artifacts/checks')
    const bericht = fs.existsSync(ordner) ? fs.readdirSync(ordner).map((f) => path.join(ordner, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] : null
    const j = bericht ? JSON.parse(fs.readFileSync(bericht, 'utf8')) : {}
    const fehler = Object.values(j).flatMap((t) => (t && Array.isArray(t.findings) ? t.findings : [])).filter((x) => x.severity === 'error')
    const e = new Error(`hyperframes check fehlgeschlagen: ${fehler.map((x) => `${x.code} ${x.text || ''}`).join('; ') || 'siehe Bericht'}`)
    e.pruefung = fehler.map((x) => x.code === 'clipped_text' || x.code === 'text_overflow' ? `Text „${x.text}“ passt nicht in sein Feld, kürzer schreiben` : `Gestaltung: ${x.message} ${x.text ? `(„${x.text}“)` : ''}`)
    throw e
  }
  const mp4 = path.join(dir, 'renders', `${id}.mp4`)
  lauf('npx', ['--yes', HF, 'render', '--output', mp4, '--crf', '20', '--quiet'], dir, { timeout: 2400000 })
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', mp4]).toString())
  const v = probe.streams.find((s) => s.codec_type === 'video'), a = probe.streams.find((s) => s.codec_type === 'audio')
  const sek = Number(probe.format.duration)
  if (!v || v.codec_name !== 'h264' || v.width !== 1080 || v.height !== 1920) throw new Error(`Video nicht 1080 × 1920 H.264: ${v?.codec_name} ${v?.width}×${v?.height}`)
  if (!a || a.codec_name !== 'aac') throw new Error('Video ohne AAC-Ton')
  if (sek < 10 || sek > 60) throw new Error(`Videolänge ${sek.toFixed(1)} s außerhalb 10 bis 60 s`)
  log(`Video ${mp4}: ${sek.toFixed(1)} s, ${Math.round(fs.statSync(mp4).size / 1024)} KB`)
  return { mp4, sek }
}

// ---------- Posten ----------
async function status(publishId, token, ende) {
  let st = {}
  for (let v = 0; v < 60; v++) {
    await warte(6000)
    st = await post('/v2/post/publish/status/fetch/', { publish_id: publishId }, token)
    log(`TikTok ${publishId}: ${st.status}${st.fail_reason ? ' ' + st.fail_reason : ''}`)
    if (st.status === 'FAILED' || ende.includes(st.status)) break
  }
  if (!ende.includes(st.status)) throw new Error(`TikTok-Status ${st.status}${st.fail_reason ? ': ' + st.fail_reason : ''}`)
  return st
}
async function poste(mp4, text, modus) {
  const t = await gueltigerToken()
  const info = await post('/v2/post/publish/creator_info/query/', {}, t.access_token)
  speichereKonto(info)
  const erlaubt = info.privacy_level_options || []
  if (info.max_video_post_duration_sec && Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString()) > info.max_video_post_duration_sec) throw new Error('Video länger als für das Konto erlaubt')
  const { urls, pfade } = await hochladen([mp4], `${Date.now()}-video`)
  try {
    const direkt = async (sichtbarkeit) => {
      if (!erlaubt.includes(sichtbarkeit)) throw new Error(`Sichtbarkeit ${sichtbarkeit} nicht erlaubt (${erlaubt.join(', ')})`)
      log(`Direct Post, Sichtbarkeit ${sichtbarkeit}`)
      const start = await post('/v2/post/publish/video/init/', {
        post_info: { title: text.slice(0, 2200), privacy_level: sichtbarkeit, disable_comment: !!info.comment_disabled || params.kommentare === false, disable_duet: !!info.duet_disabled, disable_stitch: !!info.stitch_disabled, brand_content_toggle: false, brand_organic_toggle: params.eigene_marke !== false, is_aigc: params.ki_kennzeichnung !== false },
        source_info: { source: 'PULL_FROM_URL', video_url: urls[0] },
      }, t.access_token)
      const st = await status(start.publish_id, t.access_token, ['PUBLISH_COMPLETE'])
      return { modus: sichtbarkeit === 'PUBLIC_TO_EVERYONE' ? 'oeffentlich' : 'privat', sichtbarkeit, publish_id: start.publish_id, post_id: st.publicaly_available_post_id?.[0] || null }
    }
    const entwurf = async () => {
      log('Entwurf ins TikTok-Postfach')
      const start = await post('/v2/post/publish/inbox/video/init/', { source_info: { source: 'PULL_FROM_URL', video_url: urls[0] } }, t.access_token)
      await status(start.publish_id, t.access_token, ['SEND_TO_USER_INBOX', 'PUBLISH_COMPLETE'])
      return { modus: 'entwurf', sichtbarkeit: null, publish_id: start.publish_id, post_id: null }
    }
    if (modus === 'entwurf') return await entwurf()
    // Ohne Audit nimmt TikTok Direct Posts nur von privaten Konten an, auch SELF_ONLY scheitert dann
    // („unaudited_client_can_only_post_to_private_accounts“). Dann bleibt das Postfach.
    const ungeprueft = (e) => /unaudited_client|nicht erlaubt/.test(e.message)
    let fehler
    for (const sichtbarkeit of modus === 'privat' ? ['SELF_ONLY'] : modus === 'oeffentlich' ? ['PUBLIC_TO_EVERYONE'] : ['PUBLIC_TO_EVERYONE', ...(params.video_ersatz === 'privat' ? ['SELF_ONLY'] : [])]) {
      try { return await direkt(sichtbarkeit) } catch (e) { if (!ungeprueft(e)) throw e; fehler = e; log(`${sichtbarkeit} abgelehnt: ${e.message}`) }
    }
    if (modus === 'oeffentlich') throw fehler
    return { ...(await entwurf()), hinweis: 'App ohne Direct-Post-Audit: Direct Post abgelehnt, Video als Entwurf im TikTok-Postfach' }
  } finally { await aufraeumen(pfade) }
}

// Öffentlich über Zernio (Christian, 03.11.2026: „vollautomatisch, aber für null Euro“): Zernios TikTok-App ist für Direct Post
// zugelassen, die ersten 2 Konten sind kostenlos. Christian hat dem automatischen Posten ausdrücklich zugestimmt, deshalb setzt
// der Code die Zustimmungsfelder. Vorbild: zernio() in automatik/tiktok-karussell.mjs.
async function zernio(mp4, text, id, modus, um = null) {
  const Z = 'https://zernio.com/api/v1'
  const kopf = { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`, 'Content-Type': 'application/json' }
  const anfrage = async (pfad, opt = {}) => {
    const r = await fetch(Z + pfad, { ...opt, headers: { ...kopf, ...(opt.headers || {}) }, signal: AbortSignal.timeout(300000) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`Zernio ${pfad}: HTTP ${r.status} ${JSON.stringify(j).slice(0, 300)}`)
    return j
  }
  const konto = (await anfrage('/accounts')).accounts?.find((a) => a.platform === 'tiktok')
  if (!konto) throw new Error('Zernio: kein TikTok-Konto verbunden')
  const info = await anfrage(`/accounts/${konto._id}/tiktok/creator-info?mediaType=video`).catch(() => ({}))
  const stufen = (info.privacyLevels || info.creatorInfo?.privacyLevels || []).map((x) => (typeof x === 'string' ? x : x?.value || x?.privacy_level || x?.level || '')).filter(Boolean)
  const wunsch = modus === 'privat' ? 'SELF_ONLY' : 'PUBLIC_TO_EVERYONE'
  // Nie eine offenere Sichtbarkeit als gewünscht (Zernio bietet für das Konto oft nur PUBLIC_TO_EVERYONE an)
  if (stufen.length && !stufen.includes(wunsch)) throw new Error(`Zernio: ${wunsch} nicht erlaubt (${stufen.join(', ')})`)
  const sichtbarkeit = wunsch
  log(`Zernio: Konto ${konto.username || konto._id}, Sichtbarkeit ${sichtbarkeit} (erlaubt: ${stufen.join(', ') || 'unbekannt'})`)
  const p = await anfrage('/media/presign', { method: 'POST', body: JSON.stringify({ filename: path.basename(mp4), contentType: 'video/mp4', size: fs.statSync(mp4).size }) })
  const put = await fetch(p.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: fs.readFileSync(mp4), signal: AbortSignal.timeout(300000) })
  if (!put.ok) throw new Error(`Zernio-Upload: HTTP ${put.status}`)
  const stand = (x) => x?.post?.platforms?.[0]?.status || x?.post?.status || x?.platforms?.[0]?.status || x?.status || 'unbekannt'
  const grund = (x) => { const q = x?.post?.platforms?.[0] || x?.platforms?.[0] || {}; return q.errorMessage || q.error || '' }
  // TikTok meldet über Zernio gelegentlich „TikTok server error. This is a temporary issue“: bis zu 3 Versuche mit wachsender
  // Pause, je Versuch ein neuer Idempotency-Key (sonst liefert Zernio den gescheiterten Beitrag zurück)
  const PAUSEN = [0, 90000, 240000]
  let letzterFehler
  for (const [k, pause] of PAUSEN.entries()) {
    if (pause) { log(`Zernio: neuer Versuch in ${pause / 1000} s`); await warte(pause) }
    const r = await anfrage('/posts', {
      method: 'POST', headers: { 'Idempotency-Key': `tiktok-video-${id}-v${k + 1}-${Date.now()}` },
      body: JSON.stringify({
        content: text.slice(0, 2200),
        mediaItems: [{ type: 'video', url: p.publicUrl }],
        platforms: [{ platform: 'tiktok', accountId: konto._id }],
        tiktokSettings: { privacy_level: sichtbarkeit, allow_comment: params.kommentare !== false, content_preview_confirmed: true, express_consent_given: true, videoMadeWithAi: params.ki_kennzeichnung !== false, commercialContentType: 'brand_organic' },
        ...(um ? { scheduledFor: `${um}:00`, timezone: 'Europe/Berlin' } : { publishNow: true }),
      }),
    })
    const zid = r.post?._id || null
    let status = stand(r), letzter = r
    // Vorgeplant: Zernio veröffentlicht zur Uhrzeit, hier ist nichts abzuwarten; dasselbe Video als Reel zur selben Zeit
    if (um && zid && !/fail|error|rejected/i.test(status)) {
      log(`TikTok über Zernio geplant für ${um}: ${status} ${zid}`)
      let instagram = null
      const ig = (await anfrage('/accounts')).accounts?.find((a) => a.platform === 'instagram')
      if (ig && modus !== 'privat') {
        try {
          const reel = await anfrage('/posts', { method: 'POST', headers: { 'Idempotency-Key': `tiktok-video-${id}-reel` }, body: JSON.stringify({ content: text.slice(0, 2200), mediaItems: [{ type: 'video', url: p.publicUrl }], platforms: [{ platform: 'instagram', accountId: ig._id }], scheduledFor: `${um}:00`, timezone: 'Europe/Berlin' }) })
          instagram = { zernio_id: reel.post?._id || null, status: reel.post?.status || null }
          log(`Instagram-Reel über Zernio geplant für ${um}: ${reel.post?.status} ${reel.post?._id}`)
        } catch (e) { instagram = { fehler: String(e.message).slice(0, 300) }; log(`Instagram-Reel nicht geplant: ${instagram.fehler}`) }
      } else if (!ig) log('Zernio: kein Instagram-Konto verbunden, Reel übersprungen.')
      return { modus: 'zernio', sichtbarkeit, status, zernio_id: zid, publish_id: null, post_id: null, url: null, versuche: k + 1, geplant_fuer: um, instagram }
    }
    // Videos lädt Zernio erst zu TikTok hoch („uploading“), danach „published“ oder „failed“
    for (let v = 0; v < 40 && zid && !/published|fail|error|rejected/i.test(status); v++) {
      await warte(15000)
      try { letzter = await anfrage(`/posts/${zid}`); status = stand(letzter) } catch (e) { log(`Zernio-Status nicht lesbar: ${e.message}`) }
      log(`Zernio ${zid}: ${status}`)
    }
    const q = letzter?.post?.platforms?.[0] || {}
    log(`TikTok über Zernio, Versuch ${k + 1}: Status ${status}, Sichtbarkeit ${q.platformSpecificData?.tiktokSettings?.privacy_level || sichtbarkeit}${q.platformPostUrl ? ', ' + q.platformPostUrl : ''}${grund(letzter) ? ', Grund: ' + grund(letzter) : ''}`)
    if (/published/i.test(status)) return { modus: 'zernio', sichtbarkeit, status, zernio_id: zid, publish_id: null, post_id: q.platformPostId || null, url: q.platformPostUrl || null, versuche: k + 1 }
    if (zid && !/fail|error|rejected/i.test(status)) {
      // Nach 10 Minuten noch nicht fertig: nicht doppelt posten, als „läuft“ verbuchen
      return { modus: 'zernio', sichtbarkeit, status, zernio_id: zid, publish_id: null, post_id: null, versuche: k + 1, hinweis: 'Status nach 10 Minuten noch offen' }
    }
    letzterFehler = new Error(`Zernio-Status ${status}${grund(letzter) ? ': ' + grund(letzter) : ''}`)
    if (!/temporar|server error|timeout|try again|5\d\d/i.test(grund(letzter) || status)) break
  }
  throw letzterFehler
}

// Titel und Beschreibung nach denselben Regeln wie die TikTok-Karussells (automatik/tiktok-karussell.mjs): Titel beginnt mit dem
// Suchbegriff, Beschreibung genau 3 kurze Sätze mit einer Frage, genau 3 Hashtags aus plan/tiktok-hashtags.json (1 Gruppe + 2 Thema)
const HASHTAGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan/tiktok-hashtags.json'), 'utf8'))
const HASHTAG_PLAN = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'plan/tiktok-plan.json'), 'utf8')).hashtag_gruppen } catch { return null } })() || { nische_de: 1, nische_en: 1, lernen: 1 }
const THEMA_JE_SAEULE = { tipps: 'schritte', werkzeuge: 'tools', design: 'fehler' }
export function hashtagGruppe(id) {
  let h = 2166136261; for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const k = Object.keys(HASHTAG_PLAN), summe = k.reduce((a, x) => a + HASHTAG_PLAN[x], 0)
  let r = ((h >>> 0) % 10000) / 10000 * summe
  for (const x of k) { r -= HASHTAG_PLAN[x]; if (r <= 0) return x }
  return k.at(-1)
}
export function hashtags(s, gruppe) {
  const klein = (h) => String(h || '').trim().toLowerCase()
  const vorschlag = (s.hashtags || []).map(klein)
  const thema = HASHTAGS.themen[THEMA_JE_SAEULE[s.saeule]] || []
  const ausGruppe = HASHTAGS.gruppen[gruppe].find((h) => vorschlag.includes(klein(h))) || HASHTAGS.gruppen[gruppe][0]
  const ausThema = thema.filter((h) => vorschlag.includes(klein(h)) && h !== ausGruppe)
  for (const h of thema) if (ausThema.length < 2 && h !== ausGruppe && !ausThema.includes(h)) ausThema.push(h)
  return [ausGruppe, ...ausThema.slice(0, 2)]
}
function postText(s, tags) {
  const titel = String(s.titel).replace(/#\S+/g, '').trim().slice(0, 90)
  return [titel, String(s.beschreibung).replace(/#\S+/g, '').replace(/\s+/g, ' ').trim(), s.werkzeug ? 'Link in der Bio.' : '', 'Stimme KI-generiert.', tags.join(' ')].filter(Boolean).join('\n\n')
}

// Dasselbe Video als Instagram-Reel (Graph-API). Ein Fehler hier ändert nichts am TikTok-Post.
async function instagramReel(mp4, caption) {
  if (!process.env.IG_USER_ID) { log('Instagram: IG_USER_ID fehlt, übersprungen.'); return { fehler: 'IG_USER_ID fehlt' } }
  try {
    const ig = await import('./instagram.mjs')
    const r = await ig.veroeffentlicheReel({ video: mp4, caption })
    log(`Instagram-Reel: ${r.permalink || r.id}`)
    return { id: r.id, permalink: r.permalink }
  } catch (e) {
    const fehler = String(e.message || e).slice(0, 300)
    log(`Instagram-Reel nicht gepostet: ${fehler}${e.unklar ? ' (könnte trotzdem live sein, nicht wiederholen)' : ''}`)
    return { fehler, unklar: !!e.unklar }
  }
}

// ---------- Ablauf ----------
async function main() {
  if (fs.existsSync(path.join(ROOT, 'PAUSE'))) { log('PAUSE vorhanden, kein TikTok-Video.'); return }
  const anzahl = Number(arg('anzahl', '1'))
  const modus = arg('modus', 'auto')
  const echt = hat('echt') && !hat('ohne-post')
  if (!['auto', 'oeffentlich', 'privat', 'entwurf'].includes(modus)) throw new Error(`Modus ${modus} unbekannt`)
  let fehlschlaege = 0
  for (let n = 0; n < anzahl; n++) {
    const verlauf = ladeVerlauf()
    const jetzt = new Date()
    const id = `v${jetzt.toISOString().slice(0, 10).replace(/-/g, '')}-${jetzt.toISOString().slice(11, 16).replace(':', '')}${anzahl > 1 ? `-${n + 1}` : ''}`
    try {
      let skript, video, rueck = []
      for (let versuch = 1; !video; versuch++) {
        if (arg('inhalt')) {
          skript = JSON.parse(fs.readFileSync(path.resolve(arg('inhalt')), 'utf8'))
          const f = pruefeSkript(skript, verlauf)
          if (f.length) throw new Error(`Inhalt verletzt Regeln:\n- ${f.join('\n- ')}`)
        } else skript = await schreibeSkript(verlauf, rueck, hashtagGruppe(id))
        log(`Thema: ${skript.thema}`)
        if (hat('nur-skript')) { log(JSON.stringify(skript, null, 2)); break }
        try { video = baueVideo(id, skript) } catch (e) {
          if (!e.pruefung?.length || arg('inhalt') || versuch >= 3) throw e
          log(`${e.message}\nNeues Skript mit dieser Rückmeldung.`)
          rueck = e.pruefung
        }
      }
      if (!video) continue
      const { mp4, sek } = video
      const tags = hashtags(skript, skript.hashtag_gruppe || hashtagGruppe(id))
      const text = postText(skript, tags)
      fs.writeFileSync(mp4 + '.txt', text + '\n')
      let ergebnis = { modus: 'probe', publish_id: null }
      if (echt && process.env.ZERNIO_API_KEY && modus !== 'entwurf') {
        try { ergebnis = await zernio(mp4, text, id, modus, arg('um') || null) } catch (e) {
          // Eigene App als Rückfall: ohne Audit landet das Video als Entwurf im TikTok-Postfach. Nur wenn bei Zernio kein
          // Beitrag entstanden ist bzw. er sicher gescheitert ist (sonst doppelt); Netzfehler beim Anlegen gelten als gescheitert.
          log(`Zernio fehlgeschlagen (${e.message}), Rückfall eigene App`)
          ergebnis = { ...(await poste(mp4, text, 'entwurf')), zernio_fehler: e.message.slice(0, 300) }
        }
      } else if (echt) ergebnis = await poste(mp4, text, modus)
      else log('Ohne --echt: kein Upload.')
      if (echt && modus !== 'entwurf' && !hat('ohne-instagram') && !ergebnis.geplant_fuer) ergebnis.instagram = await instagramReel(mp4, text)
      verlauf.push({ id, datum: jetzt.toISOString(), thema: skript.thema, titel: skript.titel, suchbegriff: skript.suchbegriff, hashtags: tags, hook: skript.beats[0].sprechen, saeule: skript.saeule, werkzeug: skript.werkzeug || null, mehrwert: skript.mehrwert, sekunden: +sek.toFixed(1), stimme: (() => { try { const st = JSON.parse(fs.readFileSync(path.join(path.dirname(path.dirname(mp4)), 'assets/stimme/stimme.json'), 'utf8')); return `${st.engine} ${st.modell}` } catch { return null } })(), ...ergebnis })
      if (echt) speichereVerlauf(verlauf)
      log(`Fertig ${id}: TikTok ${ergebnis.modus}${ergebnis.status ? ' ' + ergebnis.status : ''}${ergebnis.sichtbarkeit ? ' ' + ergebnis.sichtbarkeit : ''}${ergebnis.url ? ' ' + ergebnis.url : ''}${ergebnis.publish_id ? ' ' + ergebnis.publish_id : ''}; Instagram ${ergebnis.instagram?.permalink || ergebnis.instagram?.fehler || '-'}`)
    } catch (e) {
      fehlschlaege++
      console.error(`Video ${id} fehlgeschlagen: ${e.message}`)
    }
  }
  if (fehlschlaege) process.exit(1)
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('tiktok-video.mjs')) await main()
