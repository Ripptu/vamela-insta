// Look „keynote“ (Christian, 11.11.2026: „exakt so wie das Video auf dem Monitor, nur hochkant“, Referenz youtube.com/shorts/WnZXG1Ahyrk):
// Apple-Keynote-Stil. Tiefes Schwarz mit wandernden Lichtschleiern (VAMELA-Orange statt Grün, Regel „alles Grüne wird Orange“),
// kleine elegante weiße Schrift in der Mitte, schräg im Raum schwebende Glasflächen, ein Tunnel aus weißen Blättern, ein leuchtender
// Fortschrittsbalken, zum Schluss weißer Grund mit Logo. Szenen blenden weich mit Unschärfe über.
// Liest inhalt.json und assets/stimme/b<n>.wav wie bauen.mjs, schreibt index.html und plan.json (für scripts/ton.mjs).
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const inhalt = JSON.parse(fs.readFileSync('inhalt.json', 'utf8'))
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const r3 = (x) => +x.toFixed(3)
const quelle = fs.readFileSync(new URL('./bauen.mjs', import.meta.url), 'utf8')
const SYMBOLE = new Function(`return ${quelle.match(/const SYMBOLE = (\{[\s\S]*?\n\})/)[1]}`)()
const sym = (name) => `<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${SYMBOLE[name] || SYMBOLE.idee}</svg>`

const dauer = (f) => (fs.existsSync(f) ? Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString()) : null)
const VOR = 0.1
const MIN = { hook: 1.8, problem: 2.4, schritte: 2.6, vergleich: 2.4, merksatz: 2.2, werkzeug: 2.8, schluss: 2.4 }
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

const zeile = (text) => text.split(' / ').map((z) => `<span class="zl">${z.trim().split(/\s+/).map((w) => {
  const m = w.match(/^([^_\p{L}\d]*)_(.+)_([^_\p{L}\d]*)$/u)
  return `<span class="w">${m ? `${esc(m[1])}<span class="ak">${esc(m[2])}</span>${esc(m[3])}` : esc(w)}</span>`
}).join(' ')}</span>`).join('')

// Szeneninhalt je Beat-Typ
function buehne(b) {
  const id = `s${b.i}`
  const punkte = (b.karte?.punkte || []).slice(0, 4)
  if (b.typ === 'hook') return `<div class="ring" id="${id}-ring">${sym(b.symbol || 'warnung')}</div>`
  if (b.typ === 'problem') {
    // Tunnel aus weißen Blättern links und rechts, je Punkt ein Blatt mit Text
    const blaetter = Array.from({ length: 8 }, (_, k) => {
      const links = k % 2 === 0, tiefe = -300 - Math.floor(k / 2) * 700
      const text = punkte[Math.floor(k / 2)] || ''
      return `<div class="blatt" id="${id}-b${k}" style="transform: translate3d(${links ? -760 : 300}px, -380px, ${tiefe}px) rotateY(${links ? 72 : -72}deg)"><i></i><i></i><i class="kurz"></i>${text ? `<b>${esc(text)}</b>` : ''}<i></i><i class="kurz"></i></div>`
    }).join('')
    return `<div class="tunnel" id="${id}-t">${blaetter}</div>`
  }
  if (b.typ === 'schritte') return `<div class="glas schraeg" id="${id}-g">${b.karte?.titel ? `<div class="gtitel">${esc(b.karte.titel)}</div>` : ''}${punkte.map((p, k) => `<div class="greihe" id="${id}-r${k}"><span class="gpkt">${sym('haken')}</span><span>${esc(p)}</span></div>`).join('')}</div>`
  if (b.typ === 'vergleich') return `<div class="paar"><div class="glas klein matt" id="${id}-a"><div class="glabel">vorher</div><div class="gwert">${esc(b.vorher)}</div></div><div class="glas klein hell" id="${id}-b"><div class="glabel">besser</div><div class="gwert">${esc(b.nachher)}</div></div></div>`
  if (b.typ === 'merksatz') return `<div class="balken" id="${id}-bal"><div class="bspur"><i class="bfuell" id="${id}-f"></i></div><div class="bzahl" id="${id}-z">0%</div></div>`
  if (b.typ === 'werkzeug') {
    const k = b.karte || {}
    return `<div class="glas schraeg werkzeug" id="${id}-g"><div class="wsym">${sym(b.symbol || 'blitz')}</div><div class="gtitel">${esc(k.titel)}</div><div class="wpills">${(k.punkte || []).slice(0, 3).map((p) => `<span>${esc(p)}</span>`).join('')}</div><div class="wknopf" id="${id}-k">${esc(k.knopf || 'Jetzt starten')}</div></div>`
  }
  if (b.typ === 'schluss') return `<div class="ende" id="${id}-e"><img src="assets/logo.png" class="logo" alt="VAMELA"><div class="domain">vamela.de</div></div>`
  return ''
}

const szenen = beats.map((b) => `<div class="szene${b.typ === 'schluss' ? ' weiss' : ''}" id="sz${b.i}"><div class="raum" id="raum${b.i}">${buehne(b)}</div><div class="text${b.typ === 'merksatz' ? ' oben' : ''}" id="tx${b.i}">${zeile(b.zeile || '')}${b.typ === 'merksatz' && b.satz ? `<div class="unter">${esc(b.satz)}</div>` : ''}</div></div>`).join('\n')
const hatTon = fs.existsSync('assets/ton.m4a')

const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <!-- Erzeugt von scripts/bauen-keynote.mjs aus inhalt.json. Nicht von Hand ändern. -->
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Inter"; font-weight: 100 900; src: url("assets/fonts/inter-var-latin.woff2") format("woff2"); }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1080px; height: 1920px; overflow: hidden; background: #050505; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; font-family: "Inter", sans-serif; color: #F5F5F7; }
      .clip { position: absolute; inset: 0; }
      #grund { background: #050505; overflow: hidden; }
      .licht { position: absolute; border-radius: 50%; filter: blur(120px); }
      #l1 { left: -300px; top: 1100px; width: 1300px; height: 900px; background: radial-gradient(closest-side, rgba(255,110,30,.85), rgba(255,91,20,0)); }
      #l2 { left: 420px; top: -260px; width: 1100px; height: 1000px; background: radial-gradient(closest-side, rgba(255,150,60,.55), rgba(255,120,40,0)); }
      #l3 { left: 100px; top: 700px; width: 1500px; height: 360px; background: radial-gradient(closest-side, rgba(255,180,110,.45), rgba(255,160,90,0)); transform: rotate(-24deg); }
      #weissgrund { position: absolute; inset: 0; background: #F5F5F7; opacity: 0; }
      .szene { position: absolute; inset: 0; perspective: 1700px; opacity: 0; visibility: hidden; }
      .raum { position: absolute; left: 505px; top: 900px; width: 0; height: 0; transform-style: preserve-3d; }
      .text { position: absolute; left: 80px; width: 850px; top: 1240px; text-align: center; font-weight: 500; font-size: 66px; line-height: 1.12; letter-spacing: -0.02em; color: #F5F5F7; }
      .text.oben { top: 470px; }
      .weiss .text { color: #111; top: 520px; font-weight: 600; }
      .zl { display: block; white-space: nowrap; } .w { display: inline-block; opacity: 0; }
      .ak { background: linear-gradient(90deg, #FFB27A, #FF5B14); -webkit-background-clip: text; background-clip: text; color: transparent; font-weight: 650; }
      .unter { margin-top: 26px; font-size: 40px; font-weight: 400; color: rgba(245,245,247,.62); }
      .ring { position: absolute; left: -150px; top: -230px; width: 300px; height: 300px; border-radius: 50%; border: 3px solid rgba(255,255,255,.75); display: flex; align-items: center; justify-content: center; color: #fff; box-shadow: 0 0 80px rgba(255,120,40,.45), inset 0 0 40px rgba(255,120,40,.25); }
      .ring .sym { width: 46%; height: 46%; }
      .tunnel { position: absolute; left: 0; top: 0; transform-style: preserve-3d; }
      .blatt { position: absolute; width: 460px; height: 620px; background: #F7F7F5; border-radius: 22px; padding: 46px 40px; display: flex; flex-direction: column; gap: 22px; box-shadow: 0 0 60px rgba(0,0,0,.4); }
      .blatt i { display: block; height: 18px; border-radius: 9px; background: #DCDCD8; } .blatt i.kurz { width: 55%; }
      .blatt b { font-size: 44px; font-weight: 650; color: #111; letter-spacing: -0.02em; line-height: 1.1; }
      .glas { position: absolute; border-radius: 44px; background: linear-gradient(160deg, rgba(255,255,255,.16), rgba(255,255,255,.04)); border: 2px solid rgba(255,255,255,.22); box-shadow: 0 40px 120px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.25); -webkit-backdrop-filter: blur(24px); backdrop-filter: blur(24px); }
      .schraeg { left: -390px; width: 780px; top: -360px; padding: 44px; transform: rotateX(18deg) rotateY(-14deg); }
      .gtitel { font-size: 40px; font-weight: 600; color: rgba(245,245,247,.8); margin-bottom: 18px; }
      .greihe { display: flex; align-items: center; gap: 24px; height: 104px; font-size: 46px; font-weight: 550; opacity: 0; }
      .gpkt { width: 58px; height: 58px; border-radius: 50%; border: 2px solid rgba(255,255,255,.4); display: flex; align-items: center; justify-content: center; color: transparent; }
      .gpkt .sym { width: 60%; height: 60%; }
      .paar { position: absolute; left: -420px; top: -300px; width: 840px; height: 420px; transform-style: preserve-3d; }
      .klein { top: 0; width: 390px; height: 400px; padding: 40px; display: flex; flex-direction: column; justify-content: center; gap: 18px; }
      .matt { left: 0; transform: rotateY(24deg) translateZ(-120px); opacity: .55; } .hell { right: 0; transform: rotateY(-18deg); border-color: rgba(255,140,60,.8); box-shadow: 0 0 90px rgba(255,110,30,.35); }
      .glabel { font-size: 30px; letter-spacing: .08em; text-transform: uppercase; color: rgba(245,245,247,.55); }
      .gwert { font-size: 54px; font-weight: 600; letter-spacing: -0.03em; white-space: nowrap; }
      .matt .gwert { text-decoration: line-through; text-decoration-thickness: 3px; }
      .balken { position: absolute; left: -380px; width: 760px; top: -90px; }
      .bspur { position: relative; height: 34px; border-radius: 17px; background: rgba(255,255,255,.12); overflow: hidden; }
      .bfuell { position: absolute; left: 0; top: 0; bottom: 0; width: 0%; border-radius: 17px; background: linear-gradient(90deg, #FF5B14, #FFB27A); box-shadow: 0 0 40px rgba(255,120,40,.8); }
      .bzahl { margin-top: 40px; text-align: center; font-size: 150px; font-weight: 300; letter-spacing: -0.04em; }
      .werkzeug { display: flex; flex-direction: column; align-items: center; gap: 26px; }
      .wsym { width: 200px; height: 200px; border-radius: 56px; background: linear-gradient(145deg, #FF8A3D, #FF3D00); display: flex; align-items: center; justify-content: center; color: #fff; box-shadow: 0 0 70px rgba(255,91,20,.55); }
      .wsym .sym { width: 52%; height: 52%; }
      .wpills { display: flex; gap: 14px; } .wpills span { padding: 12px 22px; border-radius: 18px; background: rgba(255,255,255,.1); font-size: 30px; }
      .wknopf { width: 100%; height: 110px; border-radius: 34px; background: #F5F5F7; color: #111; display: flex; align-items: center; justify-content: center; font-size: 44px; font-weight: 650; }
      .ende { position: absolute; left: -350px; width: 700px; top: -180px; display: flex; flex-direction: column; align-items: center; gap: 26px; }
      .logo { width: 560px; height: auto; filter: invert(1) brightness(.12); }
      .domain { font-size: 46px; font-weight: 600; color: #FF5B14; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${DAUER}" data-width="1080" data-height="1920">
      <section id="grund" class="clip" data-start="0" data-duration="${DAUER}" data-track-index="0"><i class="licht" id="l1"></i><i class="licht" id="l2"></i><i class="licht" id="l3"></i><div id="weissgrund"></div></section>
      <section id="s-szenen" class="clip" data-start="0" data-duration="${DAUER}" data-track-index="2">
${szenen}
      </section>
${hatTon ? `      <audio id="ton" src="assets/ton.m4a" data-start="0" data-duration="${DAUER}" data-track-index="7"></audio>` : ''}
    </div>
    <script>
      const BEATS = ${JSON.stringify(beats.map(({ i, typ, start, dauer: d }) => ({ i, typ, start, dauer: d })))};
      const DAUER = ${DAUER};
      function bauen() {
        const tl = gsap.timeline({ paused: true });
        // Lichtschleier wandern langsam, Puls bei jedem Schnitt
        tl.fromTo("#l1", { x: 0, y: 0 }, { x: 260, y: -220, duration: DAUER, ease: "sine.inOut" }, 0);
        tl.fromTo("#l2", { x: 0, y: 0 }, { x: -240, y: 260, duration: DAUER, ease: "sine.inOut" }, 0);
        tl.fromTo("#l3", { x: -200, rotation: -24 }, { x: 240, rotation: -10, duration: DAUER, ease: "sine.inOut" }, 0);
        BEATS.forEach(function (b, n) {
          const sz = "#sz" + b.i, tx = "#tx" + b.i, raum = "#raum" + b.i, s = "#s" + b.i, ende = b.start + b.dauer;
          // Szene weich ein- und ausblenden (mit Unschärfe), Raum fährt langsam heran
          tl.fromTo(sz, { autoAlpha: 0, scale: 1.06, filter: "blur(14px)" }, { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.55, ease: "power3.out", immediateRender: false }, Math.max(0, b.start - 0.12));
          if (n < BEATS.length - 1) tl.to(sz, { autoAlpha: 0, scale: 0.97, filter: "blur(14px)", duration: 0.4, ease: "power2.in" }, ende - 0.3);
          tl.fromTo(raum, { z: -200 }, { z: 60, duration: b.dauer + 0.3, ease: "none", immediateRender: false }, b.start - 0.12);
          tl.to(["#l1", "#l2"], { opacity: 0.55, duration: 0.2, yoyo: true, repeat: 1, ease: "sine.inOut" }, b.start - 0.1);
          // Schrift: Wort für Wort, aus weiter Laufweite und Unschärfe
          tl.fromTo(tx + " .w", { opacity: 0, y: 18, letterSpacing: "0.12em", filter: "blur(10px)" }, { opacity: 1, y: 0, letterSpacing: "0em", filter: "blur(0px)", duration: 0.7, ease: "power3.out", stagger: 0.08, immediateRender: false }, b.start + 0.15);
          if (b.typ === "hook") {
            tl.fromTo(s + "-ring", { scale: 0.6, opacity: 0, rotationX: 40 }, { scale: 1, opacity: 1, rotationX: 0, duration: 0.9, ease: "power3.out", immediateRender: false }, b.start + 0.05);
          } else if (b.typ === "problem") {
            tl.fromTo(s + "-t", { z: -900 }, { z: 900, duration: b.dauer + 0.4, ease: "power1.inOut", immediateRender: false }, b.start - 0.12);
            document.querySelectorAll(s + "-t .blatt").forEach(function (el, k) { tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out", immediateRender: false }, b.start + 0.05 + k * 0.06); });
          } else if (b.typ === "schritte") {
            tl.fromTo(s + "-g", { opacity: 0, rotationX: 40, rotationY: -30, y: 80 }, { opacity: 1, rotationX: 18, rotationY: -14, y: 0, duration: 0.9, ease: "power3.out", immediateRender: false }, b.start + 0.05);
            const rs = document.querySelectorAll(s + "-g .greihe"), takt = Math.min(0.45, (b.dauer - 1) / Math.max(1, rs.length));
            rs.forEach(function (r, k) {
              const tk = b.start + 0.5 + k * takt;
              tl.fromTo(r, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.45, ease: "power3.out", immediateRender: false }, tk);
              tl.fromTo("#" + r.id + " .gpkt", { backgroundColor: "rgba(255,91,20,0)", color: "rgba(255,255,255,0)", borderColor: "rgba(255,255,255,.4)" }, { backgroundColor: "#FF5B14", color: "#ffffff", borderColor: "#FF5B14", duration: 0.25, ease: "power2.out", immediateRender: false }, tk + 0.25);
            });
          } else if (b.typ === "vergleich") {
            tl.fromTo(s + "-a", { opacity: 0, x: -60 }, { opacity: 0.55, x: 0, duration: 0.7, ease: "power3.out", immediateRender: false }, b.start + 0.1);
            tl.fromTo(s + "-b", { opacity: 0, x: 60, scale: 0.92 }, { opacity: 1, x: 0, scale: 1, duration: 0.8, ease: "power3.out", immediateRender: false }, b.start + Math.min(1.1, b.dauer * 0.4));
          } else if (b.typ === "merksatz") {
            const z = { v: 0 }, el = document.querySelector(s + "-z");
            tl.fromTo(s + "-f", { width: "0%" }, { width: "100%", duration: Math.max(1, b.dauer - 0.8), ease: "power2.inOut", immediateRender: false }, b.start + 0.3);
            tl.fromTo(z, { v: 0 }, { v: 100, duration: Math.max(1, b.dauer - 0.8), ease: "power2.inOut", immediateRender: false, onUpdate: function () { el.textContent = Math.round(z.v) + "%"; } }, b.start + 0.3);
          } else if (b.typ === "werkzeug") {
            tl.fromTo(s + "-g", { opacity: 0, rotationX: 40, rotationY: 20, y: 80 }, { opacity: 1, rotationX: 18, rotationY: -14, y: 0, duration: 0.9, ease: "power3.out", immediateRender: false }, b.start + 0.05);
            tl.to(s + "-k", { scale: 0.95, duration: 0.1, yoyo: true, repeat: 1 }, ende - 0.8);
          } else if (b.typ === "schluss") {
            tl.to("#weissgrund", { opacity: 1, duration: 0.6, ease: "power2.inOut" }, b.start - 0.12);
            tl.fromTo(s + "-e", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.9, ease: "power3.out", immediateRender: false }, b.start + 0.25);
          }
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

const ev = [['pop', 0.2]]
for (const b of beats.slice(1)) ev.push(['whoosh', b.start - 0.15, 0.3])
for (const b of beats) {
  const n = (b.karte?.punkte || []).length, takt = Math.min(0.45, (b.dauer - 1) / Math.max(1, n))
  if (b.typ === 'schritte') for (let k = 0; k < n; k++) ev.push(['tick', b.start + 0.5 + k * takt + 0.25, 1200 + k * 220])
  if (b.typ === 'vergleich') ev.push(['pop', b.start + Math.min(1.1, b.dauer * 0.4)])
  if (b.typ === 'werkzeug') ev.push(['klick', b.start + b.dauer - 0.8])
  if (b.typ === 'schluss') ev.push(['funkeln', b.start + 0.3])
}
fs.writeFileSync('plan.json', JSON.stringify({ dauer: DAUER, beats: beats.map(({ i, typ, start, dauer: d, sprech, stimme }) => ({ i, typ, start, dauer: d, sprech, stimme })), ereignisse: ev }, null, 2))
console.log(`index.html (keynote): ${beats.length} Beats, ${DAUER} s${beats.every((b) => b.stimme) ? ' (Zeiten aus der Stimme)' : ' (Zeiten geschätzt)'}`)
