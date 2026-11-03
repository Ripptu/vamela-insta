// Tägliche TikTok-Karussells im Look „Schritte“ (Christian, 03.11.2026: „jeden Tag 2 Karussells vollautomatisch ohne Überprüfung“,
// Format nach @martiendejong_dev: Versal-Hook, Liste von Gratis-Tools bzw. Anleitung, 5 Hashtags, Musik von TikTok).
// Zwei Formate im Wechsel: „tools“ (4 live geprüfte GitHub-Repos, ggf. ein Gratis-Werkzeug von vamela.de) und „schritte“
// (Anleitung in 5 Schritten für lokale Betriebe). Hero-Bild aus bilder/tiktok-hero/vorrat (Higgsfield, in einer Sitzung erzeugt),
// sonst Higgsfield-REST bzw. Gratis-Kette (render/bilder.mjs). Texte schreibt Claude über das Abo (automatik/claude.mjs).
// Veröffentlicht direkt und öffentlich; solange TikTok die App nicht für Direct Post freigibt, geht der Beitrag als Entwurf ins Postfach.
//
// Aufruf: node automatik/tiktok-karussell.mjs [--format tools|schritte] [--echt]   (ohne --echt: nur Text, Bild und Render)
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
const tag = jetzt.toISOString().slice(0, 10)
const vor30 = new Date(jetzt - 30 * 864e5).toISOString()

if (fs.existsSync(path.join(ROOT, 'PAUSE'))) { console.log('PAUSE liegt im Repository, nichts wird veröffentlicht.'); process.exit(0) }
const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : { posts: [], heros: [] }
const juengst = log.posts.filter((p) => p.am >= vor30)
const heute = log.posts.filter((p) => p.am.slice(0, 10) === tag)
const format = arg('--format') || (heute.some((p) => p.format === 'tools') ? 'schritte' : 'tools')
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
{"hook":"Versal-Hook für die Beschreibung, max. 80 Zeichen, weckt Neugier",
 "hero":{"oben":["ZEILE 1 max 18 Zeichen","ZEILE 2 max 20 Zeichen"],"gross":"EIN WORT max 10 Zeichen"},
 "tools":[{"slug":"owner/name oder vamela:/pfad","titel":"was es macht, max 6 Wörter","unter":"ein Satz, max 12 Wörter","text":"Karte: max 18 Wörter, nur Fakten aus der Beschreibung"}],
 "beschreibung":"2 kurze Sätze für die TikTok-Beschreibung, nennt github.com/owner/name nicht",
 "hashtags":["#…","#…","#…","#…","#…"]}`))
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
    hook: antwort.hook, hero: antwort.hero, repos, beschreibung: antwort.beschreibung, hashtags: antwort.hashtags,
    schritte: folien.map((f, i) => ({ etikett: `Tool ${i + 1}`, ...f })),
    schluss: { titel: 'Speichern, damit du es wiederfindest.', unter: 'Jeden Tag neue Gratis-Tools für deinen Betrieb.', knopf: 'Folge @vamela.de' },
    werkzeug: folien.some((f) => f.karte.art === 'werkzeug'),
  }
}

async function schritte() {
  const antwort = extrahiereJson(await frageClaude(`Du schreibst ein TikTok-Fotokarussell für @vamela.de (Webdesign und Grafik für lokale Betriebe:
Handwerk, Gastronomie, Praxen, Läden). Format: Anleitung in 5 Schritten, wie virale „Step 1 … Step 5“-Karussells.
Themen: Website, Google-Unternehmensprofil, Bewertungen, lokale Sichtbarkeit, Fotos, Social Media, Schrift, Farbe, Layout.
Wenn eines dieser Gratis-Werkzeuge von vamela.de wirklich zum Thema passt, darf der letzte Schritt darauf verweisen:
${WERKZEUGE.join('\n')}

Zuletzt benutzte Themen (nicht wiederholen): ${juengst.map((p) => p.thema || p.hook).slice(-30).join(' | ') || 'keine'}

${REGELN}

Antworte nur mit JSON:
{"thema":"kurzes Thema","hook":"Versal-Hook für die Beschreibung, max. 80 Zeichen",
 "hero":{"oben":["ZEILE 1 max 18 Zeichen","ZEILE 2 max 20 Zeichen"],"gross":"EIN WORT max 10 Zeichen"},
 "schritte":[{"titel":"max 6 Wörter","unter":"ein Satz, max 12 Wörter","karte":{"art":"liste","zeilen":["max 6 Wörter","…","…"]} oder {"art":"beispiel","kopf":"z. B. Text für …","text":"max 18 Wörter"}}],
 "werkzeug":"vamela:/pfad oder leer",
 "beschreibung":"2 kurze Sätze für die TikTok-Beschreibung",
 "hashtags":["#…","#…","#…","#…","#…"]}`))
  const werkzeug = String(antwort.werkzeug || '').startsWith('vamela:') && fakten.werkzeuge.some((w) => w.pfad === antwort.werkzeug.slice(7))
  return {
    thema: antwort.thema, hook: antwort.hook, hero: antwort.hero, repos: [], beschreibung: antwort.beschreibung, hashtags: antwort.hashtags,
    schritte: (antwort.schritte || []).slice(0, 5).map((s, i) => ({ etikett: `Schritt ${i + 1}`, ...s })),
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
const inhalt = format === 'tools' ? await tools() : await schritte()
const stempel = `${tag}-${format}`
const ordner = path.join(ROOT, 'out/tiktok-karussell', stempel)
fs.rmSync(ordner, { recursive: true, force: true }); fs.mkdirSync(ordner, { recursive: true })
const hero = await heroBild(ordner)
const { createEngine } = await import('../render/engine.mjs')
const { renderSchritte } = await import('../render/tiktok-schritte.mjs')
const eng = await createEngine()
const k = { hero: { bild: hero.datei, oben: (inhalt.hero?.oben || []).slice(0, 2), gross: inhalt.hero?.gross || 'GRATIS' }, schritte: inhalt.schritte, schluss: inhalt.schluss }
const { dateien, fehler } = await renderSchritte(eng, k, ordner)
await eng.close?.()
if (fehler.length) throw new Error(`Gestaltung: ${fehler.join('; ')}`)
const tags = [...new Set((inhalt.hashtags || []).filter((h) => /^#[\p{L}\d_]+$/u.test(h)))].slice(0, 5)
const titel = String(inhalt.hook || '').slice(0, 90)
const beschreibung = [inhalt.beschreibung, inhalt.werkzeug ? 'Link in der Bio.' : '', tags.join(' ')].filter(Boolean).join('\n\n')
fs.writeFileSync(path.join(ordner, 'text.txt'), `${titel}\n\n${beschreibung}\n`)
console.log(`${stempel}: ${dateien.length} Folien, „${titel}“`)

const eintrag = { am: jetzt.toISOString(), format, hook: titel, thema: inhalt.thema || null, repos: inhalt.repos, hero: hero.name, folien: dateien.length }
if (echt) {
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
