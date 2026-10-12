// Ordnet Vorratsbilder (bilder/vorrat/<id>.png + .json mit prompt) den Blöcken zu, deren „Motiv“ im Prompt steckt, und benennt um.
// Nötig, wenn Nummern sich nach dem Erzeugen der Bilder verschoben haben (z. B. nach einem ausgefallenen Schreib-Lauf).
// Aufruf: node automatik/bilder-zuordnen.mjs [--trocken]   (nur Stories und Karussells ab Nummer 101, noch ohne Queue-Eintrag)
import fs from 'node:fs'
import path from 'node:path'
import { allePosts, alleStories } from '../render/inhalt.mjs'
const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const dir = path.join(ROOT, 'bilder/vorrat')
const trocken = process.argv.includes('--trocken')
const pad = (n) => String(n).padStart(2, '0')
const queue = (() => { try { return new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'plan/queue.json'), 'utf8')).map((x) => x.id)) } catch { return new Set() } })()
const bloecke = [...allePosts().map((p) => ({ id: `k${pad(p.nr)}`, nr: p.nr, p })), ...alleStories().map((s) => ({ id: `s${pad(s.nr)}`, nr: s.nr, p: s }))].filter((b) => b.nr >= 101 && !queue.has(b.id))
const norm = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim()
const bilder = fs.readdirSync(dir).filter((f) => /^[ks]\d+\.json$/.test(f)).map((f) => { const id = f.replace('.json', ''); const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); return { id, prompt: norm(j.prompt) } })
const nummer = (id) => +id.slice(1)
const zuordnung = []
for (const b of bloecke) {
  const m = norm(b.p.motiv)
  if (!m) continue
  const treffer = bilder.filter((x) => x.id[0] === b.id[0] && nummer(x.id) >= 101 && x.prompt.includes(m))
  if (treffer.length === 1 && treffer[0].id !== b.id) zuordnung.push({ von: treffer[0].id, nach: b.id })
}
console.log(zuordnung.length ? zuordnung.map((z) => `${z.von} -> ${z.nach}`).join('\n') : 'Alle Bilder liegen richtig.')
if (!trocken && zuordnung.length) {
  const tmp = zuordnung.map((z, i) => ({ ...z, t: `_t${i}` }))
  for (const z of tmp) for (const e of ['png', 'json']) fs.renameSync(path.join(dir, `${z.von}.${e}`), path.join(dir, `${z.t}.${e}`))
  for (const z of tmp) for (const e of ['png', 'json']) fs.renameSync(path.join(dir, `${z.t}.${e}`), path.join(dir, `${z.nach}.${e}`))
  for (const z of tmp) { const f = path.join(dir, `${z.nach}.json`); const j = JSON.parse(fs.readFileSync(f, 'utf8')); j.id = z.nach; fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n') }
  console.log('Umbenannt.')
}
