// Repo-Prüfung für die Säule „fundstuecke“: Jedes vorgestellte GitHub-Repository muss echt und gepflegt sein, und der Beitrag
// darf nur sagen, was die GitHub-API und das README hergeben (CLAUDE.md, „Fundstücke nur echt und live geprüft“).
// Geprüft wird vor dem Schreiben (neu-schreiben.mjs, trends.mjs), im Prüf-Agenten (qa.mjs) und vor dem Veröffentlichen
// (publish.mjs).
//
//   await pruefeRepo('owner/name')   -> { ok, slug, probleme[], voruebergehend, daten }
//       ok nur, wenn: existiert, nicht archiviert, kein Fork, letzter Push jünger als 12 Monate, Lizenz mit Namen
//       (SPDX-Kennung; „NOASSERTION“/„Other“ zählt als keine Lizenz). voruebergehend = Netz oder Ratenlimit, kein Urteil.
//   await holeReadme('owner/name')   -> README als Text (ohne HTML), gekürzt
//   kostenHinweise(text)             -> Stichworte, die auf Bezahlangebote hindeuten (Beitrag muss dann Kosten nennen)
//   sterneText(n, datum)             -> „rund 50.000 (Stand 12.10.2026)“
//   pruefeRepoAngaben(block, daten)  -> Verstöße der Angaben im Beitrag (Repo, Lizenz, Sterne, Adresse, Kosten) gegen live
//   repoAdressen(text)               -> ['owner/name', …] aus „github.com/owner/name“
//
// Ohne Token gilt das GitHub-Limit von 60 Anfragen je Stunde (je Repo 1, mit README 2). In Actions GITHUB_TOKEN setzen
// (5.000 je Stunde, kostenlos). GITHUB_API ersetzt die Basisadresse (nur für Tests).
// Aufruf: node automatik/repo-check.mjs owner/name [owner/name …]   (Exit 1 bei Problemen)
import path from 'node:path'
import { berlin } from './zeit.mjs'

export const MAX_ALTER_TAGE = 365
const api = () => (process.env.GITHUB_API || 'https://api.github.com').replace(/\/+$/, '')
const token = () => process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
export const SLUG = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/

/** „rund 50.000“: unter 1.000 auf Zehner, unter 10.000 auf Hunderter, sonst auf Tausender gerundet. */
export function sterneGerundet(n) {
  const x = Math.max(0, Math.round(+n || 0))
  const r = x < 10 ? x : x < 1000 ? Math.round(x / 10) * 10 : x < 10000 ? Math.round(x / 100) * 100 : Math.round(x / 1000) * 1000
  return `rund ${String(r).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}
const deDatum = (iso) => iso.split('-').reverse().join('.')
/** Sterne-Zeile für den Beitrag: „rund 50.000 (Stand 12.10.2026)“. */
export const sterneText = (n, jetzt = new Date()) => `${sterneGerundet(n)} (Stand ${deDatum(berlin(jetzt).datum)})`
export const STERNE_FORMAT = /^rund (\d{1,3}(?:\.\d{3})*) \(Stand (\d{2})\.(\d{2})\.(\d{4})\)$/
const zahlAus = (t) => +String(t).replace(/\./g, '')

/** Repos aus „github.com/owner/name“ im Text (ohne Unterseiten wie /releases), eindeutig, klein geschrieben verglichen. */
export function repoAdressen(text) {
  const out = new Map()
  for (const m of String(text || '').matchAll(/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)/gi)) {
    const slug = `${m[1]}/${m[2].replace(/\.git$/i, '').replace(/[.,;:]+$/, '')}`
    if (SLUG.test(slug) && !out.has(slug.toLowerCase())) out.set(slug.toLowerCase(), slug)
  }
  return [...out.values()]
}

async function anfrage(pfad, { holen = fetch, accept = 'application/vnd.github+json' } = {}) {
  const headers = { Accept: accept, 'User-Agent': 'vamela-insta', 'X-GitHub-Api-Version': '2022-11-28' }
  if (token()) headers.Authorization = `Bearer ${token()}`
  const r = await holen(api() + pfad, { headers, redirect: 'follow', signal: AbortSignal.timeout(20000) })
  const h = (k) => (typeof r.headers?.get === 'function' ? r.headers.get(k) : r.headers?.[k]) ?? null
  return { status: r.status, rest: h('x-ratelimit-remaining'), reset: h('x-ratelimit-reset'), text: () => r.text() }
}
const limitText = (reset) => (reset ? ` (wieder ab ${new Date(+reset * 1000).toISOString().slice(11, 16)} UTC)` : '')

/** Live-Prüfung eines Repos über die GitHub-API. */
export async function pruefeRepo(slug, { holen = fetch, jetzt = new Date(), maxAlterTage = MAX_ALTER_TAGE } = {}) {
  const ergebnis = (probleme, daten = null, voruebergehend = false) => ({ ok: !probleme.length, slug, probleme, voruebergehend, daten })
  if (!SLUG.test(String(slug || ''))) return ergebnis([`„${slug}“ ist keine Repo-Angabe der Form owner/name`])
  let r, j
  try {
    r = await anfrage(`/repos/${slug}`, { holen })
    if ((r.status === 403 || r.status === 429) && (r.rest === '0' || r.status === 429)) return ergebnis([`GitHub-Ratenlimit erreicht${limitText(r.reset)}`], null, true)
    if (r.status >= 500 || r.status === 403) return ergebnis([`GitHub antwortet mit ${r.status}`], null, true)
    if (r.status === 404 || r.status === 451) return ergebnis([`${slug} existiert nicht (mehr) auf GitHub`])
    if (r.status !== 200) return ergebnis([`GitHub antwortet mit ${r.status}`], null, true)
    j = JSON.parse(await r.text())
  } catch (e) {
    return ergebnis([`GitHub nicht erreichbar (${String(e.message || e).slice(0, 80)})`], null, true)
  }
  const spdx = j.license?.spdx_id && j.license.spdx_id !== 'NOASSERTION' ? j.license.spdx_id : null
  const daten = {
    slug: j.full_name || slug, url: j.html_url || `https://github.com/${slug}`, beschreibung: j.description || '',
    lizenz: spdx, lizenz_name: spdx ? j.license.name : null, sterne: +j.stargazers_count || 0, sterne_text: sterneText(j.stargazers_count, jetzt),
    stand: berlin(jetzt).datum, letzter_push: j.pushed_at || null, archiviert: !!j.archived, fork: !!j.fork, homepage: j.homepage || null,
    themen: Array.isArray(j.topics) ? j.topics : [],
  }
  const p = []
  if (daten.slug.toLowerCase() !== String(slug).toLowerCase()) p.push(`${slug} heißt inzwischen ${daten.slug}, Angabe nachziehen`)
  if (daten.archiviert) p.push(`${daten.slug} ist archiviert (wird nicht mehr gepflegt)`)
  if (daten.fork) p.push(`${daten.slug} ist ein Fork, das Original vorstellen`)
  if (j.disabled) p.push(`${daten.slug} ist auf GitHub gesperrt`)
  if (!daten.letzter_push) p.push(`${daten.slug}: letzter Push unbekannt`)
  else {
    const tage = (jetzt - new Date(daten.letzter_push)) / 864e5
    if (tage > maxAlterTage) p.push(`${daten.slug}: letzter Push am ${daten.letzter_push.slice(0, 10)}, älter als ${Math.round(maxAlterTage / 30.4)} Monate`)
  }
  if (!spdx) p.push(`${daten.slug}: keine eindeutige Lizenz (GitHub meldet ${j.license?.spdx_id || 'keine'})`)
  return ergebnis(p, daten)
}

const ohneHtml = (s) => String(s || '')
  .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  .replace(/^\[[^\]]+\]:\s*\S+.*$/gm, '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim()

/** README als Text (Markdown ohne HTML und Bilder), höchstens `max` Zeichen. Wirft bei Netz- oder Limitfehlern. */
export async function holeReadme(slug, { holen = fetch, max = 6000 } = {}) {
  const r = await anfrage(`/repos/${slug}/readme`, { holen, accept: 'application/vnd.github.raw' })
  if (r.status === 404) return ''
  if (r.status !== 200) throw new Error(`README von ${slug}: GitHub antwortet mit ${r.status}${r.rest === '0' ? ' (Ratenlimit)' : ''}`)
  return ohneHtml(await r.text()).slice(0, max)
}

/** Stichworte im README oder in der Beschreibung, die auf Bezahlangebote hindeuten. */
export const KOSTEN_MUSTER = /\b(paid plans?|pricing|subscriptions?|enterprise (plan|edition)|premium|pro (plan|version|edition)|license key|hosted instance|cloud plan|free trial|billing|paid tier|commercial license|sponsorware)\b/gi
export const kostenHinweise = (text) => [...new Set([...String(text || '').matchAll(KOSTEN_MUSTER)].map((m) => m[0].toLowerCase()))]
/** Nennt der Beitrag Kosten? (Pflicht, wenn kostenHinweise etwas finden) */
export const NENNT_KOSTEN = /kostenpflichtig|kostet|gegen Geld|bezahl|zahlst|zahlt|Abo\b|Bezahl|Preis|Gebühr/i

/**
 * Prüft die Angaben eines Beitrags gegen die Live-Daten. block: { repo, lizenz, sterne, caption, text } (text = alle
 * Seitentexte), daten aus pruefeRepo. Optionen: kosten = Ergebnis von kostenHinweise, minAnteil = wie weit die Live-Sterne
 * unter die genannte Zahl fallen dürfen.
 */
export function pruefeRepoAngaben(block = {}, daten, { kosten = [], minAnteil = 0.7, jetzt = new Date() } = {}) {
  const f = []
  if (!daten) return ['keine Live-Daten zum Repo']
  if (String(block.repo || '').toLowerCase() !== daten.slug.toLowerCase()) f.push(`Zeile „Repo“ ist „${block.repo || ''}“, geprüft wurde ${daten.slug}`)
  if (String(block.lizenz || '').trim() !== daten.lizenz) f.push(`Zeile „Lizenz“ ist „${block.lizenz || ''}“, laut GitHub ${daten.lizenz}`)
  const m = STERNE_FORMAT.exec(String(block.sterne || '').trim())
  if (!m) f.push(`Zeile „Sterne“ muss „rund N (Stand TT.MM.JJJJ)“ sein, ist „${block.sterne || ''}“`)
  else {
    const genannt = zahlAus(m[1])
    const stand = new Date(`${m[4]}-${m[3]}-${m[2]}T12:00:00Z`)
    if (Number.isNaN(+stand) || stand - jetzt > 864e5) f.push(`Sterne: Stand ${m[2]}.${m[3]}.${m[4]} liegt in der Zukunft oder ist kein Datum`)
    if (daten.sterne < genannt * minAnteil) f.push(`Sterne: genannt ${m[1]}, live nur ${daten.sterne}`)
    if (daten.sterne > 50 && genannt > daten.sterne * 1.15) f.push(`Sterne: genannt ${m[1]}, live ${daten.sterne} (zu hoch gerundet)`)
  }
  const cap = String(block.caption || '')
  if (!cap.toLowerCase().includes(`github.com/${daten.slug}`.toLowerCase())) f.push(`Caption nennt die Adresse github.com/${daten.slug} nicht`)
  if (!cap.includes(daten.lizenz)) f.push(`Caption nennt die Lizenz ${daten.lizenz} nicht`)
  if (!/Stand \d{2}\.\d{2}\.\d{4}/.test(cap) && /\bSterne\b/.test(cap)) f.push('Caption nennt Sterne ohne „Stand“-Datum')
  if (kosten.length && !NENNT_KOSTEN.test(`${cap}\n${block.text || ''}`)) f.push(`README deutet auf Bezahlangebote hin (${kosten.join(', ')}), der Beitrag nennt keine Kosten`)
  return f
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const slugs = process.argv.slice(2)
  if (!slugs.length) { console.log('Aufruf: node automatik/repo-check.mjs owner/name [owner/name …]'); process.exit(2) }
  let schlecht = 0
  for (const s of slugs) {
    const r = await pruefeRepo(s)
    if (r.ok) {
      const k = kostenHinweise(`${r.daten.beschreibung}\n${await holeReadme(s).catch(() => '')}`)
      console.log(`${r.daten.slug}: ok, Lizenz ${r.daten.lizenz}, Sterne ${r.daten.sterne_text}, letzter Push ${r.daten.letzter_push?.slice(0, 10)}${k.length ? `, Kostenhinweise: ${k.join(', ')}` : ''}`)
    } else { schlecht++; console.log(`${s}: ${r.voruebergehend ? 'nicht prüfbar' : 'abgelehnt'}: ${r.probleme.join(' | ')}`) }
  }
  process.exit(schlecht ? 1 : 0)
}
