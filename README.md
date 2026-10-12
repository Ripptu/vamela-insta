# VAMELA Insta

Instagram-Automatik für Christians eigenes Konto [@vamela.de](https://www.instagram.com/vamela.de/) (VAMELA, Webdesign und Grafikdesign für kleine Betriebe aus dem Landkreis Freising). Das System plant, schreibt, prüft, veröffentlicht, misst und optimiert sich selbst, damit das Konto mehr Follower und Anfragen aus der Region bekommt. Kopie von nina-insta (Stand 11.10.2026), umgebaut für vamela; Regeln in `CLAUDE.md`, Aufbau in `docs/architektur.md`.

## Was es tut

- **Inhalte** aus vier Säulen: Tipps für Betriebe, Gratis-Werkzeuge auf vamela.de, Design-Inspiration, Fundstücke (kostenlose GitHub-Repos, live geprüft). Jeder Beitrag mit Mehrwert-Satz, Bildmotiv und Familie. Vorrat in `docs/content-posts.md` (16 Karussells), `docs/content-stories-auto.md` (6 Stories), `docs/content-reels.md` (6 Scroll-Reels); Claude schreibt nach, wenn er knapp wird.
- **Fakten-Prüfung**: Preise und Adressen nur aus `data/fakten.json`, live mit vamela.de abgeglichen (`node automatik/fakten.mjs --live`); GitHub-Repos live über die GitHub-API (`automatik/repo-check.mjs`).
- **Trends**: wöchentlich GitHub-Trending-Kandidaten und Hype-Themen (Hacker News) nach `data/trends.json` (`automatik/trends.mjs`).
- **Selbstoptimierung**: Wachstumswert je Beitrag (Follower, Profilbesuche, Teilen, Speichern je 100 erreichte Konten), Gewichte je Merkmal in `plan/params.json`, Auswahl mit 20 % Erkunden, wöchentlicher Denk-Lauf mit Whitelist (`automatik/optimierer.mjs`, `automatik/think.mjs`).
- **Prüf-Agent**, **Veröffentlichen** über die Instagram-API, **Messen**, **Wochenbericht** wie in der Vorlage.

## Was noch fehlt

| Was | Stand |
|---|---|
| Gestaltung | Christian wählt aus vier Entwürfen, danach Abschnitt „Gestaltung“ in `CLAUDE.md` füllen. |
| Renderer | `render/karussell.mjs` (`buildCarousel`), `render/story.mjs` (`renderStory`) fehlen. Bis dahin endet `produce.mjs` mit Exit-Code 4 und einer klaren Meldung. `render/engine.mjs` ist ein neutrales Grundgerüst (Chromium, Messen, Rendern). |
| Scroll-Reel-Rekorder | `render/reel.mjs` (`renderReel`): Playwright mit Videoaufnahme im Handyformat, Schritte aus der Spalte „Aufnahme“, Text darüber, ffmpeg nach H.264 1080 × 1920. Danach `reels_aktiv: true` und `feed.tage = feed.tage_mit_reels` in `plan/params.json`. |
| Instagram-Token | Business- oder Creator-Konto mit kostenloser Meta-Entwickler-App verbinden; `IG_ACCESS_TOKEN` und `IG_USER_ID` (noch unbekannt) als Secrets. |
| Repositories | `Ripptu/vamela-insta` (privat) und `Ripptu/vamela-insta-media` (öffentlich, nur fertige Dateien) sind nicht angelegt; lokal gibt es nur dieses Git. |
| Secrets | `IG_ACCESS_TOKEN`, `IG_USER_ID`, `TOKEN_KEY`, `MEDIA_TOKEN` (nur `vamela-insta-media`, contents:write), `CLAUDE_CODE_OAUTH_TOKEN`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `REPORT_TO`; optional `FB_PAGE_ID`, `FB_PAGE_TOKEN`. |
| Auslöser | `automatik/mac-trigger.sh` für den LaunchAgent `de.vamela.vamela-insta-trigger` (Klon in `~/vamela-insta-trigger`), nicht installiert. |
| App | `app/` ist umbenannt (VAMELA Insta), aber nicht gebaut; Symbole in `app/src-tauri/icons` stammen noch aus der Vorlage. |
| Prüf-Agent-Testfälle | Die Bild-Testfälle der Vorlage sind nicht übernommen; neue entstehen mit dem Renderer. |

## Was wann läuft (Berliner Zeit, sobald Repo und Secrets da sind)

| Was | Wann | Datei |
|---|---|---|
| Veröffentlichen (Feed) | Mo bis Fr ab 19:00 | `.github/workflows/veroeffentlichen.yml` |
| Stories | Di, Do, So ab 12:30 | ebenda |
| Fakten abgleichen, Vorrat, Produzieren und Prüfen | nachts und mittags, nur wenn der Puffer unter 10 fällt | `produzieren.yml` |
| Messen | täglich früh | `messen.yml` |
| Trends (Fundstücke, Hype-Themen) | samstags früh | `trends.yml` |
| Optimierer und Denk-Lauf | sonntags abends | `denken.yml` |
| Bericht | montags früh | `bericht.yml` |
| Token erneuern | mittwochs | `token.yml` |

## Befehle

```bash
export PATH="$HOME/.local/node/bin:$PATH"
npm install                                  # nur im Wurzelordner
node --test automatik/test/*.test.mjs        # alle Tests
node automatik/pruefe-block.mjs --live docs/content-posts.md   # mit Live-Prüfung der Repos
node automatik/repo-check.mjs upscayl/upscayl                 # ein Repo prüfen
node automatik/trends.mjs --trocken                           # Trend-Kandidaten ansehen, ohne Claude
node automatik/fakten.mjs --live             # Preise und Adressen mit vamela.de abgleichen
node automatik/optimierer.mjs --trocken      # Gewichte aus data/messwerte.json nachrechnen, nichts schreiben
node automatik/bericht.mjs --trocken
```

## Regeln, die niemand ändert (auch nicht die Selbstoptimierung)

Alles unter „Feste Regeln“ in `CLAUDE.md`. Kurz: nur belegbare Inhalte, Preise nur wie auf vamela.de, keine Rechtsberatung, keine fremden Marken, keine KI-Floskeln, höchstens 5 Hashtags, genau 6 Karussell-Seiten; nie auf Kommentare oder Nachrichten antworten (das bleibt bei Christian), nichts auf Instagram löschen, kein Geld ausgeben, keine Werbung, Datei `PAUSE` stoppt alles.
