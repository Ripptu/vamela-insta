// Schreibt neue Karussells, Reels oder Stories, wenn der Vorrat zur Neige geht. Claude über das Abo.
// Aufruf: node automatik/neu-schreiben.mjs --typ karussell|reel|story [--anzahl 3] [--auto <Datei>]
// Ergebnis wird an docs/content-posts-auto.md, docs/content-reels-auto.md bzw. docs/content-stories-auto.md angehängt (--auto
// nennt eine andere Zieldatei), nachdem der Parser es lesen konnte und die harten Formregeln erfüllt sind. Die inhaltliche
// Prüfung macht danach der Prüf-Agent (qa.mjs). Stories: Regeln, Plan und Prompt stehen in automatik/story-regeln.mjs.
//
// Mehrwert (Christian, 12.10.2026): Jeder Block trägt „- Mehrwert:“ (ein Satz, was der Follower danach kann, weiß oder hat),
// „- Motiv:“ (englische Bildbeschreibung) und „- Familie: nacht | tag“; geprüft von automatik/block-felder.mjs.
// Fundstücke (Säule fundstuecke, nur Karussells): Das Repo kommt aus data/trends.json (automatik/trends.mjs), wird VOR dem
// Schreiben live geprüft (automatik/repo-check.mjs: existiert, nicht archiviert, Push < 12 Monate, Lizenz) und Claude bekommt
// Beschreibung und README-Auszug als einzige Quelle. Ohne geprüftes Repo wird der Platz zu tipps oder design.
//
// Selbstoptimierung: Säule und Hook-Stil jedes neuen Beitrags plant der Optimierer (automatik/optimierer.mjs) nach den
// Gewichten in plan/params.json (20 % Erkunden). Claude bekommt die fünf Beiträge mit dem höchsten Wachstumswert als
// „Gewinner-Muster“, die drei schwächsten als „vermeiden“ und alle Hooks der letzten 30 Tage, die nicht wiederkommen dürfen.
//
// Ist Claude nicht erreichbar (lokal nicht angemeldet), gibt es eine Meldung und Exit-Code 2, sonst nichts; vorrat.mjs macht dann
// weiter. Exit-Code 1: Neuschreiben gescheitert oder Vorrat nicht lesbar.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { frageClaude } from './claude.mjs'
import { ladeQueue } from './queue.mjs'
import { readPosts, readReels, readStories } from '../render/inhalt.mjs'
import { planeStories, pruefeStories, baueStoryPrompt, beispielBlock, aehnlichkeit, AEHNLICH_AB, STORY_SAEULEN } from './story-regeln.mjs'
import { pruefeKarussell } from './pruefe-block.mjs'
import { ladeFakten, pruefeText, beitragsText } from './fakten.mjs'
import { beobachtungen, statistik, rangliste, planeMerkmale, WERTE } from './optimierer.mjs'
import { berlin } from './zeit.mjs'
import { ergaenze, pruefeZusatz } from './block-felder.mjs'
import { pruefeRepo, holeReadme, kostenHinweise, pruefeRepoAngaben, repoAdressen } from './repo-check.mjs'
import { pruefeSprechReel, SPRECH_REGELN } from './reel-regeln.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const args = process.argv.slice(2)
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d)
const typ = opt('--typ', 'karussell')
// Ideen-Modus (Christian, 12.10.2026): --ideen <Ideenliste.md> --nummern 1-5,9 schreibt genau diese Ideen als Karussells.
// Daneben liegt <Ideenliste>.zuordnung.json mit nr_basis (Karussell-Nr. = nr_basis + Ideen-Nr.), Werkzeug-Pfaden, Repos und Abweichungen.
const ideenDatei = opt('--ideen', null)
const ideenNummern = String(opt('--nummern', '')).split(',').filter(Boolean).flatMap((t) => {
  const [a, b] = t.split('-').map(Number)
  return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a]
})
const anzahl = ideenDatei ? ideenNummern.length : +opt('--anzahl', 3)
const lies = (f) => (fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8') : '')
const liesJson = (f, d) => { try { return JSON.parse(lies(f)) } catch { return d } }
const ersterBlock = (wort) => (md) => md.match(new RegExp(`^## ${wort} \\d+:[\\s\\S]*?(?=\\n---\\n|\\n## |\\n# |$(?![\\s\\S]))`, 'm'))?.[0]
const cfg = typ === 'reel'
  ? { basis: 'docs/content-reels.md', auto: opt('--auto', 'docs/content-reels-auto.md'), parse: readReels, wort: 'Reel', beispiel: ersterBlock('Reel') }
  : typ === 'story'
    ? { basis: 'docs/content-stories-auto.md', auto: opt('--auto', 'docs/content-stories-auto.md'), parse: readStories, wort: 'Story' }
    : { basis: 'docs/content-posts.md', auto: opt('--auto', 'docs/content-posts-auto.md'), parse: readPosts, wort: 'Karussell', beispiel: ersterBlock('Karussell') }
const story = typ === 'story'
if (!['karussell', 'reel', 'story'].includes(typ)) { console.log(`Unbekannter Typ „${typ}“ (karussell, reel oder story).`); process.exit(1) }

const basisPfad = path.join(ROOT, cfg.basis)
const autoPfad = path.resolve(ROOT, cfg.auto)
let vorhanden
try {
  const basis = fs.existsSync(basisPfad) ? cfg.parse(basisPfad) : []
  // Schreibt der Lauf in eine eigene Datei (--auto), zählt der normale Auto-Vorrat trotzdem mit (Nummern, gesperrte Hooks)
  const standardAuto = path.join(ROOT, { karussell: 'docs/content-posts-auto.md', story: 'docs/content-stories-auto.md', reel: 'docs/content-reels-auto.md' }[typ] || cfg.auto)
  const dateien = [...new Set([basisPfad, standardAuto, autoPfad])].filter((p) => fs.existsSync(p))
  vorhanden = dateien.flatMap((p) => cfg.parse(p))
  // Zusatzfelder (Mehrwert, Motiv, Familie, Repo) liest der Parser nicht mit: aus dem Markdown ergänzen
  vorhanden = ergaenze(vorhanden, dateien.map((p) => fs.readFileSync(p, 'utf8')).join('\n'), cfg.wort)
} catch (e) {
  // Nie auf eine kaputte Datei aufschreiben: erst reparieren, dann neu schreiben.
  console.log(`Neuschreiben ${typ} abgebrochen: Vorrat nicht lesbar (${e.message})`)
  process.exit(1)
}
const q = await ladeQueue()
const params = liesJson('plan/params.json', {})
const fakten = ladeFakten()
const heute = berlin().datum
const trendsPfad = path.resolve(ROOT, process.env.TRENDS_DATEI || 'data/trends.json')
const trends = (() => { try { return JSON.parse(fs.readFileSync(trendsPfad, 'utf8')) } catch { return { repos: [], themen: [] } } })()

// ---- Was Follower bringt (Optimierer) ----
const beob = beobachtungen(liesJson('data/messwerte.json', { konto: [], beitraege: {} }))
const st = statistik(beob)
const { beste, schwaechste } = rangliste(beob)
const zeileBeob = (b) => `- „${b.hook || b.titel || b.id}“ (Säule ${b.merkmale.saeule ?? '?'}, Hook-Stil ${b.merkmale.hook_stil ?? '?'}, ${b.merkmale.format ?? '?'}, Caption ${b.merkmale.caption_laenge ?? '?'}): Wachstumswert ${b.wert}, ${b.follows} neue Follower bei ${b.reach} erreichten Konten`
const gewinner = beob.length
  ? `GEWINNER-MUSTER (höchster Wachstumswert, daran orientieren, nicht kopieren):\n${beste.map(zeileBeob).join('\n')}${schwaechste.length ? `\nVERMEIDEN (schwächster Wachstumswert):\n${schwaechste.map(zeileBeob).join('\n')}` : ''}\nAKTUELLE GEWICHTE (Anteile): Säulen ${JSON.stringify(params.gewichte?.saeule || {})}, Hook-Stile ${JSON.stringify(params.gewichte?.hook_stil || {})}`
  : ''

// ---- Kein Hook und kein Thema der letzten 30 Tage ----
const vor30 = new Date(Date.now() - 30 * 864e5).toISOString()
const hookVon = (x) => x.hook || (x.pages?.[0] ? `${x.pages[0].head} ${x.pages[0].sub || ''}`.trim() : null) || x.text || null
const hooks30 = q.filter((x) => x.status === 'veroeffentlicht' && (x.ig?.am || '') >= vor30).map(hookVon).filter(Boolean)
const hooksVorrat = vorhanden.map(hookVon).filter(Boolean)
const gesperrteHooks = [...new Set([...hooks30, ...hooksVorrat])]
const themen = [...new Set([...vorhanden.map((p) => p.titel), ...q.map((x) => x.titel), ...hooks30])].slice(story ? -80 : -60)

// ---- Plan ----
const zuletzt = [...vorhanden].sort((a, b) => a.nr - b.nr).slice(-3)
const werkzeugeBenutzt = new Set([...vorhanden.map((p) => p.werkzeug), ...q.map((x) => x.werkzeug)].filter(Boolean))
const werkzeugListe = fakten.werkzeuge.filter((w) => w.pfad !== '/werkzeuge')
const freieWerkzeuge = [...werkzeugListe.filter((w) => !werkzeugeBenutzt.has(w.pfad)), ...werkzeugListe.filter((w) => werkzeugeBenutzt.has(w.pfad))]
// ---- Ideen-Modus: Plan kommt aus der Ideenliste statt vom Optimierer ----
const SAEULE_KURZ = { T: 'tipps', W: 'werkzeuge', D: 'design', F: 'fundstuecke' }
function ideenPlan() {
  const md = fs.readFileSync(path.resolve(ROOT, ideenDatei), 'utf8')
  const zu = JSON.parse(fs.readFileSync(path.resolve(ROOT, ideenDatei).replace(/\.md$/, '.zuordnung.json'), 'utf8'))
  const ideen = new Map()
  for (const z of md.split('\n')) {
    const c = z.split('|').slice(1, -1).map((x) => x.trim())
    if (c.length === 5 && /^\d+$/.test(c[0])) ideen.set(+c[0], { hook: c[1], mitnehmen: c[2], saeule: SAEULE_KURZ[c[3]], bildidee: c[4] })
  }
  return ideenNummern.map((i) => {
    const idee = { ...ideen.get(i), ...(zu.abweichung?.[i] || {}) }
    if (!idee.hook) throw new Error(`Idee ${i} nicht in ${ideenDatei}`)
    const nr = zu.nr_basis + i
    const werkzeug = idee.saeule === 'werkzeuge' ? zu.werkzeug?.[i] || null : null
    if (idee.saeule === 'werkzeuge' && !werkzeug) throw new Error(`Idee ${i}: Werkzeug-Pfad fehlt in der Zuordnung`)
    const angebot = werkzeug ? 'Werkzeug' : idee.saeule === 'tipps' && nr % 4 === 0 ? 'Entwurf' : 'keins'
    return { nr, idee: i, saeule: idee.saeule, hook_stil: null, angebot, werkzeug, repoSlug: zu.repo?.[i] || null, vorgabe: idee }
  })
}
const plan = ideenDatei ? ideenPlan() : story
  ? planeStories(vorhanden, anzahl, q.map((x) => x.id), { gewichte: params.gewichte, seed: `${heute}|story`, statistik: st })
  : (() => {
      const naechsteNr = Math.max(0, ...vorhanden.map((p) => p.nr), ...q.filter((x) => x.typ === typ).map((x) => +String(x.id).replace(/\D/g, '') || 0)) + 1
      // fundstuecke nur als Karussell (Reels filmen nur vamela.de, Stories nennen keine fremden Adressen)
      const merkmale = planeMerkmale(anzahl, params.gewichte, { seed: `${heute}|${typ}|${naechsteNr}`, statistik: st, vorher: zuletzt, saeulen: typ === 'karussell' ? WERTE.saeule : STORY_SAEULEN })
      let w = 0
      return merkmale.map((m, i) => {
        const nr = naechsteNr + i
        // Werkzeug-Beiträge zeigen ein Werkzeug (am längsten nicht gezeigt zuerst); jeder vierte Tipp-Beitrag weist auf den kostenlosen Entwurf hin.
        const werkzeug = m.saeule === 'werkzeuge' ? freieWerkzeuge[w++ % freieWerkzeuge.length].pfad : null
        const angebot = werkzeug ? 'Werkzeug' : m.saeule === 'tipps' && nr % 4 === 0 ? 'Entwurf' : 'keins'
        return { nr, ...m, angebot, werkzeug }
      })
    })()

// ---- Fundstücke: je Platz ein Repo aus data/trends.json, das noch nie vorkam und live alle Regeln erfüllt ----
const repoBenutzt = new Set([
  ...vorhanden.map((p) => p.repo), ...q.map((x) => x.repo), ...q.flatMap((x) => repoAdressen(x.caption)), ...vorhanden.flatMap((p) => repoAdressen(p.caption)),
].filter(Boolean).map((x) => String(x).toLowerCase()))
const repoKandidaten = (trends.repos || []).filter((r) => r.slug && !repoBenutzt.has(r.slug.toLowerCase()))
let repoGesperrt = false // Netz oder Ratenlimit: nicht weiter probieren
async function naechstesRepo() {
  while (!repoGesperrt && repoKandidaten.length) {
    const k = repoKandidaten.shift()
    const r = await pruefeRepo(k.slug)
    if (!r.ok) { console.log(`Fundstück ${k.slug} übersprungen: ${r.probleme.join('; ')}`); if (r.voruebergehend) repoGesperrt = true; continue }
    let readme = ''
    try { readme = await holeReadme(r.daten.slug, { max: 3500 }) } catch (e) { console.log(`Fundstück ${k.slug}: README nicht lesbar (${e.message}), übersprungen`); continue }
    repoBenutzt.add(r.daten.slug.toLowerCase())
    return { ...r.daten, readme, kosten: kostenHinweise(`${r.daten.beschreibung}\n${readme}`), warum: k.warum || '', daten: r.daten }
  }
  return null
}
/** Ideen-Modus: das vorgegebene Repo, nur wenn es die Live-Prüfung besteht. */
async function festesRepo(slug) {
  const r = await pruefeRepo(slug)
  if (!r.ok) { console.log(`Fundstück ${slug} übersprungen: ${r.probleme.join('; ')}`); return null }
  const readme = await holeReadme(r.daten.slug, { max: 3500 }).catch(() => '')
  return { ...r.daten, readme, kosten: kostenHinweise(`${r.daten.beschreibung}\n${readme}`), warum: 'von Christian aus der Gaming-Ideenliste gewählt', daten: r.daten }
}
if (!story) {
  for (const [i, p] of plan.entries()) {
    if (p.saeule !== 'fundstuecke') continue
    p.repo = p.repoSlug ? await festesRepo(p.repoSlug) : await naechstesRepo()
    if (!p.repo) {
      const nachbarn = [plan[i - 1]?.saeule, plan[i + 1]?.saeule]
      p.saeule = ['tipps', 'design'].find((x) => !nachbarn.includes(x)) || 'tipps'
      p.angebot = 'keins'
      console.log(`Kein geprüftes Fundstück in ${path.relative(ROOT, trendsPfad)} verfügbar, ${cfg.wort} ${p.nr} wird ${p.saeule}.`)
    }
  }
}

const basisText = lies(cfg.basis)
const beispiel = story ? null : cfg.beispiel(basisText)
const fundBeispiel = plan.some((p) => p.repo) ? basisText.match(/^## Karussell \d+:[^\n]*\n(?:- [^\n]*\n)*?- Säule: fundstuecke[\s\S]*?(?=\n## |$(?![\s\S]))/m)?.[0]?.trim() : null
const beispiele = story ? [...new Set(plan.map((p) => p.interaktion))].map((i) => beispielBlock(basisText, i)).filter(Boolean) : []
if (story ? !beispiele.length : !beispiel) throw new Error('Beispielblock nicht gefunden.')

const werkzeugText = fakten.werkzeuge.map((w) => `${w.pfad} (${w.name})`).join('; ')
const preisText = fakten.preise.map((p) => `${p.text} = ${p.bedeutung}`).join('; ')
const repoFakten = plan.filter((p) => p.repo).map((p) => `${cfg.wort} ${p.nr}: Repo ${p.repo.slug} (https://github.com/${p.repo.slug})
- Zeilen exakt so: "- Repo: ${p.repo.slug}", "- Lizenz: ${p.repo.lizenz}", "- Sterne: ${p.repo.sterne_text}"
- Beschreibung laut GitHub: ${p.repo.beschreibung || '(keine)'}
- Warum ausgewählt: ${p.repo.warum || '–'}
- ${p.repo.kosten.length ? `KOSTEN: Das README nennt ${p.repo.kosten.join(', ')}. Der Beitrag MUSS sagen, was davon Geld kostet (z. B. „kostenpflichtiger Plan für …“).` : 'Keine Hinweise auf Bezahlangebote im README.'}
- README-Auszug (einzige Quelle für Funktionen; was hier nicht steht, darfst du nicht behaupten):
"""
${p.repo.readme}
"""`).join('\n\n')
const motivIdeen = (trends.themen || []).slice(0, 8).map((t) => `- ${t.thema} (${t.datum || ''}, Quelle ${t.quelle || '–'}): ${t.motiv_idee || ''} [${t.familie || ''}]`).join('\n')
const grund = (fehler) => (story
  ? baueStoryPrompt({ regeln: lies('CLAUDE.md'), strategie: lies('docs/strategie.md').slice(0, 14000), learnings: lies('learnings.md').slice(-2500), themen: [...themen, ...gesperrteHooks].slice(-100), plan, beispiele, fehler, gewinner })
  : `Du schreibst neue ${cfg.wort === 'Reel' ? 'Scroll-Reels' : 'Karussell-Beiträge'} für den Instagram-Account @vamela.de (VAMELA, Christian Stockmeier: Webdesign und Grafikdesign für kleine Betriebe aus Haag an der Amper, Landkreis Freising; Zielgruppe Handwerk, Gastro, Praxen und Dienstleister in Freising, Erding, Moosburg und München-Nord).

VERBINDLICHE REGELN (CLAUDE.md):
${lies('CLAUDE.md')}

STRATEGIE (Säulen, Hook-Stile, Caption-Aufbau, Wochenmodell):
${lies('docs/strategie.md').slice(0, 14000)}

FAKTEN (nur diese Preise und Adressen, Stand ${fakten.stand}, abgeglichen mit vamela.de):
Preise: ${preisText}
Werkzeuge: ${werkzeugText}
Freigegebene Referenzen: ${fakten.referenzen.map((r) => `${r.name} (${r.pfad})`).join('; ')}

BISHERIGE ERKENNTNISSE:
${lies('learnings.md').slice(-2500)}
${gewinner ? `\nWAS FOLLOWER BRINGT (Optimierer, nach Wachstumswert):\n${gewinner}\n` : ''}
BEREITS VERWENDETE THEMEN/TITEL (nicht wiederholen, auch nicht sinngemäß): ${themen.join(' | ')}
HOOKS, DIE NICHT WIEDERKOMMEN DÜRFEN (letzte 30 Tage und Vorrat, auch nicht sinngemäß): ${gesperrteHooks.slice(-80).join(' | ')}

${ideenDatei ? `AUFGABE: Schreibe ${anzahl} neue Karussell-Blöcke nach Christians Gaming-Ideenliste. Das Spiel ist nur der Aufhänger im Cover und in einem Satz; die Seiten 2 bis 5 sind praktischer Nutzen für kleine Betriebe. Spielnamen (Minecraft, Craft Attack, GTA 6, League of Legends usw.) dürfen im Text stehen, aber keine Behauptungen über Spiele (keine Termine, Preise, Verkaufszahlen, Inhalte, keine Gewalt), kein Anschein einer Verbindung zum Spiel. Hook: die Vorgabe sinngemäß, höchstens 10 Wörter, darf gekürzt oder geschärft werden; den Hook-Stil wählst du passend (einer von: ${WERTE.hook_stil.join(', ')}). Motiv: aus der Bildidee, englisch, Gaming-Ideen im Voxel-, Pixel-, Retro- oder Low-Poly-Stil ohne bekannte Figuren, sonst Objekt-Metapher; Familie passend.
${plan.map((p) => `- Karussell ${p.nr} (Idee ${p.idee}; Säule: ${p.saeule}, Angebot: ${p.angebot}${p.werkzeug ? `, Werkzeug: ${p.werkzeug}` : ''}${p.repo ? `, Repo: ${p.repo.slug}` : ''}): Hook-Vorgabe „${p.vorgabe.hook}“ · Zum Mitnehmen: ${p.vorgabe.mitnehmen} · Bildidee: ${p.vorgabe.bildidee}`).join('\n')}
Wo „PRÜFEN“ steht: die Aussage weglassen, statt sie zu behaupten.` : `AUFGABE: Schreibe ${anzahl} neue ${cfg.wort}-Blöcke mit genau diesen Nummern und Merkmalen: ${plan.map((p) => `${cfg.wort} ${p.nr} (Säule: ${p.saeule}, Hook-Stil: ${p.hook_stil}, Angebot: ${p.angebot}${p.werkzeug ? `, Werkzeug: ${p.werkzeug}` : ''}${p.repo ? `, Repo: ${p.repo.slug}` : ''})`).join('; ')}.`}
Metazeilen je Block: "- Säule: …", "- Hook-Stil: …", "- Angebot: Werkzeug | Entwurf | keins" und bei Werkzeug "- Werkzeug: /pfad"${cfg.wort === 'Reel' ? ', dazu "- URL: https://vamela.de/pfad" (die Seite zum Thema), "- Ton: Stimme (Sterling)" und "- Sprechtext: …" (siehe SPRECH-REEL)' : ''}; bei fundstuecke "- Repo: owner/name", "- Lizenz: …", "- Sterne: …" genau wie unten vorgegeben. Dazu in JEDEM Block:
- "- Mehrwert: …" = ein Satz, der mit „Du kannst“, „Du weißt“ oder „Du hast“ beginnt und sagt, was der Follower nach dem Beitrag konkret kann, weiß oder hat. Die Seiten müssen genau das einlösen, und das Cover verspricht diesen Nutzen (was man lernt oder bekommt). Reine Image- oder Spruch-Beiträge („Große Ideen brauchen Platz“) sind verboten.
- "- Motiv: …" = kurze englische Bildbeschreibung (5 bis 45 Wörter) für einen KI-Bildgenerator: Tech-, KI- oder Gaming-Hype oder eine Tier- oder Objekt-Metapher zum Thema. Keine Schrift im Bild, keine Personen, keine echten Marken, Logos oder Spielfiguren (statt Minecraft-Figur „voxel-style“, statt eines bekannten Spiels „retro game“, „pixel art“, „low-poly“).
- "- Familie: nacht" (Tech, KI, Gaming: dunkel mit oranger Glut) oder "- Familie: tag" (Tier- oder Objekt-Metapher auf Orange und Weiß), passend zum Motiv.
Säulen: tipps = kurz und sofort umsetzbar zu Website, Google-Profil, Bewertungen, lokaler Sichtbarkeit; werkzeuge = das genannte Gratis-Werkzeug als Nutzen-Beitrag (was es löst, wie schnell, ohne Anmeldung) mit „Link in der Bio“; design = Schrift, Farbe, Layout, gutes gegen schlechtes Beispiel, nur selbst gesetzte Beispiele, keine fremden Logos oder Marken; fundstuecke = ein kostenloses Open-Source-Werkzeug von GitHub (Repo unten), das Selbstständigen, kleinen Betrieben, Designern oder Webleuten Arbeit abnimmt: was es löst, für wen, ein erster Schritt zum Ausprobieren, Grenzen laut README. Angebot Entwurf: der kostenlose erste Entwurf von vamela.de, „Link in der Bio“.
${repoFakten ? `
FUNDSTÜCKE (live geprüft am ${heute}). Regeln: Nur behaupten, was in Beschreibung oder README steht; keine Zahlen außer der Sterne-Zeile; Sterne nur gerundet mit „Stand“. Die Caption enthält eine Zeile „Repo: github.com/owner/name · Lizenz: … · rund N Sterne auf GitHub (Stand TT.MM.JJJJ).“ Auf Seite 6 steht, wo man es findet („Auf GitHub: owner/name“), dazu Speichern oder Teilen; kein „Link in der Bio“ (Angebot keins). Kostet etwas Geld (Bezahlplan, gehostete Fassung, Cloud-Anbieter), sag es klar. Keine Rechtsberatung zu Lizenzen, nur den Lizenznamen nennen. Folgen-Satz: „Folge @vamela.de für freie Werkzeuge, die dir im Betrieb Arbeit abnehmen.“

${repoFakten}
` : ''}${motivIdeen ? `
AKTUELLE HYPE-THEMEN ALS ANREGUNG FÜR „Motiv“ (data/trends.json, nur als Bildidee, nicht als Fakt im Text):
${motivIdeen}
` : ''}
${cfg.wort === 'Reel'
    ? SPRECH_REGELN
    : `KARUSSELL-STRUKTUR (feste Regel): genau 6 Seiten. Seite 1 = Hook mit höchstens 10 Wörtern im gewünschten Hook-Stil, ohne Untertitel oder mit höchstens ein, zwei Wörtern dazu. Seiten 2 bis 5 = Inhalt, ein Kerngedanke pro Seite, höchstens zwei kurze Sätze und höchstens 20 Wörter, keine Aufzählung, keine Deko-Nummerierung. Seite 6 = CTA (Vorlage „Schlussseite“): Speichern, Teilen oder Kommentieren; bei Werkzeug oder Entwurf mit „Link in der Bio“ (höchstens 26 Wörter), ohne Angebot nie „Link in der Bio“. Alles Längere gehört in die Caption.`}
Halte dich EXAKT an das Format des Beispielblocks (Überschrift "## ${cfg.wort} N: Titel", Metazeilen mit "- Schlüssel: Wert", Tabelle, Caption mit "**Caption:**", "**Hashtags:**"). Jeder Beitrag hat eine Mitnahme, die ein Betrieb sofort umsetzen kann, eine Frage am Ende der Caption, höchstens 5 Hashtags (Mischung aus Ort und Thema), Du-Form, bayerisch-bodenständig, kein Marktschreier-Ton. Keine erfundenen Kundenstimmen, Erfolgszahlen, Studien oder Prozentangaben, keine Preise außer den oben genannten (und nur, wenn der Beitrag sie braucht), keine Rechtsberatung (Impressum, Datenschutz, AGB höchstens mit Verweis auf Anwältin oder Anwalt), keine Emojis auf den Seiten.
${fehler ? `\nDEIN LETZTER VERSUCH WURDE ABGELEHNT WEGEN: ${fehler}\nKorrigiere genau das.\n` : ''}
BEISPIELBLOCK (Format!):
${beispiel}
${fundBeispiel ? `\nBEISPIEL FÜR EIN FUNDSTÜCK (Format und Ton, nicht den Inhalt übernehmen):\n${fundBeispiel}\n` : ''}
Gib NUR die neuen Blöcke aus, ohne Vorwort und ohne Codeblock, getrennt durch eine Zeile "---".`)

// Kopf, den der Parser für den Abschnitt braucht (readPosts sucht "# Karussells", readStories "# Stories")
const ABSCHNITT = { karussell: '# Karussells\n\n', story: '# Stories\n\n', reel: '' }[typ]

/** Hook zu ähnlich zu einem gesperrten Hook (letzte 30 Tage oder Vorrat)? */
const hookWiederholt = (h) => gesperrteHooks.find((alt) => aehnlichkeit(h, alt) >= AEHNLICH_AB)

function pruefe(text) {
  const tmp = path.join(os.tmpdir(), `neu-${process.pid}-${Date.now()}.md`)
  let gelesen
  try {
    fs.writeFileSync(tmp, ABSCHNITT + text)
    gelesen = cfg.parse(tmp)
  } catch (e) { return `Parser: ${e.message}` } finally { fs.rmSync(tmp, { force: true }) }
  gelesen = ergaenze(gelesen, ABSCHNITT + text, cfg.wort)
  // Pflichtzeilen Mehrwert, Motiv, Familie (und Repo-Zeilen bei fundstuecke) für jeden Typ
  for (const g of gelesen) { const z = pruefeZusatz(g); if (z.length) return `${cfg.wort} ${g.nr}: ${z[0]}` }
  if (story) {
    const f = pruefeStories(gelesen, plan, { titel: vorhanden.map((s) => s.titel), texte: vorhanden.flatMap((s) => [s.text, s.aufloesung]).filter(Boolean) })
    if (f) return f
    for (const g of gelesen) { const w = hookWiederholt(g.text); if (w) return `Story ${g.nr}: wiederholt einen Hook der letzten 30 Tage („${w.slice(0, 50)}“)` }
    return null
  }
  if (gelesen.length !== anzahl) return `${gelesen.length} statt ${anzahl} lesbare Blöcke`
  { const nrs = gelesen.map((g) => g.nr); if (new Set(nrs).size !== nrs.length) return 'Nummern doppelt vergeben' }
  for (const g of gelesen) {
    const p = plan.find((x) => x.nr === g.nr)
    if (!p) return `unerwartete Nummer ${g.nr}`
    if (g.saeule !== p.saeule) return `${cfg.wort} ${g.nr}: Säule „${g.saeule}“, verlangt „${p.saeule}“`
    if (p.hook_stil === null ? !WERTE.hook_stil.includes(g.hook_stil) : g.hook_stil !== p.hook_stil) return `${cfg.wort} ${g.nr}: Hook-Stil „${g.hook_stil}“, verlangt „${p.hook_stil}“`
    if (String(g.angebot).toLowerCase() !== p.angebot.toLowerCase()) return `${cfg.wort} ${g.nr}: Angebot „${g.angebot}“, verlangt „${p.angebot}“`
    if (p.werkzeug && g.werkzeug !== p.werkzeug) return `${cfg.wort} ${g.nr}: Werkzeug „${g.werkzeug}“, verlangt „${p.werkzeug}“`
    if (p.repo) {
      const seiten = (g.pages || []).map((s) => [s.head, s.sub, s.text].filter(Boolean).join(' ')).join('\n')
      const f = pruefeRepoAngaben({ ...g, text: seiten }, p.repo.daten, { kosten: p.repo.kosten })
      if (f.length) return `${cfg.wort} ${g.nr}: ${f[0]}`
    }
    if (typ === 'karussell') {
      const f = pruefeKarussell(g)
      if (f.length) return `Karussell ${g.nr}: ${f[0]}`
    } else {
      const tags = (g.hashtags || '').split(/\s+/).filter((x) => x.startsWith('#'))
      if (tags.length > 5 || !tags.length) return `Reel ${g.nr}: Hashtags ${tags.length}`
      if (!g.caption || g.caption.length > 2100) return `Reel ${g.nr}: Caption fehlt oder zu lang`
      // Sprech-Reel (render/reel.mjs): Sprechtext und Szenen statt Ablauf-Tabelle, Regeln in automatik/reel-regeln.mjs
      const sr = pruefeSprechReel(g, { angebot: p.angebot, root: ROOT })
      if (sr.length) return `Reel ${g.nr}: ${sr[0]}`
      if (!/^https:\/\/vamela\.de\//.test(g.url || '')) return `Reel ${g.nr}: Zeile „- URL: https://vamela.de/…“ fehlt`
      if (p.angebot !== 'keins' && !/Link in der Bio/i.test(g.caption)) return `Reel ${g.nr}: Angebot ohne „Link in der Bio“`
      if (p.angebot === 'keins' && /Link in der Bio/i.test(g.caption)) return `Reel ${g.nr}: sollte ohne Angebot sein`
      const fk = pruefeText(beitragsText(g) + `\n${String(g.url).replace('https://', '')}`, fakten)
      if (fk.length) return `Reel ${g.nr}: ${fk[0]}`
    }
    const w = hookWiederholt(hookVon(g))
    if (w) return `${cfg.wort} ${g.nr}: Hook wiederholt einen der letzten 30 Tage oder aus dem Vorrat („${w.slice(0, 50)}“)`
  }
  return null
}

let text = '', fehler = null
for (let versuch = 1; versuch <= 3; versuch++) {
  try {
    text = (await frageClaude(grund(fehler), { modell: 'sonnet', timeoutMs: 1_200_000 })).trim().replace(/^```\w*\n?|```$/g, '').trim()
  } catch (e) {
    // Claude fehlt oder ist nicht angemeldet (lokal): kein Stacktrace, nichts geschrieben, der Aufrufer macht weiter.
    console.log(`Neuschreiben ${typ} übersprungen, Claude nicht verfügbar: ${e.message}`)
    process.exit(2)
  }
  fehler = pruefe(text)
  console.log(`Versuch ${versuch}: ${fehler || 'ok'}`)
  if (!fehler) break
}
if (fehler) { console.log('Neuschreiben gescheitert:', fehler); process.exit(1) }
const titelWort = { Reel: 'Reels', Karussell: 'Karussells', Story: 'Stories' }[cfg.wort]
const kopf = fs.existsSync(autoPfad) ? '' : `# Automatisch geschriebene ${titelWort}\n\nVom Neuschreib-Lauf (neu-schreiben.mjs), vor der Veröffentlichung vom Prüf-Agenten kontrolliert.\n\n${ABSCHNITT}`
fs.appendFileSync(autoPfad, kopf + text + '\n\n---\n\n')
console.log(`${anzahl} neue ${cfg.wort}-Beiträge in ${cfg.auto} (Merkmale: ${plan.map((p) => `${p.nr} ${p.saeule}/${p.hook_stil}${p.repo ? ` ${p.repo.slug}` : ''}`).join(', ')})`)
