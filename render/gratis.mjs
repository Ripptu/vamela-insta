// Gratis-Bildanbieter für render/bilder.mjs (Ersatz für Higgsfield, Christian 14.10.2026). Eigenständige Kopie der Kette aus
// ~/website/bildwerk, weil GitHub Actions kein Bildwerk hat. Reihenfolge: Cloudflare Workers AI FLUX.2 klein 9B (~6 Bilder am
// Tag), klein 4B (~60 am Tag), zuletzt Pollinations (Restguthaben). Schlüssel nur aus der Umgebung:
//   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (Pflicht für die Kette), POLLINATIONS_KEY (optional).
// Meldet ein Anbieter Kontingent leer (HTTP 402/429), gilt er für den Rest des Laufs als gesperrt.

const runde = (x, n) => Math.round(x / n) * n

export function gratisZugang(env = process.env) {
  return !!(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN)
}

export const KETTE = [
  ['cloudflare', '@cf/black-forest-labs/flux-2-klein-9b'],
  ['cloudflare', '@cf/black-forest-labs/flux-2-klein-4b'],
  ['pollinations', 'black-forest-labs/flux.2-klein-4b'],
]

class KontingentWeg extends Error {}

async function cloudflare(modell, prompt, { breite, hoehe, seed }, { env, fetch }) {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) throw new KontingentWeg('Cloudflare-Schlüssel fehlt')
  const f = new FormData()
  for (const [k, v] of Object.entries({ prompt, width: runde(breite, 16), height: runde(hoehe, 16), seed })) f.append(k, String(v))
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${modell}`, { method: 'POST', headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` }, body: f })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    const E = r.status === 429 || /4006|daily free allocation/i.test(t) ? KontingentWeg : Error
    throw new E(`cloudflare ${modell}: HTTP ${r.status} ${t.slice(0, 160)}`)
  }
  const j = await r.json()
  const b64 = j.result?.image
  if (!b64) throw new Error(`cloudflare ${modell}: keine Bilddaten`)
  return Buffer.from(b64, 'base64')
}

async function pollinations(modell, prompt, { breite, hoehe, seed }, { env, fetch }) {
  if (!env.POLLINATIONS_KEY) throw new KontingentWeg('Pollinations-Schlüssel fehlt')
  const q = new URLSearchParams({ model: modell, width: String(runde(breite, 16)), height: String(runde(hoehe, 16)), seed: String(seed), nologo: 'true' })
  const r = await fetch(`https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${q}`, { headers: { Authorization: `Bearer ${env.POLLINATIONS_KEY}` } })
  if (!r.ok) throw new (r.status === 402 || r.status === 429 ? KontingentWeg : Error)(`pollinations ${modell}: HTTP ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

const ANBIETER = { cloudflare, pollinations }

/** Client mit der Schnittstelle des Higgsfield-Clients: { name, modell, koerper, erzeugen(prompt) → { bytes, request_id } }. */
export function gratis({ env = process.env, fetch = globalThis.fetch, kette = KETTE, breite = 1080, hoehe = 1440 } = {}) {
  const gesperrt = new Set()
  const koerper = (prompt) => ({ prompt, breite, hoehe, kette: kette.map(([n, m]) => `${n}:${m}`) })
  return {
    name: 'gratis',
    modell: kette.map(([, m]) => m.split('/').pop()).join(' → '),
    koerper,
    async erzeugen(prompt) {
      const fehler = []
      for (const [name, modell] of kette) {
        const id = `${name}|${modell}`
        if (gesperrt.has(id)) continue
        try {
          const bytes = await ANBIETER[name](modell, prompt, { breite, hoehe, seed: Math.floor(Math.random() * 1e6) }, { env, fetch })
          return { bytes, request_id: null, anbieter: name, modell }
        } catch (e) {
          fehler.push(`${modell.split('/').pop()}: ${e.message.slice(0, 120)}`)
          if (e instanceof KontingentWeg) gesperrt.add(id)
        }
      }
      throw new Error(`Gratis-Kette ohne Bild (${fehler.join(' | ')})`)
    },
  }
}
