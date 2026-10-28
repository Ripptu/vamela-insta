// Feste Texte der Kaltakquise. Zweistufig (Stand 28.10.2026, Christian: „direkt ein, zwei Sachen reinschreiben“):
//  1. Kalt-DM: Gruß mit Betriebsname, die zwei stärksten gemessenen Befunde (ein Rechtsbefund als Tatsache + Hinweis,
//     ein Technikbefund), dann die Frage nach einem kostenlosen Entwurf. Reihenfolge der Befunde kommt aus pruefen.mjs.
//  2. Nach einem Ja: Handy-Screenshot + weitere Befunde, Christian baut den Entwurf (Vorschlag per Telegram, Christian sendet).
//  Nachfassen nach 5 Tagen ohne Antwort: eine kurze Ja-reicht-Frage, danach Schluss.
// Ton (Christian, 28.10.2026): warm, menschlich, hilfsbereit wie ein Nachbar, nie nach Verkaufen klingen; Druck nur durch die Befunde selbst.
// Bewusst Vorlagen statt freier KI-Texte: gleichbleibend kurz, nichts Erfundenes, gut messbar.

const kurz = (name) => String(name || '').replace(/\s+(GmbH|UG|e\.K\.|KG|OHG|GbR|AG)(\s.*)?$/i, '').trim()

export const kaltDm = (l) => {
  const b = (l.befunde || []).slice(0, 2)
  return `Servus ins Team von ${kurz(l.name)}! 👋

Ich bin Christian, Webdesigner aus Haag an der Amper. Ich hab mir eure Website angeschaut und wollte euch kurz auf ${b.length > 1 ? 'zwei Sachen' : 'eine Sache'} hinweisen, einfach damit ihr Bescheid wisst:

${b.map((x) => '• ' + x).join('\n')}

Keine Sorge, das geht vielen so und lässt sich gut beheben. Wenn ihr mögt, bastel ich euch kostenlos einen Entwurf, wie eure Seite aussehen könnte. Ihr müsst nichts zusagen und nichts kaufen, schaut ihn euch einfach in Ruhe an 🙂`
}

export const nachfassDm = (l) => `Servus nochmal 👋

Ich hoffe, ich nerv nicht! Ich wollte nur kurz fragen, ob meine Nachricht bei euch angekommen ist. Der kostenlose Entwurf für ${kurz(l.name)} steht noch, ganz ohne Haken. Ein kurzes Ja reicht, den Rest mach ich.

Liebe Grüße
Christian`

export const befundDm = (l) => {
  // Wer noch die alte Kalt-DM ohne Befunde bekam, kriegt hier die ersten beiden
  const schonGenannt = (l.befunde || []).length && String(l.dm || '').includes(l.befunde[0])
  const rest = (l.befunde || []).slice(schonGenannt ? 2 : 0, schonGenannt ? 4 : 2)
  return `Oh, das freut mich wirklich! 🙂

Im Bild seht ihr, wie eure Startseite gerade am Handy aussieht.${rest.length ? `
${schonGenannt ? 'Dazu ist mir noch aufgefallen' : 'Das ist mir aufgefallen'}:
${rest.map((x) => '• ' + x).join('\n')}` : ''}

Ich setz mich in den nächsten Tagen dran und schick euch dann einen Link. Schaut ihn euch ganz in Ruhe an, und wenn er euch nicht gefällt, ist das auch völlig okay.

Liebe Grüße
Christian`
}
