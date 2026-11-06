// Messen und Optimieren der TikTok-Karussells (Christian, 03.11.2026: „so schnell wie möglich wachsen“).
// Täglich: holt über die Zernio-API je Post die Kennzahlen (GET /v1/analytics?postId=) und die Follower des Kontos
// (GET /v1/analytics/tiktok/account-insights) und schreibt sie in data/tiktok-karussell.json.
// Sonntags (oder mit --optimieren): Wachstumswert je Post = (follows × 10 + shares × 3 + saves × 2 + comments) je 100 Aufrufe
// (ab 50 Aufrufen), Auswertung nach Slot, Format, Hook-Stil und Hashtag-Gruppe; passt die Gewichte in plan/tiktok-plan.json an
// (ab 3 Posts je Wert, höchstens 30 % des Abstands pro Lauf, nichts unter 5 %) und schaltet Slots um. Notiz nach learnings.md.
// Aufruf: node automatik/tiktok-messen.mjs [--optimieren]
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const LOG = path.join(ROOT, 'data/tiktok-karussell.json')
const PLAN = path.join(ROOT, 'plan/tiktok-plan.json')
const Z = 'https://zernio.com/api/v1'
const key = process.env.ZERNIO_API_KEY
if (!key) { console.log('ZERNIO_API_KEY fehlt, nichts zu messen.'); process.exit(0) }
const holen = async (pfad) => {
  const r = await fetch(Z + pfad, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(60000) })
  const j = await r.json().catch(() => ({}))
  return { status: r.status, j }
}

// --musik: zeigt Konto-Art und die ersten Einträge der Commercial Music Library (Prüfung, ob wechselnde Sounds möglich sind)
if (process.argv.includes('--musik')) {
  const k = (await holen('/accounts')).j.accounts?.find((a) => a.platform === 'tiktok')
  if (!k) { console.log('Kein TikTok-Konto bei Zernio.'); process.exit(0) }
  console.log('Konto-Felder:', JSON.stringify(Object.fromEntries(Object.entries(k).filter(([n]) => !/token|secret/i.test(n)))).slice(0, 900))
  const m = await holen(`/accounts/${k._id}/tiktok/commercial-music`)
  console.log(`commercial-music: HTTP ${m.status}`)
  console.log(JSON.stringify(m.j).slice(0, 2500))
  process.exit(0)
}
// --status: listet die letzten Posts bei Zernio mit Plattform-Status und Fehlergrund (Prüfung, ob geplante Posts wirklich rausgingen)
if (process.argv.includes('--status')) {
  const r = await holen('/posts?limit=40')
  console.log(`posts: HTTP ${r.status}`)
  for (const p of (r.j.posts || []).slice(0, 40)) if (p.status === 'scheduled') console.log(`MEDIEN ${p._id} ${p.scheduledFor} ${(p.mediaItems || []).length} ${p.mediaItems?.[0]?.url || ''}`)
  for (const p of (r.j.posts || []).slice(0, 40)) console.log([p.scheduledFor || p.publishedAt || p.createdAt, p.status, (p.platforms || []).map((x) => `${x.platform}:${x.status}${x.errorMessage ? ' [' + String(x.errorMessage).slice(0, 120) + ']' : ''}${x.platformPostUrl ? ' ' + x.platformPostUrl : ''}`).join(' | '), String(p.content || '').slice(0, 50).replace(/\n/g, ' ')].join(' ; '))
  process.exit(0)
}
const log = JSON.parse(fs.readFileSync(LOG, 'utf8'))
const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'))
const heute = new Date().toISOString().slice(0, 10)

// ---- Kennzahlen je Post (nur Posts der letzten 30 Tage mit Zernio-ID) ----
let gemessen = 0
for (const p of log.posts.filter((x) => x.zernio_id && Date.now() - new Date(x.am) < 30 * 864e5)) {
  const { status, j } = await holen(`/analytics?postId=${encodeURIComponent(p.zernio_id)}&platform=tiktok`)
  if (status === 402 || status === 403) { console.log(`Zernio-Analytics nicht freigeschaltet (HTTP ${status}): ${JSON.stringify(j).slice(0, 200)}`); break }
  if (status !== 200) { console.log(`${p.zernio_id}: HTTP ${status}`); continue }
  const a = j.analytics || {}
  p.messung = { am: heute, views: +a.views || 0, likes: +a.likes || 0, comments: +a.comments || 0, shares: +a.shares || 0, saves: +a.saves || 0, follows: +a.follows || 0 }
  const url = (j.platformAnalytics || []).find((x) => x.platform === 'tiktok')?.platformPostUrl
  if (url) p.url = url
  gemessen++
}
console.log(`Posts gemessen: ${gemessen}`)

// ---- Follower des Kontos ----
const konto = (await holen('/accounts')).j.accounts?.find((a) => a.platform === 'tiktok')
if (konto) {
  const { status, j } = await holen(`/analytics/tiktok/account-insights?accountId=${konto._id}&metrics=follower_count,followers_gained,followers_lost&metricType=total_value`)
  if (status === 200) {
    const f = j.metrics || {}
    log.follower = [...(log.follower || []).filter((x) => x.am !== heute), { am: heute, anzahl: f.follower_count?.total ?? null, plus: f.followers_gained?.total ?? null, minus: f.followers_lost?.total ?? null }].slice(-120)
    console.log(`Follower: ${f.follower_count?.total ?? 'unbekannt'}`)
  } else console.log(`Follower-Insights: HTTP ${status} ${JSON.stringify(j).slice(0, 160)}`)
}
fs.writeFileSync(LOG, JSON.stringify(log, null, 2) + '\n')

// ---- Optimieren (sonntags) ----
const sonntag = new Date().toLocaleDateString('de-DE', { weekday: 'long', timeZone: 'Europe/Berlin' }) === 'Sonntag'
if (!process.argv.includes('--optimieren') && !sonntag) process.exit(0)
const wert = (m) => (m && m.views >= 50 ? ((m.follows * 10 + m.shares * 3 + m.saves * 2 + m.comments) / m.views) * 100 : null)
const posts = log.posts.filter((p) => wert(p.messung) !== null)
if (posts.length < 6) { console.log(`Optimieren: erst ${posts.length} gemessene Posts mit ≥ 50 Aufrufen, mindestens 6 nötig.`); process.exit(0) }
const schnitt = (liste) => liste.reduce((a, p) => a + wert(p.messung), 0) / liste.length
const gesamt = schnitt(posts)
const notizen = []
function bewege(gewichte, merkmal) {
  const gruppen = {}
  for (const p of posts) { const k = p[merkmal]; if (k != null) (gruppen[k] ||= []).push(p) }
  const ziel = {}
  for (const k of Object.keys(gewichte)) ziel[k] = gruppen[k]?.length >= 3 ? Math.max(0.05, schnitt(gruppen[k]) / (gesamt || 1)) : gewichte[k]
  const summe = Object.values(ziel).reduce((a, v) => a + v, 0)
  for (const k of Object.keys(gewichte)) {
    const neu = gewichte[k] + (ziel[k] / summe - gewichte[k]) * 0.3
    if (Math.abs(neu - gewichte[k]) > 0.005) notizen.push(`${merkmal} ${k}: ${gewichte[k].toFixed(2)} → ${neu.toFixed(2)} (${gruppen[k]?.length || 0} Posts, Wert ${gruppen[k] ? schnitt(gruppen[k]).toFixed(2) : '–'})`)
    gewichte[k] = Math.max(0.05, +neu.toFixed(3))
  }
}
bewege(plan.formate, 'format')
bewege(plan.hook_stile, 'hook_stil')
bewege(plan.hashtag_gruppen, 'hashtag_gruppe')
// Slots: ein Slot, der nach ≥ 4 Posts unter 50 % des Schnitts liegt, wird aus-, der beste freie Kandidat eingeschaltet
for (const s of plan.slots.filter((x) => x.aktiv)) {
  const liste = posts.filter((p) => p.slot === s.id)
  if (liste.length >= 4 && schnitt(liste) < gesamt * 0.5 && plan.slots.filter((x) => x.aktiv).length > plan.min_slots) {
    s.aktiv = false
    const frei = plan.slots.find((x) => !x.aktiv && x.id !== s.id && !x.getestet)
    if (frei) { frei.aktiv = true; frei.getestet = true }
    notizen.push(`Slot ${s.id} (${s.uhrzeit}) aus: Wert ${schnitt(liste).toFixed(2)} gegen Schnitt ${gesamt.toFixed(2)}${frei ? `, ${frei.id} (${frei.uhrzeit}) wird getestet` : ''}`)
  }
}
fs.writeFileSync(PLAN, JSON.stringify(plan, null, 2) + '\n')
const f = log.follower?.at(-1)
fs.appendFileSync(path.join(ROOT, 'learnings.md'), `\n### TikTok-Karussells, Wochenauswertung ${heute}\n- Beobachtung: ${posts.length} gemessene Posts, Wachstumswert im Schnitt ${gesamt.toFixed(2)} je 100 Aufrufe; Follower ${f?.anzahl ?? 'unbekannt'}.\n- Entscheidung: ${notizen.length ? notizen.join('; ') : 'keine Änderung (zu wenig Unterschied oder Daten)'}.\n- Nächster Test: aktive Slots ${plan.slots.filter((x) => x.aktiv).map((x) => x.uhrzeit).join(', ')}.\n`)
console.log(notizen.join('\n') || 'Keine Änderung.')
