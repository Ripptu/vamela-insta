// Sprachaufnahmen je Beat: assets/stimme/b<i>.wav aus inhalt.json (Feld „sprechen“).
// Standard ist Piper (github.com/OHF-Voice/piper1-gpl) mit der Stimme Thorsten-Voice (huggingface.co/Thorsten-Voice/Piper,
// Lizenz MIT, Datensatz CC0): kostenlos, kommerziell nutzbar, läuft auf dem Linux-Runner in Sekunden ohne GPU.
// Optional ElevenLabs (TIKTOK_STIMME=elevenlabs, ELEVENLABS_API_KEY): nur mit bezahltem Tarif, der kostenlose ist nicht kommerziell.
// Aussprache: „vamela.de“ wird als „Fameehla Punkt D E“ gesprochen, im Bild bleibt vamela.de.
// Aufruf: node scripts/stimme.mjs [inhalt.json]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const ENGINE = process.env.TIKTOK_STIMME || 'piper'
const PIPER = process.env.PIPER_BIN || 'piper'
const MODELL_ORDNER = process.env.PIPER_MODELLE || path.join(os.homedir(), '.cache/vamela-insta/piper')
const MODELL = process.env.PIPER_MODELL || 'de_DE-thorsten-high'
const MODELL_QUELLE = 'https://huggingface.co/Thorsten-Voice/Piper/resolve/main'
const TEMPO = process.env.PIPER_TEMPO || '0.9' // length_scale: kleiner = schneller
const ELEVEN_STIMME = process.env.ELEVENLABS_VOICE_ID || '5euSC8RarC3AHrZ242sr' // „Rob – Warm Bass German Narrator“
const ELEVEN_MODELL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2'

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
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_STIMME}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY || '', 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: ELEVEN_MODELL, language_code: 'de' }),
    signal: AbortSignal.timeout(120000),
  })
  if (!r.ok) throw new Error(`ElevenLabs HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
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
  if (ENGINE === 'elevenlabs' && !process.env.ELEVENLABS_API_KEY) throw new Error('TIKTOK_STIMME=elevenlabs braucht ELEVENLABS_API_KEY')
  fs.mkdirSync('assets/stimme', { recursive: true })
  for (const [i, b] of inhalt.beats.entries()) {
    if (!b.sprechen) continue
    const text = aussprache(b.sprechen)
    const ziel = `assets/stimme/b${i}.wav`
    console.log(`b${i}: ${text}`)
    await (ENGINE === 'elevenlabs' ? elevenlabs : piper)(text, ziel)
    stilleWeg(ziel)
    fs.writeFileSync(ziel.replace(/\.wav$/, '.json'), JSON.stringify({ text: b.sprechen, gesprochen: text, engine: ENGINE, modell: ENGINE === 'piper' ? MODELL : ELEVEN_MODELL }, null, 2))
  }
  console.log(`Stimme fertig (${ENGINE}).`)
}
