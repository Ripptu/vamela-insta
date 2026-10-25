// Tagesliste: werktags ab 9:00 (Berlin) einmal 10 fertige Kalt-DMs plus fällige Nachfass-DMs per Telegram.
// Absenden macht Christian selbst (Instagram erlaubt per API keine DMs an Leute, die nicht zuerst geschrieben haben).
// Aufruf: node automatik/akquise/tagesliste.mjs [--jetzt] [--trocken]
import { lade, speichere } from './daten.mjs'
import { holeBetriebe } from './leads.mjs'
import { pruefeWebsite } from './pruefen.mjs'
import * as tg from './telegram.mjs'
import { frageClaude, extrahiereJson } from '../claude.mjs'
import { berlin } from '../zeit.mjs'

const args = process.argv.slice(2)
const jetztErzwingen = args.includes('--jetzt')
const trocken = args.includes('--trocken')
const nurPruefen = args.includes('--pruefen')
const erneut = args.includes('--heute-erneut') // heutige Leads noch einmal neu schreiben und schicken (Test der Formatierung) // für den Workflow: ist heute eine Liste fällig? (dann erst Claude installieren)
const PRO_TAG = 10
const SCHWELLE = 90 // nur Seiten unter diesem Wert anschreiben (Stichprobe 25.10.2026: schwache Seiten verlinken selten Instagram)
const NACHFASS_TAGE = 5
const log = (...a) => console.log(new Date().toISOString(), ...a)

const b = berlin()
if (!jetztErzwingen) {
  if (b.wochentag === 0 || b.wochentag === 6) { log('Wochenende, keine Liste.'); process.exit(0) }
  if (b.stunde < 9) { log('Vor 9:00, noch keine Liste.'); process.exit(0) }
}
const z = lade()
if (z.letzte_liste === b.datum && !jetztErzwingen) { log('Liste für heute schon gesendet.'); process.exit(0) }
if (nurPruefen) {
  const fs = await import('node:fs')
  if (process.env.GITHUB_OUTPUT && tg.bereit()) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'liste=true\n')
  log('Liste fällig.'); process.exit(0)
}
if (!tg.bereit()) { log('TELEGRAM_AKQUISE_TOKEN fehlt, keine Liste.'); process.exit(0) }

// Betriebe einmal pro Woche neu laden
if (!z.pool_am || Date.now() - new Date(z.pool_am).getTime() > 7 * 864e5 || !z.pool.length) {
  try { z.pool = await holeBetriebe(); z.pool_am = new Date().toISOString(); log(`${z.pool.length} Betriebe aus OpenStreetMap`); if (!trocken) speichere(z) } catch (e) { log(`Overpass: ${e.message}`) }
}

if (erneut) for (const l of Object.values(z.leads)) if (l.gesendet_am === b.datum) { l.status = 'kandidat'; delete l.gesendet_am }
// Kandidaten prüfen, bis 10 schwache Seiten mit Instagram-Profil gefunden sind (höchstens 80 Prüfungen pro Tag)
const offen = z.pool.filter((p) => !z.leads[p.id])
const neu = erneut ? Object.entries(z.leads).filter(([, l]) => l.status === 'kandidat') : []
let geprueft = 0
for (let i = 0; !erneut && i < offen.length && neu.length < PRO_TAG && geprueft < 80; i += 8) {
  const block = offen.slice(i, i + 8)
  const erg = await Promise.all(block.map((p) => pruefeWebsite(p.website).catch(() => null)))
  geprueft += block.length
  block.forEach((p, k) => {
    const e = erg[k]
    if (!e) return
    const ig = p.instagram ? String(p.instagram).replace(/^@/, '').split(/[/?]/).pop().toLowerCase() : e.instagram
    const lead = { name: p.name, website: p.website, ort: p.ort, branche: p.branche, ig, punkte: e.punkte, befunde: e.befunde, geprueft_am: b.datum }
    if (!ig) lead.status = 'kein_insta'
    else if (!e.erreichbar || e.punkte >= SCHWELLE || !e.befunde.length) lead.status = 'gut_genug'
    else { lead.status = 'kandidat'; neu.push([p.id, lead]) }
    z.leads[p.id] = lead
  })
}
neu.sort((a, c) => a[1].punkte - c[1].punkte)
const heute = neu.slice(0, PRO_TAG)
log(`${geprueft} Websites geprüft, ${neu.length} Kandidaten, ${heute.length} für heute`)

// DMs schreiben lassen (ein Claude-Lauf für alle), sonst Vorlage
const vorlage = (l) => `Hi, hier ist Christian von VAMELA aus Haag an der Amper 👋\n\nIch hab mir eure Website angeschaut und mir ist aufgefallen:\n${l.befunde.slice(0, 2).map((x) => '• ' + x).join('\n')}\n\nSoll ich euch unverbindlich einen kostenlosen Entwurf zeigen, wie eure Startseite aussehen könnte?\n\nViele Grüße\nChristian`
let texte = {}
if (heute.length) {
  try {
    const antwort = await frageClaude(`Schreib für jeden Betrieb unten eine kurze Instagram-DM von Christian (VAMELA, Webdesign aus Haag an der Amper, Landkreis Freising).
Regeln: Du-Form. Höchstens 500 Zeichen. Gut lesbar am Handy, mit Absätzen (Leerzeile dazwischen):\n1. Absatz: Gruß und Christian stellt sich in einem Halbsatz vor.\n2. Absatz: „Mir ist bei eurer Website aufgefallen:“ und darunter 1 bis 2 der gemessenen Befunde als kurze Zeilen mit „• “ am Anfang, sachlich und ohne zu übertreiben.\n3. Absatz: Angebot eines kostenlosen, unverbindlichen Entwurfs als Frage.\n4. Absatz: „Viele Grüße“ und in der nächsten Zeile „Christian“.\nNur die genannten Befunde verwenden, nichts erfinden, keine Zahlen außer den genannten. Kein Link, höchstens ein Emoji (👋 im Gruß), kein Druck, keine Floskeln wie „Ich hoffe, es geht dir gut“, kein „Hallo zusammen“. Klingt wie ein echter Mensch aus Bayern, nicht wie Werbung. Zeilenumbrüche im JSON als \\n.
Gib NUR JSON zurück: {"<id>": "<DM-Text>", ...}

${heute.map(([id, l]) => `${id}: ${l.name} (${l.branche}${l.ort ? ', ' + l.ort : ''}). Befunde: ${l.befunde.join(' | ')}`).join('\n')}`, { timeoutMs: 600_000 })
    texte = extrahiereJson(antwort) || {}
  } catch (e) { log(`Claude nicht verfügbar (${e.message}), nutze Vorlage`) }
}
for (const [id, l] of heute) {
  let t = String(texte[id] || '').trim()
  if (!t || t.length > 700 || /https?:\/\//.test(t)) t = vorlage(l)
  l.dm = t
}

// Fällige Nachfass-DMs
const nachfass = Object.entries(z.leads).filter(([, l]) => l.status === 'gesendet' && !l.antwort_am && !l.nachfass_am && l.gesendet_am && (new Date(b.datum) - new Date(l.gesendet_am)) / 864e5 >= NACHFASS_TAGE)
const nachfassText = (l) => `Hi nochmal 👋\n\nKurz nachgefragt wegen ${l.name}: Soll ich dir den kostenlosen Entwurf machen?\n\nWenn kein Interesse, alles gut, dann melde ich mich nicht mehr.\n\nViele Grüße\nChristian`

if (trocken) {
  for (const [id, l] of heute) log(`[trocken] ${l.name} @${l.ig} (${l.punkte}): ${l.dm}`)
  log(`[trocken] ${nachfass.length} Nachfass-DMs fällig`)
  process.exit(0)
}

if (!heute.length && !nachfass.length) { log('Heute keine Leads.'); z.letzte_liste = b.datum; speichere(z); process.exit(0) }
await tg.sende(z, `<b>Akquise ${b.datum.split('-').reverse().join('.')}</b>\n${heute.length} neue DMs${nachfass.length ? ` und ${nachfass.length} Nachfass-DMs` : ''}. Je Betrieb zwei Nachrichten: oben der Link zum Chat, darunter der DM-Text zum Kopieren.`)
let n = 0
for (const [id, l] of heute) {
  n++
  await tg.sende(z, `<b>${n}/${heute.length} · ${tg.html(l.name)}</b>\n${tg.html(l.branche)}${l.ort ? ' · ' + tg.html(l.ort) : ''}\n🌐 ${tg.html(l.website)}\n\n👉 <a href="https://ig.me/m/${l.ig}">Chat mit @${l.ig} öffnen</a>\n⬇️ Text darunter lange drücken, Kopieren`)
  await tg.sendeKopiertext(z, l.dm)
  l.status = 'gesendet'
  l.gesendet_am = b.datum
}
for (const [, l] of nachfass) {
  await tg.sende(z, `<b>Nachfassen · ${tg.html(l.name)}</b>\n👉 <a href="https://ig.me/m/${l.ig}">Chat mit @${l.ig} öffnen</a>\n⬇️ Text darunter lange drücken, Kopieren`)
  await tg.sendeKopiertext(z, nachfassText(l))
  l.nachfass_am = b.datum
}
z.letzte_liste = b.datum
speichere(z)
log(`Liste gesendet: ${heute.length} neu, ${nachfass.length} Nachfassen`)
