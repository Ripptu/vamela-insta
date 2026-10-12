// Kleiner Claude-Aufruf über die CLI und das Abo (nie ein API-Schlüssel). Für Denk-Lauf und Neuschreiben.
import { spawn } from 'node:child_process'
import { findeClaude } from './qa.mjs'

function umgebung() {
  const env = { ...process.env }
  for (const k of Object.keys(env)) {
    if (k === 'ANTHROPIC_API_KEY' || k === 'ANTHROPIC_AUTH_TOKEN' || /^CLAUDE_CODE_USE_(BEDROCK|VERTEX|FOUNDRY)$/.test(k)) delete env[k]
    else if (k === 'CLAUDECODE' || (k.startsWith('CLAUDE_CODE_') && !k.startsWith('CLAUDE_CODE_OAUTH'))) delete env[k]
  }
  env.ANTHROPIC_API_KEY = ''
  return env
}

/** Gibt den Antworttext zurück. Wirft bei Fehlern (nie stillschweigend). */
export async function frageClaude(prompt, { system = 'Du antwortest knapp und genau im verlangten Format.', modell = process.env.CLAUDE_MODELL || 'sonnet', timeoutMs = 900_000 } = {}) {
  const bin = findeClaude()
  if (!bin) throw new Error('Claude-CLI nicht gefunden.')
  const args = ['-p', '--output-format', 'json', '--model', modell, '--system-prompt', system, '--tools', '', '--permission-mode', 'dontAsk', '--setting-sources', 'project', '--disable-slash-commands', '--strict-mcp-config', '--no-session-persistence']
  const r = await new Promise((resolve, reject) => {
    const kind = spawn(bin, args, { env: umgebung(), stdio: ['pipe', 'pipe', 'pipe'] })
    let out = '', err = ''
    const t = setTimeout(() => { kind.kill('SIGKILL'); reject(new Error('Zeitüberschreitung')) }, timeoutMs)
    kind.stdout.on('data', (d) => (out += d))
    kind.stderr.on('data', (d) => (err += d))
    kind.on('error', (e) => { clearTimeout(t); reject(e) })
    kind.on('close', (code) => { clearTimeout(t); resolve({ code, out, err }) })
    kind.stdin.end(prompt)
  })
  let j
  try { j = JSON.parse(r.out) } catch { throw new Error(`Claude-Antwort nicht lesbar (Code ${r.code}): ${(r.err || r.out).slice(0, 200)}`) }
  if (j.is_error || typeof j.result !== 'string') throw new Error(`Claude-Fehler: ${String(j.result || r.err).slice(0, 200)}`)
  return j.result
}

export function extrahiereJson(text) {
  const s = text.replace(/```(?:json)?/gi, '')
  for (let a = s.indexOf('{'); a !== -1; a = s.indexOf('{', a + 1)) {
    let d = 0, str = false, esc = false
    for (let i = a; i < s.length; i++) {
      const c = s[i]
      if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; continue }
      if (c === '"') str = true
      else if (c === '{') d++
      else if (c === '}' && --d === 0) { try { return JSON.parse(s.slice(a, i + 1)) } catch { break } }
    }
  }
  return null
}
