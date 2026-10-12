// Holt täglich Kennzahlen der letzten Beiträge und die Followerzahl. Schreibt data/messwerte.json.
// Je Beitrag: reach, views, likes, comments, saved, shares, follows, profile_visits (soweit die API die Metrik für den
// Medientyp liefert; nicht unterstützte Metriken fängt instagram.mjs einzeln ab) und die Merkmale aus der Queue
// (Säule, Hook-Stil, Format, Cover-Vorlage, Wochentag, Uhrzeit, Caption-Länge) für den Optimierer.
import fs from 'node:fs'
import path from 'node:path'
import { ladeQueue } from './queue.mjs'
import * as ig from './instagram.mjs'
import { berlin } from './zeit.mjs'
import { merkmaleVon, wachstumswert } from './optimierer.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const FILE = path.join(ROOT, 'data/messwerte.json')
const daten = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { konto: [], beitraege: {} }
daten.konto ||= []
daten.beitraege ||= {}
const heute = berlin().datum
const q = await ladeQueue()

try {
  const k = await ig.kontoInfo()
  const vorher = daten.konto.filter((x) => x.datum !== heute).at(-1)
  const zeile = { datum: heute, follower: k.followers_count, gefolgt: k.follows_count, beitraege: k.media_count, follower_neu: vorher?.follower != null ? k.followers_count - vorher.follower : null }
  daten.konto = daten.konto.filter((x) => x.datum !== heute)
  daten.konto.push(zeile)
  console.log(`Follower ${k.followers_count}${zeile.follower_neu != null ? ` (${zeile.follower_neu >= 0 ? '+' : ''}${zeile.follower_neu} seit ${vorher.datum})` : ''}`)
} catch (e) { console.log('Kontodaten nicht abrufbar:', e.message) }

const liste = await ig.mediaListe(30)
for (const m of liste) {
  const item = q.find((x) => x.ig?.id === m.id)
  const typ = m.media_product_type === 'REELS' ? 'reel' : m.media_product_type === 'STORY' ? 'story' : 'feed'
  let ins = { werte: {}, nichtVerfuegbar: [] }
  try { ins = await ig.insights(m.id, { typ }) } catch (e) { console.log(`Insights ${m.id}:`, e.message) }
  const b = (daten.beitraege[m.id] ||= { id: item?.id || null, titel: item?.titel || null, typ, permalink: m.permalink, zeit: m.timestamp, verlauf: [] })
  // Merkmale bei jedem Lauf aus der Queue nachziehen (ältere Einträge ohne Merkmale bekommen sie so nachträglich)
  if (item) Object.assign(b, { id: item.id, titel: item.titel, hook: item.hook || null, angebot: item.angebot ?? null, werkzeug: item.werkzeug ?? null, merkmale: merkmaleVon(item, item.ig?.am || m.timestamp) })
  b.verlauf = b.verlauf.filter((v) => v.datum !== heute)
  const werte = { likes: m.like_count, kommentare: m.comments_count, ...ins.werte }
  b.verlauf.push({ datum: heute, ...werte, wachstumswert: wachstumswert(werte) })
  if (ins.nichtVerfuegbar?.length) b.nichtVerfuegbar = ins.nichtVerfuegbar
}
fs.mkdirSync(path.dirname(FILE), { recursive: true })
fs.writeFileSync(FILE, JSON.stringify(daten, null, 1))
console.log(`${liste.length} Beiträge gemessen.`)
