// Prüft, wie viel unproduzierter Vorrat noch da ist, und lässt bei Bedarf neu schreiben.
// Karussells und Stories: unter 6 unproduzierte, dann 4 neue. Reels: unter 4 (nur wenn reels_aktiv).
// Reserve für den Puffer: Fehlen bis zum Pufferziel (plan/params.json `puffer_min`) mehr Beiträge, als unproduziert da sind
// (geprüft, ungeprüft und noch reparierbare abgezogen, Ablehnungsreserve +40 %), wird in Päckchen zu 4 nachgeschrieben.
// Aufgegebene Beiträge (Status „aufgegeben“, automatik/reparieren.mjs) zählen weder zum Puffer noch zum Vorrat; ihr Ersatz
// entsteht über diese Rechnung, weil sie dem Puffer fehlen.
// Ohne erreichbares Claude (lokal nicht angemeldet) meldet neu-schreiben.mjs das mit einer Zeile (Exit-Code 2), hier läuft alles weiter.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { ladeQueue } from './queue.mjs'
import { allePosts, alleReels, alleStories } from '../render/inhalt.mjs'
import { zaehlePuffer } from './puffer-zaehlen.mjs'
import { ladeHistorie } from './reparatur-historie.mjs'

const STORY_VORRAT_MIN = 6, STORY_NEU = 4
const q = await ladeQueue()
const ids = new Set(q.map((x) => x.id))
const pad = (n) => String(n).padStart(2, '0')
const posts = allePosts().filter((p) => !ids.has(`k${pad(p.nr)}`))
const reels = alleReels().filter((r) => !ids.has(`r${pad(r.nr)}`))
const stories = alleStories().filter((s) => !ids.has(`s${pad(s.nr)}`))
console.log(`Vorrat: ${posts.length} Karussells, ${reels.length} Reels, ${stories.length} Stories unproduziert`)
/** true, wenn neue Blöcke geschrieben wurden. */
const schreibe = (typ, n) => { try { execFileSync('node', ['automatik/neu-schreiben.mjs', '--typ', typ, '--anzahl', String(n)], { stdio: 'inherit' }); return true } catch (e) { if (e.status !== 2) console.log(`Neuschreiben ${typ} fehlgeschlagen`); return false } }
const params = JSON.parse(fs.readFileSync(new URL('../plan/params.json', import.meta.url), 'utf8'))
const z = zaehlePuffer(q, params, new Date(), ladeHistorie())
const feldBedarf = Math.max(0, (params.puffer_min || 0) - z.feed - z.neu - z.reparierbar)
const ziel = Math.max(6, Math.ceil(feldBedarf * 1.4))
if (z.aufgegeben) console.log(`${z.aufgegeben} aufgegeben (zählen nicht als Vorrat); Puffer fehlen ${feldBedarf}, Vorratsziel ${ziel}`)
let vorhandenPosts = posts.length
for (let paeckchen = 0; paeckchen < 3 && vorhandenPosts < ziel; paeckchen++) {
  if (!schreibe('karussell', 4)) break
  vorhandenPosts += 4
}
if (params.reels_aktiv && reels.length < 4) schreibe('reel', 4)
if (params.stories_aktiv !== false && stories.length < STORY_VORRAT_MIN) schreibe('story', STORY_NEU)
