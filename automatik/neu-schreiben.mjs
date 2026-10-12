// Schreibt neue Karussells, Reels oder Stories, wenn der Vorrat zur Neige geht. Claude über das Abo.
// Aufruf: node automatik/neu-schreiben.mjs --typ karussell|reel|story [--anzahl 3] [--auto <Datei>]
// Ergebnis wird an docs/content-posts-auto.md, docs/content-reels-auto.md bzw. docs/content-stories-auto.md angehängt (--auto
// nennt eine andere Zieldatei), nachdem der Parser es lesen konnte und die harten Formregeln erfüllt sind. Die inhaltliche
// Prüfung macht danach der Prüf-Agent (qa.mjs). Stories: Regeln, Plan und Prompt stehen in automatik/story-regeln.mjs.
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
import { planeStories, pruefeStories, baueStoryPrompt, beispielBlock, aehnlichkeit, AEHNLICH_AB } from './story-regeln.mjs'
import { pruefeKarussell } from './pruefe-block.mjs'
import { ladeFakten, pruefeText, beitragsText } from './fakten.mjs'
import { beobachtungen, statistik, rangliste, planeMerkmale, WERTE } from './optimierer.mjs'
import { berlin } from './zeit.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const args = process.argv.slice(2)
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d)
const typ = opt('--typ', 'karussell')
const anzahl = +opt('--anzahl', 3)
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
  vorhanden = [...basis, ...(autoPfad !== basisPfad && fs.existsSync(autoPfad) ? cfg.parse(autoPfad) : [])]
} catch (e) {
  // Nie auf eine kaputte Datei aufschreiben: erst reparieren, dann neu schreiben.
  console.log(`Neuschreiben ${typ} abgebrochen: Vorrat nicht lesbar (${e.message})`)
  process.exit(1)
}
const q = await ladeQueue()
const params = liesJson('plan/params.json', {})
const fakten = ladeFakten()
const heute = berlin().datum

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
const plan = story
  ? planeStories(vorhanden, anzahl, q.map((x) => x.id), { gewichte: params.gewichte, seed: `${heute}|story`, statistik: st })
  : (() => {
      const naechsteNr = Math.max(0, ...vorhanden.map((p) => p.nr), ...q.filter((x) => x.typ === typ).map((x) => +String(x.id).replace(/\D/g, '') || 0)) + 1
      const merkmale = planeMerkmale(anzahl, params.gewichte, { seed: `${heute}|${typ}|${naechsteNr}`, statistik: st, vorher: zuletzt })
      let w = 0
      return merkmale.map((m, i) => {
        const nr = naechsteNr + i
        // Werkzeug-Beiträge zeigen ein Werkzeug (am längsten nicht gezeigt zuerst); jeder vierte Tipp-Beitrag weist auf den kostenlosen Entwurf hin.
        const werkzeug = m.saeule === 'werkzeuge' ? freieWerkzeuge[w++ % freieWerkzeuge.length].pfad : null
        const angebot = werkzeug ? 'Werkzeug' : m.saeule === 'tipps' && nr % 4 === 0 ? 'Entwurf' : 'keins'
        return { nr, ...m, angebot, werkzeug }
      })
    })()

const basisText = lies(cfg.basis)
const beispiel = story ? null : cfg.beispiel(basisText)
const beispiele = story ? [...new Set(plan.map((p) => p.interaktion))].map((i) => beispielBlock(basisText, i)).filter(Boolean) : []
if (story ? !beispiele.length : !beispiel) throw new Error('Beispielblock nicht gefunden.')

const werkzeugText = fakten.werkzeuge.map((w) => `${w.pfad} (${w.name})`).join('; ')
const preisText = fakten.preise.map((p) => `${p.text} = ${p.bedeutung}`).join('; ')
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

AUFGABE: Schreibe ${anzahl} neue ${cfg.wort}-Blöcke mit genau diesen Nummern und Merkmalen: ${plan.map((p) => `${cfg.wort} ${p.nr} (Säule: ${p.saeule}, Hook-Stil: ${p.hook_stil}, Angebot: ${p.angebot}${p.werkzeug ? `, Werkzeug: ${p.werkzeug}` : ''})`).join('; ')}.
Metazeilen je Block: "- Säule: …", "- Hook-Stil: …", "- Angebot: Werkzeug | Entwurf | keins" und bei Werkzeug "- Werkzeug: /pfad"${cfg.wort === 'Reel' ? ', dazu "- URL: https://vamela.de/pfad" (die Seite, die der Rekorder abfilmt) und "- Ton: stumm"' : ''}.
Säulen: tipps = kurz und sofort umsetzbar zu Website, Google-Profil, Bewertungen, lokaler Sichtbarkeit; werkzeuge = das genannte Gratis-Werkzeug als Nutzen-Beitrag (was es löst, wie schnell, ohne Anmeldung) mit „Link in der Bio“; design = Schrift, Farbe, Layout, gutes gegen schlechtes Beispiel, nur selbst gesetzte Beispiele, keine fremden Logos oder Marken. Angebot Entwurf: der kostenlose erste Entwurf von vamela.de, „Link in der Bio“.
${cfg.wort === 'Reel'
    ? `SCROLL-REEL: 12 bis 30 Sekunden, stumm. Der Rekorder filmt die angegebene Seite auf vamela.de (Werkzeug oder eigene Seite; Kundenseiten nur Schlossallee, Bachmaier, Thomas Rott). Ablauf-Tabelle "| Zeit | Aufnahme | Text im Bild |" mit Zeilen "| 0–3 s | was der Rekorder tut | „Text“ |", erster Abschnitt ist der Hook (höchstens 10 Wörter), letzter Abschnitt die Handlungsaufforderung.`
    : `KARUSSELL-STRUKTUR (feste Regel): genau 6 Seiten. Seite 1 = Hook mit höchstens 10 Wörtern im gewünschten Hook-Stil, ohne Untertitel oder mit höchstens ein, zwei Wörtern dazu. Seiten 2 bis 5 = Inhalt, ein Kerngedanke pro Seite, höchstens zwei kurze Sätze und höchstens 20 Wörter, keine Aufzählung, keine Deko-Nummerierung. Seite 6 = CTA (Vorlage „Schlussseite“): Speichern, Teilen oder Kommentieren; bei Werkzeug oder Entwurf mit „Link in der Bio“ (höchstens 26 Wörter), ohne Angebot nie „Link in der Bio“. Alles Längere gehört in die Caption.`}
Halte dich EXAKT an das Format des Beispielblocks (Überschrift "## ${cfg.wort} N: Titel", Metazeilen mit "- Schlüssel: Wert", Tabelle, Caption mit "**Caption:**", "**Hashtags:**"). Jeder Beitrag hat eine Mitnahme, die ein Betrieb sofort umsetzen kann, eine Frage am Ende der Caption, höchstens 5 Hashtags (Mischung aus Ort und Thema), Du-Form, bayerisch-bodenständig, kein Marktschreier-Ton. Keine erfundenen Kundenstimmen, Erfolgszahlen, Studien oder Prozentangaben, keine Preise außer den oben genannten (und nur, wenn der Beitrag sie braucht), keine Rechtsberatung (Impressum, Datenschutz, AGB höchstens mit Verweis auf Anwältin oder Anwalt), keine Emojis auf den Seiten.
${fehler ? `\nDEIN LETZTER VERSUCH WURDE ABGELEHNT WEGEN: ${fehler}\nKorrigiere genau das.\n` : ''}
BEISPIELBLOCK (Format!):
${beispiel}

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
    if (g.hook_stil !== p.hook_stil) return `${cfg.wort} ${g.nr}: Hook-Stil „${g.hook_stil}“, verlangt „${p.hook_stil}“`
    if (String(g.angebot).toLowerCase() !== p.angebot.toLowerCase()) return `${cfg.wort} ${g.nr}: Angebot „${g.angebot}“, verlangt „${p.angebot}“`
    if (p.werkzeug && g.werkzeug !== p.werkzeug) return `${cfg.wort} ${g.nr}: Werkzeug „${g.werkzeug}“, verlangt „${p.werkzeug}“`
    if (typ === 'karussell') {
      const f = pruefeKarussell(g)
      if (f.length) return `Karussell ${g.nr}: ${f[0]}`
    } else {
      const tags = (g.hashtags || '').split(/\s+/).filter((x) => x.startsWith('#'))
      if (tags.length > 5 || !tags.length) return `Reel ${g.nr}: Hashtags ${tags.length}`
      if (!g.caption || g.caption.length > 2100) return `Reel ${g.nr}: Caption fehlt oder zu lang`
      if (!g.ablauf?.length) return `Reel ${g.nr}: kein Ablauf`
      if (g.dauer < 12 || g.dauer > 30) return `Reel ${g.nr}: ${g.dauer} s, erlaubt 12 bis 30`
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
console.log(`${anzahl} neue ${cfg.wort}-Beiträge in ${cfg.auto} (Merkmale: ${plan.map((p) => `${p.nr} ${p.saeule}/${p.hook_stil}`).join(', ')})`)
