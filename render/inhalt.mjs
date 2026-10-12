// Liest den Inhaltsvorrat in Strukturen: Karussells (docs/content-posts.md), Stories (docs/content-stories-auto.md)
// und Scroll-Reels (docs/content-reels.md). Nur Parser, kein Rendern (das machen render/karussell.mjs und render/story.mjs).
// Jeder Block trägt die Merkmale für den Optimierer (Säule, Hook-Stil); fehlen sie, bleiben sie null. Dazu die Felder
// für den Look „Orange“: mehrwert, motiv (englische Bildbeschreibung für render/bilder.mjs), familie (nacht|tag).
// Textseiten behalten neben `text` (ohne „ / “) die Rohfassung `roh` mit „Kopf / Rest“ und Akzent-Markup (*…*, _…_, ==…==).
import fs from 'node:fs'

const strip = (s) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
const quoted = (s) => {
  const a = s.indexOf('„')
  const b = Math.max(s.lastIndexOf('“'), s.lastIndexOf('"'))
  return a >= 0 && b > a ? strip(s.slice(a + 1, b)) : null
}
/** Metazeilen „- Schlüssel: Wert“ eines Blocks, Schlüssel klein geschrieben. */
const metazeilen = (sec) => {
  const meta = {}
  for (const m of sec.matchAll(/^- ([^:\n]+): (.+)$/gm)) meta[m[1].trim().toLowerCase()] = m[2].trim()
  // Felder für den Look „Orange“ dürfen auch ohne Spiegelstrich stehen („motiv: …“)
  for (const m of sec.matchAll(/^(mehrwert|motiv|familie):\s*(.+)$/gim)) meta[m[1].toLowerCase()] ??= m[2].trim()
  return meta
}
/** Felder für Gestaltung und Bild: Mehrwert (Satz für den Leser), Motiv (englische Bildbeschreibung), Familie nacht|tag. */
const gestaltung = (meta) => {
  const ohne = (v) => (v ? String(v).trim().replace(/^[„"]|[“"]$/g, '').trim() || null : null)
  const f = merkmal(meta.familie)
  return { mehrwert: ohne(meta.mehrwert), motiv: ohne(meta.motiv), familie: f === 'nacht' || f === 'tag' ? f : null }
}
/** Säule und Hook-Stil klein und ohne Zusätze („tipps (Website)“ → „tipps“). */
const merkmal = (v) => (v ? String(v).trim().toLowerCase().split(/[\s(]/)[0] || null : null)

export const POSTS_BASIS = new URL('../docs/content-posts.md', import.meta.url)
export const POSTS_AUTO = new URL('../docs/content-posts-auto.md', import.meta.url)
export const STORIES_BASIS = new URL('../docs/content-stories-auto.md', import.meta.url)
export const REELS_BASIS = new URL('../docs/content-reels.md', import.meta.url)
export const REELS_AUTO = new URL('../docs/content-reels-auto.md', import.meta.url)

export function readPosts(file = POSTS_BASIS) {
  const md = fs.readFileSync(file, 'utf8')
  const start = md.indexOf('# Karussells')
  const end = md.search(/^# Stories/m)
  const body = md.slice(start, end > 0 ? end : undefined)
  const posts = []
  for (const sec of body.split(/^## /m).slice(1)) {
    const head = sec.match(/^Karussell (\d+): (.+)/)
    if (!head) continue
    const meta = metazeilen(sec)
    const pages = []
    for (const line of sec.split('\n')) {
      const m = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|\s*$/)
      if (!m) continue
      const vorlage = m[2]
      const raw = m[3]
      const v = vorlage.toLowerCase()
      const role = v.includes('cover') ? 'cover' : v.includes('zitat') ? 'quote' : v.includes('schluss') ? 'close' : 'text'
      if (role === 'cover') {
        const [h, ...s] = raw.split(' / ')
        pages.push({ n: +m[1], role, vorlage, head: strip(h), sub: strip(s.join(' / ')) })
      } else pages.push({ n: +m[1], role, vorlage, text: strip(raw).replace(/\s+\/\s+/g, ' ').replace(/^\/\s*/, ''), roh: strip(raw).replace(/^\/\s*/, '') })
    }
    const cap = sec.match(/\*\*Caption:\*\*\n([\s\S]*?)\n\*\*Hashtags:\*\*\s*(.+)/)
    posts.push({
      nr: +head[1], titel: head[2].trim(), saeule: merkmal(meta['säule']), hook_stil: merkmal(meta['hook-stil']),
      angebot: meta.angebot || 'keins', werkzeug: meta.werkzeug || null, cover_vorlage: meta['cover-vorlage'] || null,
      fruehestens: meta['frühestens'] || null, ...gestaltung(meta), pages, caption: cap ? cap[1].trim() : '', hashtags: cap ? cap[2].trim() : '',
    })
  }
  return posts
}

/**
 * Liest den Abschnitt "# Stories" einer Story-Datei (Standard: docs/content-stories-auto.md; von Hand gepflegte und
 * automatisch geschriebene Stories stehen im selben Aufbau). Fehlt der Abschnitt, kommt eine leere Liste zurück.
 */
export function readStories(file = STORIES_BASIS) {
  const md = fs.readFileSync(file, 'utf8')
  const start = md.search(/^# Stories/m)
  if (start < 0) return []
  const end = md.search(/^# Übersicht/m)
  const body = md.slice(start, end > start ? end : undefined)
  const out = []
  for (const sec of body.split(/^## /m).slice(1)) {
    const head = sec.match(/^Story (\d+): (.+)/)
    if (!head) continue
    const line = (prefix) => sec.split('\n').find((l) => l.startsWith('- ' + prefix))
    const val = (prefix) => { const l = line(prefix); return l ? l.slice(l.indexOf(':') + 1).trim() : '' }
    const auto = line('Automatik-Fassung')
    const aufl = line('Auflösung')
    if (!auto) throw new Error(`Story ${head[1]}: keine Automatik-Fassung`)
    out.push({
      nr: +head[1], id: `s${head[1]}`, titel: head[2].trim(),
      interaktion: val('Interaktion'), saeule: merkmal(val('Säule')), hook_stil: merkmal(val('Hook-Stil')), ziel: val('Ziel'),
      hintergrund: val('Hintergrund'),
      textHg: val('Text auf dem Hintergrund'), sticker: val('Sticker'),
      text: quoted(auto),
      aufloesung: aufl ? quoted(aufl) : null,
      ...gestaltung(metazeilen(sec)),
    })
  }
  return out
}

/**
 * Alle Stories aus der Basisdatei und optional einer zweiten Datei. `datei` nennt die Quelle. Ist die zweite Datei
 * nicht lesbar oder wiederholt sie eine Nummer, wird das gemeldet und nur der Rest benutzt.
 */
export function alleStories({ basis = STORIES_BASIS, auto = null } = {}) {
  const name = (f) => 'docs/' + String(f instanceof URL ? f.pathname : f).split('/').pop()
  const out = fs.existsSync(basis) ? readStories(basis).map((s) => ({ ...s, datei: name(basis) })) : []
  if (!auto || !fs.existsSync(auto)) return out
  try {
    const nummern = new Set(out.map((s) => s.nr))
    for (const s of readStories(auto)) {
      if (nummern.has(s.nr)) { console.warn(`Story ${s.nr} in ${name(auto)} gibt es schon, übersprungen.`); continue }
      nummern.add(s.nr)
      out.push({ ...s, datei: name(auto) })
    }
  } catch (e) {
    console.warn(`${name(auto)} nicht lesbar (${e.message}), diese Stories werden übersprungen.`)
  }
  return out
}

/**
 * Liest Scroll-Reels (docs/content-reels.md). Ablauf-Tabelle „Zeit | Aufnahme | Text im Bild“ mit Zeilen wie
 * „| 0–3 s | Seitenanfang, ruhig | „Hook““. Die Aufnahme beschreibt, was der Rekorder auf der Seite tut.
 */
export function readReels(file = REELS_BASIS) {
  const md = fs.readFileSync(file, 'utf8')
  const out = []
  for (const sec of md.split(/^## /m).slice(1)) {
    const head = sec.match(/^Reel (\d+): (.+)/)
    if (!head) continue
    const meta = metazeilen(sec)
    const hookLine = sec.match(/\*\*Hook[^\n]*\*\*\s*(.+)/)
    const ablauf = []
    let prev = 0
    for (const line of sec.split('\n')) {
      const m = line.match(/^\|\s*(\d+)\s*[–-]\s*(\d+)\s*s\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$/)
      if (!m) continue
      const cell = m[4]
      const text = cell.trim() === '–' ? '' : (quoted(cell) ?? strip(cell))
      ablauf.push({ von: +m[1], bis: +m[2], dauer: +m[2] - prev, aufnahme: m[3], text })
      prev = +m[2]
    }
    const cap = sec.match(/\*\*Caption:\*\*\n([\s\S]*?)\n\*\*Hashtags:\*\*\s*(.+)/)
    const nr = +head[1]
    out.push({
      nr, id: `r${nr}`, titel: head[2].trim(), saeule: merkmal(meta['säule']), hook_stil: merkmal(meta['hook-stil']),
      angebot: meta.angebot || 'keins', werkzeug: meta.werkzeug || null, url: meta.url || null, ton: meta.ton || 'stumm',
      fruehestens: meta['frühestens'] || null,
      hook: hookLine ? quoted(hookLine[1]) : null,
      ablauf, caption: cap ? cap[1].trim() : '', hashtags: cap ? cap[2].trim() : '',
      dauer: ablauf.length ? ablauf[ablauf.length - 1].bis : 0,
    })
  }
  return out
}

/** Alle Karussells bzw. Reels aus Basis- und Auto-Datei. */
export const allePosts = () => [...readPosts(POSTS_BASIS), ...(fs.existsSync(POSTS_AUTO) ? readPosts(POSTS_AUTO) : [])]
export const alleReels = () => [...readReels(REELS_BASIS), ...(fs.existsSync(REELS_AUTO) ? readReels(REELS_AUTO) : [])]
