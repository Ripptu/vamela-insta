// Zeigt die rohe Antwort der Instagram-API auf einfache Abfragen (ohne Token auszugeben). Für die Fehlersuche.
import { entschluessele } from './instagram.mjs'
import fs from 'node:fs'
const uid = process.env.IG_USER_ID
let token = process.env.IG_ACCESS_TOKEN
try { if (fs.existsSync('data/ig-token.enc') && process.env.TOKEN_KEY) token = entschluessele(fs.readFileSync('data/ig-token.enc', 'utf8'), process.env.TOKEN_KEY).token || token } catch (e) { console.log('Tokendatei nicht lesbar:', e.message) }
const zeige = async (name, url) => {
  const r = await fetch(url.replace('TOKEN', encodeURIComponent(token)))
  const t = await r.text()
  console.log(`${name}: HTTP ${r.status}`, t.replaceAll(token, '<TOKEN>').slice(0, 900))
}
await zeige('me', 'https://graph.instagram.com/v25.0/me?fields=id,username,account_type&access_token=TOKEN')
await zeige('konto', `https://graph.instagram.com/v25.0/${uid}?fields=username,followers_count&access_token=TOKEN`)
await zeige('limit', `https://graph.instagram.com/v25.0/${uid}/content_publishing_limit?fields=quota_usage,config&access_token=TOKEN`)
