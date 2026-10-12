# Auftrag: autonome Instagram-Automatik für @vamela.de (Vorgaben von Christian, 12.10.2026)

## Auftrag

Für Christians eigenes Instagram-Konto @vamela.de (VAMELA, Webdesign und Grafikdesign aus dem Landkreis Freising, Website vamela.de) läuft ein System, das selbstständig plant, schreibt, gestaltet, prüft, veröffentlicht, misst und sich verbessert. Es gibt keine Freigabeschleife. Das System entscheidet nach den Regeln in `CLAUDE.md` und dokumentiert, was es tut.

**Kernwunsch:** Das System soll sich automatisch verbessern und optimieren, um mehr Follower zu erhalten. Umgesetzt durch Messen je Beitrag, den Optimierer im Code und den wöchentlichen Denk-Lauf (siehe `docs/architektur.md`).

**Ziel:** mehr Follower und Anfragen aus der Region (Freising, Erding, Moosburg, München-Nord). Kunden sind kleine Betriebe: Handwerk, Gastronomie, Praxen, Dienstleister.

**Kosten: 0 € zusätzlich.** Nur kostenlose Dienste und das bestehende Claude-Abo.

## Grundlage

Das Projekt ist eine Kopie einer bestehenden, laufenden Instagram-Automatik, umgebaut für VAMELA. Übernommen sind Ablauf, Queue, Prüf-Agent, Veröffentlichung über die Instagram-API, Messung, Denk-Lauf, Bericht und die Mac-App. Neu sind die Regelwerke, der Inhaltsvorrat, die Fakten-Prüfung und der Optimierer.

## Inhalte

- **Drei Säulen:** (a) Tipps für Betriebe: Website, Google-Profil, Bewertungen, lokale Sichtbarkeit, kurz und sofort umsetzbar; (b) Gratis-Werkzeuge auf vamela.de (u. a. `/vektorisieren`, QR-Code ohne Abo, Bewertungs-QR, WLAN-QR, vCard, GiroCode, DPI-Rechner, Farbcode, E-Mail-Signatur, Unterschrift; Übersicht `/werkzeuge`) als Nutzen-Beiträge mit „Link in der Bio“; (c) Design-Inspiration: Schrift, Farbe, Layout, gute gegen schlechte Beispiele, nur selbst gezeichnet oder gesetzt, keine fremden Logos oder Screenshots fremder Marken.
- **Karussells:** genau 6 Seiten (Hook höchstens 10 Wörter, 4 Kerngedanken mit je höchstens zwei kurzen Sätzen, CTA).
- **Reels:** automatisch aufgenommene Scroll-Videos von vamela.de-Werkzeugen und eigenen Seiten mit Text darüber; Kundenseiten nur als freigegebene Referenz (Schlossallee, Bachmaier, Thomas Rott). Stumm, lizenzfreie Musik vielleicht später.
- **Stories:** Fragen an die Follower mit Bitte um Antwort per Nachricht.

## Ergänzungen von Christian (12.10.2026)

- „Alle Posts sollen einen Mehrwert für meine Follower bieten! Die brauchen ja einen Grund, dass sie mir folgen.“ Jeder Beitrag, auch Cover, Stories und Reels, liefert konkreten, sofort nutzbaren Nutzen. Reine Image- oder Spruch-Beiträge gibt es nicht.
- „Stelle gerne auch GitHub-Repos etc. vor.“ Vierte Säule Fundstücke: kostenlose GitHub-Repos, Open-Source-Werkzeuge und KI-Tools für Selbstständige, kleine Betriebe, Designer und Webleute, nur echte und live geprüfte Repos. Damit gelten vier statt drei Säulen, keine unter 10 %, keine über 50 %.
- Immer am Zahn der Zeit: aktuelle, gehypte Themen (KI-Releases, Games, GitHub-Trends) fließen wöchentlich als Fundstücke und Bildmotive ein.

## Feste Inhaltsregeln aus Christians Erfahrung

- Nur belegbare Inhalte: keine erfundenen Kundenstimmen, Erfolgszahlen oder Studien (UWG-Risiko).
- Keine Rechtsberatung. Rechtstexte (Impressum, Datenschutz, AGB) nie verkaufen oder als Leistung anbieten, höchstens auf eine Anwältin oder einen Anwalt verweisen.
- Preise nur so, wie sie aktuell auf vamela.de stehen, vor jedem Beitrag geprüft.
- Keine KI-Floskeln: keine Deko-Nummerierung (01/02), keine Kapitälchen-Kicker über Überschriften, keine Emojis auf Slides.
- Du-Form, klar, bayerisch-bodenständig, kein Marktschreier-Ton. Höchstens 5 Hashtags.

## Gestaltung

Noch nicht festgelegt: Christian wählt aus vier Entwürfen. Danach werden die Regeln in `CLAUDE.md` (Abschnitt „Gestaltung“) eingetragen und die Renderer gebaut. Bis dahin produziert das System nichts und meldet das klar.

## System-Regeln

- 0 € Zusatzkosten, Claude nur über das Abo (`CLAUDE_CODE_OAUTH_TOKEN`).
- Keine Werbung schalten, nichts auf Instagram löschen, keine Kontoeinstellungen ändern.
- Nicht auf Kommentare oder Direktnachrichten antworten. Antworten bleiben bei Christian.
- Datei `PAUSE` im Repository stoppt jedes Veröffentlichen.
- Tokens nur in Secrets bzw. im Schlüsselbund.
- Die Meta-Oberfläche nie per Browser-Automation bedienen.

## Einrichtung (noch offen)

1. Gestaltung wählen, Renderer für Karussell, Story und Reel bauen (Scroll-Reel-Rekorder mit Playwright).
2. Instagram-Konto @vamela.de als Business- oder Creator-Konto mit einer kostenlosen Meta-Entwickler-App verbinden, Token und User-ID als Secrets.
3. Repositories `Ripptu/vamela-insta` (privat) und `Ripptu/vamela-insta-media` (öffentlich, nur fertige Dateien) anlegen, Secrets setzen.
4. Testlauf trocken, dann live. Danach den Mac-Auslöser einrichten.
