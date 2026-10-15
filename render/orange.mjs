// Look „Orange“: gemeinsame Bausteine für render/karussell.mjs und render/story.mjs.
// Vorlage: website/vamela-social/insta-entwuerfe (orange.css, posts.mjs, png/v1–v14), von Christian freigegeben am 12.10.2026.
//
// Familien
//   nacht  schwarz mit Glut: KI-Bild unten, Verlauf von oben, weiße Schrift, Akzente als Orange-Verlauf oder kursive Serif
//   tag    hell: KI-Bildmetapher auf Orange/Weiß, schwarze Schrift oben links, zweite Zeile leicht (Schwarz) oder #D94300
//
// Akzent-Markup im Vorrat (docs/content-posts.md, Spalte „Text“; der Parser lässt es stehen, auf der Seite verschwindet es):
//   *wort*     Überschrift: kursive Serif (Instrument Serif)          Fließtext: fett
//   _wort_     Überschrift: Orange (Nacht als Verlauf, Tag #D94300)   Fließtext: fett
//   ==wort==   Überschrift: orange hinterlegt (Markierung wie v5)     Fließtext: fett
//   „Kopf / Rest“ in einer Textseite: Kopf wird die Überschrift, Rest der Fließtext. Ohne „ / “ ist der erste Satz die
//   Überschrift und der Rest der Fließtext. Beim Cover ist „Überschrift / Unterzeile“ schon bisher das Format.
// Ohne Markup setzt der Renderer die Akzente selbst: Nacht färbt das letzte Wort jeder Überschrift orange (bei der
// mittigen Cover-Fassung zusätzlich das vorletzte Wort kursiv-serif, wenn es in derselben Zeile steht); Tag setzt die
// zweite Zeile leicht bzw. orange, Fließtext mit mehreren Sätzen bekommt den letzten Satz fett.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import sharp from 'sharp'
import { pruefeSeite, aufwaermen, PruefFehler, HOEHE } from './pruefen.mjs'

const HERE = path.dirname(new URL(import.meta.url).pathname)
export const ORANGE_DIR = path.join(HERE, 'orange')
const BASIS = 'file://' + ORANGE_DIR + '/'
export const FAMILIEN = ['nacht', 'tag']
export const COVER_VORLAGEN = ['nacht-links', 'nacht-mitte', 'tag-orange', 'tag-schwarz']
const SAEULE_THEMA = { tipps: 'Tipp für Betriebe', werkzeuge: 'Gratis-Werkzeug', design: 'Gestaltung' }

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---------------------------------------------------------------------------------------------------------------------
// Text: Markup, Sätze, Zeilen
// ---------------------------------------------------------------------------------------------------------------------

const MARKUP = /(\*[^*\n]+\*|_[^_\n]+_|==[^=\n]+==)/
export const hatMarkup = (t) => MARKUP.test(String(t || ''))
export const ohneMarkup = (t) => String(t ?? '').replace(/\*([^*\n]+)\*/g, '$1').replace(/_([^_\n]+)_/g, '$1').replace(/==([^=\n]+)==/g, '$1')
const EMOJI = /\p{Extended_Pictographic}/u

/** Wörter mit Stil: [{ w, st: null|'ser'|'o'|'mark' }]. */
export function woerter(text) {
  const out = []
  for (const teil of String(text || '').split(MARKUP)) {
    if (!teil) continue
    let st = null, inhalt = teil
    if (/^\*[^*]+\*$/.test(teil)) { st = 'ser'; inhalt = teil.slice(1, -1) }
    else if (/^_[^_]+_$/.test(teil)) { st = 'o'; inhalt = teil.slice(1, -1) }
    else if (/^==[^=]+==$/.test(teil)) { st = 'mark'; inhalt = teil.slice(2, -2) }
    for (const w of inhalt.split(/\s+/).filter(Boolean)) out.push({ w, st })
  }
  return out
}

const ABK = /(^|\s)(z|d|u|o|bzw|ca|Nr|Dr|St|usw|inkl|ggf|evtl|vgl|bspw|[A-ZÄÖÜa-zäöü])\.$/
/** Teilt in Sätze (Abkürzungen wie „z. B.“ trennen nicht). */
export function saetze(text) {
  const t = String(text || '').trim()
  const out = []
  let start = 0
  const re = /[.!?…](?=\s+[A-ZÄÖÜ„"0-9*_=])/g
  let m
  while ((m = re.exec(t))) {
    const bis = m.index + 1
    if (ABK.test(t.slice(start, bis))) continue
    out.push(t.slice(start, bis).trim())
    start = bis
  }
  if (t.slice(start).trim()) out.push(t.slice(start).trim())
  return out
}

/** Überschrift und Fließtext einer Textseite: „Kopf / Rest“ oder erster Satz und Rest. */
export function kopfUndRumpf(text) {
  const t = String(text || '').trim()
  const i = t.indexOf(' / ')
  if (i > 0) return [t.slice(0, i).trim(), t.slice(i + 3).trim()]
  const s = saetze(t)
  return s.length > 1 ? [s[0], s.slice(1).join(' ')] : [t, '']
}

/**
 * Bricht Wörter in möglichst wenige, ausgeglichene Zeilen um: kleinste Zeilenzahl, bei der die längste Zeile höchstens
 * maxZeichen hat (höchstens maxZeilen), Verteilung so, dass die längste Zeile möglichst kurz ist.
 */
export function umbrechen(ws, { maxZeichen = 18, maxZeilen = 4 } = {}) {
  const n = ws.length
  if (!n) return []
  const len = (a, b) => ws.slice(a, b).reduce((s, x) => s + x.w.length, 0) + (b - a - 1)
  /** Kleinste mögliche Länge der längsten Zeile bei k Zeilen. */
  const minMax = (k) => {
    const dp = Array.from({ length: k + 1 }, () => Array(n + 1).fill(Infinity))
    dp[0][0] = 0
    for (let j = 1; j <= k; j++) for (let i = j; i <= n; i++) for (let a = j - 1; a < i; a++) dp[j][i] = Math.min(dp[j][i], Math.max(dp[j - 1][a], len(a, i)))
    return dp[k][n]
  }
  /** Bei gegebener Höchstlänge M die gleichmäßigste Verteilung (kleinste Quadratsumme der Zeilenlängen). */
  const verteile = (k, M) => {
    const dp = Array.from({ length: k + 1 }, () => Array(n + 1).fill(Infinity))
    const von = Array.from({ length: k + 1 }, () => Array(n + 1).fill(0))
    dp[0][0] = 0
    for (let j = 1; j <= k; j++) for (let i = j; i <= n; i++) for (let a = j - 1; a < i; a++) {
      const l = len(a, i)
      if (l > M) continue
      const v = dp[j - 1][a] + l * l
      if (v < dp[j][i]) { dp[j][i] = v; von[j][i] = a }
    }
    const zeilen = []
    for (let j = k, i = n; j > 0; i = von[j][i], j--) zeilen.unshift(ws.slice(von[j][i], i))
    return zeilen
  }
  const kMax = Math.min(maxZeilen, n)
  let k = 1
  while (k < kMax && minMax(k) > maxZeichen) k++
  let zeilen = verteile(k, minMax(k))
  // Kein kurzes Wort allein in einer Zeile („Eine / Schrift für / …“): lieber eine Zeile weniger, die etwas länger ist
  const waise = (z) => z.some((l) => l.length === 1 && l[0].w.length <= 4)
  if (k > 1 && waise(zeilen) && minMax(k - 1) <= maxZeichen + 5) zeilen = verteile(k - 1, minMax(k - 1))
  return zeilen
}

/** Wie umbrechen, aber jeder Satz beginnt eine neue Zeile (zwei kurze Sätze im Cover). */
export function umbrechenSaetze(ws, opt = {}) {
  const teile = []
  for (const x of ws) {
    if (!teile.length) teile.push([])
    teile.at(-1).push(x)
    if (/[.!?]$/.test(x.w) && x !== ws.at(-1) && x.w.length > 2) teile.push([])
  }
  if (teile.length < 2) return umbrechen(ws, opt)
  const max = opt.maxZeilen || 4
  const out = teile.flatMap((t) => umbrechen(t, { ...opt, maxZeilen: Math.max(1, max - teile.length + 1) }))
  return out.length <= max + 1 ? out : umbrechen(ws, opt)
}

/** HTML einer Zeile: aufeinanderfolgende Wörter gleichen Stils in einem span. */
export function zeileHtml(zeile, familie, { fliess = false } = {}) {
  const klasse = (st) => (fliess ? (st ? 'b' : null) : st === 'o' ? (familie === 'tag' ? 'oo' : 'o') : st)
  const gruppen = []
  for (const x of zeile) {
    const k = klasse(x.st)
    if (gruppen.length && gruppen.at(-1).k === k) gruppen.at(-1).w.push(x.w)
    else gruppen.push({ k, w: [x.w] })
  }
  return gruppen.map((g) => (g.k === 'b' ? `<b>${esc(g.w.join(' '))}</b>` : g.k ? `<span class=${g.k}>${esc(g.w.join(' '))}</span>` : esc(g.w.join(' ')))).join(' ')
}

/** Fließtext (Unterzeile, Textseite): Markup wird fett; ohne Markup und mit mehreren Sätzen wird der letzte Satz fett. */
export function fliessHtml(text, familie) {
  const t = String(text || '').trim()
  if (!t) return ''
  if (!hatMarkup(t)) {
    const s = saetze(t)
    if (s.length > 1) return `${esc(s.slice(0, -1).join(' '))} <b>${esc(s.at(-1))}</b>`
    return esc(t)
  }
  return zeileHtml(woerter(t), familie, { fliess: true })
}

// Schwache Schlusswörter: ein Akzent nur auf „sein.“ oder „aus.“ trägt nichts, dann beginnt er beim Wort davor
const SCHWACH = new Set(['das', 'dies', 'sie', 'ihn', 'uns', 'sein', 'ist', 'sind', 'war', 'hat', 'haben', 'wird', 'werden', 'kann', 'können', 'aus', 'an', 'ab', 'auf', 'ein', 'mit', 'nicht', 'nie', 'mehr', 'zu', 'da', 'los', 'her', 'hin', 'vor', 'nach', 'mal', 'es', 'du', 'dir', 'dich'])
const kern = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, '')

/** Nacht-Überschrift ohne Markup: letztes starkes Wort (mit schwachen Wörtern danach) orange, optional das Wort davor kursiv-serif. */
export function nachtAkzente(ws, { serif = false } = {}) {
  if (!ws.length || ws.some((x) => x.st)) return ws
  const out = ws.map((x) => ({ ...x }))
  let i = out.length - 1
  while (i > 0 && out.length - i < 3 && SCHWACH.has(kern(out[i].w))) i--
  for (let j = i; j < out.length; j++) out[j].st = 'o'
  const v = out[i - 1]
  if (serif && i >= 2 && v && kern(v.w).length >= 3 && !SCHWACH.has(kern(v.w)) && /^[\p{Ll}]/u.test(v.w) && !/[,.:;?!]$/.test(v.w)) v.st = 'ser'
  return out
}

/** Teilt eine Tag-Überschrift ohne Unterzeile in zwei Teile: an einem Satzzeichen nahe der Mitte, sonst ausgeglichen. */
export function zweiTeile(text) {
  const ws = woerter(text)
  if (ws.length < 3) return [ws, []]
  const gesamt = ohneMarkup(text).length
  let best = null
  ws.forEach((x, i) => {
    if (i < 1 || i >= ws.length - 2) return
    if (!/[,:;?!.–]$/.test(x.w)) return
    const pos = ws.slice(0, i + 1).reduce((s, y) => s + y.w.length + 1, 0)
    const d = Math.abs(pos - gesamt / 2)
    if (!best || d < best.d) best = { i, d }
  })
  if (best) return [ws.slice(0, best.i + 1), ws.slice(best.i + 1)]
  const [a, b] = umbrechen(ws, { maxZeichen: 0, maxZeilen: 2 })
  return [a, b || []]
}

// ---------------------------------------------------------------------------------------------------------------------
// Familie, Vorlage, Thema
// ---------------------------------------------------------------------------------------------------------------------

/** Familie aus dem Feld `familie:`; sonst Werkzeuge nacht, Design tag, Tipps im Wechsel nach Nummer. */
export function familieVon(x) {
  const f = String(x.familie || '').toLowerCase().trim()
  if (FAMILIEN.includes(f)) return f
  if (x.saeule === 'werkzeuge') return 'nacht'
  if (x.saeule === 'design') return 'tag'
  return (x.nr || 0) % 2 ? 'nacht' : 'tag'
}

/** Cover-Vorlage (Merkmal für den Optimierer): aus `Cover-Vorlage:` im Vorrat, sonst im Wechsel nach Nummer. */
export function coverVorlage(x, familie) {
  const v = String(x.cover_vorlage || '').toLowerCase().trim()
  if (COVER_VORLAGEN.includes(v) && v.startsWith(familie)) return v
  const wechsel = Math.floor((x.nr || 0) / 2) % 2
  return familie === 'nacht' ? (wechsel ? 'nacht-mitte' : 'nacht-links') : (wechsel ? 'tag-schwarz' : 'tag-orange')
}

/** Text der Pille auf den Innenseiten: kurzer Titel, sonst die Säule. */
export function thema(x) {
  const t = ohneMarkup(x.thema || x.titel || '').trim()
  if (t && t.length <= 26) return t
  return SAEULE_THEMA[x.saeule] || 'VAMELA'
}

/** Beschriftung des Knopfs bzw. der Pille auf der Schlussseite. */
export function ctaLabel(text, angebot) {
  if (angebot && !/^keins$/i.test(angebot)) return 'Link in der Bio'
  const t = ohneMarkup(text)
  if (/speicher/i.test(t)) return 'Speichern'
  if (/schick|teil/i.test(t)) return 'Teilen'
  if (/kommentar|kommentier|schreib|verrat|erzähl|sag mir/i.test(t)) return 'Kommentieren'
  return 'Folgen'
}

// ---------------------------------------------------------------------------------------------------------------------
// Seiten
// ---------------------------------------------------------------------------------------------------------------------

/** Mittlere Farbe der obersten Bildzeilen, damit ein nach unten verschobenes Bild oben nahtlos weiterläuft. */
export async function randFarbe(datei) {
  const meta = await sharp(datei).metadata()
  const { channels } = await sharp(datei).extract({ left: 0, top: 0, width: meta.width, height: Math.min(6, meta.height) }).stats()
  return { farbe: `rgb(${channels.slice(0, 3).map((c) => Math.round(c.mean)).join(',')})`, hoehe: Math.round((1080 * meta.height) / meta.width) }
}

const fussNacht = (links = '') => `<div class=fuss>${links}<span class=r><i class=pfeil></i>vamela.de</span></div>`
const fussTag = '<div class=fuss><span>@vamela.de<small>Webdesign &amp; Grafik</small></span><span class=r style="text-align:right;display:block">VAMELA<small>aus Freising</small></span></div>'
const logo = (familie) => `<img class=logo src="${BASIS}logo.png" alt=""${familie === 'tag' ? ' style="filter:invert(1)"' : ''}>`

/** Überschrift als Zeilen-HTML. zeilen: Liste von Wortlisten; klasse(i) gibt die Zusatzklasse je Zeile. */
const zeilenHtml = (zeilen, familie, klasse = () => '') =>
  zeilen.map((z, i) => { const k = klasse(i); const h = zeileHtml(z, familie); return k ? `<span class="${k}">${h}</span>` : h }).join('<br>')

/**
 * Gegenmaßnahmen, wenn eine Prüfung durchfällt. Eine Stufe ist { v1, y, stark }:
 *   v1     Verlauf hinter Text und Fußzeile kräftiger bzw. Bildstreifen abgeschwächt (hilft nur gegen zu wenig Kontrast)
 *   y      Bild so viele px von oben nach unten geschoben (statt unten bündig), oben mit der gemessenen Randfarbe gefüllt
 *          und weich ausgeblendet (hilft gegen Kontrast und gegen „Text auf Motiv“)
 *   stark  Textfarben kräftiger (nur Kontrast)
 * Die Reihenfolge ist die Reihenfolge der Versuche; Stufen mit v1/stark werden nur versucht, wenn schon einmal der Kontrast
 * durchgefallen ist (sonst könnte der Verlauf ein Motiv unter dem Text nur zudecken, statt Platz zu schaffen).
 */
export const STUFEN_BILD = [{}, { v1: true }, { v1: true, stark: true }, { y: 140 }, { y: 140, v1: true }, { y: 140, v1: true, stark: true }, { y: 260 }, { y: 260, v1: true, stark: true }, { y: 340, v1: true, stark: true }, { y: 420, v1: true, stark: true }]
export const STUFEN_STREIFEN = [{}, { v1: true }, { v1: true, stark: true }]
export const STUFEN_FLAECHE = [{}, { stark: true }]
const stufeName = (st) => [st.y ? `Bild ${st.y} px nach unten (oben Randfarbe)` : null, st.v1 ? 'Verlauf verstärkt bzw. Bildstreifen abgeschwächt' : null, st.stark ? 'Textfarbe kräftiger' : null].filter(Boolean)

/**
 * Baut das vollständige HTML einer Seite.
 * spec: { format: 'feed'|'story', familie, bild?: { datei, farbe, hoehe }, grund: 'bild'|'glut'|'hell', inhalt, fuss }
 */
export function seiteHtml(spec, st = {}) {
  const H = HOEHE[spec.format]
  const klassen = ['s', spec.familie, spec.format, spec.grund === 'bild' && 'cover', st.v1 && 'v1', st.stark && 'stark'].filter(Boolean).join(' ')
  let grund = '', stil = ''
  if (spec.grund === 'bild' && spec.bild) {
    // Natürlich unten bündig; die Story ist höher als das Bild, dort ist oben immer Randfarbe
    // vollbild (TikTok 9:16): das Bild füllt die ganze Höhe und wird seitlich beschnitten; erst die Gegenmaßnahmen schieben es nach unten
    const voll = spec.vollbild && st.y == null
    const top = st.y != null ? st.y : voll ? 0 : H - spec.bild.hoehe
    const verschoben = top > 0
    const maske = verschoben ? ';-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 160px);mask-image:linear-gradient(180deg,transparent 0,#000 160px)' : ''
    const groesse = voll ? `;left:50%;width:auto;height:${H}px;max-width:none;transform:translateX(-50%)` : ''
    grund = `<img class=bild src="file://${spec.bild.datei}" alt="" style="bottom:auto;top:${top}px${maske}${groesse}"><div class=verlauf></div><div class=fussverlauf></div>`
    stil = ` style="--rand-farbe:${spec.bild.farbe};${verschoben ? `background:${spec.bild.farbe}` : ''}"`
  } else if (spec.grund === 'hell') grund = '<div class=hell></div>'
  else grund = '<div class=glut></div>'
  return `<!doctype html><html><head><meta charset=utf-8><base href="${BASIS}"><link rel=stylesheet href=orange.css>` +
    `<style>html,body{height:${H}px}</style><script src=orange.js defer></script></head>` +
    `<body><div class="${klassen}"${stil}>${grund}${logo(spec.familie)}${spec.inhalt}${spec.fuss}</div></body></html>\n`
}

/** Cover: Bild + Überschrift (+ Unterzeile). */
export function coverSpec({ familie, vorlage, head, sub, bild, format = 'feed', vollbild = false }) {
  let inhalt
  if (vollbild) {
    // TikTok-Cover als Hingucker (Christian, 13.10.2026): nur der Aufhänger, sehr groß; die Auflösung kommt auf den nächsten Bildern
    const [a] = zweiTeile(head)
    const aufhaenger = (a.length ? a : woerter(head))
    const zeilen = umbrechen(aufhaenger, { maxZeichen: 18, maxZeilen: 3 })
    inhalt = `<div class=inhalt style="top:300px"><h1 class="h1 riesig" data-fit="150,84">${zeilenHtml(zeilen, familie, (i) => (i === zeilen.length - 1 ? (familie === 'tag' ? 'zwei oo' : '') : ''))}</h1>` +
      `<p class="sub wisch" style="margin-top:36px;font-weight:600">Wisch nach links</p></div>`
    return { format, familie, bild, grund: 'bild', inhalt, fuss: '', vollbild }
  }
  if (familie === 'nacht') {
    const mitte = vorlage === 'nacht-mitte'
    const zeilen = umbrechenSaetze(nachtAkzente(woerter(head), { serif: mitte }), { maxZeichen: 21, maxZeilen: 4 })
    const unter = sub ? `<p class="sub${mitte ? ' mitte' : ''}" style="max-width:${mitte ? 720 : 640}px">${fliessHtml(sub, familie)}</p>` : ''
    inhalt = `<div class="inhalt${mitte ? ' mitte' : ''}" style="top:${format === 'story' ? 340 : 160}px;--abstand:30px">` +
      `<h1 class="h1${mitte ? ' mitte' : ''}" data-fit="112,60">${zeilenHtml(zeilen, familie)}</h1>${unter}</div>`
  } else {
    const [a, b] = sub ? [woerter(head), woerter(sub)] : zweiTeile(head)
    const za = umbrechen(a, { maxZeichen: 20, maxZeilen: 3 })
    const zb = b.length ? umbrechen(b, { maxZeichen: 24, maxZeilen: 3 }) : []
    const zweite = vorlage === 'tag-schwarz' ? 'zwei w' : 'zwei oo'
    inhalt = `<div class=inhalt style="top:${format === 'story' ? 340 : 170}px"><h1 class=h1 data-fit="96,56">` +
      `${zeilenHtml([...za, ...zb], familie, (i) => (i >= za.length ? zweite : ''))}</h1></div>`
  }
  // Vollbild (TikTok): keine Fußzeile, dort liegen Beschreibung und Musikzeile von TikTok darüber
  // Story (Hero-Look, Christian 15.10.2026): auch ohne Fußzeile, Instagram zeigt Profilbild und Namen oben; unten liegt das Gesicht
  return { format, familie, bild, grund: 'bild', inhalt, fuss: vollbild || format === 'story' ? '' : familie === 'tag' ? fussTag : fussNacht(), vollbild }
}

/** Überschrift einer Innenseite, Story oder Schlussseite als Zeilen-HTML (Nacht: Akzent orange, Tag: zweiter Teil orange). */
function kopfHtml(kopf, familie, { maxZeichen = 15, maxZeilen = 5, serif = false } = {}) {
  const ws = woerter(kopf)
  if (familie === 'nacht') return zeilenHtml(umbrechen(nachtAkzente(ws, { serif }), { maxZeichen, maxZeilen }), familie)
  if (ws.some((x) => x.st)) return zeilenHtml(umbrechen(ws, { maxZeichen, maxZeilen }), familie)
  // Tag wie v14: erster Teil schwarz und fett, zweiter Teil orange (Teilung am Satzzeichen nahe der Mitte)
  const [a, b] = zweiTeile(kopf)
  const halb = Math.max(2, Math.ceil(maxZeilen / 2))
  const za = umbrechen(a, { maxZeichen, maxZeilen: halb }), zb = b.length ? umbrechen(b, { maxZeichen, maxZeilen: halb }) : []
  return zeilenHtml([...za, ...zb], familie, (i) => (i >= za.length ? 'zwei oo' : ''))
}

/**
 * Ist der erste Satz zu lang für eine Überschrift (> max Zeichen), bleibt nur der Anfang bis zum ersten Satzzeichen
 * (Doppelpunkt, Komma, Fragezeichen …) Überschrift; der Rest wandert vor den Fließtext. Ohne Satzzeichen bleibt es, wie es ist.
 */
export function langerKopf(kopf, rumpf, max = 80) {
  const t = ohneMarkup(kopf)
  if (t.length <= max) return [kopf, rumpf]
  const re = /[:;?!,–—]\s/g
  let m
  while ((m = re.exec(kopf))) {
    const pos = m.index + 1
    if (ohneMarkup(kopf.slice(0, pos)).length >= 12 && ohneMarkup(kopf.slice(0, pos)).length <= max) {
      const rest = kopf.slice(pos).trim()
      return [kopf.slice(0, pos).replace(/[,;–—]$/, ''), rumpf ? `${rest} ${rumpf}` : rest]
    }
  }
  return [kopf, rumpf]
}

/** Ausschnitte des Cover-Bilds für den Bildstreifen der Innenseiten: je Seite ein anderer (Höhe, Zoom, Zoom-Mittelpunkt). */
export const AUSSCHNITTE = [{ x: 20, y: 75, s: 1.5 }, { x: 80, y: 55, s: 1.6 }, { x: 50, y: 92, s: 1.3 }, { x: 35, y: 40, s: 1.7 }, { x: 65, y: 70, s: 1.4 }]

/** Ruhiger Bildstreifen im unteren Drittel: Ausschnitt des Cover-Bilds, Nacht abgedunkelt, Tag aufgehellt, nach oben ausgeblendet. */
const streifenHtml = (bild, i, hoehe) => {
  if (!bild) return ''
  const a = AUSSCHNITTE[i % AUSSCHNITTE.length]
  return `<div class=streifen style="height:${hoehe}px"><img src="file://${bild.datei}" alt="" style="object-position:50% ${a.y}%;transform:scale(${a.s});transform-origin:${a.x}% 50%"></div>`
}

/** Fuß der Innenseiten: „weiter →“ als Glas-Pille (Nacht) bzw. dunkle Pille (Tag). */
const fussWeiter = (familie) => familie === 'tag'
  ? '<div class=fuss><span class="pille-dunkel">weiter →</span><span class=r style="text-align:right;display:block">@vamela.de<small>Webdesign &amp; Grafik</small></span></div>'
  : fussNacht('<span class=glas>weiter →</span>')

/** Lage des Textblocks: vertikal optisch mittig (Feed: Schwerpunkt bei 45 % der Höhe, Story: Mitte des sicheren Bereichs). */
const BLOCK = { feed: { top: 150, bottom: 286 }, story: { top: 300, bottom: 560 } }

/**
 * Innenseite: Pille mit Thema, große Überschrift (Einpassen 110–64 px), Fließtext 46 px, Block optisch mittig,
 * Bildstreifen aus dem Cover-Bild unten. Story: Überschrift 120–72 px, Text 48 px, Interaktionssatz als Knopf unten.
 */
export function textSpec({ familie, thema: pille, text, format = 'feed', weiter = true, groesse, schluss = '', knopf = '', bild = null, ausschnitt = 0 }) {
  const story = format === 'story'
  const gr = groesse || (story ? 48 : 46)
  const [kopf, rumpf] = langerKopf(...kopfUndRumpf(text))
  const h2 = kopfHtml(kopf, familie, { maxZeichen: story ? 15 : 17, maxZeilen: story ? 7 : 5 })
  const p = rumpf ? `<p class=text style="font-size:${gr}px">${fliessHtml(rumpf, familie)}</p>` : ''
  const s = schluss ? `<p class=text style="font-size:${gr}px"><b>${esc(schluss)}</b></p>` : ''
  // Story: der Interaktionssatz steht als Knopf unten im sicheren Bereich, sonst unter dem Text
  const k = knopf && !story ? `<span class=knopf>${esc(knopf)}</span>` : ''
  const unten = knopf && story ? `<div class=knopf-unten><span class=knopf>${esc(knopf)}</span></div>` : ''
  const fit = story ? 'data-fit="120,72" data-fit-h="760"' : 'data-fit="110,64" data-fit-h="540"'
  const { top, bottom } = BLOCK[format]
  const inhalt = `${streifenHtml(bild, ausschnitt, story ? 760 : 470)}<div class=vmitte style="top:${top}px;bottom:${bottom}px">` +
    `${pille ? `<span class=pille>${esc(pille)}</span>` : ''}<h2 class=h1 ${fit}>${h2}</h2>${p}${s}${k}</div>${unten}`
  const fuss = story ? (familie === 'tag' ? fussTag : fussNacht()) : weiter ? fussWeiter(familie) : familie === 'tag' ? fussTag : fussNacht()
  return { format, familie, grund: familie === 'tag' ? 'hell' : 'glut', inhalt, fuss, streifen: !!bild }
}

/** Entfernt „Link in der Bio“ aus dem Text, wenn der Knopf es schon sagt (nie doppelt). */
export function ohneLinkHinweis(text) {
  let t = String(text || '')
  t = t.replace(/(^|[.!?]\s+)Link in der Bio[.!]\s*/giu, '$1')                                     // eigener Satz
  t = t.replace(/(^|[.!?]\s+)Link in der Bio,\s*(\p{L})/giu, (m, a, z) => a + z.toUpperCase())  // „Link in der Bio, speicher …“
  t = t.replace(/,\s*Link in der Bio\s*([.!?])/giu, '$1')                                        // „…, Link in der Bio.“ (nur mit Komma: „über den Link in der Bio.“ bleibt ganz)
  return t.trim()
}

/** Schlussseite: Nacht mittig mit Knopf (v5), Tag links mit Knopf und Folgen-Satz. Der Knopf trägt die Handlung genau einmal. */
export function ctaSpec({ familie, text, angebot, format = 'feed' }) {
  const label = ctaLabel(text, angebot)
  const zeigen = label === 'Link in der Bio' ? ohneLinkHinweis(text) : text
  if (familie === 'tag') {
    const folgen = label === 'Folgen' || /folge/i.test(ohneMarkup(text)) ? '' : 'Folge @vamela.de für mehr davon.'
    return textSpec({ familie, thema: '', text: zeigen, format, weiter: false, schluss: folgen, knopf: label })
  }
  const [kopf, rumpf] = kopfUndRumpf(zeigen)
  const p = rumpf ? `<p class="text mitte" style="font-size:40px;max-width:820px">${fliessHtml(rumpf, familie)}</p>` : ''
  const inhalt = `<div class="vmitte mitte" style="top:${BLOCK[format].top}px;bottom:${BLOCK[format].bottom}px;--abstand:44px"><h2 class="h1 mitte" data-fit="100,60" data-fit-h="560" style="line-height:1.1">${kopfHtml(kopf, familie, { maxZeichen: 16, serif: true })}</h2>` +
    `${p}<span class=knopf style="margin-top:70px">${esc(label)}</span></div>`
  return { format, familie, grund: 'glut', inhalt, fuss: fussNacht() }
}

/** Hinweise für den Prüfbericht, die kein Fehler sind (z. B. zu langer Hook). */
export function coverHinweise(head) {
  const n = ohneMarkup(head).split(/\s+/).filter(Boolean).length
  return n > 9 ? [`Hook zu lang (> 9 Wörter): ${n} Wörter, die Überschrift wird klein`] : []
}

// ---------------------------------------------------------------------------------------------------------------------
// Rendern mit Prüfung und Gegenmaßnahmen
// ---------------------------------------------------------------------------------------------------------------------

/** Sichtbarer Text einer Seite (für die Emoji-Prüfung). */
const sichtbarerText = (html) => html.replace(/<[^>]+>/g, ' ')

/**
 * Rendert eine Seite nach datei (JPG) und prüft sie (render/pruefen.mjs). Fällt nur der Kontrast oder der Freiraum
 * (Text auf Motiv, nur bei Bildhintergrund) durch, werden die Gegenmaßnahmen der Reihe nach versucht und erneut geprüft
 * (STUFEN_BILD, STUFEN_STREIFEN, STUFEN_FLAECHE). Layoutfehler brechen sofort ab.
 * Rückgabe: { datei, stufe, gegenmassnahmen: [..] }. Wirft PruefFehler mit den Gründen der letzten Stufe.
 */
export async function renderSeite(page, spec, datei, { name = path.basename(datei) } = {}) {
  if (EMOJI.test(sichtbarerText(spec.inhalt))) throw new PruefFehler([`${name}: Emoji auf der Seite`])
  const H = HOEHE[spec.format]
  await page.setViewportSize({ width: 1080, height: H })
  const bildGrund = spec.grund === 'bild'
  const stufen = bildGrund ? STUFEN_BILD : spec.streifen ? STUFEN_STREIFEN : STUFEN_FLAECHE
  const tmp = path.join(path.dirname(datei), `.t-${path.basename(datei)}.html`)
  let letzte = [], kontrastSchon = false
  try {
    for (const st of stufen) {
      if ((st.v1 || st.stark) && !kontrastSchon) continue
      fs.writeFileSync(tmp, seiteHtml(spec, st))
      await page.goto('file://' + tmp)
      const { fehler, kontrast, freiraum, bild } = await pruefeSeite(page, { format: spec.format, freiraum: bildGrund })
      if (fehler.length) throw new PruefFehler(fehler.map((f) => `${name}: ${f}`))
      if (!kontrast.length && !freiraum.length) {
        fs.writeFileSync(datei, bild)
        return { datei, stufe: st, gegenmassnahmen: stufeName(st) }
      }
      if (kontrast.length) kontrastSchon = true
      letzte = [...kontrast, ...freiraum]
    }
  } finally {
    fs.rmSync(tmp, { force: true })
  }
  throw new PruefFehler(letzte.map((f) => `${name}: ${f} (auch nach allen Gegenmaßnahmen)`))
}

/** Neue Seite im Kontext der Engine, mit Aufwärmlauf beim ersten Mal. */
export async function neueSeite(eng) {
  const ctx = eng._i.ctx
  const warm = path.join(os.tmpdir(), `vamela-aufwaermen-${process.pid}.html`)
  fs.writeFileSync(warm, seiteHtml({ format: 'feed', familie: 'nacht', grund: 'glut', inhalt: '<h1 class=h1 data-fit="90,60" style="position:absolute;left:80px;right:80px;top:200px">Aufwärmen</h1>', fuss: fussNacht() }))
  await aufwaermen(ctx, 'file://' + warm)
  return ctx.newPage()
}
