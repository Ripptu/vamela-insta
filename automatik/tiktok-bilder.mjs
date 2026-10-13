// Rendert für jedes produzierte Karussell eine eigene TikTok-Fassung in 1080 × 1920 nach out/<id>/tiktok/01.jpg … 06.jpg
// (Christian, 13.10.2026: das eingepasste 4:5-Bild sah „katastrophal“ aus; Cover als Hingucker, nur der Aufhänger, Bild vollflächig).
// Läuft im Workflow „Produzieren und prüfen“ nach fill.mjs; vorhandene Fassungen bleiben. Aufruf: node automatik/tiktok-bilder.mjs [--alle]
import fs from 'node:fs'
import path from 'node:path'
import { ladeQueue } from './queue.mjs'
import { allePosts } from '../render/inhalt.mjs'
import { ergaenze } from './block-felder.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const alle = process.argv.includes('--alle')
const q = await ladeQueue()
const md = ['docs/content-posts.md', 'docs/content-posts-auto.md'].map((f) => path.join(ROOT, f)).filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n')
const posts = new Map(ergaenze(allePosts(), md, 'Karussell').map((p) => [`k${String(p.nr).padStart(2, '0')}`, p]))
const offen = q.filter((x) => x.typ === 'karussell' && ['geprueft', 'neu'].includes(x.status) && fs.existsSync(path.join(ROOT, 'out', x.id)) && (alle || !fs.existsSync(path.join(ROOT, 'out', x.id, 'tiktok', '06.jpg'))))
if (!offen.length) { console.log('TikTok-Fassungen: nichts zu tun.'); process.exit(0) }
const { createEngine } = await import('../render/engine.mjs')
const { buildCarousel } = await import('../render/karussell.mjs')
const eng = await createEngine()
let ok = 0, fehler = 0
try {
  for (const x of offen) {
    const post = posts.get(x.id)
    if (!post) { console.log(`${x.id}: Vorratsblock nicht gefunden, übersprungen`); continue }
    const ziel = path.join(ROOT, 'out', x.id, 'tiktok')
    // buildCarousel nimmt die Bild-ID aus dem Ordnernamen: deshalb über einen Ordner mit der ID rendern und verschieben
    const tmp = path.join(ROOT, 'out', '_tiktok-render', x.id)
    fs.rmSync(tmp, { recursive: true, force: true })
    try {
      await buildCarousel(eng, post, tmp, { format: 'story' })
      fs.rmSync(ziel, { recursive: true, force: true })
      fs.mkdirSync(path.dirname(ziel), { recursive: true })
      fs.renameSync(tmp, ziel)
      ok++
    } catch (e) { fehler++; console.log(`${x.id}: TikTok-Fassung nicht gerendert: ${String(e.gruende?.join('; ') || e.message).slice(0, 200)}`) }
  }
} finally {
  await eng.close?.()
  fs.rmSync(path.join(ROOT, 'out', '_tiktok-render'), { recursive: true, force: true })
}
console.log(`TikTok-Fassungen: ${ok} gerendert, ${fehler} fehlgeschlagen`)
process.exit(0)
