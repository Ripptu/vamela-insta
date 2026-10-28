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
  // Technik: je Befund ein Gewicht, das stärkste kommt in die erste DM
  const technik = []
  const t = (gewicht, text) => technik.push({ gewicht, text })
  const endUrl = r.url || url
  const ohneHttps = /^http:\/\//i.test(endUrl)
  if (ohneHttps) t(25, 'Die Seite läuft ohne https, Chrome zeigt „Nicht sicher“ an.')
  if (!/<meta[^>]+name=["']?viewport/i.test(html)) t(30, 'Die Seite ist nicht fürs Handy angepasst, man muss am Smartphone zoomen.')
  if (!/href=["']tel:/i.test(html)) t(10, 'Die Telefonnummer ist am Handy nicht antippbar.')
  const jahre = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?((?:19|20)\d{2})/gi)].map((m) => +m[1])
  const jahr = jahre.length ? Math.max(...jahre) : null
  const aktuell = jetzt.getFullYear()
  if (jahr && jahr <= aktuell - 2) t(Math.min(20, (aktuell - jahr) * 4), `Im Fußbereich steht noch © ${jahr}, das wirkt, als wäre die Seite lange nicht gepflegt.`)
  if (ms > 4000) t(15, `Die Startseite brauchte bei meinem Test ${(ms / 1000).toFixed(1).replace('.', ',')} Sekunden.`)
  if (bytes > 3_000_000) t(10, `Allein der Seitencode ist ${(bytes / 1e6).toFixed(1).replace('.', ',')} MB groß.`)
  if (!/<meta[^>]+name=["']?description/i.test(html)) t(5, 'Bei Google fehlt eine Seitenbeschreibung, dort steht dann irgendein Textschnipsel.')
  const gen = html.match(/<meta[^>]+name=["']?generator["']?[^>]+content=["']([^"']+)/i)?.[1] || ''
  const wp = gen.match(/WordPress\s+(\d+)\./i)
  if (wp && +wp[1] < 6) t(10, `Die Seite läuft auf einer alten WordPress-Version (${wp[1]}.x).`)
  if (/<frameset|<marquee|<font\s/i.test(html)) t(15, 'Die Seite ist technisch sehr alt aufgebaut.')

  // Recht: nur messbare Tatsachen plus sachlicher Hinweis, nie „ihr verstoßt gegen …“ (Christian, 28.10.2026).
  // Lieber einen Befund auslassen als einen falschen behaupten, deshalb vorsichtige Muster.
  const recht = []
  const tracker = /googletagmanager\.com\/gtag\/js|google-analytics\.com\/(analytics|ga)\.js|gtag\(\s*['"]config['"]\s*,\s*['"](G|UA)-/i.test(html) ? 'Google Analytics'
    : /connect\.facebook\.net\/[^"']*fbevents|fbq\(\s*['"]init/i.test(html) ? 'das Meta-Pixel' : null
  const einwilligung = /cookiebot|usercentrics|borlabs|complianz|cmplz|cookieyes|klaro|iubenda|onetrust|cookie-law-info|real-cookie-banner|ccm19|consentmanager|cookiefirst|termly|moove_gdpr|tarteaucitron|axeptio|didomi|quantcast|cookie-?notice|cookie-?consent|cookie-?banner|consent/i.test(html)
  if (tracker && !einwilligung) recht.push({ gewicht: 15, text: `Auf eurer Startseite läuft ${tracker}, einen Cookie-Hinweis habe ich dabei nicht gefunden. Tracking ohne Einwilligung gehört zu den häufigsten Abmahngründen.` })
  // Impressum/Datenschutz nur bewerten, wenn die Navigation im HTML steht (keine reine JS-Seite)
  const links = [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)].map((m) => m[0])
  if (links.length >= 5) {
    const fehlt = [!links.some((a) => /impressum|imprint|legal-notice/i.test(a)) && 'Impressum', !links.some((a) => /datenschutz|privacy|dsgvo/i.test(a)) && 'Datenschutz'].filter(Boolean)
    if (fehlt.length) recht.push({ gewicht: 15, text: `Auf eurer Startseite habe ich keinen Link zu${fehlt.length === 2 ? 'm Impressum und zur Datenschutzerklärung' : fehlt[0] === 'Impressum' ? 'm Impressum' : 'r Datenschutzerklärung'} gefunden. Das gehört zu den klassischen Abmahngründen.` })
  }
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(html)) recht.push({ gewicht: 10, text: 'Eure Seite lädt Schriften direkt von Google-Servern. Dafür wurden 2022 viele Betriebe abgemahnt.' })
  if (ohneHttps && /<form\b/i.test(html)) recht.push({ gewicht: 10, text: 'Euer Kontaktformular läuft ohne https, Eingaben gehen also unverschlüsselt durchs Netz. Datenschutzbehörden verlangen dafür Verschlüsselung.' })

  // Reihenfolge = Reihenfolge in den DMs: stärkster Rechtsbefund, stärkster Technikbefund, dann der Rest.
  // Bei Formular ohne https entfällt der https-Technikbefund, sonst stünde dasselbe zweimal da.
  technik.sort((a, c) => c.gewicht - a.gewicht)
  const tech = recht.some((x) => /Kontaktformular/.test(x.text)) ? technik.filter((x) => !/https/.test(x.text)) : technik
  const erste = [recht[0], tech[0]].filter(Boolean)
  const befunde = [...erste, ...recht.slice(1), ...tech.slice(1)].map((x) => x.text)
  const punkte = 100 - [...technik, ...recht].reduce((s, x) => s + x.gewicht, 0)
  return { erreichbar: true, punkte: Math.max(0, punkte), befunde, ms, bytes, instagram: instagramAus(html) }
}
