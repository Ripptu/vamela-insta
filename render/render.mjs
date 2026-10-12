// Rendert mehrere fertige HTML-Seiten mit Chromium zu JPG (Stapelbetrieb, z. B. für Testbeiträge des Prüf-Agenten).
// Läuft lokal und in der Action. Ein Gesichtsschutz wie bei Foto-Stilen ist hier nicht eingebaut: Beiträge von
// @vamela.de zeigen keine Personenfotos. Kommt mit der Gestaltung ein Stil mit Personen dazu, gehört er hierher.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const HERE = new URL('.', import.meta.url).pathname
const MAC_CHROME = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1134/chrome-mac/Chromium.app/Contents/MacOS/Chromium')
const CHROME = process.env.CHROME_PATH || (fs.existsSync(MAC_CHROME) ? MAC_CHROME : undefined)

/** Rechtecke aller Elemente auf der Seite (für Überlauf- und Kollisionsprüfungen). */
export const COLLECT = () => [...document.querySelectorAll('.page > *')].map((el) => {
  const r = el.getBoundingClientRect()
  return { label: (el.textContent || el.tagName).trim().slice(0, 40), r: [r.left, r.top, r.width, r.height] }
})

export const overlap = (a, b) => {
  const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])
  const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1])
  return w > 0 && h > 0 ? w * h : 0
}

export async function renderPages(pages, outDir, { height = 1350, prefix = 'seite' } = {}) {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--allow-file-access-from-files'] })
  const ctx = await browser.newContext({ viewport: { width: 1080, height }, deviceScaleFactor: 1 })
  const files = []
  try {
    for (let i = 0; i < pages.length; i++) {
      const tmp = path.join(outDir, `.${prefix}-${i + 1}.html`)
      // Schriften liegen in render/fonts, relative Angaben werden auf absolute Pfade umgeschrieben.
      fs.writeFileSync(tmp, pages[i].replace(/url\('fonts\//g, `url('file://${HERE}fonts/`))
      const page = await ctx.newPage()
      await page.goto('file://' + path.resolve(tmp))
      await page.evaluate(() => document.fonts.ready)
      await page.waitForFunction(() => [...document.images].every((im) => im.complete))
      const file = path.join(outDir, `${prefix}-${String(i + 1).padStart(2, '0')}.jpg`)
      await page.screenshot({ path: file, type: 'jpeg', quality: 92 })
      await page.close()
      fs.rmSync(tmp)
      files.push(file)
    }
  } finally {
    await browser.close()
  }
  return files
}
