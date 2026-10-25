// Misst die Startseite eines Betriebs und sammelt nur Befunde, die wirklich gemessen wurden (keine erfundenen Mängel).
// Punkte: 100 = gut, je Befund Abzug. Angeschrieben werden die schwächsten (Christian, 25.10.2026: „jede Website prüfen“).

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const KEIN_PROFIL = /^(p|reel|reels|explore|stories|accounts|tv|direct|about|legal|developer|sharer)$/i

export function instagramAus(html, vorgabe = null) {
  const kandidaten = []
  if (vorgabe) kandidaten.push(String(vorgabe))
  for (const m of String(html).matchAll(/instagram\.com\/([A-Za-z0-9_.]{2,30})/g)) kandidaten.push(m[1])
  for (let k of kandidaten) {
    k = k.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').split(/[/?#]/)[0].replace(/\.+$/, '')
    if (k && !KEIN_PROFIL.test(k) && /^[A-Za-z0-9_.]{2,30}$/.test(k)) return k.toLowerCase()
  }
  return null
}

export async function pruefeWebsite(url, { jetzt = new Date() } = {}) {
  const start = Date.now()
  let r, html
  try {
    r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'de' }, redirect: 'follow', signal: AbortSignal.timeout(20000) })
    html = await r.text()
  } catch (e) {
    return { erreichbar: false, punkte: 0, befunde: ['Die Website war bei meinem Test nicht erreichbar.'], instagram: null }
  }
  const ms = Date.now() - start
  if (!r.ok) return { erreichbar: false, punkte: 0, befunde: [`Die Website antwortet mit Fehler ${r.status}.`], instagram: null }
  const bytes = Buffer.byteLength(html)
  const befunde = []
  let punkte = 100
  const endUrl = r.url || url
  if (/^http:\/\//i.test(endUrl)) { punkte -= 25; befunde.push('Die Seite läuft ohne https, Chrome zeigt „Nicht sicher“ an.') }
  if (!/<meta[^>]+name=["']?viewport/i.test(html)) { punkte -= 30; befunde.push('Die Seite ist nicht fürs Handy angepasst, man muss am Smartphone zoomen.') }
  if (!/href=["']tel:/i.test(html)) { punkte -= 10; befunde.push('Die Telefonnummer ist am Handy nicht antippbar.') }
  const jahre = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?((?:19|20)\d{2})/gi)].map((m) => +m[1])
  const jahr = jahre.length ? Math.max(...jahre) : null
  const aktuell = jetzt.getFullYear()
  if (jahr && jahr <= aktuell - 2) { punkte -= Math.min(20, (aktuell - jahr) * 4); befunde.push(`Im Fußbereich steht noch © ${jahr}, das wirkt, als wäre die Seite lange nicht gepflegt.`) }
  if (ms > 4000) { punkte -= 15; befunde.push(`Die Startseite brauchte bei meinem Test ${(ms / 1000).toFixed(1).replace('.', ',')} Sekunden.`) }
  if (bytes > 3_000_000) { punkte -= 10; befunde.push(`Allein der Seitencode ist ${(bytes / 1e6).toFixed(1).replace('.', ',')} MB groß.`) }
  if (!/<meta[^>]+name=["']?description/i.test(html)) { punkte -= 5; befunde.push('Bei Google fehlt eine Seitenbeschreibung, dort steht dann irgendein Textschnipsel.') }
  const gen = html.match(/<meta[^>]+name=["']?generator["']?[^>]+content=["']([^"']+)/i)?.[1] || ''
  const wp = gen.match(/WordPress\s+(\d+)\./i)
  if (wp && +wp[1] < 6) { punkte -= 10; befunde.push(`Die Seite läuft auf einer alten WordPress-Version (${wp[1]}.x).`) }
  if (/<frameset|<marquee|<font\s/i.test(html)) { punkte -= 15; befunde.push('Die Seite ist technisch sehr alt aufgebaut.') }
  return { erreichbar: true, punkte: Math.max(0, punkte), befunde, ms, bytes, instagram: instagramAus(html) }
}
