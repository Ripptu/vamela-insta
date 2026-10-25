// Meldet neue Instagram-Nachrichten per Telegram, jeweils mit einem Antwortvorschlag zum Kopieren (Claude über das Abo).
// Christian antwortet selbst; der Bot schickt nie eine Antwort ab.
import { lade, speichere } from './daten.mjs'
import * as tg from './telegram.mjs'
import { frageClaude } from '../claude.mjs'

const log = (...a) => console.log(new Date().toISOString(), ...a)
const z = lade()
if (!z.vorschlaege_offen.length) process.exit(0)
if (!tg.bereit()) { log('TELEGRAM_AKQUISE_TOKEN fehlt.'); process.exit(0) }

for (const n of [...z.vorschlaege_offen]) {
  let vorschlag = ''
  try {
    vorschlag = (await frageClaude(`Christian (VAMELA, Webdesign und Grafikdesign für kleine Betriebe aus Haag an der Amper, Landkreis Freising) bekommt diese Instagram-Nachricht von @${n.von}${n.lead ? ` (Betrieb ${n.lead}, den er wegen eines kostenlosen Website-Entwurfs angeschrieben hat)` : ''}:
"""${n.text}"""
Schreib eine kurze Antwort in Christians Namen, Du-Form, freundlich, bayerisch-bodenständig, höchstens 400 Zeichen. Keine Preise, Termine oder Zusagen erfinden; wenn nötig, nachfragen (z. B. Website-Adresse, was der Betrieb macht, Telefonnummer für einen kurzen Anruf). Kein Emoji, keine Floskeln. Gib nur den Antworttext zurück.`, { timeoutMs: 300_000 })).trim()
  } catch (e) { log(`Kein Vorschlag (${e.message})`) }
  await tg.sende(z, `<b>Neue Nachricht von @${tg.html(n.von)}</b>${n.lead ? ` (${tg.html(n.lead)})` : ''}\n\n„${tg.html(n.text)}“\n\n👉 <a href="https://ig.me/m/${n.von}">Chat öffnen</a>${vorschlag ? '\n⬇️ Antwortvorschlag darunter lange drücken, Kopieren' : ''}`)
  if (vorschlag) await tg.sendeKopiertext(z, vorschlag)
  z.vorschlaege_offen.shift()
  speichere(z)
}
log('Vorschläge gesendet')
