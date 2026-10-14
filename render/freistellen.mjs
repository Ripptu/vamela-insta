// Tier freistellen ohne KI-Modell (Christian, 14.10.2026: „das Tier soll immer im Vordergrund sein“).
// Die Tierbilder haben blauen Himmel mit weichen Wolken. Vom Rand her wird alles, was nach Himmel aussieht (blau, oder hell und glatt),
// als Hintergrund gefüllt; die Kante des Tiers (Struktur, Fell, Brille) stoppt die Füllung. Ergebnis: PNG mit Alpha.
import sharp from 'sharp'

const W = 540, H = 960

export async function freistellen(eingang, ausgang) {
  const kl = await sharp(eingang).resize(W, H, { fit: 'cover', position: 'centre' }).removeAlpha().raw().toBuffer()
  const n = W * H
  const lum = new Float32Array(n), blau = new Uint8Array(n), hell = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const r = kl[i * 3], g = kl[i * 3 + 1], b = kl[i * 3 + 2]
    lum[i] = 0.3 * r + 0.59 * g + 0.11 * b
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    blau[i] = b > r + 24 && b >= g - 4 ? 1 : 0
    hell[i] = lum[i] > 168 && (mx - mn) < 46 ? 1 : 0
  }
  // lokale Struktur (Standardabweichung in 7×7), glatte Flächen = Himmel/Wolken, Fell hat Struktur
  const sd = new Float32Array(n)
  const R = 3
  const sum = new Float32Array((W + 1) * (H + 1)), sum2 = new Float32Array((W + 1) * (H + 1))
  for (let y = 0; y < H; y++) { let rs = 0, rs2 = 0; for (let x = 0; x < W; x++) { const v = lum[y * W + x]; rs += v; rs2 += v * v; sum[(y + 1) * (W + 1) + x + 1] = sum[y * (W + 1) + x + 1] + rs; sum2[(y + 1) * (W + 1) + x + 1] = sum2[y * (W + 1) + x + 1] + rs2 } }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const x0 = Math.max(0, x - R), x1 = Math.min(W, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(H, y + R + 1)
    const c = (x1 - x0) * (y1 - y0)
    const s = sum[y1 * (W + 1) + x1] - sum[y0 * (W + 1) + x1] - sum[y1 * (W + 1) + x0] + sum[y0 * (W + 1) + x0]
    const s2 = sum2[y1 * (W + 1) + x1] - sum2[y0 * (W + 1) + x1] - sum2[y1 * (W + 1) + x0] + sum2[y0 * (W + 1) + x0]
    sd[y * W + x] = Math.sqrt(Math.max(0, s2 / c - (s / c) ** 2))
  }
  const himmel = (i) => blau[i] ? sd[i] < 34 : (hell[i] && sd[i] < 7)
  const bg = new Uint8Array(n)
  const stack = []
  const seed = (x, y) => { const i = y * W + x; if (!bg[i] && himmel(i)) { bg[i] = 1; stack.push(i) } }
  for (let x = 0; x < W; x++) seed(x, 0)
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const i = y * W + x; if (y < H * 0.55 || blau[i]) seed(x, y) }
  while (stack.length) {
    const i = stack.pop(), x = i % W, y = (i - x) / W
    if (x > 0 && !bg[i - 1] && himmel(i - 1)) { bg[i - 1] = 1; stack.push(i - 1) }
    if (x < W - 1 && !bg[i + 1] && himmel(i + 1)) { bg[i + 1] = 1; stack.push(i + 1) }
    if (y > 0 && !bg[i - W] && himmel(i - W)) { bg[i - W] = 1; stack.push(i - W) }
    if (y < H - 1 && !bg[i + W] && himmel(i + W)) { bg[i + W] = 1; stack.push(i + W) }
  }
  // Alpha: Tier = 255, Hintergrund = 0; Kante weich. Schwebende Wolkenfetzen (kleine Zusammenhänge) werden Hintergrund.
  const a = Buffer.alloc(n)
  for (let i = 0; i < n; i++) a[i] = bg[i] ? 0 : 255
  const lab = new Int32Array(n)
  const groessen = [0]
  for (let i0 = 0; i0 < n; i0++) {
    if (!a[i0] || lab[i0]) continue
    const id = groessen.length; let c = 0; const st = [i0]; lab[i0] = id
    while (st.length) {
      const i = st.pop(); c++
      const x = i % W
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < n - W ? i + W : -1]) if (j >= 0 && a[j] && !lab[j]) { lab[j] = id; st.push(j) }
    }
    groessen.push(c)
  }
  const gross0 = Math.max(...groessen)
  for (let i = 0; i < n; i++) if (a[i] && groessen[lab[i]] < Math.max(2500, gross0 * 0.04)) a[i] = 0
  // kleine Inseln im Tier (Lichter) und im Himmel entfernen: Öffnen/Schließen über Weichzeichnen und Schwelle
  const m = await sharp(a, { raw: { width: W, height: H, channels: 1 } }).blur(2.4).threshold(128).blur(1.1).raw().toBuffer({ resolveWithObject: true })
  const gross = await sharp(m.data, { raw: { width: W, height: H, channels: m.info.channels } }).extractChannel(0).resize(1080, 1920, { kernel: 'cubic' }).blur(0.8).raw().toBuffer()
  const rgb = await sharp(eingang).resize(1080, 1920, { fit: 'cover', position: 'centre' }).removeAlpha().raw().toBuffer()
  const rgba = Buffer.alloc(1080 * 1920 * 4)
  for (let i = 0; i < 1080 * 1920; i++) { rgba[i * 4] = rgb[i * 3]; rgba[i * 4 + 1] = rgb[i * 3 + 1]; rgba[i * 4 + 2] = rgb[i * 3 + 2]; rgba[i * 4 + 3] = gross[i] }
  await sharp(rgba, { raw: { width: 1080, height: 1920, channels: 4 } }).png({ compressionLevel: 6 }).toFile(ausgang)
  const anteil = a.reduce((s, v) => s + (v ? 1 : 0), 0) / n
  // Oberkante des Tiers (Kopf, Hut, Ohren) im Bereich x 60–930, in Pixeln des 1080 × 1920-Bildes
  let kopfY = 1920
  for (let y = 0; y < 1920 && kopfY === 1920; y++) { let c = 0; for (let x = 60; x < 930; x++) if (gross[y * 1080 + x] > 128) c++; if (c > 24) kopfY = y }
  return { anteil, kopfY }
}
