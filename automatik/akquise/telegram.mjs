// Telegram-Bot „VAMELA Akquise“ (Secret TELEGRAM_AKQUISE_TOKEN). Die Chat-ID merkt sich die Akquise selbst,
// sobald Christian dem Bot einmal /start geschrieben hat.
const token = () => process.env.TELEGRAM_AKQUISE_TOKEN || ''
export const bereit = () => token().length > 20

async function api(methode, body) {
  const r = await fetch(`https://api.telegram.org/bot${token()}/${methode}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  })
  const j = await r.json().catch(() => ({}))
  if (!j.ok) throw new Error(`Telegram ${methode}: ${j.description || r.status}`)
  return j.result
}

export async function chatId(z) {
  if (z.chat_id) return z.chat_id
  const updates = await api('getUpdates', { limit: 50 })
  const m = [...updates].reverse().find((u) => u.message?.chat?.type === 'private')
  if (m) z.chat_id = m.message.chat.id
  return z.chat_id
}

export const html = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function sende(z, text) {
  const id = await chatId(z)
  if (!id) throw new Error('Keine Chat-ID: Schreib dem Bot einmal /start.')
  return api('sendMessage', { chat_id: id, text, parse_mode: 'HTML', disable_web_page_preview: true })
}

/** Reiner Text ohne Formatierung als eigene Nachricht: lange drücken, Kopieren, fertig (Christian, 25.10.2026). */
export async function sendeKopiertext(z, text) {
  const id = await chatId(z)
  if (!id) throw new Error('Keine Chat-ID: Schreib dem Bot einmal /start.')
  return api('sendMessage', { chat_id: id, text, disable_web_page_preview: true })
}

/** Bild schicken (multipart), z. B. den Handy-Screenshot für DM 2. */
export async function sendeBild(z, datei, caption = '') {
  const fs = await import('node:fs')
  const id = await chatId(z)
  if (!id) throw new Error('Keine Chat-ID: Schreib dem Bot einmal /start.')
  const form = new FormData()
  form.append('chat_id', String(id))
  if (caption) form.append('caption', caption)
  form.append('photo', new Blob([fs.readFileSync(datei)], { type: 'image/jpeg' }), 'website-handy.jpg')
  const r = await fetch(`https://api.telegram.org/bot${token()}/sendPhoto`, { method: 'POST', body: form, signal: AbortSignal.timeout(60000) })
  const j = await r.json().catch(() => ({}))
  if (!j.ok) throw new Error(`Telegram sendPhoto: ${j.description || r.status}`)
  return j.result
}
