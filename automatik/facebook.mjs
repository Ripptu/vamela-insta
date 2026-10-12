// Facebook-Seite: spiegelt jeden Feed-Beitrag (Karussell, Reel) zusätzlich auf die Facebook-Seite von VAMELA.
// Inaktiv, solange die Secrets fehlen (Stand Kopie: keine gesetzt).
// Braucht FB_PAGE_ID und FB_PAGE_TOKEN (Seiten-Zugangsschlüssel mit pages_manage_posts, pages_read_engagement). Fehlen sie, passiert nichts.
// Die Dateien werden direkt hochgeladen (kein öffentlicher Link nötig). Ein Fehler hier darf die Instagram-Veröffentlichung nie beeinträchtigen.
import fs from 'node:fs'
import path from 'node:path'

const API = 'https://graph.facebook.com/v21.0'
const VIDEO_API = 'https://graph-video.facebook.com/v21.0'

export const aktiv = () => !!(process.env.FB_PAGE_ID && process.env.FB_PAGE_TOKEN)

async function senden(url, form) {
  form.set('access_token', process.env.FB_PAGE_TOKEN)
  const r = await fetch(url, { method: 'POST', body: form, signal: AbortSignal.timeout(300000) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) {
    const e = new Error(`Facebook: ${j.error?.message || r.status} (Code ${j.error?.code ?? '?'})`)
    e.code = j.error?.code
    throw e
  }
  return j
}

const datei = (f, typ) => new Blob([fs.readFileSync(f)], { type: typ })

/** Karussell: mehrere Fotos in einem Beitrag. dateien = JPG-Pfade, caption = Text. */
export async function postKarussell({ dateien, caption }) {
  const ids = []
  for (const f of dateien.filter((x) => /\.jpe?g$/i.test(x))) {
    const form = new FormData()
    form.set('published', 'false')
    form.set('source', datei(f, 'image/jpeg'), path.basename(f))
    ids.push((await senden(`${API}/${process.env.FB_PAGE_ID}/photos`, form)).id)
  }
  const form = new FormData()
  form.set('message', caption)
  ids.forEach((id, i) => form.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })))
  return (await senden(`${API}/${process.env.FB_PAGE_ID}/feed`, form)).id
}

/** Reel als Video auf der Seite. */
export async function postReel({ video, caption, cover }) {
  const form = new FormData()
  form.set('description', caption)
  form.set('source', datei(video, 'video/mp4'), path.basename(video))
  if (cover && fs.existsSync(cover)) form.set('thumb', datei(cover, 'image/jpeg'), path.basename(cover))
  return (await senden(`${VIDEO_API}/${process.env.FB_PAGE_ID}/videos`, form)).id
}

/** Spiegelt einen veröffentlichten Beitrag; gibt { id } oder { fehler } zurück, wirft nie. Zweiter Versuch bei Netzwerkfehlern. */
export async function spiegeln(item, dateien, caption) {
  if (!aktiv() || item.typ === 'story' || item.fb?.id) return null
  for (let versuch = 1; versuch <= 2; versuch++) {
    try {
      const id = item.typ === 'reel'
        ? await postReel({ video: dateien.find((f) => f.endsWith('.mp4')), caption, cover: dateien.find((f) => f.endsWith('.jpg')) })
        : await postKarussell({ dateien, caption })
      return { id, am: new Date().toISOString() }
    } catch (e) {
      if (versuch === 2 || [190, 200, 10, 100].includes(e.code)) return { fehler: String(e.message).slice(0, 300) }
    }
  }
}
