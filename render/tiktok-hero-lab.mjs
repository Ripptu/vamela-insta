// Hero-Entwürfe für TikTok (Christian, 14.10.2026): fünf Aufmacher-Ideen mit dem Tier-Bild, alles im Sicherheitsbereich
// (oben ab 210, unten bis 1440, links ab 60, rechts bis 930; TikTok blendet dort Kopfleiste, Beschreibung und Knöpfe ein).
import fs from 'node:fs'
import path from 'node:path'
import { esc, GH } from './stil-klar.mjs'
import { freistellen } from './freistellen.mjs'

const BASIS = path.resolve(new URL('.', import.meta.url).pathname)
const CURSOR = ['X...........', 'XX..........', 'XOX.........', 'XOOX........', 'XOOOX.......', 'XOOOOX......', 'XOOOOOX.....', 'XOOOOOOX....', 'XOOOOOOOX...', 'XOOOOOOOOX..', 'XOOOOOXXXXX.', 'XOOXOOX.....', 'XOX.XOOX....', 'XX..XOOX....', 'X....XOOX...', '.....XOOX...', '......XX....']
const cursor = (x, y, px = 8, r = 0) => `<svg style="position:absolute;left:${x}px;top:${y}px;transform:rotate(${r}deg);filter:drop-shadow(0 8px 10px rgba(0,0,0,.35));z-index:9" width="${12 * px}" height="${CURSOR.length * px}" viewBox="0 0 12 ${CURSOR.length}" shape-rendering="crispEdges">${CURSOR.map((z, j) => [...z].map((c, i) => c === '.' ? '' : `<rect x="${i}" y="${j}" width="1" height="1" fill="${c === 'X' ? '#101828' : '#fff'}"/>`).join('')).join('')}</svg>`
const burst = (n, r1, r2) => { const p = []; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1; const a = Math.PI * i / n - Math.PI / 2; p.push(`${(50 + 50 * r * Math.cos(a)).toFixed(2)},${(50 + 50 * r * Math.sin(a)).toFixed(2)}`) } return p.join(' ') }

const BASE = (bild, extra = '') => `<!doctype html><html><head><meta charset=utf-8><base href="file://${BASIS}/">
<link rel=stylesheet href="orange/fonts.css">
<style>
@font-face{font-family:'Inter Tight';font-weight:500;src:url(fonts/InterTight-500.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:600;src:url(fonts/InterTight-600.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:700;src:url(fonts/InterTight-700.woff2) format('woff2')}
@font-face{font-family:'Inter Tight';font-weight:800;src:url(fonts/InterTight-800.woff2) format('woff2')}
@font-face{font-family:Caveat;font-weight:400 700;src:url(fonts/Caveat.woff2) format('woff2')}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:#2f7fd8;font-family:'Inter Tight',sans-serif}
.foto{position:absolute;inset:0;width:1080px;height:1920px;object-fit:cover;object-position:center 60%}
.korn{position:absolute;inset:0;background:url(orange/noise.png);opacity:.2;mix-blend-mode:overlay;z-index:20;pointer-events:none}
.tier{position:absolute;left:0;top:0;width:1080px;height:1920px;z-index:7;pointer-events:none}
.sky{position:absolute;inset:0 0 auto 0;height:760px;background:linear-gradient(180deg,rgba(8,35,90,.30),rgba(8,35,90,0))}
.repo{position:absolute;left:50%;top:216px;transform:translateX(-50%);display:flex;align-items:center;gap:14px;white-space:nowrap;background:rgba(13,17,23,.95);border:2px solid #30363d;border-radius:999px;padding:14px 26px;color:#e6edf3;box-shadow:0 12px 34px rgba(0,0,0,.4);z-index:12}
.repo svg{font-size:36px}.repo b{font:700 31px/1 'DejaVu Sans Mono',Menlo,monospace;color:#58a6ff;letter-spacing:-.02em}
.repo i{font:700 24px/1 'Inter Tight';font-style:normal;border:2px solid #30363d;border-radius:999px;padding:7px 14px}.repo i.g{background:#238636;border-color:#238636;color:#fff}
${extra}
</style></head><body>${bild}`
const repoChip = (r) => `<div class=repo>${GH}<b>${esc(r.name)}</b><i>★ ${esc(r.sterne)}</i><i class=g>GRATIS</i></div>`
const FIN = '<div class=korn></div></body></html>'

/** 1: Fehlermeldung wie im Betriebssystem, der Mauszeiger zeigt auf „Gratis lösen“. */
function fehler(bild, r) {
  return BASE(`<img class=foto src="file://${bild}"><div class=sky></div>
<div class=dlg><div class=tb><i style=background:#ff5f56></i><i style=background:#ffbd2e></i><i style=background:#27c93f></i><span>Fehler</span></div>
<div class=bd><div class=ic>!</div><div><div class=t1>Dein Foto ist zu klein.</div><div class=t2>logo_klein.jpg · 200 × 200 Pixel</div></div></div>
<div class=bt><span class=b1>Pixelig drucken</span><span class=b2>Gratis lösen</span></div></div>${cursor(740, 560, 9, -6)}
<div class=hand>Klick hier ↑</div>${repoChip(r)}`, `
.dlg{position:absolute;left:60px;top:350px;width:870px;background:#f6f6f7;border-radius:26px;box-shadow:0 30px 70px rgba(0,20,70,.5);overflow:hidden;z-index:6}
.tb{display:flex;align-items:center;gap:12px;padding:20px 26px;background:#e4e5e8;border-bottom:2px solid #d0d1d5}.tb i{width:22px;height:22px;border-radius:50%}.tb span{margin:0 auto;padding-right:90px;font:700 28px/1 'Inter Tight';color:#555}
.bd{display:flex;gap:30px;align-items:center;padding:44px 40px 30px}.ic{flex:none;width:104px;height:104px;border-radius:50%;background:#e5322d;color:#fff;font:800 70px/104px 'Inter Tight';text-align:center;box-shadow:0 10px 20px rgba(229,50,45,.4)}
.t1{font:800 56px/1.05 'Inter Tight';letter-spacing:-.02em;color:#141414}.t2{margin-top:12px;font:500 30px/1.2 'Inter Tight';color:#6b6f78}
.bt{display:flex;justify-content:flex-end;gap:20px;padding:10px 40px 40px}.bt span{font:700 36px/1 'Inter Tight';padding:22px 34px;border-radius:16px}.b1{background:#e0e1e5;color:#333}.b2{background:#0a63d6;color:#fff;box-shadow:0 10px 22px rgba(10,99,214,.5)}
.hand{position:absolute;left:560px;top:760px;font:700 62px/1 Caveat;color:#ffe45e;-webkit-text-stroke:2px #0a2f73;paint-order:stroke fill;text-shadow:0 4px 0 #0a2f73;transform:rotate(-6deg);z-index:9}`) + FIN
}

/** 2: Chat-Verlauf. */
function chat(bild, r) {
  return BASE(`<img class=foto src="file://${bild}"><div class=sky></div>
<div class=kontakt><span class=av>K</span><b>Kunde</b></div>
<div class="bu in" style="top:430px">Das Foto ist total verpixelt.</div>
<div class="bu in" style="top:560px;width:620px">Geht das noch zu retten?</div>
<div class="bu out" style="top:710px;white-space:nowrap">Ja. Gratis-Tool. 0 €</div>
<div class=zug>Zugestellt</div>
<div class="bu in tipp" style="top:900px"><i></i><i></i><i></i></div>${repoChip(r)}`, `
.kontakt{position:absolute;left:60px;top:330px;display:flex;align-items:center;gap:16px;background:rgba(255,255,255,.92);border-radius:999px;padding:12px 30px 12px 12px;font:700 34px/1 'Inter Tight';color:#141414;box-shadow:0 10px 24px rgba(0,30,90,.3);z-index:6}.av{width:58px;height:58px;border-radius:50%;background:linear-gradient(145deg,#9aa3b2,#5c6573);color:#fff;display:grid;place-items:center;font:800 32px/1 'Inter Tight'}
.bu{position:absolute;max-width:760px;padding:28px 38px;border-radius:46px;font:600 50px/1.15 'Inter Tight';letter-spacing:-.015em;box-shadow:0 14px 34px rgba(0,20,70,.35);z-index:6}
.in{left:60px;background:#f1f1f3;color:#141414;border-bottom-left-radius:12px}.out{right:150px;background:#0a84ff;color:#fff;border-bottom-right-radius:12px;font-weight:800}
.zug{position:absolute;right:150px;top:880px;font:600 26px/1 'Inter Tight';color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.5);z-index:6}
.tipp{display:flex;gap:12px;padding:30px 36px;width:auto}.tipp i{width:20px;height:20px;border-radius:50%;background:#9a9ca2}`) + FIN
}

/** 3: Riesiger Preis-Sticker „0 €“. */
function sticker(bild, r) {
  return BASE(`<img class=foto src="file://${bild}"><div class=sky></div>
<div class=bs><svg viewBox="0 0 100 100"><polygon points="${burst(18, 1, .86)}" fill="#e5322d" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/></svg><span>0 €</span></div>
<div class=txt><div>KEIN ABO.</div><div>KEIN TRICK.</div></div>
<div class=hand>für Fotos in groß</div>${repoChip(r)}`, `
.bs{position:absolute;left:40px;top:320px;width:470px;height:470px;transform:rotate(-10deg);filter:drop-shadow(0 20px 28px rgba(60,0,0,.45));z-index:6}.bs svg{position:absolute;inset:0;width:100%;height:100%}
.bs span{position:absolute;inset:0;display:grid;place-items:center;font:800 170px/1 'Inter Tight';letter-spacing:-.05em;color:#fff;text-shadow:0 8px 0 #9d1612}
.txt{position:absolute;left:545px;top:430px;width:385px;font:800 66px/1.0 'Inter Tight';letter-spacing:-.03em;color:#fff;text-shadow:0 6px 26px rgba(0,25,80,.55);z-index:6}.txt div+div{color:#ffe45e}
.hand{position:absolute;left:520px;top:650px;font:700 62px/1 Caveat;color:#fff;-webkit-text-stroke:2px #0a2f73;paint-order:stroke fill;text-shadow:0 4px 0 #0a2f73;transform:rotate(-4deg);z-index:9}`) + FIN
}

/** 4: Eilmeldung im Nachrichtenstil. */
function eilmeldung(bild, r) {
  return BASE(`<img class=foto src="file://${bild}"><div class=sky></div>
<div class=news><div class=top><span class=live><i></i>EILMELDUNG</span><span class=sender>GITHUB NEWS</span></div>
<div class=hl>Verpixeltes Foto gerettet: <u>Gratis-Tool</u> rechnet Bilder in groß</div>
<div class=tick><span>★ 50.000 BEWERTUNGEN</span><span>·</span><span>0 €</span><span>·</span><span>OHNE ABO</span></div></div>${repoChip(r)}`, `
.news{position:absolute;left:60px;top:340px;width:870px;z-index:6;box-shadow:0 26px 60px rgba(0,15,60,.5)}
.top{display:flex;justify-content:space-between;align-items:stretch;font:800 34px/1 'Inter Tight';letter-spacing:.04em}
.live{display:flex;align-items:center;gap:16px;background:#e5322d;color:#fff;padding:22px 32px}.live i{width:22px;height:22px;border-radius:50%;background:#fff}
.sender{background:#fff;color:#0a2f73;padding:22px 30px;display:flex;align-items:center}
.hl{background:#0b2a6b;color:#fff;font:800 70px/1.04 'Inter Tight';letter-spacing:-.025em;padding:36px 36px 40px}.hl u{text-decoration:none;color:#ffe45e}
.tick{display:flex;gap:22px;background:#ffe45e;color:#141414;font:800 30px/1 'Inter Tight';padding:20px 30px;letter-spacing:.03em}`) + FIN
}

/** 5: Vorher/Nachher quer geteilt: links Pixel, rechts scharf. */
function split(bild, r, o = {}) {
  const { h1 = 'DAS GLEICHE FOTO.', h2 = 'MIT *0 €* RETTEN.', tagL = 'VORHER', tagR = 'NACHHER' } = o
  const hh = (t) => esc(t).replace(/\*([^*]+)\*/g, '<span>$1</span>')
  return BASE(`<img class=foto src="file://${bild}">
<canvas id=px width=1080 height=1920 style="position:absolute;inset:0;clip-path:polygon(0 560px,720px 560px,500px 1440px,0 1440px)"></canvas>
<div class=linie></div><div class=sky></div>
<div class=h1>${hh(h1)}</div><div class=h2>${hh(h2)}</div>
<span class="tag v">${esc(tagL)}</span><span class="tag n">${esc(tagR)}</span>${repoChip(r)}
<script>const i=new Image();i.onload=()=>{const c=document.getElementById('px'),x=c.getContext('2d'),s=document.createElement('canvas');s.width=26;s.height=46;const sx=s.getContext('2d');const sc=Math.max(1080/i.width,1920/i.height),w=i.width*sc,h=i.height*sc;sx.drawImage(i,(1080-w)/2*26/1080-0,(1920-h)*0.6*46/1920,w*26/1080,h*46/1920);x.imageSmoothingEnabled=false;x.drawImage(s,0,0,1080,1920);document.body.dataset.px='1'};i.src='file://${bild}'</script>`, `
.linie{position:absolute;inset:0;background:#fff;clip-path:polygon(720px 560px,730px 560px,510px 1440px,500px 1440px);z-index:4}
.h1{position:absolute;left:60px;top:320px;width:870px;font:800 80px/1 'Inter Tight';letter-spacing:-.03em;color:#fff;text-shadow:0 6px 26px rgba(0,25,80,.6);z-index:6}
.h2{position:absolute;left:60px;top:412px;font:800 80px/1 'Inter Tight';letter-spacing:-.03em;color:#fff;text-shadow:0 6px 26px rgba(0,25,80,.6);z-index:6}.h2 span{background:#ffe45e;color:#141414;padding:0 .14em;border-radius:12px;text-shadow:none}
.tag{position:absolute;top:1170px;font:800 40px/1 'Inter Tight';letter-spacing:.06em;padding:16px 26px;border-radius:12px;z-index:7;box-shadow:6px 8px 0 rgba(20,20,20,.9)}.v{left:70px;background:#fff;color:#141414;transform:rotate(-4deg)}.n{left:610px;background:#ffe45e;color:#141414;transform:rotate(3deg)}`) + FIN
}


const H = (t) => esc(t).replace(/\*([^*]+)\*/g, '<mark>$1</mark>')

/** 6: Das Tier spricht: Comic-Sprechblase mit dem Hook. */
function comic(bild, r, o = {}) {
  const { hook = 'Fotos per Mail an *dich selbst?*', sub = 'Echt jetzt?!' } = o
  return BASE(`<img class=foto src="file://${bild}"><div class=sky></div>
<div class=sb><div class=t>${H(hook)}</div><i class=tail></i></div><div class=hand>${esc(sub)}</div>${repoChip(r)}`, `
.sb{position:absolute;left:60px;top:350px;width:870px;background:#fff;border:9px solid #111;border-radius:60px;padding:46px 50px 52px;box-shadow:12px 14px 0 rgba(10,30,90,.55);z-index:6;transform:rotate(-1.2deg)}
.t{font:800 88px/1.02 'Inter Tight';letter-spacing:-.03em;color:#111;text-wrap:balance}.t mark{background:#ffe45e;color:#111;padding:0 .1em;border-radius:10px}
.tail{position:absolute;left:380px;bottom:-78px;width:90px;height:90px;background:#fff;border-right:9px solid #111;border-bottom:9px solid #111;transform:skewX(-22deg) rotate(45deg) scale(.8);transform-origin:top left;z-index:-1}
.hand{position:absolute;left:560px;top:720px;font:700 78px/1 Caveat;color:#ffe45e;-webkit-text-stroke:2px #0a2f73;paint-order:stroke fill;text-shadow:0 4px 0 #0a2f73;transform:rotate(-5deg);z-index:9}`) + FIN
}

/** 7: Suchleiste mit Autovervollständigung. */
function suche(bild, r, o = {}) {
  const { hook = 'design tool kostenlos ohne abo', vorschlaege = ['design tool kostenlos ohne abo', 'design tool kostenlos open source'], treffer = 'Ca. 6.800.000 Ergebnisse' } = o
  return BASE(`<img class=foto src="file://${bild}"><div class=sky></div>
<div class=box><div class=bar><svg viewBox="0 0 24 24" width="46" height="46"><circle cx="10" cy="10" r="6.5" fill="none" stroke="#5f6368" stroke-width="2.6"/><path d="m15 15 6 6" stroke="#5f6368" stroke-width="2.8" stroke-linecap="round"/></svg><span>${esc(hook)}</span><i class=caret></i></div>
<div class=vs>${vorschlaege.map((v, i) => `<div class="v${i === 0 ? ' a' : ''}"><svg viewBox="0 0 24 24" width="34" height="34"><circle cx="10" cy="10" r="6.5" fill="none" stroke="#9aa0a6" stroke-width="2.4"/><path d="m15 15 6 6" stroke="#9aa0a6" stroke-width="2.6" stroke-linecap="round"/></svg>${esc(v)}</div>`).join('')}</div></div>
${repoChip(r)}`, `
.box{position:absolute;left:60px;top:315px;width:870px;background:#fff;border-radius:44px;box-shadow:0 28px 64px rgba(0,20,70,.5);overflow:hidden;z-index:6}
.bar{display:flex;align-items:center;gap:22px;padding:26px 36px;font:500 48px/1.1 'Inter Tight';color:#202124;border-bottom:2px solid #eceff1}.caret{display:inline-block;width:5px;height:60px;background:#1a73e8;margin-left:-14px}
.vs{padding:10px 0 18px}.v{display:flex;align-items:center;gap:24px;padding:18px 36px;font:500 40px/1.1 'Inter Tight';color:#202124}.v.a{background:#e8f0fe}
.hand{position:absolute;left:70px;top:610px;font:700 60px/1 Caveat;color:#fff;-webkit-text-stroke:2px #0a2f73;paint-order:stroke fill;text-shadow:0 4px 0 #0a2f73;transform:rotate(-3deg);z-index:9}`) + FIN
}

/** 8: Sperrbildschirm mit drei Mitteilungen. */
function sperrbild(bild, r, o = {}) {
  const { n = [['Dein Foto ist zu klein', 'Gedruckt wird es pixelig.'], ['Gratis-Tool gefunden', '50.000 Sterne auf GitHub'], ['Jetzt retten', 'Dauert 2 Minuten ›']] } = o
  return BASE(`<img class=foto src="file://${bild}"><div class=sky></div>
<div class=ns>${n.slice(0, o._kopfY && o._kopfY < 640 ? 1 : 2).map(([a, b], i) => `<div class=n style="transform:translateX(${[0, 14, 28][i]}px)"><span class=ic>${GH}</span><div><div class=nt><b>GitHub</b><em>${['jetzt', 'vor 1 Min.', 'vor 2 Min.'][i]}</em></div><div class=n1>${esc(a)}</div><div class=n2>${esc(b)}</div></div></div>`).join('')}</div>${repoChip(r)}`, `
.uhr{position:absolute;left:0;width:1080px;text-align:center;top:310px;font:700 130px/1 'Inter Tight';color:#fff;text-shadow:0 6px 30px rgba(0,25,80,.5);letter-spacing:-.02em;z-index:6}
.ns{position:absolute;left:60px;width:840px;top:320px;display:flex;flex-direction:column;gap:16px;z-index:6}
.n{display:flex;gap:22px;align-items:flex-start;background:rgba(245,247,252,.93);border-radius:34px;padding:20px 28px;box-shadow:0 18px 44px rgba(0,20,70,.4)}
.ic{flex:none;width:76px;height:76px;border-radius:19px;background:#0d1117;color:#fff;display:grid;place-items:center;font-size:52px}
.nt{display:flex;justify-content:space-between;font:600 24px/1 'Inter Tight';color:#555;width:640px}.nt b{letter-spacing:.04em;text-transform:uppercase}.nt em{font-style:normal}
.n1{font:800 44px/1.1 'Inter Tight';color:#111;margin-top:8px;letter-spacing:-.02em}.n2{font:500 34px/1.2 'Inter Tight';color:#333;margin-top:4px}`) + FIN
}

/** 9: Umfrage-Sticker wie in den Stories. */
function umfrage(bild, r, o = {}) {
  const { frage = 'Verschickst du Fotos noch per *Mail?*', a = 'Ja, leider', b = 'Nein, direkt' } = o
  return BASE(`<img class=foto src="file://${bild}"><div class=sky></div>
<div class=sticker><div class=kopf>UMFRAGE</div><div class=fr>${H(frage)}</div><div class=bt><span>${esc(a)}</span><span>${esc(b)}</span></div></div>
${repoChip(r)}`, `
.sticker{position:absolute;left:60px;top:315px;width:870px;background:#fff;border-radius:48px;box-shadow:0 28px 64px rgba(0,20,70,.5);overflow:hidden;z-index:6;transform:rotate(-1.5deg)}
.kopf{background:linear-gradient(90deg,#833ab4,#fd1d1d,#fcb045);color:#fff;font:800 30px/1 'Inter Tight';letter-spacing:.14em;text-align:center;padding:18px}
.fr{font:800 62px/1.06 'Inter Tight';letter-spacing:-.03em;color:#111;padding:26px 40px 22px;text-wrap:balance}.fr mark{background:none;color:#e5322d}
.bt{display:flex;gap:18px;padding:4px 32px 28px}.bt span{flex:1;text-align:center;font:700 40px/1 'Inter Tight';padding:24px 10px;border-radius:26px;background:#f1f1f3;color:#111}.bt span+span{background:#111;color:#fff}
.hand{position:absolute;left:600px;top:640px;font:700 70px/1 Caveat;color:#ffe45e;-webkit-text-stroke:2px #0a2f73;paint-order:stroke fill;text-shadow:0 4px 0 #0a2f73;transform:rotate(-6deg);z-index:9}`) + FIN
}

/** 10: Stoppschild mit Hook. */
function stopp(bild, r, o = {}) {
  const { hook = 'Zahl nicht für *Design-Software.*', sub = 'Es geht auch gratis' } = o
  return BASE(`<img class=foto src="file://${bild}"><div class=sky></div>
<div class=stop><svg viewBox="0 0 100 100"><polygon points="30,3 70,3 97,30 97,70 70,97 30,97 3,70 3,30" fill="#e5322d" stroke="#fff" stroke-width="4"/><polygon points="30,9 70,9 91,30 91,70 70,91 30,91 9,70 9,30" fill="none" stroke="#fff" stroke-width="1.4"/></svg><span>STOPP</span></div>
<div class=hk>${H(hook)}</div><div class=sb>${esc(sub)}</div>${repoChip(r)}`, `
.stop{position:absolute;left:60px;top:325px;width:280px;height:300px;transform:rotate(-8deg);z-index:6;filter:drop-shadow(0 18px 26px rgba(60,0,0,.5))}.stop svg{position:absolute;inset:0;width:100%;height:100%}.stop span{position:absolute;inset:0;display:grid;place-items:center;font:800 70px/1 'Inter Tight';color:#fff;letter-spacing:.02em}
.hk{position:absolute;left:390px;top:335px;width:540px;font:800 70px/1.02 'Inter Tight';letter-spacing:-.03em;color:#fff;text-shadow:0 6px 28px rgba(0,25,80,.6);z-index:6}.hk mark{background:#ffe45e;color:#111;padding:0 .08em;border-radius:8px;text-shadow:none}
.sb{position:absolute;left:390px;top:580px;background:#ffe45e;color:#141414;font:800 38px/1 'Inter Tight';padding:18px 28px;border-radius:12px;box-shadow:6px 8px 0 rgba(20,20,20,.9);transform:rotate(-2deg);z-index:6}`) + FIN
}

export const HEROS = { fehler, chat, sticker, eilmeldung, split, comic, suche, sperrbild, umfrage, stopp }

const UI = { comic: ['.sb'], suche: ['.box'], sperrbild: ['.ns'], umfrage: ['.sticker'], stopp: ['.stop', '.hk', '.sb'] }

export async function renderHero(eng, art, { bild, repo, datei, debug = false, text = {}, tierVorn = true }) {
  let kopfY = 1920
  const page = await eng._i.ctx.newPage()
  try {
    await page.setViewportSize({ width: 1080, height: 1920 })
    const cut = path.join(path.dirname(datei), `.tier-${path.basename(bild, path.extname(bild))}.png`)
    fs.mkdirSync(path.dirname(datei), { recursive: true })
    if (tierVorn && art !== 'split') kopfY = (await freistellen(path.resolve(bild), cut)).kopfY
    let html = HEROS[art](path.resolve(bild), repo, { ...text, _kopfY: kopfY })
    // Das Tier steht immer vorn (Christian, 14.10.2026): freigestellte Fassung über alle Elemente legen, Repo-Pille und Handschrift bleiben darüber
    if (tierVorn && art !== 'split') html = html.replace('<div class=korn></div>', `<img class=tier src="file://${cut}"><div class=korn></div>`)
    if (debug) html = html.replace('</body>', '<div style="position:absolute;inset:0;z-index:99;pointer-events:none"><div style="position:absolute;left:0;right:0;top:0;height:210px;background:rgba(255,0,0,.28)"></div><div style="position:absolute;left:0;right:0;top:1440px;bottom:0;background:rgba(255,0,0,.28)"></div><div style="position:absolute;left:930px;right:0;top:210px;height:1230px;background:rgba(255,0,0,.28)"></div></div></body>')
    const tmp = path.join(path.dirname(datei), `.hero-${art}.html`)
    fs.mkdirSync(path.dirname(datei), { recursive: true })
    fs.writeFileSync(tmp, html)
    await page.goto('file://' + tmp)
    await page.waitForFunction(() => [...document.images].every((i) => i.complete) && document.fonts.status === 'loaded', null, { timeout: 20000 })
    // UI lesbar halten: sie darf höchstens 36 px hinter den Kopf laufen; sonst wird sie verkleinert (Position bleibt oben)
    if (UI[art] && tierVorn) {
      await page.evaluate(({ sel, grenze }) => {
        const els = sel.flatMap((q) => [...document.querySelectorAll(q)])
        const unten = Math.max(...els.map((e) => e.getBoundingClientRect().bottom)), oben = Math.min(...els.map((e) => e.getBoundingClientRect().top))
        if (unten <= grenze) return
        const f = Math.max(0.72, (grenze - oben) / (unten - oben))
        for (const e of els) { const cs = getComputedStyle(e); const t = parseFloat(cs.top), l = parseFloat(cs.left); e.style.zoom = f; e.style.top = t / f + 'px'; e.style.left = l / f + 'px' }
      }, { sel: UI[art], grenze: kopfY + 36 })
    }
    await page.waitForTimeout(400)
    fs.writeFileSync(datei, await page.screenshot({ type: 'jpeg', quality: 92 }))
    fs.rmSync(tmp, { force: true })
    for (const f of fs.readdirSync(path.dirname(datei))) if (f.startsWith('.tier-')) fs.rmSync(path.join(path.dirname(datei), f), { force: true })
    return datei
  } finally { await page.close() }
}
