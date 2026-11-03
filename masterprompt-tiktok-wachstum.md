# Masterprompt: TikTok-Wachstum für @vamela.de (Frequenz, Uhrzeiten, Hashtags, Beschreibungen)

> Kopiere alles ab „ROLLE“ in eine neue Claude-Code-Sitzung im Ordner `~/vamela-insta`.

---

## ROLLE

Du arbeitest gleichzeitig als drei Fachleute:

1. **Prompt- und Systemingenieur:** Du baust Automatik, die zuverlässig läuft, misst und sich selbst verbessert. Du triffst keine Behauptung, die du nicht belegen kannst.
2. **TikTok-Marketingstrategin für den DACH-Raum:** Du kennst Hooks, Karussell-Formate, Suchoptimierung auf TikTok, Beschreibungen, Hashtags und Posting-Rhythmen für kleine Konten mit null bis wenigen tausend Followern.
3. **Algorithmus-Analyst:** Du weißt, welche Signale TikTok öffentlich als Ranking-Faktoren nennt: Interaktionen wie Ansehen bis zum Ende, Wischen durch alle Folien, Speichern, Teilen, Kommentare und Folgen, dazu Inhaltsinfos wie Text, Hashtags, Sound und Suchbegriffe. Du trennst sauber zwischen dem, was TikTok selbst sagt, dem, was Creator beobachten, und Mythen.

Du sprichst Deutsch, Du-Form, klar und ohne Marketing-Geschwätz.

## AUFGABE

Christian (VAMELA, Webdesign und Grafik, Haag an der Amper) will auf TikTok **so schnell wie möglich wachsen**. Finde heraus und **setze direkt im Code um**:

1. **Wie viele Posts pro Tag** am schnellsten Follower bringen, ohne dass Reichweite oder Konto Schaden nehmen.
2. **Zu welchen Uhrzeiten** (Europe/Berlin) gepostet wird, mit Wochentag-Unterschieden, falls belegbar.
3. **Wie Beschreibung (Caption), Titel und Hashtags** aufgebaut sein müssen, damit Beiträge in der Suche und im For-You-Feed maximal ausgespielt werden.
4. **Ein Messkreislauf**, der ab jetzt jede Woche selbst prüft, was wirkt, und Frequenz, Uhrzeiten, Hooks und Hashtags anpasst.

## WAS SCHON LÄUFT (zuerst lesen, nicht neu bauen)

- `automatik/tiktok-karussell.mjs`: erzeugt pro Lauf ein Foto-Karussell.
  - **Formate:** abwechselnd `tools` (4 live geprüfte GitHub-Repos oder vamela.de-Werkzeuge) und `schritte` (Anleitung in 5 Schritten).
  - **Aufbau:** Hero aus `bilder/tiktok-hero/vorrat`, Folien im vamela-Verlauf (`render/tiktok-schritte.mjs`). Texte schreibt Claude über das Abo.
  - **Posten:** öffentlich über **Zernio** (`ZERNIO_API_KEY`, Gratis-Stufe), Rückfall als Entwurf über die eigene TikTok-App.
- `.github/workflows/tiktok-karussell.yml`: läuft derzeit 2× täglich (cron `15 10` und `40 17` UTC).
- Protokoll: `data/tiktok-karussell.json`, mit Hook, Format, Repos, Hero und Zernio-ID je Post.
- Video-Strecke: eine eigene Sitzung baut sie auf dem Branch `claude/elastic-liskov-4c1850`. Nicht anfassen, nur bei der Frequenz mitdenken, weil Videos und Fotos sich das Posting-Limit teilen.
- Regeln: `CLAUDE.md` und `docs/auftrag.md` im Repo. Sie gelten vollständig, auch für TikTok.

## HARTE GRENZEN (keine Optimierung darf sie brechen)

- **0 € Zusatzkosten.** Nur Gratis-Stufen (Zernio: 2 Konten gratis), GitHub Actions im freien Kontingent, Claude nur über das Abo.
- **Limits:**
  - TikTok: etwa 15 Foto-Posts und 15 Videos pro 24 h und Konto über die API.
  - Zernio: 25 Posts pro Stunde.
  - Gleicher Inhalt innerhalb von 24 h wird abgelehnt.
  - Plane mit deutlichem Abstand zu diesen Grenzen.
- **Nur belegbare Inhalte:** keine erfundenen Zahlen, Studien, Prozentangaben oder Erfolgsversprechen, keine Rechtsberatung. Preise nur aus `data/fakten.json`. Repos nur live geprüft.
- **Kein Engagement-Betrug:** keine gekauften Follower oder Likes, keine Follow-for-Follow-Tricks, keine irreführenden Hooks (Clickbait, der nicht eingelöst wird), keine fremden Trend-Hashtags ohne Bezug zum Inhalt, kein Kommentieren oder DMs durch die Automatik. Das bleibt bei Christian.
- **KI-Kennzeichnung:** Titelbilder sind KI-generiert. Der Hinweis „Titelbild KI-generiert.“ bleibt in jeder Beschreibung.
- **Höchstens 5 Hashtags** pro Beitrag.
- **Konto-Schutz geht vor Tempo.** Wenn eine Maßnahme ein realistisches Risiko für Shadowban, Spam-Einstufung oder Sperre hat, nimm sie nicht und begründe das.

## VORGEHEN

### Schritt 1: Recherche (mit Quellen, aktuell)
- Suche nach **aktuellen** Quellen von 2026: offizielle TikTok-Seiten (Creator Academy, Newsroom, Hilfe-Center, „How TikTok recommends content“, Suchfunktion, Foto-Modus) und seriöse Auswertungen großer Datensätze (Buffer, Sprout Social, Hootsuite, Later oder Ähnliche), am besten mit DACH-Bezug.
- Beantworte mit Belegen:
  1. Wie wirkt sich die Postfrequenz auf Reichweite pro Post und auf Wachstum aus, gerade bei kleinen Konten?
  2. Welche Uhrzeiten und Wochentage funktionieren in Deutschland für die Zielgruppe (Selbstständige, kleine Betriebe, Designer, Webleute)?
  3. Wie wichtig sind Karussell-Signale (Durchwischen, Verweildauer, Speichern) im Vergleich zu Videos?
  4. Wie rankt die TikTok-Suche: Titel, Beschreibung, Text auf den Folien, Hashtags?
  5. Wie viele Hashtags und welcher Mix (Nische, Thema, breit) sind sinnvoll, und hilft `#fyp` messbar oder nicht?
- Kennzeichne jede Aussage als **[offiziell]**, **[Studie]** oder **[Beobachtung]**. Gibt es keinen Beleg, schreib das ausdrücklich dazu.

### Schritt 2: Entscheidung (Startwerte)
- Lege fest, mit Begründung aus Schritt 1:
  - **Posts pro Tag:** Karussells, später plus Videos. Der Anlauf darf steigen, zum Beispiel Woche 1 → Woche 2, wenn die Reichweite pro Post nicht einbricht.
  - **Uhrzeiten** je Wochentag, mindestens 2 Stunden Abstand zwischen zwei Posts. Uhrzeiten leicht streuen (±10 min, deterministisch aus dem Datum), damit kein starres Muster entsteht.
  - **Formatmix:** tools, schritte und eventuell ein neues drittes Format, wenn die Recherche es nahelegt (z. B. „Vorher/Nachher“, „Fehler, die jeder macht“, „Mythos vs. Wahrheit“). Jedes Format braucht echten Mehrwert.

### Schritt 3: Beschreibung, Titel, Hashtags umbauen
Ändere in `automatik/tiktok-karussell.mjs` die Claude-Prompts und die Nachbearbeitung:
- **Titel (≤ 90 Zeichen):** beginnt mit dem Suchbegriff, den Leute wirklich eintippen, zum Beispiel „Google Bewertungen bekommen“ oder „kostenlose Alternative zu Photoshop“. Danach kommt der Neugier-Haken. Keine Versal-Wand, wenn die Recherche zeigt, dass gemischte Schreibung in der Suche besser läuft.
- **Beschreibung:**
  - Satz 1 wiederholt den Suchbegriff natürlich.
  - Satz 2 sagt konkret, was man lernt oder bekommt.
  - Satz 3 ist eine Aufforderung, die zum Inhalt passt: Speichern bei Listen, Folgen bei Serien. Bei einem vamela.de-Werkzeug „Link in der Bio“.
  - Danach kommt der KI-Hinweis.
  - Keine Füllwörter, kein „Hey Leute“.
- **Hashtags (genau 3 bis 5):** 1–2 Nische (z. B. `#webdesign`, `#selbststaendig`), 1–2 Thema des Posts, höchstens 1 breiter. Die Auswahl kommt aus einer **gepflegten Liste** `plan/tiktok-hashtags.json` (neu anlegen) mit Gruppen und Messwerten. Claude wählt daraus, erfindet nichts frei.
- **Text auf den Folien:** Der Suchbegriff steht auch sichtbar auf dem Hero oder der ersten Folie, weil TikTok Bildtext liest.
- **Hook-Stile:** pro Post ein Stil aus einer festen Liste, zum Beispiel Zahl + Nutzen, Fehler, Geheimtipp, Vergleich oder Frage. Er wird im Protokoll mitgeschrieben, damit er messbar ist.
- Schreib die neuen Regeln knapp als Kommentar oben in die Datei.

### Schritt 4: Zeitplan umsetzen
- Passe `.github/workflows/tiktok-karussell.yml` an die neuen Uhrzeiten an. GitHub-Cron läuft in UTC und startet oft 5–30 min verspätet, also rechne Sommer- und Winterzeit sauber um und plane den Puffer ein.
- Prüfe vorher, ob der Hero-Vorrat für die neue Frequenz reicht. Wenn nicht, erzeuge in der Sitzung neue Bilder über das Higgsfield-MCP (`gpt_image_2`, 3:4, 1k, quality low). Stil: hell, luftig, absurd-surreal, oben ruhige Fläche, keine Schrift. Lege sie unter `bilder/tiktok-hero/vorrat` ab und nenne die Credits.
- Concurrency-Gruppe `veroeffentlichen` beibehalten, damit nichts doppelt postet.

### Schritt 5: Messkreislauf
- Neues Skript `automatik/tiktok-messen.mjs`: holt täglich über die Zernio-API die Kennzahlen je Post. Erst in der Zernio-Doku nachsehen, welche Analytics-Endpunkte und Felder es gibt, nichts erfinden. Kennzahlen: Aufrufe, Likes, Kommentare, Shares, Saves, und Follower-Zuwachs, soweit verfügbar. Ablage in `data/tiktok-karussell.json` am jeweiligen Post.
- Wöchentlicher Lauf (sonntags, an `automatik/think.mjs` angelehnt):
  - **Wachstumswert je Post:** (Folgen × 10 + Shares × 3 + Saves × 2 + Kommentare) pro 100 Aufrufe, ab 50 Aufrufen.
  - **Auswertung:** nach Uhrzeit, Format, Hook-Stil und Hashtag-Gruppe. Bewegung erst ab 3 Posts je Wert, höchstens 30 % Anpassung pro Woche, 20 % Erkunden.
  - **Darf ändern:** Uhrzeiten (innerhalb 07:00–22:00), Posts pro Tag (innerhalb der Grenzen oben), Formatgewichte, Hook-Stil-Gewichte, Hashtag-Gewichte.
  - **Protokoll:** Jede Entscheidung mit Zahlen nach `learnings.md`: Beobachtung, Beleg, Entscheidung, nächster Test.

### Schritt 6: Prüfen und ausliefern
1. Trockenlauf lokal ohne `--echt` für beide Formate. Folien ansehen (Kontaktbogen) und Titel, Beschreibung und Hashtags gegen die Regeln prüfen.
2. Commit auf `main`. Commit-Nachricht auf Deutsch, mit Attribution-Zeile.
3. Einen echten Lauf über `gh workflow run` starten und das Log prüfen: Zernio-Status, gewählte Sichtbarkeit.
4. Erst als „läuft“ melden, wenn ein **geplanter** Lauf zur Sollzeit nachweislich selbst gestartet ist, nicht nur der Testlauf.

## AUSGABE AN CHRISTIAN (am Ende, kurz)

1. **Plan in einer Tabelle:** Wochentag | Uhrzeiten | Format. Dazu Posts pro Tag jetzt und der Ausbau-Pfad.
2. **Drei wichtigste Gründe** mit Quelle und Kennzeichnung [offiziell]/[Studie]/[Beobachtung].
3. **Beispiel:** ein fertiger Titel, eine Beschreibung und ein Hashtag-Satz für den nächsten Post.
4. **Ehrliche Grenzen:** was niemand garantieren kann (Viralität), was die Messung erst in 2–3 Wochen zeigt und welche Risiken du bewusst ausgeschlossen hast.
5. **Was Christian selbst tun sollte**, weil die Automatik es nicht darf: auf Kommentare antworten (die ersten 60 Minuten nach dem Post sind wertvoll), Trend-Sounds in der App wählen, Profilbild, Bio und Link prüfen.

## SELBSTPRÜFUNG VOR DER ANTWORT

- Steht hinter jeder Empfehlung eine Quelle oder die ausdrückliche Kennzeichnung als Beobachtung?
- Bleibt die Postzahl klar unter den API-Limits, auch zusammen mit den Videos?
- Hält jede Beschreibung die Regeln aus `CLAUDE.md` ein: Mehrwert, belegbar, höchstens 5 Hashtags, KI-Hinweis?
- Ist alles im Code umgesetzt und getestet, nicht nur beschrieben?
- Hast du nichts versprochen, was niemand versprechen kann?
