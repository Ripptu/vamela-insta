// Ganzer Ablauf von neu-schreiben.mjs --typ karussell mit Fundstück, ohne Netz und ohne Claude: ein falsches „claude“
// (CLAUDE_BIN) schreibt Blöcke nach dem Plan im Prompt, ein lokaler Server spielt die GitHub-API (GITHUB_API), die Trends
// kommen aus einer temporären Datei (TRENDS_DATEI). Geprüft wird: Repo wird vor dem Schreiben live geprüft, README und
// Kostenhinweis landen im Prompt, die Repo-Zeilen müssen stimmen, und ohne geprüftes Repo wird der Platz zu tipps/design.
// Weitere fundstuecke-Plätze ohne zweites Repo in trends.json werden ebenfalls zu tipps/design.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { readPosts } from '../../render/inhalt.mjs'
import { ergaenze } from '../block-felder.mjs'

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname)
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fund-test-'))

// Falsches claude: liest „Karussell N (Säule: …, Hook-Stil: …, Angebot: …[, Werkzeug: …][, Repo: …])“ und die Repo-Zeilen
const FAKE = `#!/usr/bin/env node
import fs from 'node:fs'
const dir = process.env.FAKE_DIR
const prompt = fs.readFileSync(0, 'utf8')
const n = fs.readdirSync(dir).filter((f) => f.startsWith('prompt-')).length + 1
fs.writeFileSync(dir + '/prompt-' + n + '.txt', prompt)
const buchst = (x) => String(x).replace(/\\d/g, (d) => 'abcdefghij'[d])
const plan = [...prompt.matchAll(/Karussell (\\d+) \\(Säule: (\\w+), Hook-Stil: ([\\w-]+), Angebot: (\\w+)(?:, Werkzeug: ([^,)]+))?(?:, Repo: ([^)]+))?\\)/g)]
  .map((m) => ({ nr: +m[1], s: m[2], h: m[3], a: m[4], w: m[5], repo: m[6] }))
const zeilen = (slug) => { const m = prompt.match(new RegExp('- Zeilen exakt so: "- Repo: ' + slug.replace('/', '\\\\/') + '", "- Lizenz: ([^"]+)", "- Sterne: ([^"]+)"')); return m ? { lizenz: m[1], sterne: m[2] } : null }
const bloecke = plan.map(({ nr, s, h, a, w, repo }) => {
  const b = buchst(nr)
  const z = repo ? zeilen(repo) : null
  const angebot = a !== 'keins'
  const meta = ['- Säule: ' + s, '- Hook-Stil: ' + h, '- Angebot: ' + a, w ? '- Werkzeug: ' + w : null,
    repo ? '- Repo: ' + repo : null, z ? '- Lizenz: ' + z.lizenz : null, z ? '- Sterne: ' + (process.env.FAKE_MODE === 'falsche-sterne' ? 'rund 99.000 (Stand 01.10.2026)' : z.sterne) : null,
    '- Mehrwert: Du kannst Nebel' + b + ' und Regen' + b + ' für deinen Betrieb sofort ausprobieren.',
    '- Motiv: a small paper boat floating on a calm orange lake at dawn', '- Familie: tag'].filter(Boolean).join('\\n')
  const schluss = 'Speicher dir den Beitrag.' + (angebot ? ' Link in der Bio.' : '') + (repo ? ' Auf GitHub: ' + repo + '.' : '')
  const hook = 'Nebel' + b + ' und Regen' + b + ' im Sommer' + b + '.'
  const cap = hook + '\\n\\nKurz erklärt, was du davon hast.' + (angebot ? '\\n\\nLink in der Bio.' : '')
    + (repo ? '\\n\\nRepo: github.com/' + repo + ' · Lizenz: ' + z.lizenz + ' · ' + z.sterne.replace(/^rund (\\\\S+) /, 'rund $1 Sterne auf GitHub ') + '. Für Teams gibt es einen kostenpflichtigen Plan.' : '')
    + '\\n\\nWas meinst du?'
  return '## Karussell ' + nr + ': Testfall ' + b + '\\n' + meta + '\\n\\n| Seite | Vorlage | Text |\\n|---|---|---|\\n| 1 | Cover | **' + hook + '** |\\n'
    + [2, 3, 4, 5].map((i) => '| ' + i + ' | Textseite | Gedanke ' + buchst(nr * 10 + i) + ' hilft dir. Probier es heute aus. |').join('\\n')
    + '\\n| 6 | Schlussseite | ' + schluss + ' |\\n\\n**Caption:**\\n' + cap + '\\n\\n**Hashtags:** #webdesign #freising'
})
console.log(JSON.stringify({ is_error: false, result: bloecke.join('\\n\\n---\\n\\n') }))
`

function fakeClaude(modus = '') {
  const dir = tmpDir()
  const bin = path.join(dir, 'claude')
  fs.writeFileSync(bin, FAKE, { mode: 0o755 })
  const state = path.join(dir, 'state')
  fs.mkdirSync(state)
  return { state, env: { CLAUDE_BIN: bin, FAKE_DIR: state, FAKE_MODE: modus } }
}

/** Lokaler Server als GitHub-API: /repos/muster/werkzeug und /readme. */
async function github({ archiviert = false } = {}) {
  const anfragen = []
  const server = http.createServer((req, res) => {
    anfragen.push(req.url)
    if (req.url === '/repos/muster/werkzeug') {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ full_name: 'muster/werkzeug', html_url: 'https://github.com/muster/werkzeug', description: 'A free tool for small shops', stargazers_count: 12345, archived: archiviert, fork: false, pushed_at: new Date(Date.now() - 5 * 864e5).toISOString(), license: { spdx_id: 'MIT', name: 'MIT License' } }))
    }
    if (req.url === '/repos/muster/werkzeug/readme') { res.writeHead(200); return res.end('# Werkzeug\nResizes photos in one click. README-MARKE-4711.\n\nPaid plans for teams.') }
    res.writeHead(404); res.end('{}')
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  return { url: `http://127.0.0.1:${server.address().port}`, anfragen, schliessen: () => new Promise((r) => server.close(r)) }
}

const laufe = (argv, env) => new Promise((resolve) => {
  const kind = spawn(process.execPath, [path.join(ROOT, 'automatik/neu-schreiben.mjs'), ...argv], { cwd: ROOT, env: { ...process.env, GITHUB_TOKEN: '', GH_TOKEN: '', ...env } })
  let stdout = '', stderr = ''
  kind.stdout.on('data', (d) => (stdout += d))
  kind.stderr.on('data', (d) => (stderr += d))
  const t = setTimeout(() => kind.kill('SIGKILL'), 120_000)
  kind.on('close', (status) => { clearTimeout(t); resolve({ status, stdout, stderr }) })
})

const trendsDatei = () => {
  const f = path.join(tmpDir(), 'trends.json')
  fs.writeFileSync(f, JSON.stringify({ repos: [{ slug: 'muster/werkzeug', warum: 'Fotos schneller verkleinern.' }], themen: [{ thema: 'Neues KI-Modell', quelle: 'https://ki.example/neu', datum: '2026-10-08', motiv_idee: 'a small glowing robot assembling orange blocks in a dark workshop', familie: 'nacht' }] }))
  return f
}

test('neu-schreiben --typ karussell: Fundstück aus trends.json, live geprüft, README im Prompt, Block mit Repo-Zeilen', async () => {
  const gh = await github()
  try {
    const f = fakeClaude()
    const auto = path.join(tmpDir(), 'posts-auto.md')
    const r = await laufe(['--typ', 'karussell', '--anzahl', '10', '--auto', auto], { ...f.env, GITHUB_API: gh.url, TRENDS_DATEI: trendsDatei() })
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.match(r.stdout, /Versuch 1: ok/)
    assert.ok(gh.anfragen.includes('/repos/muster/werkzeug') && gh.anfragen.includes('/repos/muster/werkzeug/readme'), 'vor dem Schreiben live geprüft')
    const prompt = fs.readFileSync(path.join(f.state, 'prompt-1.txt'), 'utf8')
    assert.match(prompt, /FUNDSTÜCKE \(live geprüft/)
    assert.match(prompt, /README-MARKE-4711/)
    assert.match(prompt, /KOSTEN: Das README nennt paid plans?/)
    assert.match(prompt, /"- Sterne: rund 12\.000 \(Stand \d{2}\.\d{2}\.\d{4}\)"/)
    assert.match(prompt, /a small glowing robot assembling orange blocks/, 'Motiv-Idee aus den Trends')
    assert.match(prompt, /- "- Mehrwert: …"/)
    const posts = ergaenze(readPosts(auto), fs.readFileSync(auto, 'utf8'), 'Karussell')
    assert.equal(posts.length, 10) // zehn Plätze: fundstuecke ist bei jeder erlaubten Gewichtung (mindestens 10 %) dabei
    const fund = posts.filter((p) => p.saeule === 'fundstuecke')
    assert.equal(fund.length, 1)
    assert.equal(fund[0].repo, 'muster/werkzeug')
    assert.equal(fund[0].lizenz, 'MIT')
    assert.ok(posts.every((p) => p.mehrwert && p.motiv && p.familie))
  } finally { await gh.schliessen() }
})

test('neu-schreiben --typ karussell: falsche Sterne-Zeile wird abgelehnt', async () => {
  const gh = await github()
  try {
    const f = fakeClaude('falsche-sterne')
    const auto = path.join(tmpDir(), 'posts-auto.md')
    const r = await laufe(['--typ', 'karussell', '--anzahl', '10', '--auto', auto], { ...f.env, GITHUB_API: gh.url, TRENDS_DATEI: trendsDatei() })
    assert.equal(r.status, 1, r.stdout + r.stderr)
    assert.match(r.stdout, /Versuch 1: Karussell \d+: Sterne: genannt 99\.000, live nur 12345/)
    assert.equal(fs.existsSync(auto), false)
  } finally { await gh.schliessen() }
})

test('neu-schreiben --typ karussell: archiviertes Repo wird nicht vorgestellt, der Platz wird tipps oder design', async () => {
  const gh = await github({ archiviert: true })
  try {
    const f = fakeClaude()
    const auto = path.join(tmpDir(), 'posts-auto.md')
    const r = await laufe(['--typ', 'karussell', '--anzahl', '10', '--auto', auto], { ...f.env, GITHUB_API: gh.url, TRENDS_DATEI: trendsDatei() })
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.match(r.stdout, /Fundstück muster\/werkzeug übersprungen: .*archiviert/)
    assert.match(r.stdout, /Kein geprüftes Fundstück .* wird (tipps|design)/)
    assert.doesNotMatch(fs.readFileSync(path.join(f.state, 'prompt-1.txt'), 'utf8'), /FUNDSTÜCKE \(live/)
    assert.equal(readPosts(auto).filter((p) => p.saeule === 'fundstuecke').length, 0)
  } finally { await gh.schliessen() }
})
