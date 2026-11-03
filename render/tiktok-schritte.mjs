// TikTok-Karussell im Look „Schritte“ (Christian, 03.11.2026, Vorlagen: „GitHub Vault“-Hero und „Sama“-Step-Slides).
// Seite 1 Hero: vollflächiges KI-Bild, oben zwei schmale Versalzeilen, darunter ein riesiges Wort. Seiten 2 bis n−1: weiß,
// rotes Etikett („Tool 1“, „Schritt 1“), fette schwarze Überschrift, Unterzeile, darunter eine selbst gezeichnete Karte mit
// rotem Pfeil. Letzte Seite: Aufforderung (Speichern / Folgen). Format 1080 × 1440 (3:4, so zeigt TikTok Fotobeiträge ohne Rand).
// Sicherer Bereich: x 70–930 (rechts liegen TikToks Knöpfe), y 90–1370. Keine fremden Logos, nur eigene Symbole.
import path from 'node:path'
import { esc } from './engine.mjs'

export const B = 1080, H = 1440
const BASIS = path.resolve(new URL('.', import.meta.url).pathname)

const KOPF = `<!doctype html><html><head><meta charset=utf-8><base href="file://${BASIS}/">
<link rel=stylesheet href="orange/fonts.css">
<style>
@font-face{font-family:'Barlow Condensed';font-weight:600;src:url(fonts/BarlowCondensed-600.woff2) format('woff2')}
@font-face{font-family:'Barlow Condensed';font-weight:700;src:url(fonts/BarlowCondensed-700.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:800;src:url(fonts/InterTight-800.woff2) format('woff2')}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${B}px;height:${H}px;overflow:hidden}
.page{position:absolute;inset:0;overflow:hidden;font-family:'Poppins',sans-serif;color:#0d0d0d}
.korn{position:absolute;inset:0;background:url(orange/noise.png);opacity:.06;mix-blend-mode:multiply;pointer-events:none}
/* Hero */
.foto{position:absolute;inset:0;width:${B}px;height:${H}px;object-fit:cover}
.hell{position:absolute;inset:0;background:radial-gradient(70% 34% at 50% 38%,rgba(255,255,255,.62),rgba(255,255,255,0) 100%)}
.hero-text{position:absolute;left:70px;right:150px;top:var(--top);text-align:center}
.oben{font:700 var(--os)/0.98 'Barlow Condensed';text-transform:uppercase;letter-spacing:.005em;color:#0d0d0d;text-shadow:0 2px 18px rgba(255,255,255,.55)}
.gross{margin-top:14px;font:800 var(--gs)/0.9 'Inter Tight';text-transform:uppercase;letter-spacing:-.035em;color:#0b0b0b;white-space:nowrap;text-shadow:0 4px 30px rgba(255,255,255,.6)}
.fuss{position:absolute;left:70px;right:150px;bottom:120px;display:flex;justify-content:space-between;font:500 34px/1 'DejaVu Sans Mono',Menlo,monospace;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.55)}
/* Schritte */
.weiss{background:#fff}
.inhalt{position:absolute;left:70px;right:150px;top:var(--top);text-align:center}
.etikett{font:800 var(--es)/1 'Poppins';letter-spacing:-.04em;background:linear-gradient(180deg,#ff3b30 0%,#e10600 55%,#b30000 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 10px 10px rgba(200,0,0,.18))}
.titel{margin-top:22px;font:800 var(--ts)/1.06 'Poppins';letter-spacing:-.035em;color:#0d0d0d}
.unter{margin-top:18px;font:500 38px/1.3 'Poppins';color:#1d1d1f}
.karte{position:absolute;left:70px;right:150px;top:var(--ktop);background:#fff;border:2px solid #e6e6ea;border-radius:26px;box-shadow:0 22px 50px rgba(15,15,30,.12);padding:40px 42px;text-align:left}
.k-kopf{display:flex;align-items:center;gap:18px}
.k-icon{flex:none;width:64px;height:64px;border-radius:16px;background:#0d0d0d;display:flex;align-items:center;justify-content:center}
.k-name{font:600 40px/1.15 'DejaVu Sans Mono',Menlo,monospace;color:#0d0d0d;letter-spacing:-.02em;word-break:break-all}
.k-url{font:400 27px/1.2 'DejaVu Sans Mono',Menlo,monospace;color:#6b6b72;margin-top:4px}
.k-text{margin-top:26px;font:500 38px/1.38 'Poppins';color:#2a2a2e}
.chips{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}
.chip{font:600 30px/1 'Poppins';padding:12px 18px;border-radius:999px;background:#f2f2f5;color:#2a2a2e}
.chip.gruen{background:#e7f8ee;color:#137a3c}.chip.rot{background:#ffeceb;color:#c40d00}
.zeile{display:flex;align-items:flex-start;gap:18px;font:500 38px/1.35 'Poppins';color:#2a2a2e;margin-top:24px}
.zeile:first-child{margin-top:0}
.haken{flex:none;width:44px;height:44px;border-radius:50%;background:#22a861;display:flex;align-items:center;justify-content:center;margin-top:2px}
.bsp-kopf{font:600 28px/1 'Poppins';color:#6b6b72;text-transform:uppercase;letter-spacing:.06em}
.bsp{margin-top:18px;font:500 36px/1.4 'DejaVu Sans Mono',Menlo,monospace;color:#0d0d0d;background:#f6f6f8;border:2px solid #ececf0;border-radius:18px;padding:24px 26px}
.pfeil{position:absolute;width:250px;height:170px;right:150px;top:calc(var(--ktop) - 150px)}
.marke{position:absolute;left:70px;bottom:96px;font:600 30px/1 'Poppins';color:#9a9aa2}
.marke b{color:#e10600}
.seite{position:absolute;right:150px;bottom:96px;font:600 30px/1 'Poppins';color:#9a9aa2}
/* Schluss */
.knopf{display:inline-block;margin-top:60px;font:700 46px/1 'Poppins';color:#fff;background:linear-gradient(180deg,#ff3b30,#c40000);padding:30px 54px;border-radius:999px;box-shadow:0 18px 40px rgba(200,0,0,.28)}
</style></head><body><div class=page`

const ICON_CODE = '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/></svg>'
const ICON_HAKEN = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
// Roter, handgezogener Pfeil von rechts oben auf die Karte (wie in der Vorlage)
const PFEIL = '<svg class=pfeil viewBox="0 0 250 170" fill="none" stroke="#e10600" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M232 18 C 170 0, 90 20, 52 120"/><path d="M30 92 L52 124 L84 104"/></svg>'
const ENDE = '<div class=korn></div></div></body></html>'

/** Hero: oben = zwei kurze Versalzeilen, gross = ein Wort (höchstens ~12 Zeichen). Größen kommen von passeHero(). */
export function heroHtml({ bild, oben = [], gross = '', os = 92, gs = 190, top = 300, links = 'vamela.de', rechts = 'Speichern ↓' }) {
  return `${KOPF} style="--os:${os}px;--gs:${gs}px;--top:${top}px">
<img class=foto src="${esc(bild)}"><div class=hell></div>
<div class=hero-text><div class=oben>${oben.map(esc).join('<br>')}</div><div class=gross>${esc(gross)}</div></div>
<div class=fuss><span>➤ ${esc(links)}</span><span>${esc(rechts)}</span></div>${ENDE}`
}

function karteHtml(k = {}) {
  if (k.art === 'repo') {
    const chips = [k.lizenz && `<span class="chip">Lizenz ${esc(k.lizenz)}</span>`, k.sterne && `<span class="chip">★ ${esc(k.sterne)}</span>`, `<span class="chip ${k.kosten ? 'rot' : 'gruen'}">${k.kosten ? esc(k.kosten) : 'kostenlos'}</span>`].filter(Boolean).join('')
    return `<div class=k-kopf><div class=k-icon>${ICON_CODE}</div><div><div class=k-name>${esc(k.slug)}</div><div class=k-url>github.com/${esc(k.slug)}</div></div></div>
<div class=k-text>${esc(k.text || '')}</div><div class=chips>${chips}</div>`
  }
  if (k.art === 'liste') return (k.zeilen || []).map((z) => `<div class=zeile><span class=haken>${ICON_HAKEN}</span><span>${esc(z)}</span></div>`).join('')
  return `<div class=bsp-kopf>${esc(k.kopf || 'Beispiel')}</div><div class=bsp>${esc(k.text || '')}</div>`
}

export function schrittHtml({ etikett, titel, unter = '', karte = null, es = 150, ts = 76, top = 150, ktop = 760, nr = 2, von = 7 }) {
  return `${KOPF} weiss" style="--es:${es}px;--ts:${ts}px;--top:${top}px;--ktop:${ktop}px">
<div class=inhalt><div class=etikett>${esc(etikett)}</div><div class=titel>${esc(titel)}</div>${unter ? `<div class=unter>${esc(unter)}</div>` : ''}</div>
${karte ? PFEIL + `<div class=karte>${karteHtml(karte)}</div>` : ''}
<div class=marke>➤ <b>vamela</b>.de</div><div class=seite>${nr} / ${von}</div>${ENDE}`
}

export function schlussHtml({ titel, unter = '', knopf = 'Speichern', es = 120, ts = 76, top = 360 }) {
  return `${KOPF} weiss" style="--es:${es}px;--ts:${ts}px;--top:${top}px">
<div class=inhalt><div class=etikett>Gespeichert?</div><div class=titel>${esc(titel)}</div>${unter ? `<div class=unter>${esc(unter)}</div>` : ''}<div class=knopf>${esc(knopf)}</div></div>
<div class=marke>➤ <b>vamela</b>.de</div>${ENDE}`
}

/**
 * Rendert das ganze Karussell nach ordner/01.jpg … und gibt die Dateien zurück.
 * k = { hero: { bild, oben: [..], gross }, schritte: [{ etikett, titel, unter, karte }], schluss: { titel, unter, knopf } }
 */
export async function renderSchritte(eng, k, ordner) {
  const W = B - 220 // Textbreite (70 links, 150 rechts)
  const dateien = []
  const von = k.schritte.length + 2
  const ziel = (n) => path.join(ordner, `${String(n).padStart(2, '0')}.jpg`)
  const fehler = []
  // Hero: Versalzeilen und großes Wort so groß wie möglich
  const os = (await eng.fit(k.hero.oben.map(esc).join('<br>'), W, [104, 98, 92, 86, 80, 74, 68], "font-family:'Barlow Condensed';font-weight:700;text-transform:uppercase;line-height:.98", 320))?.size || 68
  const gs = (await eng.fit(esc(k.hero.gross), W, [230, 214, 200, 186, 172, 160, 148, 136, 124, 112], "font-family:'Inter Tight';font-weight:800;text-transform:uppercase;letter-spacing:-.035em;white-space:nowrap;line-height:.9", 260))?.size || 112
  fehler.push(...await eng.renderHtml(heroHtml({ ...k.hero, os, gs }), ziel(1), H))
  dateien.push(ziel(1))
  for (const [i, s] of k.schritte.entries()) {
    const ts = (await eng.fit(esc(s.titel), W, [84, 78, 72, 66, 60, 56], "font-family:'Poppins';font-weight:800;letter-spacing:-.035em;line-height:1.06", 280))?.size || 56
    const th = (await eng.measure(esc(s.titel), W, `font-family:'Poppins';font-weight:800;letter-spacing:-.035em;line-height:1.06;font-size:${ts}px`))
    const uh = s.unter ? await eng.measure(esc(s.unter), W, "font-family:'Poppins';font-weight:500;font-size:38px;line-height:1.3") + 18 : 0
    // Etikett 150 px, Titel, Unterzeile, dann 190 px Luft für den Pfeil, darauf die Karte
    const ktop = Math.round(130 + 150 + 22 + th + uh + 190)
    fehler.push(...await eng.renderHtml(schrittHtml({ ...s, ts, top: 130, ktop, nr: i + 2, von }), ziel(i + 2), H))
    dateien.push(ziel(i + 2))
  }
  fehler.push(...await eng.renderHtml(schlussHtml(k.schluss), ziel(von), H))
  dateien.push(ziel(von))
  return { dateien, fehler }
}
