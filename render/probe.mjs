// Probelauf des Looks „Orange“ ohne Queue: rendert Karussells und Stories aus dem Vorrat nach out/<id>/ und baut einen
// Kontaktbogen. Bilder kommen wie in produce.mjs aus render/bilder.mjs (bilder/<id>.png,
// bilder/vorrat/<id>.png oder Higgsfield mit Schlüssel); --trocken verhindert jede bezahlte Anfrage.
// Aufruf: node render/probe.mjs k01 k02 [s01] [--familie k01=nacht,k02=tag] [--bogen out/test-uebersicht.jpg] [--trocken]
// Exit-Code 1, wenn ein Beitrag die Prüfung nicht besteht.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { createEngine } from './engine.mjs'
import { allePosts, alleStories } from './inhalt.mjs'
import { buildCarousel } from './karussell.mjs'
import { renderStory } from './story.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

/**
 * Kontaktbogen: `gruppen` ist eine Liste von Zeilen (je Beitrag eine Liste von Dateien). Ohne `spalten` steht jede
 * Zeile in einer eigenen Bildzeile; mit `spalten` werden alle Dateien einer Gruppe in Reihen zu `spalten` Kacheln
 * gepackt (Gruppen stehen untereinander, Kachelbreite `breite`, grauer Grund).
 */
export async function kontaktbogen(zeilen, ziel, { breite = 360, luecke = 12, spalten = 0, gruppen = null } = {}) {
  const bloecke = gruppen || zeilen.map((z) => [z])
  const kacheln = []
  let y = luecke, maxX = 0
  for (const block of bloecke) {
    const reihen = []
    if (spalten) { const alle = block.flat(); for (let i = 0; i < alle.length; i += spalten) reihen.push(alle.slice(i, i + spalten)) } else reihen.push(...block)
    for (const dateien of reihen) {
      let x = luecke, h = 0
      for (const f of dateien) {
        const buf = await sharp(f).resize({ width: breite }).jpeg({ quality: 86 }).toBuffer()
        const m = await sharp(buf).metadata()
        kacheln.push({ input: buf, left: x, top: y })
        x += breite + luecke
        h = Math.max(h, m.height)
      }
      maxX = Math.max(maxX, x)
      y += h + luecke
    }
    y += luecke
  }
  fs.mkdirSync(path.dirname(ziel), { recursive: true })
  await sharp({ create: { width: maxX, height: y, channels: 3, background: '#8a8a8a' } }).composite(kacheln).jpeg({ quality: 86 }).toFile(ziel)
  return ziel
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2)
  const opt = (n, d) => (a.includes(n) ? a[a.indexOf(n) + 1] : d)
  const familien = Object.fromEntries((opt('--familie', '') || '').split(',').filter(Boolean).map((x) => x.split('=')))
  const bogen = path.resolve(ROOT, opt('--bogen', 'out/test-uebersicht.jpg'))
  const ids = a.filter((x, i) => !x.startsWith('--') && !['--familie', '--bogen'].includes(a[i - 1]))
  const posts = allePosts(), stories = alleStories()
  const eng = await createEngine()
  const zeilen = [], kurz = [], storySeiten = []
  let fehler = 0
  try {
    for (const id of ids) {
      const nr = +id.slice(1)
      const out = path.join(ROOT, 'out', id)
      fs.rmSync(out, { recursive: true, force: true })
      try {
        if (id.startsWith('k')) {
          const p = posts.find((x) => x.nr === nr)
          if (!p) throw new Error('nicht im Vorrat')
          const r = await buildCarousel(eng, { ...p, familie: familien[id] || p.familie }, out, { trocken: a.includes('--trocken') })
          console.log(`✓ ${id} ${p.titel}: ${r.familie}, ${r.cover_vorlage}, Bild ${r.bild.anbieter}${r.gegenmassnahmen.length ? `, Gegenmaßnahmen: ${r.gegenmassnahmen.join('; ')}` : ''}${r.hinweise.length ? `\n    Hinweis: ${r.hinweise.join('; ')}` : ''}`)
          zeilen.push(r.files)
          kurz.push(r.files.slice(0, 2))
        } else {
          const s = stories.find((x) => x.nr === nr)
          if (!s) throw new Error('nicht im Vorrat')
          const r = await renderStory(eng, { ...s, familie: familien[id] || s.familie }, out, { trocken: a.includes('--trocken') })
          console.log(`✓ ${id} ${s.titel}: ${r.familie}${r.bild ? `, Bild ${r.bild.anbieter}` : ', ohne Bild'}${r.gegenmassnahmen.length ? `, Gegenmaßnahmen: ${r.gegenmassnahmen.join('; ')}` : ''}`)
          zeilen.push(r.dateien)
          storySeiten.push(r.dateien)
        }
      } catch (e) {
        fehler++
        console.log(`✗ ${id}: ${e.message}${e.gruende ? e.gruende.map((g) => '\n    ' + g).join('') : ''}`)
      }
    }
  } finally {
    await eng.close()
  }
  if (zeilen.length) {
    // Übersicht: Cover und Seite 2 je Karussell, alle Story-Seiten; vollständig (je Beitrag eine Zeile) daneben als <name>-alle.jpg
    const alle = bogen.replace(/(-uebersicht)?(\.jpg)$/, (m, u, e) => `${u ? '-alle' : '-alle'}${e}`)
    await kontaktbogen(null, bogen, { breite: 250, spalten: 8, gruppen: [kurz, storySeiten].filter((g) => g.length) })
    await kontaktbogen(zeilen, alle, { breite: 220 })
    console.log(`Kontaktbogen: ${path.relative(ROOT, bogen)} (Cover + Seite 2, Stories), vollständig: ${path.relative(ROOT, alle)}`)
  }
  if (fehler) process.exit(1)
}
