# VAMELA Insta: autonome Instagram-Automatik für @vamela.de

Christian Stockmeier (VAMELA, Webdesign und Grafikdesign, Haag an der Amper, Landkreis Freising) betreibt mit diesem Projekt sein eigenes Instagram-Konto @vamela.de. Das System plant, schreibt, gestaltet, prüft, veröffentlicht, misst und optimiert sich selbst, ohne Freigabeschleife. Der Auftrag steht in `docs/auftrag.md`. Bei Widerspruch gilt `docs/auftrag.md`, danach diese Datei, danach `docs/strategie.md`.

## Bei jedem Lauf zuerst lesen

1. `learnings.md` (was getestet wurde und was gilt)
2. `docs/strategie.md` (Positionierung, Zielgruppe, vier Säulen, Wochenmodell, Caption-Aufbau, Hashtags, Zielwerte)
3. `data/fakten.json` (die einzigen erlaubten Preise, Werkzeug-Adressen und Referenzen) und `data/trends.json` (geprüfte Fundstücke und aktuelle Hype-Themen, wöchentlich von `automatik/trends.mjs`)
4. bei Produktion zusätzlich `docs/content-posts.md`, `docs/content-reels.md`, `docs/content-stories-auto.md`, `plan/queue.json`, `plan/params.json`

## Feste Regeln

Diese Regeln darf keine Selbstoptimierung ändern. Der Denk-Lauf (`automatik/think.mjs`) darf nur die Stellgrößen aus seiner Whitelist im Code ändern.

**Marke**
- Feed 1080 × 1350 JPG, Stories und Reels 1080 × 1920, Reels als MP4 (H.264, AAC oder stumm).
- Absender VAMELA bzw. vamela.de auf jedem Beitrag erkennbar (Cover oder letzte Seite).
- Nur frei lizenzierte Schriften, lokal eingebunden (`render/orange/fonts`).
- Bilder nie verzerren, immer proportional skalieren und zuschneiden.
- Cover mit großer, fetter Schrift, lesbar in Daumennagelgröße.
- Keine fremden Logos, Marken oder Bildschirmfotos fremder Websites und Profile. Kundenseiten nur, wenn sie als Referenz freigegeben sind: Schlossallee Haag, Bachmaier, Thomas Rott (`data/fakten.json`). Gut-gegen-schlecht-Beispiele nur selbst gezeichnet oder gesetzt, mit Fantasienamen („Schreinerei Muster“).

**Inhalt**
- Vier Säulen: Tipps für Betriebe (Website, Google-Profil, Bewertungen, lokale Sichtbarkeit), Gratis-Werkzeuge auf vamela.de, Design-Inspiration (Schrift, Farbe, Layout) und Fundstücke (`fundstuecke`: kostenlose GitHub-Repos, Open-Source-Werkzeuge und KI-Tools für Selbstständige, kleine Betriebe, Designer und Webleute, z. B. Bildbearbeitung, Rechnungen, Website-Baukästen, KI lokal). Keine Säule unter 10 % und keine über 50 % der Beiträge (im Optimierer fest eingebaut). Fundstücke nur als Karussell.
- **Jeder Beitrag bietet Mehrwert** (Christian, 12.10.2026: „Alle Posts sollen einen Mehrwert für meine Follower bieten! Die brauchen ja einen Grund, dass sie mir folgen.“). Das gilt auch für Cover, Stories und Reels: jeder Beitrag liefert konkreten, sofort nutzbaren Nutzen, also einen Tipp zum Umsetzen, ein Werkzeug oder Repo mit Fundort, ein Vorher-Nachher-Prinzip oder eine Checkliste. Reine Image- oder Spruch-Beiträge („Große Ideen brauchen Platz“) sind verboten, eine Frage ohne Tipp reicht nicht. Das Cover verspricht den Nutzen konkret (was man lernt oder bekommt). Jeder Vorratsblock trägt die Pflichtzeile `- Mehrwert:` (ein Satz, der mit „Du kannst“, „Du weißt“ oder „Du hast“ beginnt); `automatik/block-felder.mjs` prüft sie beim Schreiben, der Prüf-Agent bewertet, ob die Seiten sie einlösen (Punkt MEHRWERT).
- **Bildmotiv je Block:** Pflichtzeilen `- Motiv:` (kurze englische Bildbeschreibung für einen KI-Bildgenerator: Tech-, KI- oder Gaming-Hype oder eine Tier- oder Objekt-Metapher; keine Schrift, keine Personen, keine echten Marken, Logos oder Spielfiguren, also „voxel-style“ statt Minecraft-Figur, „retro game“ statt eines echten Spiels) und `- Familie: nacht|tag` (nacht = Tech, KI, Gaming, dunkel mit oranger Glut; tag = Tier- oder Objekt-Metapher auf Orange und Weiß).
- **Fundstücke nur echt und live geprüft** (`automatik/repo-check.mjs`): nur existierende Repos, vor dem Schreiben (`neu-schreiben.mjs`), im Prüf-Agenten und vor dem Veröffentlichen (`publish.mjs`) über die GitHub-API geprüft: existiert, nicht archiviert, kein Fork, letzter Push jünger als 12 Monate, Lizenz vorhanden (mit Namen nennen). Sterne nur als gerundete Zahl mit „Stand“-Datum. Keine Behauptung über Funktionen, die nicht in Beschreibung oder README steht. Kostet ein Werkzeug oder ein Teil davon Geld (Bezahlplan, gehostete Fassung, Cloud-Anbieter), sagt der Beitrag das. Metazeilen `- Repo: owner/name`, `- Lizenz:`, `- Sterne: rund N (Stand TT.MM.JJJJ)`; die Caption nennt `github.com/owner/name`, Seite 6 den Fundort. Angebot immer „keins“. Keine Rechtsberatung zu Lizenzen, nur den Namen nennen.
- **Aktualität:** `automatik/trends.mjs` holt wöchentlich (`.github/workflows/trends.yml`) GitHub-Trending-Kandidaten und Hype-Themen der Woche (Hacker News), jeweils mit Quelle und Datum, Claude filtert auf die Zielgruppe. Hype-Themen dienen nur als Bildmotiv-Ideen, nie als Fakt im Text.
- **Karussell-Struktur (gilt für alle Karussells):** genau 6 Seiten. Seite 1 Hook, höchstens 10 Wörter, der Neugier weckt oder ein Problem aufmacht. Seiten 2 bis 5 Inhalt: ein Kerngedanke pro Seite, höchstens zwei kurze Sätze und etwa 20 Wörter, keine Textwüsten. Seite 6 CTA: eine klare Handlungsaufforderung (Speichern, Teilen oder Kommentieren; bei Werkzeug oder kostenlosem Entwurf „Link in der Bio“, ohne Angebot kein Link). Geprüft von `automatik/karussell-regeln.mjs` (beim Schreiben, Produzieren und im Prüf-Agenten).
- Angebote: „Werkzeug“ (ein Gratis-Werkzeug auf vamela.de, in jedem Werkzeug-Beitrag), „Entwurf“ (der kostenlose erste Entwurf, etwa jeder vierte Tipp-Beitrag, nie zweimal hintereinander) oder „keins“ (immer bei Fundstücken). Hinweis immer auf „Link in der Bio“.
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
- **Abgelehnte Beiträge werden automatisch repariert** (Christian, 12.10.2026: „Alle abgelehnten sollen automatisch nochmal gemacht werden, bis es klappt!“): `automatik/reparieren.mjs` (in `fill.mjs` vor jedem Produzieren) lässt Claude (nur Abo) den Block anhand der Prüfgründe korrigieren, prüft das Ergebnis mit denselben Regeln wie `neu-schreiben.mjs`, ersetzt den Block in `docs/`, rendert neu und lässt neu prüfen. Höchstens 3 Reparaturen je Beitrag (`data/reparaturen.json`), danach Status `aufgegeben` (zählt nicht zum Puffer, steht im Wochenbericht, `vorrat.mjs` schreibt Ersatz). Die Reparatur lockert keine Regel, sie streicht im Zweifel Unbelegtes. Stories haben keine Caption, der Prüfpunkt CAPTION entfällt für sie.

## Gestaltung: Look „Orange“

Von Christian am 12.10.2026 freigegeben. Vorlage und Referenzbilder: `/Users/test/website/vamela-social/insta-entwuerfe/` (`png/v1.png` … `v14.png`). Code: `render/orange.mjs` (Bausteine), `render/orange/` (CSS, Einpass-Skript, Schriften, Logo, Körnung), `render/karussell.mjs`, `render/story.mjs`, `render/pruefen.mjs`, `render/bilder.mjs`. Allgemein gilt weiter: minimalistisch, textarm, keine Kartenraster und keine Deko-Illustrationen, Kontrast vor Stimmung.

**Farben:** Orange `#FF5B14`, dunkles Orange `#D94300` (trägt Text auf Hell), Verlauf `#FF8A3D` → `#FF3D00` (nur Schrift auf Dunkel), Schwarz `#0A0A0A`, Grau `#A3A3A3`, Weiß. Leichte Körnung (`noise.png`, 7 %) über jeder Seite.

**Schriften** (lokal in `render/orange/fonts`, SIL OFL): Poppins 300–800 und 600/700 kursiv für alles, Instrument Serif kursiv nur als Akzentwort. Überschriften werden per `orange.js` (`data-fit`, `data-fit-h`) auf die größte passende Größe gesetzt (Innenseiten 110–64 px, Stories 120–72 px); Fließtext Innenseiten 46 px, Stories 48 px, Cover-Unterzeile 32 px, Fußzeile 30 px, nichts unter 30 px.

**Familien** (Feld `familie: nacht|tag` im Vorrat; ohne Feld: Werkzeuge nacht, Design tag, Tipps im Wechsel nach Nummer):
- *Nacht*: schwarz mit Glut. Cover mit KI-Bild (Motiv unten, oben 40 % dunkel), dunkler Verlauf von oben, weiße Schrift oben links (`nacht-links`) oder mittig (`nacht-mitte`), Akzentwort im Orange-Verlauf oder kursiv-serif, Unterzeile 30 px. Fuß rechts „➤ vamela.de“.
- *Tag*: hell. Cover mit KI-Bildmetapher auf Orange/Weiß, schwarze Schrift oben links, zweite Zeile leicht schwarz (`tag-schwarz`) oder `#D94300` (`tag-orange`). Fuß „@vamela.de / Webdesign & Grafik“ links, „VAMELA / aus Freising“ rechts.

**Bausteine:** Cover (Bild + Überschrift + Unterzeile); Innenseite (Pille mit Thema = kurzer Titel oder Säule, darunter Überschrift = erster Satz bzw. Teil vor „ / “, Fließtext = Rest; der Block steht optisch mittig mit Schwerpunkt bei etwa 45 % der Höhe; unten ein ruhiger Bildstreifen aus dem Cover-Bild, je Seite ein anderer Ausschnitt, Nacht abgedunkelt, Tag aufgehellt, nach oben ausgeblendet; unten links „weiter →“ als Glas-Pille bzw. dunkle Pille); Schlussseite (Nacht mittig mit Knopf wie v5, Tag mit Knopf und Folgen-Satz; die Handlung steht genau einmal im Knopf: „Link in der Bio“ nur mit Angebot und dann nicht noch im Text, sonst „Speichern“, „Teilen“, „Kommentieren“ oder „Folgen“); Story 1080 × 1920 (Block mittig, Interaktionssatz als Knopf unten im sicheren Bereich, Hintergrund Glut bzw. Weiß→Orange, mit Motivbild als Streifen, wenn eins da ist; Quiz-Auflösung als zweite Datei). Hook mit mehr als 9 Wörtern meldet der Renderer als Hinweis „Hook zu lang (> 9 Wörter)“ (Queue-Feld `hinweise`). Die Cover-Vorlage geht als Merkmal `cover_vorlage` an den Optimierer. Kein Zitat- oder Reel-Overlay-Baustein bisher.

**Akzent-Markup im Vorrat** (Spalte „Text“): `*wort*` kursiv-serif, `_wort_` orange, `==wort==` orange hinterlegt; im Fließtext werden alle drei fett. Ohne Markup setzt der Renderer selbst: Nacht färbt das letzte starke Wort orange, Tag teilt die Überschrift am Satzzeichen nahe der Mitte, Fließtext mit mehreren Sätzen bekommt den letzten Satz fett. Keine Deko-Nummern, keine Kapitälchen-Kicker, keine Emojis auf Seiten (Emoji bricht die Prüfung ab).

**Prüfung und Kontrastregel** (`render/pruefen.mjs`, jede Seite muss bestehen): Text im Sicherheitsrand (Feed 80–1000 × 64–1290, Story 80–1000 × 250–1580, damit oben 250 px und unten 340 px für die Instagram-Oberfläche frei bleiben), mindestens 30 px, keine Überlappung, kein Überlauf, Einpassen gelungen, Schriften und Bilder geladen; Kontrast hinter jeder Textzeile am 10. Perzentil des Hintergrunds mindestens 3:1 (ab 40 px oder 32 px fett) bzw. 4,5:1. Dazu die Freiraumprüfung (nur Seiten mit Bild als Hintergrund, also Cover): im textfreien Render darf um jede Überschrift- und Unterzeilen-Zeile (+ 24 px Rand) höchstens 4 % der Pixel deutlich vom Bildhintergrund (Median der Bildzeile) abweichen, sonst „Text auf Motiv“; Fußzeile und Logo sind ausgenommen. Fällt der Kontrast oder der Freiraum durch, versucht der Renderer der Reihe nach: Verlauf hinter Text und Fußzeile verstärken bzw. Bildstreifen abschwächen, Textfarben kräftiger (Tag-Cover: zweite Zeile schwarz), Bild 140, 260, 340, 420 px nach unten schieben (oben mit der gemessenen Randfarbe gefüllt und weich ausgeblendet; Verlauf und Textfarbe nur, wenn der Kontrast durchgefallen war, damit ein Motiv unter dem Text nicht bloß zugedeckt wird). Besteht die Seite dann immer noch nicht, wird der Beitrag nicht produziert: Queue-Eintrag „abgelehnt“ mit den Gründen („GESTALTUNG: …“). Ein zu langer erster Satz (> 80 Zeichen) wird in Überschrift (bis zum ersten Satzzeichen) und Fließtext geteilt. Probelauf ohne Queue: `node render/probe.mjs k01 … k16 s01 … s06 --trocken` (Kontaktbogen `out/test-uebersicht.jpg` mit Cover und Seite 2 je Karussell und allen Story-Seiten, vollständig `out/test-alle.jpg`).

**Bildbeschaffung** (`render/bilder.mjs`): Prompt = Stil der Familie + Feld `motiv:` (englisch). Nacht: „Cinematic 3D render, pitch black background, … orange rim light …, top 40 percent dark empty space, no text“. Tag: „Bright surreal studio photograph, … vivid orange background or white wall with orange floor …, top 35 to 40 percent plain empty background, no text“. Hochformat 3:4, auf 1080 Breite gebracht, abgelegt als `bilder/<id>.png` mit `bilder/<id>.json` (Prompt, Anbieter, Modell, Familie); der Queue-Eintrag bekommt dieselben Angaben unter `bild`. Reihenfolge: schon beschafft → `bilder/vorrat/<id>.png` (ist die Vorratsdatei neuer als die Kopie `bilder/<id>.png`, gilt sie; in einer Sitzung über das Higgsfield-MCP erzeugt, `gpt_image_2`, 1k, quality low, 0,5 Credits; Prompt gern als `<id>.json` daneben) → Higgsfield-REST-API nur mit `HIGGSFIELD_API_KEY` und `HIGGSFIELD_API_SECRET` (kostet Credits, deshalb nicht im Standardbetrieb). Ohne Bild wird der Beitrag übersprungen und beim nächsten Lauf neu versucht.

## Selbstoptimierung

- **Messen** (`automatik/messen.mjs`, täglich): je Beitrag reach, views, follows, profile_visits, shares, saved, likes, Kommentare (soweit die API die Metrik für den Medientyp liefert) und täglich die Followerzahl.
- **Optimierer** (`automatik/optimierer.mjs`, im Code, wöchentlich vor dem Denk-Lauf): Wachstumswert je Beitrag = (follows × 10 + profile_visits × 2 + shares × 3 + saved × 2) je 100 erreichte Konten, ab 30 Reichweite. Gewichte je Merkmal (Säule, Hook-Stil, Format, Cover-Vorlage, Wochentag, Uhrzeit, Caption-Länge) in `plan/params.json` unter `gewichte`. Bewegung erst ab 3 gemessenen Beiträgen je Wert und 6 je Merkmal, höchstens 30 % des Abstands pro Lauf, Säulen 10 bis 50 %, Hook-Stile 5 bis 40 %, nichts fällt auf 0. Auswahl ε-greedy mit 20 % Erkunden, deterministisch.
- **Denk-Lauf** (`automatik/think.mjs`, sonntags): darf bis zu vier Stellgrößen ändern: `feed.uhrzeit` (17:00 bis 21:30), `stories.uhrzeit` (07:00 bis 14:00), `feed.tage` (nur mit aktiven Reels), Säulen- und Hook-Gewichte in den Grenzen. Schreibt Beobachtung, Beleg mit Zahlen, Entscheidung und nächsten Test nach `learnings.md`.
- **Neuschreiben** bekommt die fünf Beiträge mit dem höchsten Wachstumswert als Gewinner-Muster, die drei schwächsten als „vermeiden“ und die aktuellen Gewichte.

## Instagram-Zugang

- Konto @vamela.de, Instagram-Business- oder Creator-Konto. Instagram-User-ID: **noch offen** (kommt als Secret `IG_USER_ID`, steht nie im Code).
- Instagram Graph API mit Instagram-Login, kostenlose Meta-Entwickler-App. Token als Secret `IG_ACCESS_TOKEN`, Erneuerung wöchentlich verschlüsselt in `data/ig-token.enc` (Schlüssel `TOKEN_KEY`).
- Medien brauchen öffentliche HTTPS-Links: eigenes öffentliches GitHub-Repository `Ripptu/vamela-insta-media` nur für fertige Dateien, kurz vor dem Veröffentlichen hochladen, danach wieder löschen. Das Automatik-Repository heißt `Ripptu/vamela-insta`. Beide sind noch nicht angelegt.
- Facebook-Spiegelung (`automatik/facebook.mjs`) ist technisch eingebaut und bleibt inaktiv, solange `FB_PAGE_ID` und `FB_PAGE_TOKEN` fehlen.
- Veröffentlichen auslösen: GitHubs Zeitplan ist unzuverlässig, deshalb gibt es `automatik/mac-trigger.sh` für einen LaunchAgent `de.vamela.vamela-insta-trigger` (Klon unter `~/vamela-insta-trigger`). Noch nicht installiert, erst nach Repo, Secrets und Token.

## Material

- Inhalte und Fakten kommen von vamela.de (Quelle `/Users/test/vamela-website/neu/src`, live https://vamela.de), bei Fundstücken von der GitHub-API und dem README des Repos. Keine Fotos von Personen, keine Kundenfotos außer Bildschirmaufnahmen der freigegebenen Referenzen.
- Reels sind Scroll-Aufnahmen von vamela.de-Werkzeugen und eigenen Seiten (`docs/content-reels.md`), stumm.

## Werkzeuge auf Christians Mac

Kein Homebrew, alles ohne Admin-Rechte installiert:
- Node 24 LTS: `~/.local/node/bin`
- ffmpeg: `~/.local/ffmpeg/bin`
- GitHub CLI: `~/.local/bin/gh`
- Claude CLI: nicht im PATH. Die Desktop-App bringt sie mit unter `~/Library/Application Support/Claude/claude-code/<version>/claude.app/Contents/MacOS/claude` (höchste Version nehmen; `automatik/qa.mjs` sucht sie selbst).
- Architektur: arm64 (M1 Pro)

Bash-Schleifen verlieren hier gern den PATH. Bei mehreren Schritten ein Node-Skript statt Shell-Schleife nehmen. `pkill -f` nie mit kurzem Muster, Prozesse per PID beenden.
