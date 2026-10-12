// Führt plan/queue.json je Beitrag zusammen (Dreiwege-Merge nach id): Was ich gegenüber der gemeinsamen Basis geändert
// habe, gilt; alles andere kommt aus der Gegenseite. So gehen Statusänderungen paralleler Workflows nie verloren.
export function mergeQueue(basis, meine, gegen) {
  const idx = (l) => new Map(l.map((x) => [x.id, x]))
  const b = idx(basis), m = idx(meine), g = idx(gegen)
  const gleich = (x, y) => JSON.stringify(x) === JSON.stringify(y)
  const ids = [...new Set([...gegen.map((x) => x.id), ...meine.map((x) => x.id)])]
  const out = []
  for (const id of ids) {
    const bi = b.get(id), mi = m.get(id), gi = g.get(id)
    const geloescht = bi && !mi
    const geaendert = mi && (!bi || !gleich(mi, bi))
    if (geloescht) continue
    if (geaendert) out.push(mi)
    else if (gi) out.push(gi)
    else if (mi) out.push(mi)
  }
  return out
}
