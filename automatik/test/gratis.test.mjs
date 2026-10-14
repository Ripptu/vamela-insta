import test from 'node:test'
import assert from 'node:assert/strict'
import { gratis, gratisZugang } from '../../render/gratis.mjs'

const ENV = { CLOUDFLARE_ACCOUNT_ID: 'a', CLOUDFLARE_API_TOKEN: 't', POLLINATIONS_KEY: 'sk_x' }
const png = Buffer.from('bild')
const cf = (b64 = png.toString('base64')) => new Response(JSON.stringify({ result: { image: b64 } }), { status: 200 })
const leer = () => new Response('{"errors":[{"message":"you have used up your daily free allocation","code":4006}]}', { status: 429 })

test('gratisZugang braucht Konto-ID und Token', () => {
  assert.equal(gratisZugang({}), false)
  assert.equal(gratisZugang({ CLOUDFLARE_ACCOUNT_ID: 'a' }), false)
  assert.equal(gratisZugang(ENV), true)
})

test('erstes Modell liefert: ein Aufruf, Bytes kommen zurück', async () => {
  const urls = []
  const c = gratis({ env: ENV, fetch: async (u) => { urls.push(u); return cf() } })
  const r = await c.erzeugen('a lamp')
  assert.deepEqual(r.bytes, png)
  assert.equal(urls.length, 1)
  assert.match(urls[0], /flux-2-klein-9b/)
})

test('Kontingent leer: springt zum nächsten Modell und sperrt das leere für den Lauf', async () => {
  const urls = []
  const c = gratis({ env: ENV, fetch: async (u) => { urls.push(u); return /klein-9b/.test(u) ? leer() : cf() } })
  const a = await c.erzeugen('x'), b = await c.erzeugen('y')
  assert.match(a.modell, /klein-4b/)
  assert.match(b.modell, /klein-4b/)
  assert.equal(urls.filter((u) => /klein-9b/.test(u)).length, 1, 'gesperrtes Modell wird nicht erneut versucht')
})

test('alles leer: klarer Fehler, kein stilles Weitermachen', async () => {
  const c = gratis({ env: ENV, fetch: async () => new Response('', { status: 402 }) })
  await assert.rejects(c.erzeugen('x'), /Gratis-Kette ohne Bild/)
})

test('anderer Fehler (500) sperrt nicht, nächstes Modell wird probiert', async () => {
  let n = 0
  const c = gratis({ env: ENV, fetch: async () => (n++ === 0 ? new Response('boom', { status: 500 }) : cf()) })
  assert.match((await c.erzeugen('x')).modell, /klein-4b/)
})
