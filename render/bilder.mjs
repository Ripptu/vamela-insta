// Bildbeschaffung je Beitrag für den Look „Orange“: aus dem Feld `motiv:` (englische Bildbeschreibung) und dem
// Stil-Präfix der Familie entsteht der Prompt; das Bild landet als bilder/<id>.png (1080 breit, 3:4) mit bilder/<id>.json
// (Prompt, Anbieter, Modell, Zeit). Der Queue-Eintrag bekommt dieselben Angaben unter `bild`.
//
// Anbieter (austauschbar, Reihenfolge):
//   1. schon beschafft:  bilder/<id>.png mit bilder/<id>.json (wird wiederverwendet, nie doppelt bezahlt)
//   2. vorrat:           bilder/vorrat/<id>.png (+ optional <id>.json mit { prompt, modell }). Für Bilder, die Christian oder
//                        Claude in einer Sitzung über das Higgsfield-MCP erzeugt (gpt_image_2, 1k, quality low, 0,5 Credits).
//   3. higgsfield:       öffentliche REST-API (docs.higgsfield.ai), nur mit HIGGSFIELD_API_KEY und HIGGSFIELD_API_SECRET
//                        (oder HIGGSFIELD_API_KEY im Format „id:secret“). Kostet Credits, deshalb nur mit Schlüssel und nie
//                        im Trockenlauf. Standard-Endpunkt Marketing Studio Image 2.5 Flare (laut Doku GPT Image 2.5),
//                        quality low, 1k, 3:4; anders über HIGGSFIELD_MODELL (z. B. /marketing-studio/image für 2.0 Alpha).
//   Ohne Schlüssel und ohne Vorrat: klare Meldung (BildFehlt), der Beitrag wird nicht produziert.
//
// Aufruf (Trockenlauf, zeigt nur Prompt und Anfrage): node render/bilder.mjs k01 --motiv "a laptop …" --familie nacht --trocken
// Kosten schätzen (kostenlos, braucht Schlüssel):     node render/bilder.mjs k01 --motiv "…" --familie nacht --schaetzen
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
export const BILDER_DIR = path.join(ROOT, 'bilder')
export const BREITE = 1080

/** Stil je Familie, abgeleitet aus den freigegebenen Bildern in insta-entwuerfe/ki (n* = Nacht, t* = Tag). */
export const STIL = {
  nacht: {
    vor: 'Cinematic 3D render, pitch black background, ',
    nach: ', glowing orange rim light and ember particles, dramatic low-key lighting, deep blacks, high contrast, subject in the lower 60 percent of the frame, top 40 percent dark empty space, no text, no letters, no logos, no people faces, vertical 3:4',
  },
  tag: {
    vor: 'Bright surreal studio photograph, ',
    nach: ', on a vivid orange background or a white wall with an orange floor, soft daylight, crisp natural shadows, playful visual metaphor, clean minimal set, subject in the lower 60 percent of the frame, top 35 to 40 percent plain empty background, no text, no letters, no logos, vertical 3:4',
  },
}

/** Prompt aus Motiv und Familie. */
export function bildPrompt(motiv, familie) {
  const s = STIL[familie]
  if (!s) throw new Error(`unbekannte Familie „${familie}“ (nacht oder tag)`)
  const m = String(motiv || '').trim().replace(/[.\s]+$/, '')
  if (!m) throw new Error('kein Motiv')
  return s.vor + m + s.nach
}

export class BildFehlt extends Error {}

/** Bild auf 1080 Breite bringen (proportional, nie verzerren) und als PNG speichern. */
export async function normalisiere(eingang, ziel) {
  fs.mkdirSync(path.dirname(ziel), { recursive: true })
  const meta = await sharp(eingang).metadata()
  if (!meta.width || !meta.height) throw new Error('Bild nicht lesbar')
  const v = meta.height / meta.width
  if (v < 1.2 || v > 1.6) throw new Error(`Bild hat ${meta.width} × ${meta.height}, erwartet ist Hochformat (3:4, höchstens 2:3)`)
  await sharp(eingang).resize({ width: BREITE, kernel: 'lanczos3' }).png().toFile(ziel + '.tmp')
  fs.renameSync(ziel + '.tmp', ziel)
  return ziel
}

const leseJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return null } }

/** Higgsfield-Zugang aus der Umgebung oder null. */
export function higgsfieldZugang(env = process.env) {
  const k = env.HIGGSFIELD_API_KEY || ''
  const s = env.HIGGSFIELD_API_SECRET || ''
  if (k.includes(':') && !s) { const [id, sec] = k.split(':'); return id && sec ? { id, secret: sec } : null }
  return k && s ? { id: k, secret: s } : null
}

/**
 * Client für die Higgsfield-REST-API (https://docs.higgsfield.ai): POST <endpunkt> → { request_id, status_url },
 * Status abfragen bis completed/failed/nsfw/canceled (2 s, wachsend bis 10 s), Ergebnis images[0].url herunterladen.
 * Fehlgeschlagene und abgelehnte Anfragen kosten laut Doku nichts. `fetch` ist austauschbar (Tests).
 */
export function higgsfield({ zugang = higgsfieldZugang(), endpunkt = process.env.HIGGSFIELD_MODELL || '/marketing-studio/image/flare', basis = 'https://api.higgsfield.ai', fetch = globalThis.fetch, warte = (ms) => new Promise((r) => setTimeout(r, ms)), zeitlimitMs = 300_000 } = {}) {
  const kopf = () => ({ Authorization: `Key ${zugang.id}:${zugang.secret}`, 'Content-Type': 'application/json', Accept: 'application/json' })
  const koerper = (prompt) => ({ prompt, aspect_ratio: '3:4', resolution: '1k', quality: 'low', enhance_prompt: false })
  const pruefe = async (r, was) => {
    if (r.ok) return r.json()
    const t = await r.text().catch(() => '')
    throw new Error(`Higgsfield ${was}: HTTP ${r.status} ${t.slice(0, 200)}`)
  }
  return {
    name: 'higgsfield',
    modell: endpunkt,
    koerper,
    /** Kostenlose Schätzung (Credits und USD) für genau diese Anfrage. */
    async schaetzen(prompt) {
      if (!zugang) throw new BildFehlt('HIGGSFIELD_API_KEY und HIGGSFIELD_API_SECRET fehlen')
      return pruefe(await fetch(basis + '/estimate' + endpunkt, { method: 'POST', headers: kopf(), body: JSON.stringify(koerper(prompt)) }), 'Schätzung')
    },
    /** Erzeugt ein Bild und gibt die Bytes zurück. */
    async erzeugen(prompt) {
      if (!zugang) throw new BildFehlt('HIGGSFIELD_API_KEY und HIGGSFIELD_API_SECRET fehlen')
      const start = await pruefe(await fetch(basis + endpunkt, { method: 'POST', headers: kopf(), body: JSON.stringify(koerper(prompt)) }), 'Anfrage')
      const statusUrl = start.status_url || `${basis}/requests/${start.request_id}/status`
      let pause = 2000, vergangen = 0, st = start
      while (!['completed', 'failed', 'nsfw', 'canceled'].includes(st.status)) {
        if (vergangen > zeitlimitMs) throw new Error(`Higgsfield: Zeitlimit, Anfrage ${start.request_id} noch ${st.status}`)
        await warte(pause)
        vergangen += pause
        pause = Math.min(pause * 1.5, 10_000)
        const r = await fetch(statusUrl, { headers: kopf() })
        if (r.status >= 500) continue
        st = await pruefe(r, 'Status')
      }
      if (st.status !== 'completed') throw new Error(`Higgsfield: Anfrage ${start.request_id} endete mit ${st.status}${st.error ? ` (${st.error})` : ''}`)
      const url = st.images?.[0]?.url
      if (!url) throw new Error('Higgsfield: keine Bild-URL in der Antwort')
      const bild = await fetch(url)
      if (!bild.ok) throw new Error(`Higgsfield: Download HTTP ${bild.status}`)
      return { bytes: Buffer.from(await bild.arrayBuffer()), request_id: start.request_id }
    },
  }
}

/**
 * Beschafft das Bild für einen Beitrag. Rückgabe: { datei (absolut), prompt, anbieter, modell, am }.
 * Optionen: trocken (keine bezahlte Anfrage, wirft BildFehlt mit der geplanten Anfrage), anbieter (Client, Tests), wurzel.
 */
export async function beschaffeBild({ id, motiv, familie }, { trocken = false, anbieter = null, dir = BILDER_DIR, log = console.log } = {}) {
  const ziel = path.join(dir, `${id}.png`)
  const info = path.join(dir, `${id}.json`)
  // 1. schon beschafft (nur, wenn es für dieselbe Familie beschafft wurde; ein Familienwechsel braucht ein neues Bild)
  const v = path.join(dir, 'vorrat', `${id}.png`)
  // Ist die Vorratsdatei neuer als die Kopie, gilt der Vorrat (z. B. Bild in einer Sitzung neu erzeugt)
  const vorratNeuer = fs.existsSync(v) && fs.existsSync(ziel) && fs.statSync(v).mtimeMs > fs.statSync(ziel).mtimeMs
  if (fs.existsSync(ziel) && fs.existsSync(info) && !vorratNeuer) {
    const alt = leseJson(info) || {}
    if (!alt.familie || alt.familie === familie) return { ...alt, datei: ziel }
    log(`${id}: vorhandenes Bild gehört zur Familie ${alt.familie}, gebraucht wird ${familie}; neu beschaffen.`)
  }
  // 2. Vorrat
  if (fs.existsSync(v)) {
    const vj = leseJson(path.join(dir, 'vorrat', `${id}.json`)) || {}
    await normalisiere(v, ziel)
    // prompt nur, wenn der Vorrat ihn mitliefert; sonst steht der zum Motiv passende Prompt als Vorschlag daneben
    const meta = { prompt: vj.prompt || null, prompt_vorschlag: motiv && STIL[familie] ? bildPrompt(motiv, familie) : null, anbieter: 'vorrat', modell: vj.modell || null, familie, quelle: vj.quelle || vj.job || null, am: new Date().toISOString() }
    fs.writeFileSync(info, JSON.stringify(meta, null, 2) + '\n')
    return { ...meta, datei: ziel }
  }
  // 3. API
  if (!motiv) throw new BildFehlt(`${id}: kein Bild in bilder/vorrat/${id}.png und kein Feld „motiv:“ im Vorrat`)
  const prompt = bildPrompt(motiv, familie)
  const client = anbieter || higgsfield()
  if (trocken) throw new BildFehlt(`${id}: Trockenlauf, keine Anfrage an ${client.name} ${client.modell}: ${JSON.stringify(client.koerper(prompt))}`)
  if (!anbieter && !higgsfieldZugang()) {
    throw new BildFehlt(`${id}: kein Bild. Entweder bilder/vorrat/${id}.png anlegen (Higgsfield-MCP in einer Sitzung, Prompt: „${prompt}“) oder HIGGSFIELD_API_KEY und HIGGSFIELD_API_SECRET setzen.`)
  }
  log(`${id}: Bild bei ${client.name} (${client.modell}) anfragen …`)
  const { bytes, request_id } = await client.erzeugen(prompt)
  fs.mkdirSync(dir, { recursive: true })
  const roh = path.join(dir, `.${id}-roh`)
  fs.writeFileSync(roh, bytes)
  try { await normalisiere(roh, ziel) } finally { fs.rmSync(roh, { force: true }) }
  const meta = { prompt, anbieter: client.name, modell: client.modell, familie, request_id: request_id || null, am: new Date().toISOString() }
  fs.writeFileSync(info, JSON.stringify(meta, null, 2) + '\n')
  return { ...meta, datei: ziel }
}

// Kommandozeile: Trockenlauf und Kostenschätzung
if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2)
  const opt = (n) => (a.includes(n) ? a[a.indexOf(n) + 1] : null)
  const id = a.find((x) => !x.startsWith('--') && x !== opt('--motiv') && x !== opt('--familie'))
  const familie = opt('--familie') || 'nacht'
  const motiv = opt('--motiv')
  if (!id) { console.log('Aufruf: node render/bilder.mjs <id> [--motiv "…"] [--familie nacht|tag] [--trocken|--schaetzen]'); process.exit(1) }
  try {
    if (a.includes('--schaetzen')) console.log(await higgsfield().schaetzen(bildPrompt(motiv, familie)))
    else console.log(await beschaffeBild({ id, motiv, familie }, { trocken: a.includes('--trocken') }))
  } catch (e) { console.log(e.message); process.exit(e instanceof BildFehlt ? 2 : 1) }
}
