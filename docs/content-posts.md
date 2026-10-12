# Content-Vorrat für @vamela.de

Stand: 12.10.2026. Sechzehn fertige Karussells, je vier pro Säule (Tipps für Betriebe, Gratis-Werkzeuge, Design-Inspiration, Fundstücke), aufgebaut nach `strategie.md`. Jeder Block trägt die Merkmale für den Optimierer (`Säule`, `Hook-Stil`), Werkzeug-Beiträge zusätzlich den Pfad des Werkzeugs auf vamela.de. Dazu hat jeder Block drei Pflichtzeilen (`automatik/block-felder.mjs`): `Mehrwert` (ein Satz, was der Follower danach kann, weiß oder hat; die Seiten müssen das einlösen, das Cover verspricht es), `Motiv` (englische Bildbeschreibung für einen KI-Bildgenerator, ohne Marken, Logos, Personen und Schrift) und `Familie` (`nacht` = Tech, KI, Gaming, dunkel mit oranger Glut; `tag` = Tier- oder Objekt-Metapher auf Orange und Weiß). Fundstücke tragen zusätzlich `Repo`, `Lizenz` und `Sterne`, live geprüft gegen die GitHub-API (`node automatik/pruefe-block.mjs --live docs/content-posts.md`); sie behaupten nur, was in Beschreibung und README des Repos steht. Alle übrigen Fakten, Preise und Adressen stammen von vamela.de (Startseite, `/leistungen`, `/grafikdesign`, Werkzeugseiten und Ratgeber, per curl geprüft am 12.10.2026) und stehen in `data/fakten.json`. Die Spalte „Vorlage“ nennt nur die Rolle der Seite (Cover, Textseite, Zitat, Schlussseite); wie sie aussieht, legt die Gestaltung nach Christians Entwurfswahl fest. Beispiele für gut und schlecht sind erfundene Musterbetriebe („Schreinerei Muster“), nie echte Firmen.

Neue Blöcke schreibt `automatik/neu-schreiben.mjs` in `docs/content-posts-auto.md`, im selben Format; Fundstücke nimmt es aus `data/trends.json` (`automatik/trends.mjs`). Prüfen: `node automatik/pruefe-block.mjs [--live] docs/content-posts.md`.

# Karussells

## Karussell 1: Das stille Formular
- Säule: tipps
- Hook-Stil: fehler
- Angebot: keins
- Mehrwert: Du kannst in zwei Minuten prüfen, ob Anfragen über dein Kontaktformular wirklich bei dir ankommen.
- Motiv: a paper airplane letter caught in a spider web in front of an old mailbox, soft orange background
- Familie: tag

| Seite | Vorlage | Text |
|---|---|---|
| 1 | Cover | **Dein Formular kann still kaputt sein. So prüfst du es.** |
| 2 | Textseite | Formulare fallen still aus. Für Besucher sieht alles normal aus, die Nachricht verschwindet trotzdem. |
| 3 | Textseite | Beschwerden kommen keine. Wer keine Antwort bekommt, fragt kein zweites Mal an. |
| 4 | Textseite | Schick dir heute selbst eine Anfrage über dein Formular. Schau danach auch im Spam-Ordner nach. |
| 5 | Textseite | Teste im privaten Fenster. Sonst prüfst du womöglich eine alte, gespeicherte Fassung deiner Seite. |
| 6 | Schlussseite | Speichere dir den Beitrag und mach den Test einmal im Monat. |

**Caption:**
Dein Formular kann still kaputt sein. So prüfst du es.

Formulare fallen still aus. Ein abgelaufener Zugang beim Mailversand, eine Umstellung beim Hoster, ein Update: Für Besucher sieht das Formular ganz normal aus, die Nachricht kommt trotzdem nie an. Beschwerden gibt es keine, weil niemand ein zweites Mal anfragt.

Mir ist das auf meiner eigenen Seite passiert, nicht bei einem Kunden. Seitdem teste ich regelmäßig.

Zum Mitnehmen: Schick dir heute selbst eine Anfrage über dein Formular. Schau auch im Spam-Ordner nach und teste im privaten Fenster, damit du keine alte, gespeicherte Fassung der Seite prüfst. Und tipp am Handy einmal auf deine Telefonnummer: Wählt sie direkt?

Folge @vamela.de für kurze Tipps, mit denen dein Betrieb im Netz besser gefunden wird.

Wann hast du dein Formular zuletzt getestet?

**Hashtags:** #webdesign #kleinunternehmen #website #freising #erding

## Karussell 2: QR-Code ohne Abo
- Säule: werkzeuge
- Hook-Stil: kontrast
- Angebot: Werkzeug
- Werkzeug: /qr-code-generator
- Mehrwert: Du erkennst vor dem Druck, ob dein QR-Code statisch ist, und baust dir einen, der ohne Abo funktioniert.
- Motiv: a garden hedge maze shaped like a QR pattern with a small hedgehog finding the exit, orange and white
- Familie: tag

| Seite | Vorlage | Text |
|---|---|---|
| 1 | Cover | **Heute gratis, nach dem Abo tot: QR-Codes, die bleiben.** |
| 2 | Textseite | Viele Generatoren erzeugen dynamische Codes. Die leiten über den Server des Anbieters weiter. |
| 3 | Textseite | Endet dort das Abo, kann der gedruckte Code ins Leere führen. Dann druckst du neu. |
| 4 | Textseite | Ein statischer Code trägt die Adresse selbst. Er funktioniert, solange die Adresse existiert. |
| 5 | Textseite | Auf vamela.de baust du ihn kostenlos, ohne Anmeldung, mit Logo und Lesetest. |
| 6 | Schlussseite | Der QR-Code-Generator ist gratis und läuft im Browser. Link in der Bio, speicher dir den Beitrag. |

**Caption:**
Heute gratis, nach dem Abo tot: QR-Codes, die bleiben.

Viele QR-Generatoren erzeugen dynamische Codes. Die enthalten nur eine Kurzadresse beim Anbieter, der von dort weiterleitet. Das hat Vorteile, du kannst das Ziel später ändern. Aber der Code funktioniert nur so lange, wie der Anbieter die Weiterleitung betreibt. Endet das Abo, kann der Code auf deinen Flyern und Aufstellern ins Leere führen.

Ein statischer Code trägt den Inhalt direkt in seinem Muster. Zwischen deinem Kunden und deiner Seite steht niemand.

Zum Mitnehmen: Bevor du druckst, schau nach, ob dein Code statisch ist. Tipp: Verlinke eine Seite auf deiner eigenen Website. Dann änderst du später den Inhalt dort und musst nichts neu drucken.

Den QR-Code-Generator auf vamela.de gibt es kostenlos, ohne Anmeldung und ohne Abo, mit Logo, Lesetest und Druckvorlagen. Link in der Bio.

Folge @vamela.de für Gratis-Werkzeuge, die kleine Betriebe wirklich brauchen.

Hast du schon mal einen QR-Code neu drucken müssen?

**Hashtags:** #qrcode #kleinunternehmen #gastronomie #handwerk #landkreisfreising

## Karussell 3: Zwei Schriften reichen
- Säule: design
- Hook-Stil: provokation
- Angebot: keins
- Mehrwert: Du weißt, wie Flyer, Visitenkarte und Website mit zwei Schriften wie aus einem Guss aussehen.
- Motiv: four mismatched wooden birds on a branch, two of them singing in harmony, plain orange background
- Familie: tag

| Seite | Vorlage | Text |
|---|---|---|
| 1 | Cover | **Vier Schriften auf einem Flyer? Zwei reichen.** |
| 2 | Textseite | Jede neue Schrift ist eine neue Stimme. Zu viele Stimmen klingen nach Durcheinander. |
| 3 | Textseite | Eine Schrift für Überschriften, eine für den Text. Mehr braucht ein kleiner Betrieb fast nie. |
| 4 | Textseite | Unterschiede machst du mit Größe und Stärke, nicht mit der nächsten Schrift. |
| 5 | Textseite | Nimm auf Flyer, Visitenkarte und Website dieselben zwei. Dann sieht alles nach einem Betrieb aus. |
| 6 | Schlussseite | Schick das jemandem, der gerade einen Flyer gestaltet. |

Vorlage: Gut-gegen-schlecht als selbst gesetztes Beispiel (Flyer „Schreinerei Muster“ mit vier Schriften neben derselben Seite mit zwei).

**Caption:**
Vier Schriften auf einem Flyer? Zwei reichen.

Die meisten Betriebe sind über die Jahre gewachsen. Das Logo hat mal ein Bekannter gemacht, die Visitenkarte kam aus einem Baukasten, der Flyer entstand in Word. Jedes Stück für sich ist in Ordnung. Nebeneinander sehen sie aus wie drei verschiedene Firmen.

Ein schneller Hebel ist die Schrift. Jede neue Schrift ist eine neue Stimme, und zu viele Stimmen klingen nach Durcheinander.

Zum Mitnehmen: Leg dich auf zwei Schriften fest, eine für Überschriften, eine für den Text. Unterschiede machst du mit Größe und Stärke. Und nimm dieselben zwei überall, auf Flyer, Visitenkarte und Website.

Folge @vamela.de für Gestaltungsregeln, die du ohne Grafikprogramm umsetzen kannst.

Wie viele Schriften stecken in deinem letzten Flyer?

**Hashtags:** #grafikdesign #typografie #flyer #kleinunternehmen #freising

## Karussell 4: Die Kategorie im Google-Profil
- Säule: tipps
- Hook-Stil: frage
- Angebot: keins
- Mehrwert: Du weißt, wie du die Hauptkategorie in deinem Google-Profil so genau wählst, dass du bei passenden Suchen dabei bist.
- Motiv: a tidy wooden card cabinet with one drawer glowing orange and a small owl sorting index cards, white background
- Familie: tag

| Seite | Vorlage | Text |
|---|---|---|
| 1 | Cover | **Welche Hauptkategorie hat dein Google-Eintrag? So wählst du richtig.** |
| 2 | Textseite | Bei Suchen in deiner Nähe zeigt Google oben eine Karte mit drei Einträgen. |
| 3 | Textseite | Diese Plätze kommen aus Unternehmensprofilen, nicht aus Websites. Die Hauptkategorie entscheidet, bei welchen Suchen du dabei bist. |
| 4 | Textseite | Wähl sie so genau wie möglich. Gartenpflege ist „Gartenbauunternehmen“, nicht „Bauunternehmen“. |
| 5 | Textseite | Weitere Leistungen kommen in die Nebenkategorien. Die Hauptkategorie bleibt das, womit du am meisten verdienst. |
| 6 | Schlussseite | Speichere dir das und schau heute in dein Profil. |

**Caption:**
Welche Hauptkategorie hat dein Google-Eintrag? So wählst du richtig.

Bei lokalen Suchen zeigt Google über den normalen Ergebnissen eine Karte mit drei Einträgen. Diese Plätze werden aus Unternehmensprofilen gefüllt, nicht aus Websites. Wer dort erscheint, wird gesehen, bevor überhaupt eine Website in Sicht kommt. Und der Eintrag kostet nichts.

Die wichtigste Einzelentscheidung im Profil ist die Hauptkategorie. Sie bestimmt, bei welchen Suchen du überhaupt in Frage kommst. Zu breite Kategorien führen dazu, dass Google dich bei den passenden Suchen nicht berücksichtigt.

Zum Mitnehmen: Öffne heute dein Profil und prüf die Hauptkategorie. Ein Betrieb, der überwiegend Gartenpflege macht, wählt „Gartenbauunternehmen“ und nicht „Bauunternehmen“. Weitere Leistungen gehören in die Nebenkategorien.

Folge @vamela.de für kurze Tipps zu Google-Profil, Website und Bewertungen.

Welche Kategorie steht bei dir gerade drin?

**Hashtags:** #googleprofil #lokalesseo #handwerk #freising #erding

## Karussell 5: Wohin mit dem Bewertungs-Code
- Säule: werkzeuge
- Hook-Stil: liste
- Angebot: Werkzeug
- Werkzeug: /google-bewertung-qr-code
- Mehrwert: Du hast drei konkrete Orte, an denen Kunden deinen Bewertungs-QR-Code im richtigen Moment sehen.
- Motiv: a small ceramic stand on a shop counter next to a coffee cup and a folded receipt, soft orange light
- Familie: tag

| Seite | Vorlage | Text |
|---|---|---|
| 1 | Cover | **Drei Orte für deinen Bewertungs-Code.** |
| 2 | Textseite | An der Theke oder Kasse. Dort, wo Kunden kurz warten und zufrieden sind. |
| 3 | Textseite | Auf der Rechnung. Wer gerade bezahlt hat, erinnert sich gut an deine Arbeit. |
| 4 | Textseite | An der Tür als Aufkleber. Der Code öffnet direkt das Bewertungsfenster deines Betriebs. |
| 5 | Textseite | Frag trotzdem persönlich, am besten direkt nach der Arbeit. Der Code macht es nur leichter. |
| 6 | Schlussseite | Den Bewertungs-QR-Code mit Aufsteller baust du gratis auf vamela.de. Link in der Bio. |

**Caption:**
Drei Orte für deinen Bewertungs-Code: Theke, Rechnung, Tür.

Ein Bewertungs-QR-Code bringt Kunden mit einem Scan zu dem Fenster, in dem sie deinen Betrieb bei Google bewerten. Kein Suchen, kein Tippen. Den passenden Link liefert dein Google-Unternehmensprofil unter „Rezensionen erhalten“.

Der Code ersetzt das Fragen nicht. Frag direkt nach der abgeschlossenen Arbeit, wenn die Zufriedenheit am höchsten ist. Der Code macht nur den nächsten Schritt leicht. Bewertungen kaufen oder mit Rabatten belohnen verstößt gegen die Richtlinien von Google, das lässt du besser.

Zum Mitnehmen: Such dir heute einen der drei Orte aus und häng dort deinen Code auf.

Das Werkzeug auf vamela.de macht aus deinem Link einen Code und eine druckfertige Vorlage, als Aufsteller, Karte oder Aufkleber. Kostenlos, ohne Anmeldung, ohne Abo. Link in der Bio.

Folge @vamela.de für Gratis-Werkzeuge, die kleine Betriebe wirklich brauchen.

Wo würde dein Code am meisten bringen?

**Hashtags:** #googlebewertungen #qrcode #kleinunternehmen #gastronomie #erding

## Karussell 6: Der QR-Code in der Ecke
- Säule: design
- Hook-Stil: mythos
- Angebot: keins
- Mehrwert: Du kannst mit einer Faustregel ausrechnen, wie groß dein QR-Code auf Flyer, Aufsteller oder Tür sein muss.
- Motiv: a tape measure wrapped around a stack of flyers next to a magnifying glass, orange and white
- Familie: tag

| Seite | Vorlage | Text |
|---|---|---|
| 1 | Cover | **„Der QR-Code passt schon in die Ecke.“ / Die Größenregel** |
| 2 | Textseite | Zu klein gedruckt scheitert der Code an der Handykamera. Unter 2 × 2 cm wird es unzuverlässig. |
| 3 | Textseite | Faustregel: Kantenlänge etwa ein Zehntel des Leseabstands. Aus zwei Metern also rund 20 cm. |
| 4 | Textseite | Je mehr im Code steckt, desto feiner das Muster. Eine Kontaktkarte braucht mehr Platz als ein Link. |
| 5 | Textseite | Rundherum gehört ein freier Rand, die Ruhezone. Text oder Linien direkt am Code stören die Kamera. |
| 6 | Schlussseite | Speichere dir die Faustregel für deinen nächsten Flyer. |

Vorlage: Gut-gegen-schlecht als selbst gesetztes Beispiel (Flyer mit winzigem Code in der Ecke neben dem richtig großen Code mit Ruhezone).

**Caption:**
„Der QR-Code passt schon in die Ecke.“ Leider oft nicht. Hier ist die Größenregel.

Zu klein gedruckt scheitert der Code an der Handykamera, zu groß frisst er den halben Flyer. Die richtige Größe hängt an zwei Dingen: wie weit weg gescannt wird und wie viel im Code steckt.

Als Richtwerte für einen kurzen Link: Visitenkarte 2 bis 2,5 cm, Flyer 2,5 bis 3,5 cm, Tischaufsteller 4 bis 6 cm, Aushang A4 an der Tür 8 bis 12 cm. Unter 2 × 2 cm wird es auch aus der Nähe unzuverlässig.

Zum Mitnehmen: Kantenlänge etwa ein Zehntel des Leseabstands, und rundherum ein freier Rand. Vor dem Druck einmal in Originalgröße ausdrucken und mit zwei Handys testen, einem neuen und einem älteren.

Folge @vamela.de für Gestaltungsregeln, die du ohne Grafikprogramm umsetzen kannst.

Wie groß ist der Code auf deinem Flyer?

**Hashtags:** #qrcode #grafikdesign #flyer #druck #freising

## Karussell 7: Bewertungen kommen nicht von allein
- Säule: tipps
- Hook-Stil: provokation
- Angebot: keins
- Mehrwert: Du weißt, wann du nach Google-Bewertungen fragst, wie du den Bewertungslink verschickst und wie du auf Bewertungen antwortest.
- Motiv: a friendly golden retriever carrying a card with five stars in its mouth, plain orange background
- Familie: tag

| Seite | Vorlage | Text |
|---|---|---|
| 1 | Cover | **Gute Arbeit allein bringt dir keine Google-Bewertungen. / Vier Handgriffe** |
| 2 | Textseite | Zufriedene Kunden denken selten von selbst daran. Du musst fragen. |
| 3 | Textseite | Frag direkt nach der abgeschlossenen Arbeit. Da ist die Zufriedenheit am höchsten. |
| 4 | Textseite | Schick den direkten Bewertungslink per Nachricht. Je weniger Klicks, desto eher klappt es. |
| 5 | Textseite | Antworte auf jede Bewertung, auch auf kritische. Sachlich und ohne dich zu rechtfertigen. |
| 6 | Schlussseite | Schreib in die Kommentare: Wie fragst du bisher nach Bewertungen? |

**Caption:**
Gute Arbeit allein bringt dir keine Google-Bewertungen. Diese vier Handgriffe schon.

Anzahl, Durchschnitt und Aktualität deiner Bewertungen wirken auf deinen Platz in der Kartenübersicht und noch stärker auf die Entscheidung der Leute, die dich dort finden. Zufriedene Kunden denken trotzdem selten von selbst daran.

Also frag aktiv, direkt nach abgeschlossener Arbeit, wenn die Zufriedenheit am höchsten ist. Am einfachsten mit dem direkten Bewertungslink, den du per Nachricht schickst. Und antworte auf jede Bewertung, auch auf kritische, sachlich und ohne Rechtfertigung.

Bewertungen kaufen oder mit Rabatten belohnen verstößt gegen die Richtlinien von Google. Das ist es nicht wert.

Zum Mitnehmen: Schreib dir heute eine kurze Nachricht mit deinem Bewertungslink als Vorlage ins Handy. Dann ist sie nach dem nächsten Auftrag in zehn Sekunden verschickt.

Folge @vamela.de für kurze Tipps zu Google-Profil, Website und Bewertungen.

Wie fragst du bisher nach Bewertungen?

**Hashtags:** #googlebewertungen #kleinunternehmen #handwerk #gastronomie #landkreisfreising

## Karussell 8: WLAN ohne Abtippen
- Säule: werkzeuge
- Hook-Stil: frage
- Angebot: Werkzeug
- Werkzeug: /wlan-qr-code
- Mehrwert: Du kannst einen WLAN-QR-Code mit Aufsteller erstellen, damit Gäste ohne Abtippen ins Netz kommen.
- Motiv: a cozy cafe table at night with a small standing card and wifi waves rising from a coffee cup, warm orange glow
- Familie: nacht

| Seite | Vorlage | Text |
|---|---|---|
| 1 | Cover | **Gäste fragen ständig nach dem WLAN? Ein Code erspart das.** |
| 2 | Textseite | Ein WLAN-QR-Code enthält Netzwerkname und Passwort. Gäste scannen und sind verbunden. |
| 3 | Textseite | Aktuelle iPhones und Android-Handys erkennen das mit der Kamera. Abtippen fällt weg. |
| 4 | Textseite | Das Passwort bleibt in deinem Browser. Es wird beim Erstellen nirgendwohin gesendet. |
| 5 | Textseite | Dazu gibt es einen fertigen Aufsteller. Für die Theke, das Wartezimmer oder die Ferienwohnung. |
| 6 | Schlussseite | Den WLAN-QR-Code machst du kostenlos auf vamela.de. Link in der Bio. |

**Caption:**
Gäste fragen ständig nach dem WLAN? Ein Code erspart das.

Ein WLAN-QR-Code enthält Netzwerkname, Passwort und Verschlüsselung in einem festen Format. Aktuelle iPhones und Android-Handys erkennen das mit der Kamera und bieten direkt an, sich zu verbinden. Kein Zettel mit Tippfehlern, kein Buchstabieren an der Theke.

Beim Werkzeug auf vamela.de entsteht der Code im Browser. Name und Passwort werden nicht übertragen.

Zum Mitnehmen: Stell den Code dort auf, wo Gäste warten, an der Theke, im Wartezimmer oder in der Ferienwohnung. Wer nicht scannen kann, findet Netz und Passwort auf dem Aufsteller auch als Text.

Den WLAN-QR-Code mit fertigem Aufsteller gibt es kostenlos, ohne Anmeldung. Link in der Bio.

Folge @vamela.de für Gratis-Werkzeuge, die kleine Betriebe wirklich brauchen.

Wo hängt bei dir gerade das WLAN-Passwort?

**Hashtags:** #gastronomie #ferienwohnung #qrcode #freising #moosburg

## Karussell 9: Das Logo im Profilbild
- Säule: design
- Hook-Stil: kontrast
- Angebot: keins
- Mehrwert: Du weißt, wie du eine quadratische Fassung deines Logos anlegst, die auch rund zugeschnitten lesbar bleibt.
- Motiv: a long wooden plank squeezed into a round porthole window next to a small round emblem that fits perfectly, orange and white
- Familie: tag

| Seite | Vorlage | Text |
|---|---|---|
| 1 | Cover | **Auf dem Briefkopf top, im Profilbild unlesbar. / Die Profilbild-Fassung** |
| 2 | Textseite | Profilbilder werden fast überall rund oder quadratisch zugeschnitten. Ein breites Logo mit Schriftzug wird darin winzig. |
| 3 | Textseite | Besser ist eine eigene quadratische Fassung. Zum Beispiel nur das Zeichen auf deiner Hausfarbe. |
| 4 | Textseite | Lass etwas Rand, damit beim runden Zuschnitt nichts abgeschnitten wird. |
| 5 | Textseite | Für Instagram, WhatsApp und Google lädst du PNG oder JPG hoch. Etwa 1000 × 1000 Pixel reichen überall. |
| 6 | Schlussseite | Speichere dir das, bevor du dein Profilbild wechselst. |

Vorlage: Gut-gegen-schlecht als selbst gesetztes Beispiel (breiter Schriftzug „Muster Holzbau“ im Kreis gegen das Bildzeichen allein).

**Caption:**
Auf dem Briefkopf top, im Profilbild unlesbar. So baust du die Profilbild-Fassung.

Instagram, Facebook, WhatsApp Business und das Google-Unternehmensprofil schneiden Profilbilder rund oder quadratisch zu. Ein breites Logo mit Schriftzug wird darin winzig, und keiner kann den Namen lesen.

Besser ist eine eigene quadratische Fassung mit etwas Rand, zum Beispiel nur das Zeichen auf deiner Hausfarbe. Diese Plattformen nehmen kein SVG, hier lädst du PNG oder JPG hoch. Mit etwa 1000 × 1000 Pixeln bist du überall auf der sicheren Seite.

Zum Mitnehmen: Schau dir dein Profilbild heute einmal am Handy in der Kommentarspalte an, so klein, wie andere es sehen. Lesbar?

Folge @vamela.de für Gestaltungsregeln, die du ohne Grafikprogramm umsetzen kannst.

Wie sieht dein Logo im Profilbild aus?

**Hashtags:** #logodesign #grafikdesign #branding #kleinunternehmen #erding

## Karussell 10: Eine Nummer, ein Name
- Säule: tipps
- Hook-Stil: vorher-nachher
- Angebot: Entwurf
- Mehrwert: Du kannst Name, Adresse und Telefonnummer deines Betriebs im Netz finden und überall auf denselben Stand bringen.
- Motiv: three old rotary telephones on a shelf, only one connected with a glowing orange cable, white background
- Familie: tag

| Seite | Vorlage | Text |
|---|---|---|
| 1 | Cover | **Drei Nummern im Netz, eine stimmt. So räumst du auf.** |
| 2 | Textseite | Name, Adresse und Telefonnummer müssen überall zeichengenau gleich sein. Auf Website, Google-Profil und Rechnung. |
| 3 | Textseite | Vorher: „Schreinerei Muster“ im Profil, „Muster Holzbau“ auf der Website. Nachher: überall der Name vom Schild. |
| 4 | Textseite | Vorher: alte Handynummer im Branchenbuch. Nachher: eine Nummer, die überall gleich und immer erreichbar ist. |
| 5 | Textseite | Pflege auch die Öffnungszeiten, besonders an Feiertagen. Profile ohne Pflege stuft Google zurück. |
| 6 | Schlussseite | Willst du sehen, wie deine Seite sauber aussehen könnte? Den ersten Entwurf gibt es kostenlos, Link in der Bio. |

**Caption:**
Drei Nummern im Netz, eine stimmt. So räumst du auf.

Name, Adresse und Telefonnummer müssen zwischen Google-Profil, Website und allen anderen Einträgen zeichengenau übereinstimmen. Abweichende Angaben gehören zu den Fehlern, die bei fast jedem vernachlässigten Profil auftauchen und Sichtbarkeit kosten. Genauso fehlende oder falsche Öffnungszeiten, besonders an Feiertagen.

Zum Mitnehmen: Such heute deinen Betriebsnamen bei Google und schreib dir auf, welcher Name, welche Adresse und welche Nummer wo steht. Alles, was abweicht, bringst du auf den Stand vom Schild an deiner Tür.

Wenn deine Website gleich mit aufgeräumt werden soll: Den ersten Entwurf deiner Startseite baue ich dir kostenlos, nach zwei bis drei Tagen als Link im Browser. Gefällt er dir nicht, sagst du ab, es kostet nichts. Link in der Bio.

Folge @vamela.de für kurze Tipps zu Google-Profil, Website und Bewertungen.

Wie viele Versionen deiner Telefonnummer findest du im Netz?

**Hashtags:** #lokalesseo #googleprofil #kleinunternehmen #freising #moosburg

## Karussell 11: Vom Logo-Foto zur Vektordatei
- Säule: werkzeuge
- Hook-Stil: vorher-nachher
- Angebot: Werkzeug
- Werkzeug: /vektorisieren
- Mehrwert: Du kannst ein unscharfes Logo-JPG kostenlos in eine Vektordatei für Druckerei, Folie und Plotter umwandeln.
- Motiv: a fox sculpture made of rough cubes turning into a smooth polished fox, white studio background with orange light
- Familie: tag

| Seite | Vorlage | Text |
|---|---|---|
| 1 | Cover | **Vom unscharfen Logo-JPG zur sauberen Vektordatei.** |
| 2 | Textseite | Vorher: Das Logo gibt es nur als kleines JPG. Auf dem Transporter wird es pixelig. |
| 3 | Textseite | Eine Vektorgrafik beschreibt das Bild als Flächen und Kurven. Deshalb bleibt sie in jeder Größe scharf. |
| 4 | Textseite | Das Werkzeug zeichnet dein Bild nach und übernimmt die Farben des Originals. Das Bild verlässt dabei nie deinen Browser. |
| 5 | Textseite | Nachher: SVG fürs Web, PDF für die Druckerei, DXF für Laser und Plotter. |
| 6 | Schlussseite | Probier es mit deinem Logo, gratis und ohne Anmeldung. Link in der Bio. |

**Caption:**
Vom unscharfen Logo-JPG zur sauberen Vektordatei.

Viele Betriebe haben ihr Logo nur noch als kleines Bild. Für die Website reicht das vielleicht, für Transporter, Schild oder Folie nicht. Pixelbilder werden beim Vergrößern unscharf, Vektorgrafiken nicht, weil sie das Bild als Flächen und Kurven beschreiben.

Das Werkzeug auf vamela.de zeichnet dein Bild automatisch nach und übernimmt die Farben des Originals. Danach nimmst du es als SVG, PDF, EPS, DXF oder PNG mit. Das Bild verlässt dabei nie deinen Browser.

Zum Mitnehmen: Frag deine Druckerei oder Werbetechnik, welches Format sie will, bevor du etwas schickst. Für den Druck ist es meist PDF, für Folie SVG oder EPS, für Laser und Plotter DXF.

Bild vektorisieren auf vamela.de ist kostenlos und ohne Anmeldung. Link in der Bio.

Folge @vamela.de für Gratis-Werkzeuge, die kleine Betriebe wirklich brauchen.

In welchem Format liegt dein Logo gerade?

**Hashtags:** #logo #vektorgrafik #werbetechnik #handwerk #grafikdesign

## Karussell 12: Bildschirmfarben in der Druckerei
- Säule: design
- Hook-Stil: fehler
- Angebot: keins
- Mehrwert: Du weißt, warum Bildschirmfarben im Druck anders aussehen, und legst deine Hausfarben in RGB und CMYK fest.
- Motiv: a glowing orange light bulb next to a matte paper swatch of the same orange on a white table
- Familie: tag

| Seite | Vorlage | Text |
|---|---|---|
| 1 | Cover | **Du schickst der Druckerei Bildschirmfarben? / So stimmen sie gedruckt** |
| 2 | Textseite | Bildschirme mischen Farben aus Licht, RGB. Druckereien mischen sie aus Farbe auf Papier, CMYK. |
| 3 | Textseite | Leuchtende Bildschirmfarben lassen sich im Druck oft nicht genau treffen. Gedruckt wirken sie dann matter. |
| 4 | Textseite | Leg deine Hausfarben deshalb zweimal fest: einmal in RGB, einmal in CMYK. |
| 5 | Textseite | Schreib die Werte in eine kleine Übersicht. Dann benutzen Website, Flyer und Folie dieselbe Farbe. |
| 6 | Schlussseite | Teile das mit der Person, die bei euch die Flyer macht. |

Vorlage: Gut-gegen-schlecht als selbst gesetztes Beispiel (eine Farbfläche mit nur einem HEX-Wert gegen dieselbe Fläche mit HEX, RGB und CMYK darunter).

**Caption:**
Du schickst der Druckerei Bildschirmfarben? So stimmen sie gedruckt.

Sonst kommt der Flyer anders zurück, als du ihn am Bildschirm gesehen hast.

Bildschirme mischen Farben aus Licht, das heißt RGB. Druckereien mischen sie aus Farbe auf Papier, das heißt CMYK. Leuchtende Bildschirmfarben lassen sich im Druck oft nicht genau treffen.

Zum Mitnehmen: Leg deine Hausfarben zweimal fest, einmal in RGB für Website und Social Media, einmal in CMYK für alles Gedruckte. Schreib die Werte in eine kleine Übersicht und gib sie jedem, der für deinen Betrieb etwas gestaltet. Dann benutzen alle dieselbe Farbe.

Folge @vamela.de für Gestaltungsregeln, die du ohne Grafikprogramm umsetzen kannst.

Kennst du die Farbwerte deines Logos?

**Hashtags:** #grafikdesign #druck #farben #kleinunternehmen #freising

## Karussell 13: Pixelfoto in groß
- Säule: fundstuecke
- Hook-Stil: vorher-nachher
- Angebot: keins
- Repo: upscayl/upscayl
- Lizenz: AGPL-3.0
- Sterne: rund 50.000 (Stand 12.10.2026)
- Mehrwert: Du kannst kleine, pixelige Fotos mit einer freien App auf dem eigenen Rechner vergrößern und weißt, welche Grafikkarte du dafür brauchst.
- Motiv: a tiny pixelated photo print growing into a large crisp poster on a wall, a small fox holding a magnifying glass, orange and white
- Familie: tag

| Seite | Vorlage | Text |
|---|---|---|
| 1 | Cover | **Vom kleinen Pixelfoto zum großen Bild, mit einer freien App.** |
| 2 | Textseite | Vorher: Das Produktfoto gibt es nur in klein. Groß gedruckt wird es pixelig. |
| 3 | Textseite | Upscayl rechnet kleine Bilder mit KI größer. Die App ist frei und läuft unter Windows, macOS und Linux. |
| 4 | Textseite | Du brauchst eine Grafikkarte mit Vulkan-Unterstützung. Viele eingebaute Grafikchips reichen laut Entwicklern nicht. |
| 5 | Textseite | Nachher: dasselbe Bild in groß. |
| 6 | Schlussseite | Speicher dir den Beitrag. Auf GitHub findest du die App unter upscayl/upscayl. |

**Caption:**
Vom kleinen Pixelfoto zum großen Bild, mit einer freien App.

Upscayl ist ein freies Open-Source-Programm, das kleine Bilder mit KI vergrößert und verbessert. Es läuft unter Windows, macOS und Linux. Praktisch, wenn es von einem Produkt oder einem alten Flyer-Motiv nur noch eine kleine Fassung gibt.

Eine Grenze nennen die Entwickler selbst: Du brauchst eine Grafikkarte mit Vulkan-Unterstützung, viele eingebaute Grafikchips reichen nicht.

Zum Mitnehmen: Nimm dein kleinstes Produktfoto und probier es aus, bevor du neu fotografierst. Für dein Logo bleibt eine Vektordatei trotzdem die bessere Wahl.

Repo: github.com/upscayl/upscayl · Lizenz: AGPL-3.0 · rund 50.000 Sterne auf GitHub (Stand 12.10.2026). Die App gibt es über die Releases auf GitHub oder auf upscayl.org.

Folge @vamela.de für freie Werkzeuge, die dir im Betrieb Arbeit abnehmen.

Welches Foto würdest du als Erstes vergrößern?

**Hashtags:** #opensource #fotografie #grafikdesign #kleinunternehmen #freising

## Karussell 14: Fotos ohne Kabel rüberschicken
- Säule: fundstuecke
- Hook-Stil: kontrast
- Angebot: keins
- Repo: localsend/localsend
- Lizenz: Apache-2.0
- Sterne: rund 94.000 (Stand 12.10.2026)
- Mehrwert: Du kannst Fotos und Dateien im eigenen WLAN zwischen Handy und Rechner verschicken, ohne Kabel, Cloud oder Mail an dich selbst.
- Motiv: a carrier pigeon carrying a small folder from a smartphone to a laptop across a bright orange sky
- Familie: tag

| Seite | Vorlage | Text |
|---|---|---|
| 1 | Cover | **Fotos vom Handy auf den PC: ohne Kabel, ohne Cloud.** |
| 2 | Textseite | Baustellenfotos per Mail an dich selbst? Das geht auch direkt von Gerät zu Gerät. |
| 3 | Textseite | LocalSend ist eine freie App. Sie schickt Dateien und Nachrichten an Geräte im selben Netz, ohne Internet. |
| 4 | Textseite | Es läuft auf Windows, macOS, Linux, Android und iOS. Die Daten gehen verschlüsselt und ohne fremden Server. |
| 5 | Textseite | Finden sich die Geräte nicht, prüf das WLAN: Im Gästenetz sind Geräte oft voneinander abgeschirmt. |
| 6 | Schlussseite | Speicher dir das für den nächsten Fototag. Auf GitHub: localsend/localsend. |

**Caption:**
Fotos vom Handy auf den PC: ohne Kabel, ohne Cloud.

Viele schicken sich Baustellenfotos, Lieferscheine oder Bilder für die Website per Mail an sich selbst. LocalSend geht direkter: Die freie Open-Source-App schickt Dateien und Nachrichten an Geräte in der Nähe, über dein eigenes Netz und ohne Internetverbindung. Die Übertragung läuft verschlüsselt über HTTPS, ohne fremde Server dazwischen.

Es gibt LocalSend für Windows, macOS, Linux, Android und iOS. Die Entwickler empfehlen, die App aus dem App-Store oder einer Paketverwaltung zu laden, weil sie sich nicht selbst aktualisiert.

Zum Mitnehmen: Installier die App heute auf Handy und Büro-Rechner und schick ein Testfoto. Finden sich die Geräte nicht, kann das am Gäste-WLAN liegen, das Geräte voneinander abschirmt. Dann beide ins normale Netz.

Repo: github.com/localsend/localsend · Lizenz: Apache-2.0 · rund 94.000 Sterne auf GitHub (Stand 12.10.2026).

Folge @vamela.de für freie Werkzeuge, die dir im Betrieb Arbeit abnehmen.

Wie kommen deine Fotos bisher vom Handy auf den Rechner?

**Hashtags:** #opensource #handwerk #kleinunternehmen #selbstständig #erding

## Karussell 15: Frag deine PDFs
- Säule: fundstuecke
- Hook-Stil: frage
- Angebot: keins
- Repo: Mintplex-Labs/anything-llm
- Lizenz: MIT
- Sterne: rund 67.000 (Stand 12.10.2026)
- Mehrwert: Du kannst mit einer freien Desktop-App Fragen an deine eigenen PDFs und Word-Dateien stellen, standardmäßig lokal auf deinem Rechner.
- Motiv: a small friendly robot reading a tall stack of paper documents under a glowing desk lamp, dark room with warm orange glow
- Familie: nacht

| Seite | Vorlage | Text |
|---|---|---|
| 1 | Cover | **Was steht nochmal im Wartungsvertrag? Frag einfach deine PDFs.** |
| 2 | Textseite | AnythingLLM ist eine freie Desktop-App für Windows, macOS und Linux. Du lädst Dokumente hinein und stellst Fragen dazu. |
| 3 | Textseite | Sie liest PDF, Word-Dateien und Text. Die Antworten zeigen, aus welchem Dokument sie stammen. |
| 4 | Textseite | Standardmäßig läuft alles lokal auf deinem Rechner. Die gehostete Fassung und Cloud-Modelle externer Anbieter können Geld kosten. |
| 5 | Textseite | Du kannst auch mehrere Nutzer anlegen und Zugriffe regeln. Das gibt es nur in der Docker-Version. |
| 6 | Schlussseite | Speicher dir das und probier es mit einer Bedienungsanleitung. Auf GitHub: Mintplex-Labs/anything-llm. |

**Caption:**
Was steht nochmal im Wartungsvertrag? Frag einfach deine PDFs.

AnythingLLM ist eine freie Open-Source-App für Windows, macOS und Linux. Du ziehst Dokumente hinein, zum Beispiel PDFs, Word- oder Textdateien, und stellst Fragen dazu. Die Antworten zeigen, aus welchem Dokument sie stammen. Laut den Entwicklern läuft die App standardmäßig lokal auf deinem Rechner.

Gut zu wissen: Du kannst auch Cloud-Modelle großer Anbieter anbinden. Neben der freien App gibt es eine gehostete Fassung der Entwickler. Sie und die Cloud-Modelle externer Anbieter können Geld kosten, die Preise schaust du dir dort an. Mehrere Nutzer mit Zugriffsrechten gibt es nur in der Docker-Version.

Zum Mitnehmen: Fang mit einem harmlosen Dokument an, etwa der Bedienungsanleitung einer Maschine, und frag nach einer Einstellung, die du sonst lange suchen müsstest.

Repo: github.com/Mintplex-Labs/anything-llm · Lizenz: MIT · rund 67.000 Sterne auf GitHub (Stand 12.10.2026).

Folge @vamela.de für freie Werkzeuge, die dir im Betrieb Arbeit abnehmen.

Welche Unterlage würdest du als Erstes fragen?

**Hashtags:** #opensource #ki #kleinunternehmen #selbstständig #landkreisfreising

## Karussell 16: Entwürfe mit Code
- Säule: fundstuecke
- Hook-Stil: liste
- Angebot: keins
- Repo: penpot/penpot
- Lizenz: MPL-2.0
- Sterne: rund 61.000 (Stand 12.10.2026)
- Mehrwert: Du weißt, wie du Website-Entwürfe im Browser gemeinsam bearbeitest und den CSS-, SVG- und HTML-Code direkt aus dem Entwurf abliest.
- Motiv: a voxel-style workshop at night where small glowing orange blocks assemble into a website layout on a floating screen
- Familie: nacht

| Seite | Vorlage | Text |
|---|---|---|
| 1 | Cover | **Drei Gründe, deine nächste Website in Penpot zu entwerfen.** |
| 2 | Textseite | Penpot ist eine Open-Source-Plattform für Design. Du arbeitest im Browser oder auf deinem eigenen Server. |
| 3 | Textseite | Mehrere Leute bearbeiten denselben Entwurf gleichzeitig. Kunde und Webdesigner schauen also auf dieselbe Fassung. |
| 4 | Textseite | Im Reiter „Inspect“ liest du den Code ab. Penpot zeigt dort SVG, CSS und HTML zum Entwurf. |
| 5 | Textseite | Flex- und Grid-Layouts verhalten sich wie später auf der Website. Dein Entwurf bricht so um wie die echte Seite. |
| 6 | Schlussseite | Speicher dir das für dein nächstes Projekt. Auf GitHub: penpot/penpot. |

**Caption:**
Drei Gründe, deine nächste Website in Penpot zu entwerfen.

Penpot ist eine Open-Source-Plattform für Design. Du nutzt sie im Browser oder installierst sie auf einem eigenen Server. Sie arbeitet mit offenen Standards wie SVG, CSS und HTML.

Mehrere Leute können denselben Entwurf gleichzeitig bearbeiten. Im Reiter „Inspect“ stehen SVG, CSS und HTML zum Entwurf, zum Übernehmen in die Umsetzung. Und mit Flex- und Grid-Layouts verhält sich der Entwurf schon so wie später die echte Seite.

Zu den Kosten: Die Software ist Open Source.

Zum Mitnehmen: Leg deinen nächsten Entwurf in Penpot an und lies Farben und Abstände im Reiter „Inspect“ als CSS ab, statt sie zu schätzen.

Repo: github.com/penpot/penpot · Lizenz: MPL-2.0 · rund 61.000 Sterne auf GitHub (Stand 12.10.2026).

Folge @vamela.de für freie Werkzeuge, die dir im Betrieb Arbeit abnehmen.

Womit entwirfst du deine Websites bisher?

**Hashtags:** #opensource #webdesign #grafikdesign #uxdesign #freising
