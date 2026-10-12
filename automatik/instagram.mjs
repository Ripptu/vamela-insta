// Instagram-Client (Instagram API with Instagram Login, Host graph.instagram.com).
//
// Quellen (offizielle Meta-Dokumentation, geprüft am 29.09.2026):
//  - Content Publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing
//    (POST /<IG_ID>/media, POST /<IG_ID>/media_publish, GET /<CONTAINER>?fields=status_code,
//     status_code: EXPIRED | ERROR | FINISHED | IN_PROGRESS | PUBLISHED; nur JPEG; Karussell bis 10 Items)
//  - IG User Media (Container-Parameter): https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/
//    (media_type REELS|STORIES|CAROUSEL, video_url, image_url, is_carousel_item, children, caption
//     max. 2200 Zeichen / 30 Hashtags, cover_url + share_to_feed nur Reels; Reels-Video MP4/MOV, H.264/HEVC,
//     23-60 fps, 3 s bis 15 min, max. 300 MB; Story-Video 3-60 s, max. 100 MB; Container verfallen nach 24 h)
//  - Publishing-Limit: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit/
//    (GET /<IG_ID>/content_publishing_limit?fields=quota_usage,config -> data[0].quota_usage, config.quota_total)
//    Hinweis: Die Doku nennt an einer Stelle 100, an anderer 50 Beiträge/24 h. Wir lesen quota_total aus der Antwort.
//  - Token-Erneuerung: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
//    (GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=...,
//     Token mindestens 24 h alt und noch gültig, Antwort access_token/token_type/expires_in)
//  - Insights: https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights
//    (GET /<MEDIA_ID>/insights?metric=...; impressions für Medien nach 2.7.2024 abgeschafft, stattdessen views)
//  - Media-Felder: https://developers.facebook.com/docs/instagram-platform/reference/instagram-media
//  - Graph-API-Version: Beispiele der Doku nutzen v25.0 (überschreibbar über IG_API_VERSION oder opts.version).
//  - GitHub Contents API (Medien-Repo): PUT/DELETE /repos/{owner}/{repo}/contents/{path}
//    https://docs.github.com/en/rest/repos/contents
//
// Umgebung: IG_ACCESS_TOKEN, IG_USER_ID, MEDIA_REPO (owner/name), MEDIA_TOKEN, TOKEN_KEY (Verschlüsselung
// der Datei data/ig-token.enc), optional MEDIA_BRANCH (Standard main), IG_API_VERSION.
// Tokens und Schlüssel werden nie geloggt und nie in Fehlermeldungen ausgegeben.

import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const STANDARD_VERSION = 'v25.0';
const MAX_VERSUCHE = 4;
const MAX_CAPTION = 2200;
const MAX_HASHTAGS = 30;
const MAX_REEL_BYTES = 300 * 1024 * 1024;
const MAX_STORY_VIDEO_BYTES = 100 * 1024 * 1024;
const AAD = Buffer.from('vamela-insta-ig-token-v1');

// Meta-Fehlercodes für Ratenbegrenzung (4 App, 17 Nutzer, 32 Seite, 613 Aufrufrate).
const RATE_CODES = new Set([4, 17, 32, 613]);

export class InstagramFehler extends Error {
  constructor(nachricht, { status = null, code = null, subcode = null } = {}) {
    super(nachricht);
    this.name = 'InstagramFehler';
    this.status = status;
    this.code = code;
    this.subcode = subcode;
  }
}

// ---------------------------------------------------------------- Verschlüsselung (AES-256-GCM)

function schluesselAus(passwort, salt) {
  if (typeof passwort !== 'string' || passwort.length < 16) {
    throw new InstagramFehler('TOKEN_KEY fehlt oder ist zu kurz (mindestens 16 Zeichen).');
  }
  return scryptSync(passwort, salt, 32);
}

/** Verschlüsselt ein JSON-Objekt; Ergebnis ist ein JSON-Text (salt, iv, tag, ct als base64). */
export function verschluessele(objekt, passwort) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', schluesselAus(passwort, salt), iv);
  c.setAAD(AAD);
  const ct = Buffer.concat([c.update(JSON.stringify(objekt), 'utf8'), c.final()]);
  return JSON.stringify({
    v: 1,
    alg: 'aes-256-gcm',
    kdf: 'scrypt',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: c.getAuthTag().toString('base64'),
    ct: ct.toString('base64'),
  });
}

export function entschluessele(text, passwort) {
  try {
    const d = JSON.parse(text);
    if (d.v !== 1) throw new Error('unbekannte Version');
    const dc = createDecipheriv(
      'aes-256-gcm',
      schluesselAus(passwort, Buffer.from(d.salt, 'base64')),
      Buffer.from(d.iv, 'base64'),
    );
    dc.setAAD(AAD);
    dc.setAuthTag(Buffer.from(d.tag, 'base64'));
    const klar = Buffer.concat([dc.update(Buffer.from(d.ct, 'base64')), dc.final()]);
    return JSON.parse(klar.toString('utf8'));
  } catch (e) {
    if (e instanceof InstagramFehler) throw e;
    throw new InstagramFehler('Token-Datei nicht lesbar: falscher TOKEN_KEY oder beschädigte Datei.');
  }
}

const fingerabdruck = (s) => createHash('sha256').update(s ?? '').digest('hex');

// ---------------------------------------------------------------- Kontext

function kontext(opts = {}) {
  const env = opts.env ?? process.env;
  const basis = opts.basis ?? WURZEL;
  return {
    env,
    basis,
    trocken: opts.trocken === true,
    hosts: {
      ig: 'https://graph.instagram.com',
      github: 'https://api.github.com',
      raw: 'https://raw.githubusercontent.com',
      ...(opts.hosts ?? {}),
    },
    version: opts.version ?? env.IG_API_VERSION ?? STANDARD_VERSION,
    warteMs: opts.wartezeitMs ?? 2000,
    pollMs: opts.pollMs ?? 5000,
    pollTimeoutMs: opts.pollTimeoutMs ?? 5 * 60 * 1000,
    rawPruefen: opts.rawPruefen !== false,
    tokenDatei: opts.tokenDatei ?? join(basis, 'data', 'ig-token.enc'),
    log: opts.log ?? (() => {}),
    geheim: new Set(),
    _token: null,
  };
}

const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

function schwaerze(ctx, text) {
  let t = String(text);
  for (const g of ctx.geheim) if (g) t = t.split(g).join('***');
  return t;
}

async function ladeToken(ctx) {
  if (ctx._token) return ctx._token;
  const envToken = ctx.env.IG_ACCESS_TOKEN || null;
  let token = envToken;
  if (existsSync(ctx.tokenDatei)) {
    if (!ctx.env.TOKEN_KEY) {
      throw new InstagramFehler(`${ctx.tokenDatei} existiert, aber TOKEN_KEY ist nicht gesetzt.`);
    }
    ctx.geheim.add(ctx.env.TOKEN_KEY);
    const d = entschluessele(await readFile(ctx.tokenDatei, 'utf8'), ctx.env.TOKEN_KEY);
    // Wurde IG_ACCESS_TOKEN seit der letzten Erneuerung von Hand ersetzt, gilt der neue Wert.
    const manuellErsetzt = envToken && fingerabdruck(envToken) !== d.envFingerprint;
    if (!manuellErsetzt) token = d.token;
    ctx._datei = d;
  }
  if (!token) throw new InstagramFehler('Kein Instagram-Token: IG_ACCESS_TOKEN ist nicht gesetzt.');
  ctx.geheim.add(token);
  ctx._token = token;
  return token;
}

// ---------------------------------------------------------------- HTTP mit Wiederholung

function metaFehler(ctx, status, daten, was) {
  const e = daten?.error;
  if (!e) return new InstagramFehler(`${was}: HTTP ${status}.`, { status });
  const code = e.code ?? null;
  const sub = e.error_subcode ?? null;
  let hinweis = '';
  if (code === 190) hinweis = ' (Token ungültig oder abgelaufen, bitte Token erneuern bzw. neu erzeugen)';
  else if (code === 10 || code === 200) hinweis = ' (fehlende Berechtigung der App)';
  else if (code === 100) hinweis = ' (ungültiger Parameter)';
  else if (RATE_CODES.has(code)) hinweis = ' (Ratenbegrenzung)';
  const msg = e.error_user_msg || e.message || 'unbekannter Fehler';
  return new InstagramFehler(
    schwaerze(ctx, `${was}: Instagram-Fehler ${code ?? '?'}${sub ? '/' + sub : ''}: ${msg}${hinweis}`),
    { status, code, subcode: sub },
  );
}

/**
 * Sendet eine Anfrage; wiederholt bei Netzwerkfehlern, 429, 5xx und Meta-Ratencodes
 * (exponentielle Wartezeit, Retry-After wird beachtet). wiederhole:false = keine Wiederholung.
 */
async function sende(ctx, { methode = 'GET', url, form, json, headers = {}, was, ok404 = false, wiederhole = 'alle' }) {
  const kopf = { ...headers };
  let body;
  if (form) {
    kopf['content-type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(form).toString();
  } else if (json) {
    kopf['content-type'] = 'application/json';
    body = JSON.stringify(json);
  }
  let letzter;
  for (let versuch = 0; versuch < MAX_VERSUCHE; versuch++) {
    let res;
    try {
      res = await fetch(url, { method: methode, headers: kopf, body });
    } catch (e) {
      letzter = new InstagramFehler(schwaerze(ctx, `${was}: Netzwerkfehler (${e.cause?.code ?? e.message}).`));
      if (wiederhole !== 'alle' || versuch === MAX_VERSUCHE - 1) throw letzter;
      await schlaf(ctx.warteMs * 2 ** versuch);
      continue;
    }
    const text = await res.text();
    let daten = null;
    try {
      daten = text ? JSON.parse(text) : null;
    } catch {
      daten = null;
    }
    if (res.ok || (ok404 && res.status === 404)) return { status: res.status, daten, text };
    const fehler = metaFehler(ctx, res.status, daten, was);
    const rateCode = RATE_CODES.has(daten?.error?.code);
    const github403 = res.status === 403 && res.headers.get('retry-after');
    const github409 = res.status === 409 && url.startsWith(ctx.hosts.github);
    const wiederholbar =
      res.status === 429 || rateCode || github403 || github409 || (res.status >= 500 && wiederhole === 'alle');
    if (!wiederholbar || versuch === MAX_VERSUCHE - 1) {
      if (res.status >= 500 && wiederhole !== 'alle') {
        fehler.message += ' Der Zustand ist unklar, bitte auf Instagram bzw. mit mediaListe() prüfen, bevor erneut versucht wird.';
      }
      throw fehler;
    }
    const ra = Number(res.headers.get('retry-after'));
    const wartezeit = ra > 0 ? Math.min(ra * 1000, 60000) : ctx.warteMs * 2 ** versuch;
    ctx.log(`${was}: HTTP ${res.status}, neuer Versuch in ${Math.round(wartezeit / 1000)} s`);
    letzter = fehler;
    await schlaf(wartezeit);
  }
  throw letzter;
}

// ---------------------------------------------------------------- API-Schicht (echt oder trocken)

function apiEcht(ctx) {
  const uid = ctx.env.IG_USER_ID;
  const basisUrl = `${ctx.hosts.ig}/${ctx.version}`;
  const repo = ctx.env.MEDIA_REPO;
  const branch = ctx.env.MEDIA_BRANCH || 'main';
  const gh = () => ({
    authorization: `Bearer ${ctx.env.MEDIA_TOKEN}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'vamela-insta-automatik',
  });
  const kodiere = (p) => p.split('/').map(encodeURIComponent).join('/');
  const hochgeladen = [];
  return {
    uid,
    hochgeladen,
    async get(pfad, params = {}, was = 'Instagram-Abfrage') {
      const token = await ladeToken(ctx);
      const u = new URL(`${basisUrl}/${pfad}`);
      for (const [k, v] of Object.entries({ ...params, access_token: token })) u.searchParams.set(k, v);
      return (await sende(ctx, { url: u.toString(), was })).daten;
    },
    async post(pfad, params, was, wiederhole = 'alle') {
      const token = await ladeToken(ctx);
      const r = await sende(ctx, {
        methode: 'POST',
        url: `${basisUrl}/${pfad}`,
        form: { ...params, access_token: token },
        was,
        wiederhole,
      });
      return r.daten;
    },
    async hochladen(datei, ordner, index) {
      const inhalt = await readFile(datei);
      const name = `${String(index).padStart(2, '0')}-${basename(datei).toLowerCase().replace(/[^a-z0-9._-]/g, '_')}`;
      const pfad = `${ordner}/${name}`;
      const r = await sende(ctx, {
        methode: 'PUT',
        url: `${ctx.hosts.github}/repos/${repo}/contents/${kodiere(pfad)}`,
        headers: gh(),
        json: { message: 'tmp: Medien für Veröffentlichung', content: inhalt.toString('base64'), branch },
        was: `Hochladen ins Medien-Repo (${name})`,
      });
      const eintrag = { pfad, sha: r.daten?.content?.sha };
      hochgeladen.push(eintrag);
      const url = `${ctx.hosts.raw}/${repo}/${branch}/${kodiere(pfad)}`;
      if (ctx.rawPruefen) await rawErreichbar(ctx, url, name);
      return url;
    },
    async aufraeumen() {
      const fehler = [];
      for (const e of hochgeladen.splice(0).reverse()) {
        try {
          if (!e.sha) throw new Error('keine sha bekannt');
          await sende(ctx, {
            methode: 'DELETE',
            url: `${ctx.hosts.github}/repos/${repo}/contents/${kodiere(e.pfad)}`,
            headers: gh(),
            json: { message: 'tmp: Medien entfernt', sha: e.sha, branch },
            was: `Löschen im Medien-Repo (${e.pfad})`,
            ok404: true,
          });
        } catch (err) {
          fehler.push(`${e.pfad}: ${schwaerze(ctx, err.message)}`);
        }
      }
      return fehler;
    },
  };
}

async function rawErreichbar(ctx, url, name) {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(url, { method: 'HEAD' });
      if (r.ok) return;
    } catch {
      /* nächster Versuch */
    }
    await schlaf(ctx.warteMs * (i + 1));
  }
  throw new InstagramFehler(`Die hochgeladene Datei ${name} ist unter der öffentlichen Adresse nicht erreichbar (raw.githubusercontent.com). Ist das Medien-Repo öffentlich und MEDIA_BRANCH richtig?`);
}

// Trockenlauf: dieselben Abläufe, aber nichts wird gesendet; Anfragen werden aufgezeichnet.
function apiTrocken(ctx) {
  const uid = ctx.env.IG_USER_ID || '<IG_USER_ID>';
  const repo = ctx.env.MEDIA_REPO || '<MEDIA_REPO>';
  const branch = ctx.env.MEDIA_BRANCH || 'main';
  const geplant = [];
  let n = 0;
  return {
    uid,
    geplant,
    hochgeladen: [],
    async get(pfad, params = {}) {
      geplant.push({ methode: 'GET', ziel: `${ctx.hosts.ig}/${ctx.version}/${pfad}`, parameter: { ...params, access_token: '<TOKEN>' } });
      return { status_code: 'FINISHED', id: `TROCKEN-${++n}`, permalink: null };
    },
    async post(pfad, params) {
      geplant.push({ methode: 'POST', ziel: `${ctx.hosts.ig}/${ctx.version}/${pfad}`, parameter: { ...params, access_token: '<TOKEN>' } });
      return { id: `TROCKEN-${++n}` };
    },
    async hochladen(datei, ordner, index) {
      const inhalt = await readFile(datei);
      const name = `${String(index).padStart(2, '0')}-${basename(datei).toLowerCase().replace(/[^a-z0-9._-]/g, '_')}`;
      const pfad = `${ordner}/${name}`;
      geplant.push({
        methode: 'PUT',
        ziel: `${ctx.hosts.github}/repos/${repo}/contents/${pfad}`,
        parameter: { content: `<base64, ${inhalt.length} Bytes>`, branch },
        uebersprungen: true,
      });
      return `${ctx.hosts.raw}/${repo}/${branch}/${pfad}`;
    },
    async aufraeumen() {
      return [];
    },
  };
}

// ---------------------------------------------------------------- Prüfungen

const JPEG = new Set(['.jpg', '.jpeg']);
const VIDEO = new Set(['.mp4', '.mov']);

async function pruefeDatei(datei, { art, maxBytes }) {
  let s;
  try {
    s = await stat(datei);
  } catch {
    throw new InstagramFehler(`Datei nicht gefunden: ${datei}`);
  }
  if (!s.isFile() || s.size === 0) throw new InstagramFehler(`Keine gültige Datei: ${datei}`);
  const ext = extname(datei).toLowerCase();
  if (art === 'jpeg') {
    if (!JPEG.has(ext)) throw new InstagramFehler(`Instagram akzeptiert nur JPEG-Bilder (.jpg): ${basename(datei)}`);
    const kopf = (await readFile(datei)).subarray(0, 3);
    if (!(kopf[0] === 0xff && kopf[1] === 0xd8 && kopf[2] === 0xff)) {
      throw new InstagramFehler(`${basename(datei)} ist kein echtes JPEG (Dateikopf falsch).`);
    }
  } else {
    if (!VIDEO.has(ext)) throw new InstagramFehler(`Videos müssen MP4 oder MOV sein: ${basename(datei)}`);
    if (s.size > maxBytes) throw new InstagramFehler(`${basename(datei)} ist zu groß (${Math.round(s.size / 1048576)} MB, erlaubt ${Math.round(maxBytes / 1048576)} MB).`);
  }
  return ext;
}

function pruefeCaption(caption) {
  if (caption == null) return '';
  if (typeof caption !== 'string') throw new InstagramFehler('caption muss ein Text sein.');
  if (caption.length > MAX_CAPTION) throw new InstagramFehler(`Caption zu lang (${caption.length} von ${MAX_CAPTION} Zeichen).`);
  const tags = (caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
  if (tags > MAX_HASHTAGS) throw new InstagramFehler(`Zu viele Hashtags (${tags}, Instagram erlaubt ${MAX_HASHTAGS}).`);
  return caption;
}

function pruefeUmgebung(ctx) {
  if (ctx.trocken) return;
  const fehlt = ['IG_USER_ID', 'MEDIA_REPO', 'MEDIA_TOKEN'].filter((k) => !ctx.env[k]);
  if (fehlt.length) throw new InstagramFehler(`Umgebungsvariable(n) fehlen: ${fehlt.join(', ')}.`);
  if (!/^[\w.-]+\/[\w.-]+$/.test(ctx.env.MEDIA_REPO)) {
    throw new InstagramFehler('MEDIA_REPO muss die Form "besitzer/repo" haben.');
  }
  ctx.geheim.add(ctx.env.MEDIA_TOKEN);
}

const abs = (ctx, d) => resolve(ctx.basis, d);

// ---------------------------------------------------------------- Container, Polling, Limit

async function warteFertig(ctx, api, id, was) {
  const start = Date.now();
  for (;;) {
    const d = await api.get(id, { fields: 'status_code' }, `Status abfragen (${was})`);
    const s = d?.status_code;
    if (s === 'FINISHED' || s === 'PUBLISHED') return;
    if (s === 'ERROR') throw new InstagramFehler(`Instagram konnte ${was} nicht verarbeiten (status_code ERROR). Bei Videos: Format, Länge und Codec prüfen.`);
    if (s === 'EXPIRED') throw new InstagramFehler(`Der Container für ${was} ist abgelaufen (24 h).`);
    if (Date.now() - start > ctx.pollTimeoutMs) {
      throw new InstagramFehler(`Zeitüberschreitung: ${was} wurde von Instagram nicht rechtzeitig fertig verarbeitet (zuletzt ${s ?? 'unbekannt'}).`);
    }
    await schlaf(ctx.pollMs);
  }
}

async function pruefeLimit(ctx, api) {
  let d;
  try {
    d = await api.get(`${api.uid}/content_publishing_limit`, { fields: 'quota_usage,config' }, 'Publishing-Limit prüfen');
  } catch (e) {
    if ([190, 10, 200].includes(e.code)) throw e; // Token oder Rechte defekt: nicht erst Bilder hochladen
    ctx.log(`Publishing-Limit konnte nicht geprüft werden: ${e.message}`);
    return; // Instagram erzwingt das Limit ohnehin serverseitig
  }
  const z = d?.data?.[0];
  if (!z || typeof z.quota_usage !== 'number') return;
  const gesamt = z.config?.quota_total ?? 50; // vorsichtiger Wert, falls config fehlt
  if (z.quota_usage >= gesamt) {
    throw new InstagramFehler(`Publishing-Limit erreicht (${z.quota_usage} von ${gesamt} in 24 h). Es wird nichts veröffentlicht.`);
  }
}

/**
 * Gemeinsamer Ablauf: Prüfen -> Limit -> Hochladen -> bauer() legt Container an -> media_publish ->
 * permalink -> Aufräumen (immer, auch bei Fehlern).
 */
async function lauf(opts, { dateien, bauer }) {
  const ctx = kontext(opts);
  pruefeUmgebung(ctx);
  if (!ctx.trocken && existsSync(join(ctx.basis, 'PAUSE'))) {
    throw new InstagramFehler('Datei PAUSE vorhanden: es wird nichts veröffentlicht.');
  }
  const api = ctx.trocken ? apiTrocken(ctx) : apiEcht(ctx);
  let ergebnis;
  let hauptFehler = null;
  let phase = 'vorher';
  try {
    await pruefeLimit(ctx, api);
    const ordner = `tmp/${Date.now()}-${randomBytes(3).toString('hex')}`;
    const urls = [];
    for (let i = 0; i < dateien.length; i++) urls.push(await api.hochladen(dateien[i], ordner, i + 1));
    const containerId = await bauer(ctx, api, urls);
    // Ein 5xx bei media_publish wird nicht wiederholt: der Beitrag könnte schon live sein.
    phase = 'publish';
    const pub = await api.post(`${api.uid}/media_publish`, { creation_id: containerId }, 'Veröffentlichen', 'nur-429');
    const id = pub?.id;
    if (!id) throw new InstagramFehler('Instagram hat nach media_publish keine Beitrags-ID geliefert. Der Beitrag könnte live sein.');
    phase = 'nachher';
    let permalink = null;
    try {
      permalink = (await api.get(id, { fields: 'permalink' }, 'Permalink abfragen'))?.permalink ?? null;
    } catch (e) {
      ctx.log(`Permalink nicht abrufbar: ${e.message}`);
    }
    ergebnis = { id, permalink };
  } catch (e) {
    hauptFehler = e;
    // Fehler beim Veröffentlichen ohne eindeutige Ablehnung (kein HTTP 4xx): Beitrag könnte live sein, nie automatisch wiederholen
    if (phase === 'publish' && !(e.status >= 400 && e.status < 500)) hauptFehler.unklar = true;
  }
  const aufraeumFehler = await api.aufraeumen();
  if (aufraeumFehler.length) ctx.log(`Aufräumen unvollständig: ${aufraeumFehler.join('; ')}`);
  if (hauptFehler) {
    if (aufraeumFehler.length) hauptFehler.aufraeumFehler = aufraeumFehler;
    throw hauptFehler;
  }
  if (aufraeumFehler.length) ergebnis.aufraeumFehler = aufraeumFehler;
  if (ctx.trocken) {
    return { trocken: true, id: null, permalink: null, geplant: api.geplant };
  }
  return ergebnis;
}

// ---------------------------------------------------------------- Veröffentlichen

export async function veroeffentlicheBild({ datei, caption } = {}, opts = {}) {
  if (!datei) throw new InstagramFehler('veroeffentlicheBild: datei fehlt.');
  const ctx0 = kontext(opts);
  const pfad = abs(ctx0, datei);
  await pruefeDatei(pfad, { art: 'jpeg' });
  const text = pruefeCaption(caption);
  return lauf(opts, {
    dateien: [pfad],
    bauer: async (ctx, api, [url]) => {
      const c = await api.post(`${api.uid}/media`, { image_url: url, ...(text ? { caption: text } : {}) }, 'Bild-Container anlegen');
      await warteFertig(ctx, api, c.id, 'das Bild');
      return c.id;
    },
  });
}

export async function veroeffentlicheKarussell({ dateien, caption } = {}, opts = {}) {
  if (!Array.isArray(dateien) || dateien.length < 2 || dateien.length > 10) {
    throw new InstagramFehler('Ein Karussell braucht 2 bis 10 Bilder.');
  }
  const ctx0 = kontext(opts);
  const pfade = dateien.map((d) => abs(ctx0, d));
  for (const p of pfade) await pruefeDatei(p, { art: 'jpeg' });
  const text = pruefeCaption(caption);
  return lauf(opts, {
    dateien: pfade,
    bauer: async (ctx, api, urls) => {
      const kinder = [];
      for (let i = 0; i < urls.length; i++) {
        const k = await api.post(`${api.uid}/media`, { image_url: urls[i], is_carousel_item: 'true' }, `Karussell-Bild ${i + 1} anlegen`);
        kinder.push(k.id);
      }
      for (let i = 0; i < kinder.length; i++) await warteFertig(ctx, api, kinder[i], `Karussell-Bild ${i + 1}`);
      const eltern = await api.post(
        `${api.uid}/media`,
        { media_type: 'CAROUSEL', children: kinder.join(','), ...(text ? { caption: text } : {}) },
        'Karussell-Container anlegen',
      );
      await warteFertig(ctx, api, eltern.id, 'das Karussell');
      return eltern.id;
    },
  });
}

export async function veroeffentlicheStory({ datei } = {}, opts = {}) {
  if (!datei) throw new InstagramFehler('veroeffentlicheStory: datei fehlt.');
  const ctx0 = kontext(opts);
  const pfad = abs(ctx0, datei);
  const istVideo = VIDEO.has(extname(pfad).toLowerCase());
  await pruefeDatei(pfad, { art: istVideo ? 'video' : 'jpeg', maxBytes: MAX_STORY_VIDEO_BYTES });
  return lauf(opts, {
    dateien: [pfad],
    bauer: async (ctx, api, [url]) => {
      const c = await api.post(
        `${api.uid}/media`,
        { media_type: 'STORIES', ...(istVideo ? { video_url: url } : { image_url: url }) },
        'Story-Container anlegen',
      );
      await warteFertig(ctx, api, c.id, 'die Story');
      return c.id;
    },
  });
}

export async function veroeffentlicheReel({ video, caption, cover, shareToFeed = true } = {}, opts = {}) {
  if (!video) throw new InstagramFehler('veroeffentlicheReel: video fehlt.');
  const ctx0 = kontext(opts);
  const vp = abs(ctx0, video);
  await pruefeDatei(vp, { art: 'video', maxBytes: MAX_REEL_BYTES });
  const dateien = [vp];
  if (cover) {
    const cp = abs(ctx0, cover);
    await pruefeDatei(cp, { art: 'jpeg' });
    dateien.push(cp);
  }
  const text = pruefeCaption(caption);
  return lauf(opts, {
    dateien,
    bauer: async (ctx, api, urls) => {
      const params = {
        media_type: 'REELS',
        video_url: urls[0],
        share_to_feed: shareToFeed ? 'true' : 'false',
        ...(text ? { caption: text } : {}),
        ...(urls[1] ? { cover_url: urls[1] } : {}),
      };
      const c = await api.post(`${api.uid}/media`, params, 'Reel-Container anlegen');
      await warteFertig(ctx, api, c.id, 'das Reel');
      return c.id;
    },
  });
}

// ---------------------------------------------------------------- Token erneuern

/**
 * Erneuert das Langzeit-Token (Instagram-Login) und speichert es AES-256-GCM-verschlüsselt in
 * data/ig-token.enc (Schlüssel: TOKEN_KEY). Gibt nie das Token zurück. Die Datei muss danach von
 * der Automatik dauerhaft abgelegt werden (Commit oder Cache), sonst gilt beim nächsten Lauf wieder
 * IG_ACCESS_TOKEN.
 */
export async function erneuereToken(opts = {}) {
  const ctx = kontext(opts);
  if (ctx.trocken) {
    return {
      trocken: true,
      geplant: [{ methode: 'GET', ziel: `${ctx.hosts.ig}/refresh_access_token`, parameter: { grant_type: 'ig_refresh_token', access_token: '<TOKEN>' } }],
    };
  }
  if (!ctx.env.TOKEN_KEY) {
    throw new InstagramFehler('TOKEN_KEY ist nicht gesetzt: das erneuerte Token könnte nicht sicher gespeichert werden. Es wird nichts erneuert.');
  }
  ctx.geheim.add(ctx.env.TOKEN_KEY);
  const alt = await ladeToken(ctx);
  const u = new URL(`${ctx.hosts.ig}/refresh_access_token`);
  u.searchParams.set('grant_type', 'ig_refresh_token');
  u.searchParams.set('access_token', alt);
  const r = await sende(ctx, { url: u.toString(), was: 'Token erneuern' });
  const neu = r.daten?.access_token;
  if (!neu || typeof neu !== 'string') throw new InstagramFehler('Token-Erneuerung: Instagram hat kein neues Token geliefert.');
  ctx.geheim.add(neu);
  const jetzt = new Date();
  const expires = Number(r.daten.expires_in) || null;
  const ablaufAm = expires ? new Date(jetzt.getTime() + expires * 1000).toISOString() : null;
  const envFingerprint = ctx._datei?.envFingerprint ?? fingerabdruck(ctx.env.IG_ACCESS_TOKEN);
  const blob = verschluessele({ token: neu, envFingerprint, erneuertAm: jetzt.toISOString(), ablaufAm }, ctx.env.TOKEN_KEY);
  await mkdir(dirname(ctx.tokenDatei), { recursive: true });
  const tmp = `${ctx.tokenDatei}.${process.pid}.tmp`;
  await writeFile(tmp, blob + '\n', { encoding: 'utf8', mode: 0o600 });
  await rename(tmp, ctx.tokenDatei);
  return { erneuertAm: jetzt.toISOString(), ablaufAm, datei: ctx.tokenDatei };
}

// ---------------------------------------------------------------- Insights und Medienliste

// Metriknamen laut Insights-Referenz. impressions/plays sind abgeschafft (views ersetzt sie).
// Für den Optimierer zählen follows, profile_visits, shares, saved und reach. Liefert die API eine Metrik für einen
// Medientyp nicht (z. B. follows bei Reels je nach API-Stand), wird sie unten einzeln abgefragt und als nicht verfügbar vermerkt.
export const METRIKEN = {
  feed: ['reach', 'likes', 'comments', 'saved', 'shares', 'views', 'total_interactions', 'follows', 'profile_visits'],
  reel: ['reach', 'likes', 'comments', 'saved', 'shares', 'views', 'total_interactions', 'follows', 'profile_visits', 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time'],
  story: ['reach', 'views', 'shares', 'replies', 'total_interactions', 'follows', 'profile_visits'],
};

function wert(m) {
  if (m?.total_value && m.total_value.value !== undefined) return m.total_value.value;
  return m?.values?.[0]?.value ?? null;
}

/**
 * Insights eines Beitrags. opts.typ ('feed'|'reel'|'story') spart die Typabfrage.
 * Liefert { typ, werte: {metrik: zahl}, nichtVerfuegbar: [metrik] }.
 */
export async function insights(mediaId, opts = {}) {
  const ctx = kontext(opts);
  if (!mediaId) throw new InstagramFehler('insights: mediaId fehlt.');
  const api = apiEcht(ctx);
  let typ = opts.typ;
  if (!typ) {
    const m = await api.get(mediaId, { fields: 'media_product_type' }, 'Medientyp abfragen');
    typ = m?.media_product_type === 'REELS' ? 'reel' : m?.media_product_type === 'STORY' ? 'story' : 'feed';
  }
  const liste = METRIKEN[typ];
  if (!liste) throw new InstagramFehler(`insights: unbekannter Typ "${typ}" (feed, reel oder story).`);
  const werte = {};
  const nichtVerfuegbar = [];
  const lies = (d) => {
    for (const m of d?.data ?? []) werte[m.name] = wert(m);
  };
  try {
    lies(await api.get(`${mediaId}/insights`, { metric: liste.join(',') }, 'Insights abfragen'));
  } catch (e) {
    if (e.status !== 400) throw e;
    // Eine nicht unterstützte Metrik lässt die ganze Anfrage scheitern: einzeln nachfragen.
    for (const metrik of liste) {
      try {
        lies(await api.get(`${mediaId}/insights`, { metric: metrik }, `Insights ${metrik}`));
      } catch (e2) {
        if (e2.status !== 400) throw e2;
        nichtVerfuegbar.push(metrik);
      }
    }
  }
  return { typ, werte, nichtVerfuegbar };
}

/** Letzte Beiträge (neueste zuerst), folgt der Seitennummerierung bis limit. */
export async function mediaListe(limit = 25, opts = {}) {
  const ctx = kontext(opts);
  if (!ctx.env.IG_USER_ID) throw new InstagramFehler('IG_USER_ID ist nicht gesetzt.');
  const api = apiEcht(ctx);
  const felder = 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count';
  const ergebnis = [];
  let d = await api.get(`${api.uid}/media`, { fields: felder, limit: Math.min(Math.max(limit, 1), 100) }, 'Medienliste abrufen');
  for (;;) {
    ergebnis.push(...(d?.data ?? []));
    const next = d?.paging?.next;
    if (ergebnis.length >= limit || !next || !next.startsWith(ctx.hosts.ig)) break;
    d = (await sende(ctx, { url: next, was: 'Medienliste (weitere Seite)' })).daten;
  }
  return ergebnis.slice(0, limit);
}

/** Kontodaten: Follower, Gefolgte, Beitragszahl. */
export async function kontoInfo(opts = {}) {
  const ctx = kontext(opts);
  if (!ctx.env.IG_USER_ID) throw new InstagramFehler('IG_USER_ID ist nicht gesetzt.');
  const api = apiEcht(ctx);
  return api.get(api.uid, { fields: 'username,followers_count,follows_count,media_count' }, 'Kontodaten abrufen');
}
