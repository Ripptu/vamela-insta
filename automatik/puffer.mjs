// Meldet, ob nachproduziert werden muss (für die Workflow-Bedingung). Gibt „noetig=true|false“ aus.
import fs from 'node:fs'
import { ladeQueue } from './queue.mjs'
import { zaehlePuffer, verjaehrte } from './puffer-zaehlen.mjs'
const params = JSON.parse(fs.readFileSync(new URL('../plan/params.json', import.meta.url), 'utf8'))
const q = await ladeQueue()
const z = zaehlePuffer(q, params)
const alt = verjaehrte(q).length
const noetig = z.feed < params.puffer_min || z.stories < 6 || z.neu > 0 || alt > 0
console.log(`Puffer: Feed ${z.feed} nutzbar (${z.feedGesamt} geprüft, Ziel ${params.puffer_min}), Stories ${z.stories} (Ziel 6), ${z.neu} ungeprüft, ${alt} Freigaben veraltet`)
console.log(`noetig=${noetig}`)
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `noetig=${noetig}\n`)
