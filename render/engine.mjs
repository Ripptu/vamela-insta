// Layout-Engine (Grundgerüst): startet Chromium, misst Text, passt Schriftgrößen an und rendert HTML-Seiten zu JPG.
// Die Gestaltung (Look „Orange“) steckt in render/orange.mjs, render/karussell.mjs und render/story.mjs; sie nutzen von
// hier nur den Browser-Kontext (eng._i.ctx). measure, fit, renderHtml und pageHtml bleiben als neutrale Bausteine.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const HERE = new URL('.', import.meta.url).pathname
const MAC_CHROME = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1134/chrome-mac/Chromium.app/Contents/MacOS/Chromium')
const PUP = path.join(os.homedir(), '.cache/puppeteer/chrome-headless-shell')
const pupChrome = () => { try { const v = fs.readdirSync(PUP).sort().pop(); const f = path.join(PUP, v, 'chrome-headless-shell-mac-arm64/chrome-headless-shell'); return fs.existsSync(f) ? f : undefined } catch { return undefined } }
// Auf Christians Mac fehlt chromium-1134 inzwischen; dann der installierte Chrome (damit wurde der Look „Orange“ geprüft).
// In der Action (Linux) findet playwright-core sein eigenes Chromium (Cache ~/.cache/ms-playwright).
const GOOGLE_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const CHROME = process.env.CHROME_PATH || (fs.existsSync(MAC_CHROME) ? MAC_CHROME : fs.existsSync(GOOGLE_CHROME) ? GOOGLE_CHROME : pupChrome())
export const W = 1080
/** Seitenhöhen: Feed 1080 × 1350, Stories und Reels 1080 × 1920. */
export const HOEHE = { feed: 1350, story: 1920, reel: 1920 }

// Schriften liegen lokal in render/fonts (frei lizenziert). Welche gilt, entscheidet die Gestaltung.
const FONTS = fs.existsSync(HERE + 'fonts/all.css') ? fs.readFileSync(HERE + 'fonts/all.css', 'utf8') : ''
export const CSS = FONTS.replace(/url\('fonts\//g, `url('file://${HERE}fonts/`) + `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;overflow:hidden}
.page{position:relative;width:${W}px;overflow:hidden}
.abs{position:absolute}
`

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function createEngine() {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--allow-file-access-from-files'] })
  const ctx = await browser.newContext({ viewport: { width: W, height: 1920 }, deviceScaleFactor: 1 })
  const mp = await ctx.newPage()
  const mfile = HERE + '.measure.html'
  fs.writeFileSync(mfile, `<!doctype html><meta charset="utf-8"><style>${CSS}</style><body><div id="m" style="position:absolute;left:0;top:0"></div>`)
  await mp.goto('file://' + mfile)

  /** Höhe eines HTML-Schnipsels bei gegebener Breite; ragt ein Wort über die Box, gilt es als „passt nicht“ (1e6). */
  const measure = (html, width, style = '') =>
    mp.evaluate(async ([h, w, st]) => {
      const m = document.getElementById('m')
      m.style.width = w + 'px'
      m.innerHTML = `<div style="${st}">${h}</div>`
      m.offsetHeight // Layout erzwingen, damit die Schriften anfangen zu laden
      await document.fonts.ready
      m.offsetHeight
      const el = m.firstChild
      const zuBreit = [el, ...el.querySelectorAll('*')].some((x) => x.scrollWidth > x.clientWidth + 1 && x.clientWidth > 0)
      return zuBreit ? 1e6 : el.getBoundingClientRect().height
    }, [html, width, style])

  /** Größte Schriftgröße aus sizes, bei der der Text in maxH passt. */
  async function fit(html, width, sizes, extra = '', maxH = 1e9) {
    for (const s of sizes) {
      const h = await measure(html, width, `font-size:${s}px;${extra}`)
      if (h <= maxH) return { size: s, h }
    }
    return null
  }

  /** Rendert eine vollständige HTML-Seite nach file (JPG). Gibt eine Liste von Problemen zurück (leer = gut). */
  async function renderHtml(html, file, PH = HOEHE.feed) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = path.join(path.dirname(file), '.t-' + path.basename(file) + '.html')
    fs.writeFileSync(tmp, html)
    const page = await ctx.newPage()
    await page.setViewportSize({ width: W, height: PH })
    await page.goto('file://' + path.resolve(tmp))
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => [...document.images].every((im) => im.complete))
    // Überlauf prüfen: nichts darf über den Seitenrand ragen
    const problems = await page.evaluate(([w, h]) => [...document.querySelectorAll('.page *')]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > w + 1 || r.bottom > h + 1 || r.left < -1 || r.top < -1) })
      .map((e) => `„${(e.textContent || e.tagName).trim().slice(0, 40)}“ ragt über den Rand`), [W, PH])
    if (!problems.length) await page.screenshot({ path: file, type: 'jpeg', quality: 92 })
    await page.close()
    fs.rmSync(tmp)
    return problems
  }

  const pageHtml = (body, PH = HOEHE.feed, extraCss = '') => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}html,body{height:${PH}px}.page{height:${PH}px}${extraCss}</style></head><body><div class="page">${body}</div></body></html>`

  return { measure, fit, renderHtml, pageHtml, close: () => browser.close(), _i: { ctx, CSS, W } }
}
