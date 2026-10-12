// Wortzeiten für die Reel-Untertitel: Whisper erkennt, WANN welches Wort fällt; WAS gesagt wird, steht schon im
// Sprechtext. Deshalb werden die Whisper-Wörter auf die Skriptwörter abgeglichen: Rechtschreibung aus dem Skript,
// Zeiten aus Whisper, fehlende Zeiten interpoliert.
//
// Whisper: @huggingface/transformers (ONNX, kein Kompilieren) mit onnx-community/whisper-large-v3-turbo_timestamped, q8,
// Sprache FEST „de“ (ohne gesetzte Sprache erkennt das Modell oft falsch, Erfahrung aus website/reels). Das Modell (~1 GB)
// liegt in WHISPER_CACHE (Standard ~/.cache/vamela-insta/hf); in GitHub Actions per actions/cache gesichert
// (.github/actions/werkzeuge, Eingabe whisper). WHISPER_OFFLINE=1 verbietet das Herunterladen.
//
//   import { wortzeiten } from './wortzeiten.mjs'
//   const w = await wortzeiten('stimme/r01.mp3', 'Dein Logo …', { cache: 'stimme/r01.woerter.json' })
//   // w = [{ wort: 'Dein', start: 0.26, ende: 0.5, satz: 0, quelle: 'whisper'|'geschaetzt' }, …]
// Ergebnis wird mit dem Hash von Audio und Text zwischengespeichert, damit Whisper je Stimme nur einmal läuft.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { ohneMarkup, saetze } from './orange.mjs'

export const WHISPER_MODELL = 'onnx-community/whisper-large-v3-turbo_timestamped'
export const SPRACHE = 'de'

/** ffmpeg/ffprobe: FFMPEG_DIR, ~/.local/ffmpeg/bin (Christians Mac), sonst PATH. */
export function ffTool(name) {
  for (const d of [process.env.FFMPEG_DIR, path.join(os.homedir(), '.local/ffmpeg/bin')].filter(Boolean)) {
    const p = path.join(d, name)
    if (fs.existsSync(p)) return p
  }
  return name
}

/** Audiodauer in Sekunden. */
export function audioDauer(datei) {
  return +execFileSync(ffTool('ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', datei]).toString().trim()
}

/** Normalisiert ein Wort für den Vergleich: klein, ohne Satzzeichen, Umlaute bleiben. */
export const norm = (w) => String(w || '').toLowerCase().replace(/ß/g, 'ss').replace(/[^\p{L}\p{N}]/gu, '')

/** Skriptwörter mit Satznummer: [{ wort, satz }]. Markup (*…*, _…_, ==…==) wird entfernt. */
export function skriptWoerter(text) {
  const out = []
  saetze(ohneMarkup(text)).forEach((s, satz) => { for (const wort of s.split(/\s+/).filter(Boolean)) out.push({ wort, satz }) })
  return out
}

/** Ähnlichkeit zweier normalisierter Wörter 0..1 (Levenshtein). */
export function aehnlich(a, b) {
  if (a === b) return 1
  if (!a || !b) return 0
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length)
}

/**
 * Gleicht Skriptwörter auf Whisper-Wörter ab (Needleman-Wunsch). Treffer (ähnlich ≥ 0,5) übernehmen Start und Ende;
 * Whisper kann ein Skriptwort in mehrere Teile zerlegen („vamela.de“ → „Vamela“, „.de“) oder Wörter anders schreiben.
 * Skriptwörter ohne Treffer bekommen geschätzte Zeiten (gleichmäßig zwischen den Nachbarn verteilt).
 * skript: [{ wort, satz }], whisper: [{ word|wort, start, end|ende }]. Rückgabe wie wortzeiten().
 */
export function abgleichen(skript, whisper, { dauer = null } = {}) {
  const W = whisper.map((w) => ({ n: norm(w.word ?? w.wort), start: +w.start, ende: +(w.end ?? w.ende ?? w.start) })).filter((w) => w.n)
  const S = skript.map((s) => norm(s.wort))
  const n = S.length, m = W.length
  const LUECKE = -0.4
  const score = Array.from({ length: n + 1 }, () => new Float64Array(m + 1))
  const weg = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1)) // 1 diagonal, 2 Skript ohne Whisper, 3 Whisper ohne Skript
  for (let i = 1; i <= n; i++) { score[i][0] = i * LUECKE; weg[i][0] = 2 }
  for (let j = 1; j <= m; j++) { score[0][j] = j * LUECKE; weg[0][j] = 3 }
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const a = aehnlich(S[i - 1], W[j - 1].n)
    const diag = score[i - 1][j - 1] + (a >= 0.5 ? a : a - 0.8)
    const oben = score[i - 1][j] + LUECKE, links = score[i][j - 1] + LUECKE
    if (diag >= oben && diag >= links) { score[i][j] = diag; weg[i][j] = 1 } else if (oben >= links) { score[i][j] = oben; weg[i][j] = 2 } else { score[i][j] = links; weg[i][j] = 3 }
  }
  // Zurückverfolgen: je Skriptwort die zugeordneten Whisper-Wörter (Treffer plus angrenzende Teilstücke)
  const zu = Array.from({ length: n }, () => [])
  const offen = [] // Whisper-Wörter ohne Skriptwort, die an ein Teilwort anschließen könnten
  for (let i = n, j = m; i > 0 || j > 0;) {
    const w = weg[i][j]
    if (i > 0 && j > 0 && w === 1) {
      if (aehnlich(S[i - 1], W[j - 1].n) >= 0.5) zu[i - 1].push(j - 1)
      i--; j--
    } else if (i > 0 && (j === 0 || w === 2)) i--
    else { offen.push({ j: j - 1, i: i - 1 }); j-- }
  }
  // Teilstücke: ein übriges Whisper-Wort, das zusammen mit dem Nachbarn das Skriptwort ergibt („vamela“ + „de“)
  for (const { j, i } of offen) {
    for (const k of [i, i + 1]) {
      if (k < 0 || k >= n) continue
      const teile = [...zu[k], j].sort((a, b) => a - b)
      const zusammen = teile.map((t) => W[t].n).join('')
      const zusammenhaengend = teile.every((t, x) => !x || t === teile[x - 1] + 1)
      if (zusammenhaengend && aehnlich(S[k], zusammen) >= 0.6 && aehnlich(S[k], zusammen) > (zu[k].length ? aehnlich(S[k], zu[k].map((t) => W[t].n).join('')) : 0)) { zu[k] = teile; break }
      if (!zu[k].length && aehnlich(S[k], W[j].n) >= 0.35 && S[k].startsWith(W[j].n.slice(0, 2))) { zu[k] = [j]; break }
    }
  }
  const out = skript.map((s, i) => {
    const t = zu[i].sort((a, b) => a - b)
    return t.length ? { wort: s.wort, satz: s.satz, start: W[t[0]].start, ende: W[t.at(-1)].ende, quelle: 'whisper' } : { wort: s.wort, satz: s.satz, start: null, ende: null, quelle: 'geschaetzt' }
  })
  // Lücken schätzen: gleichmäßig zwischen bekanntem Ende davor und Start danach
  const ende = dauer ?? (W.length ? W.at(-1).ende + 0.3 : out.length * 0.4)
  for (let i = 0; i < out.length; i++) {
    if (out[i].start != null) continue
    let j = i
    while (j < out.length && out[j].start == null) j++
    const von = i ? out[i - 1].ende ?? out[i - 1].start : 0
    const bis = j < out.length ? out[j].start : ende
    const schritt = Math.max(0.05, (bis - von) / (j - i))
    for (let k = i; k < j; k++) { out[k].start = +(von + (k - i) * schritt).toFixed(3); out[k].ende = +(von + (k - i + 1) * schritt).toFixed(3) }
    i = j - 1
  }
  // Whisper liefert am Satzende oft ende == start: mindestens 0,15 s, nie über den nächsten Start hinaus, monoton
  for (let i = 0; i < out.length; i++) {
    const naechster = i + 1 < out.length ? out[i + 1].start : ende
    if (i && out[i].start < out[i - 1].start) out[i].start = out[i - 1].start
    out[i].ende = +Math.min(Math.max(out[i].ende, out[i].start + 0.15), Math.max(naechster, out[i].start + 0.05)).toFixed(3)
  }
  return out
}

/** Dekodiert Audio nach 16 kHz mono Float32 (ffmpeg). */
export function lade16k(datei) {
  const roh = execFileSync(ffTool('ffmpeg'), ['-v', 'error', '-i', datei, '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1'], { maxBuffer: 1 << 28 })
  return new Float32Array(roh.buffer, roh.byteOffset, roh.byteLength / 4)
}

let asrCache = null
/** Whisper-Transkription mit Wortzeiten: [{ word, start, end }] und text. */
export async function transkribiere(datei, { modell = WHISPER_MODELL, cacheDir = process.env.WHISPER_CACHE || path.join(os.homedir(), '.cache/vamela-insta/hf') } = {}) {
  const { pipeline, env } = await import('@huggingface/transformers')
  env.cacheDir = cacheDir
  if (process.env.WHISPER_OFFLINE === '1') env.allowRemoteModels = false
  asrCache ??= await pipeline('automatic-speech-recognition', modell, { dtype: 'q8' })
  const res = await asrCache(lade16k(datei), { language: SPRACHE, task: 'transcribe', return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 })
  return { text: res.text, woerter: (res.chunks ?? []).map((c) => ({ word: c.text, start: c.timestamp[0], end: c.timestamp[1] ?? c.timestamp[0] + 0.3 })) }
}

const hash = (datei, text) => crypto.createHash('sha256').update(fs.readFileSync(datei)).update('\0' + text).digest('hex').slice(0, 16)

/**
 * Wortzeiten für Audio + Sprechtext. Mit `cache` (JSON-Pfad) nur einmal je Audio und Text. `transkribieren` und `dauer`
 * sind für Tests austauschbar. Rückgabe: [{ wort, satz, start, ende, quelle }], dazu Eigenschaft `.whisper` (erkannter Text).
 */
export async function wortzeiten(datei, text, { cache = null, transkribieren = transkribiere, dauer = audioDauer, log = console.log } = {}) {
  const h = hash(datei, text)
  if (cache && fs.existsSync(cache)) {
    try { const c = JSON.parse(fs.readFileSync(cache, 'utf8')); if (c.hash === h) return Object.assign(c.woerter, { whisper: c.whisper }) } catch {}
  }
  const t0 = Date.now()
  const erkannt = await transkribieren(datei)
  const woerter = abgleichen(skriptWoerter(text), erkannt.woerter, { dauer: dauer(datei) })
  const geschaetzt = woerter.filter((w) => w.quelle === 'geschaetzt').length
  log(`Wortzeiten: ${woerter.length} Wörter, ${geschaetzt} geschätzt, Whisper ${((Date.now() - t0) / 1000).toFixed(1)} s („${String(erkannt.text).trim().slice(0, 60)}…“)`)
  if (cache) {
    fs.mkdirSync(path.dirname(cache), { recursive: true })
    fs.writeFileSync(cache, JSON.stringify({ hash: h, modell: WHISPER_MODELL, sprache: SPRACHE, whisper: String(erkannt.text).trim(), woerter }, null, 1) + '\n')
  }
  return Object.assign(woerter, { whisper: String(erkannt.text).trim() })
}
