// Qualitäts-Check für Titel und Beschreibung (Werkzeuge aus tools/ig, Herkunft: Jakeschincariol/instagram-agent-skill, MIT, ins Deutsche umgebaut).
// Nur Warnungen: blockiert nie ein Posten, wirft nie. Fehlt Python, kommt { uebersprungen: true }.
// Das Ergebnis geht als `ig_pruefung` in den Log-Eintrag, damit sich der Hook-Score später gegen die Messwerte prüfen lässt.
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const TOOLS = path.join(ROOT, 'tools/ig')
const py = (args, eingabe) => {
  const r = spawnSync('python3', ['-I', ...args], { input: eingabe, encoding: 'utf8', timeout: 20000 })
  // Exit 1 heißt „Befund“ (Lint-Stil), das JSON steht trotzdem auf stdout; nur ohne JSON zählt es als Fehler
  if (r.error || !r.stdout?.trim().startsWith('{')) throw new Error((r.error?.message || r.stderr || `Exit ${r.status}`).slice(0, 200))
  return JSON.parse(r.stdout)
}

/** Nur der Hook-Score. { score, urteil, dealbreaker } oder {} ohne Python. */
export function bewerteHook(hook) {
  try {
    const h = py([path.join(TOOLS, 'hookscore.py'), '--hook', hook, '--json', '--projekt', ROOT])
    return { score: h.score, urteil: h.urteil, dealbreaker: (h.flags || []).map(String).find((x) => /DEALBREAKER/.test(x)) || null }
  } catch { return {} }
}

export function pruefeText({ titel, beschreibung, suchbegriff }) {
  try {
    const hook = py([path.join(TOOLS, 'hookscore.py'), '--hook', titel, '--json', '--projekt', ROOT])
    const cap = py([path.join(TOOLS, 'caption.py'), '-', '--plattform', 'tiktok', '--typ', 'karussell', '--json', '--projekt', ROOT, ...(suchbegriff ? ['--keywords', suchbegriff] : [])], `${titel}\n\n${beschreibung}\n`)
    const warnungen = [
      ...(hook.flags || []).map((f) => `Hook: ${typeof f === 'string' ? f : JSON.stringify(f)}`),
      ...(cap.pruefpunkte || []).filter((p) => p.status === 'WARN' || p.status === 'FEHLER').map((p) => `${p.pruefpunkt}: ${(p.hinweise?.[0] || p.detail || '').slice(0, 160)}`),
    ]
    return { hook_score: hook.score, hook_urteil: hook.urteil, hook_formel: hook.formel?.name || null, warnungen }
  } catch (e) {
    return { uebersprungen: true, grund: String(e.message).slice(0, 160) }
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [titel, beschreibung = '', suchbegriff = ''] = process.argv.slice(2)
  console.log(JSON.stringify(pruefeText({ titel: titel || '', beschreibung, suchbegriff }), null, 2))
}
