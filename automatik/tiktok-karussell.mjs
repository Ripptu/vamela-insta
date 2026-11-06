// Tägliche TikTok-Karussells im Look „Schritte“ (Christian, 03.11.2026: „jeden Tag 2 Karussells vollautomatisch ohne Überprüfung“,
// Format nach @martiendejong_dev: Versal-Hook, Liste von Gratis-Tools bzw. Anleitung, 5 Hashtags, Musik von TikTok).
// Zwei Formate im Wechsel: „tools“ (4 live geprüfte GitHub-Repos, ggf. ein Gratis-Werkzeug von vamela.de) und „schritte“
// (Anleitung in 5 Schritten für lokale Betriebe). Hero-Bild aus bilder/tiktok-hero/vorrat (Higgsfield, in einer Sitzung erzeugt),
// sonst Higgsfield-REST bzw. Gratis-Kette (render/bilder.mjs). Texte schreibt Claude über das Abo (automatik/claude.mjs).
// Veröffentlicht direkt und öffentlich; solange TikTok die App nicht für Direct Post freigibt, geht der Beitrag als Entwurf ins Postfach.
//
// Wachstumsregeln (03.11.2026, Recherche: TikTok Creator Academy, Buffer, Sprout Social, Metricool, Socialinsider):
//   Titel beginnt mit dem Suchbegriff, den Leute eintippen; Beschreibung kurz (Kern zuerst), Suchbegriff in Varianten, eine Frage
//   (mehr Kommentare), kein Köder wie „Folge für Teil 2“; genau 3 Hashtags aus plan/tiktok-hashtags.json (1 Gruppe + 2 Thema), kein #fyp.
//   Slots, Format-, Hook- und Hashtag-Gewichte aus plan/tiktok-plan.json (ε-greedy, deterministisch aus Datum und Slot),
//   automatik/tiktok-messen.mjs misst und passt sonntags an.
// Aufruf: node automatik/tiktok-karussell.mjs [--slot morgen|mittag|…] [--format tools|schritte|fehler] [--echt]   (ohne --echt: nur Text, Bild und Render)
import fs from 'node:fs'
import path from 'node:path'
import { frageClaude, extrahiereJson } from './claude.mjs'
import { pruefeRepo } from './repo-check.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const LOG = path.join(ROOT, 'data/tiktok-karussell.json')
const HERO_VORRAT = path.join(ROOT, 'bilder/tiktok-hero/vorrat')
const echt = process.argv.includes('--echt')
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null }
const jetzt = new Date()
// --um JJJJ-MM-TTTHH:MM (Berliner Zeit): Post im Voraus bauen, Zernio veröffentlicht zu dieser Uhrzeit (TikTok, Instagram, Story)
const um = arg('--um')
const tag = um ? um.slice(0, 10) : jetzt.toISOString().slice(0, 10)
const vor30 = new Date(jetzt - 30 * 864e5).toISOString()

if (fs.existsSync(path.join(ROOT, 'PAUSE'))) { console.log('PAUSE liegt im Repository, nichts wird veröffentlicht.'); process.exit(0) }
const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : { posts: [], heros: [] }
const juengst = log.posts.filter((p) => p.am >= vor30)
const heute = log.posts.filter((p) => (p.geplant_fuer || p.am).slice(0, 10) === tag)
const PLAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan/tiktok-plan.json'), 'utf8'))
const HASHTAGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan/tiktok-hashtags.json'), 'utf8'))
const slot = arg('--slot') || 'manuell'
// Deterministische Zufallszahl aus Datum, Slot und Merkmal (gleicher Lauf ergibt dieselbe Wahl)
const zufall = (salz) => { let h = 2166136261; for (const c of `${tag}|${slot}|${salz}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000 }
function waehle(gewichte, salz, ohne = []) {
  const k = Object.keys(gewichte).filter((x) => !ohne.includes(x)); if (!k.length) return Object.keys(gewichte)[0]
  if (zufall(salz + 'e') < (PLAN.erkunden ?? 0.2)) return k[Math.floor(zufall(salz + 'u') * k.length)]
  const summe = k.reduce((a, x) => a + gewichte[x], 0); let r = zufall(salz) * summe
  for (const x of k) { r -= gewichte[x]; if (r <= 0) return x }
  return k.at(-1)
}
// Format: nicht zweimal am Tag dasselbe, solange es Alternativen gibt
const format = arg('--format') || waehle(PLAN.formate, 'format', heute.map((p) => p.format))
const hookStil = waehle(PLAN.hook_stile, 'hook', [log.posts.at(-1)?.hook_stil, ...(format === 'tools' ? ['fehler', 'vorher-nachher'] : [])].filter(Boolean))
const hashtagGruppe = waehle(PLAN.hashtag_gruppen, 'hashtag')
// Gemeinsame Felder für Titel, Beschreibung und Hashtags (alle Formate)
const TEXT_JSON = `"suchbegriff":"der deutsche Suchbegriff, den die Zielgruppe in die TikTok-Suche tippt (2–5 Wörter)",
 "hook":"Arbeitstitel, höchstens 10 Wörter, normale Groß- und Kleinschreibung, nicht mit dem Suchbegriff plus Doppelpunkt beginnen; wird danach von automatik/hook-wahl.mjs ersetzt",
 "beschreibung":"genau 3 kurze Sätze, zusammen max. 45 Wörter: 1. Kernaussage, die wörtlich den Suchbegriff enthält, 2. was man konkret lernt oder bekommt (Suchbegriff in einer Variante), 3. eine echte Frage an die Leser zum Thema. Kein Köder wie ‚Folge für Teil 2‘, keine Hashtags",
 "hashtags":["genau 1 aus ${HASHTAGS.gruppen[hashtagGruppe].join(' ')}","genau 2 aus ${(HASHTAGS.themen[format] || []).join(' ')}"]`
const fakten = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/fakten.json'), 'utf8'))
const WERKZEUGE = fakten.werkzeuge.filter((w) => w.pfad !== '/werkzeuge').map((w) => `${w.name}: vamela.de${w.pfad}`)

const REGELN = `Regeln (fest): Deutsch, Du-Form, klar und bodenständig. Nur belegbare Aussagen: keine erfundenen Zahlen, Studien, Prozentangaben,
Kundenstimmen oder Erfolgsversprechen. Keine Rechtsberatung. Keine Emojis in den Folientexten. Keine fremden Marken als Absender.
Etwas, das Geld kostet, wird als solches benannt. Jede Folie bringt konkreten, sofort nutzbaren Nutzen.`

// ---- Inhalt ----
async function tools() {
  const benutzt = new Set(juengst.flatMap((p) => p.repos || []))
  const trends = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/trends.json'), 'utf8')).repos || []
  let kandidaten = trends.filter((r) => !benutzt.has(r.slug))
  if (kandidaten.length < 6) kandidaten = kandidaten.concat(await githubSuche(benutzt, kandidaten))
  const liste = kandidaten.slice(0, 24).map((r) => `- ${r.slug}: ${String(r.beschreibung || '').slice(0, 220)}`).join('\n')
  const antwort = extrahiereJson(await frageClaude(`Du schreibst ein TikTok-Fotokarussell für @vamela.de (Webdesign, Grafik und Gratis-Werkzeuge für Selbstständige,
kleine Betriebe, Designer und Webleute). Format wie virale Tech-Karusselle: Hook in Versalien, dann je Folie ein kostenloses Tool.

Wähle aus diesen live geprüften Open-Source-Repos 4 aus, die für die Zielgruppe den größten, leicht verständlichen Nutzen haben
und gut zusammenpassen (gemeinsamer Aufhänger). Beschreibe jedes NUR mit dem, was in seiner Beschreibung steht.
${liste}

Optional darf eines der 4 Tools stattdessen ein Gratis-Werkzeug von vamela.de sein, wenn es zum Aufhänger passt:
${WERKZEUGE.join('\n')}

Zuletzt benutzte Aufhänger (nicht wiederholen): ${juengst.map((p) => p.hook).slice(-20).join(' | ') || 'keine'}

${REGELN}

Antworte nur mit JSON:
{${TEXT_JSON},
 "hero":{"oben":["ZEILE 1 max 18 Zeichen, nennt das Thema des Suchbegriffs","ZEILE 2 max 20 Zeichen"],"gross":"EIN WORT max 10 Zeichen"},
 "tools":[{"slug":"owner/name oder vamela:/pfad","titel":"was es macht, max 6 Wörter","unter":"ein Satz, max 12 Wörter","text":"Karte: max 18 Wörter, nur Fakten aus der Beschreibung"}],
}`))
  const folien = []
  const repos = []
  for (const t of antwort.tools || []) {
    if (String(t.slug).startsWith('vamela:')) {
      const pfad = t.slug.slice(7)
      if (!fakten.werkzeuge.some((w) => w.pfad === pfad)) continue
      folien.push({ titel: t.titel, unter: t.unter, karte: { art: 'werkzeug', slug: `vamela.de${pfad}`, text: t.text } })
      continue
    }
    const p = await pruefeRepo(t.slug)
    if (!p.ok) { console.log(`${t.slug} verworfen: ${p.probleme.join('; ')}`); continue }
    repos.push(p.daten.slug)
    folien.push({ titel: t.titel, unter: t.unter, karte: { art: 'repo', slug: p.daten.slug, text: t.text, lizenz: p.daten.lizenz, sterne: p.daten.sterne_text.replace(/ \(Stand.*$/, '') } })
  }
  if (folien.length < 3) throw new Error(`Nur ${folien.length} Tools bestehen die Prüfung`)
  return {
    hook: antwort.hook, suchbegriff: antwort.suchbegriff, hero: antwort.hero, repos, beschreibung: antwort.beschreibung, hashtags: antwort.hashtags,
    schritte: folien.map((f, i) => ({ etikett: `Tool ${i + 1}`, ...f })),
    schluss: folien.some((f) => f.karte.art === 'werkzeug')
      ? { titel: 'Speichern, damit du es wiederfindest.', unter: 'Das vamela-Werkzeug ist kostenlos.', knopf: 'Link in der Bio' }
      : { titel: 'Speichern, damit du es wiederfindest.', unter: 'Jeden Tag neue Gratis-Tools für deinen Betrieb.', knopf: 'Folge @vamela.de' },
    werkzeug: folien.some((f) => f.karte.art === 'werkzeug'),
  }
}

async function schritte(art = 'schritte') {
  const FORM = art === 'fehler'
    ? 'Format: 5 typische Fehler mit der Lösung, wie virale „Fehler, die jeder macht“-Karussells. Jede Folie: der Fehler als Titel, die Unterzeile sagt, warum er schadet, die Karte zeigt, wie es richtig geht.'
    : 'Format: Anleitung in 5 Schritten, wie virale „Step 1 … Step 5“-Karussells.'
  const antwort = extrahiereJson(await frageClaude(`Du schreibst ein TikTok-Fotokarussell für @vamela.de (Webdesign und Grafik für lokale Betriebe:
Handwerk, Gastronomie, Praxen, Läden). ${FORM}
Themen: Website, Google-Unternehmensprofil, Bewertungen, lokale Sichtbarkeit, Fotos, Social Media, Schrift, Farbe, Layout.
Wenn eines dieser Gratis-Werkzeuge von vamela.de wirklich zum Thema passt, darf der letzte Schritt darauf verweisen:
${WERKZEUGE.join('\n')}

Zuletzt benutzte Themen (nicht wiederholen): ${juengst.map((p) => p.thema || p.hook).slice(-30).join(' | ') || 'keine'}

${REGELN}

Antworte nur mit JSON:
{"thema":"kurzes Thema",${TEXT_JSON},
 "hero":{"oben":["ZEILE 1 max 18 Zeichen, nennt das Thema des Suchbegriffs","ZEILE 2 max 20 Zeichen"],"gross":"EIN WORT max 10 Zeichen"},
 "schritte":[{"titel":"max 6 Wörter","unter":"ein Satz, max 12 Wörter","karte":{"art":"liste","zeilen":["max 6 Wörter","…","…"]} oder {"art":"beispiel","kopf":"z. B. Text für …","text":"max 18 Wörter"}}],
 "werkzeug":"vamela:/pfad oder leer"}`))
  const werkzeug = String(antwort.werkzeug || '').startsWith('vamela:') && fakten.werkzeuge.some((w) => w.pfad === antwort.werkzeug.slice(7))
  return {
    thema: antwort.thema, hook: antwort.hook, suchbegriff: antwort.suchbegriff, hero: antwort.hero, repos: [], beschreibung: antwort.beschreibung, hashtags: antwort.hashtags,
    schritte: (antwort.schritte || []).slice(0, 5).map((s, i) => ({ etikett: `${art === 'fehler' ? 'Fehler' : 'Schritt'} ${i + 1}`, ...s })),
    schluss: werkzeug
      ? { titel: 'Das Werkzeug ist kostenlos auf vamela.de.', unter: 'Speichern, damit du es wiederfindest.', knopf: 'Link in der Bio' }
      : { titel: 'Speichern, damit du es wiederfindest.', unter: 'Jeden Tag ein Tipp für deinen Betrieb.', knopf: 'Folge @vamela.de' },
    werkzeug,
  }
}

async function githubSuche(benutzt, schon) {
  const seit = new Date(jetzt - 180 * 864e5).toISOString().slice(0, 10)
  const r = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(`created:>${seit} stars:>800 archived:false fork:false`)}&sort=stars&per_page=40`, { headers: { Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) } })
  if (!r.ok) return []
  const s = new Set(schon.map((x) => x.slug))
  return ((await r.json()).items || []).filter((x) => !benutzt.has(x.full_name) && !s.has(x.full_name) && x.license?.spdx_id && x.license.spdx_id !== 'NOASSERTION')
    .map((x) => ({ slug: x.full_name, beschreibung: x.description || '' }))
}

// ---- Hero-Bild ----
async function heroBild(ordner) {
  const benutzt = new Set(log.heros || [])
  const frei = fs.existsSync(HERO_VORRAT) ? fs.readdirSync(HERO_VORRAT).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !benutzt.has(f)).sort() : []
  if (frei.length) { console.log(`Hero aus Vorrat: ${frei[0]} (${frei.length - 1} übrig)`); return { datei: path.join(HERO_VORRAT, frei[0]), name: frei[0] } }
  const { higgsfield, higgsfieldZugang, normalisiere } = await import('../render/bilder.mjs')
  const { gratis, gratisZugang } = await import('../render/gratis.mjs')
  const client = higgsfieldZugang() ? higgsfield() : gratisZugang() ? gratis() : null
  if (!client) throw new Error('Kein Hero-Bild: Vorrat bilder/tiktok-hero/vorrat ist leer und weder HIGGSFIELD_API_KEY/SECRET noch CLOUDFLARE_* gesetzt.')
  // Rezept (Christian, 03.11.2026): hell und luftig wie die ersten Higgsfield-Bilder, dazu ein abgefahrener Hingucker, der das Scrollen stoppt
  const motive = ['a giant orange goldfish floating in the air above a mirror-like salt flat', 'a polar bear relaxing on a pink pool float in turquoise tropical water', 'a huge whale gliding through a green meadow as if it were water', 'a house-sized yellow rubber duck on a calm alpine lake', 'a giraffe wearing round sunglasses standing in shallow turquoise sea', 'an astronaut riding a white horse along a sunlit beach', 'a small cloud raining only on a single potted plant on a white salt flat', 'a flamingo standing on a mirror-like salt flat reflecting the sky']
  const prompt = `Bright airy photorealistic photograph, soft daylight, upper 45 percent bright pale sky almost empty. Surreal scroll-stopping scene in the lower half: ${motive[log.posts.length % motive.length]}. Ultra sharp, believable, no text, no logos.`
  const { bytes } = await client.erzeugen(prompt)
  const roh = path.join(ordner, 'hero-roh'); fs.writeFileSync(roh, bytes)
  const ziel = path.join(ordner, 'hero.png'); await normalisiere(roh, ziel); fs.rmSync(roh)
  return { datei: ziel, name: null }
}

// ---- Ablauf ----
console.log(`Slot ${slot}: Format ${format}, Hook-Stil ${hookStil}, Hashtag-Gruppe ${hashtagGruppe}`)
const inhalt = format === 'tools' ? await tools() : await schritte(format)
// Hook und Cover: Kandidaten aus den Formeln, im Code gefiltert und bewertet (automatik/hook-wahl.mjs)
const { waehleHook } = await import('./hook-wahl.mjs')
const wahl = await waehleHook({ inhalt, stil: hookStil, posts: log.posts, frage: frageClaude, json: extrahiereJson, zaehler: { tools: (inhalt.repos || []).length, folien: (inhalt.schritte || []).length } })
if (wahl) { inhalt.hook = wahl.hook; inhalt.hero = { oben: wahl.oben, gross: wahl.gross } }
console.log(wahl ? `Hook (${wahl.formel || 'ohne Formel'}, Score ${wahl.score ?? '–'}): „${wahl.hook}“, Cover ${wahl.oben.join(' / ')} / ${wahl.gross}` : `Hook: kein Kandidat bestand, Entwurf bleibt: „${inhalt.hook}“`)
const stempel = `${tag}-${slot}-${format}`
const ordner = path.join(ROOT, 'out/tiktok-karussell', stempel)
fs.rmSync(ordner, { recursive: true, force: true }); fs.mkdirSync(ordner, { recursive: true })
const hero = await heroBild(ordner)
const { createEngine } = await import('../render/engine.mjs')
const { renderSchritte } = await import('../render/tiktok-schritte.mjs')
const eng = await createEngine()
const k = { hero: { bild: hero.datei, oben: (inhalt.hero?.oben || []).slice(0, 2), gross: inhalt.hero?.gross || 'GRATIS' }, schritte: inhalt.schritte, schluss: inhalt.schluss }
const { dateien, fehler } = await renderSchritte(eng, k, ordner)
// Story zum Karussell (Christian, 03.11.2026): Hero-Bild hochkant mit schlichtem Text, auf Instagram als Story
const { renderStory } = await import('../render/tiktok-schritte.mjs')
const storyDatei = path.join(ordner, 'story.jpg')
fehler.push(...await renderStory(eng, k.hero, storyDatei))
await eng.close?.()
if (fehler.length) throw new Error(`Gestaltung: ${fehler.join('; ')}`)
// Nur Hashtags aus der gepflegten Liste: 1 aus der Gruppe, 2 aus dem Thema; fehlt etwas, mit den ersten Einträgen auffüllen
const klein = (h) => String(h || '').trim().toLowerCase()
const vorschlag = (inhalt.hashtags || []).map(klein)
const ausGruppe = HASHTAGS.gruppen[hashtagGruppe].find((h) => vorschlag.includes(klein(h))) || HASHTAGS.gruppen[hashtagGruppe][0]
const ausThema = (HASHTAGS.themen[format] || []).filter((h) => vorschlag.includes(klein(h)) && h !== ausGruppe)
for (const h of HASHTAGS.themen[format] || []) if (ausThema.length < 2 && h !== ausGruppe && !ausThema.includes(h)) ausThema.push(h)
const tags = [ausGruppe, ...ausThema.slice(0, 2)]
const titel = String(inhalt.hook || '').replace(/#\S+/g, '').trim().slice(0, 90)
// KI-Hinweis im Text: Zernio lehnt die KI-Kennzeichnung bei direkten Fotobeiträgen ab, TikTok verlangt sie für KI-Bilder
const beschreibung = [inhalt.beschreibung, inhalt.werkzeug ? 'Link in der Bio.' : '', 'Titelbild KI-generiert.', tags.join(' ')].filter(Boolean).join('\n\n')
fs.writeFileSync(path.join(ordner, 'text.txt'), `${titel}\n\n${beschreibung}\n`)
console.log(`${stempel}: ${dateien.length} Folien, „${titel}“`)
const { pruefeText } = await import('./ig-pruefen.mjs')
const igPruefung = pruefeText({ titel, beschreibung, suchbegriff: inhalt.suchbegriff })
console.log(`IG-Check: ${igPruefung.uebersprungen ? `übersprungen (${igPruefung.grund})` : `Hook ${igPruefung.hook_score} ${igPruefung.hook_urteil}${igPruefung.warnungen.length ? `; Warnungen: ${igPruefung.warnungen.join(' | ')}` : ', keine Warnungen'}`}`)

const eintrag = { am: jetzt.toISOString(), slot, format, hook_stil: hookStil, hashtag_gruppe: hashtagGruppe, suchbegriff: inhalt.suchbegriff || null, hashtags: tags, hook: titel, hook_formel: wahl?.formel || null, cover_gross: inhalt.hero?.gross || null, ig_pruefung: igPruefung, thema: inhalt.thema || null, repos: inhalt.repos, hero: hero.name, folien: dateien.length }
// Öffentlich posten über Zernio (Christian, 03.11.2026: „vollautomatisch, aber für null Euro“): Zernios TikTok-App postet direkt,
// die ersten 2 Konten sind kostenlos. Christian hat dem automatischen Posten jedes Karussells ausdrücklich zugestimmt,
// deshalb setzt der Code die Zustimmungsfelder. Ohne ZERNIO_API_KEY: eigene App, also Entwurf ins TikTok-Postfach.
async function zernio() {
  const Z = 'https://zernio.com/api/v1'
  const kopf = { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`, 'Content-Type': 'application/json' }
  const anfrage = async (pfad, opt = {}) => {
    const r = await fetch(Z + pfad, { ...opt, headers: { ...kopf, ...(opt.headers || {}) }, signal: AbortSignal.timeout(120000) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`Zernio ${pfad}: HTTP ${r.status} ${JSON.stringify(j).slice(0, 300)}`)
    return j
  }
  const konto = (await anfrage('/accounts')).accounts?.find((a) => a.platform === 'tiktok')
  if (!konto) throw new Error('Zernio: kein TikTok-Konto verbunden')
  const info = await anfrage(`/accounts/${konto._id}/tiktok/creator-info?mediaType=photo`).catch(() => ({}))
  const stufen = (info.privacyLevels || info.creatorInfo?.privacyLevels || []).map((x) => (typeof x === 'string' ? x : x?.value || x?.privacy_level || x?.level || '')).filter(Boolean)
  const sichtbarkeit = stufen.includes('PUBLIC_TO_EVERYONE') || !stufen.length ? 'PUBLIC_TO_EVERYONE' : stufen[0]
  console.log(`Zernio-Sichtbarkeit: ${sichtbarkeit} (erlaubt: ${stufen.join(', ') || 'unbekannt'}; Konto ${konto.username || konto._id})`)
  const urls = []
  for (const f of dateien) {
    const p = await anfrage('/media/presign', { method: 'POST', body: JSON.stringify({ filename: path.basename(f), contentType: 'image/jpeg', size: fs.statSync(f).size }) })
    const put = await fetch(p.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: fs.readFileSync(f) })
    if (!put.ok) throw new Error(`Zernio-Upload ${path.basename(f)}: HTTP ${put.status}`)
    urls.push(p.publicUrl)
  }
  // Musik (Christian, 03.11.2026: „nicht immer dieselbe Musik“): Beiträge der eigenen Marke dürfen nur Titel aus TikToks
  // Commercial Music Library nutzen. Zernio liefert die Liste (GET …/tiktok/commercial-music, nur bei Verbindung über die
  // TikTok-Business-App); je Post ein anderer Titel, keiner der letzten 15 wiederholt. Ohne Liste wählt TikTok selbst (auto_add_music).
  const titelListe = []
  try {
    const cm = await anfrage(`/accounts/${konto._id}/tiktok/commercial-music`)
    const suche = (x) => { if (Array.isArray(x)) x.forEach(suche); else if (x && typeof x === 'object') { const id = x.clip?.id || x.clip_id; if (id) titelListe.push({ id: String(id), name: [x.name || x.title || x.clip?.title, x.artist].filter(Boolean).join(' – '), rang: +x.rank || 999, genres: x.genres || [] }); else Object.values(x).forEach(suche) } }
    suche(cm)
  } catch (e) { console.log(`Musikliste nicht verfügbar (${String(e.message).slice(0, 120)}), TikTok wählt selbst.`) }
  // „viral und passend“ (Christian, 03.11.2026): nur die vorderen Plätze der Rangliste (rank, TikToks Beliebtheit in der
  // Bibliothek) und tanzbare, frische Genres; keiner der letzten 15 Titel wiederholt
  const passend = /POP|ELECTRONIC|HIP_HOP|DANCE|R&B|FUNK|HOUSE/i
  // Keine Titel mit fremden Schriftzeichen im Namen: passen nicht zu deutschen Beiträgen (04.11.2026: „舞蹈挑战“ auf einem Tool-Post)
  const lesbar = (t) => !/[^\p{Script=Latin}\p{N}\p{P}\p{S}\s]/u.test(t.name)
  const zuletzt = new Set(log.posts.slice(-15).map((p) => p.musik?.id).filter(Boolean))
  const sortiert = titelListe.filter((t) => !zuletzt.has(t.id) && lesbar(t)).sort((a, b) => a.rang - b.rang)
  const kandidaten = [sortiert.filter((t) => t.genres.some((g) => passend.test(g))).slice(0, 12), sortiert.slice(0, 12)].find((l) => l.length) || []
  const musik = kandidaten[Math.floor(zufall('musik') * kandidaten.length)] || null
  const zeit = um ? { scheduledFor: `${um}:00`, timezone: 'Europe/Berlin' } : { publishNow: true }
  const senden = (mitMusik) => anfrage('/posts', {
    method: 'POST', headers: { 'Idempotency-Key': `${stempel}-${hero.name || ''}-${um || log.posts.length}-${mitMusik ? 'm' : 'a'}` },
    body: JSON.stringify({
      content: titel.replace(/#\S+/g, '').trim().slice(0, 90),
      mediaItems: urls.map((url) => ({ type: 'image', url })),
      platforms: [{ platform: 'tiktok', accountId: konto._id }],
      tiktokSettings: { privacy_level: sichtbarkeit, allow_comment: true, media_type: 'photo', photo_cover_index: 0, description: `${titel}\n\n${beschreibung}`.slice(0, 4000), ...(mitMusik ? { musicSoundInfo: { musicSoundId: musik.id } } : { auto_add_music: true }), commercialContentType: 'brand_organic', content_preview_confirmed: true, express_consent_given: true },
      ...zeit,
    }),
  })
  let r
  if (musik) {
    try { r = await senden(true); eintrag.musik = musik; console.log(`Musik: ${musik.name || musik.id}`) } catch (e) { console.log(`Mit Musik abgelehnt (${String(e.message).slice(0, 160)}), ohne festen Titel nochmal.`) }
  }
  if (!r) r = await senden(false)
  const status = r.post?.platforms?.[0]?.status || r.post?.status || 'unbekannt'
  if (!/published|scheduled|processing|pending/i.test(status)) throw new Error(`Zernio-Status ${status}: ${JSON.stringify(r).slice(0, 300)}`)
  Object.assign(eintrag, { modus: 'zernio', status, zernio_id: r.post?._id || null, sichtbarkeit, ...(um ? { geplant_fuer: um } : {}) })
  console.log(`TikTok über Zernio: ${status} (${sichtbarkeit})${um ? ` für ${um}` : ''} ${r.post?._id || ''}`)
  if (um) await instagramGeplant(anfrage, zeit)
}

// Instagram (Christian, 03.11.2026: „alles, was auf TikTok gepostet wird, auch auf Instagram“): gleiche Folien über die offizielle
// Graph-API (automatik/instagram.mjs). Instagram erlaubt im Feed höchstens 4:5, deshalb oben und unten je 45 px abschneiden
// (1080 × 1350; alle Inhalte liegen weiter innen). Ein Fehler hier ändert nichts am TikTok-Beitrag.
async function instagram() {
  if (!process.env.IG_USER_ID) { console.log('Instagram: IG_USER_ID fehlt, übersprungen.'); return }
  const { default: sharp } = await import('sharp')
  const ig = await import('./instagram.mjs')
  const igDateien = []
  for (const f of dateien) {
    const z = f.replace(/\.jpg$/, '-ig.jpg')
    await sharp(f).extract({ left: 0, top: 45, width: 1080, height: 1350 }).jpeg({ quality: 92 }).toFile(z)
    igDateien.push(z)
  }
  try {
    const r = await ig.veroeffentlicheKarussell({ dateien: igDateien, caption: `${titel}\n\n${beschreibung}`, altTexte: igDateien.map((_, i) => i ? `${inhalt.schritte[i - 1]?.etikett || ''}: ${inhalt.schritte[i - 1]?.titel || ''}` : titel) })
    eintrag.instagram = { id: r.id, permalink: r.permalink }
    console.log(`Instagram: ${r.permalink}`)
  } catch (e) { eintrag.instagram = { fehler: String(e.message || e).slice(0, 300) }; console.log(`Instagram nicht gepostet: ${eintrag.instagram.fehler}`) }
  try {
    const st = await ig.veroeffentlicheStory({ datei: storyDatei })
    eintrag.instagram_story = { id: st.id }
    console.log(`Instagram-Story: ${st.id}`)
  } catch (e) { console.log(`Instagram-Story nicht gepostet: ${String(e.message || e).slice(0, 200)}`) }
}

// Vorgeplant läuft auch Instagram über Zernio (dort verbunden): Feed mit 1080 × 1350 und Story, je zur selben Uhrzeit.
async function instagramGeplant(anfrage, zeit) {
  const konto = (await anfrage('/accounts')).accounts?.find((a) => a.platform === 'instagram')
  if (!konto) { console.log('Zernio: kein Instagram-Konto verbunden, Instagram übersprungen.'); return }
  const { default: sharp } = await import('sharp')
  const hoch = async (f) => {
    const p = await anfrage('/media/presign', { method: 'POST', body: JSON.stringify({ filename: path.basename(f), contentType: 'image/jpeg', size: fs.statSync(f).size }) })
    const put = await fetch(p.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: fs.readFileSync(f) })
    if (!put.ok) throw new Error(`Zernio-Upload ${path.basename(f)}: HTTP ${put.status}`)
    return p.publicUrl
  }
  try {
    const bilder = []
    for (const [i, f] of dateien.entries()) {
      const z = f.replace(/\.jpg$/, '-ig.jpg')
      await sharp(f).extract({ left: 0, top: 45, width: 1080, height: 1350 }).jpeg({ quality: 92 }).toFile(z)
      bilder.push({ type: 'image', url: await hoch(z), altText: (i ? `${inhalt.schritte[i - 1]?.etikett || ''}: ${inhalt.schritte[i - 1]?.titel || ''}` : titel).slice(0, 1000) })
    }
    const feed = await anfrage('/posts', { method: 'POST', headers: { 'Idempotency-Key': `${stempel}-${hero.name || ''}-${um}-ig` }, body: JSON.stringify({ content: `${titel}\n\n${beschreibung}`.slice(0, 2200), mediaItems: bilder, platforms: [{ platform: 'instagram', accountId: konto._id }], ...zeit }) })
    const story = await anfrage('/posts', { method: 'POST', headers: { 'Idempotency-Key': `${stempel}-${hero.name || ''}-${um}-st` }, body: JSON.stringify({ content: '', mediaItems: [{ type: 'image', url: await hoch(storyDatei) }], platforms: [{ platform: 'instagram', accountId: konto._id, platformSpecificData: { contentType: 'story' } }], ...zeit }) })
    eintrag.instagram = { zernio_id: feed.post?._id || null, story_zernio_id: story.post?._id || null, status: feed.post?.status || null }
    console.log(`Instagram über Zernio: ${feed.post?.status} (Feed ${feed.post?._id}, Story ${story.post?._id})`)
  } catch (e) { eintrag.instagram = { fehler: String(e.message || e).slice(0, 300) }; console.log(`Instagram nicht geplant: ${eintrag.instagram.fehler}`) }
}

if (echt && process.env.ZERNIO_API_KEY) {
  await zernio()
  if (!um) await instagram()
  log.posts.push(eintrag)
  if (hero.name) log.heros = [...(log.heros || []), hero.name]
  fs.writeFileSync(LOG, JSON.stringify(log, null, 2) + '\n')
} else if (echt) {
  const tt = await import('./tiktok.mjs')
  const t = await tt.gueltigerToken()
  const info = await tt.post('/v2/post/publish/creator_info/query/', {}, t.access_token)
  const sichtbarkeit = (info.privacy_level_options || []).includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE' : (info.privacy_level_options || [])[0]
  const { urls, pfade } = await tt.hochladen(dateien, `${Date.now()}-${stempel}`)
  try {
    const quelle = { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: urls }
    let start, modus = 'direkt'
    try {
      start = await tt.post('/v2/post/publish/content/init/', {
        post_info: { title: titel, description: beschreibung, privacy_level: sichtbarkeit, disable_comment: !!info.comment_disabled, auto_add_music: true, brand_content_toggle: false, brand_organic_toggle: true, is_aigc: true },
        source_info: quelle, post_mode: 'DIRECT_POST', media_type: 'PHOTO',
      }, t.access_token)
    } catch (e) {
      if (!/unaudited|scope|permission/i.test(e.message)) throw e
      console.log(`Direkt-Post nicht erlaubt (${e.message}), geht als Entwurf ins TikTok-Postfach.`)
      modus = 'entwurf'
      start = await tt.post('/v2/post/publish/content/init/', { post_info: { title: titel, description: beschreibung }, source_info: quelle, post_mode: 'MEDIA_UPLOAD', media_type: 'PHOTO' }, t.access_token)
    }
    let status = ''
    for (let v = 0; v < 40; v++) {
      await new Promise((r) => setTimeout(r, 6000))
      const s = await tt.post('/v2/post/publish/status/fetch/', { publish_id: start.publish_id }, t.access_token)
      status = s.status
      if (['PUBLISH_COMPLETE', 'SEND_TO_USER_INBOX', 'FAILED'].includes(status)) { if (s.fail_reason) console.log(s.fail_reason); break }
    }
    if (!['PUBLISH_COMPLETE', 'SEND_TO_USER_INBOX'].includes(status)) throw new Error(`TikTok-Status ${status}`)
    Object.assign(eintrag, { publish_id: start.publish_id, modus, status })
    console.log(`TikTok ${modus}: ${status} ${start.publish_id}`)
  } finally { await tt.aufraeumen(pfade) }
  log.posts.push(eintrag)
  if (hero.name) log.heros = [...(log.heros || []), hero.name]
  fs.writeFileSync(LOG, JSON.stringify(log, null, 2) + '\n')
}
process.exit(0)
