# Hero-Vorrat für TikTok und Instagram

`vorrat/` ist der Vorratsordner. `automatik/tiktok-karussell.mjs` nimmt je Post das erste noch unbenutzte Bild nach Dateinamen (benutzt: `heros` in `data/tiktok-karussell.json`). Verbrauch: 3 Bilder am Tag. Reihenfolge steuert der Name: `0a…` kommt vor `a…`, `b…`, `h…`.

Nachfüllen geht nur in einer Sitzung über das Higgsfield-MCP, weil in der Cloud kein `HIGGSFIELD_API_KEY` liegt: `gpt_image_2`, 3:4, quality high, resolution 2k. Als JPG in `vorrat/` legen, Prompt als `<name>.json` daneben.

## Was einen Scrollstopper ausmacht (Christian, 06.11.2026)

Nicht „süßes Tier macht etwas Lustiges“, das wirkt wie Stockfoto. Ein Motiv braucht mindestens drei davon:

- **Eingefrorener Höhepunkt:** eine Sekunde vor oder während der Katastrophe, der Blick will wissen, wie es weitergeht.
- **Extremer Größenkontrast:** riesiges Ding, winziger Maßstab daneben.
- **Falsches Material oder falscher Ort:** Welle aus Farbe, Tornado aus Papier, Hai im Planschbecken.
- **Eine kräftige Hauptfarbe** vor hellem, ruhigem Grund.
- **Harter Gegensatz (Christian, 06.11.2026: „mehr kontrastreich und Gegensätze“):** Feuer gegen Eis, süß gegen gefährlich, eine Farbe gegen Schwarz-Weiß, einer gegen viele. Dazu satte Flächen (Gelb, Kobalt, Schwarz, Weiß) statt blassem Himmel.
- **Wirkt fotografiert:** Weitwinkel von unten, Filmkorn, echte Spritzer und Trümmer. Kein glatter CGI-Look.

## Pflicht im Prompt

Obere 45 % leerer heller Himmel oder Grund (dort steht der Text), Motiv unten und groß, keine Schrift, keine Logos, keine echten Marken, keine Personen.

Vorlage: `Real editorial photograph, low wide-angle 24mm, medium format, natural film grain, bright daylight. Upper 45 percent empty pale sky. <Motiv>. Hyperreal texture, no text, no letters, no logos, no people.`

## Aufbereitung

Bilder auf 1080 × 1440 bringen. Reicht das Motiv in die Textzone (oberste 38 %), das Motiv nach unten schieben und den Himmel oben weich verlängern, sonst liegt der Text auf dem Motiv. Danach einmal mit `renderHero` und `renderStory` probieren.

`09a01` bis `09a08` sind die Gegensatz-Motive und kommen zuerst dran. `0a01` bis `0a18` sind die härteren Motive vom 06.11.2026 (Größenkontrast, eingefrorener Moment, Blickkontakt), `0a19` bis `0a28` die ruhigeren. Welche wirklich besser laufen, zeigen erst die Messwerte: `hero` steht je Post in `data/tiktok-karussell.json`.
