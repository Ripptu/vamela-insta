// Tonspur assets/ton.m4a für die Storyline: Sprachaufnahmen assets/stimme/b<n>.wav an den Beat-Anfängen aus plan.json,
// darunter ein ruhiger, dunkler Klangteppich (duckt unter der Stimme), dazu Sounddesign an den Ereignissen aus plan.json:
// weiche Whooshes bei Tiefenflügen, leise Klicks bei den Zeiger-Treffern, tiefe Schläge, Funkeln beim QR-Aufbau,
// steigende Töne beim Farbzyklus. Alles synthetisch mit ffmpeg, lizenzfrei. Aufruf: node scripts/ton.mjs
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const plan = JSON.parse(fs.readFileSync('plan.json', 'utf8'))
const D = plan.dauer
const VOR = 0.12
const quelle = (expr, d) => ['-f', 'lavfi', '-i', `aevalsrc='${expr}':s=44100:d=${d}`]
const FORM = {
  whoosh: (d = 0.7) => [`(random(0)*2-1)*pow(sin(PI*t/${d}),3)`, d, 'bandpass=f=900:w=1200,volume=0.9'],
  klick: () => ['sin(2*PI*2200*t)*exp(-90*t)+0.5*(random(1)*2-1)*exp(-260*t)', 0.12, 'highpass=f=600,volume=0.35'],
  boom: () => ['sin(2*PI*(36*t+2.4*(1-exp(-10*t))))*exp(-2.6*t)', 1.6, 'lowpass=f=150,volume=1.4'],
  schwung: () => ['sin(2*PI*(220*t+260*t*t))*exp(-3*t)*0.6', 0.8, 'lowpass=f=2400,volume=0.6'],
  funkeln: () => ['(sin(2*PI*1760*t)+sin(2*PI*2349*t)+sin(2*PI*2637*t))*0.2*exp(-2.2*t)*(0.5+0.5*sin(2*PI*14*t))', 1.4, 'volume=0.5'],
  pop: () => ['sin(2*PI*(320*t+900*t*t))*exp(-22*t)*0.8+0.3*sin(2*PI*1400*t)*exp(-50*t)', 0.3, 'volume=0.6'],
  tick: (f = 1500) => [`sin(2*PI*${f}*t)*exp(-36*t)+0.35*sin(2*PI*${f * 2}*t)*exp(-60*t)`, 0.25, 'volume=0.45'],
}
const args = ['-y', '-hide_banner', '-loglevel', 'error']
const filter = []
let n = 0
for (const [typ, t, a] of plan.ereignisse) {
  if (!FORM[typ] || !(t >= 0)) continue
  const [expr, d, kette] = FORM[typ](a)
  args.push(...quelle(expr, d))
  filter.push(`[${n}]${kette},adelay=${Math.round(t * 1000)}:all=1,apad=whole_dur=${D}[e${n}]`)
  n++
}
const sfx = n
// Teppich: tiefer Akkord, langsam atmend, mit leichtem Rauschen
args.push(...quelle('0.10*(sin(2*PI*55*t)+0.55*sin(2*PI*82.41*t)+0.35*sin(2*PI*130.81*t))*(0.65+0.35*sin(2*PI*0.25*t))+0.012*(random(3)*2-1)', D))
const pad = n++
// Stimme
const stimmen = plan.beats.filter((b) => fs.existsSync(`assets/stimme/b${b.i}.wav`))
stimmen.forEach((b) => { args.push('-i', `assets/stimme/b${b.i}.wav`) })
stimmen.forEach((b, k) => filter.push(`[${n + k}]aresample=44100,aformat=channel_layouts=mono,adelay=${Math.round((b.start + VOR) * 1000)}:all=1,apad=whole_dur=${D}[v${k}]`))

filter.push(`[${pad}]lowpass=f=520[teppich0]`)
if (stimmen.length) {
  filter.push(`${stimmen.map((_, k) => `[v${k}]`).join('')}amix=inputs=${stimmen.length}:normalize=0,highpass=f=80,acompressor=threshold=0.12:ratio=3:attack=5:release=120,asplit=2[stimme][seite]`)
  filter.push('[teppich0][seite]sidechaincompress=threshold=0.025:ratio=6:attack=30:release=400[teppich]')
} else filter.push('[teppich0]anull[teppich]')
const alle = [...Array.from({ length: sfx }, (_, k) => `[e${k}]`), '[teppich]', ...(stimmen.length ? ['[stimme]'] : [])]
filter.push(`${alle.join('')}amix=inputs=${alle.length}:normalize=0,alimiter=limit=0.92,atrim=0:${D},afade=t=out:st=${Math.max(0, D - 0.8)}:d=0.8,loudnorm=I=-14:TP=-1.5:LRA=9[out]`)
execFileSync('ffmpeg', [...args, '-filter_complex', filter.join(';'), '-map', '[out]', '-ac', '2', '-c:a', 'aac', '-b:a', '192k', 'assets/ton.m4a'], { stdio: 'inherit' })
console.log(`Ton: assets/ton.m4a (${D} s, ${stimmen.length} Sprachaufnahmen, ${sfx} Effekte)`)
