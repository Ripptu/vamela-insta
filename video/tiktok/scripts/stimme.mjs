// Sprachaufnahmen je Beat: assets/stimme/b<i>.wav aus inhalt.json (Feld „sprechen“).
// Christian, 03.11.2026: „möchte immer rob als stimme“. Mit ELEVENLABS_API_KEY spricht ElevenLabs „Rob – Warm Bass German Narrator“
// (REST-API, Modell eleven_v3 laut elevenlabs.io/docs/models deutschfähig und für Text to Speech freigegeben, sonst
// eleven_multilingual_v2). Für kommerzielle Nutzung und 2 Videos am Tag reicht der Gratis-Tarif nicht, mindestens Starter.
// Ohne Schlüssel oder wenn ElevenLabs bei einem Satz scheitert, spricht das ganze Video Piper (github.com/OHF-Voice/piper1-gpl)
// mit Thorsten-Voice (huggingface.co/Thorsten-Voice/Piper, MIT, Datensatz CC0), nie gemischt. TIKTOK_STIMME=piper erzwingt Piper.
// Aussprache: „vamela.de“ wird als „Fameehla Punkt D E“ gesprochen, im Bild bleibt vamela.de.
// Aufruf: node scripts/stimme.mjs [inhalt.json]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const WUNSCH = process.env.TIKTOK_STIMME || (process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'piper')
const PIPER = process.env.PIPER_BIN || 'piper'
const MODELL_ORDNER = process.env.PIPER_MODELLE || path.join(os.homedir(), '.cache/vamela-insta/piper')
const MODELL = process.env.PIPER_MODELL || 'de_DE-thorsten-high'
const MODELL_QUELLE = 'https://huggingface.co/Thorsten-Voice/Piper/resolve/main'
const TEMPO = process.env.PIPER_TEMPO || '0.9' // length_scale: kleiner = schneller
const ELEVEN_STIMME = process.env.ELEVENLABS_VOICE_ID || '5euSC8RarC3AHrZ242sr' // „Rob – Warm Bass German Narrator“
const ELEVEN_MODELLE = process.env.ELEVENLABS_MODEL ? [process.env.ELEVENLABS_MODEL] : ['eleven_v3', 'eleven_multilingual_v2']
let elevenModell = null

export function aussprache(text) {
  return String(text)
    .replace(/\bvamela\.de\b/gi, 'Fameehla Punkt D E')
    .replace(/\bvamela\b/gi, 'Fameehla')
    .replace(/\s+/g, ' ')
    .trim()
}

async function modellBereit() {
  const onnx = path.join(MODELL_ORDNER, `${MODELL}.onnx`)
  if (fs.existsSync(onnx) && fs.existsSync(onnx + '.json')) return onnx
  fs.mkdirSync(MODELL_ORDNER, { recursive: true })
  for (const f of [`${MODELL}.onnx`, `${MODELL}.onnx.json`]) {
    console.log(`Lade Stimme ${f} …`)
    const r = await fetch(`${MODELL_QUELLE}/${f}`, { signal: AbortSignal.timeout(300000) })
    if (!r.ok) throw new Error(`Stimme ${f}: HTTP ${r.status}`)
    fs.writeFileSync(path.join(MODELL_ORDNER, f), Buffer.from(await r.arrayBuffer()))
  }
  return onnx
}

async function piper(text, ziel) {
  const onnx = await modellBereit()
  execFileSync(PIPER, ['-m', onnx, '-f', ziel, '--length-scale', TEMPO, '--sentence-silence', '0.12'], { input: text, stdio: ['pipe', 'ignore', 'inherit'] })
}

async function elevenlabs(text, ziel) {
  let r
  // Erstes Modell, das antwortet, gilt für alle Sätze des Videos (language_code kennt multilingual_v2 nicht)
  for (const modell of elevenModell ? [elevenModell] : ELEVEN_MODELLE) {
    r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_STIMME}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY || '', 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: modell, ...(modell === 'eleven_multilingual_v2' ? {} : { language_code: 'de' }) }),
      signal: AbortSignal.timeout(120000),
    })
    if (r.ok) { elevenModell = modell; break }
    const fehler = `ElevenLabs ${modell} HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`
    if (elevenModell || r.status === 401 || r.status === 429) throw new Error(fehler)
    console.log(fehler)
  }
  if (!r.ok) throw new Error(`ElevenLabs: kein Modell verfügbar (${ELEVEN_MODELLE.join(', ')})`)
  const mp3 = ziel.replace(/\.wav$/, '.mp3')
  fs.writeFileSync(mp3, Buffer.from(await r.arrayBuffer()))
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mp3, ziel])
  fs.rmSync(mp3)
}

// Stille vorn und hinten abschneiden, damit die Schnitte auf der Stimme sitzen
function stilleWeg(datei) {
  const tmp = datei.replace(/\.wav$/, '.roh.wav')
  fs.renameSync(datei, tmp)
  const s = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03'
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', tmp, '-af', `${s},areverse,${s},areverse,aresample=44100`, '-ac', '1', datei])
  fs.rmSync(tmp)
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] || '')).href) {
  const inhalt = JSON.parse(fs.readFileSync(process.argv[2] || 'inhalt.json', 'utf8'))
  fs.mkdirSync('assets/stimme', { recursive: true })
  const sprich = async (engine) => {
    for (const [i, b] of inhalt.beats.entries()) {
      if (!b.sprechen) continue
      const text = aussprache(b.sprechen)
      const ziel = `assets/stimme/b${i}.wav`
      console.log(`b${i} (${engine}): ${text}`)
      await (engine === 'elevenlabs' ? elevenlabs : piper)(text, ziel)
      stilleWeg(ziel)
      fs.writeFileSync(ziel.replace(/\.wav$/, '.json'), JSON.stringify({ text: b.sprechen, gesprochen: text, engine, modell: engine === 'piper' ? MODELL : elevenModell }, null, 2))
    }
  }
  let engine = WUNSCH === 'elevenlabs' && process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'piper'
  if (WUNSCH === 'elevenlabs' && !process.env.ELEVENLABS_API_KEY) console.log('ELEVENLABS_API_KEY fehlt, Stimme Piper.')
  try { await sprich(engine) } catch (e) {
    if (engine !== 'elevenlabs') throw e
    console.log(`ElevenLabs fehlgeschlagen (${e.message}), das ganze Video spricht Piper.`)
    engine = 'piper'
    await sprich(engine)
  }
  const modell = engine === 'piper' ? MODELL : elevenModell
  fs.writeFileSync('assets/stimme/stimme.json', JSON.stringify({ engine, modell, stimme: engine === 'piper' ? 'Thorsten-Voice' : `Rob (${ELEVEN_STIMME})` }, null, 2))
  console.log(`Stimme fertig (${engine}, ${modell}).`)
}
