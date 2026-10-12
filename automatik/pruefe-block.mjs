// Prüft Karussell-Blöcke (Markdown-Dateien im Format von docs/content-posts.md) gegen die 6-Seiten-Regel, die Formregeln,
// die Merkmale (Säule, Hook-Stil), die Fakten (Preise und Adressen nur aus data/fakten.json) und die Zusatzfelder
// (Mehrwert, Motiv, Familie, bei fundstuecke Repo, Lizenz, Sterne; automatik/block-felder.mjs). Ohne Netz; die Repos prüft
// `--live` zusätzlich gegen die GitHub-API (automatik/repo-check.mjs).
// Aufruf: node automatik/pruefe-block.mjs [--live] datei1.md [datei2.md …]   (Exit 1 bei Verstößen)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readPosts } from '../render/inhalt.mjs'
import { pruefeStruktur } from './karussell-regeln.mjs'
import { pruefeText, beitragsText } from './fakten.mjs'
import { WERTE } from './optimierer.mjs'
import { ergaenze, pruefeZusatz } from './block-felder.mjs'
import { pruefeRepo, holeReadme, kostenHinweise, pruefeRepoAngaben } from './repo-check.mjs'

/** Alle Verstöße eines gelesenen Karussell-Blocks (ohne Netz). Zusatzfelder prüft pruefeZusatz (block-felder.mjs). */
export function pruefeKarussell(p) {
  const fehler = pruefeStruktur(p)
  const tags = (p.hashtags || '').split(/\s+/).filter((x) => x.startsWith('#'))
  if (tags.length < 1 || tags.length > 5) fehler.push(`${tags.length} Hashtags (1 bis 5)`)
  if (!p.caption || p.caption.length > 2100) fehler.push('Caption fehlt oder zu lang')
  const hatAngebot = p.angebot && !/^keins?$/i.test(p.angebot)
  if (hatAngebot && !/link in der bio/i.test(p.caption)) fehler.push('Caption: Werkzeug oder Entwurf ohne „Link in der Bio“')
  if (!hatAngebot && /link in der bio/i.test(p.caption)) fehler.push('Caption: Link in der Bio ohne Angebot')
  if (!WERTE.saeule.includes(p.saeule)) fehler.push(`Säule „${p.saeule}“ unbekannt (${WERTE.saeule.join(', ')})`)
  if (!WERTE.hook_stil.includes(p.hook_stil)) fehler.push(`Hook-Stil „${p.hook_stil}“ unbekannt (${WERTE.hook_stil.join(', ')})`)
  if (p.saeule === 'werkzeuge' && !p.werkzeug) fehler.push('Säule werkzeuge ohne Zeile „- Werkzeug: /pfad“')
  if (p.saeule === 'fundstuecke' && hatAngebot) fehler.push('Säule fundstuecke ohne Angebot (Angebot: keins), das Repo steht in der Caption')
  if (/^werkzeug$/i.test(p.angebot || '') && !p.werkzeug) fehler.push('Angebot Werkzeug ohne Zeile „- Werkzeug: /pfad“')
  if (/Aufgabe\s*[12]/i.test(JSON.stringify(p) + p.caption)) fehler.push('Aufgabe-Schema')
  fehler.push(...pruefeText(beitragsText(p)))
  return fehler
}

/** Live-Abgleich eines fundstuecke-Blocks mit GitHub (Repo, Lizenz, Sterne, Adresse in der Caption, Kostenhinweise). */
export async function pruefeRepoLive(p, o = {}) {
  const r = await pruefeRepo(p.repo, o)
  if (!r.ok) return r.probleme.map((x) => (r.voruebergehend ? `nicht prüfbar: ${x}` : x))
  const readme = await holeReadme(p.repo, o).catch(() => '')
  const text = (p.pages || []).map((s) => [s.head, s.sub, s.text].filter(Boolean).join(' ')).join('\n')
  return pruefeRepoAngaben({ ...p, text }, r.daten, { kosten: kostenHinweise(`${r.daten.beschreibung}\n${readme}`) })
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  let schlecht = 0
  const live = process.argv.includes('--live')
  for (const f of process.argv.slice(2).filter((a) => a !== '--live')) {
    const tmp = path.join(os.tmpdir(), `block-${process.pid}.md`)
    const roh = fs.readFileSync(f, 'utf8')
    // Ganze Vorratsdatei (mit „# Karussells“) direkt lesen, einzelne Blöcke mit Kopf versehen
    fs.writeFileSync(tmp, /^# Karussells/m.test(roh) ? roh : '# Karussells\n\n' + roh.replace(/^# .*\n/m, '') + '\n# Stories\n')
    let posts = []
    try { posts = ergaenze(readPosts(tmp), roh, 'Karussell') } catch (e) { console.log(`${f}: nicht lesbar (${e.message})`); schlecht++; continue } finally { fs.rmSync(tmp, { force: true }) }
    if (!posts.length) { console.log(`${f}: kein Block gelesen`); schlecht++; continue }
    for (const p of posts) {
      const fehler = [...pruefeKarussell(p), ...pruefeZusatz(p)]
      if (live && p.saeule === 'fundstuecke' && p.repo) fehler.push(...(await pruefeRepoLive(p)).map((x) => `Repo: ${x}`))
      if (fehler.length) { schlecht++; console.log(`Karussell ${p.nr} ${p.titel}: ${fehler.join(' | ')}`) } else console.log(`Karussell ${p.nr} ${p.titel}: ok`)
    }
  }
  process.exit(schlecht ? 1 : 0)
}
