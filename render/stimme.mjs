// KI-Stimme für die Reels (Christian, 12.10.2026: „tiefe epische deutsche Stimme“). Gewählt: Higgsfield text2speech_v2,
// Variante elevenlabs, Preset-Stimme „Sterling“ (voice_id dc382508-c8bd-443c-8cb2-46e57b8d2e6f), etwa 0,3 Credits je Satz.
// Probe: stimme/proben/sterling.mp3. Aufbau wie render/bilder.mjs, Anbieter austauschbar, Reihenfolge:
//   1. schon beschafft:  stimme/<id>.mp3 mit stimme/<id>.json (gleicher Sprechtext), wird wiederverwendet
//   2. vorrat:           stimme/vorrat/<id>.mp3 + <id>.json { text, stimme, job }. Erzeugt Claude in einer Sitzung über das
//                        Higgsfield-MCP (generate_audio, Parameter siehe mcpParameter()). Liegt nur die JSON mit dem Text da,
//                        fehlt die Aufnahme noch (Meldung mit den MCP-Parametern).
//   3. higgsfield:       REST-API mit HIGGSFIELD_API_KEY und HIGGSFIELD_API_SECRET. Die öffentliche Doku (docs.higgsfield.ai,
//                        Stand 12.10.2026) beschreibt nur Bild- und Videomodelle, keinen Sprach-Endpunkt. Deshalb gibt es
//                        keinen Standard: der Pfad kommt aus HIGGSFIELD_TTS_ENDPUNKT (aus der Higgsfield-Konsole), Ablauf wie
//                        bei Bildern (POST → request_id/status_url → Status abfragen → Audio-URL). Kostet Credits, nie im
//                        Trockenlauf.
//   Ohne Aufnahme und ohne Zugang: StimmeFehlt, das Reel wird übersprungen und beim nächsten Lauf neu versucht.
//
// Aufruf: node render/stimme.mjs r01 --text "…" [--trocken]   (zeigt Herkunft bzw. die geplante Anfrage, zahlt nie)
//         node render/stimme.mjs r01 --mcp                      (Parameter für das Higgsfield-MCP aus stimme/vorrat/r01.json)
import fs from 'node:fs'
import path from 'node:path'
import { higgsfieldZugang } from './bilder.mjs'
import { ohneMarkup } from './orange.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
export const STIMME_DIR = path.join(ROOT, 'stimme')

/** Die gewählte Stimme (Christian, 12.10.2026). */
export const STIMME = { name: 'Sterling', modell: 'text2speech_v2', variant: 'elevenlabs', voice_type: 'preset', voice_id: 'dc382508-c8bd-443c-8cb2-46e57b8d2e6f' }

export class StimmeFehlt extends Error {}

/** Sprechtext so, wie er gesprochen wird (ohne Akzent-Markup, ein Leerzeichen). */
export const sprechfassung = (text) => ohneMarkup(String(text || '')).replace(/\s+/g, ' ').trim()
const gleich = (a, b) => sprechfassung(a).toLowerCase() === sprechfassung(b).toLowerCase()
const leseJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return null } }

/** Parameter für das Higgsfield-MCP (generate_audio) zu einem Sprechtext. */
export const mcpParameter = (text) => ({ model: STIMME.modell, variant: STIMME.variant, voice_type: STIMME.voice_type, voice_id: STIMME.voice_id, prompt: sprechfassung(text) })

/**
 * REST-Client für Higgsfield-Sprache. Der Endpunkt ist nicht öffentlich dokumentiert (siehe Kopf), deshalb Pflicht über
 * HIGGSFIELD_TTS_ENDPUNKT. Körper wie die MCP-Parameter: { text, prompt, variant, voice_type, voice_id }. Ergebnis-URL aus
 * audio.url, audios[0].url, outputs[0].url oder url. `fetch` ist austauschbar (Tests).
 */
export function higgsfieldStimme({ zugang = higgsfieldZugang(), endpunkt = process.env.HIGGSFIELD_TTS_ENDPUNKT || null, basis = 'https://api.higgsfield.ai', fetch = globalThis.fetch, warte = (ms) => new Promise((r) => setTimeout(r, ms)), zeitlimitMs = 180_000 } = {}) {
  const kopf = () => ({ Authorization: `Key ${zugang.id}:${zugang.secret}`, 'Content-Type': 'application/json', Accept: 'application/json' })
  const koerper = (text) => ({ text: sprechfassung(text), prompt: sprechfassung(text), variant: STIMME.variant, voice_type: STIMME.voice_type, voice_id: STIMME.voice_id })
  const pruefe = async (r, was) => {
    if (r.ok) return r.json()
    const t = await r.text().catch(() => '')
    throw new Error(`Higgsfield-Stimme ${was}: HTTP ${r.status} ${t.slice(0, 200)}`)
  }
  return {
    name: 'higgsfield',
    modell: endpunkt ? `${endpunkt} (${STIMME.variant}, ${STIMME.name})` : null,
    endpunkt,
    koerper,
    /** Was gesendet würde (Trockenlauf, kostet nichts). */
    plan: (text) => ({ methode: 'POST', url: endpunkt ? basis + endpunkt : '(HIGGSFIELD_TTS_ENDPUNKT fehlt)', kopf: { Authorization: 'Key <id>:<secret>' }, koerper: koerper(text) }),
    async erzeugen(text) {
      if (!zugang) throw new StimmeFehlt('HIGGSFIELD_API_KEY und HIGGSFIELD_API_SECRET fehlen')
      if (!endpunkt) throw new StimmeFehlt('HIGGSFIELD_TTS_ENDPUNKT fehlt (Sprach-Endpunkt ist in docs.higgsfield.ai nicht dokumentiert)')
      const start = await pruefe(await fetch(basis + endpunkt, { method: 'POST', headers: kopf(), body: JSON.stringify(koerper(text)) }), 'Anfrage')
      const statusUrl = start.status_url || `${basis}/requests/${start.request_id}/status`
      let pause = 1500, vergangen = 0, st = start
      while (!['completed', 'failed', 'nsfw', 'canceled'].includes(st.status)) {
        if (vergangen > zeitlimitMs) throw new Error(`Higgsfield-Stimme: Zeitlimit, Anfrage ${start.request_id} noch ${st.status}`)
        await warte(pause)
        vergangen += pause
        pause = Math.min(pause * 1.5, 8000)
        const r = await fetch(statusUrl, { headers: kopf() })
        if (r.status >= 500) continue
        st = await pruefe(r, 'Status')
      }
      if (st.status !== 'completed') throw new Error(`Higgsfield-Stimme: Anfrage ${start.request_id} endete mit ${st.status}`)
      const url = st.audio?.url || st.audios?.[0]?.url || st.outputs?.[0]?.url || st.url
      if (!url) throw new Error('Higgsfield-Stimme: keine Audio-URL in der Antwort')
      const a = await fetch(url)
      if (!a.ok) throw new Error(`Higgsfield-Stimme: Download HTTP ${a.status}`)
      return { bytes: Buffer.from(await a.arrayBuffer()), request_id: start.request_id }
    },
  }
}

/**
 * Beschafft die Sprachaufnahme eines Reels. Rückgabe: { datei (absolut, mp3), text, anbieter, stimme, job, am }.
 * Optionen: trocken (keine bezahlte Anfrage), anbieter (Client, Tests), dir (Wurzel statt stimme/).
 */
export async function beschaffeStimme({ id, text }, { trocken = false, anbieter = null, dir = STIMME_DIR, log = console.log } = {}) {
  if (!sprechfassung(text)) throw new StimmeFehlt(`${id}: kein Sprechtext („- Sprechtext: …“ im Reel-Block)`)
  const ziel = path.join(dir, `${id}.mp3`), info = path.join(dir, `${id}.json`)
  const v = path.join(dir, 'vorrat', `${id}.mp3`), vj = path.join(dir, 'vorrat', `${id}.json`)
  const vorratNeuer = fs.existsSync(v) && fs.existsSync(ziel) && fs.statSync(v).mtimeMs > fs.statSync(ziel).mtimeMs
  // 1. schon beschafft, für genau diesen Text
  if (fs.existsSync(ziel) && !vorratNeuer) {
    const alt = leseJson(info) || {}
    if (alt.text && gleich(alt.text, text)) return { ...alt, datei: ziel }
    log(`${id}: vorhandene Stimme passt nicht mehr zum Sprechtext, neu beschaffen.`)
  }
  // 2. Vorrat (in einer Sitzung über das Higgsfield-MCP erzeugt)
  const vmeta = leseJson(vj)
  if (fs.existsSync(v)) {
    if (vmeta?.text && !gleich(vmeta.text, text)) throw new StimmeFehlt(`${id}: stimme/vorrat/${id}.mp3 spricht einen anderen Text als der Sprechtext im Vorrat. Neu erzeugen (MCP): ${JSON.stringify(mcpParameter(text))}`)
    fs.mkdirSync(dir, { recursive: true })
    fs.copyFileSync(v, ziel)
    const meta = { text: sprechfassung(text), anbieter: 'vorrat', stimme: vmeta?.stimme || STIMME.name, modell: vmeta?.modell || `${STIMME.modell}/${STIMME.variant}`, job: vmeta?.job || null, am: new Date().toISOString() }
    fs.writeFileSync(info, JSON.stringify(meta, null, 2) + '\n')
    return { ...meta, datei: ziel }
  }
  // 3. API
  const client = anbieter || higgsfieldStimme()
  if (trocken) throw new StimmeFehlt(`${id}: Trockenlauf, keine Anfrage: ${JSON.stringify(client.plan ? client.plan(text) : client.koerper(text))}`)
  if (!anbieter && (!higgsfieldZugang() || !client.endpunkt)) {
    throw new StimmeFehlt(`${id}: keine Sprachaufnahme. stimme/vorrat/${id}.mp3 anlegen (Higgsfield-MCP generate_audio mit ${JSON.stringify(mcpParameter(text))}, dazu ${id}.json mit text/stimme/job) oder HIGGSFIELD_API_KEY, HIGGSFIELD_API_SECRET und HIGGSFIELD_TTS_ENDPUNKT setzen.${vmeta ? ' (stimme/vorrat/' + id + '.json mit dem Text liegt schon bereit.)' : ''}`)
  }
  log(`${id}: Stimme bei ${client.name} (${client.modell}) anfragen …`)
  const { bytes, request_id } = await client.erzeugen(text)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(ziel, bytes)
  const meta = { text: sprechfassung(text), anbieter: client.name, stimme: STIMME.name, modell: client.modell, job: request_id || null, am: new Date().toISOString() }
  fs.writeFileSync(info, JSON.stringify(meta, null, 2) + '\n')
  return { ...meta, datei: ziel }
}

// Kommandozeile
if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2)
  const opt = (n) => (a.includes(n) ? a[a.indexOf(n) + 1] : null)
  const id = a.find((x) => !x.startsWith('--') && x !== opt('--text'))
  if (!id) { console.log('Aufruf: node render/stimme.mjs <id> [--text "…"] [--trocken] [--mcp]'); process.exit(1) }
  const text = opt('--text') || leseJson(path.join(STIMME_DIR, 'vorrat', `${id}.json`))?.text
  if (a.includes('--mcp')) { console.log(JSON.stringify(mcpParameter(text), null, 2)); process.exit(0) }
  try { console.log(await beschaffeStimme({ id, text }, { trocken: a.includes('--trocken') })) } catch (e) { console.log(e.message); process.exit(e instanceof StimmeFehlt ? 2 : 1) }
}
