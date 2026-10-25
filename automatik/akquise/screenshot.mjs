// Handy-Screenshot der Startseite eines Leads (390 × 844, iPhone-Größe) für DM 2. Ist die Telefonnummer nicht antippbar,
// wird sie im Bild rot umrandet, damit der Befund sofort sichtbar ist.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export async function handyScreenshot(url, { telefonMarkieren = false } = {}) {
  const { chromium } = await import('playwright-core')
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' })
    const page = await ctx.newPage()
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(1500)
    if (telefonMarkieren) {
      await page.evaluate(() => {
        const re = /(\+49|0)[\d\s/()-]{6,}\d/
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        let n
        while ((n = walker.nextNode())) {
          if (re.test(n.textContent) && !n.parentElement.closest('a[href^="tel:"]')) {
            const el = n.parentElement
            el.style.outline = '4px solid #ff2d2d'; el.style.outlineOffset = '3px'; el.scrollIntoView({ block: 'center' })
            break
          }
        }
      }).catch(() => {})
      await page.waitForTimeout(500)
    }
    const datei = path.join(os.tmpdir(), `lead-${Date.now()}.jpg`)
    await page.screenshot({ path: datei, type: 'jpeg', quality: 85 })
    return datei
  } finally { await browser.close() }
}
export const loesche = (f) => { try { fs.rmSync(f, { force: true }) } catch {} }
