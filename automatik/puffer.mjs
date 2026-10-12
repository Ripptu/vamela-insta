// Meldet, ob nachproduziert werden muss (für die Workflow-Bedingung). Gibt „noetig=true|false“ aus.
import fs from 'node:fs'
import { ladeQueue } from './queue.mjs'
import { zaehlePuffer, verjaehrte } from './puffer-zaehlen.mjs'
import { ladeHistorie } from './reparatur-historie.mjs'
const params = JSON.parse(fs.readFileSync(new URL('../plan/params.json', import.meta.url), 'utf8'))
const q = await ladeQueue()
const z = zaehlePuffer(q, params, new Date(), ladeHistorie())
const alt = verjaehrte(q).length
// Abgelehnte Beiträge mit Reparaturversuchen übrig (und solche, die aufgegeben werden müssen) sind offene Arbeit
const noetig = z.feed < params.puffer_min || z.stories < 6 || z.neu > 0 || alt > 0 || z.reparierbar > 0 || z.aufzugeben > 0
console.log(`Puffer: Feed ${z.feed} nutzbar (${z.feedGesamt} geprüft, Ziel ${params.puffer_min}), Stories ${z.stories} (Ziel 6), ${z.neu} ungeprüft, ${alt} Freigaben veraltet, ${z.reparierbar} reparierbar, ${z.aufgegeben} aufgegeben`)
console.log(`noetig=${noetig}`)
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `noetig=${noetig}\n`)
