# VAMELA Insta: autonome Instagram-Automatik für @vamela.de

Christian Stockmeier (VAMELA, Webdesign und Grafikdesign, Haag an der Amper, Landkreis Freising) betreibt mit diesem Projekt sein eigenes Instagram-Konto @vamela.de. Das System plant, schreibt, gestaltet, prüft, veröffentlicht, misst und optimiert sich selbst, ohne Freigabeschleife. Der Auftrag steht in `docs/auftrag.md`. Bei Widerspruch gilt `docs/auftrag.md`, danach diese Datei, danach `docs/strategie.md`.

## Bei jedem Lauf zuerst lesen

1. `learnings.md` (was getestet wurde und was gilt)
2. `docs/strategie.md` (Positionierung, Zielgruppe, drei Säulen, Wochenmodell, Caption-Aufbau, Hashtags, Zielwerte)
3. `data/fakten.json` (die einzigen erlaubten Preise, Werkzeug-Adressen und Referenzen)
4. bei Produktion zusätzlich `docs/content-posts.md`, `docs/content-reels.md`, `docs/content-stories-auto.md`, `plan/queue.json`, `plan/params.json`

## Feste Regeln

Diese Regeln darf keine Selbstoptimierung ändern. Der Denk-Lauf (`automatik/think.mjs`) darf nur die Stellgrößen aus seiner Whitelist im Code ändern.

**Marke**
- Feed 1080 × 1350 JPG, Stories und Reels 1080 × 1920, Reels als MP4 (H.264, AAC oder stumm).
- Absender VAMELA bzw. vamela.de auf jedem Beitrag erkennbar (Cover oder letzte Seite).
- Nur frei lizenzierte Schriften, lokal eingebunden (`render/fonts`).
- Bilder nie verzerren, immer proportional skalieren und zuschneiden.
- Cover mit großer, fetter Schrift, lesbar in Daumennagelgröße.
- Keine fremden Logos, Marken oder Bildschirmfotos fremder Websites und Profile. Kundenseiten nur, wenn sie als Referenz freigegeben sind: Schlossallee Haag, Bachmaier, Thomas Rott (`data/fakten.json`). Gut-gegen-schlecht-Beispiele nur selbst gezeichnet oder gesetzt, mit Fantasienamen („Schreinerei Muster“).

**Inhalt**
- Drei Säulen: Tipps für Betriebe (Website, Google-Profil, Bewertungen, lokale Sichtbarkeit), Gratis-Werkzeuge auf vamela.de, Design-Inspiration (Schrift, Farbe, Layout). Keine Säule unter 15 % der Beiträge (im Optimierer fest eingebaut).
- Jeder Beitrag enthält etwas, das ein Betrieb sofort umsetzen kann.
- **Karussell-Struktur (gilt für alle Karussells):** genau 6 Seiten. Seite 1 Hook, höchstens 10 Wörter, der Neugier weckt oder ein Problem aufmacht. Seiten 2 bis 5 Inhalt: ein Kerngedanke pro Seite, höchstens zwei kurze Sätze und etwa 20 Wörter, keine Textwüsten. Seite 6 CTA: eine klare Handlungsaufforderung (Speichern, Teilen oder Kommentieren; bei Werkzeug oder kostenlosem Entwurf „Link in der Bio“, ohne Angebot kein Link). Geprüft von `automatik/karussell-regeln.mjs` (beim Schreiben, Produzieren und im Prüf-Agenten).
- Angebote: „Werkzeug“ (ein Gratis-Werkzeug auf vamela.de, in jedem Werkzeug-Beitrag), „Entwurf“ (der kostenlose erste Entwurf, etwa jeder vierte Tipp-Beitrag, nie zweimal hintereinander) oder „keins“. Hinweis immer auf „Link in der Bio“.
- **Nur belegbare Inhalte.** Keine erfundenen Kundenstimmen, Erfolgszahlen, Studien, Statistiken oder Prozentangaben, keine Erfolgsversprechen („Platz 1 bei Google“, „garantiert mehr Kunden“). Erfundenes Lob und erfundene Zahlen sind ein Wettbewerbsrisiko (UWG). Fakten nur, wie sie auf vamela.de stehen.
- **Preise nur so, wie sie aktuell auf vamela.de stehen** (`data/fakten.json`). `automatik/fakten.mjs --live` gleicht vor jeder Produktion ab, `publish.mjs` prüft vor jedem Beitrag mit Preis live, ob er noch stimmt. Keine Rabatte, keine Aktionspreise.
- **Keine Rechtsberatung.** Rechtstexte (Impressum, Datenschutz, AGB) werden nie verkauft oder als Leistung angeboten, nichts ist „rechtssicher“ oder „abmahnsicher“. Rechtsthemen höchstens mit dem Hinweis, sie mit einer Anwältin oder einem Anwalt zu klären.
- Deutsch, Du-Form, klar, bayerisch-bodenständig, kein Marktschreier-Ton.
- Keine KI-Floskeln: keine dekorative Nummerierung („01“, „02“, „1/6“), keine Kapitälchen-Kicker über Überschriften, keine Emojis auf Slides (in der Caption sparsam erlaubt). Keine „Aufgabe 1 / Aufgabe 2“-Schemata.
- Höchstens 5 Hashtags pro Beitrag.
- Kein Thema und kein Hook, der in den letzten 30 Tagen lief (`neu-schreiben.mjs` prüft das im Code).

**System**
- Kosten: 0 € zusätzlich. Claude nur über das Abo (`CLAUDE_CODE_OAUTH_TOKEN`), nie ein API-Schlüssel mit Abrechnung pro Nutzung. GitHub Actions nur Linux-Runner, Monatsverbrauch unter 50 % des freien Kontingents. Geht etwas nur gegen Geld: nicht umsetzen, kostenlose Alternative nennen und dokumentieren, was fehlt.
- Keine Werbung schalten, kein Geld ausgeben, keine Kontoeinstellungen ändern, nichts auf Instagram löschen.
- Nicht auf Kommentare oder Direktnachrichten antworten. Das bleibt bei Christian.
- Tokens und Schlüssel nur in Secrets bzw. im macOS-Schlüsselbund, nie im Code oder im Git-Verlauf.
- Die Meta-Oberfläche (Instagram, Facebook, Business Suite, Entwickler-Konsole) nie per Browser-Automation bedienen. Nur die offizielle API.
- Liegt im Repository eine Datei `PAUSE`, wird nichts veröffentlicht.

## Gestaltung: wird nach Entwurfswahl eingetragen

Noch nicht festgelegt. Christian wählt aus vier Entwürfen; danach kommen hier Farben, Schriften, Vorlagen (Cover, Textseite, Zitat, Schlussseite, Story, Reel-Overlay) und ihre Regeln hinein, und die Renderer entstehen als `render/karussell.mjs`, `render/story.mjs` und `render/reel.mjs` (Verträge in `automatik/produce.mjs`). Bis dahin bricht `produce.mjs` mit einer klaren Meldung ab, und der Prüf-Agent prüft Gestaltung nur auf Lesbarkeit und Sauberkeit. Aus Christians Erfahrung gilt schon jetzt: minimalistisch, textarm, keine Kartenraster und keine Deko-Illustrationen, Form dem Inhalt anpassen statt immer gleicher Kacheln, Kontrast vor Stimmung.

## Selbstoptimierung

- **Messen** (`automatik/messen.mjs`, täglich): je Beitrag reach, views, follows, profile_visits, shares, saved, likes, Kommentare (soweit die API die Metrik für den Medientyp liefert) und täglich die Followerzahl.
- **Optimierer** (`automatik/optimierer.mjs`, im Code, wöchentlich vor dem Denk-Lauf): Wachstumswert je Beitrag = (follows × 10 + profile_visits × 2 + shares × 3 + saved × 2) je 100 erreichte Konten, ab 30 Reichweite. Gewichte je Merkmal (Säule, Hook-Stil, Format, Cover-Vorlage, Wochentag, Uhrzeit, Caption-Länge) in `plan/params.json` unter `gewichte`. Bewegung erst ab 3 gemessenen Beiträgen je Wert und 6 je Merkmal, höchstens 30 % des Abstands pro Lauf, Säulen 15 bis 60 %, Hook-Stile 5 bis 40 %, nichts fällt auf 0. Auswahl ε-greedy mit 20 % Erkunden, deterministisch.
- **Denk-Lauf** (`automatik/think.mjs`, sonntags): darf bis zu vier Stellgrößen ändern: `feed.uhrzeit` (17:00 bis 21:30), `stories.uhrzeit` (07:00 bis 14:00), `feed.tage` (nur mit aktiven Reels), Säulen- und Hook-Gewichte in den Grenzen. Schreibt Beobachtung, Beleg mit Zahlen, Entscheidung und nächsten Test nach `learnings.md`.
- **Neuschreiben** bekommt die fünf Beiträge mit dem höchsten Wachstumswert als Gewinner-Muster, die drei schwächsten als „vermeiden“ und die aktuellen Gewichte.

## Instagram-Zugang

- Konto @vamela.de, Instagram-Business- oder Creator-Konto. Instagram-User-ID: **noch offen** (kommt als Secret `IG_USER_ID`, steht nie im Code).
- Instagram Graph API mit Instagram-Login, kostenlose Meta-Entwickler-App. Token als Secret `IG_ACCESS_TOKEN`, Erneuerung wöchentlich verschlüsselt in `data/ig-token.enc` (Schlüssel `TOKEN_KEY`).
- Medien brauchen öffentliche HTTPS-Links: eigenes öffentliches GitHub-Repository `Ripptu/vamela-insta-media` nur für fertige Dateien, kurz vor dem Veröffentlichen hochladen, danach wieder löschen. Das Automatik-Repository heißt `Ripptu/vamela-insta`. Beide sind noch nicht angelegt.
- Facebook-Spiegelung (`automatik/facebook.mjs`) ist technisch eingebaut und bleibt inaktiv, solange `FB_PAGE_ID` und `FB_PAGE_TOKEN` fehlen.
- Veröffentlichen auslösen: GitHubs Zeitplan ist unzuverlässig, deshalb gibt es `automatik/mac-trigger.sh` für einen LaunchAgent `de.vamela.vamela-insta-trigger` (Klon unter `~/vamela-insta-trigger`). Noch nicht installiert, erst nach Repo, Secrets und Token.

## Material

- Inhalte und Fakten kommen von vamela.de (Quelle `/Users/test/vamela-website/neu/src`, live https://vamela.de). Keine Fotos von Personen, keine Kundenfotos außer Bildschirmaufnahmen der freigegebenen Referenzen.
- Reels sind Scroll-Aufnahmen von vamela.de-Werkzeugen und eigenen Seiten (`docs/content-reels.md`), stumm.

## Werkzeuge auf Christians Mac

Kein Homebrew, alles ohne Admin-Rechte installiert:
- Node 24 LTS: `~/.local/node/bin`
- ffmpeg: `~/.local/ffmpeg/bin`
- GitHub CLI: `~/.local/bin/gh`
- Claude CLI: nicht im PATH. Die Desktop-App bringt sie mit unter `~/Library/Application Support/Claude/claude-code/<version>/claude.app/Contents/MacOS/claude` (höchste Version nehmen; `automatik/qa.mjs` sucht sie selbst).
- Architektur: arm64 (M1 Pro)

Bash-Schleifen verlieren hier gern den PATH. Bei mehreren Schritten ein Node-Skript statt Shell-Schleife nehmen. `pkill -f` nie mit kurzem Muster, Prozesse per PID beenden.
