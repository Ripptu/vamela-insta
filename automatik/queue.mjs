// Queue-Verwaltung für plan/queue.json (Vertrag: docs/architektur.md).
// ladeQueue()        -> Array (legt plan/queue.json als leeres Array an, falls nicht vorhanden)
// speichereQueue(q)  -> schreibt atomar (temporäre Datei + rename)
// naechster(q, typ, jetzt) -> nächster veröffentlichbarer Eintrag oder null
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
export const QUEUE_PFAD = join(WURZEL, 'plan', 'queue.json');

export async function ladeQueue(pfad = QUEUE_PFAD) {
  let text;
  try {
    text = await readFile(pfad, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    await speichereQueue([], pfad);
    return [];
  }
  if (text.trim() === '') return [];
  let q;
  try {
    q = JSON.parse(text);
  } catch (e) {
    throw new Error(`Queue-Datei ${pfad} ist kein gültiges JSON: ${e.message}`);
  }
  if (!Array.isArray(q)) throw new Error(`Queue-Datei ${pfad} muss ein Array enthalten.`);
  return q;
}

export async function speichereQueue(q, pfad = QUEUE_PFAD) {
  if (!Array.isArray(q)) throw new Error('speichereQueue erwartet ein Array.');
  await mkdir(dirname(pfad), { recursive: true });
  const tmp = `${pfad}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(q, null, 2) + '\n', 'utf8');
  await rename(tmp, pfad);
}

function alsZeit(x) {
  const t = x instanceof Date ? x.getTime() : new Date(x).getTime();
  return Number.isNaN(t) ? null : t;
}

// Letzte veröffentlichte Säule desselben Typs (nach ig.am, sonst Array-Reihenfolge).
function letzteSaeule(q, typ) {
  let bester = null;
  let besteZeit = -Infinity;
  q.forEach((e, i) => {
    if (e.typ !== typ || e.status !== 'veroeffentlicht') return;
    const t = alsZeit(e.ig?.am) ?? i - 1e15; // ohne Zeitstempel: nur Reihenfolge
    if (t >= besteZeit) {
      besteZeit = t;
      bester = e;
    }
  });
  return bester ? bester.saeule ?? null : null;
}

/**
 * Nächster Eintrag: Status 'geprueft', passender Typ, 'fruehestens' (falls gesetzt) <= jetzt.
 * "Ältester" = erster in Array-Reihenfolge (die Queue wird chronologisch angehängt).
 * Säule: nicht dieselbe wie beim zuletzt veröffentlichten Eintrag desselben Typs,
 * solange eine Alternative da ist; gibt es keine, wird trotzdem der älteste genommen.
 */
export function naechster(q, typ, jetzt = new Date()) {
  const jetztMs = alsZeit(jetzt);
  if (jetztMs === null) throw new Error('naechster: ungültiger Zeitpunkt "jetzt".');
  const kandidaten = q.filter((e) => {
    if (e.status !== 'geprueft' || e.typ !== typ) return false;
    if (e.fruehestens) {
      const f = alsZeit(e.fruehestens);
      if (f === null || f > jetztMs) return false;
    }
    return true;
  });
  if (kandidaten.length === 0) return null;
  const zuletzt = letzteSaeule(q, typ);
  if (zuletzt !== null) {
    const anders = kandidaten.find((e) => e.saeule !== zuletzt);
    if (anders) return anders;
  }
  return kandidaten[0];
}
