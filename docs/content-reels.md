# Scroll-Reels für @vamela.de

Stand: 12.10.2026. Sechs Konzepte für automatisch aufgenommene Scroll-Videos von vamela.de: Ein Rekorder (Playwright mit Videoaufnahme, kommt nach der Entwurfswahl als `render/reel.mjs`) öffnet die Seite unter „URL“ im Handyformat 1080 × 1920, führt die Schritte aus der Spalte „Aufnahme“ aus (warten, langsam scrollen, ein Feld ausfüllen), und der Text aus „Text im Bild“ liegt groß darüber. Stumm, lizenzfreie Musik kommt vielleicht später. Kundenseiten nur, wenn sie als Referenz freigegeben sind (Schlossallee Haag, Bachmaier, Thomas Rott, siehe `data/fakten.json`). Eingaben in Werkzeugen sind immer erfundene Musterwerte („Café Muster“, „muster-wlan“), nie echte Zugangsdaten. Fakten wie auf vamela.de, Stand 12.10.2026.

Format für den Parser (`render/inhalt.mjs`, `readReels`): Überschrift „## Reel N: Titel“, Metazeilen, Hook, Ablauf-Tabelle „Zeit | Aufnahme | Text im Bild“, Caption, Hashtags. Neue Reels schreibt `automatik/neu-schreiben.mjs --typ reel` in `docs/content-reels-auto.md`.

---

## Reel 1: Logo-JPG wird Vektor
- Säule: werkzeuge
- Hook-Stil: vorher-nachher
- Angebot: Werkzeug
- Werkzeug: /vektorisieren
- URL: https://vamela.de/vektorisieren
- Ton: stumm

**Hook (Cover und erster Satz, wörtlich):** „Aus dem unscharfen Logo-JPG wird eine Vektordatei.“

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
- Ton: stumm

**Hook (Cover und erster Satz, wörtlich):** „Wie kommen Kunden mit einem Scan zu deiner Bewertung?“

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
- Ton: stumm

**Hook (Cover und erster Satz, wörtlich):** „Gratis-Werkzeuge für deinen Betrieb, ohne Anmeldung.“

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

## Reel 4: Das Formular, das nie ankam
- Säule: tipps
- Hook-Stil: provokation
- Angebot: Entwurf
- URL: https://vamela.de/projekt/schlossallee-haag/
- Ton: stumm

**Hook (Cover und erster Satz, wörtlich):** „Die alte Seite sah okay aus. Anfragen kamen nie an.“

**Ablauf:**
| Zeit | Aufnahme | Text im Bild |
|---|---|---|
| 0–3 s | Seitenanfang der Referenz, ruhig stehen | „Die alte Seite sah okay aus. Anfragen kamen nie an.“ |
| 3–9 s | langsam zu „Ausgangslage“ scrollen | „Das Kontaktformular des Biergartens funktionierte nicht.“ |
| 9–15 s | weiter zu „Umsetzung“ | „Neu gebaut, mit funktionierendem Kontaktweg.“ |
| 15–21 s | weiter zu „Ergebnis“ | „Das Formular kommt wieder an.“ |
| 21–25 s | kurz stehen bleiben | „Teste dein Formular heute selbst.“ |

**Caption:**
Die alte Seite sah okay aus. Anfragen kamen trotzdem nie an.

Beim Traditionsbiergarten Schlossallee in Haag stammte die alte Seite vom Vorbesitzer, sie wurde nicht mehr gepflegt, und das Kontaktformular funktionierte nicht. Ich habe die Seite neu gebaut, mit funktionierendem Kontaktweg, Standl- und Speisenübersicht und Anfahrt. Das Formular kommt wieder an.

Zum Mitnehmen: Schick dir heute selbst eine Anfrage über dein Formular und schau auch im Spam-Ordner nach.

Wenn du sehen willst, wie deine Seite aussehen könnte: Den ersten Entwurf baue ich dir kostenlos, gefällt er dir nicht, sagst du ab. Link in der Bio.

Folge @vamela.de für kurze Tipps, mit denen dein Betrieb im Netz besser gefunden wird.

Wann hast du dein Formular zuletzt getestet?

**Hashtags:** #webdesign #gastronomie #biergarten #freising #website

---

## Reel 5: Ein Garagentor, das aufgeht
- Säule: design
- Hook-Stil: kontrast
- Angebot: keins
- URL: https://vamela.de/bachmaier/
- Ton: stumm

**Hook (Cover und erster Satz, wörtlich):** „Vorher nur ein Pixel-Logo. Jetzt öffnet sich das Tor.“

**Ablauf:**
| Zeit | Aufnahme | Text im Bild |
|---|---|---|
| 0–3 s | Seitenanfang, Garagentor geschlossen | „Vorher nur ein Pixel-Logo. Jetzt öffnet sich das Tor.“ |
| 3–9 s | langsam scrollen, das Tor im Kopfbereich öffnet sich | „Das Tor öffnet sich beim Hineinscrollen.“ |
| 9–15 s | weiter zu den Leistungen | „Jede Leistung bekommt eine eigene Seite.“ |
| 15–20 s | weiter zum Logo im Fuß | „Das Logo ist als Vektor neu gezeichnet.“ |
| 20–24 s | kurz stehen bleiben | „Gestaltung, die zum Handwerk passt.“ |

**Caption:**
Vorher gab es das Logo nur als kleines Pixelbild. Jetzt öffnet sich beim Scrollen das Garagentor.

Bachmaier ist ein Garagentor-Fachbetrieb aus Zolling, seit 1998 im Landkreis Freising. Die Leistungen, also Neubau, Renovierung, Reparatur, Antriebe und Gewerbetore, sollten einzeln auffindbar sein. Jetzt hat jede ihre eigene Seite, das Logo ist als Vektor neu gezeichnet, und im Kopfbereich öffnet sich beim Hineinscrollen ein Garagentor.

Zum Mitnehmen: Ein Bild, das zeigt, was du machst, sagt mehr als jeder Slogan. Für einen Torbauer ist es das Tor.

Folge @vamela.de für Design, das zu kleinen Betrieben passt.

Was wäre das Bild, das deinen Betrieb in einer Sekunde erklärt?

**Hashtags:** #webdesign #handwerk #garagentor #landkreisfreising #grafikdesign

---

## Reel 6: Erster Auftritt zur Gründung
- Säule: tipps
- Hook-Stil: mythos
- Angebot: keins
- URL: https://vamela.de/projekt/thomas-rott/
- Ton: stumm

**Hook (Cover und erster Satz, wörtlich):** „Ein Ein-Mann-Betrieb braucht keine Website? Doch.“

**Ablauf:**
| Zeit | Aufnahme | Text im Bild |
|---|---|---|
| 0–3 s | Seitenanfang der Referenz, ruhig stehen | „Ein Ein-Mann-Betrieb braucht keine Website? Doch.“ |
| 3–9 s | langsam zu „Ausgangslage“ scrollen | „Neu gegründet, ohne jede digitale Präsenz.“ |
| 9–15 s | weiter zu „Umsetzung“ | „Klares Leistungsprofil statt Bauchladen.“ |
| 15–21 s | weiter zu „Auf der Seite“ | „Express-Anfrage per WhatsApp eingebaut.“ |
| 21–25 s | kurz stehen bleiben | „Gefunden werden fängt beim ersten Auftritt an.“ |

**Caption:**
Ein Ein-Mann-Betrieb braucht keine Website? Doch, gerade der.

Thomas Rott hat sein Gewerbe gegründet und musste sich ohne jede digitale Präsenz gegen etablierte Anbieter und anonyme Großfirmen behaupten. Sein erster Webauftritt bekam eine persönliche Positionierung mit klarem Leistungsprofil für Objektbetreuung, Gartenpflege und Fassadenreinigung, ausgerichtet auf den Raum Freising, Erding und Landshut, dazu eine Express-Anfrage per WhatsApp.

Zum Mitnehmen: Schreib deine Leistungen einzeln auf, nicht als Bauchladen. Wer genau sucht, soll genau dich finden.

Folge @vamela.de für kurze Tipps, mit denen dein Betrieb im Netz besser gefunden wird.

Was würdest du als Erstes auf deine Seite schreiben?

**Hashtags:** #gruendung #webdesign #handwerk #freising #erding
