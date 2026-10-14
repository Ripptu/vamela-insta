// Suchbegriffe je Karussell (Christian, 14.10.2026: „nicht immer nur 100–300 Aufrufe“). TikTok und Instagram sind Suchmaschinen:
// Beiträge, die eine echte Suchanfrage treffen, landen in der Suche und öfter auf der Für-dich-Seite. Darum bekommt jedes Karussell
// eine Suchphrase, wie Kunden sie eintippen („QR Code erstellen kostenlos“). Sie steht im TikTok-Titel, in der Beschreibung,
// als Hashtag und als Suchleiste im Hero-Bild (TikTok liest Text im Bild mit).
// Die Phrasen stehen in plan/suchbegriffe.json und sind gegen die Google-Vorschläge (Deutsch) geprüft: Was dort vorgeschlagen wird,
// suchen Menschen tatsächlich. Neue Beiträge ohne Eintrag bekommen ihre Phrase automatisch aus den Vorschlägen zum Titel.
// Aufruf: node automatik/suchbegriffe.mjs --fehlende   (ergänzt fehlende Einträge für alle offenen Karussells)
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const DATEI = path.join(ROOT, 'plan/suchbegriffe.json')

export const FUELL = new Set(['der', 'die', 'das', 'dein', 'deine', 'deinen', 'ein', 'eine', 'im', 'in', 'auf', 'mit', 'ohne', 'zum', 'zur', 'vom', 'von', 'für', 'und', 'oder', 'ist', 'wie', 'was', 'statt', 'den', 'dem', 'des', 'so', 'als'])

export function ladeSuchbegriffe() {
  try { return JSON.parse(fs.readFileSync(DATEI, 'utf8')) } catch { return {} }
}
export const suchphrase = (id) => ladeSuchbegriffe()[id]?.suche || ''

/** Hashtags aus der Phrase: alle Inhaltswörter zusammen (wenn kurz genug) und das erste Inhaltswort, klein, ohne Satzzeichen. */
export function phrasenTags(phrase) {
  const w = inhaltsWoerter(phrase)
  if (!w.length) return []
  const tags = [w.join(''), w.slice(0, 2).join(''), w[0]].filter((t) => t.length >= 3 && t.length <= 24)
  return [...new Set(tags)].slice(0, 2).map((t) => '#' + t)
}
export const inhaltsWoerter = (t) => String(t || '').toLowerCase().replace(/[^\p{L}\d\s]/gu, ' ').split(/\s+/).filter((x) => x && !FUELL.has(x))

/** Vorschläge von Google (Deutsch) für einen Suchanfang. */
export async function vorschlaege(q) {
  const r = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=de&q=${encodeURIComponent(q.toLowerCase())}`, { signal: AbortSignal.timeout(10000) })
  const j = await r.json().catch(() => [q, []])
  return Array.isArray(j[1]) ? j[1] : []
}

/** Phrase für einen neuen Beitrag: Anfänge aus den Titelwörtern, erster Vorschlag, der ein Titelwort enthält. */
export async function phraseAusTitel(titel) {
  const woerter = String(titel || '').replace(/[„“"?!.:,]/g, ' ').split(/\s+/).filter((x) => x && !FUELL.has(x.toLowerCase()))
  const kern = new Set(woerter.map((x) => x.toLowerCase()))
  for (const n of [3, 2, 1]) {
    for (let i = 0; i + n <= woerter.length; i++) {
      const s = await vorschlaege(woerter.slice(i, i + n).join(' '))
      const t = s.find((x) => x.split(/\s+/).some((w) => kern.has(w)) && x.split(/\s+/).length >= 2 && x.split(/\s+/).length <= 5)
      if (t) return t.replace(/(^|\s)\p{Ll}/gu, (m) => m.toUpperCase())
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  return ''
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const { ladeQueue } = await import('./queue.mjs')
  const q = await ladeQueue()
  const plan = ladeSuchbegriffe()
  let neu = 0
  for (const x of q.filter((i) => i.typ === 'karussell' && ['geprueft', 'neu'].includes(i.status) && !plan[i.id])) {
    try {
      const p = await phraseAusTitel(x.titel || x.hook)
      if (p) { plan[x.id] = { suche: p, auto: true }; neu++; console.log(`${x.id}: ${p}`) }
    } catch (e) { console.log(`${x.id}: keine Phrase (${e.message})`) }
  }
  if (neu) fs.writeFileSync(DATEI, JSON.stringify(plan, null, 2) + '\n')
  console.log(`Suchbegriffe: ${neu} ergänzt, ${Object.keys(plan).length} insgesamt`)
}
