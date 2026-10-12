// Trends: hält @vamela.de „am Zahn der Zeit“ (Christian, 12.10.2026). Wöchentlich, kostenlos:
//  1. Kandidaten von GitHub: Such-API (in den letzten 7, 30 und 90 Tagen erstellte Repos, nach Sternen sortiert, also auch
//     schnell gewachsene); liefert die Suche zu wenig, ersatzweise das HTML von github.com/trending?since=weekly.
//     Vorfilter im Code: nicht archiviert, kein Fork, Lizenz mit Namen, letzter Push < 12 Monate, noch nie im Vorrat.
//  2. Hype-Themen der Woche aus Hacker News (hn.algolia.com, frei, ohne Schlüssel): KI-Releases, Games, Tech-Nachrichten,
//     jeweils mit Quelle und Datum. Sie dienen nur als Bildmotiv-Ideen, nie als Fakt im Beitragstext.
//  3. Claude (Abo, automatik/claude.mjs) wählt die Repos, die Selbstständigen, kleinen Betrieben, Designern oder Webleuten
//     wirklich etwas bringen, und macht aus den Themen Motiv-Ideen (englisch, ohne Marken, Logos, Personen).
//     Der Code nimmt nur Repos aus der Kandidatenliste und nur Themen mit einer Quelle aus der Hacker-News-Liste an.
//  4. Jedes gewählte Repo wird live geprüft (automatik/repo-check.mjs) und mit Lizenz, Sterne-Stand und Kostenhinweisen
//     nach data/trends.json geschrieben. neu-schreiben.mjs nimmt daraus die Fundstücke und Motiv-Ideen.
//
// Aufruf: node automatik/trends.mjs [--trocken]   (--trocken: nur Kandidaten holen und zeigen, ohne Claude, nichts schreiben)
// Exit 0 = geschrieben, 1 = Fehler, 2 = Claude nicht verfügbar (alte trends.json bleibt). Umgebung: GITHUB_TOKEN (in Actions,
// höhere Limits), TRENDS_DATEI (Zieldatei), GITHUB_API, GITHUB_WEB, HN_API (nur für Tests).
import fs from 'node:fs'
import path from 'node:path'
import { berlin } from './zeit.mjs'
import { pruefeRepo, holeReadme, kostenHinweise, repoAdressen, sterneText, MAX_ALTER_TAGE } from './repo-check.mjs'
import { pruefeMotiv, FAMILIEN, felderAusText } from './block-felder.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const GH_API = () => (process.env.GITHUB_API || 'https://api.github.com').replace(/\/+$/, '')
const GH_WEB = () => (process.env.GITHUB_WEB || 'https://github.com').replace(/\/+$/, '')
const HN_API = () => (process.env.HN_API || 'https://hn.algolia.com').replace(/\/+$/, '')
export const EINSTELLUNGEN = { maxRepos: 10, maxThemen: 8, maxKandidaten: 60, behaltenTage: 60, hnPunkte: 200 }

const tagVor = (jetzt, n) => new Date(jetzt.getTime() - n * 864e5).toISOString().slice(0, 10)
/** Die Suchanfragen (Such-API kann nicht nach Wachstum sortieren: junge Repos mit vielen Sternen sind schnell gewachsen). */
export const suchen = (jetzt = new Date()) => [
  { q: `created:>${tagVor(jetzt, 7)} stars:>50`, n: 30 },
  { q: `created:>${tagVor(jetzt, 30)} stars:>200`, n: 50 },
  { q: `created:>${tagVor(jetzt, 90)} stars:>1000`, n: 50 },
]

/** Kandidaten aus einer Antwort der GitHub-Such-API. */
export function kandidatenAusSuche(json, quelle, jetzt = new Date()) {
  return (json?.items || []).map((r) => ({
    slug: r.full_name, beschreibung: r.description || '', sterne: +r.stargazers_count || 0, sprache: r.language || null, themen: r.topics || [],
    erstellt: r.created_at || null, letzter_push: r.pushed_at || null, lizenz: r.license?.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? r.license.spdx_id : null,
    archiviert: !!r.archived, fork: !!r.fork, quelle, gefunden_am: berlin(jetzt).datum,
  })).filter((k) => k.slug)
}

/** Kandidaten aus dem HTML von github.com/trending (nur Name, Beschreibung und Sterne gesamt; der Rest kommt aus pruefeRepo). */
export function kandidatenAusTrending(html, jetzt = new Date()) {
  const out = []
  for (const block of String(html || '').split(/<article class="Box-row/).slice(1)) {
    const a = /<h2 class="h3 lh-condensed">\s*<a[^>]*href="\/([^/"]+\/[^/"]+)"/.exec(block)
    if (!a) continue
    const p = /<p class="col-9[^"]*">([\s\S]*?)<\/p>/.exec(block)
    const s = /href="\/[^"]+\/stargazers"[^>]*>[\s\S]*?<\/svg>\s*([\d,]+)/.exec(block)
    out.push({ slug: a[1], beschreibung: p ? p[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '', sterne: s ? +s[1].replace(/,/g, '') : 0, quelle: 'github.com/trending?since=weekly', gefunden_am: berlin(jetzt).datum, ungeprueft: true })
  }
  return out
}

/** Vorfilter ohne Netz: Pflege, Lizenz, kein Fork, nicht benutzt, eindeutig, nach Sternen sortiert. */
export function vorfilter(kandidaten, { jetzt = new Date(), benutzt = new Set(), max = EINSTELLUNGEN.maxKandidaten } = {}) {
  const gesehen = new Set()
  return kandidaten.filter((k) => {
    const key = k.slug.toLowerCase()
    if (gesehen.has(key) || benutzt.has(key)) return false
    gesehen.add(key)
    if (k.ungeprueft) return true // Trending-HTML: Prüfung erst live
    if (k.archiviert || k.fork || !k.lizenz) return false
    if (!k.letzter_push || (jetzt - new Date(k.letzter_push)) / 864e5 > MAX_ALTER_TAGE) return false
    return true
  }).sort((a, b) => b.sterne - a.sterne).slice(0, max)
}

/** Hype-Themen aus der Hacker-News-Suche (Algolia). */
export function hnThemen(json) {
  return (json?.hits || []).filter((h) => h.title && h.objectID).map((h) => ({
    titel: h.title, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, hn: `https://news.ycombinator.com/item?id=${h.objectID}`,
    punkte: +h.points || 0, datum: String(h.created_at || '').slice(0, 10),
  })).sort((a, b) => b.punkte - a.punkte)
}

/** Repos, die schon im Vorrat oder in der Queue vorkamen (klein geschrieben). */
export function benutzteRepos(root = ROOT) {
  const s = new Set()
  for (const d of ['docs/content-posts.md', 'docs/content-posts-auto.md']) {
    const p = path.join(root, d)
    if (!fs.existsSync(p)) continue
    const md = fs.readFileSync(p, 'utf8')
    for (const f of felderAusText(md).values()) if (f.repo) s.add(f.repo.toLowerCase())
    for (const r of repoAdressen(md)) s.add(r.toLowerCase())
  }
  try { for (const x of JSON.parse(fs.readFileSync(path.join(root, 'plan/queue.json'), 'utf8'))) for (const r of [x.repo, ...repoAdressen(x.caption)].filter(Boolean)) s.add(r.toLowerCase()) } catch { /* keine Queue */ }
  return s
}

export function baueTrendsPrompt({ kandidaten, themen, heute }) {
  const k = kandidaten.map((x) => ({ slug: x.slug, beschreibung: x.beschreibung.slice(0, 200), sterne: x.sterne, sprache: x.sprache || undefined, themen: x.themen?.slice(0, 6), erstellt: x.erstellt?.slice(0, 10) }))
  const t = themen.map((x) => ({ titel: x.titel, quelle: x.url, datum: x.datum, punkte: x.punkte }))
  return `Du kuratierst für den Instagram-Account @vamela.de (VAMELA, Webdesign und Grafikdesign für kleine Betriebe aus dem Landkreis Freising) die Säule „Fundstücke“: kostenlose Open-Source-Werkzeuge von GitHub, die Selbstständigen, kleinen Betrieben (Handwerk, Gastro, Praxen, Dienstleister), Designern oder Webleuten im Alltag Arbeit abnehmen. Beispiele für passende Bereiche: Bildbearbeitung, Fotos, Video, Rechnungen und Büro, PDF, Website-Baukästen, Design, Dateien teilen, KI lokal auf dem eigenen Rechner.

Heute ist ${heute}.

AUFGABE 1: Wähle aus den KANDIDATEN höchstens ${EINSTELLUNGEN.maxRepos} Repos, die diese Zielgruppe ohne Programmierkenntnisse oder mit wenig Technik nutzen kann und die ihr einen klaren Nutzen bringen. Nicht nehmen: reine Entwickler-Bibliotheken, Frameworks, Agenten-Frameworks, Krypto, Trading, Werkzeuge für Angriffe, Scraping fremder Daten oder Umgehung von Schutzmaßnahmen, Spiele-Mods oder Repos, die nur aus Listen oder Anleitungen bestehen. Sortiere nach Nutzen für die Zielgruppe. Erfinde keine Repos: Nur Namen, die exakt in der Liste stehen.

AUFGABE 2: Mach aus den HYPE-THEMEN (Hacker News, letzte 7 Tage) höchstens ${EINSTELLUNGEN.maxThemen} Bildmotiv-Ideen für Beiträge: aktuelle KI-Releases, Games, Tech-Ereignisse, die gerade Gesprächsthema sind. Je Thema eine kurze englische Bildbeschreibung (5 bis 45 Wörter) für einen KI-Bildgenerator: Tech-, KI- oder Gaming-Ästhetik oder eine Tier- oder Objekt-Metapher. Keine Schrift im Bild, keine Personen, keine echten Marken, Logos oder Spielfiguren (statt Minecraft „voxel-style“, statt eines bekannten Spiels „retro game“, „pixel art“, „low-poly“). Familie „nacht“ (Tech, KI, Gaming, dunkel mit oranger Glut) oder „tag“ (Tier- oder Objekt-Metapher auf Orange und Weiß). Keine Themen über Tod, Unglück, Politik oder Rechtsstreit.

KANDIDATEN (JSON):
${JSON.stringify(k)}

HYPE-THEMEN (JSON):
${JSON.stringify(t)}

Antworte NUR mit einem JSON-Objekt:
{"repos":[{"slug":"owner/name","warum":"ein deutscher Satz: wem es was bringt","zielgruppe":"betriebe|designer|webleute|selbststaendige"}],"themen":[{"thema":"kurz auf Deutsch","quelle":"exakt die quelle aus der Liste","motiv_idee":"english image prompt","familie":"nacht|tag"}]}`
}

/** Nimmt nur, was belegt ist: Repos aus der Kandidatenliste, Themen mit Quelle aus der Liste und gültigem Motiv. */
export function pruefeAuswahl(antwort, kandidaten, themen) {
  const k = new Map(kandidaten.map((x) => [x.slug.toLowerCase(), x]))
  const t = new Map(themen.flatMap((x) => [[x.url, x], [x.hn, x]]))
  const verworfen = []
  const repos = []
  for (const r of Array.isArray(antwort?.repos) ? antwort.repos : []) {
    const x = k.get(String(r?.slug || '').toLowerCase())
    if (!x) { verworfen.push(`Repo ${r?.slug} steht nicht in der Kandidatenliste`); continue }
    if (repos.some((y) => y.slug === x.slug)) continue
    repos.push({ ...x, warum: String(r.warum || '').slice(0, 240), zielgruppe: String(r.zielgruppe || '') })
  }
  const them = []
  for (const h of Array.isArray(antwort?.themen) ? antwort.themen : []) {
    const q = t.get(String(h?.quelle || ''))
    if (!q) { verworfen.push(`Thema „${h?.thema}“ ohne Quelle aus der Liste`); continue }
    const m = pruefeMotiv(h.motiv_idee)
    if (m.length) { verworfen.push(`Thema „${h.thema}“: ${m[0]}`); continue }
    them.push({ thema: String(h.thema || q.titel).slice(0, 120), quelle: q.url, hn: q.hn, datum: q.datum, motiv_idee: String(h.motiv_idee).trim(), familie: FAMILIEN.includes(h.familie) ? h.familie : 'nacht' })
  }
  return { repos: repos.slice(0, EINSTELLUNGEN.maxRepos), themen: them.slice(0, EINSTELLUNGEN.maxThemen), verworfen }
}

/** Neue und alte Liste zusammenführen: neue zuerst, alte Repos bleiben bis zu 60 Tage, Benutztes fliegt raus. */
export function fuehreZusammen(alt = {}, neu = {}, { jetzt = new Date(), benutzt = new Set() } = {}) {
  const grenze = tagVor(jetzt, EINSTELLUNGEN.behaltenTage)
  const repos = []
  for (const r of [...(neu.repos || []), ...(alt.repos || [])]) {
    const key = String(r.slug || '').toLowerCase()
    if (!key || benutzt.has(key) || repos.some((x) => x.slug.toLowerCase() === key)) continue
    if ((r.gefunden_am || '') < grenze) continue
    repos.push(r)
  }
  return { ...neu, repos, themen: (neu.themen || []).length ? neu.themen : (alt.themen || []) }
}

// ---------------------------------------------------------------------------------------------------------------- Lauf

async function holeJson(url, { gh = false } = {}) {
  const headers = { 'User-Agent': 'vamela-insta', Accept: gh ? 'application/vnd.github+json' : 'application/json' }
  if (gh && (process.env.GITHUB_TOKEN || process.env.GH_TOKEN)) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN || process.env.GH_TOKEN}`
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(20000) })
  if (r.status !== 200) throw new Error(`${url.split('?')[0]} antwortet mit ${r.status}${r.headers.get('x-ratelimit-remaining') === '0' ? ' (Ratenlimit)' : ''}`)
  return r.json()
}

export async function sammle({ jetzt = new Date(), benutzt = new Set(), log = console.log } = {}) {
  const roh = []
  const quellen = []
  for (const s of suchen(jetzt)) {
    try {
      const j = await holeJson(`${GH_API()}/search/repositories?q=${encodeURIComponent(s.q)}&sort=stars&order=desc&per_page=${s.n}`, { gh: true })
      roh.push(...kandidatenAusSuche(j, `GitHub-Suche „${s.q}“`, jetzt))
      quellen.push(`GitHub-Suche „${s.q}“`)
    } catch (e) { log(`GitHub-Suche „${s.q}“ nicht möglich: ${e.message}`) }
  }
  let kandidaten = vorfilter(roh, { jetzt, benutzt })
  if (kandidaten.length < 10) {
    try {
      const r = await fetch(`${GH_WEB()}/trending?since=weekly`, { headers: { 'User-Agent': 'vamela-insta' }, signal: AbortSignal.timeout(20000) })
      if (r.status !== 200) throw new Error(`antwortet mit ${r.status}`)
      const t = kandidatenAusTrending(await r.text(), jetzt)
      kandidaten = vorfilter([...roh, ...t], { jetzt, benutzt })
      quellen.push('github.com/trending?since=weekly')
      log(`Ersatzquelle github.com/trending: ${t.length} Repos`)
    } catch (e) { log(`github.com/trending nicht lesbar: ${e.message}`) }
  }
  let themen = []
  try {
    const seit = Math.floor((jetzt.getTime() - 7 * 864e5) / 1000)
    themen = hnThemen(await holeJson(`${HN_API()}/api/v1/search?tags=story&numericFilters=${encodeURIComponent(`created_at_i>${seit},points>${EINSTELLUNGEN.hnPunkte}`)}&hitsPerPage=40`)).slice(0, 30)
    quellen.push(`Hacker News (hn.algolia.com), letzte 7 Tage, mehr als ${EINSTELLUNGEN.hnPunkte} Punkte`)
  } catch (e) { log(`Hacker News nicht erreichbar: ${e.message}`) }
  return { kandidaten, themen, quellen }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const trocken = process.argv.includes('--trocken')
  const ziel = path.resolve(ROOT, process.env.TRENDS_DATEI || 'data/trends.json')
  const jetzt = new Date()
  const heute = berlin(jetzt).datum
  const benutzt = benutzteRepos()
  const { kandidaten, themen, quellen } = await sammle({ jetzt, benutzt })
  console.log(`Trends ${heute}: ${kandidaten.length} Repo-Kandidaten nach Vorfilter, ${themen.length} Hype-Themen`)
  if (trocken) {
    for (const k of kandidaten.slice(0, 25)) console.log(`- ${k.slug} (${k.sterne}, ${k.lizenz || 'Lizenz ungeprüft'}): ${k.beschreibung.slice(0, 90)}`)
    for (const t of themen.slice(0, 10)) console.log(`# ${t.titel} (${t.datum}, ${t.punkte} Punkte)`)
    process.exit(0)
  }
  if (!kandidaten.length && !themen.length) { console.log('Keine Quelle erreichbar, data/trends.json bleibt unverändert.'); process.exit(1) }
  const { frageClaude, extrahiereJson } = await import('./claude.mjs')
  let antwort
  try {
    antwort = extrahiereJson(await frageClaude(baueTrendsPrompt({ kandidaten, themen, heute }), { modell: 'sonnet', timeoutMs: 600_000 }))
  } catch (e) {
    console.log(`Trends übersprungen, Claude nicht verfügbar: ${e.message}`)
    process.exit(2)
  }
  if (!antwort) { console.log('Claude-Antwort ohne lesbares JSON, data/trends.json bleibt unverändert.'); process.exit(1) }
  const auswahl = pruefeAuswahl(antwort, kandidaten, themen)
  for (const v of auswahl.verworfen) console.log(`verworfen: ${v}`)
  // Live-Prüfung jedes gewählten Repos (gleiche Regeln wie vor dem Schreiben und vor dem Veröffentlichen)
  const repos = []
  for (const k of auswahl.repos) {
    const r = await pruefeRepo(k.slug, { jetzt })
    if (!r.ok) { console.log(`${k.slug} verworfen: ${r.probleme.join('; ')}`); if (r.voruebergehend) break; continue }
    const readme = await holeReadme(r.daten.slug).catch(() => '')
    repos.push({
      slug: r.daten.slug, url: r.daten.url, beschreibung: r.daten.beschreibung, lizenz: r.daten.lizenz, sterne: r.daten.sterne, sterne_text: sterneText(r.daten.sterne, jetzt),
      letzter_push: r.daten.letzter_push, kosten: kostenHinweise(`${r.daten.beschreibung}\n${readme}`), warum: k.warum, zielgruppe: k.zielgruppe,
      quelle: k.quelle, gefunden_am: heute,
    })
  }
  const alt = (() => { try { return JSON.parse(fs.readFileSync(ziel, 'utf8')) } catch { return {} } })()
  const neu = fuehreZusammen(alt, {
    hinweis: 'Von automatik/trends.mjs (wöchentlich). Repos sind live geprüft (Lizenz, Pflege, Sterne mit Stand); vor dem Schreiben und vor dem Veröffentlichen prüft der Code erneut. Themen sind nur Bildmotiv-Ideen, nie Fakten im Beitragstext.',
    stand: heute, erzeugt: jetzt.toISOString(), quellen, repos, themen: auswahl.themen,
  }, { jetzt, benutzt })
  fs.mkdirSync(path.dirname(ziel), { recursive: true })
  fs.writeFileSync(ziel, JSON.stringify(neu, null, 1) + '\n')
  console.log(`${path.relative(ROOT, ziel)}: ${neu.repos.length} Repos (${repos.length} neu geprüft), ${neu.themen.length} Hype-Themen`)
}
