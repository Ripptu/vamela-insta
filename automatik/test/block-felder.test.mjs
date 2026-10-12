// Tests für die Zusatzfelder je Vorratsblock (automatik/block-felder.mjs): Mehrwert, Motiv, Familie, Repo-Zeilen.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { felderAusText, ergaenze, felderFuer, pruefeZusatz } from '../block-felder.mjs'

const GUT = { saeule: 'tipps', mehrwert: 'Du kannst in zwei Minuten prüfen, ob dein Kontaktformular Anfragen wirklich zustellt.', motiv: 'a paper airplane caught in a spider web in front of a mailbox, orange background', familie: 'tag' }
const FUND = { ...GUT, saeule: 'fundstuecke', repo: 'muster/werkzeug', lizenz: 'MIT', sterne: 'rund 12.000 (Stand 12.10.2026)' }

test('felderAusText und ergaenze: Zusatzfelder je Block, vorhandene Parser-Felder bleiben', () => {
  const md = '# Karussells\n\n## Karussell 3: A\n- Säule: tipps\n- Mehrwert: Du weißt was.\n- Motiv: a cat on a roof\n- Familie: Nacht\n\n| Seite |\n\n## Story 4: B\n- Repo: a/b\n'
  const f = felderAusText(md)
  assert.deepEqual(f.get('Karussell 3'), { mehrwert: 'Du weißt was.', motiv: 'a cat on a roof', familie: 'nacht' })
  assert.deepEqual(f.get('Story 4'), { repo: 'a/b' })
  const [x] = ergaenze([{ nr: 3, mehrwert: null, motiv: 'vom Parser' }], md, 'Karussell')
  assert.equal(x.mehrwert, 'Du weißt was.')
  assert.equal(x.motiv, 'vom Parser')
})

test('felderFuer: findet den Block über item.quelle, auch in der Auto-Datei', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'felder-'))
  fs.mkdirSync(path.join(root, 'docs'))
  fs.writeFileSync(path.join(root, 'docs/content-posts.md'), '## Karussell 1: A\n- Mehrwert: Du kannst eins.\n')
  fs.writeFileSync(path.join(root, 'docs/content-posts-auto.md'), '## Karussell 20: B\n- Mehrwert: Du kannst zwanzig.\n- Repo: a/b\n')
  assert.equal(felderFuer({ quelle: 'docs/content-posts.md#Karussell 1' }, { root }).mehrwert, 'Du kannst eins.')
  assert.equal(felderFuer({ quelle: 'docs/content-posts.md#Karussell 20' }, { root }).repo, 'a/b')
  assert.equal(felderFuer({ quelle: 'docs/content-posts.md#Karussell 99' }, { root }), null)
  assert.equal(felderFuer({ quelle: null }, { root }), null)
})

test('pruefeZusatz: gültige Blöcke bestehen', () => {
  assert.deepEqual(pruefeZusatz(GUT), [])
  assert.deepEqual(pruefeZusatz(FUND), [])
  assert.deepEqual(pruefeZusatz({ ...GUT, mehrwert: 'Du weißt, welche Gratis-Werkzeuge auf vamela.de dir beim Druck helfen, z. B. DPI prüfen.' }), [])
})

test('pruefeZusatz: Mehrwert fehlt, ist ein Spruch, kein Du-Satz, zu lang oder mehrere Sätze', () => {
  const f = (mehrwert) => pruefeZusatz({ ...GUT, mehrwert }).join(' | ')
  assert.match(f(''), /Mehrwert: …“ fehlt/)
  assert.match(f('Große Ideen brauchen Platz.'), /muss mit „Du kannst“/)
  assert.match(f('Du hast Inspiration für große Ideen in deinem Betrieb.'), /Spruch/)
  assert.match(f('Du kannst was.'), /Zeichen/)
  assert.match(f('Du kannst dein Formular testen. Du weißt dann, ob Anfragen ankommen.'), /genau ein Satz/)
})

test('pruefeZusatz: Motiv englisch, ohne Marken, Logos, Personen und Schrift; Familie nacht oder tag', () => {
  const f = (x) => pruefeZusatz({ ...GUT, ...x }).join(' | ')
  assert.match(f({ motiv: '' }), /Motiv: …“ fehlt/)
  assert.match(f({ motiv: 'ein Fuchs mit Lupe vor oranger Wand' }), /Englisch/)
  assert.match(f({ motiv: 'Minecraft Steve building a website with blocks' }), /Marke oder Figur „Minecraft“/)
  assert.match(f({ motiv: 'a laptop with the company logo glowing on a desk' }), /keine Logos/)
  assert.match(f({ motiv: 'a woman smiling at a laptop in an office' }), /Person/)
  assert.match(f({ motiv: 'a poster with the words free tools on a wall' }), /keine Schrift/)
  assert.deepEqual(pruefeZusatz({ ...GUT, motiv: 'a voxel-style workshop at night with glowing orange blocks', familie: 'nacht' }), [])
  assert.deepEqual(pruefeZusatz({ ...GUT, motiv: 'an apple on a wooden table next to an open window, orange and white' }), [])
  assert.match(f({ familie: 'abend' }), /Familie: nacht \| tag/)
})

test('pruefeZusatz: fundstuecke brauchen Repo, Lizenz und Sterne; Repo nur bei fundstuecke', () => {
  const f = (x) => pruefeZusatz({ ...FUND, ...x }).join(' | ')
  assert.match(f({ repo: '' }), /Repo: owner\/name/)
  assert.match(f({ lizenz: '' }), /Lizenz/)
  assert.match(f({ sterne: '12345' }), /Sterne: rund N/)
  assert.match(pruefeZusatz({ ...GUT, repo: 'a/b' }).join(), /nur bei Säule fundstuecke/)
})
