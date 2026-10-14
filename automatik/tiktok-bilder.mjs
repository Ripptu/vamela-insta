// Rendert für jedes produzierte Karussell eine eigene TikTok-Fassung in 1080 × 1920 (9:16); Inhalte liegen im Mittelteil y 370–1640, den TikTok auch in der 3:4-Ansicht zeigt nach out/<id>/tiktok/01.jpg … 06.jpg
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
const coverPlan = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'plan/tiktok-cover.json'), 'utf8')) } catch { return {} } })()
// Neu rendern, wenn ein Tierbild vorliegt, die Fassung aber noch nicht im neuen Hero-Design (Marker .hero7) gerendert wurde
const ohnePoster = (id) => coverPlan[id] && fs.existsSync(path.join(ROOT, 'bilder/tiktok', `${id}.jpg`)) && !fs.existsSync(path.join(ROOT, 'out', id, 'tiktok', '.hero7'))
const offen = q.filter((x) => x.typ === 'karussell' && ['geprueft', 'neu'].includes(x.status) && fs.existsSync(path.join(ROOT, 'out', x.id)) && (alle || ohnePoster(x.id) || !fs.existsSync(path.join(ROOT, 'out', x.id, 'tiktok', '06.jpg'))))
if (!offen.length) { console.log('TikTok-Fassungen: nichts zu tun.'); process.exit(0) }
const { createEngine } = await import('../render/engine.mjs')
const { buildCarousel } = await import('../render/karussell.mjs')
const { sterneText } = await import('../render/tiktok-poster.mjs')
const { renderHero, heroPlan } = await import('../render/tiktok-hero.mjs')
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
      const c = coverPlan[x.id], bild = path.join(ROOT, 'bilder/tiktok', `${x.id}.jpg`)
      const poster = !!(c && fs.existsSync(bild))
      if (poster) {
        // Hero (Bild 1): Tier vorn, Aufmacher-Element dahinter (render/tiktok-hero.mjs); Folien 2–6 in wechselnden Layouts (render/tiktok-folien.mjs)
        const repo = post.repo ? { name: post.repo, sterne: sterneText(post.sterne), lizenz: post.lizenz } : null
        const hp = heroPlan(x.id, c, post)
        await renderHero(eng, hp.art, { bild, repo, datei: path.join(tmp, '01.jpg'), text: hp.text })
        // Seiten 2–6: heller Look „Klar“ mit Pastell-Markierungen (render/stil-klar.mjs), Bild 1 ersetzt der Hero
        await buildCarousel(eng, post, tmp, { format: 'story', ohneCover: true })
        fs.writeFileSync(path.join(tmp, '.hero7'), hp.art)
      } else await buildCarousel(eng, post, tmp, { format: 'story' }) // ohne Tierbild: Look „Klar“ mit Cover
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
