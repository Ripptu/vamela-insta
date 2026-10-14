// Plan für die TikTok-Cover im Poster-Stil (render/tiktok-poster.mjs): je Karussell Handschrift-Zeile, große Überschrift
// (2 bis 3 Zeilen, jede wird auf volle Breite gezogen), optional gelbe Pille, dazu eine Bildidee mit Abwechslung:
// Tier, Brille, Accessoire und Ausdruck rotieren so, dass sich nichts direkt wiederholt (Christian, 13.10.2026).
// Aufruf: node automatik/tiktok-cover-plan.mjs   → schreibt plan/tiktok-cover.json (vorhandene Einträge bleiben)
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const ZIEL = path.join(ROOT, 'plan/tiktok-cover.json')

// [Handschrift, Zeilen, Pille]
export const TEXTE = {
  k14: ['Kein Kabel, keine Cloud', ['Fotos aufs', 'Laptop?', 'So geht’s'], ''],
  k02: ['Heute gratis …', ['Nach dem Abo', 'tot!'], 'Dein QR-Code'],
  k03: ['Ernsthaft?', ['Vier Schriften', 'auf einem', 'Flyer?'], ''],
  k04: ['Welche hast du?', ['Falsche', 'Kategorie'], 'Google-Profil'],
  k05: ['Wohin damit?', ['Drei Orte', 'für mehr', 'Sterne'], ''],
  k06: ['Passt schon?', ['QR-Code', 'in der Ecke'], 'Nö.'],
  k09: ['Briefkopf top …', ['Profilbild', 'Flop!'], ''],
  k10: ['Welche stimmt?', ['Drei', 'Nummern'], 'Aufräumen'],
  k12: ['Bitte nicht …', ['Bildschirm-', 'farben', 'drucken?'], ''],
  k13: ['Gratis-App', ['Pixelfoto', 'wird groß'], ''],
  k15: ['Wartungsvertrag?', ['Frag', 'deine', 'PDFs!'], ''],
  k16: ['Kennst du Penpot?', ['Websites', 'gratis', 'entwerfen'], ''],
  k17: ['Feiertag …', ['Und Google', 'sagt', 'geöffnet?'], ''],
  k18: ['Für die Autofolie?', ['Dein JPG ist', 'wertlos'], ''],
  k19: ['Online heißt …', ['Fertig?', 'Leider', 'nein'], ''],
  k20: ['Am Handy scharf …', ['Auf dem', 'Banner', 'Pixel'], ''],
  k21: ['Hand aufs Herz:', ['Was machst', 'du', 'eigentlich?'], 'Deine Startseite'],
  k22: ['Kannst du das lesen?', ['Hellgrau', 'ist', 'unsichtbar'], ''],
  k23: ['Schluss mit Floskeln', ['Beschreib', 'dich', 'richtig'], 'Google-Profil'],
  k25: ['Am Tresen nett …', ['Online', 'stumm?'], 'Bewertungen'],
  k27: ['Heute noch!', ['Drei Fotos', 'für Google'], ''],
  k28: ['Mehr Farben?', ['Mehr', 'Chaos!'], ''],
  k29: ['Muss rein:', ['Drei', 'Fragen'], 'Leistungsseite'],
  k26: ['Logo im QR-Code?', ['Kann ihn', 'killen'], ''],
  k30: ['Alles mittig?', ['Sieht', 'selten gut', 'aus'], ''],
  k24: ['Fürs Schaufenster', ['Logo als', 'Folie'], ''],
  k31: ['Klick mich!', ['Absenden', 'ist', 'langweilig'], ''],
  k32: ['Ein Scan genügt', ['Ab ins', 'Handy'], 'Deine Kontaktdaten'],
  k34: ['Nur für Große?', ['GiroCode', 'für alle'], ''],
  k35: ['Laden … laden …', ['Dein Bild', 'ist zu', 'fett'], ''],
  k36: ['Zeilenlänge?', ['Zu breit', 'liest', 'keiner'], ''],
  k37: ['Im Ort bekannt …', ['Im Netz', 'unsichtbar'], ''],
  k38: ['Gäste lieben das', ['Speise-', 'karte', 'aufs Handy'], ''],
  k39: ['IMG_4821.jpg?', ['Google', 'versteht', 'nix'], ''],
  k41: ['Ups …', ['Domain', 'weg?'], ''],
  k42: ['Mehr Luft!', ['Dein', 'Layout', 'erstickt'], ''],
  k43: ['Auf der Baustelle fix …', ['Bei Anfragen', 'lahm?'], ''],
  k45: ['Drei Handgriffe', ['Der', 'Handy-', 'Test'], ''],
  k46: ['Für den Druck?', ['Reicht', 'dein', 'Foto?'], ''],
  k47: ['Auftritt top …', ['Und dann', 'die Mail', 'Adresse'], ''],
  k48: ['Druckerei will:', ['300', 'dpi'], 'So geht’s'],
  k44: ['Im Vorbeigehen', ['Aushang,', 'den man', 'liest'], ''],
  k49: ['Ruf an! Aber wann?', ['Keiner', 'weiß es'], 'Deine Zeiten'],
  k50: ['Mehr braucht’s nicht', ['Drei', 'Text-', 'größen'], ''],
  k51: ['Achtung!', ['Dein', 'Browser', 'warnt'], 'Deine Website'],
  k52: ['Ohne Raten', ['Foto rein,', 'Farbcode', 'raus'], ''],
  k53: ['Im Dorf ein Star …', ['Bei Google', 'ein', 'Niemand'], ''],
  k54: ['Wann brauchst du die?', ['RAL-', 'Farbe'], 'Drei Fälle'],
  k55: ['Google sieht nix', ['Angebot', 'nur als', 'Bild?'], ''],
  k56: ['Alles fett?', ['Dann ist', 'nichts', 'wichtig'], ''],
  k57: ['Website reicht?', ['Google-', 'Profil', 'fehlt!'], ''],
  k58: ['Bitte nicht …', ['Text', 'aufs', 'Foto'], ''],
  k60: ['Aus der Werkstatt', ['Deine', 'Farben', 'gratis'], ''],
  k61: ['Steht da noch 2019?', ['Alter', 'Seiten-', 'fuß'], ''],
  k59: ['Ehrlich jetzt:', ['Wie', 'schnell', 'antwortest du?'], ''],
  k62: ['Leuchtet am Bildschirm …', ['Im Druck', 'matsch'], ''],
  k63: ['Wo bist du?', ['Dein Ort', 'fehlt'], 'Drei Stellen'],
  k64: ['Gleicher Text …', ['Einer', 'wird', 'gelesen'], 'Zeilenabstand'],
  k65: ['Zeig her!', ['Ohne Proben', 'nur', 'Gelaber'], ''],
  k66: ['Im Flyer ein Logo …', ['In der Mail', 'nichts?'], ''],
  k67: ['Preise verstecken?', ['Kostet', 'dich', 'Kunden'], ''],
  k69: ['Zehn Felder?!', ['Drei', 'reichen'], 'Dein Formular'],
  k70: ['Fällt mehr auf?', ['NUR', 'KURZ'], 'Großbuchstaben'],
  k71: ['Seitentitel „Startseite“?', ['Google', 'gähnt'], ''],
  k68: ['Ausdrucken, scannen …', ['Das war', 'gestern'], ''],
  k72: ['Wie klein geht’s?', ['Logo', 'im Mini-', 'Format'], ''],
  k73: ['Echte Werkstatt …', ['Fake-', 'Foto?'], 'Stockfoto'],
  k74: ['Ohne Programm?', ['Fotos', 'klein', 'machen'], 'Geht doch'],
  k75: ['Seite nicht gefunden?', ['Drei', 'Zeilen', 'retten'], '404'],
  k76: ['Kopf ab?', ['Foto', 'falsch', 'geschnitten'], ''],
  k77: ['Klick aufs Logo …', ['Führt', 'nirgends', 'hin?'], ''],
  k78: ['Passt das zusammen?', ['Drei', 'Foto-', 'regeln'], ''],
  k79: ['Zähl mal mit', ['Wie viele', 'Klicks', 'zum Anruf?'], ''],
  k80: ['Produkt glänzt …', ['Hintergrund', 'nervt'], ''],
  k81: ['Und jetzt?', ['Nach dem', 'Absenden'], 'Dein Formular'],
  k82: ['Leerer Tab?', ['Sieht aus', 'wie', 'Baustelle'], 'Favicon'],
  k83: ['Aus deiner Region', ['Drei', 'Links', 'für dich'], ''],
  k84: ['Edel?', ['Schnörkel', 'nervt'], ''],
  k85: ['Kunden googeln anders', ['Fach-', 'chinesisch', 'raus'], ''],
  k86: ['Speisekarte …', ['Preise', 'sauber', 'untereinander?'], ''],
  k87: ['Mehr Stichworte?', ['Hilft', 'nicht'], 'Firmenname'],
  k88: ['Laser vs. JPG', ['Was', 'passiert', 'da?'], ''],
  k89: ['Navi findet dich …', ['Den Eingang', 'keiner'], ''],
  k90: ['PNG reicht?', ['Nicht für', 'jedes', 'Logo'], ''],
  k91: ['Doppelt hält besser?', ['Nicht', 'bei Google'], ''],
  k92: ['Schwarz-weiß gedruckt?', ['Plötzlich', 'unlesbar'], ''],
  k94: ['Logo ganz groß?', ['Welche', 'Datei?'], ''],
  k95: ['Lebst du noch?', ['Profil', 'wirkt', 'verlassen'], 'Google'],
  k96: ['Abfotografiert?', ['Merkt', 'jede', 'Druckerei'], 'Dein Logo'],
  k93: ['Liest eh keiner?', ['Über uns', 'wirkt'], ''],
  k97: ['Zufrieden, aber still', ['Wo bleibt', 'die', 'Bewertung?'], ''],
  k99: ['Ehrlich wissen?', ['Woher', 'kommen', 'Kunden?'], ''],
  k100: ['Muss es zeigen?', ['Logo', 'muss', 'nicht'], 'Was du machst'],
  k98: ['Moderner?', ['Schlag-', 'schatten', 'nö'], ''],
  k113: ['Läuft nie ab', ['Dein Ort', 'als', 'Code'], ''],
  k111: ['Ein Portal …', ['Ein', 'Ziel'], 'Deine Website'],
  k112: ['Inventar voll?', ['Menü', 'auch!'], ''],
  k114: ['Fast jeder macht’s', ['Falsches', 'Titelbild'], 'Google-Profil'],
  k131: ['Drei Hebel', ['Google-', 'Rangliste'], ''],
  k132: ['Spiele haben sie …', ['Patch-', 'Notes'], 'Deine Website'],
  k115: ['Speedrun!', ['Website', 'an einem', 'Nachmittag'], ''],
}

const TIERE = ['hedgehog', 'parrot', 'donkey', 'chicken', 'dalmatian dog', 'pug', 'llama', 'goat', 'raccoon', 'red fox', 'koala', 'sloth', 'capybara', 'owl', 'flamingo', 'cat', 'french bulldog', 'pig', 'cow', 'sheep', 'alpaca', 'otter', 'squirrel', 'penguin', 'toucan', 'chameleon', 'frog', 'bulldog', 'corgi', 'golden retriever', 'hamster', 'rabbit', 'duck', 'goose', 'horse', 'zebra', 'giraffe', 'lemur', 'meerkat', 'seal']
const BRILLEN = ['futuristic metal sport sunglasses with iridescent mirrored rainbow lenses', 'oversized heart-shaped pink sunglasses', 'gold aviator sunglasses with mirrored lenses', 'round retro sunglasses with orange tinted lenses', 'neon green star-shaped party glasses', 'chunky white ski goggles with reflective lenses', 'tiny vintage round wire glasses', 'futuristic visor sunglasses with blue mirrored lens', 'retro red and blue 3D glasses', 'thick black nerd glasses', 'cat-eye sunglasses with rhinestones', 'mirrored purple shield sunglasses']
// Bildmodell für die Cover (Christian, 13.10.2026): Higgsfield gpt_image_2_5, Variante flare (Standard; Sunburst im Vergleich schlechter), 1k, medium, 9:16 (0,5 Credits).
// Nano Banana 2.1 kostet 1,5 Credits und ist damit teurer.
export const BILDMODELL = { model: 'gpt_image_2_5', variant: 'flare', resolution: '1k', quality: 'low', aspect_ratio: '9:16' }
const ACCESSOIRES = ['', 'a chunky gold chain', 'a backwards baseball cap', 'big over-ear headphones', 'a tiny bucket hat', 'a bright bandana', 'a small party hat', 'a knitted beanie', 'a bow tie', 'a tiny crown', 'a flower lei necklace', 'a construction hard hat', 'a snorkel', 'a scarf', 'a headband with sweatband', 'a tiny chef hat']
const AUSDRUCK = ['sticking its tongue out', 'with a smug grin', 'looking shocked with mouth wide open', 'winking', 'laughing wildly', 'with a skeptical look', 'blowing a kiss', 'looking super cool and unimpressed']

/** Bildprompt für ein Poster (9:16, vertikal). */
export function posterPrompt({ tier, brille, accessoire, ausdruck }) {
  return `Ultra sharp photorealistic close-up portrait of a funny ${tier} wearing ${brille}${accessoire ? ` and ${accessoire}` : ''}, ${ausdruck}, shot from a low angle with a wide-angle fisheye lens so the face looks big and comical, bright saturated blue sky with fluffy white clouds behind, vivid punchy colors, crisp fur and feather detail, subtle film grain, editorial poster photography, the animal fills the lower 65 percent of the frame, top 35 percent is open blue sky, no text, no letters, no logos, vertical 9:16`
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const alt = fs.existsSync(ZIEL) ? JSON.parse(fs.readFileSync(ZIEL, 'utf8')) : {}
  const plan = { ...alt }
  let i = Object.keys(alt).length
  for (const [id, [kicker, zeilen, pille]] of Object.entries(TEXTE)) {
    if (plan[id]?.bildidee) { plan[id] = { ...plan[id], kicker, zeilen, pille }; continue }
    // Rotation mit teilerfremden Schritten: Tier, Brille, Accessoire und Ausdruck wechseln unabhängig voneinander
    const bildidee = { tier: TIERE[(i * 7) % TIERE.length], brille: BRILLEN[(i * 5) % BRILLEN.length], accessoire: ACCESSOIRES[(i * 3) % ACCESSOIRES.length], ausdruck: AUSDRUCK[i % AUSDRUCK.length] }
    plan[id] = { kicker, zeilen, pille, pilleNach: 0, bildidee, prompt: posterPrompt(bildidee) }
    i++
  }
  fs.writeFileSync(ZIEL, JSON.stringify(plan, null, 1) + '\n')
  console.log(`${Object.keys(plan).length} Cover geplant in plan/tiktok-cover.json`)
}
