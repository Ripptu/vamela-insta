// Wochenbericht per Gmail (SMTP, App-Passwort). Aufruf: node automatik/bericht.mjs [--trocken]
// Inhalt: Follower-Verlauf (14 Tage), Veröffentlichtes der Woche mit Kennzahlen, beste und schwächste Beiträge nach
// Wachstumswert, was der Optimierer und der Denk-Lauf geändert haben, Puffer, Probleme, letzte Erkenntnis.
import fs from 'node:fs'
import path from 'node:path'
import nodemailer from 'nodemailer'
import { ladeQueue } from './queue.mjs'
import { zaehlePuffer } from './puffer-zaehlen.mjs'
import { berlin } from './zeit.mjs'
import { ladeHistorie, MAX_REPARATUREN } from './reparatur-historie.mjs'
import { beobachtungen, rangliste } from './optimierer.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const trocken = process.argv.includes('--trocken')
const liesJson = (f, d) => (fs.existsSync(path.join(ROOT, f)) ? JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')) : d)
const q = await ladeQueue()
const mw = liesJson('data/messwerte.json', { konto: [], beitraege: {} })
const verlauf = liesJson('data/optimierer-verlauf.json', [])
const vor7 = new Date(Date.now() - 7 * 864e5).toISOString()
const vor7Datum = berlin(new Date(Date.now() - 7 * 864e5)).datum
const woche = q.filter((x) => x.status === 'veroeffentlicht' && x.ig?.am >= vor7)
const letzter = (b) => b.verlauf[b.verlauf.length - 1] || {}
const zeile = (x) => {
  const b = Object.values(mw.beitraege).find((m) => m.id === x.id)
  const l = b ? letzter(b) : {}
  const kennz = ['reach', 'views', 'follows', 'profile_visits', 'shares', 'saved', 'likes', 'kommentare'].filter((k) => l[k] != null).map((k) => `${k} ${l[k]}`).join(', ')
  return `- ${x.titel} (${x.typ}, ${x.saeule || '?'}/${x.hook_stil || '?'}, ${x.ig.permalink})${kennz ? ': ' + kennz : ''}${l.wachstumswert != null ? `, Wachstumswert ${l.wachstumswert}` : ''}`
}
const k = mw.konto
const fol = k.length ? k[k.length - 1].follower : null
const fol7 = k.length > 1 ? k[Math.max(0, k.length - 8)].follower : null
const kurve = k.slice(-14).map((x) => `${x.datum.slice(5)} ${x.follower}`).join(' · ')
const params = liesJson('plan/params.json', {})
const bereit = zaehlePuffer(q, params).feed
const fehler = q.filter((x) => ['fehler', 'abgelehnt', 'unklar'].includes(x.status))
const aufgegeben = q.filter((x) => x.status === 'aufgegeben')
const histWoche = ladeHistorie().filter((h) => h.am >= vor7)
const repariertWoche = histWoche.filter((h) => h.ergebnis !== 'gescheitert').length
const naechste = q.filter((x) => x.status === 'geprueft').slice(0, 5)
const learn = fs.existsSync(path.join(ROOT, 'learnings.md')) ? fs.readFileSync(path.join(ROOT, 'learnings.md'), 'utf8').split('\n## ').slice(-1)[0].slice(0, 900) : ''
const { beste, schwaechste } = rangliste(beobachtungen(mw), { oben: 3, unten: 3 })
const rang = (b) => `- ${b.titel || b.id} (${b.merkmale.saeule ?? '?'}/${b.merkmale.hook_stil ?? '?'}, ${b.merkmale.format ?? '?'}): Wachstumswert ${b.wert}, ${b.follows} Follower bei ${b.reach} Reichweite`
const optWoche = verlauf.filter((v) => v.datum >= vor7Datum)
const optZeilen = optWoche.flatMap((v) => v.aenderungen.map((a) => `- ${v.datum}: ${a.merkmal} ${a.wert} ${a.von ?? '–'} → ${a.nach} (n=${a.n})`))
const zeilen = [
  `Wochenbericht @vamela.de, ${berlin().datum}`,
  '',
  `Follower: ${fol ?? 'noch keine Messung'}${fol != null && fol7 != null ? ` (${fol - fol7 >= 0 ? '+' : ''}${fol - fol7} in 7 Tagen)` : ''}`,
  ...(kurve ? [`Verlauf: ${kurve}`] : []),
  '',
  `Veröffentlicht in den letzten 7 Tagen: ${woche.length}`,
  ...woche.map(zeile),
  '',
  'Beste Beiträge (Wachstumswert = Follower, Profilbesuche, Teilen, Speichern je 100 erreichte Konten):',
  ...(beste.length ? beste.map(rang) : ['- noch keine auswertbaren Beiträge']),
  ...(schwaechste.length ? ['Schwächste Beiträge:', ...schwaechste.map(rang)] : []),
  '',
  'Optimierer und Denk-Lauf diese Woche:',
  ...(optZeilen.length ? optZeilen : [optWoche.length ? '- keine Gewichtsänderung (zu wenig Daten oder kein Unterschied)' : '- kein Lauf']),
  `Aktuelle Säulen-Gewichte: ${JSON.stringify(params.gewichte?.saeule || {})}`,
  '',
  `Puffer: ${bereit} geprüfte Beiträge bereit.`,
  ...(bereit < (params.puffer_min || 10) ? [`ACHTUNG: Puffer unter ${params.puffer_min || 10}. Ohne Renderer (Gestaltung noch nicht gewählt) entsteht nichts Neues.`] : []),
  ...(histWoche.length ? ['', `Automatisch repariert in den letzten 7 Tagen: ${repariertWoche} von ${histWoche.length} Versuchen (je Beitrag höchstens ${MAX_REPARATUREN}).`] : []),
  ...(aufgegeben.length ? ['', `Aufgegeben nach ${MAX_REPARATUREN} Reparaturen (zählen nicht zum Puffer, Ersatz wird geschrieben):`, ...aufgegeben.map((x) => `- ${x.id} ${x.titel} (${x.typ}, ${x.saeule || '?'}): ${String(x.aufgegeben?.grund || x.fehler || (x.qa?.gruende || []).join('; ')).slice(0, 400)}`)] : []),
  ...(fehler.length ? ['', 'Probleme:', ...fehler.map((x) => `- ${x.id} ${x.titel}: ${x.status}${x.reparaturen ? ` (Reparatur ${x.reparaturen}/${MAX_REPARATUREN})` : ''} ${x.fehler || (x.qa?.gruende || []).join('; ')}`)] : []),
  '',
  'Als Nächstes geplant:',
  ...naechste.map((x) => `- ${x.titel} (${x.typ}, ${x.saeule || '?'})`),
  '',
  'Letzte Erkenntnis:',
  learn.trim(),
]
const text = zeilen.join('\n')
console.log(text)
if (!trocken) {
  // Kopie für die App (Ansicht „Berichte“)
  const dir = path.join(ROOT, 'data/berichte')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${berlin().datum}.txt`), text)
  const idxF = path.join(dir, 'index.json')
  const idx = fs.existsSync(idxF) ? JSON.parse(fs.readFileSync(idxF, 'utf8')) : []
  if (!idx.includes(berlin().datum)) idx.push(berlin().datum)
  fs.writeFileSync(idxF, JSON.stringify(idx))
}
if (trocken) process.exit(0)
const { GMAIL_USER, GMAIL_APP_PASSWORD, REPORT_TO } = process.env
if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !REPORT_TO) { console.log('Mail-Zugang fehlt, kein Versand.'); process.exit(1) }
const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD.replace(/\s/g, '') } })
await t.sendMail({ from: `VAMELA Insta <${GMAIL_USER}>`, to: REPORT_TO, subject: `VAMELA Insta: Wochenbericht ${berlin().datum}`, text })
console.log('Bericht gesendet.')
