// Gemeinsame Zählung für Puffer, Nachproduktion und Bericht. Es zählen nur Beiträge, die in den nächsten 14 Tagen
// wirklich veröffentlicht werden dürfen („Frühestens“ ist erreicht oder liegt höchstens 14 Tage voraus), und nur Feed-Typen,
// die laut params.json aktiv sind.
export const TAGE_VORAUS = 14
export const QA_GUELTIG_TAGE = 21
import { istReparierbar, istAufzugeben } from './reparatur-historie.mjs'
const iso = (d) => d.toISOString().slice(0, 10)

// Aufgegebene Beiträge (Status „aufgegeben“) zählen nie zum Puffer und nie als Vorrat; abgelehnte, die noch repariert werden
// können, stehen unter `reparierbar` (fill.mjs und puffer.mjs behandeln sie als offene Arbeit). `historie` ist
// data/reparaturen.json (ladeHistorie), ohne sie gilt nur das Queue-Feld `reparaturen`.
export function zaehlePuffer(q, params, jetzt = new Date(), historie = []) {
  const horizont = iso(new Date(jetzt.getTime() + TAGE_VORAUS * 864e5))
  const nutzbar = (x) => !x.fruehestens || x.fruehestens <= horizont
  const feedTyp = (x) => x.typ === 'karussell' || (params.reels_aktiv && x.typ === 'reel')
  return {
    feed: q.filter((x) => x.status === 'geprueft' && feedTyp(x) && nutzbar(x)).length,
    feedGesamt: q.filter((x) => x.status === 'geprueft' && feedTyp(x)).length,
    stories: q.filter((x) => x.status === 'geprueft' && x.typ === 'story' && nutzbar(x)).length,
    neu: q.filter((x) => x.status === 'neu').length,
    reparierbar: q.filter((x) => istReparierbar(x, historie)).length,
    aufzugeben: q.filter((x) => istAufzugeben(x, historie)).length,
    aufgegeben: q.filter((x) => x.status === 'aufgegeben').length,
  }
}

/** Freigaben, die älter als 21 Tage sind und bald dran kämen (Angebote, Termine können sich geändert haben): zurück auf „neu“. */
export function verjaehrte(q, jetzt = new Date()) {
  const grenze = jetzt.getTime() - QA_GUELTIG_TAGE * 864e5
  const bald = iso(new Date(jetzt.getTime() + 7 * 864e5))
  return q.filter((x) => x.status === 'geprueft' && x.qa?.am && new Date(x.qa.am).getTime() < grenze && (!x.fruehestens || x.fruehestens <= bald))
}
