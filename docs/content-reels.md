# Sprech-Reels für @vamela.de

Stand: 12.10.2026. Sechs Konzepte, seit 12.10.2026 als Sprech-Reels (Christian: „Krass gut geschnittene Reels mit KI-Stimme, tiefe epische deutsche Stimme“): Die KI-Stimme „Sterling“ (Higgsfield `text2speech_v2`, ElevenLabs) spricht den Sprechtext, `render/reel.mjs` schneidet daraus ein Reel 1080 × 1920 mit 15 bis 25 Sekunden im Look „Orange“: harter Schnitt auf jeden Satz, dazwischen Bewegungswechsel, wortgenaue Untertitel, Hook groß in den ersten zwei Sekunden, Abschlusskarte am Ende. Kundenseiten nur, wenn sie als Referenz freigegeben sind (Schlossallee Haag, Bachmaier, Thomas Rott, siehe `data/fakten.json`). Fakten wie auf vamela.de, Stand 12.10.2026.

Format für den Parser (`render/inhalt.mjs`, `readReels`): Überschrift „## Reel N: Titel“, Metazeilen, dazu `- Sprechtext:` (35 bis 60 Wörter, Du-Form: Hook als erster Satz, ein konkreter Tipp mit Mehrwert, kurzer Schluss mit Speichern, Folgen oder „Link in der Bio“), Hook (Cover und großer Text in den ersten zwei Sekunden), **Szenen** (je Satz des Sprechtexts eine Zeile: `nacht: <englisches Motiv>` bzw. `tag: …` für ein KI-Bild, `aufnahme: https://vamela.de/…` für eine Bildschirmaufnahme der Seite in Handybreite, `bild: k20` für ein vorhandenes Bild aus `bilder/vorrat/`), die Ablauf-Tabelle „Zeit | Aufnahme | Text im Bild“ aus der Scroll-Reel-Zeit (nur noch Beschreibung), Caption, Hashtags. Neue Reels schreibt `automatik/neu-schreiben.mjs --typ reel` in `docs/content-reels-auto.md`.

---

## Reel 1: Logo-JPG wird Vektor
- Säule: werkzeuge
- Hook-Stil: vorher-nachher
- Angebot: Werkzeug
- Werkzeug: /vektorisieren
- URL: https://vamela.de/vektorisieren
- Ton: Stimme (Sterling)
- Mehrwert: Du kannst ein Logo-JPG im Browser in SVG, PDF, EPS oder DXF umwandeln, ohne Anmeldung.
- Motiv: a blurry cube of pixels melting into a crisp smooth vector shape on a dark desk, warm orange glow
- Familie: nacht
- Sprechtext: Dein Logo gibt es nur als unscharfes JPG? Schick der Werbetechnik nie ein Handyfoto, sondern eine Vektordatei. Leg das Bild ins Gratis-Werkzeug auf vamela.de. Es zeichnet dein Logo in den Originalfarben nach. Dann lädst du SVG, PDF, EPS oder DXF herunter, ohne Anmeldung. Link in der Bio, speicher dir das.

**Hook (Cover und erster Satz, wörtlich):** „Aus dem unscharfen Logo-JPG wird eine Vektordatei.“

**Szenen** (je Satz des Sprechtexts eine):
1. bild: k20
2. bild: k18
3. aufnahme: https://vamela.de/vektorisieren
4. bild: k11
5. nacht: a glowing orange smooth vector curve splitting into four floating blank file cards above a dark desk
6. bild: k26

**Ablauf:**
| Zeit | Aufnahme | Text im Bild |
|---|---|---|
| 0–3 s | Seitenanfang, ruhig stehen | „Aus dem unscharfen Logo-JPG wird eine Vektordatei.“ |
| 3–8 s | Beispiel „Logo“ antippen, Ergebnis erscheint | „Bild ablegen. Das Werkzeug zeichnet es nach.“ |
| 8–13 s | Ansicht „Vergleich“, Trennlinie langsam über das Bild ziehen | „Die Farben des Originals bleiben.“ |
| 13–18 s | zu den Download-Knöpfen scrollen | „SVG, PDF, EPS, DXF oder PNG.“ |
| 18–22 s | kurz stehen bleiben | „Gratis, ohne Anmeldung. Link in der Bio.“ |

**Caption:**
Aus dem unscharfen Logo-JPG wird eine Vektordatei.

Bild ablegen, Ergebnis prüfen, herunterladen: Das Werkzeug auf vamela.de zeichnet dein Bild automatisch nach und übernimmt die Farben des Originals. Danach nimmst du es als SVG für die Website, PDF für die Druckerei, EPS für ältere Programme oder DXF für Laser und Plotter mit. Das Bild verlässt dabei nie deinen Browser.

Zum Mitnehmen: Schick der Werbetechnik nie ein Handyfoto deines Logos, sondern eine Vektordatei.

Bild vektorisieren ist kostenlos und ohne Anmeldung. Link in der Bio.

Folge @vamela.de für Gratis-Werkzeuge, die kleine Betriebe wirklich brauchen.

Welches Logo würdest du als Erstes ausprobieren?

**Hashtags:** #logo #vektorgrafik #grafikdesign #werbetechnik #freising

---

## Reel 2: Ein Scan zur Bewertung
- Säule: werkzeuge
- Hook-Stil: frage
- Angebot: Werkzeug
- Werkzeug: /google-bewertung-qr-code
- URL: https://vamela.de/google-bewertung-qr-code
- Ton: Stimme (Sterling)
- Mehrwert: Du kannst aus deinem Google-Bewertungslink einen QR-Code mit druckfertigem Aufsteller machen.
- Motiv: a small acrylic stand with a square dotted pattern on a wooden counter and a curious cat sniffing it, orange background
- Familie: tag
- Sprechtext: Wie kommen Kunden mit einem Scan zu deiner Bewertung? Hol dir in deinem Google-Unternehmensprofil den Link unter Rezensionen erhalten. Füg ihn ins Gratis-Werkzeug auf vamela.de ein. Daraus wird ein QR-Code mit druckfertigem Aufsteller, Karte oder Aufkleber. Frag trotzdem persönlich nach, direkt nach der Arbeit. Link in der Bio, speicher dir das.

**Hook (Cover und erster Satz, wörtlich):** „Wie kommen Kunden mit einem Scan zu deiner Bewertung?“

**Szenen** (je Satz des Sprechtexts eine):
1. tag: a small acrylic stand with a square dotted pattern on a wooden counter and a curious cat sniffing it, orange background
2. bild: k07
3. aufnahme: https://vamela.de/google-bewertung-qr-code
4. bild: k05
5. tag: a friendly owl handing a small blank paper card across a wooden shop counter, bright orange wall
6. bild: k02

**Ablauf:**
| Zeit | Aufnahme | Text im Bild |
|---|---|---|
| 0–3 s | Seitenanfang, ruhig stehen | „Wie kommen Kunden mit einem Scan zu deiner Bewertung?“ |
| 3–9 s | Musterlink in das Feld „Bewertungslink“ tippen | „Link aus deinem Google-Profil einfügen.“ |
| 9–14 s | Druckvorlage „Aufsteller A6“ wählen | „Aufsteller, Karte oder Aufkleber wählen.“ |
| 14–19 s | zur Vorschau scrollen | „Der Code öffnet direkt das Bewertungsfenster.“ |
| 19–23 s | kurz stehen bleiben | „Gratis, ohne Abo. Link in der Bio.“ |

**Caption:**
Wie kommen Kunden mit einem Scan zu deiner Bewertung?

Den Link holst du dir in deinem Google-Unternehmensprofil unter „Rezensionen erhalten“. Das Werkzeug auf vamela.de macht daraus einen QR-Code und eine druckfertige Vorlage, als Aufsteller für die Theke, Karte für die Rechnung oder Aufkleber für die Tür.

Zum Mitnehmen: Frag trotzdem persönlich nach, direkt nach der abgeschlossenen Arbeit. Der Code macht nur den nächsten Schritt leicht.

Kostenlos, ohne Anmeldung und ohne Abo. Link in der Bio.

Folge @vamela.de für Gratis-Werkzeuge, die kleine Betriebe wirklich brauchen.

Wo würdest du den Aufsteller hinstellen?

**Hashtags:** #googlebewertungen #qrcode #gastronomie #handwerk #erding

---

## Reel 3: Werkzeuge ohne Anmeldung
- Säule: werkzeuge
- Hook-Stil: liste
- Angebot: Werkzeug
- Werkzeug: /werkzeuge
- URL: https://vamela.de/werkzeuge
- Ton: Stimme (Sterling)
- Mehrwert: Du weißt, welche Gratis-Werkzeuge auf vamela.de dir bei Bildern, Logos, QR-Codes und Druck helfen.
- Motiv: an open wooden toolbox on a workbench in a dark workshop, every tool glowing softly orange
- Familie: nacht
- Sprechtext: Diese Gratis-Werkzeuge brauchst du im Betrieb, ganz ohne Anmeldung. Bilder verkleinern, freistellen und zuschneiden. Logo vektorisieren und Farbcodes aus einem Foto holen. QR-Codes für WLAN, Bewertung und Überweisung, die nie ablaufen. Dazu DPI prüfen, E-Mail-Signatur und Unterschrift. Alles läuft im Browser, Link in der Bio.

**Hook (Cover und erster Satz, wörtlich):** „Gratis-Werkzeuge für deinen Betrieb, ohne Anmeldung.“

**Szenen** (je Satz des Sprechtexts eine):
1. nacht: an open wooden toolbox on a workbench in a dark workshop, every tool glowing softly orange
2. aufnahme: https://vamela.de/werkzeuge
3. bild: k20
4. bild: k08
5. nacht: a glowing orange fountain pen resting on a blank dark sheet of paper next to a small magnifier
6. bild: k16

**Ablauf:**
| Zeit | Aufnahme | Text im Bild |
|---|---|---|
| 0–3 s | Seitenanfang, ruhig stehen | „Gratis-Werkzeuge für deinen Betrieb, ohne Anmeldung.“ |
| 3–8 s | langsam zum Bereich „Bilder“ scrollen | „Bilder verkleinern, freistellen, zuschneiden.“ |
| 8–13 s | weiter zu „Logo und Grafik“ und „Farben“ | „Logo vektorisieren, Farbcode aus dem Bild.“ |
| 13–18 s | weiter zu „QR-Codes“ | „QR-Codes, die nie ablaufen.“ |
| 18–23 s | weiter zu „Druck und Büro“ | „DPI prüfen, E-Mail-Signatur, Unterschrift.“ |
| 23–26 s | kurz stehen bleiben | „Alles im Browser. Link in der Bio.“ |

**Caption:**
Gratis-Werkzeuge für deinen Betrieb, ohne Anmeldung und ohne Abo.

Auf vamela.de/werkzeuge liegt alles, was kleine Betriebe zwischendurch brauchen: Bilder verkleinern und freistellen, Logo vektorisieren, Farbcodes aus einem Foto bestimmen, QR-Codes für Link, WLAN, Bewertung und Überweisung, DPI prüfen für den Druck, E-Mail-Signatur und Unterschrift. Alles läuft in deinem Browser.

Zum Mitnehmen: Speicher dir die Übersicht, dann hast du sie, wenn die Druckerei nach einer anderen Datei fragt.

Link in der Bio.

Folge @vamela.de für Gratis-Werkzeuge, die kleine Betriebe wirklich brauchen.

Welches Werkzeug fehlt dir noch?

**Hashtags:** #kleinunternehmen #werkzeuge #qrcode #grafikdesign #landkreisfreising

---

## Reel 4: Kommen deine Anfragen an
- Säule: tipps
- Hook-Stil: provokation
- Angebot: Entwurf
- URL: https://vamela.de/projekt/schlossallee-haag/
- Ton: Stimme (Sterling)
- Mehrwert: Du kannst mit drei kurzen Tests prüfen, ob Anfragen über deine Website wirklich bei dir ankommen.
- Motiv: a carrier pigeon with a letter waiting in front of a closed garden gate, soft orange evening sky
- Familie: tag
- Sprechtext: Schöne Seite, aber kommen deine Anfragen überhaupt an? Beim Biergarten Schlossallee ging das alte Formular nicht, und von außen sah man das nicht. Schick dir heute selbst eine Anfrage über dein Formular. Schau danach auch im Spam-Ordner nach. Und tipp am Handy auf deine Nummer: Wählt sie direkt? Den ersten Entwurf baue ich dir gratis, Link in der Bio.

**Hook (Cover und erster Satz, wörtlich):** „Schöne Seite, aber kommen Anfragen an? So prüfst du es.“

**Szenen** (je Satz des Sprechtexts eine):
1. tag: a carrier pigeon with a letter waiting in front of a closed garden gate, soft orange evening sky
2. aufnahme: https://vamela.de/projekt/schlossallee-haag/
3. bild: k14
4. bild: k01
5. bild: k10
6. tag: a small wooden mailbox with an open lid and a fresh envelope inside, bright orange wall

**Ablauf:**
| Zeit | Aufnahme | Text im Bild |
|---|---|---|
| 0–3 s | Seitenanfang der Referenz, ruhig stehen | „Schöne Seite, aber kommen Anfragen an? So prüfst du es.“ |
| 3–8 s | langsam zu „Ausgangslage“ scrollen | „Beim Biergarten funktionierte das alte Kontaktformular nicht.“ |
| 8–13 s | weiter zu „Umsetzung“ | „Schick dir heute selbst eine Anfrage über dein Formular.“ |
| 13–18 s | weiter zu „Ergebnis“ | „Schau danach auch im Spam-Ordner nach.“ |
| 18–23 s | weiter nach unten | „Und tipp am Handy auf deine Nummer: Wählt sie direkt?“ |
| 23–27 s | kurz stehen bleiben | „Speicher dir den Test. Erster Entwurf gratis, Link in der Bio.“ |

**Caption:**
Schöne Seite, aber kommen Anfragen an? So prüfst du es.

Beim Traditionsbiergarten Schlossallee in Haag stammte die alte Seite vom Vorbesitzer, sie wurde nicht mehr gepflegt, und das Kontaktformular funktionierte nicht. Von außen sah man das nicht. Ich habe die Seite neu gebaut, mit funktionierendem Kontaktweg, Standl- und Speisenübersicht und Anfahrt.

Zum Mitnehmen, drei Tests für heute: Schick dir selbst eine Anfrage über dein Formular. Schau danach auch im Spam-Ordner nach. Und tipp am Handy auf deine Telefonnummer, ob sie direkt wählt.

Wenn du sehen willst, wie deine Seite aussehen könnte: Den ersten Entwurf baue ich dir kostenlos, gefällt er dir nicht, sagst du ab. Link in der Bio.

Folge @vamela.de für kurze Tipps, mit denen dein Betrieb im Netz besser gefunden wird.

Welchen der drei Tests machst du heute?

**Hashtags:** #webdesign #gastronomie #biergarten #freising #website

---

## Reel 5: Drei Handgriffe fürs Handwerk
- Säule: design
- Hook-Stil: kontrast
- Angebot: keins
- URL: https://vamela.de/bachmaier/
- Ton: Stimme (Sterling)
- Mehrwert: Du weißt, mit welchen drei Handgriffen eine Handwerker-Website klarer wirkt: Logo als Vektor, eine Seite je Leistung, oben ein Bild deiner Arbeit.
- Motiv: a garage door slowly opening to reveal warm orange light on a dark street, isometric low-poly style
- Familie: nacht
- Sprechtext: Vorher ein Pixel-Logo, jetzt klar: drei Handgriffe dafür. Zeig oben ein Bild von dem, was du machst, beim Torbauer ist es das Tor. Gib jeder Leistung eine eigene Seite. Und lass dein Logo als Vektor neu zeichnen, dann bleibt es überall scharf. Speicher dir die drei für deine Seite.

**Hook (Cover und erster Satz, wörtlich):** „Vorher ein Pixel-Logo, jetzt klar. Drei Handgriffe dafür.“

**Szenen** (je Satz des Sprechtexts eine):
1. nacht: a garage door slowly opening to reveal warm orange light on a dark street, isometric low-poly style
2. aufnahme: https://vamela.de/bachmaier/
3. bild: k04
4. bild: k18
5. bild: k16

**Ablauf:**
| Zeit | Aufnahme | Text im Bild |
|---|---|---|
| 0–3 s | Seitenanfang, Garagentor geschlossen | „Vorher ein Pixel-Logo, jetzt klar. Drei Handgriffe dafür.“ |
| 3–9 s | langsam scrollen, das Tor im Kopfbereich öffnet sich | „Oben ein Bild von dem, was du machst. Hier das Tor.“ |
| 9–15 s | weiter zu den Leistungen | „Jede Leistung bekommt eine eigene Seite.“ |
| 15–20 s | weiter zum Logo im Fuß | „Das Logo als Vektor neu zeichnen. Dann bleibt es überall scharf.“ |
| 20–24 s | kurz stehen bleiben | „Speicher dir die drei für deine Seite.“ |

**Caption:**
Vorher ein Pixel-Logo, jetzt klar. Drei Handgriffe dafür.

Bachmaier ist ein Garagentor-Fachbetrieb aus Zolling, seit 1998 im Landkreis Freising. Vorher gab es das Logo nur als kleines Pixelbild, und die Leistungen standen nicht einzeln da.

Zum Mitnehmen, drei Handgriffe für deine Seite: Zeig oben ein Bild von dem, was du machst, für einen Torbauer ist es das Tor. Gib jeder Leistung eine eigene Seite, hier Neubau, Renovierung, Reparatur, Antriebe und Gewerbetore. Und lass dein Logo als Vektor neu zeichnen, dann bleibt es auf Website, Fahrzeug und Schild scharf.

Folge @vamela.de für Gestaltungsregeln, die du ohne Grafikprogramm umsetzen kannst.

Welcher der drei fehlt deiner Seite noch?

**Hashtags:** #webdesign #handwerk #garagentor #landkreisfreising #grafikdesign

---

## Reel 6: Was auf die erste Seite gehört
- Säule: tipps
- Hook-Stil: mythos
- Angebot: keins
- URL: https://vamela.de/projekt/thomas-rott/
- Ton: Stimme (Sterling)
- Mehrwert: Du weißt, welche drei Dinge auf die erste Website eines kleinen Betriebs gehören: Leistungen einzeln, das Einsatzgebiet und ein schneller Kontaktweg.
- Motiv: a sturdy wooden signpost with three arrows on a green hill and a small rabbit sitting beneath it, orange and white
- Familie: tag
- Sprechtext: Allein lohnt sich keine Website? Doch, mit drei Dingen. Thomas Rott hat neu gegründet, ganz ohne digitale Präsenz. Schreib deine Leistungen einzeln auf, nicht als Bauchladen. Nenn die Orte, in denen du arbeitest. Und bau einen schnellen Kontaktweg ein, per Telefon, Formular oder Nachricht. Speicher dir die Liste für deinen Start.

**Hook (Cover und erster Satz, wörtlich):** „Allein lohnt keine Website? Doch, mit diesen drei Dingen.“

**Szenen** (je Satz des Sprechtexts eine):
1. tag: a sturdy wooden signpost with three arrows on a green hill and a small rabbit sitting beneath it, orange and white
2. bild: k29
3. aufnahme: https://vamela.de/projekt/thomas-rott/
4. bild: k30
5. bild: k21
6. bild: k25
7. bild: k19

**Ablauf:**
| Zeit | Aufnahme | Text im Bild |
|---|---|---|
| 0–3 s | Seitenanfang der Referenz, ruhig stehen | „Allein lohnt keine Website? Doch, mit diesen drei Dingen.“ |
| 3–9 s | langsam zu „Ausgangslage“ scrollen | „Neu gegründet, ohne jede digitale Präsenz.“ |
| 9–15 s | weiter zu „Umsetzung“ | „Deine Leistungen einzeln, nicht als Bauchladen.“ |
| 15–21 s | weiter zu „Auf der Seite“ | „Wo du arbeitest, mit Ortsnamen. Und ein schneller Kontaktweg.“ |
| 21–25 s | kurz stehen bleiben | „Speicher dir die Liste für deinen Start.“ |

**Caption:**
Allein lohnt keine Website? Doch, mit diesen drei Dingen.

Thomas Rott hat sein Gewerbe gegründet und musste sich ohne jede digitale Präsenz gegen etablierte Anbieter und anonyme Großfirmen behaupten. Sein erster Webauftritt bekam eine persönliche Positionierung mit klarem Leistungsprofil für Objektbetreuung, Gartenpflege und Fassadenreinigung, ausgerichtet auf den Raum Freising, Erding und Landshut, dazu eine Express-Anfrage per WhatsApp.

Zum Mitnehmen, drei Dinge für deine erste Seite: Schreib deine Leistungen einzeln auf, nicht als Bauchladen. Nenn die Orte, in denen du arbeitest. Und bau einen schnellen Kontaktweg ein, per Telefon, Formular oder Nachricht.

Folge @vamela.de für kurze Tipps, mit denen dein Betrieb im Netz besser gefunden wird.

Was würdest du als Erstes auf deine Seite schreiben?

**Hashtags:** #gruendung #webdesign #handwerk #freising #erding
