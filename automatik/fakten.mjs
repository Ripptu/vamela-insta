// Fakten-Prüfung: Preise, Werkzeug-Adressen und Referenzen in Beiträgen dürfen nur so vorkommen, wie sie in
// data/fakten.json stehen, und data/fakten.json muss zu vamela.de passen (CLAUDE.md, „Preise nur wie auf vamela.de“).
//
//   import { pruefeText, pruefeLive } from './fakten.mjs'
//   pruefeText(text)            -> Liste von Verstößen (leer = gut), ohne Netz
//   await pruefeLive()          -> Liste von Problemen: Preis steht nicht mehr auf der Seite, Adresse antwortet nicht mit 200
//
// Aufruf: node automatik/fakten.mjs --live   (Exit 1 bei Problemen, schreibt data/fakten-pruefung.json)
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
export const FAKTEN_PFAD = path.join(ROOT, 'data/fakten.json')
export const ladeFakten = (pfad = FAKTEN_PFAD) => JSON.parse(fs.readFileSync(pfad, 'utf8'))

const leer = (s) => String(s || '').replace(/&nbsp;|&#160;|[   ]/g, ' ').replace(/&euro;/g, '€')
/** Preise im Text als „N €“ (Tausenderpunkt bleibt, „Euro“ wird zu „€“). */
export function preiseImText(text) {
  const t = leer(text).replace(/(\d)\s*(Euro|EUR)\b/g, '$1 €')
  return [...t.matchAll(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{2}))?\s?€/g)].map((m) => `${m[1]}${m[2] && m[2] !== '00' ? ',' + m[2] : ''} €`)
}
/** Pfade auf vamela.de, die im Text genannt werden („vamela.de/qr-code-generator“). */
export function vamelaPfade(text) {
  return [...leer(text).matchAll(/vamela\.de(\/[a-z0-9\-/]*)/gi)].map((m) => m[1].replace(/[.,;:)]+$/, '')).filter((p) => p !== '/')
}
const ohneSchraegstrich = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p)
/** Erlaubte Pfade: Werkzeuge, eigene Seiten, Referenz-Seiten auf vamela.de und Referenzen, die unter vamela.de laufen (z. B. /bachmaier/). */
export const bekanntePfade = (f) => new Set([
  ...[...f.werkzeuge, ...f.referenzen, ...(f.eigene_seiten || [])].map((x) => ohneSchraegstrich(x.pfad)),
  ...f.referenzen.filter((r) => /^https:\/\/vamela\.de\//.test(r.seite || '')).map((r) => ohneSchraegstrich(new URL(r.seite).pathname)),
])

/** Verstöße eines Textes gegen die Fakten (ohne Netz). */
export function pruefeText(text, fakten = ladeFakten()) {
  const out = []
  const erlaubt = new Set(fakten.preise.map((p) => p.text))
  for (const p of preiseImText(text)) if (!erlaubt.has(p)) out.push(`Preis ${p} steht nicht in data/fakten.json (nur Preise von vamela.de)`)
  const pfade = bekanntePfade(fakten)
  for (const p of vamelaPfade(text)) if (!pfade.has(ohneSchraegstrich(p))) out.push(`Adresse vamela.de${p} ist nicht in data/fakten.json`)
  return out
}
/** Alle Texte eines Beitrags (Seiten, Caption, Werkzeug-Feld) in einem String. */
export const beitragsText = (x) => [x.caption, x.werkzeug ? `vamela.de${x.werkzeug}` : '', ...(x.pages || []).map((p) => [p.head, p.sub, p.text].filter(Boolean).join(' ')), ...(x.ablauf || []).map((a) => a.text), x.text, x.textHg, x.aufloesung].filter(Boolean).join('\n')

/** Abgleich mit der Live-Seite: jeder Preis-Beleg steht noch auf seiner Seite, jede Adresse antwortet mit 200. */
export async function pruefeLive(fakten = ladeFakten(), { holen = fetch, nurPreise = false } = {}) {
  const probleme = []
  const cache = new Map()
  const seite = async (pfad) => {
    if (!cache.has(pfad)) {
      cache.set(pfad, (async () => {
        try {
          const r = await holen(fakten.basis + pfad, { redirect: 'follow', signal: AbortSignal.timeout(20000) })
          const html = await r.text()
          const text = leer(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ')
          return { status: r.status, text }
        } catch (e) { return { status: 0, text: '', fehler: e.message } }
      })())
    }
    return cache.get(pfad)
  }
  for (const p of fakten.preise) {
    const s = await seite(p.seite)
    if (s.status !== 200) { probleme.push(`Preisseite ${p.seite} antwortet mit ${s.status || s.fehler}`); continue }
    const beleg = p.beleg || p.text
    if (!s.text.includes(beleg)) probleme.push(`Preis „${beleg}“ (${p.bedeutung}) steht nicht mehr auf ${p.seite}`)
  }
  if (!nurPreise) {
    for (const x of [...fakten.werkzeuge, ...fakten.referenzen, ...(fakten.eigene_seiten || [])]) {
      const s = await seite(x.pfad)
      if (s.status !== 200) probleme.push(`${x.name}: ${x.pfad} antwortet mit ${s.status || s.fehler}`)
    }
  }
  return [...new Set(probleme)]
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const nurPreise = process.argv.includes('--preise')
  if (!process.argv.includes('--live')) { console.log('Aufruf: node automatik/fakten.mjs --live [--preise]'); process.exit(2) }
  const probleme = await pruefeLive(ladeFakten(), { nurPreise })
  const ergebnis = { am: new Date().toISOString(), ok: !probleme.length, probleme }
  fs.writeFileSync(path.join(ROOT, 'data/fakten-pruefung.json'), JSON.stringify(ergebnis, null, 1) + '\n')
  if (probleme.length) { console.log('Fakten passen nicht mehr zu vamela.de:\n- ' + probleme.join('\n- ')); process.exit(1) }
  console.log('Fakten stimmen mit vamela.de überein.')
}
