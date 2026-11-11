// Look „canvas“ (Christian, 11.11.2026: „der Schnittstil soll wie der von Higgsfield sein“, Referenz youtube.com/watch?v=5HYYXYYCrL4):
// eine endlose helle Arbeitsfläche mit feinem Raster. Jeder Beat ist eine Gruppe aus Überschrift und sauberer Karte an eigener Stelle
// der Fläche, die Kamera fährt weich von Gruppe zu Gruppe (kurzes Herauszoomen in der Fahrt), Linien verbinden die Gruppen,
// Karten und Zeilen bauen sich gestaffelt auf, Fehler werden durchgestrichen. Akzentfarbe VAMELA-Orange.
// Liest inhalt.json und assets/stimme/b<n>.wav wie bauen.mjs, schreibt index.html und plan.json (für scripts/ton.mjs).
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const inhalt = JSON.parse(fs.readFileSync('inhalt.json', 'utf8'))
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const r3 = (x) => +x.toFixed(3)

// Symbole aus bauen.mjs übernehmen (eine Quelle, Claude kennt dieselben Namen)
const quelle = fs.readFileSync(new URL('./bauen.mjs', import.meta.url), 'utf8')
const SYMBOLE = new Function(`return ${quelle.match(/const SYMBOLE = (\{[\s\S]*?\n\})/)[1]}`)()
const sym = (name, cls = '') => `<svg class="sym ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${SYMBOLE[name] || SYMBOLE.idee}</svg>`

// ---------- Zeiten aus der Stimme (wie bauen.mjs) ----------
const dauer = (f) => (fs.existsSync(f) ? Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString()) : null)
const VOR = 0.1
const MIN = { hook: 1.6, problem: 2.2, schritte: 2.6, vergleich: 2.4, merksatz: 2.0, werkzeug: 2.8, schluss: 2.2 }
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

// ---------- Fläche: jede Gruppe an eigener Stelle ----------
const SX = 505, SY = 915 // Bildmitte der sicheren Spalte
const RASTER = [[0, 0], [1250, 380], [480, 1500], [1700, 1900], [300, 3000], [1500, 3400], [700, 4500], [1900, 4900], [200, 6000], [1300, 6400]]
const lage = (i) => ({ x: 2400 + RASTER[i % RASTER.length][0] + Math.floor(i / RASTER.length) * 400, y: 1800 + RASTER[i % RASTER.length][1] + Math.floor(i / RASTER.length) * 7000 })

const zeile = (text, id) => text.split(' / ').map((z) => `<span class="zl">${z.trim().split(/\s+/).map((w) => {
  const m = w.match(/^([^_\p{L}\d]*)_(.+)_([^_\p{L}\d]*)$/u)
  return m ? `<span class="w">${esc(m[1])}<span class="ak">${esc(m[2])}<i class="strich"></i></span>${esc(m[3])}</span>` : `<span class="w">${esc(w)}</span>`
}).join(' ')}</span>`).join('')

function karte(b) {
  const id = `k${b.i}`
  const punkte = (b.karte?.punkte || []).slice(0, 4)
  if (b.typ === 'hook') return `<div class="kachel" id="${id}">${sym(b.symbol || 'warnung')}</div>`
  if (b.typ === 'problem' || b.typ === 'schritte') {
    const zeichen = b.typ === 'problem' ? 'kreuz' : 'haken'
    return `<div class="karte liste ${b.typ}" id="${id}">${b.karte?.titel ? `<div class="label">${esc(b.karte.titel)}</div>` : ''}${punkte.map((p, k) => `<div class="reihe" id="${id}-r${k}"><span class="pkt">${sym(zeichen)}</span><span class="txt">${esc(p)}</span></div>`).join('')}</div>`
  }
  if (b.typ === 'vergleich') return `<div class="paar" id="${id}"><div class="karte halb vorher" id="${id}-a"><div class="label">vorher</div><div class="gross">${esc(b.vorher)}</div><i class="durch"></i></div><div class="pfeil" id="${id}-p">→</div><div class="karte halb nachher" id="${id}-b"><div class="label">besser</div><div class="gross">${esc(b.nachher)}</div><span class="ok">${sym('haken')}</span></div></div>`
  if (b.typ === 'merksatz') return `<div class="karte satz" id="${id}"><span class="chip">${sym(b.symbol || 'idee')}</span><div class="satztext">${esc(b.satz || '').split(/\s+/).map((w) => `<span class="sw">${w}</span>`).join(' ')}</div></div>`
  if (b.typ === 'werkzeug') {
    const k = b.karte || {}
    return `<div class="karte dunkel werkzeug" id="${id}"><div class="wkopf"><b>${esc(k.titel)}</b><span class="gratis">kostenlos</span></div><div class="wsym">${sym(b.symbol || 'blitz')}</div><div class="pills">${(k.punkte || []).slice(0, 3).map((p) => `<span>${esc(p)}</span>`).join('')}</div><div class="knopf" id="${id}-knopf">${esc(k.knopf || 'Jetzt starten')}</div><div class="url">vamela.de${esc(inhalt.werkzeug || '')}</div></div>`
  }
  if (b.typ === 'schluss') return `<div class="ende" id="${id}"><img src="assets/logo.png" alt="VAMELA" class="logo"><div class="domain">vamela.de</div></div>`
  return `<div class="karte" id="${id}"></div>`
}

const L = beats.map((b) => lage(b.i))
const gruppen = beats.map((b) => `<div class="gruppe" id="g${b.i}" style="left:${L[b.i].x}px;top:${L[b.i].y}px"><div class="kopf" id="h${b.i}">${zeile(b.zeile || '', b.i)}</div>${karte(b)}</div>`).join('\n')
const linien = beats.slice(1).map((b) => { const a = L[b.i - 1], c = L[b.i]; const len = Math.hypot(c.x - a.x, c.y - a.y); return `<path id="l${b.i}" d="M${a.x} ${a.y} L${c.x} ${c.y}" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1" data-len="${Math.round(len)}"/>` }).join('')
const zeigerSvg = '<svg id="zeiger" viewBox="0 0 40 40"><path d="M9 4 L9 32 L16 25.5 L21 36 L26 33.8 L21 23.5 L31 23.5 Z" fill="#111" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>'
const hatTon = fs.existsSync('assets/ton.m4a')

const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <!-- Erzeugt von scripts/bauen-canvas.mjs aus inhalt.json. Nicht von Hand ändern. -->
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Inter"; font-weight: 100 900; src: url("assets/fonts/inter-var-latin.woff2") format("woff2"); }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1080px; height: 1920px; overflow: hidden; background: #F4F2EE; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; font-family: "Inter", sans-serif; color: #141414; }
      .clip { position: absolute; inset: 0; }
      #grund { background: #F4F2EE; }
      #kamera { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; transform-origin: ${SX}px ${SY}px; }
      #welt { position: absolute; left: 0; top: 0; width: 12000px; height: 16000px;
        background-color: #F4F2EE; background-image: linear-gradient(rgba(20,20,20,.05) 2px, transparent 2px), linear-gradient(90deg, rgba(20,20,20,.05) 2px, transparent 2px); background-size: 56px 56px; }
      #linien { position: absolute; left: 0; top: 0; width: 12000px; height: 16000px; overflow: visible; }
      #linien path { fill: none; stroke: #D8D3CB; stroke-width: 4; stroke-linecap: round; }
      .gruppe { position: absolute; width: 0; height: 0; }
      .kopf { position: absolute; left: -430px; width: 860px; bottom: 360px; text-align: center; font-weight: 750; font-size: 104px; line-height: 1.02; letter-spacing: -0.045em; }
      .zl { display: block; white-space: nowrap; } .w { display: inline-block; opacity: 0; }
      .ak { position: relative; color: #FF5B14; display: inline-block; }
      .strich { position: absolute; left: -2%; right: -2%; bottom: 4%; height: 12%; background: #FF5B14; opacity: .22; border-radius: 6px; transform-origin: 0 50%; transform: scaleX(0); }
      .karte { position: absolute; background: #fff; border: 2px solid #E9E5DE; border-radius: 40px; box-shadow: 0 30px 60px rgba(30,20,10,.08), 0 2px 6px rgba(30,20,10,.05); opacity: 0; }
      .label { font-size: 30px; font-weight: 650; letter-spacing: .04em; text-transform: uppercase; color: #8C857B; margin-bottom: 18px; }
      .liste { left: -400px; width: 800px; top: -300px; padding: 40px 44px; }
      .reihe { position: relative; display: flex; align-items: center; gap: 26px; height: 110px; padding: 0 26px; margin-top: 16px; border-radius: 26px; background: #F7F5F1; opacity: 0; }
      .pkt { flex: none; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; background: #E3DED6; }
      .problem .pkt { background: #FF5B14; } .pkt .sym { width: 58%; height: 58%; }
      .txt { font-size: 46px; font-weight: 650; letter-spacing: -0.02em; white-space: nowrap; }
      .durch { position: absolute; left: 110px; right: 30px; top: 50%; height: 5px; background: #141414; border-radius: 3px; transform-origin: 0 50%; transform: scaleX(0); }
      .kachel { position: absolute; left: -170px; top: -230px; width: 340px; height: 340px; border-radius: 90px; background: #FF5B14; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 40px 80px rgba(255,91,20,.28); opacity: 0; }
      .kachel .sym { width: 52%; height: 52%; }
      .paar { position: absolute; left: -440px; top: -260px; width: 880px; height: 420px; }
      .halb { top: 0; width: 380px; height: 420px; padding: 40px 36px; display: flex; flex-direction: column; justify-content: center; }
      .vorher { left: 0; } .nachher { right: 0; left: auto; border-color: #FF5B14; }
      .gross { font-size: 56px; font-weight: 750; letter-spacing: -0.03em; white-space: nowrap; }
      .vorher .gross { color: #8C857B; } .vorher .durch { left: 30px; right: 30px; top: 58%; }
      .pfeil { position: absolute; left: 400px; top: 170px; width: 80px; text-align: center; font-size: 64px; color: #BDB6AB; opacity: 0; }
      .ok { position: absolute; right: 26px; top: 26px; width: 64px; height: 64px; border-radius: 50%; background: #FF5B14; color: #fff; display: flex; align-items: center; justify-content: center; opacity: 0; }
      .ok .sym { width: 58%; height: 58%; }
      .satz { left: -400px; width: 800px; top: -280px; padding: 56px; display: flex; flex-direction: column; align-items: center; gap: 34px; }
      .chip { width: 120px; height: 120px; border-radius: 36px; background: #FFF0E6; color: #FF5B14; display: flex; align-items: center; justify-content: center; }
      .chip .sym { width: 56%; height: 56%; }
      .satztext { font-size: 78px; font-weight: 750; letter-spacing: -0.04em; line-height: 1.05; text-align: center; } .sw { display: inline-block; opacity: 0; }
      .werkzeug { left: -400px; width: 800px; top: -320px; padding: 46px; background: #161412; border-color: #161412; color: #fff; display: flex; flex-direction: column; align-items: center; gap: 28px; }
      .wkopf { width: 100%; display: flex; justify-content: space-between; align-items: center; } .wkopf b { font-size: 50px; letter-spacing: -0.03em; white-space: nowrap; }
      .gratis { font-size: 28px; font-weight: 650; padding: 10px 20px; border-radius: 999px; background: rgba(255,91,20,.18); color: #FF8A3D; }
      .wsym { width: 260px; height: 260px; border-radius: 70px; background: linear-gradient(145deg, #FF8A3D, #FF3D00); display: flex; align-items: center; justify-content: center; color: #fff; }
      .wsym .sym { width: 52%; height: 52%; }
      .pills { display: flex; gap: 14px; } .pills span { padding: 14px 24px; border-radius: 20px; background: rgba(255,255,255,.1); font-size: 30px; font-weight: 600; }
      .knopf { width: 100%; height: 120px; border-radius: 36px; background: #FF5B14; display: flex; align-items: center; justify-content: center; font-size: 46px; font-weight: 700; }
      .url { font-size: 28px; color: rgba(255,255,255,.6); white-space: nowrap; }
      .ende { position: absolute; left: -400px; width: 800px; top: -200px; display: flex; flex-direction: column; align-items: center; gap: 30px; opacity: 0; }
      .logo { width: 700px; height: auto; filter: invert(1) brightness(.1); }
      .domain { font-size: 56px; font-weight: 700; color: #FF5B14; }
      #zeiger { position: absolute; left: 0; top: 0; width: 92px; height: 92px; opacity: 0; filter: drop-shadow(0 6px 10px rgba(0,0,0,.2)); transform-origin: 22% 10%; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${DAUER}" data-width="1080" data-height="1920">
      <section id="grund" class="clip" data-start="0" data-duration="${DAUER}" data-track-index="0"></section>
      <section id="s-welt" class="clip" data-start="0" data-duration="${DAUER}" data-track-index="2">
        <div id="kamera"><div id="welt"><svg id="linien" viewBox="0 0 12000 16000">${linien}</svg>
${gruppen}
        </div></div>
      </section>
      <section id="s-zeiger" class="clip" data-start="0" data-duration="${DAUER}" data-track-index="6">${zeigerSvg}</section>
${hatTon ? `      <audio id="ton" src="assets/ton.m4a" data-start="0" data-duration="${DAUER}" data-track-index="7"></audio>` : ''}
    </div>
    <script>
      const BEATS = ${JSON.stringify(beats.map(({ i, typ, start, dauer: d }) => ({ i, typ, start, dauer: d })))};
      const L = ${JSON.stringify(L)};
      const DAUER = ${DAUER}, SX = ${SX}, SY = ${SY};
      function bauen() {
        const tl = gsap.timeline({ paused: true });
        const ziel = function (i) { return { x: SX - L[i].x, y: SY - L[i].y }; };
        gsap.set("#welt", ziel(0));
        BEATS.forEach(function (b, n) {
          const g = "#g" + b.i, k = "#k" + b.i, h = "#h" + b.i;
          // Kamerafahrt zur Gruppe: weich, mit kurzem Herauszoomen
          if (n > 0) {
            const t0 = Math.max(0, b.start - 0.35);
            tl.to("#welt", Object.assign(ziel(b.i), { duration: 0.95, ease: "power3.inOut" }), t0);
            tl.to("#kamera", { scale: 0.84, duration: 0.47, ease: "power2.inOut" }, t0);
            tl.to("#kamera", { scale: 1, duration: 0.48, ease: "power2.inOut" }, t0 + 0.47);
            tl.to("#l" + b.i, { strokeDashoffset: 0, duration: 0.8, ease: "power2.inOut" }, t0);
          }
          tl.to("#kamera", { scale: 1.035, duration: Math.max(0.4, b.dauer - 0.7), ease: "none" }, b.start + 0.2);
          // Überschrift wortweise
          tl.fromTo(h + " .w", { opacity: 0, y: 34, filter: "blur(10px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.5, ease: "expo.out", stagger: 0.07, immediateRender: false }, b.start + 0.05);
          tl.fromTo(h + " .strich", { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power3.out", immediateRender: false }, b.start + 0.55);
          // Karte
          const auf = function (sel, t, extra) { tl.fromTo(sel, Object.assign({ opacity: 0, y: 46, scale: 0.97, filter: "blur(8px)" }, extra || {}), { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.6, ease: "expo.out", immediateRender: false }, t); };
          if (b.typ === "hook") { auf(k, b.start + 0.3, { scale: 0.7 }); tl.fromTo(k + " .sym", { rotation: -12, scale: 0.8 }, { rotation: 0, scale: 1, duration: 0.7, ease: "expo.out", immediateRender: false }, b.start + 0.4); }
          if (b.typ === "problem" || b.typ === "schritte") {
            auf(k, b.start + 0.2);
            const rs = Array.prototype.slice.call(document.querySelectorAll(k + " .reihe"));
            const takt = Math.min(0.45, (b.dauer - 0.9) / Math.max(1, rs.length));
            rs.forEach(function (r, j) {
              const tj = b.start + 0.45 + j * takt;
              tl.fromTo(r, { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.45, ease: "expo.out", immediateRender: false }, tj);
              if (b.typ === "problem") tl.fromTo("#" + r.id + " .pkt", { scale: 0.3 }, { scale: 1, duration: 0.45, ease: "back.out(2.5)", immediateRender: false }, tj + 0.15);
              else {
                tl.fromTo("#" + r.id + " .pkt", { backgroundColor: "#E3DED6" }, { backgroundColor: "#FF5B14", duration: 0.2, immediateRender: false }, tj + 0.25);
                tl.fromTo("#zeiger", { x: SX - 300, y: SY - 140 + j * 126, opacity: 1 }, { x: SX - 320, y: SY - 160 + j * 126 + 40, opacity: 1, duration: 0.2, ease: "power2.out", immediateRender: false }, tj + 0.05);
                tl.to("#zeiger", { scale: 0.82, duration: 0.07, yoyo: true, repeat: 1 }, tj + 0.25);
              }
            });
            if (b.typ === "schritte") tl.to("#zeiger", { opacity: 0, duration: 0.2 }, b.start + 0.45 + rs.length * takt + 0.3);
          }
          if (b.typ === "vergleich") {
            auf(k + "-a", b.start + 0.25);
            tl.fromTo(k + "-a .durch", { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "power2.inOut", immediateRender: false }, b.start + 0.85);
            tl.fromTo(k + "-p", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.4, ease: "expo.out", immediateRender: false }, b.start + 0.95);
            auf(k + "-b", b.start + 1.05, { x: 40 });
            tl.fromTo(k + "-b .ok", { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)", immediateRender: false }, b.start + 1.4);
          }
          if (b.typ === "merksatz") {
            auf(k, b.start + 0.2);
            tl.fromTo(k + " .sw", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.45, ease: "expo.out", stagger: 0.09, immediateRender: false }, b.start + 0.45);
          }
          if (b.typ === "werkzeug") {
            auf(k, b.start + 0.2);
            const druck = b.start + b.dauer - 0.8;
            tl.fromTo("#zeiger", { x: SX + 380, y: SY + 520, opacity: 0 }, { x: SX + 60, y: SY + 260, opacity: 1, duration: 0.5, ease: "power3.inOut", immediateRender: false }, druck - 0.5);
            tl.to("#zeiger", { scale: 0.82, duration: 0.07, yoyo: true, repeat: 1 }, druck);
            tl.to(k + "-knopf", { scale: 0.95, duration: 0.08, yoyo: true, repeat: 1 }, druck);
            tl.to("#zeiger", { opacity: 0, duration: 0.3 }, druck + 0.35);
          }
          if (b.typ === "schluss") auf(k, b.start + 0.25, { scale: 0.9 });
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

// Ereignisse fürs Sounddesign (scripts/ton.mjs): leise Woosh bei jeder Fahrt, Ticks bei Reihen, Klick beim Werkzeug
const ev = [['pop', 0.3]]
for (const b of beats.slice(1)) ev.push(['whoosh', b.start - 0.35, 0.25])
for (const b of beats) {
  const n = (b.karte?.punkte || []).length, takt = Math.min(0.45, (b.dauer - 0.9) / Math.max(1, n))
  if (b.typ === 'problem' || b.typ === 'schritte') for (let k = 0; k < n; k++) ev.push(['tick', b.start + 0.45 + k * takt + 0.3, 1200 + k * 220])
  if (b.typ === 'vergleich') ev.push(['pop', b.start + 1.4])
  if (b.typ === 'werkzeug') ev.push(['klick', b.start + b.dauer - 0.8])
  if (b.typ === 'schluss') ev.push(['pop', b.start + 0.3])
}
fs.writeFileSync('plan.json', JSON.stringify({ dauer: DAUER, beats: beats.map(({ i, typ, start, dauer: d, sprech, stimme }) => ({ i, typ, start, dauer: d, sprech, stimme })), ereignisse: ev }, null, 2))
console.log(`index.html (canvas): ${beats.length} Beats, ${DAUER} s${beats.every((b) => b.stimme) ? ' (Zeiten aus der Stimme)' : ' (Zeiten geschätzt)'}`)
