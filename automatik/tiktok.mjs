// TikTok (Content Posting API, Direct Post, Fotobeiträge): jedes Instagram-Karussell zusätzlich als TikTok-Fotoslideshow.
// Christian, 13.10.2026: „alles auf TikTok gleichzeitig posten, mit viralem Song“. TikTok erlaubt über die API keine freie Songwahl;
// auto_add_music lässt TikTok passende lizenzierte Musik unterlegen (Unternehmenskonten dürfen nur die Commercial Music Library nutzen).
//
// Ablauf
//   verbinden <code>   Tauscht den Autorisierungscode (aus vamela.de/tiktok-verbinden/) gegen Token und legt sie verschlüsselt in
//                      data/tiktok-token.enc ab (AES-256-GCM, Schlüssel aus TIKTOK_CLIENT_SECRET). Das Refresh-Token hält 365 Tage und
//                      wird bei jedem Lauf erneuert und neu gespeichert.
//   status             Zeigt Konto und erlaubte Sichtbarkeiten.
//   veroeffentliche()  Wird von publish.mjs nach dem Instagram-Beitrag aufgerufen. Fehler hier ändern nichts am Instagram-Beitrag.
//
// Bilder: 1080 × 1920 JPEG. Das Karussell-Bild (1080 × 1350) steht oben mit Rand, der untere Bereich bleibt frei für die TikTok-Oberfläche
// (Name, Beschreibung, Musik). TikTok holt die Bilder von https://media.vamela.de/ (GitHub Pages des Medien-Repos, bei TikTok verifiziert).
// Umgebung: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, MEDIA_REPO, MEDIA_TOKEN; optional TIKTOK_MEDIA_BASE.
import fs from 'node:fs'
import path from 'node:path'
import { suchphrase, phrasenTags, inhaltsWoerter } from './suchbegriffe.mjs'
import crypto from 'node:crypto'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const TOKEN_DATEI = path.join(ROOT, 'data/tiktok-token.enc')
const API = 'https://open.tiktokapis.com'
export const REDIRECT = 'https://vamela.de/tiktok-verbinden/'
export const SCOPES = 'user.info.basic,video.publish,video.upload'
const env = (k) => process.env[k] || ''
const warte = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- Token (verschlüsselt im Repo) ----
const schluessel = () => crypto.scryptSync(env('TIKTOK_CLIENT_SECRET'), 'vamela-tiktok-token', 32)
function speichereToken(t) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', schluessel(), iv)
  const data = Buffer.concat([c.update(JSON.stringify(t), 'utf8'), c.final()])
  fs.mkdirSync(path.dirname(TOKEN_DATEI), { recursive: true })
  fs.writeFileSync(TOKEN_DATEI, JSON.stringify({ iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') }))
}
export function ladeToken() {
  if (!fs.existsSync(TOKEN_DATEI) || !env('TIKTOK_CLIENT_SECRET')) return null
  const j = JSON.parse(fs.readFileSync(TOKEN_DATEI, 'utf8'))
  const d = crypto.createDecipheriv('aes-256-gcm', schluessel(), Buffer.from(j.iv, 'base64'))
  d.setAuthTag(Buffer.from(j.tag, 'base64'))
  return JSON.parse(Buffer.concat([d.update(Buffer.from(j.data, 'base64')), d.final()]).toString('utf8'))
}
export const bereit = () => !!(env('TIKTOK_CLIENT_KEY') && env('TIKTOK_CLIENT_SECRET') && fs.existsSync(TOKEN_DATEI))

async function tokenAnfrage(felder) {
  const r = await fetch(`${API}/v2/oauth/token/`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: env('TIKTOK_CLIENT_KEY'), client_secret: env('TIKTOK_CLIENT_SECRET'), ...felder }),
    signal: AbortSignal.timeout(30000),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(`TikTok-Token: ${j.error_description || j.error || r.status}`)
  const jetzt = Date.now()
  return { open_id: j.open_id, access_token: j.access_token, refresh_token: j.refresh_token, access_bis: jetzt + (j.expires_in - 600) * 1000, refresh_bis: jetzt + (j.refresh_expires_in || 31536000) * 1000, scope: j.scope }
}
export async function verbinden(code) {
  const t = await tokenAnfrage({ code: decodeURIComponent(code), grant_type: 'authorization_code', redirect_uri: REDIRECT })
  speichereToken(t)
  return t
}
async function gueltigerToken() {
  let t = ladeToken()
  if (!t) throw new Error('TikTok nicht verbunden (data/tiktok-token.enc fehlt oder Schlüssel passt nicht).')
  if (t.access_bis < Date.now()) {
    t = { ...t, ...(await tokenAnfrage({ grant_type: 'refresh_token', refresh_token: t.refresh_token })) }
    speichereToken(t)
  }
  return t
}
async function post(pfad, body, token) {
  const r = await fetch(API + pfad, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })
  const j = await r.json().catch(() => ({}))
  if (j.error && j.error.code && j.error.code !== 'ok') { const e = new Error(`TikTok ${pfad}: ${j.error.code} ${j.error.message || ''}`.trim()); e.code = j.error.code; throw e }
  return j.data || {}
}

// ---- Bilder 1080 × 1920 ----
export async function bilderFuerTikTok(dateien, zielOrdner) {
  // Erst hier laden: fehlt das Paket, scheitert nur TikTok und nie der Instagram-Beitrag
  const sharp = (await import('sharp')).default
  fs.mkdirSync(zielOrdner, { recursive: true })
  const out = []
  for (const [i, f] of dateien.filter((x) => /\.(jpe?g|png)$/i.test(x)).entries()) {
    const slide = await sharp(f).resize(1080, 1350, { fit: 'cover' }).toBuffer()
    // Hintergrund: dieselbe Folie groß und weich gezeichnet, damit oben und unten kein harter Rand entsteht
    const hg = await sharp(f).resize(1080, 1920, { fit: 'cover' }).blur(40).modulate({ brightness: 0.85 }).toBuffer()
    const ziel = path.join(zielOrdner, `${String(i + 1).padStart(2, '0')}.jpg`)
    await sharp(hg).composite([{ input: slide, top: 150, left: 0 }]).jpeg({ quality: 92, mozjpeg: true }).toFile(ziel)
    out.push(ziel)
  }
  return out
}

// ---- Video 1080 × 1920 aus den Folien ----
// Fotobeiträge zeigt TikTok nur als 3:4-Ausschnitt (Christian, 14.10.2026), Videos dagegen im Vollbild 9:16:
// die Folien werden zu einem Video mit weichen Überblendungen zusammengesetzt (ffmpeg, stumm; Sound wählt Christian im Entwurf).
export async function videoAusBildern(bilder, ziel, { sek = 3.6, blende = 0.4 } = {}) {
  const { spawn } = await import('node:child_process')
  const n = bilder.length, gesamt = n * sek - (n - 1) * blende
  const args = ['-y', '-loglevel', 'error']
  for (const b of bilder) args.push('-loop', '1', '-t', String(sek), '-framerate', '30', '-i', b)
  args.push('-f', 'lavfi', '-t', String(gesamt), '-i', 'anullsrc=r=44100:cl=stereo')
  let f = '', letzte = '[0:v]'
  for (let i = 1; i < n; i++) { f += `${letzte}[${i}:v]xfade=transition=fade:duration=${blende}:offset=${(i * (sek - blende)).toFixed(2)}[v${i}];`; letzte = `[v${i}]` }
  f += `${letzte}scale=1080:1920,format=yuv420p[v]`
  args.push('-filter_complex', f, '-map', '[v]', '-map', `${n}:a`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-r', '30', '-c:a', 'aac', '-t', String(gesamt), '-movflags', '+faststart', ziel)
  fs.mkdirSync(path.dirname(ziel), { recursive: true })
  await new Promise((ok, fail) => { const c = spawn(process.env.FFMPEG || 'ffmpeg', args); let err = ''; c.stderr.on('data', (d) => { err += d }); c.on('error', fail); c.on('close', (k) => k === 0 ? ok() : fail(new Error(`ffmpeg ${k}: ${err.slice(-300)}`))) })
  return ziel
}

// ---- Medien-Repo (GitHub Pages: media.vamela.de) ----
const gh = (pfad, o = {}) => fetch(`https://api.github.com/repos/${env('MEDIA_REPO')}/${pfad}`, { ...o, headers: { Authorization: `Bearer ${env('MEDIA_TOKEN')}`, Accept: 'application/vnd.github+json', 'User-Agent': 'vamela-insta', ...(o.headers || {}) }, signal: AbortSignal.timeout(60000) })
async function hochladen(dateien, ordner) {
  const urls = [], pfade = []
  const basis = (env('TIKTOK_MEDIA_BASE') || 'https://media.vamela.de').replace(/\/+$/, '')
  for (const f of dateien) {
    const p = `tiktok/${ordner}/${path.basename(f)}`
    const r = await gh(`contents/${p}`, { method: 'PUT', body: JSON.stringify({ message: `TikTok-Bild ${p}`, content: fs.readFileSync(f).toString('base64') }) })
    if (!r.ok) throw new Error(`Bild-Upload ${p}: ${r.status}`)
    urls.push(`${basis}/${p}`); pfade.push(p)
  }
  // GitHub Pages braucht etwas, bis die Dateien erreichbar sind
  for (let v = 0; v < 24; v++) {
    const alle = await Promise.all(urls.map((u) => fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(15000) }).then((r) => r.ok).catch(() => false)))
    if (alle.every(Boolean)) return { urls, pfade }
    await warte(10000)
  }
  throw new Error('Bilder unter media.vamela.de nach 4 Minuten nicht erreichbar (GitHub Pages, DNS oder Zertifikat prüfen).')
}
async function aufraeumen(pfade) {
  for (const p of pfade) {
    try {
      const r = await gh(`contents/${p}`); if (!r.ok) continue
      await gh(`contents/${p}`, { method: 'DELETE', body: JSON.stringify({ message: `TikTok-Bild entfernt ${p}`, sha: (await r.json()).sha }) })
    } catch {}
  }
}

// ---- Beschreibung ----
const kuerzen = (t, n) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' }
export function tiktokText(item, caption) {
  // Suchoptimiert (Christian, 14.10.2026): Titel beginnt mit der Suchphrase (plan/suchbegriffe.json), Beschreibung kurz mit
  // der Phrase und höchstens fünf Hashtags; TikTok rankt in der Suche nach Titel, Beschreibung, Text im Bild und Hashtags
  const phrase = suchphrase(item.id)
  const hook = String(item.hook || item.titel || '').replace(/[„“"]/g, '').trim()
  // Wiederholt der Hook die Phrase schon, nur seinen Rest anhängen („Fotos vom Handy auf PC übertragen: ohne Kabel, ohne Cloud.“)
  const pw = inhaltsWoerter(phrase), hw = new Set(inhaltsWoerter(hook))
  const doppelt = pw.length && pw.filter((w) => hw.has(w)).length / pw.length >= 0.5
  const rest = doppelt ? (hook.includes(':') ? hook.slice(hook.indexOf(':') + 1).trim() : String(item.titel || '').trim()) : hook
  const titel = phrase ? kuerzen(`${phrase}: ${rest}`, 90) : kuerzen(hook, 70)
  const tags = (String(item.hashtags || caption || '').match(/#[\p{L}\d_]+/gu) || [])
  const gewaehlt = [...new Set([...phrasenTags(phrase), ...tags.slice(0, 2), '#tipps'])].slice(0, 5)
  const satz = phrase ? `${phrase}: so geht's, kurz erklärt. Speichern, damit du es wiederfindest.` : ''
  return { titel, beschreibung: [satz, gewaehlt.join(' ')].filter(Boolean).join('\n\n') }
}

// Konto-Infos für die Freigabe-Ansicht der App (Name, erlaubte Sichtbarkeiten, gesperrte Interaktionen)
export function speichereKonto(info) {
  try {
    fs.writeFileSync(path.join(ROOT, 'data/tiktok-konto.json'), JSON.stringify({
      nickname: info.creator_nickname || null, username: info.creator_username || null, avatar: info.creator_avatar_url || null,
      sichtbarkeiten: info.privacy_level_options || [], kommentare_gesperrt: !!info.comment_disabled, duett_gesperrt: !!info.duet_disabled,
      stitch_gesperrt: !!info.stitch_disabled, max_video_sek: info.max_video_post_duration_sec || null, am: new Date().toISOString(),
    }, null, 2) + '\n')
  } catch {}
}

// Freigaben aus der App (plan/tiktok-freigabe.json): je Beitrag Sichtbarkeit, Kommentare, Offenlegung, Musik-Zustimmung.
// Nach den TikTok-Richtlinien für Direct Post wählt der Nutzer diese Angaben selbst; ohne Freigabe kein Direkt-Post.
export function freigabe(id) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'plan/tiktok-freigabe.json'), 'utf8'))[id] || null } catch { return null }
}

export async function veroeffentliche({ item, dateien, caption, einstellungen = {}, trocken = false, log = () => {} }) {
  const t = await gueltigerToken()
  const info = await post('/v2/post/publish/creator_info/query/', {}, t.access_token)
  speichereKonto(info)
  const fg = freigabe(item.id)
  if ((einstellungen.modus || 'entwurf') === 'direkt') {
    // Ohne Freigabe kein Direkt-Post: dann als Entwurf ins TikTok-Postfach, damit nichts verloren geht
    if (!fg && !einstellungen.ohne_freigabe_privat) { log(`${item.id}: nicht freigegeben, geht als Entwurf an TikTok`); einstellungen = { ...einstellungen, modus: 'entwurf' } }
    else if (fg) einstellungen = { ...einstellungen, sichtbarkeit: fg.sichtbarkeit, kommentare: !!fg.kommentare, eigene_marke: !!fg.eigene_marke, marken_inhalt: !!fg.marken_inhalt, auto_musik: einstellungen.auto_musik !== false && !!fg.musik_ok }
  }
  const erlaubt = info.privacy_level_options || []
  const gewuenscht = einstellungen.sichtbarkeit || 'SELF_ONLY'
  const sichtbarkeit = erlaubt.includes(gewuenscht) ? gewuenscht : (erlaubt.includes('SELF_ONLY') ? 'SELF_ONLY' : erlaubt[0])
  if (!sichtbarkeit) throw new Error('TikTok: keine erlaubte Sichtbarkeit für dieses Konto')
  const text = tiktokText(item, caption)
  const titel = (fg?.titel || text.titel).slice(0, 90), beschreibung = text.beschreibung
  const tmp = path.join(ROOT, 'out', '_tiktok', item.id)
  // Eigene TikTok-Fassung (automatik/tiktok-bilder.mjs, 1080 × 1920) bevorzugen; sonst die Feed-Bilder einpassen
  const eigene = path.join(path.dirname(dateien[0] || ''), 'tiktok')
  const fertige = fs.existsSync(eigene) ? fs.readdirSync(eigene).filter((f) => /\.jpe?g$/i.test(f)).sort().map((f) => path.join(eigene, f)) : []
  const bilder = fertige.length >= 2 ? fertige : await bilderFuerTikTok(dateien, tmp)
  if (bilder.length < 2) throw new Error('TikTok: weniger als 2 Bilder')
  const plan = { konto: info.creator_username || info.creator_nickname, sichtbarkeit, bilder: bilder.length, titel }
  if (trocken) { fs.rmSync(tmp, { recursive: true, force: true }); return { trocken: true, ...plan } }
  const ordner = `${Date.now()}-${item.id}`
  const alsVideo = (einstellungen.format || 'foto') === 'video'
  const videoDatei = alsVideo ? await videoAusBildern(bilder, path.join(tmp, `${item.id}.mp4`)) : null
  const { urls, pfade } = await hochladen(alsVideo ? [videoDatei] : bilder, ordner)
  try {
    const kommentar = einstellungen.kommentare !== false && !info.comment_disabled
    // Modus „entwurf“ (Standard bis zur TikTok-Prüfung der App): Fotos landen im TikTok-Postfach, Christian tippt auf „Posten“ und wählt den Sound.
    // Modus „direkt“: sofort veröffentlichen (nur privat, solange die App ungeprüft ist; dann „unaudited_client_can_only_post_to_private_accounts“).
    const entwurf = (einstellungen.modus || 'entwurf') !== 'direkt'
    const start = alsVideo ? await post(entwurf ? '/v2/post/publish/inbox/video/init/' : '/v2/post/publish/video/init/', entwurf ? {
      source_info: { source: 'PULL_FROM_URL', video_url: urls[0] },
    } : {
      post_info: { title: kuerzen(`${titel}\n\n${beschreibung}`, 2150), privacy_level: sichtbarkeit, disable_comment: !kommentar, brand_content_toggle: false, brand_organic_toggle: einstellungen.eigene_marke !== false, is_aigc: einstellungen.ki_kennzeichnung !== false },
      source_info: { source: 'PULL_FROM_URL', video_url: urls[0] },
    }, t.access_token) : await post('/v2/post/publish/content/init/', entwurf ? {
      post_info: { title: titel, description: beschreibung },
      source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: urls },
      post_mode: 'MEDIA_UPLOAD', media_type: 'PHOTO',
    } : {
      post_info: {
        title: titel, description: beschreibung, privacy_level: sichtbarkeit, disable_comment: !kommentar,
        auto_add_music: einstellungen.auto_musik !== false,
        // eigene Marke bewerben (Werbehinweis „Eigene Marke“) und KI-Bilder kennzeichnen (TikTok-Regeln)
        brand_content_toggle: !!einstellungen.marken_inhalt, brand_organic_toggle: einstellungen.eigene_marke !== false,
        is_aigc: einstellungen.ki_kennzeichnung !== false,
      },
      source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: urls },
      post_mode: 'DIRECT_POST', media_type: 'PHOTO',
    }, t.access_token)
    let status = 'PROCESSING_DOWNLOAD', grund = ''
    for (let v = 0; v < 30; v++) {
      await warte(6000)
      const s = await post('/v2/post/publish/status/fetch/', { publish_id: start.publish_id }, t.access_token)
      status = s.status; grund = s.fail_reason || ''
      log(`TikTok ${start.publish_id}: ${status}${grund ? ' ' + grund : ''}`)
      if (status === 'PUBLISH_COMPLETE' || status === 'FAILED' || status === 'SEND_TO_USER_INBOX') break
    }
    if (status !== 'PUBLISH_COMPLETE' && status !== 'SEND_TO_USER_INBOX') throw new Error(`TikTok-Status ${status}${grund ? ': ' + grund : ''}`)
    return { publish_id: start.publish_id, sichtbarkeit: status === 'SEND_TO_USER_INBOX' ? 'ENTWURF' : sichtbarkeit }
  } finally {
    await aufraeumen(pfade)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [cmd, arg] = process.argv.slice(2)
  try {
    if (cmd === 'verbinden') {
      if (!arg) throw new Error('Aufruf: node automatik/tiktok.mjs verbinden <code>')
      const t = await verbinden(arg)
      console.log(`TikTok verbunden (open_id ${String(t.open_id).slice(0, 6)}…), Refresh-Token gültig bis ${new Date(t.refresh_bis).toISOString().slice(0, 10)}.`)
    } else if (cmd === 'status') {
      const t = await gueltigerToken()
      const info = await post('/v2/post/publish/creator_info/query/', {}, t.access_token)
      speichereKonto(info)
      console.log(`Konto ${info.creator_username || info.creator_nickname}, erlaubte Sichtbarkeit: ${(info.privacy_level_options || []).join(', ')}, max. Videolänge ${info.max_video_post_duration_sec}s`)
    } else if (cmd === 'entwuerfe') {
      // Sammel-Upload: die nächsten N geprüften Karussells als Entwurf ins TikTok-Postfach (Aufruf: entwuerfe <anzahl> [--echt])
      const { ladeQueue, speichereQueue } = await import('./queue.mjs')
      const n = Math.max(1, Math.min(30, Number(arg) || 10))
      const echt = process.argv.includes('--echt')
      const nurIds = (process.argv.find((a) => a.startsWith('--nur='))?.slice(6) || '').split(',').filter(Boolean)
      const params = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan/params.json'), 'utf8'))
      const q = await ladeQueue()
      const reihe = q.filter((x) => x.typ === 'karussell' && x.status === 'geprueft' && !x.tiktok?.publish_id && !(params.tiktok.entwurf_schon || []).includes(x.id) && fs.existsSync(path.join(ROOT, 'out', x.id, 'tiktok', '06.jpg')))
        .filter((x) => !nurIds.length || nurIds.includes(x.id)).sort((a, b) => nurIds.length ? nurIds.indexOf(a.id) - nurIds.indexOf(b.id) : (String(a.geplant || '9999').localeCompare(String(b.geplant || '9999')) || Number(a.id.slice(1)) - Number(b.id.slice(1)))).slice(0, n)
      console.log(`${reihe.length} Karussells: ${reihe.map((x) => x.id).join(', ')}${echt ? '' : ' (Probelauf)'}`)
      let ok = 0
      for (const item of reihe) {
        const ordner = path.join(ROOT, 'out', item.id)
        const dateien = fs.readdirSync(ordner).filter((f) => /\.jpe?g$/i.test(f)).sort().map((f) => path.join(ordner, f))
        try {
          const r = await veroeffentliche({ item, dateien, caption: item.caption || item.titel, einstellungen: { ...params.tiktok, modus: 'entwurf' }, trocken: !echt, log: console.log })
          console.log(`${item.id}: ${echt ? 'Entwurf gesendet' : 'ok'} ${r.publish_id || ''}`)
          if (echt) { item.tiktok = { ...r, am: new Date().toISOString() }; await speichereQueue(q); ok++; await warte(20000) }
        } catch (e) { console.log(`${item.id}: FEHLER ${String(e.message || e).slice(0, 300)}`); break }
      }
      console.log(`Entwürfe gesendet: ${ok}`)
    } else if (cmd === 'videodatei') {
      // Fertiges Video (z. B. aus Higgsfield) als Entwurf ins TikTok-Postfach: node automatik/tiktok.mjs videodatei <pfad> [--echt]
      // Titel, Beschreibung und Hashtags nimmt der Entwurfsweg von TikTok nicht an; sie stehen in <pfad>.txt zum Einfügen.
      if (!arg || !fs.existsSync(arg)) throw new Error('Aufruf: node automatik/tiktok.mjs videodatei <pfad.mp4> [--echt]')
      const echt = process.argv.includes('--echt')
      const t = await gueltigerToken()
      console.log(`${path.basename(arg)} (${Math.round(fs.statSync(arg).size / 1024)} KB)${echt ? '' : ' Probelauf'}`)
      if (echt) {
        const { urls, pfade } = await hochladen([arg], `${Date.now()}-video`)
        try {
          const start = await post('/v2/post/publish/inbox/video/init/', { source_info: { source: 'PULL_FROM_URL', video_url: urls[0] } }, t.access_token)
          let status = '', grund = ''
          for (let v = 0; v < 30; v++) {
            await warte(6000)
            const st = await post('/v2/post/publish/status/fetch/', { publish_id: start.publish_id }, t.access_token)
            status = st.status; grund = st.fail_reason || ''
            console.log(`TikTok ${start.publish_id}: ${status}${grund ? ' ' + grund : ''}`)
            if (status === 'FAILED' || status === 'SEND_TO_USER_INBOX' || status === 'PUBLISH_COMPLETE') break
          }
          if (status !== 'SEND_TO_USER_INBOX' && status !== 'PUBLISH_COMPLETE') throw new Error(`TikTok-Status ${status}${grund ? ': ' + grund : ''}`)
          console.log(`Video-Entwurf gesendet ${start.publish_id}`)
        } finally { await aufraeumen(pfade) }
      }
    } else if (cmd === 'test') {
      // Probelauf mit einem vorhandenen Karussell (out/<id>/*.jpg): ohne --echt nur Prüfung, mit --echt ein privater Beitrag
      const id = arg || 'k02'
      const ordner = path.join(ROOT, 'out', id)
      const dateien = fs.readdirSync(ordner).filter((f) => /\.jpe?g$/i.test(f)).sort().map((f) => path.join(ordner, f))
      const params = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan/params.json'), 'utf8'))
      const q = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan/queue.json'), 'utf8'))
      const item = q.find((x) => x.id === id) || { id, titel: id, hook: 'Test' }
      const r = await veroeffentliche({ item, dateien, caption: item.caption || 'Testbeitrag', einstellungen: freigabe(id) ? { ...params.tiktok, modus: 'direkt' } : { ...params.tiktok, modus: 'direkt', sichtbarkeit: 'SELF_ONLY' }, trocken: !process.argv.includes('--echt'), log: console.log })
      console.log('Ergebnis:', JSON.stringify(r))
    } else console.log('Aufruf: node automatik/tiktok.mjs verbinden <code> | status | test <id> [--echt] | entwuerfe <anzahl> [--echt]')
  } catch (e) { console.log(String(e.message || e)); process.exit(1) }
}
