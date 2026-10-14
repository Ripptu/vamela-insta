// Rendert noch nicht veröffentlichte Beiträge (Status geprueft/neu) neu, z. B. nach einem Wechsel des Looks (plan/params.json: look).
// Aufruf: node automatik/neu-rendern.mjs [--typ karussell|story]   (Dateinamen bleiben gleich; veröffentlichte Beiträge bleiben unberührt)
import fs from 'node:fs'
import path from 'node:path'
import { ladeQueue } from './queue.mjs'
import { allePosts, alleStories } from '../render/inhalt.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const args = process.argv.slice(2)
const typen = args.includes('--typ') ? [args[args.indexOf('--typ') + 1]] : ['karussell', 'story']
const q = await ladeQueue()
const { createEngine } = await import('../render/engine.mjs')
const { buildCarousel } = await import('../render/karussell.mjs')
const { renderStory } = await import('../render/story.mjs')
const eng = await createEngine()
let ok = 0, fehler = 0
try {
  for (const typ of typen) {
    const vorrat = new Map((typ === 'karussell' ? allePosts() : alleStories()).map((x) => [`${typ[0]}${String(x.nr).padStart(2, '0')}`, x]))
    for (const it of q.filter((x) => x.typ === typ && ['geprueft', 'neu'].includes(x.status))) {
      const x = vorrat.get(it.id)
      if (!x) { console.log(`${it.id}: Vorratsblock nicht gefunden`); fehler++; continue }
      const out = path.join(ROOT, 'out', it.id)
      const tmp = path.join(ROOT, 'out', '_neu-rendern', it.id)
      fs.rmSync(tmp, { recursive: true, force: true })
      try {
        if (typ === 'karussell') await buildCarousel(eng, x, tmp, { format: 'feed', trocken: true }); else await renderStory(eng, x, tmp, { trocken: true })
        for (const f of fs.readdirSync(tmp).filter((f) => /\.jpe?g$/.test(f))) fs.copyFileSync(path.join(tmp, f), path.join(out, f))
        ok++
      } catch (e) { fehler++; console.log(`${it.id}: nicht neu gerendert: ${String(e.gruende?.join('; ') || e.message).slice(0, 200)}`) }
    }
  }
} finally { await eng.close?.(); fs.rmSync(path.join(ROOT, 'out', '_neu-rendern'), { recursive: true, force: true }) }
console.log(`Neu gerendert: ${ok}, fehlgeschlagen: ${fehler}`)
process.exit(0)
