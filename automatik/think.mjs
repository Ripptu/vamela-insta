// Wöchentlicher Denk-Lauf. Zwei Stufen:
//  1. Der Optimierer (automatik/optimierer.mjs) rechnet die Gewichte je Merkmal aus den Messwerten nach (reiner Code).
//  2. Claude liest Messwerte, Wachstumswerte, Optimierer-Ergebnis und learnings.md und darf bis zu vier freie Stellgrößen
//     aus der Whitelist unten ändern (Uhrzeiten in den Cron-Fenstern, Format-Mix pro Wochentag, Säulen- und Hook-Gewichte
//     in Grenzen). Alles andere, insbesondere die festen Regeln aus CLAUDE.md, ist im Code unantastbar.
// Ergebnis: Eintrag in learnings.md (Beobachtung, Beleg mit Zahlen, Entscheidung, Nächster Test) und plan/params.json.
// Aufruf: node automatik/think.mjs [--trocken]
import fs from 'node:fs'
import path from 'node:path'
import { frageClaude, extrahiereJson } from './claude.mjs'
import { berlin } from './zeit.mjs'
import { aktualisiere, beobachtungen, rangliste, begrenze, GRENZEN, WERTE, EINSTELLUNGEN } from './optimierer.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const lies = (f) => (fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8') : '')
const mw = lies('data/messwerte.json') ? JSON.parse(lies('data/messwerte.json')) : { konto: [], beitraege: {} }
const datum = berlin().datum
const trocken = process.argv.includes('--trocken')
const MIN_BEITRAEGE = 8
const MAX_AENDERUNGEN = 4

// ---- Stufe 1: Optimierer ----
const { params, eintrag: opt } = aktualisiere({ messwerte: mw, params: JSON.parse(lies('plan/params.json')) })
const optText = opt.aenderungen.length ? opt.aenderungen.map((a) => `${a.merkmal}.${a.wert} ${a.von ?? '–'} → ${a.nach} (n=${a.n}, Mittel ${a.mittel ?? '–'})`).join('; ') : 'keine Änderung'
const speichereParams = () => { if (!trocken) fs.writeFileSync(path.join(ROOT, 'plan/params.json'), JSON.stringify(params, null, 2) + '\n') }
const verlaufOptimierer = () => {
  if (trocken) return
  const f = path.join(ROOT, 'data/optimierer-verlauf.json')
  const v = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []
  v.push(opt)
  fs.writeFileSync(f, JSON.stringify(v.slice(-104), null, 1) + '\n')
}

const posts = Object.values(mw.beitraege).map((b) => ({ id: b.id, titel: b.titel, typ: b.typ, zeit: b.zeit, merkmale: b.merkmale || null, ...b.verlauf[b.verlauf.length - 1] }))
if (posts.length < MIN_BEITRAEGE) {
  const eintrag = `\n## ${datum}: Zu wenig Daten\n- Beobachtung: ${posts.length} gemessene Beiträge, für eine Aussage braucht der Denk-Lauf mindestens ${MIN_BEITRAEGE}.\n- Beleg: ${posts.length} von ${MIN_BEITRAEGE} nötigen Beiträgen; Optimierer: ${opt.stichprobe} auswertbare Beiträge (Mindestreichweite ${EINSTELLUNGEN.minReichweite}), ${optText}.\n- Entscheidung: Keine Änderung durch den Denk-Lauf, Ausgangswerte bleiben (${JSON.stringify(params.feed.tage)}, Uhrzeit ${params.feed.uhrzeit}).\n- Nächster Test: weiter messen, bis ${MIN_BEITRAEGE} Beiträge Kennzahlen haben.\n`
  console.log(eintrag)
  speichereParams()
  verlaufOptimierer()
  if (!trocken) fs.appendFileSync(path.join(ROOT, 'learnings.md'), eintrag)
  process.exit(0)
}

// ---- Stufe 2: Claude ----
const beob = beobachtungen(mw)
const { beste, schwaechste } = rangliste(beob)
const kurz = (b) => ({ id: b.id, hook: b.hook, wert: b.wert, follows: b.follows, reach: b.reach, ...b.merkmale })

// Whitelist: Pfad -> Prüfung. Nur diese Stellgrößen darf der Denk-Lauf ändern.
// feed.uhrzeit: 17:00 bis 21:30, weil der Feed-Cron in veroeffentlichen.yml von 15:07 bis 21:52 UTC läuft (Sommerzeit 17:07 bis 23:52
// Berliner Zeit); frühere Zeiten würden kein Cron-Fenster treffen. stories.uhrzeit: 07:00 bis 14:00 (Story-Cron 05:09 bis 12:41 UTC).
// feed.tage: nur mit aktiven Reels, mindestens 2 Karussells und 2 Reels. Gewichte: innerhalb der Grenzen des Optimierers.
const ERLAUBT = {
  'feed.uhrzeit': (v) => /^(1[7-9]|2[01]):[0-5]\d$/.test(v) && v <= '21:30',
  'stories.uhrzeit': (v) => /^(0[7-9]|1[0-4]):[0-5]\d$/.test(v) && v <= '14:00',
  'feed.tage': (v) => params.reels_aktiv && v && typeof v === 'object' && ['1', '2', '3', '4', '5'].every((t) => ['reel', 'karussell'].includes(v[t])) && Object.values(v).filter((x) => x === 'karussell').length >= 2 && Object.values(v).filter((x) => x === 'reel').length >= 2,
  ...Object.fromEntries(WERTE.saeule.map((s) => [`gewichte.saeule.${s}`, (v) => typeof v === 'number' && v >= GRENZEN.saeule.min && v <= GRENZEN.saeule.max])),
  ...Object.fromEntries(WERTE.hook_stil.map((h) => [`gewichte.hook_stil.${h}`, (v) => typeof v === 'number' && v >= GRENZEN.hook_stil.min && v <= GRENZEN.hook_stil.max])),
}

const prompt = `Du wertest die Instagram-Leistung von @vamela.de aus (VAMELA, Webdesign und Grafikdesign für kleine Betriebe im Landkreis Freising). Ziel: mehr Follower und Anfragen aus der Region. Heute ist ${datum}.

AKTUELLE STELLGRÖSSEN (plan/params.json, nach dem Optimierer-Lauf von heute):
${JSON.stringify(params, null, 1)}

OPTIMIERER HEUTE (Code, Wachstumswert = (follows×10 + profile_visits×2 + shares×3 + saved×2) je 100 erreichte Konten, ab ${EINSTELLUNGEN.minReichweite} Reichweite): ${opt.stichprobe} auswertbare Beiträge, Gesamtmittel ${opt.gesamtmittel}, Änderungen: ${optText}

BESTE BEITRÄGE: ${JSON.stringify(beste.map(kurz))}
SCHWÄCHSTE BEITRÄGE: ${JSON.stringify(schwaechste.map(kurz))}

BISHERIGE ERKENNTNISSE (learnings.md):
${lies('learnings.md').slice(-6000)}

FOLLOWER-VERLAUF: ${JSON.stringify(mw.konto.slice(-30))}

ALLE BEITRÄGE MIT KENNZAHLEN (letzter Messwert):
${JSON.stringify(posts)}

AUFGABE: Finde Muster, die die Zahlen belegen (Säule, Hook-Stil, Format, Wochentag, Uhrzeit, Caption-Länge, Cover-Vorlage), und entscheide über höchstens ${MAX_AENDERUNGEN} Änderungen. Erlaubt sind nur diese Stellgrößen:
- feed.uhrzeit ("HH:MM", 17:00 bis 21:30)
- stories.uhrzeit ("HH:MM", 07:00 bis 14:00)
${params.reels_aktiv ? '- feed.tage (Objekt Wochentag 1-5 -> "reel" oder "karussell"; mindestens 2 Karussells und 2 Reels pro Woche)\n' : '(feed.tage bleibt unverändert: Reels sind noch nicht aktiv.)\n'}- gewichte.saeule.<${WERTE.saeule.join('|')}> (Zahl ${GRENZEN.saeule.min} bis ${GRENZEN.saeule.max}; die übrigen werden danach automatisch auf Summe 1 gebracht)
- gewichte.hook_stil.<${WERTE.hook_stil.join('|')}> (Zahl ${GRENZEN.hook_stil.min} bis ${GRENZEN.hook_stil.max})
Der Optimierer hat die Gewichte schon aus den Daten nachgezogen; ändere sie nur, wenn du einen Grund siehst, den er nicht sieht (z. B. ein Ausreißer verzerrt, eine Säule wurde kaum getestet). Ändere die Uhrzeit nur, wenn Beiträge zu verschiedenen Zeiten liefen und die Zahlen einen Unterschied zeigen.
Nicht erlaubt und nicht deine Aufgabe: Marke, Inhaltsregeln, Preise, Säulen-Untergrenzen, alles aus CLAUDE.md. Ändere nichts, wenn die Daten kein klares Muster zeigen (kleine Stichprobe, Streuung). Behaupte nichts ohne Zahl.

Antworte NUR mit einem JSON-Objekt:
{"beobachtung": "...", "beleg": "mit konkreten Zahlen aus den Daten", "entscheidung": "...", "aenderungen": [] oder [{"pfad": "feed.uhrzeit", "wert": "19:30", "grund": "..."}], "naechster_test": "was in den nächsten zwei Wochen geprüft wird"}`

const antwort = extrahiereJson(await frageClaude(prompt))
if (!antwort || !antwort.beobachtung || !/\d/.test(antwort.beleg || '')) throw new Error('Denk-Lauf: Antwort unbrauchbar (ohne Beleg mit Zahlen).')

const angewendet = []
const wunsch = Array.isArray(antwort.aenderungen) ? antwort.aenderungen : antwort.aenderung ? [antwort.aenderung] : []
for (const a of wunsch.slice(0, MAX_AENDERUNGEN)) {
  const { pfad, wert } = a || {}
  if (!ERLAUBT[pfad] || !ERLAUBT[pfad](wert)) { console.log(`Änderung ${pfad} = ${JSON.stringify(wert)} abgelehnt (nicht erlaubt oder ungültig).`); continue }
  const teile = pfad.split('.')
  let ziel = params
  for (const t of teile.slice(0, -1)) ziel = ziel[t] ||= {}
  ziel[teile.at(-1)] = wert
  angewendet.push(`${pfad} = ${JSON.stringify(wert)}`)
}
if (wunsch.length > MAX_AENDERUNGEN) console.log(`Nur die ersten ${MAX_AENDERUNGEN} Änderungen berücksichtigt.`)
// Gewichte nach Claude-Änderungen wieder auf Summe 1 und in die Grenzen bringen
for (const m of ['saeule', 'hook_stil']) if (params.gewichte?.[m]) params.gewichte[m] = begrenze(params.gewichte[m], GRENZEN[m])
speichereParams()
verlaufOptimierer()

const eintrag = `\n## ${datum}: ${antwort.beobachtung.slice(0, 80)}\n- Beobachtung: ${antwort.beobachtung}\n- Beleg: ${antwort.beleg}\n- Entscheidung: ${antwort.entscheidung} (${angewendet.length ? angewendet.join(', ') : 'keine Änderung durch den Denk-Lauf'}; Optimierer: ${optText})\n- Nächster Test: ${antwort.naechster_test || 'offen'}\n`
console.log(eintrag)
if (!trocken) fs.appendFileSync(path.join(ROOT, 'learnings.md'), eintrag)
