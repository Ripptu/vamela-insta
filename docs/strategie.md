# Instagram-Strategie für @vamela.de

Stand: 12.10.2026. Zeitraum: die ersten 90 Tage nach dem Livegang der Automatik. Grundlagen: vamela.de (Seiten, Preise, Werkzeuge, Ratgeber, Referenzen, per curl geprüft am 12.10.2026), Christians Vorgaben vom 12.10.2026, Erfahrungswerte aus der Website-Arbeit (vamela.de: 3 bis 10 Klicks am Tag sind über 6 bis 12 Monate realistisch) und aus einem anderen kleinen Instagram-Konto, das VAMELA betreut.

## Ziel

Mehr Follower und mehr Anfragen aus der Region: Landkreis Freising (Freising, Moosburg), Erding und München-Nord. Instagram ist für VAMELA ein Schaufenster und ein Vertrauensbeweis, kein Massenkanal. Wer folgt, soll merken: Hier ist jemand, der kleinen Betrieben konkret weiterhilft, und das kostenlos, bevor überhaupt Geld fließt.

## Positionierung

Ein Satz, den ein Fremder in zwei Sekunden versteht:

**„Websites, Logos und Drucksachen für kleine Betriebe aus dem Landkreis Freising, mit Tipps und Gratis-Werkzeugen, die du sofort nutzen kannst.“**

Das trägt drei Dinge, die auf vamela.de belegt sind: eine Person statt Agentur („Du redest mit dem, der es baut“), alles aus einer Hand (Website, Logo, Drucksachen), und Gratis-Werkzeuge ohne Anmeldung und ohne Abo. Der kostenlose erste Entwurf („Du siehst sie, bevor du zahlst“) ist das stärkste Angebot und kommt als Angebot „Entwurf“ in etwa jedem vierten Tipp-Beitrag.

Vorschlag für die Bio (setzt Christian von Hand, die Automatik ändert keine Kontoeinstellungen): „Websites, Logos & Flyer für kleine Betriebe · Landkreis Freising, Erding · Gratis-Werkzeuge ohne Anmeldung · Erster Entwurf kostenlos“, Link auf vamela.de/werkzeuge oder die Startseite. Angepinnt: ein Werkzeug-Beitrag, ein Tipp-Beitrag mit hohem Wachstumswert, ein Referenz-Reel.

## Zielgruppe

Inhaberinnen und Inhaber kleiner Betriebe in der Region: Handwerk (Schreiner, Garagentor, Gartenpflege, Haustechnik), Gastronomie (Biergarten, Café, Pizzeria), Praxen (Physiotherapie, Friseur, Personal Training) und Dienstleister (Reinigung, Facility Management, Ferienwohnungen). Sie haben wenig Zeit, kein Grafikprogramm und oft eine alte Website oder gar keine. Sie scrollen abends, nach Feierabend. Sie wollen keine Theorie, sondern einen Handgriff, den sie heute erledigen können.

Sprache: Du-Form, klar, bayerisch-bodenständig, kein Agentur-Sprech, kein Marktschreier-Ton.

## Drei Säulen

1. **Tipps für Betriebe** (`tipps`): Website, Google-Unternehmensprofil, Bewertungen, lokale Sichtbarkeit. Kurz und sofort umsetzbar. Quelle sind die Ratgeber auf vamela.de (Google-Eintrag, „Website bringt keine Anfragen“, QR-Code-Größe, Logo-Dateiformate und weitere). Etwa jeder vierte Tipp-Beitrag weist auf den kostenlosen Entwurf hin.
2. **Gratis-Werkzeuge** (`werkzeuge`): je Beitrag ein Werkzeug von vamela.de als Nutzen-Beitrag mit „Link in der Bio“: Bild vektorisieren, QR-Code ohne Abo, Bewertungs-QR, WLAN-QR, vCard, GiroCode, DPI prüfen, Farbcode aus Bild, E-Mail-Signatur, Unterschrift und die Übersicht `/werkzeuge`. Alle Adressen stehen in `data/fakten.json` und werden live geprüft. Dasselbe Werkzeug nicht zweimal in 30 Tagen.
3. **Design-Inspiration** (`design`): Schrift, Farbe, Layout, gutes gegen schlechtes Beispiel. Nur selbst gezeichnete oder gesetzte Beispiele mit Fantasienamen, keine fremden Logos, keine Bildschirmfotos fremder Marken.

Startverteilung je ein Drittel. Der Optimierer verschiebt die Anteile nach dem Wachstumswert, keine Säule fällt unter 15 % oder steigt über 60 %.

## Hook-Stile

Jeder Beitrag hat genau einen Hook-Stil, damit der Optimierer lernen kann, welcher Einstieg Follower bringt:

| Stil | Beispiel |
|---|---|
| `frage` | „Welche Hauptkategorie hat dein Google-Eintrag?“ |
| `fehler` | „Dein Kontaktformular kann seit Monaten kaputt sein.“ |
| `mythos` | „„Der QR-Code passt schon noch in die Ecke.““ |
| `kontrast` | „Auf dem Briefkopf top, im Profilbild unlesbar.“ |
| `vorher-nachher` | „Vom unscharfen Logo-JPG zur sauberen Vektordatei.“ |
| `liste` | „Drei Orte für deinen Bewertungs-Code.“ |
| `provokation` | „Gute Arbeit allein bringt dir keine Google-Bewertungen.“ (pointiert, nie herabsetzend) |

## Formate

- **Karussell** (1080 × 1350, genau 6 Seiten, siehe `CLAUDE.md`): das Hauptformat zum Speichern und Teilen.
- **Scroll-Reel** (1080 × 1920, 12 bis 30 Sekunden, stumm): automatische Bildschirmaufnahme eines Werkzeugs oder einer eigenen Seite auf vamela.de mit großem Text darüber. Kundenseiten nur als freigegebene Referenz (Schlossallee Haag, Bachmaier, Thomas Rott). Reels erreichen Menschen, die noch nicht folgen; sie starten, sobald der Rekorder gebaut ist.
- **Story** (1080 × 1920): Frage an die Follower mit der Bitte um eine Antwort per Nachricht, weil die API keine Sticker setzen kann.

## Wochenmodell

| Tag | Feed (19:00) | Story (12:30) |
|---|---|---|
| Montag | Karussell | – |
| Dienstag | Karussell, mit Rekorder Reel | Story |
| Mittwoch | Karussell | – |
| Donnerstag | Karussell, mit Rekorder Reel | Story |
| Freitag | Karussell | – |
| Sonntag | – | Story |

Fünf Feed-Beiträge pro Woche, höchstens 24 im Monat. Die Uhrzeiten sind Startwerte; der Denk-Lauf darf den Feed zwischen 17:00 und 21:30 und Stories zwischen 07:00 und 14:00 verschieben, wenn die Zahlen es belegen. Welcher Beitrag an welchem Tag kommt, entscheidet der Optimierer (nie dieselbe Säule und nie derselbe Hook-Stil zweimal hintereinander).

## Caption-Aufbau

1. **Hook**, wörtlich wie auf dem Cover.
2. **Zwei bis drei kurze Absätze**: was passiert, warum es zählt. Fakten nur wie auf vamela.de.
3. **„Zum Mitnehmen:“** ein konkreter Handgriff für heute.
4. **Angebot** (nur bei Werkzeug oder Entwurf): ein Satz, endet mit „Link in der Bio.“
5. **Folgen-Satz**: „Folge @vamela.de für …“ mit dem Nutzen der Säule.
6. **Frage** an die Lesenden als letzter Satz.

Suchbegriffe (Webdesign, Logo, Google-Profil, Freising, Erding) stehen natürlich im Fließtext, nicht als Liste. Emojis höchstens sparsam in der Caption, nie auf den Seiten.

## Hashtag-Regeln

- Höchstens 5 pro Beitrag, in einer eigenen Zeile unter der Caption.
- 1 bis 2 Ortstags (`#freising`, `#erding`, `#moosburg`, `#landkreisfreising`), 2 bis 3 Thementags passend zur Säule (`#webdesign`, `#googleprofil`, `#googlebewertungen`, `#qrcode`, `#grafikdesign`, `#logodesign`, `#typografie`, `#kleinunternehmen`, `#handwerk`, `#gastronomie`).
- Keine Massen-Tags ohne Bezug (`#love`, `#instagood`), keine Follow-Tauschtags, keine fremden Markennamen.
- Sätze wechseln, nicht fünfmal hintereinander dieselben fünf.

## Zielwerte für die ersten 90 Tage (realistisch begründet)

Die Ausgangswerte (Follower, Reichweite je Beitrag) trägt der erste Mess-Lauf ein; sie sind beim Anlegen dieser Datei nicht bekannt.

| Kennzahl | Ziel | Begründung |
|---|---|---|
| Feed-Beiträge | 20 im Monat | Wochenmodell Mo bis Fr; der Vorrat von 12 Karussells plus automatisches Neuschreiben trägt das, sobald der Renderer steht. |
| Neue Follower | 30 bis 60 in 90 Tagen | Die Zielgruppe ist regional und klein (Betriebe in einem Landkreis und der Nachbarschaft, nicht Konsumenten bundesweit). Karussells erreichen fast nur bestehende Follower: Im vergleichbaren kleinen Konto erreichten Karussells 29 bis 83 Konten, ein einzelnes Reel 174. Ohne Reels wächst ein kleines Konto deshalb langsam; mehr ist möglich, sobald Scroll-Reels laufen. |
| Wachstumswert je Beitrag | Median steigt von Monat 1 auf Monat 3 | Der Wert misst, ob Beiträge Follower, Profilbesuche, Teilen und Speichern auslösen. Er ist unabhängig von der Kontogröße und zeigt, ob der Optimierer lernt. |
| Profilbesuche | mehr als 5 je Beitrag im Schnitt ab Monat 2 | Profilbesuche sind der Schritt vor Folgen und Anfrage. |
| Anfragen über Instagram | 1 bis 2 im Quartal | Erfahrungswert aus vamela.de: 3 bis 10 Klicks am Tag über die Website sind realistisch, Anfragen sind ein Bruchteil davon. Instagram ist ein zusätzlicher, kleinerer Kanal. Christian zählt Anfragen, die Instagram nennen, von Hand. |

Das sind Einschätzungen, keine Zusagen. Ein einzelnes Reel kann ausreißen, nach oben wie nach unten. Der Denk-Lauf vergleicht monatlich mit diesen Werten und schreibt ins `learnings.md`, wenn ein Ziel offensichtlich zu hoch oder zu niedrig war.

## Was nicht passiert

Keine bezahlte Werbung, keine gekauften Follower, kein Follow-Unfollow, keine automatischen Kommentare oder Likes bei anderen Konten, keine Antworten auf Kommentare oder Nachrichten durch die Automatik. Antworten bleiben bei Christian.
