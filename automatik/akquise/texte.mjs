// Feste Texte der Kaltakquise (Christian, 25.10.2026, „zu 100 % optimiert“). Zweistufig:
//  1. Kalt-DM: Gruß mit Betriebsname, eine Neugier-Frage, kein Angebot, kein Link. Ziel ist nur eine Antwort.
//  2. Nach einer Antwort: Befunde + Handy-Screenshot + kostenloser Entwurf (Vorschlag per Telegram, Christian sendet).
//  Nachfassen nach 5 Tagen ohne Antwort: eine kurze Ja-reicht-Frage, danach Schluss.
// Bewusst Vorlagen statt freier KI-Texte: gleichbleibend kurz, nichts Erfundenes, gut messbar.

const kurz = (name) => String(name || '').replace(/\s+(GmbH|UG|e\.K\.|KG|OHG|GbR|AG)(\s.*)?$/i, '').trim()

/** Wo der wichtigste Befund wehtut, passend zur Neugier-Frage. */
function wirkung(befunde = []) {
  const b = befunde.join(' ')
  if (/Handy|antippbar|zoomen|Sekunden|MB/i.test(b)) return 'das euch am Handy wahrscheinlich Anfragen kostet'
  if (/Google/i.test(b)) return 'das euch bei Google wahrscheinlich Klicks kostet'
  if (/https|Nicht sicher/i.test(b)) return 'das Besucher gleich beim Öffnen abschrecken kann'
  return 'das euch wahrscheinlich Anfragen kostet'
}

export const kaltDm = (l) => `Servus ins Team von ${kurz(l.name)}! 👋

Christian hier, Webdesigner aus Haag an der Amper. Mir ist auf eurer Website etwas aufgefallen, ${wirkung(l.befunde)}.

Soll ich’s euch kurz schicken?`

export const nachfassDm = (l) => `Servus nochmal 👋

Kurz nachgehakt wegen ${kurz(l.name)}: Soll ich euch schicken, was mir auf eurer Website aufgefallen ist? Ein kurzes Ja reicht.

Viele Grüße
Christian`

export const befundDm = (l) => `Klar, gern! 🙂

Das ist mir auf eurer Website aufgefallen:
${(l.befunde || []).slice(0, 2).map((x) => '• ' + x).join('\n')}

Im Bild seht ihr, wie eure Startseite gerade am Handy aussieht.

Wenn ihr mögt, mach ich euch einen kostenlosen Entwurf, wie eure Startseite aussehen könnte. Unverbindlich, ihr schaut ihn euch einfach an. Soll ich loslegen?

Viele Grüße
Christian`
