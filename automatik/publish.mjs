// Veröffentlicht den fälligen Beitrag. Aufruf: node automatik/publish.mjs [--trocken] [--jetzt] [--typ karussell|reel|story]
// Läuft per Cron in GitHub Actions. Ohne --jetzt nur im Zeitfenster laut plan/params.json (Berliner Zeit).
import * as fb from './facebook.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { suchphrase, phrasenTags, captionMitPhrase } from './suchbegriffe.mjs'
import { ladeQueue, speichereQueue } from './queue.mjs'
import * as ig from './instagram.mjs'
import { waehle, veroeffentlichteFeed } from './auswahl.mjs'
import { berlin, inFenster } from './zeit.mjs'
import { merkmaleVon } from './optimierer.mjs'
import { preiseImText, pruefeText, pruefeLive, ladeFakten } from './fakten.mjs'
import { pruefeRepo, repoAdressen } from './repo-check.mjs'
import * as tiktok from './tiktok.mjs'
import { felderFuer } from './block-felder.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const args = process.argv.slice(2)
const trocken = args.includes('--trocken')
const jetzt = args.includes('--jetzt')
const typArg = args.includes('--typ') ? args[args.indexOf('--typ') + 1] : null
const log = (...a) => console.log(new Date().toISOString(), ...a)

if (fs.existsSync(path.join(ROOT, 'PAUSE'))) { log('PAUSE vorhanden, nichts veröffentlicht.'); process.exit(0) }

if (!trocken && !process.env.MEDIA_TOKEN) { log('MEDIA_TOKEN fehlt (GitHub-Zugriff für Bilder). Nichts veröffentlicht, kein Versuch gezählt.'); process.exit(1) }

const params = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan/params.json'), 'utf8'))
const jetztZeit = new Date()
const b = berlin(jetztZeit)
const q = await ladeQueue()
const amTag = (datum, typen) => q.some((x) => typen.includes(x.typ) && ((x.status === 'veroeffentlicht' && x.ig?.am && berlin(new Date(x.ig.am)).datum === datum) || (x.status === 'unklar' && x.unklarAm && berlin(new Date(x.unklarAm)).datum === datum)))
const heuteVeroeffentlicht = (typen) => amTag(b.datum, typen)
// Nachholen am Morgen: GitHub lässt geplante Läufe manchmal aus. War der gestrige Feed-Termin (Mo bis Fr) ohne Beitrag,
// wird zwischen 07:00 und 20:00 Berliner Zeit einer nachgeholt.
const gestern = berlin(new Date(jetztZeit.getTime() - 864e5))
// Feed: wie bei den Stories fällig, solange heute weniger erschienen sind, als Zeiten aus params.feed.uhrzeiten begonnen haben.
const jobs = []
// Verpasste Termine des Tages werden nachgeholt (Christian, 13.10.2026: „alle Beiträge nachholen“), aber nie als Schub: zwischen zwei
// Beiträgen derselben Art liegen mindestens 40 Minuten, ein Lauf veröffentlicht höchstens einen Feed-Beitrag und eine Story.
const MIN_ABSTAND_MIN = 40
const abstandOk = (typen) => {
  const letzte = Math.max(0, ...q.filter((x) => typen.includes(x.typ) && x.status === 'veroeffentlicht' && x.ig?.am).map((x) => new Date(x.ig.am).getTime()))
  return jetztZeit.getTime() - letzte >= MIN_ABSTAND_MIN * 60000
}
const juengsteZeitInReichweite = () => true
// Feed (Christian, 12.10.2026: Karussells täglich in der Wachstumsphase, insgesamt höchstens 5 Beiträge am Tag)
const feedArt = params.feed.tage[String(b.wochentag)]
const feedZeiten = params.feed.uhrzeiten || [params.feed.uhrzeit]
const feedHeuteAnzahl = q.filter((x) => ['karussell', 'reel'].includes(x.typ) && ((x.status === 'veroeffentlicht' && x.ig?.am && berlin(new Date(x.ig.am)).datum === b.datum) || (x.status === 'unklar' && x.unklarAm && berlin(new Date(x.unklarAm)).datum === b.datum))).length
const feedBegonnen = feedZeiten.filter((z) => { const [h, m] = z.split(':').map(Number); return b.minutenSeitMitternacht >= h * 60 + m }).length
const feedFaellig = !!feedArt && b.minutenSeitMitternacht < 1350 && feedHeuteAnzahl < feedBegonnen && abstandOk(['karussell', 'reel'])
if ((!typArg || typArg !== 'story') && (feedFaellig || (jetzt && typArg && typArg !== 'story'))) {
  const monat = b.datum.slice(0, 7)
  const imMonat = veroeffentlichteFeed(q).filter((x) => berlin(new Date(x.ig.am)).datum.startsWith(monat)).length
  if (imMonat >= params.feed.max_pro_monat) log(`Monatsgrenze ${params.feed.max_pro_monat} erreicht.`)
  else jobs.push({ typ: typArg && typArg !== 'story' ? typArg : feedArt, serie: b.wochentag === params.reel_serie_tag })
}
// Stories
// Auch Stories werden nachgeholt, wenn der gestrige Termin ohne Story blieb (GitHub lässt geplante Läufe aus, so am 04.10.2026).
// Mehrere Stories pro Tag (Christian, 12.10.2026: höchstens 5 Beiträge am Tag insgesamt): params.stories.uhrzeiten nennt die Zeiten.
// Fällig ist eine Story, solange heute weniger erschienen sind, als Zeiten schon begonnen haben (bis 22:30). So holt jeder Lauf
// ausgefallene Termine nach, ohne Doppelungen; alle Zeiten eines Tages sind höchstens eine Story pro Zeit.
const storyZeiten = params.stories.uhrzeiten || [params.stories.uhrzeit]
const storyHeute = q.filter((x) => (x.typ === 'story') && ((x.status === 'veroeffentlicht' && x.ig?.am && berlin(new Date(x.ig.am)).datum === b.datum) || (x.status === 'unklar' && x.unklarAm && berlin(new Date(x.unklarAm)).datum === b.datum))).length
const beginnt = storyZeiten.filter((z) => { const [h, m] = z.split(':').map(Number); return b.minutenSeitMitternacht >= h * 60 + m }).length
const storyFaellig = params.stories.tage.includes(b.wochentag) && b.minutenSeitMitternacht < 1350 && storyHeute < beginnt && abstandOk(['story'])
const feedHeute = feedHeuteAnzahl
if (params.stories_aktiv !== false && (!typArg || typArg === 'story') && (storyFaellig || (jetzt && typArg === 'story'))) {
  if (storyHeute + feedHeute >= (params.max_beitraege_pro_tag ?? 5) && !jetzt) log(`Tagesgrenze ${params.max_beitraege_pro_tag ?? 5} Beiträge erreicht.`)
  else jobs.push({ typ: 'story' })
}
if (!jobs.length) { log('Nichts fällig.'); process.exit(0) }

let fehler = 0
for (const job of jobs) {
  // Unter den zulässigen Beiträgen entscheidet der Optimierer nach den Gewichten aus plan/params.json
  let item = waehle(q, { typ: job.typ, serie: !!job.serie, jetzt: jetztZeit, log, gewichte: params.gewichte, themenfenster: params.themenfenster || [] })
  // Ausweichen, wenn vom geplanten Format nichts bereit ist: Serie -> normales Reel -> Karussell (bzw. Reel statt Karussell)
  if (!item && job.typ !== 'story' && params.reels_aktiv) {
    const ersatz = job.typ === 'reel' ? [{ typ: 'reel', serie: false }, { typ: 'karussell' }] : [{ typ: 'reel', serie: false }]
    for (const e of ersatz) { item = waehle(q, { ...e, jetzt: jetztZeit, log, gewichte: params.gewichte, themenfenster: params.themenfenster || [] }); if (item) { log(`Kein ${job.typ}${job.serie ? '-Serienreel' : ''} bereit, weiche auf ${e.typ} aus.`); break } }
  }
  if (!item) { log(`Kein geprüfter Beitrag für ${job.typ}${job.serie ? ' (Serie)' : ''}: Puffer leer.`); fehler++; continue }
  // Preise nur, wie sie gerade auf vamela.de stehen (CLAUDE.md): vor jedem Beitrag mit Preis live abgleichen.
  const faktenFehler = pruefeText(`${item.caption || ''}\n${item.hook || ''}`)
  if (!faktenFehler.length && !trocken && preiseImText(`${item.caption || ''} ${item.hook || ''}`).length) {
    faktenFehler.push(...(await pruefeLive(ladeFakten(), { nurPreise: true })))
  }
  if (faktenFehler.length) {
    item.fehler = 'Fakten: ' + faktenFehler.join('; ')
    if (!trocken) { item.status = 'fehler'; await speichereQueue(q) }
    log(`${item.id} nicht veröffentlicht: ${item.fehler}`)
    fehler++
    continue
  }
  // Fundstücke: jedes genannte GitHub-Repo direkt vor dem Veröffentlichen live prüfen (existiert, nicht archiviert,
  // Push < 12 Monate, Lizenz). Netz- oder Limitfehler verbrennen den Beitrag nicht, er kommt beim nächsten Takt dran.
  if (!trocken || !process.env.NUR_PLAN) {
    const slugs = [...new Set([item.repo || felderFuer(item)?.repo, ...repoAdressen(`${item.caption || ''}\n${item.hook || ''}`)].filter(Boolean).map((x) => x.toLowerCase()))]
    const repoFehler = []
    let spaeter = false
    for (const slug of slugs) {
      const r = await pruefeRepo(slug)
      if (r.voruebergehend) { spaeter = true; log(`${item.id}: Repo ${slug} gerade nicht prüfbar (${r.probleme[0]}), nicht veröffentlicht.`); break }
      if (!r.ok) repoFehler.push(...r.probleme)
    }
    if (spaeter) { fehler++; continue }
    if (repoFehler.length) {
      item.fehler = 'Repo: ' + repoFehler.join('; ')
      if (!trocken) { item.status = 'fehler'; await speichereQueue(q) }
      log(`${item.id} nicht veröffentlicht: ${item.fehler}`)
      fehler++
      continue
    }
  }
  const dateien = item.dateien.map((f) => path.join(ROOT, f))
  const fehlt = dateien.filter((f) => !fs.existsSync(f))
  // NUR_PLAN=1: Trockenlauf des Mac-Auslösers (schlanker Klon ohne out/), er will nur wissen, ob etwas fällig ist.
  if (fehlt.length && !(trocken && process.env.NUR_PLAN)) { item.fehler = 'Dateien fehlen: ' + fehlt.map((f) => path.basename(f)).join(', '); if (!trocken) { item.status = 'fehler'; await speichereQueue(q) } log(item.fehler); fehler++; continue }
  // Suchphrase als Hashtag vorn (plan/suchbegriffe.json): Instagram durchsucht Captions und Hashtags nach Stichwörtern
  const tagsAlt = Array.isArray(item.hashtags) ? item.hashtags : String(item.hashtags || '').split(/\s+/).filter(Boolean)
  const tagsNeu = [...new Set([...(item.typ === 'karussell' ? phrasenTags(suchphrase(item.id)) : []), ...tagsAlt])].slice(0, 5)
  const caption = (item.typ === 'karussell' ? captionMitPhrase(item.caption, suchphrase(item.id)) : item.caption) + (tagsNeu.length ? '\n\n' + tagsNeu.join(' ') : '')
  // Doppelpost-Sperre: steht dieselbe Caption schon in den letzten Beiträgen auf Instagram (z. B. weil der Status nicht
  // gespeichert werden konnte), wird nicht noch einmal gepostet, sondern der Beitrag als veröffentlicht vermerkt.
  if (!trocken && item.typ !== 'story' && item.caption) {
    try {
      const anfang = item.caption.replace(/\s+/g, ' ').trim().slice(0, 50)
      const schon = (await ig.mediaListe(12)).find((m) => String(m.caption || '').replace(/\s+/g, ' ').trim().startsWith(anfang))
      if (schon) {
        item.status = 'veroeffentlicht'
        item.ig = { id: schon.id, permalink: schon.permalink, am: schon.timestamp || new Date().toISOString() }
        await speichereQueue(q)
        log(`${item.id} steht schon auf Instagram (${schon.permalink}), nicht doppelt gepostet.`)
        continue
      }
    } catch (e) { log(`Vorabprüfung der Beiträge nicht möglich (${String(e.message).slice(0, 120)}), fahre fort.`) }
  }
  log(`${trocken ? '[trocken] ' : ''}Veröffentliche ${item.id} (${item.typ}) ${item.titel}`)
  try {
    const opts = { trocken }
    let r
    if (item.typ === 'karussell') {
      // Alt-Text je Bild mit Suchphrase (Instagram liest ihn für die Suche mit); fehlt der Vorratsblock, geht es ohne
      let altTexte = []
      try {
        const { allePosts } = await import('../render/inhalt.mjs'), { ergaenze } = await import('./block-felder.mjs'), { altTexte: alt } = await import('./suchbegriffe.mjs')
        const md = ['docs/content-posts.md', 'docs/content-posts-auto.md'].map((f) => path.join(ROOT, f)).filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n')
        const post = ergaenze(allePosts(), md, 'Karussell').find((p) => `k${String(p.nr).padStart(2, '0')}` === item.id)
        if (post) altTexte = alt(post, suchphrase(item.id))
      } catch (e) { log(`Alt-Texte nicht erzeugt: ${String(e.message).slice(0, 100)}`) }
      r = await ig.veroeffentlicheKarussell({ dateien, caption, altTexte }, opts)
    }
    else if (item.typ === 'reel') r = await ig.veroeffentlicheReel({ video: dateien.find((f) => f.endsWith('.mp4')), caption, cover: dateien.find((f) => f.endsWith('.jpg')) }, opts)
    else r = await ig.veroeffentlicheStory({ datei: dateien[0] }, opts)
    if (!trocken) {
      item.status = 'veroeffentlicht'
      item.ig = { id: r.id, permalink: r.permalink, am: new Date().toISOString() }
      // Wochentag und Uhrzeit sind Merkmale für den Optimierer (Berliner Zeit der Veröffentlichung)
      { const mk = merkmaleVon(item, item.ig.am); item.wochentag = mk.wochentag; item.uhrzeit = mk.uhrzeit }
      item.fehler = null
      await speichereQueue(q)
      log(`Veröffentlicht: ${r.permalink}`)
      // Zusätzlich auf die Facebook-Seite spiegeln (nur mit FB_PAGE_ID und FB_PAGE_TOKEN; ein Fehler hier ändert nichts am Instagram-Beitrag)
      const f = await fb.spiegeln(item, dateien, caption)
      if (f?.id) { item.fb = f; log(`Facebook: ${f.id}`) } else if (f?.fehler) { item.fb = { fehler: f.fehler }; log(`Facebook nicht gepostet: ${f.fehler}`) }
      if (f) await speichereQueue(q)
      // Zusätzlich als TikTok-Fotoslideshow (nur Karussells; Stories laufen auf TikTok kaum). Ein Fehler hier ändert nichts am Instagram-Beitrag.
      if (item.typ === 'karussell' && params.tiktok?.aktiv && tiktok.bereit()) {
        try {
          const tt = await tiktok.veroeffentliche({ item, dateien, caption, einstellungen: params.tiktok, log })
          item.tiktok = { ...tt, am: new Date().toISOString() }
          log(`TikTok: ${tt.publish_id} (${tt.sichtbarkeit})`)
        } catch (e3) { item.tiktok = { fehler: String(e3.message || e3).slice(0, 300) }; log(`TikTok nicht gepostet: ${item.tiktok.fehler}`) }
        await speichereQueue(q)
      }
      // Quiz-Stories haben eine zweite Datei (Auflösung): gleich danach als eigene Story veröffentlichen
      let aufloesungOffen = false
      if (item.typ === 'story') for (const d of dateien.slice(1)) {
        try { const r2 = await ig.veroeffentlicheStory({ datei: d }, opts); log(`Auflösung veröffentlicht: ${r2.permalink}`) } catch (e2) { log(`Auflösung nicht veröffentlicht: ${String(e2.message).slice(0, 200)}`); aufloesungOffen = true; item.fehler = 'Auflösung nicht veröffentlicht: ' + String(e2.message).slice(0, 200) }
      }
      // Bilder werden nicht mehr gebraucht; sie bleiben nur in der Git-Historie
      if (!aufloesungOffen) { try { fs.rmSync(path.dirname(dateien[0]), { recursive: true, force: true }) } catch {} } else { await speichereQueue(q); fehler++ }
    } else log('Trockenlauf ok', JSON.stringify(r).slice(0, 300))
  } catch (e) {
    const meldung = String(e.message || e).slice(0, 500)
    item.fehler = meldung
    // Nur Fehler am Beitrag selbst zählen als Versuch (Datei, Caption, Container). Globale Fehler (Token, Rechte, Ratenlimit,
    // Netzwerk, Ausfall) verbrennen keinen Beitrag: er bleibt „geprüft“ und der nächste Versuch kommt vom nächsten Takt.
    // Nur erkannte globale Ursachen zählen nicht als Versuch; alles andere ist ein Fehler am Beitrag (Bild, Format, Container)
    const global = e.status === 429 || e.status >= 500 || [4, 10, 17, 32, 190, 200, 613].includes(e.code) || (e.code === 100 && e.subcode === 33) || /Netzwerkfehler|Medien-Repo|nicht erreichbar|Publishing-Limit|Umgebungsvariable|TOKEN|Token|MEDIA_|PAUSE/.test(meldung)
    const beitragsFehler = !global
    if (e.unklar) {
      // Instagram hat evtl. schon veröffentlicht: nie automatisch wiederholen, sonst Doppelpost. Christian prüft das Profil.
      item.status = 'unklar'
      item.unklarAm = new Date().toISOString()
      log(`UNKLAR bei ${item.id}: möglicherweise schon veröffentlicht, wird nicht wiederholt. ${meldung}`)
    } else if (beitragsFehler) {
      item.versuche = (item.versuche || 0) + 1
      if (item.versuche >= 3) item.status = 'fehler'
    }
    if (!trocken) await speichereQueue(q)
    log(`FEHLER bei ${item.id}: ${meldung}`)
    fehler++
  }
}
process.exit(fehler ? 1 : 0)
