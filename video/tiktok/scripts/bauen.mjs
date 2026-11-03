// Baut index.html (HyperFrames 1080 × 1920) für ein automatisches TikTok aus inhalt.json und der Stimme.
// Vorlage ist video/bewertung (3D-Wörter, Karopapier-Wand im Raum, ein Held, der sich von Beat zu Beat verwandelt),
// hier als Baukasten: jeder Beat hat einen Typ mit festem Aussehen, Claude füllt nur Text und Symbol.
//   hook      Symbol-Kreis poppt (symbol aus SYMBOLE)
//   problem   weiße Karte mit bis zu 4 Punkten, rotes Kreuz je Punkt, Grund blitzt rot
//   schritte  weiße Karte mit bis zu 4 Punkten, die nacheinander abgehakt werden
//   vergleich zwei Felder: vorher (grau, durchgestrichen) und nachher (orange Haken)
//   merksatz  Karte mit Symbol und einem kurzen Satz
//   werkzeug  dunkle Werkzeug-Karte (Name, „kostenlos“, bis zu 3 Merkmale, Knopf, Adresse auf vamela.de), Zeiger drückt
//   schluss   dunkler Grund, VAMELA-Logo mit Glut, vamela.de
// Jeder Beat hat „zeile“: 2 bis 6 Wörter im Bild, „ / “ bricht die Zeile, _wort_ ist das Akzentwort in Orange.
// Aufruf: node scripts/bauen.mjs   (liest inhalt.json und assets/stimme/b<n>.wav, schreibt index.html und plan.json)
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const inhalt = JSON.parse(fs.readFileSync('inhalt.json', 'utf8'))
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const r3 = (x) => +x.toFixed(3)

// TikTok-Sicherheitsbereich: Mitte der sicheren Spalte (rechts liegen die Knöpfe), oben und unten die Oberfläche
const MX = 505, HY = 910, OBEN = 270, UNTEN = 1560

const SYMBOLE = {
  herz: '<path fill="currentColor" stroke="none" d="M12 21s-7.5-4.6-9.6-9.2C.8 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.5.8-1.3 2.3-2.5 4.4-2.5 3.6 0 5.8 3.7 4.2 7.3C19.5 16.4 12 21 12 21z"/>',
  stern: '<path fill="currentColor" stroke="none" d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"/>',
  lupe: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  uhr: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/>',
  handy: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.2h2"/>',
  warnung: '<path d="M12 3.5L21.5 20h-19z"/><path d="M12 9.5v4.5"/><path d="M12 17.2v.1"/>',
  haken: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  kreuz: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  blitz: '<path fill="currentColor" stroke="none" d="M13.5 2L4.5 14h6.5l-1 8 9-12h-6.5z"/>',
  idee: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.8 10.6c.7.7 1 1.4 1 2.4h5.6c0-1 .3-1.7 1-2.4A6 6 0 0 0 12 3z"/>',
  schloss: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  ort: '<path d="M12 21.5s7-6.2 7-11.8a7 7 0 0 0-14 0c0 5.6 7 11.8 7 11.8z"/><circle cx="12" cy="9.7" r="2.4"/>',
  brief: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  auge: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  bild: '<rect x="3" y="4" width="18" height="16" rx="2.2"/><circle cx="9" cy="9.5" r="1.8"/><path d="M21 16l-5-5-9 9"/>',
  stift: '<path d="M4 20l4.2-1 10.5-10.5a2.1 2.1 0 0 0-3-3L5.2 16 4 20z"/><path d="M14 7l3 3"/>',
  daumen: '<path d="M7 11v9H4v-9h3z"/><path d="M7 11l4-7.5c1.5 0 2.5 1 2.2 2.6L12.6 10H19a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  geschenk: '<rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M2.5 9h19M12 9v11"/><path d="M12 9c-1.5-3.5-5.5-4-5.5-1.5S10 9 12 9zm0 0c1.5-3.5 5.5-4 5.5-1.5S14 9 12 9z"/>',
}
const SYMBOLFARBE = { herz: '#FF4D6D', stern: '#FFC21A', warnung: '#FF3B30', kreuz: '#FF3B30', haken: '#22C55E', geschenk: '#22C55E', daumen: '#22C55E' }
const symbolSvg = (name, cls = '') => `<svg class="sym ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${SYMBOLE[name] || SYMBOLE.idee}</svg>`

// ---------- Zeiten aus der Stimme ----------
const dauer = (f) => fs.existsSync(f) ? Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString()) : null
const VOR = 0.1
const MIN = { hook: 1.8, problem: 2.6, schritte: 3.0, vergleich: 2.8, merksatz: 2.4, werkzeug: 3.0, schluss: 2.4 }
let t = 0
const beats = inhalt.beats.map((b, i) => {
  const st = dauer(`assets/stimme/b${i}.wav`)
  const sprech = st ?? b.sprechen.split(/\s+/).length / 2.6
  const d = Math.max(MIN[b.typ] || 2.2, sprech + VOR + (b.typ === 'schluss' ? 1.3 : 0.22))
  const beat = { ...b, i, start: r3(t), dauer: r3(d), sprech: r3(sprech), stimme: !!st }
  t += d
  return beat
})
const DAUER = r3(t)

// ---------- Zustände des Helden (je Beat einer) ----------
const punkte = (b) => (b.karte?.punkte || []).slice(0, 4)
const listenHoehe = (b) => (b.karte?.titel ? 132 : 56) + punkte(b).length * 136 + 40
function zustand(b) {
  const id = `zu-${b.i}`
  if (b.typ === 'hook') return { id, html: `<div class="zu zu-symbol" id="${id}">${symbolSvg(b.symbol)}</div>`, f: { w: 400, h: 400, r: 200, bg: SYMBOLFARBE[b.symbol] || '#FF5B14' } }
  if (b.typ === 'problem' || b.typ === 'schritte') {
    const zeichen = b.typ === 'problem' ? 'kreuz' : 'haken'
    const html = `<div class="zu zu-liste ${b.typ}" id="${id}">${b.karte?.titel ? `<div class="li-titel" data-fit="54">${esc(b.karte.titel)}</div>` : ''}
      <div class="li-punkte">${punkte(b).map((p, k) => `<div class="li-punkt" id="${id}-p${k}"><span class="li-zeichen">${symbolSvg(zeichen)}</span><span class="li-txt" data-fit="46">${esc(p)}</span></div>`).join('')}</div></div>`
    return { id, html, f: { w: 820, h: listenHoehe(b), r: 64, bg: '#ffffff' } }
  }
  if (b.typ === 'vergleich') {
    const html = `<div class="zu zu-vergleich" id="${id}">
      <div class="vg vg-vorher" id="${id}-a"><span class="vg-label">vorher</span><span class="vg-zeichen">${symbolSvg('kreuz')}</span><span class="vg-txt" data-fit="50">${esc(b.vorher)}</span></div>
      <div class="vg vg-nachher" id="${id}-b"><span class="vg-label">besser</span><span class="vg-zeichen">${symbolSvg('haken')}</span><span class="vg-txt" data-fit="54">${esc(b.nachher)}</span></div></div>`
    return { id, html, f: { w: 820, h: 640, r: 64, bg: '#ffffff' } }
  }
  if (b.typ === 'merksatz') {
    const html = `<div class="zu zu-satz" id="${id}"><span class="ms-symbol" style="background:${SYMBOLFARBE[b.symbol] || '#FF5B14'}">${symbolSvg(b.symbol || 'idee')}</span><div class="ms-txt" data-fit="64">${esc(b.satz)}</div></div>`
    return { id, html, f: { w: 820, h: 560, r: 64, bg: '#ffffff' } }
  }
  if (b.typ === 'werkzeug') {
    const k = b.karte || {}
    const html = `<div class="zu zu-werkzeug" id="${id}">
      <div class="wz-kopf"><b data-fit="54">${esc(k.titel)}</b><span class="wz-gratis" id="${id}-gratis">kostenlos</span></div>
      <div class="wz-symbol">${symbolSvg(b.symbol || 'blitz')}</div>
      <div class="wz-formate">${(k.punkte || []).slice(0, 3).map((p) => `<span>${esc(p)}</span>`).join('')}</div>
      <div class="wz-knopf" id="${id}-knopf">${esc(k.knopf || 'Jetzt starten')}</div>
      <div class="wz-url" data-fit="30">vamela.de${esc(inhalt.werkzeug || '')}</div></div>`
    return { id, html, f: { w: 820, h: 980, r: 72, bg: '#1C1C1F' } }
  }
  return { id, html: `<div class="zu" id="${id}"></div>`, f: { w: 300, h: 300, r: 150, bg: '#FF5B14' } }
}
const Z = beats.map(zustand)

// Tiefen-Elemente gegen leeren Raum (Parallax bei Kameradrehung)
const DEKO = [
  ['stern', -430, -620, -900, 120, '#FFC21A'], ['herz', 420, -700, -1300, 150, '#FF4D6D'], ['kreis', -480, 520, -1100, 180, '#FF5B14'],
  ['kreis', 450, 600, -800, 160, '#FFC21A'], ['stern', 380, 120, -1500, 110, '#FFC21A'], ['kreis', -380, -80, -1600, 140, '#FF4D6D'],
  ['herz', -200, 860, -700, 90, '#FF4D6D'], ['stern', 180, -900, -1000, 100, '#FFC21A'], ['kreis', 520, -320, -600, 70, '#FF5B14'],
  ['stern', -120, 1020, -1200, 130, '#FFC21A'], ['kreis', 260, 900, -1500, 200, '#FF5B14'],
]
const dekoHtml = DEKO.map(([typ, x, y, z, g, f], k) => `<div class="deko" id="deko-${k}" data-z="${z}" style="left:${x - g / 2}px;top:${y - g / 2}px;width:${g}px;height:${g}px;color:${f}">${typ === 'kreis' ? `<i style="background:${f}"></i>` : symbolSvg(typ)}</div>`).join('')
const funkel = (id, x, y, s = 1) => `<svg class="funkel" id="${id}" viewBox="0 0 24 24" style="left:${x}px;top:${y}px;width:${46 * s}px;height:${46 * s}px"><path d="M12 0c.6 6.2 2.8 9.4 12 12-9.2 2.6-11.4 5.8-12 12-.6-6.2-2.8-9.4-12-12C9.2 9.4 11.4 6.2 12 0z"/></svg>`
const zeigerSvg = '<svg id="zeiger" viewBox="0 0 40 40"><path d="M9 4 L9 32 L16 25.5 L21 36 L26 33.8 L21 23.5 L31 23.5 Z" fill="#111" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>'

// Zeile im Bild: „ / “ bricht, _wort_ ist das Akzentwort
const zeilen = beats.map((b) => ({ i: b.i, typ: b.typ, text: b.zeile || '', t: r3(b.start + 0.12), ende: r3(b.start + b.dauer - 0.06), h: b.typ === 'schluss' ? 300 : Z[b.i].f.h }))
// Satzzeichen dürfen außerhalb des Akzents stehen („_unscharf_?“)
const buchstaben = (t) => [...t].map((c) => `<span class="z">${esc(c)}</span>`).join('')
const wort1 = (w) => {
  const m = w.match(/^([^_\p{L}\d]*)_(.+)_([^_\p{L}\d]*)$/u)
  return m ? `<span class="wo">${buchstaben(m[1])}<span class="ak">${buchstaben(m[2])}</span>${buchstaben(m[3])}</span>` : `<span class="wo">${buchstaben(w)}</span>`
}
const zeichen = (text) => text.split(' / ').map((zeile) => `<span class="wort-zeile">${zeile.trim().split(/\s+/).map(wort1).join(' ')}</span>`).join('')
const wortHtml = zeilen.map((z, n) => `<div class="wort${z.typ === 'schluss' ? ' hell' : ''}" id="wort-${n}" data-layout-allow-overlap>${zeichen(z.text)}</div>`).join('\n')

const BEATFARBE = { hook: '#FF5B14', problem: '#FF3B30', schritte: '#22C55E', vergleich: '#FF5B14', merksatz: '#FFC21A', werkzeug: '#22C55E', schluss: '#FF5B14' }
const hatTon = fs.existsSync('assets/ton.m4a')
const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <!-- Erzeugt von scripts/bauen.mjs aus inhalt.json. Nicht von Hand ändern. -->
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/CustomEase.min.js"></script>
    <style>
      @font-face { font-family: "Inter"; font-weight: 100 900; src: url("assets/fonts/inter-var-latin.woff2") format("woff2"); }
      @font-face { font-family: "Plex Mono"; font-weight: 500; src: url("assets/fonts/plex-mono-500.woff2") format("woff2"); }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1080px; height: 1920px; overflow: hidden; background: #EDEDEC; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; font-family: "Inter", sans-serif; color: #111; }
      .clip { position: absolute; inset: 0; }
      #grund { background: #EDEDEC; }
      #vignette { position: absolute; inset: 0; background: radial-gradient(120% 75% at 50% 45%, rgba(0,0,0,0) 60%, rgba(0,0,0,.06) 100%); }
      #buehne { position: absolute; left: ${MX}px; top: ${HY}px; width: 0; height: 0; perspective: 1600px; }
      #kamera, #perspektive { position: absolute; left: 0; top: 0; transform-style: preserve-3d; }
      .deko { position: absolute; opacity: .42; filter: blur(5px); }
      .deko svg { width: 100%; height: 100%; display: block; }
      .deko i { display: block; width: 100%; height: 100%; border-radius: 50%; }
      #zeiger-rahmen { position: absolute; inset: 0; transform-origin: ${MX}px ${HY}px; }
      #rahmen { position: absolute; left: 0; top: 0; transform-style: preserve-3d; }
      #held { position: absolute; left: 0; top: 0; filter: url(#mb); }
      #box { position: absolute; left: 0; top: 0; width: 0; height: 0; border-radius: 120px; background: #FF5B14; overflow: hidden; box-shadow: 0 30px 70px rgba(20,20,30,.14), 0 4px 14px rgba(20,20,30,.08); }
      .zu { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: 0; }
      .sym { display: block; }
      .zu-symbol { color: #fff; } .zu-symbol .sym { width: 58%; height: 58%; }
      .zu-liste { justify-content: flex-start; padding: 44px 40px; gap: 26px; }
      .li-titel { width: 100%; height: 62px; font-weight: 750; font-size: 54px; line-height: 62px; letter-spacing: -0.03em; white-space: nowrap; overflow: hidden; }
      .li-punkte { width: 100%; display: flex; flex-direction: column; gap: 18px; }
      .li-punkt { display: flex; align-items: center; gap: 24px; height: 118px; padding: 0 28px; border-radius: 30px; background: #F3F3F5; }
      .li-zeichen { flex: none; width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; background: #FF3B30; }
      .schritte .li-zeichen { background: #D9D9DE; } .li-zeichen .sym { width: 62%; height: 62%; }
      .li-txt { flex: 1; min-width: 0; font-weight: 650; font-size: 46px; letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; }
      .zu-vergleich { padding: 40px; gap: 24px; }
      .vg { position: relative; width: 100%; flex: 1; border-radius: 40px; display: flex; align-items: center; gap: 26px; padding: 40px 34px 0; }
      .vg-vorher { background: #F3F3F5; color: #6b6b70; } .vg-nachher { background: #FFE9DE; color: #111; }
      .vg-label { position: absolute; left: 34px; top: 20px; font-weight: 700; font-size: 30px; letter-spacing: .02em; color: #6b6b70; }
      .vg-nachher .vg-label { color: #B23A00; }
      .vg-zeichen { flex: none; width: 76px; height: 76px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; background: #9CA3AF; }
      .vg-nachher .vg-zeichen { background: #FF5B14; } .vg-zeichen .sym { width: 60%; height: 60%; }
      .vg-txt { flex: 1; min-width: 0; font-weight: 700; font-size: 50px; letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; }
      .vg-vorher .vg-txt { text-decoration: line-through; text-decoration-thickness: 4px; }
      .vg-nachher .vg-txt { font-size: 54px; font-weight: 800; }
      .zu-satz { padding: 50px 56px; gap: 36px; }
      .ms-symbol { width: 150px; height: 150px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; }
      .ms-symbol .sym { width: 58%; height: 58%; }
      .ms-txt { width: 100%; max-height: 250px; overflow: hidden; text-align: center; font-weight: 800; font-size: 64px; line-height: 1.08; letter-spacing: -0.03em; }
      .zu-werkzeug { color: #fff; justify-content: flex-start; padding: 48px 48px; gap: 30px; }
      .wz-kopf { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 20px; }
      .wz-kopf b { flex: 1; min-width: 0; font-size: 54px; font-weight: 750; letter-spacing: -0.035em; white-space: nowrap; overflow: hidden; }
      .wz-gratis { flex: none; font-weight: 700; font-size: 30px; padding: 10px 22px; border-radius: 999px; background: rgba(34,197,94,.18); color: #4ADE80; }
      .wz-symbol { width: 360px; height: 360px; border-radius: 80px; background: linear-gradient(145deg, #FF8A3D, #FF3D00); display: flex; align-items: center; justify-content: center; color: #fff; box-shadow: 0 20px 60px rgba(255,91,20,.35); }
      .wz-symbol .sym { width: 55%; height: 55%; }
      .wz-formate { display: flex; gap: 14px; flex-wrap: nowrap; } .wz-formate span { height: 76px; padding: 0 24px; border-radius: 22px; background: rgba(255,255,255,.1); display: flex; align-items: center; font-weight: 650; font-size: 32px; white-space: nowrap; }
      .wz-knopf { width: 100%; height: 132px; border-radius: 40px; background: #FF5B14; display: flex; align-items: center; justify-content: center; font-weight: 750; font-size: 50px; letter-spacing: -0.02em; }
      .wz-url { width: 100%; text-align: center; font-size: 30px; color: rgba(255,255,255,.7); white-space: nowrap; overflow: hidden; }
      #logo-frei { position: absolute; left: -410px; top: -150px; width: 820px; height: auto; opacity: 0; filter: drop-shadow(0 0 40px rgba(255,91,20,.45)); }
      #logo-url { position: absolute; left: -405px; width: 810px; top: 190px; text-align: center; font-weight: 700; font-size: 56px; color: #fff; opacity: 0; letter-spacing: -0.01em; }
      .ring { position: absolute; left: 0; top: 0; width: 300px; height: 300px; margin: -150px; border-radius: 50%; border: 10px solid #FF5B14; opacity: 0; }
      .funkel { position: absolute; margin: -23px; fill: #FFC21A; opacity: 0; }
      #glow { position: absolute; left: 0; top: 0; width: 900px; height: 1100px; margin: -550px -450px; border-radius: 50%; background: radial-gradient(closest-side, var(--glow, #FF5B14), rgba(0,0,0,0)); opacity: 0; filter: blur(30px); }
      #zeiger { position: absolute; left: 0; top: 0; width: 96px; height: 96px; filter: drop-shadow(0 6px 10px rgba(0,0,0,.25)); transform-origin: 22% 10%; opacity: 0; }
      .wort { position: absolute; left: -405px; width: 810px; top: 0; text-align: center; white-space: nowrap; font-weight: 850; font-size: 140px; line-height: 0.96; letter-spacing: -0.035em; color: var(--tinte, #111); transform-style: preserve-3d; opacity: 0;
        text-shadow: 0 1px 0 #cfcfd2, 0 2px 0 #c4c4c8, 0 3px 0 #b9b9be, 0 4px 0 #aeaeb4, 0 5px 0 #a3a3aa, 0 6px 0 #9898a0, 0 14px 24px rgba(20,20,30,.28); }
      
      .wort.hell { color: #fff; text-shadow: 0 1px 0 #d9d9de, 0 2px 0 #b8b8bf, 0 3px 0 #97979f, 0 4px 0 #77777f, 0 5px 0 #57575f, 0 0 26px rgba(255,120,40,.85), 0 0 60px rgba(255,91,20,.55); }
      .wort-zeile { display: block; width: max-content; margin: 0 auto; white-space: nowrap; transform-style: preserve-3d; }
      .wort .ak { color: #B83800; text-shadow: 0 1px 0 #c63d00, 0 2px 0 #b43700, 0 3px 0 #a23100, 0 4px 0 #902b00, 0 5px 0 #7e2500, 0 6px 0 #6c1f00, 0 0 34px rgba(255,91,20,.45), 0 16px 26px rgba(120,30,0,.30); }
      .wort.hell .ak { color: #FF6A26; }
      .wo, .ak { display: inline-block; transform-style: preserve-3d; vertical-align: top; }
      .z { display: inline-block; transform-origin: 50% 100%; }
      #wand { position: absolute; left: -3000px; top: -4000px; width: 6000px; height: 8000px; }
      .raster { position: absolute; inset: 0; background-size: 64px 64px; }
      #raster-dunkel { background-image: linear-gradient(rgba(17,17,17,.11) 2px, transparent 2px), linear-gradient(90deg, rgba(17,17,17,.11) 2px, transparent 2px); }
      #raster-hell { background-image: linear-gradient(rgba(255,255,255,.08) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,.08) 2px, transparent 2px); opacity: 0; }
      #raster-glut { background-image: linear-gradient(var(--glutlinie, #FF5B14) 2px, transparent 2px), linear-gradient(90deg, var(--glutlinie, #FF5B14) 2px, transparent 2px); -webkit-mask-image: radial-gradient(closest-side, #000 0%, rgba(0,0,0,.35) 45%, transparent 100%); mask-image: radial-gradient(closest-side, #000 0%, rgba(0,0,0,.35) 45%, transparent 100%); -webkit-mask-size: 2600px 2600px; mask-size: 2600px 2600px; -webkit-mask-position: center; mask-position: center; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; opacity: .5; filter: drop-shadow(0 0 6px var(--glutlinie, #FF5B14)); }
      #licht { position: absolute; left: 0; top: 0; width: 1600px; height: 8000px; background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.55) 45%, rgba(255,210,170,.75) 50%, rgba(255,255,255,.55) 55%, rgba(255,255,255,0)); opacity: 0; mix-blend-mode: screen; }
    </style>
  </head>
  <body>
    <svg width="0" height="0" style="position:absolute"><defs><filter id="mb" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur id="mb-blur" stdDeviation="0 0"/></filter></defs></svg>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${DAUER}" data-width="1080" data-height="1920">
      <section id="grund" class="clip" data-start="0" data-duration="${DAUER}" data-track-index="0"><div id="vignette"></div></section>
      <section id="s-held" class="clip" data-start="0" data-duration="${DAUER}" data-track-index="2">
        <div id="buehne"><div id="perspektive"><div id="kamera">
          <div id="wand"><div class="raster" id="raster-dunkel"></div><div class="raster" id="raster-hell"></div><div class="raster" id="raster-glut"></div><div id="licht"></div></div>
          ${dekoHtml}
          <div id="glow"></div>
          <div class="ring" id="ring1"></div><div class="ring" id="ring2"></div>
          <div id="rahmen"><div id="held"><div id="box">${Z.map((z) => z.html).join('\n')}</div></div></div>
          <img id="logo-frei" src="assets/logo.png" alt="VAMELA" />
          <div id="logo-url">vamela.de</div>
          ${wortHtml}
          ${funkel('f0', -300, -250)}${funkel('f1', 290, -200, 0.7)}${funkel('f2', 260, 230, 0.9)}${funkel('f3', -280, 260, 0.6)}
        </div></div></div>
      </section>
      <section id="s-zeiger" class="clip" data-start="0" data-duration="${DAUER}" data-track-index="6"><div id="zeiger-rahmen">${zeigerSvg}</div></section>
${hatTon ? `      <audio id="ton" src="assets/ton.m4a" data-start="0" data-duration="${DAUER}" data-track-index="7"></audio>` : ''}
    </div>
    <script>
      const BEATS = ${JSON.stringify(beats.map(({ i, typ, start, dauer: d, symbol }) => ({ i, typ, start, dauer: d, symbol })))};
      const FORM = ${JSON.stringify(Z.map((z) => z.f))};
      const ZEILEN = ${JSON.stringify(zeilen)};
      const BEATFARBE = ${JSON.stringify(BEATFARBE)};
      const DAUER = ${DAUER}, MX = ${MX}, HY = ${HY}, OBEN = ${OBEN}, UNTEN = ${UNTEN};
      gsap.registerPlugin(CustomEase);
      CustomEase.create("v.aus", "0.16,1,0.3,1");
      CustomEase.create("v.ein", "0.7,0,0.84,0");
      CustomEase.create("v.fahrt", "0.83,0,0.17,1");
      CustomEase.create("v.pop", "M0,0 C0.12,0.7 0.22,1.32 0.36,1.24 0.5,1.16 0.58,0.94 0.7,0.98 0.8,1.01 0.88,1 1,1");
      CustomEase.create("v.morph", "M0,0 C0.25,0.9 0.35,1.12 0.52,1.06 0.68,1 0.8,1 1,1");

      // Text, der nicht passt, wird kleiner gesetzt (data-fit = Startgröße in px, kleinste Größe 30 px)
      function einpassen() {
        FORM.forEach(function (f, i) { const el = document.getElementById("zu-" + i); el.style.width = f.w + "px"; el.style.height = f.h + "px"; el.style.inset = "auto"; el.style.left = "0"; el.style.top = "0"; });
        document.querySelectorAll("[data-fit]").forEach(function (el) {
          for (let px = Number(el.dataset.fit); px >= 30; px -= 2) { el.style.fontSize = px + "px"; if (el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1) break; }
        });
        FORM.forEach(function (f, i) { const el = document.getElementById("zu-" + i); el.style.width = ""; el.style.height = ""; el.style.inset = ""; el.style.left = ""; el.style.top = ""; });
      }

      function bauen() {
        einpassen();
        // Zeile über dem Helden, beide zusammen mittig im sicheren Bereich
        const LUECKE = 40;
        const LAGE = ZEILEN.map(function (z, n) {
          const w = document.getElementById("wort-" + n);
          const zl = Array.prototype.slice.call(w.querySelectorAll(".wort-zeile"));
          for (let px = 150; px >= 64; px -= 2) { w.style.fontSize = px + "px"; if (Math.max.apply(null, zl.map(function (e) { return e.offsetWidth; })) <= 780) break; }
          const ch = w.offsetHeight;
          if (z.typ === "schluss") { w.style.top = (-150 - 70 - ch) + "px"; return { s: 1, dy: 0 }; }
          const s = Math.min(1, (UNTEN - OBEN - ch - LUECKE) / z.h);
          const oben = Math.max(OBEN, (OBEN + UNTEN) / 2 - (ch + LUECKE + z.h * s) / 2);
          w.style.top = (oben - HY) + "px";
          return { s: s, dy: oben + ch + LUECKE + z.h * s / 2 - HY };
        });
        const tl = gsap.timeline({ paused: true });
        const box = "#box", held = "#held";
        gsap.set(box, { xPercent: -50, yPercent: -50 });
        FORM.forEach(function (f, i) { gsap.set("#zu-" + i, { opacity: 0 }); });
        let aktiv = null;
        const morph = function (t, zu, f, d) {
          d = d || 0.5;
          tl.to(held, { scaleX: 1.12, scaleY: 0.88, duration: 0.08, ease: "power2.out" }, t - 0.08);
          tl.to(held, { scaleX: 1, scaleY: 1, duration: 0.7, ease: "elastic.out(1, 0.45)" }, t);
          tl.to(box, { width: f.w, height: f.h, borderRadius: f.r, backgroundColor: f.bg, duration: d, ease: "v.morph" }, t);
          if (aktiv) tl.to(aktiv, { opacity: 0, filter: "blur(14px)", scale: 0.92, duration: 0.14, ease: "power2.in" }, t);
          tl.fromTo(zu, { opacity: 0, filter: "blur(16px)", scale: 1.06 }, { opacity: 1, filter: "blur(0px)", scale: 1, duration: 0.3, ease: "v.aus", immediateRender: false }, t + 0.1);
          aktiv = zu;
        };
        const schmier = function (t, dx, dy, d) {
          d = d || 0.22;
          tl.to("#mb-blur", { attr: { stdDeviation: dx + " " + dy }, duration: d * 0.45, ease: "power2.in" }, t);
          tl.to("#mb-blur", { attr: { stdDeviation: "0 0" }, duration: d * 0.55, ease: "power2.out" }, t + d * 0.45);
        };
        const grund = function (t, farbe, zurueck, halt) {
          tl.to("#grund", { backgroundColor: farbe, duration: 0.16, ease: "power2.out" }, t);
          if (zurueck) tl.to("#grund", { backgroundColor: zurueck, duration: 0.3, ease: "power2.inOut" }, t + 0.16 + (halt || 0.25));
        };
        const ring = function (t, id, farbe) {
          tl.set(id, { borderColor: farbe }, t);
          tl.fromTo(id, { scale: 0.6, opacity: 0.55 }, { scale: 1.7, opacity: 0, duration: 0.75, ease: "power2.out", immediateRender: false }, t);
        };
        const klick = function (t, ziel) {
          tl.to("#zeiger", { scale: 0.82, duration: 0.07, ease: "power2.out" }, t);
          tl.to("#zeiger", { scale: 1, duration: 0.3, ease: "v.pop" }, t + 0.07);
          if (ziel) { tl.to(ziel, { scale: 0.94, duration: 0.07, ease: "power2.out" }, t); tl.to(ziel, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.4)" }, t + 0.07); }
        };

        // Leichte Handkamera und schwebende Tiefen-Elemente
        tl.fromTo("#kamera", { y: 0, rotation: 0 }, { keyframes: Array.from({ length: Math.ceil(DAUER / 1.6) }, function (_, k) { return { y: (k % 2 ? -8 : 6), rotation: (k % 3 - 1) * 0.35, duration: 1.6, ease: "sine.inOut" }; }) }, 0);
        document.querySelectorAll(".deko").forEach(function (el, k) {
          gsap.set(el, { z: Number(el.dataset.z) });
          tl.fromTo(el, { y: 0, rotation: 0 }, { y: (k % 2 ? -60 : 60), rotation: (k % 3 - 1) * 20, duration: DAUER, ease: "sine.inOut" }, 0);
        });
        gsap.set("#wand", { z: -1500 });
        BEATS.forEach(function (b) {
          tl.set("#raster-glut", { "--glutlinie": BEATFARBE[b.typ] }, b.start);
          tl.fromTo("#raster-glut", { opacity: 1 }, { opacity: 0.5, duration: 0.7, ease: "power2.out", immediateRender: false }, b.start);
          tl.fromTo("#licht", { x: -1800, opacity: 0.9 }, { x: 6200, opacity: 0.9, duration: 0.9, ease: "power2.inOut", immediateRender: false }, b.start + 0.05);
          tl.set("#licht", { opacity: 0 }, b.start + 0.96);
        });

        // Kamera: je Beat ein anderer Winkel aus einer festen Folge, dazwischen langsames Driften
        const WINKEL = [
          { rotationY: -6, rotationX: 0, rotationZ: 0, z: 0 }, { rotationY: 13, rotationX: 8, rotationZ: -2, z: 40 },
          { rotationY: 0, rotationX: 26, rotationZ: 3, z: -120 }, { rotationY: -18, rotationX: 8, rotationZ: 0, z: -40 },
          { rotationY: 10, rotationX: -10, rotationZ: 0, z: 120 }, { rotationY: -12, rotationX: 14, rotationZ: -3, z: 0 },
        ];
        tl.set("#perspektive", { z: -520, rotationX: 0, rotationY: 0, rotationZ: 0, x: 0, y: 0 }, 0);
        BEATS.forEach(function (b, n) {
          const w = b.typ === "schluss" ? { rotationX: 0, rotationY: 0, rotationZ: 0, z: 0 } : WINKEL[n % WINKEL.length];
          if (n > 0) tl.to("#perspektive", Object.assign({}, w, { duration: 0.55, ease: "v.fahrt" }), b.start);
          tl.to("#perspektive", { rotationY: w.rotationY * 0.4, rotationX: w.rotationX * 0.7, z: (w.z || 0) + 60, duration: Math.max(0.3, b.dauer - (n ? 0.55 : 0)), ease: "sine.inOut" }, b.start + (n ? 0.55 : 0));
        });

        tl.set("#zeiger", { x: MX + 520, y: HY + 600, opacity: 0, rotation: 0 }, 0);
        BEATS.forEach(function (b) {
          const zu = "#zu-" + b.i, f = FORM[b.i];
          if (b.typ === "schluss") {
            grund(b.start, "#111113");
            tl.to("#raster-dunkel", { opacity: 0, duration: 0.3, ease: "power2.out" }, b.start);
            tl.to("#raster-hell", { opacity: 1, duration: 0.3, ease: "power2.out" }, b.start);
            tl.to(held, { scale: 0.05, opacity: 0, rotation: 20, duration: 0.35, ease: "v.ein" }, b.start + 0.02);
            schmier(b.start + 0.02, 0, 24, 0.3);
            tl.fromTo("#logo-frei", { opacity: 0, scale: 0.55, y: 140, rotation: -8 }, { opacity: 1, scale: 1, y: 0, rotation: 0, duration: 0.9, ease: "v.pop" }, b.start + 0.3);
            tl.fromTo("#logo-url", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5, ease: "v.aus" }, b.start + 0.6);
            tl.set("#glow", { "--glow": "#FF5B14" }, b.start + 0.3);
            tl.fromTo("#glow", { opacity: 0, scale: 0.7 }, { opacity: 0.55, scale: 1, duration: 0.8, ease: "v.aus", immediateRender: false }, b.start + 0.3);
            ["#f0", "#f1", "#f2", "#f3"].forEach(function (s, k) { tl.fromTo(s, { scale: 0.2, opacity: 0 }, { keyframes: [{ scale: 1, opacity: 1, duration: 0.3, ease: "power2.out" }, { scale: 0.85, opacity: 0.8, duration: 0.6, ease: "sine.inOut" }], immediateRender: false }, b.start + 0.55 + k * 0.08); });
            return;
          }
          if (b.i === 0) {
            tl.set(box, { width: f.w, height: f.h, borderRadius: f.r, backgroundColor: f.bg }, 0);
            tl.fromTo(held, { scale: 0.05, rotation: -18 }, { scale: 1, rotation: 0, duration: 0.7, ease: "v.pop" }, b.start);
            tl.fromTo(zu, { opacity: 1 }, { opacity: 1, duration: 0.01 }, 0); aktiv = zu;
          } else {
            morph(b.start, zu, f, b.typ === "werkzeug" ? 0.6 : 0.5);
            schmier(b.start, 0, 20, 0.3);
          }
          if (b.typ === "hook") {
            tl.fromTo(zu + " .sym", { scale: 0.7 }, { keyframes: [{ scale: 1.12, duration: 0.18, ease: "power2.out" }, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.4)" }] }, b.start + 0.35);
            ring(b.start + 0.3, "#ring1", f.bg); ring(b.start + 0.55, "#ring2", f.bg);
          } else if (b.typ === "problem" || b.typ === "schritte") {
            if (b.typ === "problem") grund(b.start, "#FFD9D6", "#EDEDEC", b.dauer - 0.6);
            const pk = Array.prototype.slice.call(document.querySelectorAll(zu + " .li-punkt"));
            const takt = Math.min(0.5, (b.dauer - 0.9) / Math.max(1, pk.length));
            pk.forEach(function (p, k) {
              const tk = b.start + 0.3 + k * takt;
              tl.fromTo(p, { opacity: 0, x: 40, filter: "blur(8px)" }, { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.35, ease: "v.aus", immediateRender: false }, tk);
              if (b.typ === "schritte") tl.fromTo("#" + p.id + " .li-zeichen", { backgroundColor: "#D9D9DE", scale: 1 }, { keyframes: [{ backgroundColor: "#22C55E", scale: 1.25, duration: 0.15, ease: "power2.out" }, { scale: 1, duration: 0.4, ease: "elastic.out(1, 0.4)" }], immediateRender: false }, tk + 0.25);
              else tl.fromTo("#" + p.id + " .li-zeichen", { scale: 0.3, rotation: -40 }, { scale: 1, rotation: 0, duration: 0.45, ease: "v.pop", immediateRender: false }, tk + 0.1);
            });
            if (b.typ === "problem") tl.to(held, { keyframes: [{ x: -16, duration: 0.06 }, { x: 14, duration: 0.07 }, { x: -9, duration: 0.07 }, { x: 0, duration: 0.12 }], ease: "power1.inOut" }, b.start + 0.3 + pk.length * takt);
          } else if (b.typ === "vergleich") {
            tl.fromTo(zu + "-a", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: "v.aus", immediateRender: false }, b.start + 0.25);
            tl.fromTo(zu + "-b", { opacity: 0, y: 30, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "v.pop", immediateRender: false }, b.start + Math.min(1.4, b.dauer * 0.45));
            tl.fromTo(zu + "-b .vg-zeichen", { scale: 0.3 }, { scale: 1, duration: 0.5, ease: "v.pop", immediateRender: false }, b.start + Math.min(1.5, b.dauer * 0.45) + 0.1);
          } else if (b.typ === "merksatz") {
            tl.fromTo(zu + " .ms-symbol", { scale: 0.2, rotation: -30 }, { scale: 1, rotation: 0, duration: 0.6, ease: "v.pop", immediateRender: false }, b.start + 0.25);
            ring(b.start + 0.4, "#ring1", "#FFC21A");
            ["#f0", "#f1", "#f2", "#f3"].forEach(function (s, k) { tl.fromTo(s, { scale: 0.2, opacity: 0, rotation: -30 }, { keyframes: [{ scale: 1.15, opacity: 1, rotation: 0, duration: 0.25, ease: "power2.out" }, { scale: 0.6, opacity: 0, duration: 0.5, ease: "power2.in" }], immediateRender: false }, b.start + 0.5 + k * 0.05); });
          } else if (b.typ === "werkzeug") {
            tl.fromTo(zu + "-gratis", { scale: 0.4, opacity: 0, rotation: 10 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.6, ease: "v.pop", immediateRender: false }, b.start + 0.35);
            tl.fromTo(zu + " .wz-symbol", { scale: 0.5, rotation: -12 }, { scale: 1, rotation: 0, duration: 0.7, ease: "v.pop", immediateRender: false }, b.start + 0.3);
            tl.fromTo(zu + " .wz-formate span", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.4, ease: "v.aus", stagger: 0.12, immediateRender: false }, b.start + 0.6);
            tl.set("#glow", { "--glow": "#FF5B14" }, b.start + 0.5);
            tl.fromTo("#glow", { opacity: 0.6, scale: 0.9 }, { opacity: 0, scale: 1.15, duration: 0.8, ease: "power2.out", immediateRender: false }, b.start + 0.5);
            const druck = b.start + b.dauer - 0.75;
            tl.fromTo("#zeiger", { x: MX + 480, y: HY + 640, opacity: 0 }, { x: MX + 80, y: HY + f.h / 2 - 150, opacity: 1, duration: 0.4, ease: "v.fahrt", immediateRender: false }, druck - 0.42);
            klick(druck, zu + "-knopf");
            tl.to("#zeiger", { x: MX + 520, y: HY + 640, opacity: 0, duration: 0.35, ease: "v.ein" }, druck + 0.3);
          }
        });

        // Rahmen fährt Held und Zeile zusammen in Position
        LAGE.forEach(function (l, n) { if (n === 0) gsap.set("#rahmen, #zeiger-rahmen", { y: l.dy, scale: l.s }); else tl.to("#rahmen, #zeiger-rahmen", { y: l.dy, scale: l.s, duration: 0.45, ease: "v.fahrt" }, Math.max(0, ZEILEN[n].t - 0.25)); });
        // Wörter im 3D-Raum: jeder Buchstabe fliegt aus der Tiefe nach vorn, zum Schluss an der Kamera vorbei
        ZEILEN.forEach(function (z, n) {
          const el = "#wort-" + n;
          tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.01, ease: "none" }, z.t);
          tl.fromTo(el + " .z", { z: -900, y: 60, rotationX: -75, opacity: 0 }, { z: 0, y: 0, rotationX: 0, opacity: 1, duration: 0.6, ease: "v.aus", stagger: 0.022 }, z.t);
          tl.fromTo(el, { z: 0, rotationX: 8 }, { z: 30, rotationX: 0, duration: Math.max(0.3, z.ende - z.t), ease: "sine.inOut" }, z.t);
          if (n < ZEILEN.length - 1) tl.to(el + " .z", { z: 260, rotationX: 50, opacity: 0, duration: 0.18, ease: "v.ein", stagger: 0.006 }, z.ende - 0.2);
        });

        window.__timelines["main"] = tl;
        tl.seek(0);
      }
      window.__timelines = window.__timelines || {};
      document.fonts.ready.then(bauen);
    </script>
  </body>
</html>
`
fs.writeFileSync('index.html', html)

// Ereignisse fürs Sounddesign (scripts/ton.mjs)
const ev = [['pop', 0.05], ['funkeln', 0.4]]
for (const b of beats.slice(1)) ev.push(['whoosh', b.start - 0.06, 0.35])
for (const b of beats) {
  if (b.typ === 'problem' || b.typ === 'schritte') {
    const n = punkte(b).length, takt = Math.min(0.5, (b.dauer - 0.9) / Math.max(1, n))
    if (b.typ === 'problem') ev.push(['boom', b.start])
    for (let k = 0; k < n; k++) ev.push(['tick', b.start + 0.3 + k * takt + (b.typ === 'schritte' ? 0.25 : 0.1), 1200 + k * 220])
  }
  if (b.typ === 'vergleich') ev.push(['pop', b.start + Math.min(1.4, b.dauer * 0.45)])
  if (b.typ === 'merksatz') ev.push(['pop', b.start + 0.3], ['funkeln', b.start + 0.5])
  if (b.typ === 'werkzeug') ev.push(['pop', b.start + 0.4], ['klick', b.start + b.dauer - 0.75])
  if (b.typ === 'schluss') ev.push(['boom', b.start], ['funkeln', b.start + 0.55])
}
fs.writeFileSync('plan.json', JSON.stringify({ dauer: DAUER, beats: beats.map(({ i, typ, start, dauer: d, sprech, stimme }) => ({ i, typ, start, dauer: d, sprech, stimme })), ereignisse: ev }, null, 2))
console.log(`index.html: ${beats.length} Beats, ${DAUER} s${beats.every((b) => b.stimme) ? ' (Zeiten aus der Stimme)' : ' (Zeiten geschätzt)'}`)
