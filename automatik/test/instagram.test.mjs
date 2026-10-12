// Tests für automatik/instagram.mjs gegen einen lokalen Mock-Server (kein Netzwerk zu Meta oder GitHub,
// nur Testwerte, keine echten Tokens).
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, mkdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  veroeffentlicheKarussell, veroeffentlicheBild, veroeffentlicheStory, veroeffentlicheReel,
  erneuereToken, insights, mediaListe, verschluessele, entschluessele,
} from '../instagram.mjs';

const TOKEN = 'TESTTOKEN-igaaXYZ-nicht-echt';
const MTOKEN = 'TESTMEDIA-ghp_nicht-echt';
const KEY = 'test-schluessel-mindestens-16-zeichen';
const UID = '1784TEST';
const REPO = 'testowner/testrepo';

let server, port, basisDir, opts, s;

function frisch() {
  return {
    dateien: new Map(), // Repo-Pfad -> sha
    anfragen: [],
    containers: new Map(),
    n: 0,
    modus: {},
    statusFolge: [],
  };
}

function lies(req) {
  return new Promise((res) => {
    const teile = [];
    req.on('data', (c) => teile.push(c));
    req.on('end', () => res(Buffer.concat(teile).toString('utf8')));
  });
}

before(async () => {
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const body = await lies(req);
    const antwort = (code, obj, kopf = {}) => {
      res.writeHead(code, { 'content-type': 'application/json', ...kopf });
      res.end(JSON.stringify(obj));
    };
    s.anfragen.push({ methode: req.method, pfad: url.pathname, query: url.search, body, auth: req.headers.authorization });

    // ---- GitHub
    const gh = url.pathname.match(/^\/repos\/([^/]+\/[^/]+)\/contents\/(.+)$/);
    if (gh) {
      if (req.headers.authorization !== `Bearer ${MTOKEN}`) return antwort(401, { message: 'Bad credentials' });
      const pfad = decodeURIComponent(gh[2]);
      if (req.method === 'PUT') {
        s.dateien.set(pfad, `sha-${++s.n}`);
        return antwort(201, { content: { sha: s.dateien.get(pfad), path: pfad } });
      }
      if (req.method === 'DELETE') {
        const j = JSON.parse(body);
        if (s.dateien.get(pfad) !== j.sha) return antwort(409, { message: 'sha falsch' });
        s.dateien.delete(pfad);
        return antwort(200, { commit: {} });
      }
    }
    // ---- raw
    const raw = url.pathname.match(/^\/raw\/([^/]+\/[^/]+)\/main\/(.+)$/);
    if (raw) {
      res.writeHead(s.dateien.has(decodeURIComponent(raw[2])) ? 200 : 404);
      return res.end('x');
    }
    // ---- Instagram
    if (url.pathname === '/refresh_access_token') {
      if (url.searchParams.get('grant_type') !== 'ig_refresh_token') return antwort(400, { error: { message: 'grant', code: 100 } });
      return antwort(200, { access_token: 'NEUES-TESTTOKEN-abc', token_type: 'bearer', expires_in: 5184000 });
    }
    const m = url.pathname.match(/^\/v25\.0\/([^/]+)(?:\/([^/]+))?$/);
    if (m) {
      const [, a, b] = m;
      const params = req.method === 'POST' ? new URLSearchParams(body) : url.searchParams;
      if (params.get('access_token') !== TOKEN) return antwort(400, { error: { message: 'Invalid OAuth access token', code: 190 } });
      if (b === 'content_publishing_limit') return antwort(200, { data: [s.limit ?? { quota_usage: 1, config: { quota_total: 50, quota_duration: 86400 } }] });
      if (b === 'media' && req.method === 'POST') {
        if (s.modus.containerFehler) return antwort(400, { error: { message: 'Media URL not accessible', code: 9004, error_subcode: 2207052 } });
        if (s.modus.container429 && !s.einmal429) { s.einmal429 = true; return antwort(429, { error: { message: 'slow down', code: 4 } }, { 'retry-after': '0' }); }
        const id = `C${++s.n}`;
        s.containers.set(id, Object.fromEntries(params));
        return antwort(200, { id });
      }
      if (b === 'media' && req.method === 'GET') {
        return antwort(200, { data: [{ id: 'M1' }, { id: 'M2' }], paging: { next: `http://127.0.0.1:${port}/v25.0/${a}/media?after=X&access_token=${TOKEN}` } });
      }
      if (b === 'media_publish') {
        if (s.modus.publish500) return antwort(500, { error: { message: 'boom', code: 2 } });
        return antwort(200, { id: 'POST123' });
      }
      if (b === 'insights') {
        const metrics = params.get('metric').split(',');
        if (s.modus.ohneMetrik && metrics.length > 1) return antwort(400, { error: { message: 'nicht unterstützt', code: 100 } });
        if (metrics.includes(s.modus.ohneMetrik)) return antwort(400, { error: { message: 'nicht unterstützt', code: 100 } });
        return antwort(200, { data: metrics.map((n, i) => ({ name: n, period: 'lifetime', values: [{ value: i + 1 }] })) });
      }
      if (!b && s.containers.has(a) && params.get('fields') === 'status_code') {
        const naechst = s.statusFolge.shift() ?? 'FINISHED';
        return antwort(200, { status_code: naechst, id: a });
      }
      if (!b && params.get('fields') === 'permalink') return antwort(200, { permalink: 'https://www.instagram.com/p/TEST/', id: a });
      if (!b && params.get('fields') === 'media_product_type') return antwort(200, { media_product_type: 'REELS', id: a });
    }
    antwort(404, { error: { message: 'unbekannt ' + url.pathname, code: 1 } });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});

after(() => server.close());

beforeEach(async () => {
  s = frisch();
  basisDir = await mkdtemp(join(tmpdir(), 'ig-test-'));
  await mkdir(join(basisDir, 'data'), { recursive: true });
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
  for (const n of ['a.jpg', 'b.jpg', 'c.jpg', 'cover.jpg']) await writeFile(join(basisDir, n), jpg);
  await writeFile(join(basisDir, 'clip.mp4'), Buffer.alloc(64, 1));
  await writeFile(join(basisDir, 'bild.png'), Buffer.from([0x89, 0x50]));
  const host = `http://127.0.0.1:${port}`;
  opts = {
    basis: basisDir,
    env: { IG_ACCESS_TOKEN: TOKEN, IG_USER_ID: UID, MEDIA_REPO: REPO, MEDIA_TOKEN: MTOKEN, TOKEN_KEY: KEY },
    hosts: { ig: host, github: host, raw: `${host}/raw` },
    wartezeitMs: 1,
    pollMs: 1,
    pollTimeoutMs: 2000,
  };
});

const posts = (pfadTeil) => s.anfragen.filter((a) => a.methode === 'POST' && a.pfad.includes(pfadTeil));

test('Karussell: Kinder, Eltern, Veröffentlichung, Aufräumen', async () => {
  const r = await veroeffentlicheKarussell({ dateien: ['a.jpg', 'b.jpg', 'c.jpg'], caption: 'Hallo #eins' }, opts);
  assert.deepEqual(r, { id: 'POST123', permalink: 'https://www.instagram.com/p/TEST/' });
  const cont = posts(`/${UID}/media`).filter((a) => !a.pfad.endsWith('publish'));
  assert.equal(cont.length, 4);
  const kinder = cont.slice(0, 3).map((a) => new URLSearchParams(a.body));
  for (const k of kinder) {
    assert.equal(k.get('is_carousel_item'), 'true');
    assert.match(k.get('image_url'), new RegExp(`^http://127.0.0.1:${port}/raw/${REPO}/main/tmp/\\d+-[0-9a-f]+/0[123]-[abc]\\.jpg$`));
  }
  const eltern = new URLSearchParams(cont[3].body);
  assert.equal(eltern.get('media_type'), 'CAROUSEL');
  assert.equal(eltern.get('children'), 'C3,C4,C5'.replace('C3,C4,C5', [...s.containers.keys()].slice(0, 3).join(',')));
  assert.equal(eltern.get('caption'), 'Hallo #eins');
  assert.equal(new URLSearchParams(posts('media_publish')[0].body).get('creation_id'), [...s.containers.keys()][3]);
  assert.equal(s.dateien.size, 0, 'Mediendateien müssen wieder gelöscht sein');
});

test('Bild', async () => {
  const r = await veroeffentlicheBild({ datei: 'a.jpg', caption: 'x' }, opts);
  assert.equal(r.id, 'POST123');
  assert.equal(s.dateien.size, 0);
});

test('Story (Bild) nutzt media_type STORIES ohne Caption', async () => {
  const r = await veroeffentlicheStory({ datei: 'a.jpg' }, opts);
  assert.equal(r.id, 'POST123');
  const c = [...s.containers.values()][0];
  assert.equal(c.media_type, 'STORIES');
  assert.ok(c.image_url);
  assert.equal(c.caption, undefined);
  assert.equal(s.dateien.size, 0);
});

test('Reel: Statuspolling bis FINISHED, Cover, share_to_feed', async () => {
  s.statusFolge = ['IN_PROGRESS', 'IN_PROGRESS', 'FINISHED'];
  const r = await veroeffentlicheReel({ video: 'clip.mp4', caption: 'Reel', cover: 'cover.jpg' }, opts);
  assert.equal(r.id, 'POST123');
  const c = [...s.containers.values()][0];
  assert.equal(c.media_type, 'REELS');
  assert.match(c.video_url, /clip\.mp4$/);
  assert.match(c.cover_url, /cover\.jpg$/);
  assert.equal(c.share_to_feed, 'true');
  const statusAbfragen = s.anfragen.filter((a) => a.query.includes('status_code'));
  assert.equal(statusAbfragen.length, 3);
  // erst nach dem letzten Status wurde veröffentlicht
  const iPub = s.anfragen.findIndex((a) => a.pfad.endsWith('media_publish'));
  const iLetzterStatus = s.anfragen.map((a) => a.query.includes('status_code')).lastIndexOf(true);
  assert.ok(iLetzterStatus < iPub);
  assert.equal(s.dateien.size, 0);
});

test('Reel: ERROR-Status bricht ab und räumt auf', async () => {
  s.statusFolge = ['ERROR'];
  await assert.rejects(veroeffentlicheReel({ video: 'clip.mp4' }, opts), /nicht verarbeiten/);
  assert.equal(posts('media_publish').length, 0);
  assert.equal(s.dateien.size, 0);
});

test('Fehlerfall: Container scheitert, Dateien werden gelöscht, Token nicht in der Meldung', async () => {
  s.modus.containerFehler = true;
  let fehler;
  try {
    await veroeffentlicheKarussell({ dateien: ['a.jpg', 'b.jpg'] }, opts);
  } catch (e) { fehler = e; }
  assert.ok(fehler, 'muss werfen');
  assert.match(fehler.message, /Instagram-Fehler 9004\/2207052/);
  assert.ok(!fehler.message.includes(TOKEN) && !fehler.message.includes(MTOKEN));
  assert.equal(posts('media_publish').length, 0);
  assert.equal(s.dateien.size, 0, 'auch im Fehlerfall aufgeräumt');
  assert.ok(s.anfragen.some((a) => a.methode === 'DELETE'));
});

test('Wiederholung bei 429; 5xx bei media_publish wird nicht wiederholt', async () => {
  s.modus.container429 = true;
  const r = await veroeffentlicheBild({ datei: 'a.jpg' }, opts);
  assert.equal(r.id, 'POST123');
  assert.equal(s.containers.size, 1);

  s = frisch();
  s.modus.publish500 = true;
  await assert.rejects(veroeffentlicheBild({ datei: 'a.jpg' }, opts), /Zustand ist unklar/);
  assert.equal(posts('media_publish').length, 1, 'genau ein Versuch');
  assert.equal(s.dateien.size, 0);
});

test('Publishing-Limit erreicht: nichts wird hochgeladen', async () => {
  s.limit = { quota_usage: 50, config: { quota_total: 50, quota_duration: 86400 } };
  await assert.rejects(veroeffentlicheBild({ datei: 'a.jpg' }, opts), /Publishing-Limit erreicht/);
  assert.equal(s.anfragen.filter((a) => a.methode === 'PUT').length, 0);
});

test('Eingabeprüfung: PNG, zu wenige Karussell-Bilder, zu lange Caption', async () => {
  await assert.rejects(veroeffentlicheBild({ datei: 'bild.png' }, opts), /JPEG/);
  await assert.rejects(veroeffentlicheKarussell({ dateien: ['a.jpg'] }, opts), /2 bis 10/);
  await assert.rejects(veroeffentlicheBild({ datei: 'a.jpg', caption: 'x'.repeat(2201) }, opts), /zu lang/);
  assert.equal(s.anfragen.length, 0, 'keine Anfrage bei ungültiger Eingabe');
});

test('PAUSE verhindert jedes Veröffentlichen', async () => {
  await writeFile(join(basisDir, 'PAUSE'), '');
  await assert.rejects(veroeffentlicheBild({ datei: 'a.jpg' }, opts), /PAUSE/);
  assert.equal(s.anfragen.length, 0);
});

test('Trocken-Modus: keine Anfrage, geplante Requests ohne Token, kein media_publish echt', async () => {
  const o = { ...opts, trocken: true, env: { ...opts.env, IG_ACCESS_TOKEN: undefined, MEDIA_TOKEN: undefined } };
  const r = await veroeffentlicheKarussell({ dateien: ['a.jpg', 'b.jpg'], caption: 'c' }, o);
  assert.equal(s.anfragen.length, 0, 'trocken darf keine Netzwerkanfrage senden');
  assert.equal(r.trocken, true);
  assert.equal(r.id, null);
  assert.ok(r.geplant.some((g) => g.ziel.endsWith('/media_publish')));
  assert.ok(r.geplant.filter((g) => g.methode === 'PUT').every((g) => g.uebersprungen));
  const text = JSON.stringify(r);
  assert.ok(!text.includes(TOKEN) && !text.includes(MTOKEN));
  const t2 = await erneuereToken(o);
  assert.equal(t2.trocken, true);
  assert.equal(s.anfragen.length, 0);
});

test('Token-Verschlüsselung Hin und Zurück, falscher Schlüssel scheitert', async () => {
  const blob = verschluessele({ token: TOKEN }, KEY);
  assert.ok(!blob.includes(TOKEN));
  assert.equal(entschluessele(blob, KEY).token, TOKEN);
  assert.throws(() => entschluessele(blob, 'ein-anderer-schluessel-16+'), /falscher TOKEN_KEY/);
  assert.throws(() => verschluessele({}, 'kurz'), /zu kurz/);
  // zwei Verschlüsselungen desselben Inhalts unterscheiden sich (zufälliger IV/Salt)
  assert.notEqual(blob, verschluessele({ token: TOKEN }, KEY));
});

test('erneuereToken speichert verschlüsselt, danach wird das neue Token benutzt', async () => {
  const r = await erneuereToken(opts);
  assert.ok(r.ablaufAm);
  assert.ok(!JSON.stringify(r).includes('NEUES-TESTTOKEN'));
  const datei = await readFile(join(basisDir, 'data', 'ig-token.enc'), 'utf8');
  assert.ok(!datei.includes('NEUES-TESTTOKEN') && !datei.includes(TOKEN));
  assert.equal(entschluessele(datei, KEY).token, 'NEUES-TESTTOKEN-abc');
  // Mock kennt nur das alte Token: der Aufruf muss jetzt mit dem neuen scheitern (beweist, dass die Datei gilt)
  await assert.rejects(mediaListe(5, opts), /190/);
  // Wird IG_ACCESS_TOKEN von Hand ersetzt, gewinnt der neue Umgebungswert
  const o2 = { ...opts, env: { ...opts.env, IG_ACCESS_TOKEN: TOKEN } };
  // gleicher Wert wie beim Erneuern -> Datei gilt
  await assert.rejects(mediaListe(5, o2), /190/);
  const o3 = { ...opts, env: { ...opts.env, IG_ACCESS_TOKEN: TOKEN + '' } };
  await rm(join(basisDir, 'data', 'ig-token.enc'));
  assert.equal((await mediaListe(1, o3)).length, 1);
});

test('erneuereToken ohne TOKEN_KEY: Abbruch vor dem Request', async () => {
  const o = { ...opts, env: { ...opts.env, TOKEN_KEY: undefined } };
  await assert.rejects(erneuereToken(o), /TOKEN_KEY/);
  assert.equal(s.anfragen.length, 0);
});

test('insights: Typ per Abfrage, Metrikwerte, Rückfall bei nicht unterstützter Metrik', async () => {
  const r = await insights('R1', opts);
  assert.equal(r.typ, 'reel');
  assert.equal(r.werte.reach, 1);
  assert.ok('ig_reels_avg_watch_time' in r.werte);
  s.modus.ohneMetrik = 'saved';
  const r2 = await insights('F1', { ...opts, typ: 'feed' });
  assert.deepEqual(r2.nichtVerfuegbar, ['saved']);
  assert.ok('reach' in r2.werte && !('saved' in r2.werte));
});

test('mediaListe folgt der Seitennummerierung bis limit', async () => {
  const l = await mediaListe(3, opts);
  assert.equal(l.length, 3);
});
