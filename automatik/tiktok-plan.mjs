// Welche Posts fehlen in den nächsten Stunden noch bei Zernio? GitHub startet geplante Läufe unzuverlässig (am 04.11.2026 fielen die
// meisten aus), deshalb baut jeder Lauf, der überhaupt startet, die Posts im Voraus und gibt sie Zernio mit fester Uhrzeit (scheduledFor).
// Zernio veröffentlicht dann pünktlich, ohne GitHub. Aufruf: node automatik/tiktok-plan.mjs karussell|video [--stunden 48]
// Ausgabe: je fehlendem Post eine Zeile „JJJJ-MM-TTTHH:MM slot“ (Berliner Zeit), früheste zuerst.
import fs from 'node:fs'
const art = process.argv[2]
const i = process.argv.indexOf('--stunden')
const stunden = i > 0 ? Number(process.argv[i + 1]) : 48
const plan = JSON.parse(fs.readFileSync('plan/tiktok-plan.json', 'utf8'))
const lese = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null)
const eintraege = art === 'video' ? lese('data/tiktok-videos.json') || [] : lese('data/tiktok-karussell.json')?.posts || []
const slots = art === 'video' ? plan.video_slots : plan.slots.filter((s) => s.aktiv)
const berlin = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' }).format(d).replace(' ', 'T')
const von = berlin(new Date(Date.now() + 30 * 60000)), bis = berlin(new Date(Date.now() + stunden * 3600000))
const schon = new Set(eintraege.map((p) => p.geplant_fuer).filter(Boolean))
const zeilen = []
for (let t = 0; t <= Math.ceil(stunden / 24); t++) {
  const tag = berlin(new Date(Date.now() + t * 864e5)).slice(0, 10)
  for (const s of slots) {
    const um = `${tag}T${s.uhrzeit}`
    if (um >= von && um <= bis && !schon.has(um)) zeilen.push(`${um} ${s.id}`)
  }
}
// Sperre nach Fehlschlägen (Christian, 16.11.2026: „über 30 Mails am Tag von GitHub“): schlägt das Video-Bauen wiederholt fehl, wartet der Plan
// 2 / 4 / 8 / 24 Stunden, statt alle 30 Minuten neu zu bauen (jeder Versuch kostet Claude-Tokens und kie-Credits).
if (art === 'video' && fs.existsSync('data/video-fehler.json')) {
  const f = JSON.parse(fs.readFileSync('data/video-fehler.json', 'utf8'))
  const warte = f.zaehler >= 2 ? Math.min(24, 2 ** (f.zaehler - 1)) : 0
  if (warte && Date.now() - new Date(f.letzter).getTime() < warte * 3600000) {
    console.error(`Video-Sperre: ${f.zaehler} Fehlschläge in Folge, nächster Versuch nach ${warte} h. Grund: ${String(f.grund).slice(0, 160)}`)
    process.exit(0)
  }
}
process.stdout.write(zeilen.sort().join('\n'))
