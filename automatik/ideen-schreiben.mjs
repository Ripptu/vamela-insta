// Schreibt einen Bereich einer Ideenliste als Karussells, je fünf Ideen pro Claude-Lauf, bis zu drei Versuche je Gruppe.
// Aufruf: node automatik/ideen-schreiben.mjs --ideen docs/ideen-gaming-100.md --von 1 --bis 25 --auto docs/gaming-teil-1.md
//         node automatik/ideen-schreiben.mjs --zusammenfuehren docs/gaming-teil-*.md   (hängt die Teile nach Nummer an docs/content-posts-auto.md an)
// Läuft im Workflow ideen-schreiben.yml (Claude über CLAUDE_CODE_OAUTH_TOKEN), Christian 12.10.2026: alle 100 Gaming-Ideen produzieren.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const args = process.argv.slice(2)
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d)

if (args.includes('--zusammenfuehren')) {
  const teile = args.slice(args.indexOf('--zusammenfuehren') + 1).filter((f) => fs.existsSync(path.resolve(ROOT, f)))
  const bloecke = teile.flatMap((f) => fs.readFileSync(path.resolve(ROOT, f), 'utf8').split(/\n(?=## Karussell \d+:)/).filter((b) => /^## Karussell \d+:/.test(b)))
    .map((b) => b.replace(/\n---\s*$/g, '').replace(/(\n---\n*)+$/, '').trim())
  const ziel = path.join(ROOT, 'docs/content-posts-auto.md')
  const vorhanden = new Set([...fs.readFileSync(ziel, 'utf8').matchAll(/^## Karussell (\d+):/gm)].map((m) => +m[1]))
  const neu = [...new Map(bloecke.map((b) => [+b.match(/^## Karussell (\d+):/)[1], b])).entries()].filter(([nr]) => !vorhanden.has(nr)).sort((a, b) => a[0] - b[0])
  if (neu.length) fs.appendFileSync(ziel, neu.map(([, b]) => b).join('\n\n---\n\n') + '\n\n---\n\n')
  console.log(`${neu.length} Karussells angehängt (${neu.map(([n]) => n).join(', ')}), ${bloecke.length - neu.length} schon vorhanden oder doppelt`)
  process.exit(0)
}

const ideen = opt('--ideen'), von = +opt('--von'), bis = +opt('--bis'), auto = opt('--auto')
const fehlt = []
for (let a = von; a <= bis; a += 5) {
  const nummern = `${a}-${Math.min(a + 4, bis)}`
  let ok = false
  for (let v = 1; v <= 3 && !ok; v++) {
    try {
      const out = execFileSync('node', ['automatik/neu-schreiben.mjs', '--typ', 'karussell', '--ideen', ideen, '--nummern', nummern, '--auto', auto], { cwd: ROOT, encoding: 'utf8', timeout: 1_500_000, stdio: ['ignore', 'pipe', 'inherit'] })
      console.log(`Ideen ${nummern}: ${out.trim().split('\n').pop()}`)
      ok = true
    } catch (e) {
      console.log(`Ideen ${nummern} Versuch ${v} fehlgeschlagen: ${String(e.stdout || e.message).trim().split('\n').slice(-3).join(' / ')}`)
      if (e.status === 2) break // Claude nicht verfügbar: weitere Versuche sinnlos
    }
  }
  if (!ok) fehlt.push(nummern)
}
console.log(fehlt.length ? `Nicht geschrieben: ${fehlt.join(', ')}` : 'Alle Ideen geschrieben')
