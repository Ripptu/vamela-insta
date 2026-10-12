import test from 'node:test'
import assert from 'node:assert/strict'
import { pruefeStruktur } from '../karussell-regeln.mjs'

const seite = (n, role, text) => ({ n, role, text })
const gut = () => ({
  angebot: 'keins',
  pages: [
    { n: 1, role: 'cover', head: 'Dein Kontaktformular kann seit Monaten kaputt sein.', sub: '' },
    seite(2, 'text', 'Formulare fallen still aus. Für Besucher sieht alles normal aus.'),
    seite(3, 'text', 'Schick dir heute selbst eine Anfrage über dein Formular.'),
    seite(4, 'text', 'Schau auch im Spam-Ordner nach. Teste im privaten Fenster.'),
    seite(5, 'quote', '„Ein Formular, das niemand testet, ist ein Formular, das niemand liest.“'),
    seite(6, 'close', 'Speichere dir den Beitrag und teste einmal im Monat.'),
  ],
})
test('gültiges Karussell', () => assert.deepEqual(pruefeStruktur(gut()), []))
test('zu viele Seiten und langer Hook', () => {
  const p = gut(); p.pages.push(seite(7, 'close', 'Speichern.')); p.pages[0].head = 'Das ist ein sehr langer Hook mit viel zu vielen Wörtern für eine Titelseite'
  const f = pruefeStruktur(p)
  assert.ok(f.some((x) => /7 statt 6/.test(x)))
  assert.ok(f.some((x) => /Hook hat/.test(x)))
})
test('Textwüste und Satzzahl', () => {
  const p = gut(); p.pages[1].text = 'Eins. Zwei. Drei sind zu viel für eine Seite, denn ein Kerngedanke pro Seite ist die Regel.'
  assert.ok(pruefeStruktur(p).some((x) => /mehr als zwei Sätze/.test(x)))
})
test('Preise und Adressen zählen nicht als Satzende', () => {
  const p = gut(); p.pages[1].text = 'Eine Seite mit allem Wichtigen gibt es ab 490 € einmalig. Mehr auf vamela.de/leistungen.'
  assert.deepEqual(pruefeStruktur(p), [])
  p.pages[2].text = 'Einmalig 1.490 € statt Abo. Rechne beides durch.'
  assert.deepEqual(pruefeStruktur(p), [])
})
test('CTA: Werkzeug braucht Link in der Bio, ohne Angebot nicht', () => {
  const a = gut(); a.angebot = 'Werkzeug'
  assert.ok(pruefeStruktur(a).some((x) => /ohne „Link in der Bio“/.test(x)))
  const b = gut(); b.pages[5].text = 'Mehr dazu: Link in der Bio.'
  assert.ok(pruefeStruktur(b).some((x) => /ohne Angebot/.test(x)))
})
test('KI-Floskeln: Deko-Nummerierung und Emoji auf Seiten', () => {
  const a = gut(); a.pages[2].text = '01 Schick dir heute selbst eine Anfrage.'
  assert.ok(pruefeStruktur(a).some((x) => /Deko-Nummerierung/.test(x)))
  const b = gut(); b.pages[0].head = 'Kontaktformular kaputt? 😱'
  assert.ok(pruefeStruktur(b).some((x) => /Emoji/.test(x)))
})
test('Vorher-nachher-Seite darf länger sein und mehr Sätze haben', () => {
  const p = gut(); p.pages[3].text = 'Vorher: Öffnungszeiten als Bild. Google kann sie nicht lesen. Nachher: Öffnungszeiten als Text. Google zeigt sie direkt an.'
  assert.deepEqual(pruefeStruktur(p), [])
})
