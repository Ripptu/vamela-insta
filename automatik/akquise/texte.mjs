// Text nach einem Ja auf die Kalt-DM: Handy-Screenshot + weitere Befunde, Christian baut den Entwurf.
// Die Kalt-DM selbst schreibt seit 9.11.2026 Claude einzeln je Betrieb (schreiben.mjs); Nachfass-DMs gibt es nicht mehr.
// Ton (Christian, 28.10.2026): warm, menschlich, hilfsbereit wie ein Nachbar, nie nach Verkaufen klingen; Druck nur durch die Befunde selbst.

export const befundDm = (l) => {
  // Wer noch die alte Kalt-DM ohne Befunde bekam, kriegt hier die ersten beiden.
  // Die Einzel-DMs (mit dm_zitat) nennen höchstens die ersten beiden Befunde in eigenen Worten.
  const schonGenannt = (l.befunde || []).length && (l.dm_zitat || String(l.dm || '').includes(l.befunde[0]))
  const rest = (l.befunde || []).slice(schonGenannt ? 2 : 0, schonGenannt ? 4 : 2)
  return `Oh, das freut mich wirklich! 🙂

Im Bild seht ihr, wie eure Startseite gerade am Handy aussieht.${rest.length ? `
${schonGenannt ? 'Dazu ist mir noch aufgefallen' : 'Das ist mir aufgefallen'}:
${rest.map((x) => '• ' + x).join('\n')}` : ''}

Ich setz mich in den nächsten Tagen dran und schick euch dann einen Link. Schaut ihn euch ganz in Ruhe an, und wenn er euch nicht gefällt, ist das auch völlig okay.

Liebe Grüße
Christian`
}
