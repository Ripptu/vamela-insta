// Betriebe mit Website im Raum Freising, Erding, Moosburg aus OpenStreetMap (Overpass, kostenlos, ohne Schlüssel).
// Branchen nach Christians Wahl (25.10.2026): Handwerk, Gastro, Praxen und Gesundheit, Dienstleister. Ketten (Tag brand) fallen raus.

// Grob Landkreis Freising und Erding: Süd, West, Nord, Ost
export const GEBIET = [48.25, 11.55, 48.58, 12.08]

const FILTER = [
  ['craft', null, 'Handwerk'],
  ['amenity', 'restaurant|cafe|bar|pub|biergarten|fast_food|ice_cream', 'Gastro'],
  ['shop', 'bakery|butcher|confectionery|deli', 'Gastro'],
  ['amenity', 'doctors|dentist|clinic', 'Praxis'],
  ['healthcare', null, 'Praxis'],
  ['shop', 'hairdresser|beauty|optician|massage', 'Gesundheit'],
  ['office', 'company|estate_agent|insurance|tax_advisor|lawyer|architect|consulting|accountant', 'Dienstleister'],
  ['amenity', 'driving_school', 'Dienstleister'],
  ['shop', 'car_repair|bicycle|florist|photo|tailor', 'Dienstleister'],
]

function abfrage() {
  const bbox = GEBIET.join(',')
  const teile = FILTER.map(([k, v]) => {
    const tag = v ? `["${k}"~"^(${v})$"]` : `["${k}"]`
    return `nwr${tag}["website"](${bbox});nwr${tag}["contact:website"](${bbox});`
  }).join('')
  return `[out:json][timeout:120];(${teile});out tags center;`
}

const branche = (t) => {
  for (const [k, v, name] of FILTER) if (t[k] && (!v || new RegExp(`^(${v})$`).test(t[k]))) return name
  return 'Betrieb'
}

export async function holeBetriebe() {
  // Mehrere öffentliche Overpass-Server, falls einer überlastet ist
  const server = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']
  let j = null, letzter = ''
  for (const url of server) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'vamela-akquise (stockmeier)' },
        body: new URLSearchParams({ data: abfrage() }), signal: AbortSignal.timeout(180000),
      })
      if (!r.ok) { letzter = `${url} ${r.status}`; continue }
      j = await r.json()
      break
    } catch (e) { letzter = `${url} ${e.message}` }
  }
  if (!j) throw new Error(`Overpass nicht erreichbar (${letzter})`)
  const gesehen = new Set()
  const out = []
  for (const e of j.elements || []) {
    const t = e.tags || {}
    if (!t.name || t.brand || t['brand:wikidata']) continue
    let web = String(t.website || t['contact:website'] || '').trim()
    if (!web) continue
    if (!/^https?:\/\//i.test(web)) web = 'https://' + web
    let host
    try { host = new URL(web).hostname.replace(/^www\./, '') } catch { continue }
    // Plattform-Profile sind keine eigene Website
    if (/facebook\.com|instagram\.com|google\.|booking\.com|tripadvisor|yelp|jimdo\.com$/.test(host) && !/jimdosite|jimdofree/.test(host)) continue
    if (gesehen.has(host)) continue
    gesehen.add(host)
    out.push({ id: `${e.type}/${e.id}`, name: t.name, website: web, host, ort: t['addr:city'] || '', branche: branche(t), instagram: t['contact:instagram'] || null })
  }
  return out
}
