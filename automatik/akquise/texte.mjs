// Feste Texte der Kaltakquise. Zweistufig (Stand 28.10.2026, Christian: „direkt ein, zwei Sachen reinschreiben“):
//  1. Kalt-DM: Gruß mit Betriebsname, die zwei stärksten gemessenen Befunde (ein Rechtsbefund als Tatsache + Hinweis,
//     ein Technikbefund), dann die Frage nach einem kostenlosen Entwurf. Reihenfolge der Befunde kommt aus pruefen.mjs.
//  2. Nach einem Ja: Handy-Screenshot + weitere Befunde, Christian baut den Entwurf (Vorschlag per Telegram, Christian sendet).
//  Nachfassen nach 5 Tagen ohne Antwort: eine kurze Ja-reicht-Frage, danach Schluss.
// Bewusst Vorlagen statt freier KI-Texte: gleichbleibend kurz, nichts Erfundenes, gut messbar.

const kurz = (name) => String(name || '').replace(/\s+(GmbH|UG|e\.K\.|KG|OHG|GbR|AG)(\s.*)?$/i, '').trim()

export const kaltDm = (l) => {
  const b = (l.befunde || []).slice(0, 2)
  return `Servus ins Team von ${kurz(l.name)}! 👋

Christian hier, Webdesigner aus Haag an der Amper. Ich hab mir eure Website angeschaut, ${b.length > 1 ? 'zwei Sachen sind' : 'eine Sache ist'} mir aufgefallen:

${b.map((x) => '• ' + x).join('\n')}

Soll ich euch kostenlos zeigen, wie eure Seite besser aussehen könnte? Ganz unverbindlich.`
}

export const nachfassDm = (l) => `Servus nochmal 👋

Kurz nachgehakt wegen ${kurz(l.name)}: Soll ich euch kostenlos einen Entwurf für eure Website machen? Ein kurzes Ja reicht.

Viele Grüße
Christian`

export const befundDm = (l) => {
  // Wer noch die alte Kalt-DM ohne Befunde bekam, kriegt hier die ersten beiden
  const schonGenannt = (l.befunde || []).length && String(l.dm || '').includes(l.befunde[0])
  const rest = (l.befunde || []).slice(schonGenannt ? 2 : 0, schonGenannt ? 4 : 2)
  return `Super, freut mich! 🙂

Im Bild seht ihr, wie eure Startseite gerade am Handy aussieht.${rest.length ? `
Dazu ist mir noch aufgefallen:
${rest.map((x) => '• ' + x).join('\n')}` : ''}

Ich mach mich an den Entwurf und schick euch in den nächsten Tagen einen Link, den ihr euch in Ruhe anschauen könnt.

Viele Grüße
Christian`
}
