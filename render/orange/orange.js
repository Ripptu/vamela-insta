// Passt [data-fit] an: größte Schrift (max,min), bei der die breiteste Zeile in die Breite des Elements passt
// und (mit data-fit-h) der Block nicht höher als data-fit-h wird.
document.fonts.ready.then(() => {
  for (const el of document.querySelectorAll('[data-fit]')) {
    const [max, min] = el.dataset.fit.split(',').map(Number)
    const breite = () => { const r = document.createRange(); r.selectNodeContents(el); return Math.max(...[...r.getClientRects()].map((q) => q.right)) - el.getBoundingClientRect().left }
    let lo = min, hi = max
    while (hi - lo > 1) { const m = (lo + hi) >> 1; el.style.fontSize = m + 'px'; if (breite() <= el.clientWidth + 1) lo = m; else hi = m }
    el.style.fontSize = lo + 'px'
    // Optional Höchsthöhe (data-fit-h): so lange kleiner, bis der Block hineinpasst
    const maxH = +el.dataset.fitH || 0
    let g = lo
    while (maxH && el.offsetHeight > maxH && g > min) { g -= 2; el.style.fontSize = g + 'px' }
    if (breite() > el.clientWidth + 1 || (maxH && el.offsetHeight > maxH)) el.dataset.passtNicht = '1'
  }
  document.body.dataset.fertig = '1'
})
