# Learnings

Was getestet wurde, was herauskam und was sich dadurch geändert hat. Jeder Eintrag mit Datum, Beleg (Zahlen) und Entscheidung. Diese Datei wird bei jedem Denk-Lauf zuerst gelesen. Der Denk-Lauf (`automatik/think.mjs`) hängt seine Einträge unten an.

## 12.10.2026: Ausgangslage beim Anlegen (Baseline)

- Konto @vamela.de. Ausgangswerte (Follower, Reichweite je Beitrag) trägt der erste Mess-Lauf (`messen.yml`) ein, danach vergleicht der Denk-Lauf mit der Vorwoche und dem Vormonat.
- Gewichte: alle Säulen, Hook-Stile, Formate und Caption-Längen gleich verteilt (`plan/params.json`). Der Optimierer bewegt sie erst, wenn je Wert mindestens 3 und je Merkmal mindestens 6 Beiträge mit mindestens 30 Reichweite gemessen sind.
- Rhythmus zum Start: Karussell Mo bis Fr 19:00, Stories Di/Do/So 12:30. Reels inaktiv, bis der Scroll-Reel-Rekorder gebaut ist.
- Gestaltung noch nicht gewählt: Bis die Renderer stehen, produziert die Automatik nichts.
- Vorrat: 12 Karussells (je 4 pro Säule, alle 7 Hook-Stile vertreten), 6 Stories, 6 Scroll-Reel-Konzepte, alle gegen Formregeln und `data/fakten.json` geprüft.
- Offene Hypothesen für die ersten 30 Tage: Welche Säule bringt die meisten neuen Follower je 100 erreichte Konten? Bringen Werkzeug-Beiträge mehr Profilbesuche als Tipps? Schlagen Hook-Stile „fehler“ und „provokation“ die „frage“?

## 12.10.2026: Vier Säulen, Mehrwert-Pflicht, Fundstücke (Vorgabe von Christian)

- Neu: Säule `fundstuecke` (kostenlose GitHub-Repos, live geprüft), Startgewicht je Säule 25 %, Grenzen 10 bis 50 %. Stories und Reels kennen keine Fundstücke.
- Jeder Block trägt einen Mehrwert-Satz, ein Bildmotiv und eine Familie (nacht/tag); Cover versprechen den Nutzen konkret. Vorrat: 16 Karussells (je 4 pro Säule), 6 Stories, 6 Reels; drei Reels und eine Story ohne echten Tipp wurden umgeschrieben.
- Offene Hypothese: Bringen Fundstücke mehr Speichern und Teilen als Tipps, aber weniger Anfragen aus der Region? Erst nach mindestens 3 gemessenen Fundstücken bewerten.

## 2026-10-25: Alle 26 gemessenen Beiträge liegen weit unter der Reichweiten-Schwelle von 30 Ko
- Beobachtung: Alle 26 gemessenen Beiträge liegen weit unter der Reichweiten-Schwelle von 30 Konten (Spanne 2–8), ab der der Wachstumswert überhaupt gebildet wird. Der Optimierer hat deshalb zu Recht 0 auswertbare Beiträge gefunden. Unterschiede zwischen Säulen, Hook-Stilen, Uhrzeiten oder Cover-Vorlagen bewegen sich alle im Bereich von 2 bis 8 Reach je Beitrag – das ist Rauschen, kein Muster.
- Beleg: Reach je Beitrag durchgehend 2–8 (z. B. k01: 8, k278: 2, k276: 3). Mittelwerte je Uhrzeit-Slot aus merkmale.uhrzeit: 07:00 ø4,5 (n=4), 11:00 ø5,0 (n=5), 12:00 ø5,0 (n=2), 15:00 ø4,5 (n=2), 16:00 ø3,0 (n=2), 17:00 ø3,3 (n=3), 19:00 ø4,2 (n=5), 20:00 ø2 (n=1) – Unterschiede unter 3 Reach bei n≤5 je Gruppe, keine davon über der 30er-Schwelle. follows=0 bei allen 26 Beiträgen, profile_visits nur bei 4 Beiträgen >0 (max. 6 bei k01). Säulen-Mittel ähnlich flach (tipps, werkzeuge, design, fundstuecke je ø3–6 Reach). Keine Gruppe erreicht die geforderte Mindeststichprobe (3 je Wert, 6 je Merkmal) mit brauchbarer Reichweite.
- Entscheidung: Keine Änderung an Uhrzeiten oder Gewichten, da kein Beitrag die 30-Reach-Schwelle erreicht und alle Unterschiede im Streuungsbereich liegen. Der automatische Optimierer kam zum selben Ergebnis (keine Änderung); ich sehe keinen Verzerrungsgrund (z. B. Ausreißer oder Untertestung einer Säule), der ein Eingreifen rechtfertigt. (keine Änderung durch den Denk-Lauf; Optimierer: keine Änderung)
- Nächster Test: Weiter Reichweite und Profilbesuche je Säule, Hook-Stil und Uhrzeit sammeln, bis mindestens 3 Beiträge je Wert und 6 je Merkmal die 30-Reach-Schwelle überschreiten. Besonders beobachten: ob Werkzeuge (Säule) mehr profile_visits bringen als Tipps (bisher k01 mit 6 profile_visits bei reach 8 ist einziger Hinweis) und ob die 19:00-Uhr-Slots mit größerer Stichprobe stabil bleiben.
