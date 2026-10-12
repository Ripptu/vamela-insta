// Prüft, wie viel unproduzierter Vorrat noch da ist, und lässt bei Bedarf neu schreiben.
// Karussells und Stories: unter 6 unproduzierte, dann 4 neue. Reels: unter 4 (nur wenn reels_aktiv).
// Ohne erreichbares Claude (lokal nicht angemeldet) meldet neu-schreiben.mjs das mit einer Zeile (Exit-Code 2), hier läuft alles weiter.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { ladeQueue } from './queue.mjs'
import { allePosts, alleReels, alleStories } from '../render/inhalt.mjs'

const STORY_VORRAT_MIN = 6, STORY_NEU = 4
const q = await ladeQueue()
const ids = new Set(q.map((x) => x.id))
const pad = (n) => String(n).padStart(2, '0')
const posts = allePosts().filter((p) => !ids.has(`k${pad(p.nr)}`))
const reels = alleReels().filter((r) => !ids.has(`r${pad(r.nr)}`))
const stories = alleStories().filter((s) => !ids.has(`s${pad(s.nr)}`))
console.log(`Vorrat: ${posts.length} Karussells, ${reels.length} Reels, ${stories.length} Stories unproduziert`)
const schreibe = (typ, n) => { try { execFileSync('node', ['automatik/neu-schreiben.mjs', '--typ', typ, '--anzahl', String(n)], { stdio: 'inherit' }) } catch (e) { if (e.status !== 2) console.log(`Neuschreiben ${typ} fehlgeschlagen`) } }
if (posts.length < 6) schreibe('karussell', 4)
const params = JSON.parse(fs.readFileSync(new URL('../plan/params.json', import.meta.url), 'utf8'))
if (params.reels_aktiv && reels.length < 4) schreibe('reel', 4)
if (params.stories_aktiv !== false && stories.length < STORY_VORRAT_MIN) schreibe('story', STORY_NEU)
