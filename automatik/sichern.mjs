// Committet Änderungen und lädt sie hoch, auch wenn parallel andere Workflows gepusht haben.
// Aufruf: node automatik/sichern.mjs "Nachricht" pfad [pfad …]
// Bei abgelehntem Push: Stand von origin/main holen, eigene Änderungen daraufsetzen (plan/queue.json je Beitrag
// zusammenführen), erneut pushen (bis zu 6 Versuche). Kein Rebase-Konflikt, kein verlorener Status.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { mergeQueue } from './queue-merge.mjs'

const [msg, ...pfade] = process.argv.slice(2)
if (!msg || !pfade.length) { console.error('Aufruf: sichern.mjs "Nachricht" pfad …'); process.exit(2) }
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1e9 })
const gitOk = (...a) => { try { git(...a); return true } catch { return false } }
const QUEUE = 'plan/queue.json'
const schlaf = (s) => execFileSync('sleep', [String(s)])
// nur Pfade, die es gibt oder die versioniert sind (ein komplett gelöschter Ordner ist kein gültiger Pfadangabe mehr)
const vorhandene = () => pfade.filter((p) => fs.existsSync(p) || git('ls-files', '--', p).trim())

git('config', 'user.name', 'vamela-insta-bot')
git('config', 'user.email', 'bot@users.noreply.github.com')
git('add', '-A', ...vorhandene())
if (gitOk('diff', '--cached', '--quiet')) { console.log('Nichts zu sichern.'); process.exit(0) }
git('commit', '-q', '-m', msg)

for (let versuch = 1; versuch <= 6; versuch++) {
  if (gitOk('push', '-q', 'origin', 'HEAD:main')) { console.log(`Gesichert (Versuch ${versuch}).`); process.exit(0) }
  console.log(`Push abgelehnt (Versuch ${versuch}), führe mit origin/main zusammen.`)
  git('fetch', '-q', 'origin', 'main')
  const meine = git('rev-parse', 'HEAD').trim()
  const basis = git('merge-base', meine, 'origin/main').trim()
  const aenderungen = git('diff', '--name-status', basis, meine).split('\n').filter(Boolean).map((z) => z.split('\t'))
  const queueBasis = JSON.parse(git('show', `${basis}:${QUEUE}`) || '[]')
  const queueMeine = JSON.parse(git('show', `${meine}:${QUEUE}`) || '[]')
  git('reset', '-q', '--hard', 'origin/main')
  for (const [s, f] of aenderungen) {
    if (f === QUEUE) continue
    if (s.startsWith('D')) gitOk('rm', '-rq', '--ignore-unmatch', '--', f)
    else gitOk('checkout', meine, '--', f)
  }
  if (aenderungen.some(([, f]) => f === QUEUE)) {
    const gegen = JSON.parse(fs.readFileSync(QUEUE, 'utf8') || '[]')
    fs.writeFileSync(QUEUE, JSON.stringify(mergeQueue(queueBasis, queueMeine, gegen), null, 2) + '\n')
  }
  git('add', '-A', ...vorhandene())
  if (gitOk('diff', '--cached', '--quiet')) { console.log('Nach dem Zusammenführen nichts mehr zu sichern.'); process.exit(0) }
  git('commit', '-q', '-m', msg)
  schlaf(2 * versuch)
}
console.error('Sichern fehlgeschlagen nach 6 Versuchen.')
process.exit(1)
