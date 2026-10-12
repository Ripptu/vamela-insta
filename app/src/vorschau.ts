// Beispieldaten für die Browser-Vorschau (npm run dev ohne Tauri). In der echten App nie aktiv.
export const IST_VORSCHAU = typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window)

const jetzt = Date.now()
const tagIso = (d: number) => new Date(jetzt + d * 864e5).toISOString()
const titel = ['Schnelle Websites gewinnen', 'Gefunden werden statt nur online', 'Logo vektorisieren in 3 Schritten', 'QR-Code ohne Abo', 'Google-Profil: Fotos, die verkaufen', 'Repo der Woche: Bilder lokal freistellen', 'Große Ideen brauchen Platz: Weißraum', 'Bewertungen sammeln ohne Nerven']
const typen = ['karussell', 'reel', 'karussell', 'story', 'karussell', 'karussell', 'reel', 'karussell']
const queue = titel.map((t, i) => ({
  id: `k${i + 1}`, typ: typen[i], titel: t, saeule: ['tipps', 'tipps', 'werkzeuge', 'werkzeuge', 'tipps', 'fundstuecke', 'design', 'tipps'][i], dateien: [`out/k${i + 1}/01.jpg`], caption: '', hashtags: [],
  status: i < 3 ? 'veroeffentlicht' : i < 7 ? 'geprueft' : 'neu', geplant: tagIso(i - 2),
  ig: i < 3 ? { id: String(i), permalink: 'https://instagram.com/vamela.de', am: tagIso(i - 3) } : null, qa: { verdikt: 'ok', gruende: [], am: tagIso(-4) },
}))
const konto = Array.from({ length: 21 }, (_, i) => ({ datum: tagIso(i - 20).slice(0, 10), follower: 312 + Math.round(i * 2.4 + Math.sin(i) * 3) }))
const dateien: Record<string, unknown> = {
  'plan/queue.json': queue,
  'data/messwerte.json': { konto, beitraege: {} },
  'plan/params.json': { feed: { uhrzeit: '19:00', tage: { 1: 'karussell', 2: 'reel', 3: 'karussell', 4: 'karussell', 5: 'reel' } }, stories: { uhrzeit: '12:30', tage: [2, 4, 0] }, puffer_min: 10 },
}

export async function vorschau<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const antworten: Record<string, unknown> = {
    get_state: { github_login: 'Ripptu', repos_ok: true, claude_ok: true, drive_folder: 'VAMELA', instagram_username: 'vamela.de', gmail_ok: true, finished: true },
    pause_status: false,
    actions_laeufe: JSON.stringify([
      { name: 'Veröffentlichen', status: 'completed', conclusion: 'success', createdAt: tagIso(-0.2), displayTitle: '', url: '', event: 'schedule' },
      { name: 'Messen', status: 'completed', conclusion: 'success', createdAt: tagIso(-0.5), displayTitle: '', url: '', event: 'schedule' },
      { name: 'Produzieren', status: 'in_progress', conclusion: '', createdAt: tagIso(-0.01), displayTitle: '', url: '', event: 'workflow_dispatch' },
    ]),
    secrets_liste: ['IG_ACCESS_TOKEN', 'IG_USER_ID', 'MEDIA_TOKEN', 'TOKEN_KEY'],
    log_lesen: 'Vorschau: kein Protokoll.',
    fotos_zaehlen: 0,
  }
  if (cmd === 'repo_datei') {
    const pfad = String(args?.pfad)
    if (pfad in dateien) return JSON.stringify(dateien[pfad]) as T
    if (pfad.endsWith('.md')) return '# Vorschau\n\nBeispieltext.' as T
    throw `Vorschau: ${pfad} fehlt`
  }
  if (cmd === 'repo_bild') return `/vorschau/${String(args?.pfad).split('/')[1]}.jpg` as T
  if (cmd in antworten) return antworten[cmd] as T
  throw `Vorschau: ${cmd} ist im Browser nicht verfügbar`
}
