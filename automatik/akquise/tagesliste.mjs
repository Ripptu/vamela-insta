// Tagesliste: werktags ab 9:00 (Berlin) einmal 10 fertige Kalt-DMs per Telegram.
// Absenden macht Christian selbst (Instagram erlaubt per API keine DMs an Leute, die nicht zuerst geschrieben haben).
// Seit 9.11.2026 schreibt Claude jede DM einzeln (schreiben.mjs) und es gibt keine Nachfass-DMs mehr (Christian: „komplett rauslassen“).
// Aufruf: node automatik/akquise/tagesliste.mjs [--jetzt] [--trocken] [--eine]
//   --eine: eine einzige Test-DM per Telegram, ändert nichts am gespeicherten Zustand.
import { lade, speichere } from './daten.mjs'
import { holeBetriebe } from './leads.mjs'
import { pruefeWebsite } from './pruefen.mjs'
import * as tg from './telegram.mjs'
import { schreibeDm } from './schreiben.mjs'
import { berlin } from '../zeit.mjs'

const args = process.argv.slice(2)
const test = args.includes('--eine')
const jetztErzwingen = args.includes('--jetzt') || test
const trocken = args.includes('--trocken')
const nurPruefen = args.includes('--pruefen') // für den Workflow: ist heute eine Liste fällig? (dann erst Claude installieren)
const erneut = args.includes('--heute-erneut') // heutige Leads noch einmal neu schreiben und schicken
const PRO_TAG = test ? 1 : 10
const SCHWELLE = 90 // nur Seiten unter diesem Wert anschreiben (Stichprobe 25.10.2026: schwache Seiten verlinken selten Instagram)
const log = (...a) => console.log(new Date().toISOString(), ...a)
const sichern = (z) => { if (!trocken && !test) speichere(z) }

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
if (!tg.bereit() && !trocken) { log('TELEGRAM_AKQUISE_TOKEN fehlt, keine Liste.'); process.exit(0) }

// Betriebe einmal pro Woche neu laden
if (!z.pool_am || Date.now() - new Date(z.pool_am).getTime() > 7 * 864e5 || !z.pool.length) {
  try { z.pool = await holeBetriebe(); z.pool_am = new Date().toISOString(); log(`${z.pool.length} Betriebe aus OpenStreetMap`); sichern(z) } catch (e) { log(`Overpass: ${e.message}`) }
}

if (erneut) for (const l of Object.values(z.leads)) if (l.gesendet_am === b.datum) { l.status = 'kandidat'; delete l.gesendet_am }
// Zuerst Kandidaten aus früheren Prüfungen, dann neue Websites prüfen (höchstens 80 pro Tag).
// Es werden mehr Kandidaten gesammelt als nötig, weil eine DM die Prüfung in schreiben.mjs verfehlen kann.
const ZIEL = PRO_TAG + (test ? 2 : 5)
const neu = Object.entries(z.leads).filter(([, l]) => l.status === 'kandidat')
const offen = erneut ? [] : z.pool.filter((p) => !z.leads[p.id])
let geprueft = 0
for (let i = 0; i < offen.length && neu.length < ZIEL && geprueft < 80; i += 8) {
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
    if (!test) z.leads[p.id] = lead
  })
}
neu.sort((a, c) => a[1].punkte - c[1].punkte)
log(`${geprueft} Websites geprüft, ${neu.length} Kandidaten`)

// Jede DM einzeln schreiben, bis PRO_TAG Nachrichten alle Prüfungen bestehen
const heute = []
const begonnen = []
for (const [id, l] of neu) {
  if (heute.length >= PRO_TAG) break
  try {
    const r = await schreibeDm(l, { schonBegonnen: begonnen, log })
    l.dm = r.nachricht
    l.dm_zitat = r.zitat
    begonnen.push(r.nachricht.split('\n')[0])
    heute.push([id, l])
    log(`DM für ${l.name} geschrieben (Versuch ${r.versuche})`)
  } catch (e) {
    log(`Keine DM für ${l.name}: ${e.message}`)
    if (!test && !/Claude-CLI|Zeitüberschreitung|Claude-Fehler|nicht lesbar/.test(e.message)) l.status = 'dm_fehler'
  }
}
log(`${heute.length} DMs für heute`)

if (trocken) {
  for (const [, l] of heute) log(`[trocken] ${l.name} @${l.ig} (${l.punkte}), Detail „${l.dm_zitat}“:\n${l.dm}\n`)
  process.exit(0)
}

if (!heute.length) { log('Heute keine Leads.'); if (!test) { z.letzte_liste = b.datum; sichern(z) }; process.exit(0) }
const kopf = test
  ? `<b>Test-DM ${b.datum.split('-').reverse().join('.')}</b>\nNur zum Ansehen, dieser Betrieb ist nicht als angeschrieben vermerkt.`
  : `<b>Akquise ${b.datum.split('-').reverse().join('.')}</b>\n${heute.length} neue DMs. Je Betrieb zwei Nachrichten: oben der Link zum Chat, darunter der DM-Text zum Kopieren.`
await tg.sende(z, kopf)
let n = 0
for (const [, l] of heute) {
  n++
  await tg.sende(z, `<b>${n}/${heute.length} · ${tg.html(l.name)}</b>\n${tg.html(l.branche)}${l.ort ? ' · ' + tg.html(l.ort) : ''}\n🌐 ${tg.html(l.website)}\n\n👉 <a href="https://ig.me/m/${l.ig}">Chat mit @${l.ig} öffnen</a>\n⬇️ Text darunter lange drücken, Kopieren`)
  await tg.sendeKopiertext(z, l.dm)
  if (!test) { l.status = 'gesendet'; l.gesendet_am = b.datum }
}
if (!test) { z.letzte_liste = b.datum; sichern(z) }
log(`${test ? 'Test-DM' : 'Liste'} gesendet: ${heute.length}`)
