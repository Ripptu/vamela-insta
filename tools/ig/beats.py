#!/usr/bin/env python3
"""
beats.py - legt den Sprechtext eines VAMELA-Reels als Beat-Tabelle mit Zeiten an,
bevor die KI-Stimme aufnimmt, und prüft die festen Reel-Regeln des Projekts.

Ein Beat ist ein Satz. Die Automatik schneidet hart auf jeden Satz und legt je
Satz eine Szene an (render/schnitt.mjs). Sätze trennt dieses Werkzeug wie
saetze() in render/orange.mjs, Wörter zählt es wie automatik/reel-regeln.mjs:
durch Leerzeichen getrennt, ohne Akzent-Markup (*wort*, _wort_, ==wort==).

Geprüft wird (FEHLER = die Automatik oder die Projektregeln lehnen das ab):
  Sprechtext 35 bis 60 Wörter, 3 bis 8 Sätze, Satz 1 höchstens 10 Wörter,
  letzter Satz mit Speichern, Folgen, Teilen, Kommentieren oder "Link in der Bio",
  "Link in der Bio" genau dann, wenn ein Angebot dabei ist, keine Webadresse mit
  Pfad, kein Emoji, keine Klammer, nie vamela.info, keine Sie-Form ("Ihnen", groß
  mitten im Satz, "Sie suchen" am Textanfang), kein offener Platzhalter, keine
  Garantie oder Rechtsaussage ("Platz 1 in Google", "abmahnfrei", "sicher mehr
  Kunden"), keine Verknappung, kein Rabatt, kein Streichpreis ("49 € statt 249 €",
  "nur 49 €"). Jeder Betrag, auch ausgeschrieben ("zweihundertneunundvierzig Euro"),
  muss in data/fakten.json unter preise stehen, wie pruefeText() in
  automatik/fakten.mjs. Bei einem Reel-Block zusätzlich Hook-Zeile, Szenen,
  Mehrwert, Motiv und Familie.
Dazu ZEIT (Reel-Länge 15 bis 25 s, Hook-Dauer) und HINWEISE (Loop, Aussprache,
Punch-Zoom, Karten, "Sie" an einem späteren Satzanfang, Preis passt nicht zum
genannten Angebot).

Projektordner (--projekt, ohne Angabe /Users/test/vamela-insta, wenn es ihn gibt)
  data/fakten.json liefert die erlaubten Preise, bilder/vorrat/ die bild:-Szenen.
  Ohne lesbare fakten.json sind Preise ungeprüft, dann meldet beats.py jeden Betrag
  als HINWEIS.

Zeitmodell (Schätzung, keine Messung)
  Tempo 140 Wörter pro Minute reine Sprechzeit (--wpm). Verteilt wird nach Silben,
  ein Wort zählt als zwei Silben: Kurze Wörter gehen schneller, Abkürzungen wie
  "SVG, PDF" spricht die Stimme Buchstabe für Buchstabe. --woerter rechnet nur
  nach Wortzahl. Dazu Satzpause 0,9 s (--pause), Anlauf bis zum ersten Wort 0,2 s
  und Nachlauf 0,5 s (NACHLAUF_S in render/schnitt.mjs).
  Reel-Länge = Anlauf + Sprechzeit + Satzpausen + Nachlauf.
  --wpm ist das Tempo OHNE Pausen. Wer ein Tempo inklusive Pausen hat (Wörter
  durch Gesamtdauer), gibt es mit --pause 0 an.
  "vamela.de" geht als "Fameela Punkt D E" an die Stimme und wird so gerechnet.

  Herkunft der Werte: die zwei Aufnahmen der Stimme Sterling im Projekt,
  stimme/r01.woerter.json (Reel 1, 6 Sätze) und out/test-r01-probe/.woerter.json
  (3 Sätze), nachgemessen mit --wortzeiten am 06.11.2026. Reine Sprechzeit dort
  147 bzw. 167 Wörter pro Minute, Satzpausen 0,56 bis 1,16 s (Mittel 0,90 s),
  erstes Wort nach 0,14 bzw. 0,28 s. Nach Silben gerechnet ergeben beide 142 bzw.
  141 Wörter pro Minute. Je Satz lag das Silbenmodell im Mittel 11 bzw. 10 %
  daneben, das reine Wortmodell 28 bzw. 31 %. Für Reel 1 schätzt das Modell
  26,0 s, gemessen sind 25,7 s Ton plus 0,5 s Nachlauf, also 26,2 s. Zwei
  Aufnahmen sind keine Statistik: Nach jeder neuen Aufnahme nachmessen,
      python3 -I beats.py --wortzeiten stimme/<id>.woerter.json
  und --wpm und --pause nachziehen.

Aufruf (python3 -I, nur Standardbibliothek, kein Netz)
  python3 -I beats.py skript.txt                # Sprechtext, ein Satz je Zeile oder am Stück
  python3 -I beats.py block.md                  # Reel-Block mit "- Sprechtext:" und "**Szenen**"
  python3 -I beats.py docs/content-reels.md     # alle "## Reel N:" einer Vorratsdatei
  python3 -I beats.py --text "Satz eins. Satz zwei. Speicher dir das." --angebot keins
  python3 -I beats.py skript.txt --wpm 150 --pause 0.8 --angebot werkzeug
  python3 -I beats.py skript.txt --stimmentext  # Text, wie er an die Stimme geht
  python3 -I beats.py --wortzeiten stimme/r01.woerter.json   # Schätzung gegen Aufnahme
  python3 -I beats.py block.md --wortzeiten stimme/r01.woerter.json --json
                         # ein JSON-Objekt {"reels": [Analyse je Reel], "messung": {...}}
  pbpaste | python3 -I beats.py -
  --json gibt ohne --wortzeiten ein Objekt (ein Reel) oder eine Liste aus, mit
  Eingabe und --wortzeiten genau ein Objekt wie oben.
  Ausgang 0 = kein FEHLER (ZEIT-Warnungen möglich), 1 = mindestens ein FEHLER,
  2 = leere oder unlesbare Eingabe, unlesbare Wortzeiten oder Projektordner fehlt.
  Die Wortzeiten werden vor der Analyse gelesen: Sind sie kaputt, gibt es keinen
  halben Bericht.
"""

import argparse
import collections
import json
import math
import os
import re
import sys
import unicodedata

# ------------------------------------------------------------------ feste Regeln des Projekts
# automatik/reel-regeln.mjs (SPRECH), render/reel.mjs (DAUER), render/schnitt.mjs, render/orange.mjs
WORTE_MIN, WORTE_MAX = 35, 60
SAETZE_MIN, SAETZE_MAX = 3, 8
HOOK_WORTE_MAX = 10              # Satz 1 und Hook-Zeile
HOOK_WORTE_RENDERER = 9          # ab 10 Wörtern meldet render/orange.mjs "Hook zu lang (> 9 Wörter)"
DAUER_MIN, DAUER_MAX = 15.0, 25.0
HOOK_KARTE = 2.1                 # HOOK_S: Hook-Karte steht 0 bis 2,1 s
ENDKARTE = 1.5                   # ENDKARTE_S: Abschlusskarte in den letzten 1,5 s
NACHLAUF = 0.5                   # NACHLAUF_S
AUFNAHMEN_MAX = 2                # Bildschirmaufnahmen je Reel
UNTERTITEL_ZEICHEN = 18          # UT.maxZeichen in render/schnitt.mjs
PROJEKT_STANDARD = "/Users/test/vamela-insta"   # ohne --projekt, wenn es den Ordner gibt

# ------------------------------------------------------------------ Zeitmodell, Standardwerte
WPM = 140.0                      # Wörter pro Minute reine Sprechzeit
SILBEN_JE_WORT = 2.0
PAUSE = 0.9                      # s zwischen zwei Sätzen
ANLAUF = 0.2                     # s bis zum ersten Wort
HOOK_OK = 2.5                    # s: bis hier endet Satz 1 ungefähr mit der Hook-Karte
HOOK_ZU_LANG = 3.5               # s: ab hier ist die Hook-Karte längst weg, wenn der Hook endet
LANGER_SATZ = 6.0                # s: ab hier lohnt es, den Satz zu teilen
SCHLUSS_LANG = 3.0               # s: Schlusssatz deutlich länger als die Abschlusskarte

# ------------------------------------------------------------------ Muster (auch von hookscore.py genutzt)
HANDLUNG_RE = re.compile(r"\b(speicher|folg|teil|kommentier|schreib|link in der bio)", re.IGNORECASE)
LINK_BIO_RE = re.compile(r"link in der bio", re.IGNORECASE)
ADRESSE_RE = re.compile(r"vamela\.de/|https?:|www\.", re.IGNORECASE)
# Annäherung an \p{Extended_Pictographic} (Pythons re kennt die Eigenschaft nicht), dazu Klammern und Punkt-Aufzählung
EMOJI_RE = re.compile("[\U0001F000-\U0001FAFF\u2600-\u27BF\u2B05-\u2B55\u2300-\u23FF\uFE0F\u00A9\u00AE\u203C\u2049\u2122]|[()\u2022]")
INFO_RE = re.compile(r"vamela\.info", re.IGNORECASE)
PLATZHALTER_RE = re.compile(r"\{\{[^}]*\}\}")
HASHTAG_RE = re.compile(r"(?:^|\s)#[^\W_][\w-]*")
SIE_RE = re.compile(r"\b(?:Sie|Ihnen|Ihre[mnrs]?|Ihr)\b")
SATZGRENZE_RE = re.compile("[.!?:/\u2026\u201E\u201C\u201D\"\u00BB\u00AB]$")   # davor endet ein Satz, beginnt ein Zitat oder nach " / " die Unterzeile
_ERFOLG = r"(?:kunden|anfragen|gäste|aufträge|umsatz|besucher|bewertungen|reichweite|follower)"
_RANG = r"(?:platz|rang|position|seite)"
VERSPRECHEN_RE = re.compile(
    r"\b(?:garantiert\w*|(?:erfolgs|geld-zurück-)garantie\w*|garantie\s+(?:auf|für)\s+(?:mehr|erfolg|platz|kunden|anfragen|gäste)|"
    r"rechts(?:sicher|konform)\w*|rechtlich\s+(?:sicher|abgesichert|einwandfrei|wasserdicht)\w*|"
    r"rechtlich\s+auf\s+der\s+sicheren\s+seite|abmahn(?:ungs)?(?:sicher|frei|fest)\w*|(?:dsgvo|datenschutz)-?(?:konform|sicher|fest)\w*|"
    rf"(?:auf\s+)?{_RANG}\s*(?:1|eins)\s+(?:bei|in|auf|unter|von)\s+google|"
    rf"(?:auf\s+)?(?:den\s+|die\s+)?erste[nr]?\s+{_RANG}\s+(?:bei|in|auf|unter|von)\s+google|"
    r"google\W+(?:[\wäöüß-]+\s+){0,3}?(?:auf\s+)?(?:platz|rang|position)\s*(?:1|eins)|"
    r"ganz\s+(?:oben|vorn|vorne)\s+(?:bei|in|auf)\s+google|(?:bei|in|auf)\s+google\s+ganz\s+(?:oben|vorn|vorne)|"
    r"top-?(?:platzierung|ranking)\w*|"
    r"(?:doppelt|dreimal|zehnmal)\s+so\s+viele\s+(?:kunden|anfragen|gäste|aufträge)|"
    rf"mehr\s+{_ERFOLG}\s+garantiert)\b", re.IGNORECASE)
# "bekommst du sicher mehr Kunden"; verneint ("nicht automatisch mehr Kunden") ist es ehrlich, siehe _mehr_versprochen()
MEHR_RE = re.compile(rf"\b(?:sicher|bestimmt|definitiv|automatisch|mit\s+sicherheit)\s+(?:auch\s+)?(?:für\s+)?(?:viel\s+)?"
                     rf"mehr\s+{_ERFOLG}\b", re.IGNORECASE)
VERKNAPPUNG_RE = re.compile(
    r"\b(?:nur\s+noch\s+(?:heute|morgen|diese\s+woche|\d+\s+\w+|(?:ein|zwei|drei)\s+(?:plätze|platz|tage|termine))|"
    r"letzte\s+chance|nur\s+(?:heute|für\s+kurze\s+zeit)|solange\s+der\s+vorrat)\b", re.IGNORECASE)
RABATT_RE = re.compile(r"\b(?:\w*rabatt\w*|\w*aktionspreis\w*|\w*sonderpreis\w*|\w*sonderangebot\w*|einführungspreis\w*|"
                       r"neukundenpreis\w*|preisnachlass\w*|gutschein\w*|\d+\s?(?:%|prozent)\s+(?:günstiger|billiger|weniger|nachlass))\b",
                       re.IGNORECASE)
# Streichpreis und "nur"-Preis, geprüft auf betraege_text() (alle Beträge als "N €", auch ausgeschriebene)
_BETRAG = r"[0-9][0-9.,]*\s?€"
STREICHPREIS_RE = re.compile(
    rf"{_BETRAG}\s*,?\s+(?:statt|anstatt|anstelle\s+von)\s+(?:[\wäöüß-]+\s+){{0,2}}?{_BETRAG}|"
    rf"\b(?:statt|anstatt|anstelle\s+von|früher|regulär|normalerweise|bisher|ursprünglich)\s+(?:nur\s+|noch\s+|ab\s+)?{_BETRAG}|"
    rf"\b(?:nur|bloß|lediglich|schon)\s+(?:noch\s+)?(?:ab\s+|für\s+)?{_BETRAG}", re.IGNORECASE)
HAEUFIGKEIT_RE = re.compile(
    r"\b(?:(?:viele|alle|ständig|dauernd|täglich|oft)\s+(?:fragen|schreiben)\s+mich|"
    r"(?:werde|wurde)\s+(?:ständig|oft|dauernd|täglich|immer\s+wieder)\s+gefragt|"
    r"das\s+(?:fragen|frage)\s+mich\s+(?:alle|viele|ständig|dauernd))\b", re.IGNORECASE)

ENDE_RE = re.compile("[.!?\u2026](?=\\s+[A-ZÄÖÜ\u201E\"0-9*_=])")
ABK_RE = re.compile(r"(^|\s)(z|d|u|o|bzw|ca|Nr|Dr|St|usw|inkl|ggf|evtl|vgl|bspw|[A-ZÄÖÜa-zäöü])\.$")
TOKEN_RE = re.compile(r"[^\W_]+(?:['\u2019][^\W_]+)*")
VOKALE_RE = re.compile(r"[aeiouyäöüéèêáàâóòôúùûíìî]+")
ALS_WORT = {"WLAN": 2, "PIN": 1, "HEX": 1, "GIF": 1, "RAL": 1, "DIN": 1, "LAN": 1, "ISO": 2}
MARKUP_RE = re.compile(r"(\*[^*\n]+\*|_[^_\n]+_|==[^=\n]+==)")
FUELL = {"nicht", "deinen", "deiner", "deinem", "einfach", "herunter", "sondern", "zeichnet", "speicher",
         "schick", "wirklich"}                                   # FUELL in render/schnitt.mjs

# Motiv-Regeln wie pruefeMotiv() in automatik/block-felder.mjs
MARKEN_RE = re.compile(
    r"\b(minecraft|creeper|steve|mario|luigi|nintendo|zelda|pok[eé]mon|pikachu|fortnite|roblox|sonic the hedgehog|"
    r"pac-?man|tetris|lego|disney|pixar|marvel|star wars|playstation|xbox|overwatch|valorant|elden ring|cyberpunk 2077|"
    r"the sims|among us|animal crossing|call of duty|gta|grand theft auto|league of legends|harry potter|hogwarts|mickey|"
    r"batman|spider-?man|superman|barbie|hello kitty|iphone|ipad|macbook|google|microsoft|openai|chatgpt|claude|"
    r"anthropic|instagram|facebook|whatsapp|tiktok|youtube|github|octocat|adobe|photoshop|figma|nvidia|tesla)\b",
    re.IGNORECASE)
PERSON_RE = re.compile(r"\b(person|people|man|men|woman|women|girl|boy|child|children|kid|face|faces|portrait|selfie|"
                       r"human|crowd|businessman|businesswoman)\b", re.IGNORECASE)
VERNEINUNG_RE = re.compile(r"\b(no|without|zero)\s+(visible\s+|recognizable\s+|human\s+)?(people|persons?|faces?|humans?|"
                           r"characters?|figures?|text|letters|words)\b", re.IGNORECASE)
MEHRWERT_RE = re.compile(r"^Du (kannst|weißt|hast|bekommst|erkennst|findest|sparst|vermeidest)\b")
SPRUCH_RE = re.compile(r"\b(Inspiration|inspiriert|Motivation|motiviert|Leidenschaft|große Ideen|Ideen brauchen|Mut zu|"
                       r"Vision|Träume|Herzblut|Qualität, die)\b", re.IGNORECASE)

STOPWOERTER = set("""
der die das den dem des ein eine einen einem einer eines und oder aber doch dann denn weil dass wenn als wie so
zu zum zur im in ins an am auf aus bei beim mit nach von vom vor für über unter durch ohne um nur nicht kein keine
dein deine deinen deinem deiner deines mein meine meinen du dir dich ihr euch ich mir mich wir uns er sie es ist sind
war hat haben wird werden kann können muss musst soll hier da dort jetzt heute schon noch auch sehr ganz mal bitte
dazu dabei damit danach dafür diese dieser dieses diesen was wer wo gibt geht macht man sich sein seine
speicher speichere speichern folg folge folgen teil teile teilen link bio schreib kommentier kommentiere
""".split())


# ------------------------------------------------------------------ Hilfsfunktionen
def zahl(x, stellen=1):
    """Zahl mit Dezimalkomma."""
    return f"{x:.{stellen}f}".replace(".", ",")


def wort_n(n):
    return "1 Wort" if n == 1 else f"{n} Wörter"


def zeitcode(sek):
    m, s = divmod(max(0.0, sek), 60)
    return f"{int(m)}:{s:04.1f}".replace(".", ",")


def ohne_markup(t):
    """Akzent-Markup entfernen wie ohneMarkup() in render/orange.mjs."""
    t = re.sub(r"\*([^*\n]+)\*", r"\1", t)
    t = re.sub(r"_([^_\n]+)_", r"\1", t)
    return re.sub(r"==([^=\n]+)==", r"\1", t)


def woerter(t):
    """Wörter wie automatik/reel-regeln.mjs: durch Leerraum getrennt, ohne Markup."""
    return ohne_markup(t).split()


def saetze(text):
    """Sätze wie saetze() in render/orange.mjs: Satzzeichen, Leerraum, dann Großbuchstabe, Anführungszeichen,
    Ziffer oder Markup. Abkürzungen wie "z. B." trennen nicht."""
    t = text.strip()
    out, start = [], 0
    for m in ENDE_RE.finditer(t):
        bis = m.start() + 1
        if ABK_RE.search(t[start:bis]):
            continue
        out.append(t[start:bis].strip())
        start = bis
    rest = t[start:].strip()
    if rest:
        out.append(rest)
    return out


def stimmentext(text):
    """Text, wie er an die KI-Stimme gehen soll: ohne Markup, "vamela.de" als "Fameela Punkt D E"."""
    t = ohne_markup(text)
    t = re.sub(r"(?i)\bvamela\.de\b", "Fameela Punkt D E", t)
    t = re.sub(r"(?i)\bvamela\b", "Fameela", t)
    t = t.replace("\u20ac", " Euro").replace("%", " Prozent")
    return " ".join(t.split())


def _zahl_silben(ziffern):
    n = len(ziffern)
    if n == 1:
        return 2 if ziffern == "7" else 1
    if n == 3 and ziffern.endswith("00"):
        return 3                                   # dreihundert
    return {2: 3, 3: 5, 4: 7}.get(n, 2 * n)


def silben_token(tok):
    """Silben eines Wortes (Vokalgruppen). Abkürzungen in Großbuchstaben zählen je Buchstabe."""
    if tok.isdigit():
        return _zahl_silben(tok)
    if len(tok) >= 2 and tok.isalpha() and tok.isupper():
        return ALS_WORT.get(tok, len(tok))
    low = tok.lower()
    n = len(VOKALE_RE.findall(low))
    if re.search(r"(?:io|eo|ia)$", low):          # Bio, Video, Pizzeria
        n += 1
    return max(1, n)


def silben(text):
    return sum(silben_token(t) for t in TOKEN_RE.findall(text))


def sprechzeit(gesprochen, wpm=WPM, nach_woertern=False):
    """Geschätzte reine Sprechzeit in Sekunden für Text in Stimmenfassung (siehe stimmentext)."""
    wps = wpm / 60.0
    if nach_woertern:
        return len(gesprochen.split()) / wps       # gesprochene Wörter: "Fameela Punkt D E" sind vier
    return silben(gesprochen) / (SILBEN_JE_WORT * wps)


def _norm(w):
    return re.sub(r"[\W_]", "", w.lower())


def schluesselwoerter(text):
    """Punch-Zoom-Wörter je Satz wie schluesselwoerter() in render/schnitt.mjs: die markierten Wörter, sonst je Satz
    das längste Wort mit mehr als sechs Zeichen, nicht das erste und kein Füllwort."""
    ws = []
    for teil in MARKUP_RE.split(text):
        if not teil:
            continue
        markiert = bool(re.fullmatch(r"\*[^*]+\*|_[^_]+_|==[^=]+==", teil))
        inhalt = (teil[2:-2] if teil.startswith("==") else teil[1:-1]) if markiert else teil
        ws.extend((w, markiert) for w in inhalt.split())
    teile = saetze(ohne_markup(text))
    je_satz, i = [], 0
    mit_markup = any(m for _, m in ws)
    for s in teile:
        n = len(s.split())
        stueck = ws[i:i + n]
        if mit_markup:
            je_satz.append([w.strip(".,;:!?…„“\"") for w, m in stueck if m])
        else:
            best, laenge = None, 6
            for k, (w, _) in enumerate(stueck):
                nw = _norm(w)
                if k > 0 and len(nw) > laenge and nw not in FUELL:
                    best, laenge = w.strip(".,;:!?…„“\""), len(nw)
            je_satz.append([best] if best else [])
        i += n
    return je_satz, mit_markup


# ------------------------------------------------------------------ Preise (data/fakten.json)
LEERRAUM_RE = re.compile("[\u00a0\u2007\u2009\u202f]")          # geschützte und schmale Leerzeichen
EURO_ZIFFER_RE = re.compile(r"([0-9])\s*(?:Euro|EUR)\b", re.IGNORECASE)        # wie preiseImText() in automatik/fakten.mjs
BETRAG_RE = re.compile(r"([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]+)(?:,([0-9]{2}))?\s?€")
WORT_RE = re.compile(r"[^\W\d_]+")
PRODUKT_RE = re.compile(r"(website|webseite|homepage|internetseite|onepager|logo|visitenkarte|flyer|hosting|\bänderung|entwurf|"
                        r"unternehmensprofil|google-profil|speisekarte)", re.IGNORECASE)
PRODUKT_GLEICH = {"webseite": "website", "homepage": "website", "internetseite": "website", "onepager": "website",
                  "google-profil": "unternehmensprofil"}
EIGENES_ANGEBOT_RE = re.compile(r"\b(?:bei\s+(?:mir|uns)|von\s+mir|vamela|kostet\s+bei)\b", re.IGNORECASE)
PRODUKT_NAME = {"website": "Website", "logo": "Logo", "visitenkarte": "Visitenkarten", "flyer": "Flyer",
                "hosting": "Hosting", "änderung": "Änderungen", "entwurf": "Entwurf",
                "unternehmensprofil": "Google-Unternehmensprofil", "speisekarte": "Speisekarten"}
_EINER = {"ein": 1, "zwei": 2, "drei": 3, "vier": 4, "fünf": 5, "sechs": 6, "sieben": 7, "acht": 8, "neun": 9}
_ZEHNER = {"zwanzig": 20, "dreißig": 30, "dreissig": 30, "vierzig": 40, "fünfzig": 50, "sechzig": 60, "siebzig": 70,
           "achtzig": 80, "neunzig": 90}
_BIS19 = {"null": 0, "eins": 1, "zehn": 10, "elf": 11, "zwölf": 12, "dreizehn": 13, "vierzehn": 14, "fünfzehn": 15,
          "sechzehn": 16, "siebzehn": 17, "achtzehn": 18, "neunzehn": 19}
_EINER_UND_RE = re.compile(r"(ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun)und(zwanzig|dreißig|dreissig|vierzig|fünfzig|"
                           r"sechzig|siebzig|achtzig|neunzig)")


def _bis99(s):
    if s in _BIS19:
        return _BIS19[s]
    if s in _EINER:
        return _EINER[s]
    if s in _ZEHNER:
        return _ZEHNER[s]
    m = _EINER_UND_RE.fullmatch(s)
    return _EINER[m.group(1)] + _ZEHNER[m.group(2)] if m else None


def _bis999(s):
    vor, hundert, nach = s.partition("hundert")
    if not hundert:
        return _bis99(s)
    h = 1 if vor == "" else _EINER.get(vor)
    if h is None:
        return None
    if not nach:
        return h * 100
    r = _bis99(nach[3:] if nach.startswith("und") else nach)          # "hundertundzwanzig" kommt auch vor
    return None if not r else h * 100 + r


def zahlwort_wert(wort):
    """Ausgeschriebene Grundzahl bis 999 999 als int ("zweihundertneunundvierzig" -> 249), sonst None."""
    s = wort.lower()
    if s in ("einen", "einem"):
        return 1
    vor, tausend, nach = s.partition("tausend")
    if not tausend:
        return _bis999(s)
    t = 1 if vor == "" else _bis999(vor)
    if not t:
        return None
    if not nach:
        return t * 1000
    r = _bis999(nach[3:] if nach.startswith("und") else nach)
    return None if not r else t * 1000 + r


def _ziffern_text(text):
    """Nur die Schreibweise der Ziffern-Beträge vereinheitlichen, wie leer() und preiseImText() in automatik/fakten.mjs."""
    return EURO_ZIFFER_RE.sub(r"\1 €", LEERRAUM_RE.sub(" ", text).replace("&euro;", "€"))


def betraege_text(text):
    """Text mit einheitlichen Beträgen "N €": "249 Euro" wird "249 €", ausgeschriebene Beträge wie
    "zweihundertneunundvierzig Euro" oder "tausend vierhundertneunzig Euro" werden "249 €" bzw. "1.490 €"
    (Tausenderpunkt wie in data/fakten.json). "Ein-Euro-Job" und "Euro-Münze" bleiben stehen."""
    t = _ziffern_text(text)
    toks = list(WORT_RE.finditer(t))
    ersatz = []
    for j, tok in enumerate(toks):
        if tok.group(0).lower() not in ("euro", "eur") or t[tok.end():tok.end() + 1] == "-":
            continue
        for k in (3, 2, 1):                                          # längste Kette zuerst
            if j < k:
                continue
            kette = toks[j - k:j]
            luecken = [t[a.end():b.start()] for a, b in zip(kette, kette[1:] + [tok])]
            if not all(re.fullmatch(r"[ \t-]+", x) for x in luecken):
                continue
            n = zahlwort_wert("".join(x.group(0) for x in kette))
            if n is not None:
                ersatz.append((kette[0].start(), tok.end(), n))
                break
    for a, b, n in reversed(ersatz):
        t = t[:a] + f"{n:,}".replace(",", ".") + " €" + t[b:]
    return t


def _betrag(m):
    """Treffer von BETRAG_RE als "N €" wie preiseImText(): ",00" fällt weg, andere Cent bleiben."""
    cent = m.group(2)
    return m.group(1) + ("," + cent if cent and cent != "00" else "") + " €"


def preise_im_text(text):
    """Beträge im Text wie preiseImText() in automatik/fakten.mjs, dazu ausgeschriebene. Der Sprechtext schreibt
    Zahlen aus; die Prüfung im Projekt findet nur Ziffern."""
    return [_betrag(m) for m in BETRAG_RE.finditer(betraege_text(text))]


def _produkte(text):
    return {PRODUKT_GLEICH.get(m.group(1).lower(), m.group(1).lower()) for m in PRODUKT_RE.finditer(text)}


def _preis_saetze(text):
    """Je Satz: (Satz mit einheitlichen Beträgen, Beträge in Ziffern, ausgeschriebene Beträge, Angebote im Satz,
    eigenes Angebot ja/nein). Ein ausgeschriebener Betrag ohne Angebot im Satz kann ein Beispiel sein
    ("zehn Euro hier, zwanzig dort"), deshalb zählt er erst mit Angebot als VAMELA-Preis."""
    out = []
    for satz in saetze(" ".join(text.split())):
        ziffern = [_betrag(m) for m in BETRAG_RE.finditer(_ziffern_text(satz))]
        norm = betraege_text(satz)
        ausgeschrieben = list((collections.Counter(_betrag(m) for m in BETRAG_RE.finditer(norm))
                               - collections.Counter(ziffern)).elements())
        out.append((norm, ziffern, ausgeschrieben, _produkte(satz), bool(EIGENES_ANGEBOT_RE.search(satz))))
    return out


def projekt_standard():
    """PROJEKT_STANDARD, wenn es den Ordner gibt, sonst None."""
    return PROJEKT_STANDARD if os.path.isdir(PROJEKT_STANDARD) else None


def lade_preise(projekt):
    """Erlaubte Preise aus <projekt>/data/fakten.json. Rückgabe ({Preistext: [Bedeutung, …]}, None) oder
    (None, Grund), wenn die Datei fehlt oder nicht lesbar ist."""
    if not projekt:
        return None, "kein Projektordner"
    pfad = os.path.join(projekt, "data", "fakten.json")
    try:
        with open(pfad, encoding="utf-8") as f:
            daten = json.load(f)
        preise = {}
        for p in daten["preise"]:
            text = " ".join(LEERRAUM_RE.sub(" ", str(p["text"])).split())
            preise.setdefault(text, []).append(str(p.get("bedeutung") or ""))
    except FileNotFoundError:
        return None, f"{pfad} fehlt"
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as e:
        return None, f"{pfad} nicht lesbar: {e}"
    return preise, None


def preis_verstoesse(text, preise):
    """Beträge, die nicht in data/fakten.json stehen, wie pruefeText() in automatik/fakten.mjs: jeder Betrag in
    Ziffern, ein ausgeschriebener, sobald der Satz ein Angebot nennt (Logo, Website, "bei mir" …). preise None =
    ungeprüft, dann meldet preis_hinweise()."""
    if preise is None:
        return []
    ohne_punkt = {p.replace(".", ""): p for p in preise}
    out = []
    for _, ziffern, ausgeschrieben, angebote, eigen in _preis_saetze(text):
        funde = [(p, "") for p in ziffern] + ([(p, " (ausgeschrieben)") for p in ausgeschrieben] if angebote or eigen else [])
        for p, wie in funde:
            if p in preise:
                continue
            dort = ohne_punkt.get(p.replace(".", "")) if not wie else None
            m = (f"Preis {p}{wie} steht nicht in data/fakten.json (nur Preise von vamela.de"
                 + (f", dort als {dort} geschrieben)" if dort else ")"))
            if m not in out:
                out.append(m)
    return out


def preis_hinweise(text, preise, grund=None):
    """Hinweise ohne FEHLER: Beträge ungeprüft (keine fakten.json), ein ausgeschriebener Betrag ohne Angebot im Satz,
    der nicht in data/fakten.json steht, oder ein belegter Betrag, der laut data/fakten.json zu einem anderen
    Angebot gehört als dem im selben Satz ("Logo ab 49 €": 49 € ist dort die Website im Monat)."""
    saetze_ = _preis_saetze(text)
    alle = list(dict.fromkeys(p for _, z, w, _, _ in saetze_ for p in z + w))
    if not alle:
        return []
    if preise is None:
        return [f"Preise ungeprüft ({', '.join(alle)}): {grund or 'data/fakten.json nicht gelesen'}. Beträge nur wie in "
                f"data/fakten.json, Prüfung mit --projekt {PROJEKT_STANDARD}."]
    out = []
    for norm, ziffern, ausgeschrieben, angebote, eigen in saetze_:
        if not (angebote or eigen):
            for p in ausgeschrieben:
                h = (f"Betrag {p} (ausgeschrieben) steht nicht in data/fakten.json. Ein VAMELA-Preis nur wie dort, "
                     f"ein fremder Betrag nur mit Beleg, sonst weglassen.")
                if p not in preise and h not in out:
                    out.append(h)
        if not angebote:
            continue
        for m in BETRAG_RE.finditer(norm):
            p = _betrag(m)
            fuer = set()
            for b in preise.get(p, []):
                fuer |= _produkte(b)
            if fuer and not fuer & angebote:
                genannt = ", ".join(PRODUKT_NAME.get(x, x) for x in sorted(angebote))
                h = (f"Preis {p} steht in data/fakten.json für „{' / '.join(preise[p])}“, der Satz nennt {genannt}. "
                     f"Prüf, ob der Betrag zu diesem Angebot gehört.")
                if h not in out:
                    out.append(h)
    return out


def sie_form(text):
    """Sie-Form, die VAMELA nicht schreibt. Rückgabe (sicher, fraglich), je eine Liste von (Fundstelle, am_textanfang).
    sicher: "Ihnen" überall, "Sie", "Ihr" und "Ihre…" groß mitten im Satz. fraglich: am Satzanfang "Sie" mit Verb auf
    -en ("Sie verlieren", auch "Sie sind") oder "Ihre…"/"Ihr" vor einem Substantiv. Das kann "sie" (Plural) oder "ihre"
    sein, außer am Textanfang: Dort fehlt jeder Bezug, also ist es die Höflichkeitsform."""
    flach = " ".join(ohne_markup(text).split())
    sicher, fraglich = [], []
    for m in SIE_RE.finditer(flach):
        wort = m.group(0)
        vorher = flach[:m.start()].rstrip()
        am_textanfang = not re.search(r"[^\W_]", vorher)            # davor nur Satzzeichen oder nichts
        satzanfang = am_textanfang or bool(SATZGRENZE_RE.search(vorher))
        if wort == "Ihnen" or not satzanfang:
            sicher.append((wort, am_textanfang))
            continue
        nach = re.match(r"\s+([^\W\d_]+)", flach[m.end():])
        folge = nach.group(1) if nach else ""
        if wort == "Sie":
            if re.search(r"(?:en|ln|rn)$", folge) or folge in ("sind", "tun"):
                fraglich.append((f"Sie {folge}", am_textanfang))
        elif wort != "Ihr" or folge[:1].isupper():                  # "Ihr kennt das" ist ihr (Plural), kein Sie
            fraglich.append((f"{wort} {folge}".strip(), am_textanfang))
    return sicher, fraglich


def _mehr_versprochen(flach):
    """Versprechen wie "sicher mehr Kunden"; verneint ("bringt nicht automatisch mehr Kunden") ist es ehrlich."""
    return any(not re.search(r"\b(?:nicht|nie|kein\w*)\s+$", flach[:m.start()], re.IGNORECASE)
               for m in MEHR_RE.finditer(flach))


def regelverstoesse(text, preise=None):
    """Inhaltsregeln von VAMELA, die für jeden gesprochenen oder gezeigten Text gelten. Liste von Meldungen.
    preise: erlaubte Preise aus lade_preise(); None = Beträge nicht abgleichen (das meldet preis_hinweise())."""
    flach = ohne_markup(text)
    norm = betraege_text(flach)
    f = []
    if ADRESSE_RE.search(flach):
        f.append("Webadresse mit Pfad, https oder www (nur \"vamela.de\", die Stimme liest Schrägstriche vor)")
    if EMOJI_RE.search(flach):
        f.append("Emoji, Klammer oder Aufzählungszeichen")
    if HASHTAG_RE.search(flach):
        f.append("Hashtag (gehört nur in die Caption)")
    if INFO_RE.search(flach):
        f.append("vamela.info (immer vamela.de)")
    if PLATZHALTER_RE.search(flach):
        f.append("offener Platzhalter {{…}}: Zahl oder Beleg nachliefern oder den Satz ohne Zahl schreiben")
    if VERSPRECHEN_RE.search(flach) or _mehr_versprochen(flach):
        f.append("Erfolgsversprechen oder Rechtsaussage (keine Garantie, nichts \"rechtssicher\" oder \"abmahnfrei\", "
                 "kein \"Platz 1 bei Google\", kein \"sicher mehr Kunden\")")
    if VERKNAPPUNG_RE.search(flach):
        f.append("künstliche Verknappung (\"nur noch heute\", \"letzte Chance\")")
    if RABATT_RE.search(norm):
        f.append("Rabatt, Gutschein oder Aktionspreis (Preise nur wie in data/fakten.json)")
    if STREICHPREIS_RE.search(norm):
        f.append("Streichpreis oder \"nur N €\" (wirkt wie Rabatt oder Aktionspreis; Preis allein, so wie auf vamela.de: "
                 "\"Logo ab 249 €\")")
    f.extend(preis_verstoesse(flach, preise))
    if HAEUFIGKEIT_RE.search(flach):
        f.append("behauptete Häufigkeit (\"viele fragen mich\"): ohne Beleg weglassen")
    sicher, fraglich = sie_form(flach)
    funde = list(dict.fromkeys([f"„{w}“" for w, _ in sicher] + [f"„{w}“ am Anfang" for w, anfang in fraglich if anfang]))
    if funde:                    # groß mitten im Satz, "Ihnen", oder am Textanfang ohne Bezug davor = Höflichkeitsform
        f.append(f"Sie-Form ({', '.join(funde[:3])}): VAMELA schreibt Du")
    return f


def pruefe_motiv(motiv):
    """Wie pruefeMotiv() in automatik/block-felder.mjs. Liste von Meldungen."""
    mo = (motiv or "").strip()
    if not mo:
        return ["Motiv fehlt (kurze englische Bildbeschreibung)"]
    f = []
    w = len(mo.split())
    if re.search("[äöüÄÖÜß\u201E\u201C]", mo) or not re.search(r"\b(a|an|the|with|of|on|in)\b", mo, re.IGNORECASE):
        f.append("Motiv muss Englisch sein")
    if w < 5 or w > 45:
        f.append(f"Motiv hat {w} Wörter, erlaubt 5 bis 45")
    m = MARKEN_RE.search(mo)
    if m:
        f.append(f"Motiv nennt die Marke oder Figur \"{m.group(0)}\" (allgemein beschreiben: voxel-style, retro game, robot)")
    if re.search(r"\blogos?\b|\bbrand(ed|s)?\b|\btrademark", mo, re.IGNORECASE):
        f.append("Motiv: keine Logos oder Marken")
    rest = VERNEINUNG_RE.sub(" ", mo)
    p = PERSON_RE.search(rest)
    if p:
        f.append(f"Motiv zeigt eine Person (\"{p.group(0)}\"), keine Personen")
    if re.search(r"\b(text|words|letters|caption|headline|typography)\b", rest, re.IGNORECASE):
        f.append("Motiv: keine Schrift im Bild (die setzt der Renderer)")
    return f


def _satz_anzahl_mehrwert(t):
    """Satzzählung wie in automatik/block-felder.mjs (Mehrwert genau ein Satz)."""
    t = re.sub(r"\b(z|d|u|bzw|ca|etc)\.\s?(B|h|a)?\.?", "", t)
    stuecke = re.findall(r"(?:[^.!?]|[.!?](?=[\da-zäöü]))+[.!?]+", t) or [t]
    return len([s for s in stuecke if len(s.strip()) > 2])


# ------------------------------------------------------------------ Eingabe lesen
def _quoted(s):
    """Text zwischen „ und dem letzten “ bzw. " wie quoted() in render/inhalt.mjs, sonst None."""
    a = s.find("\u201E")
    b = max(s.rfind("\u201C"), s.rfind('"'))
    return " ".join(s[a + 1:b].replace("**", "").split()) if a >= 0 and b > a else None


def _metazeilen(sec):
    meta = {}
    for m in re.finditer(r"(?m)^- ([^:\n]+): (.+)$", sec):
        meta[m.group(1).strip().lower()] = m.group(2).strip()
    for m in re.finditer(r"(?im)^(mehrwert|motiv|familie):\s*(.+)$", sec):
        meta.setdefault(m.group(1).lower(), m.group(2).strip())
    return meta


def szenen_liste(sec):
    """Szenen wie szenenListe() in render/inhalt.mjs. Rückgabe: (Szenen, unbekannte Zeilen)."""
    m = re.search(r"(?m)^\*\*Szenen", sec)
    if not m:
        return [], []
    out, unbekannt = [], []
    for z in sec[m.start():].split("\n")[1:]:
        if z.startswith("**"):
            break
        mm = re.match(r"^\s*(\d+)\.\s*(nacht|tag|aufnahme|bild)\s*:\s*(.+?)\s*$", z, re.IGNORECASE)
        if mm:
            art, wert = mm.group(2).lower(), mm.group(3).strip()
            if art == "bild":
                wert = re.sub(r"(?i)\.png$", "", wert)
            out.append({"nr": int(mm.group(1)), "art": art, "wert": wert})
            continue
        mu = re.match(r"^\s*(\d+)\.\s*([^:\s]+)\s*:\s*(.+?)\s*$", z)
        if mu:
            unbekannt.append(f"{mu.group(1)}. {mu.group(2)}")
    return out, unbekannt


def _block(sec, titel):
    meta = _metazeilen(sec)
    sprech = meta.get("sprechtext", "")
    sprech = re.sub("^[\u201E\"]|[\u201C\"]$", "", sprech.strip()).strip()
    hook_zeile = re.search(r"\*\*Hook[^\n]*\*\*\s*(.+)", sec)
    szenen, unbekannt = szenen_liste(sec)
    return {
        "titel": titel, "block": True, "sprechtext": sprech,
        "angebot": meta.get("angebot"), "saeule": (meta.get("säule") or "").split(" ")[0].lower() or None,
        "hook_zeile": hook_zeile.group(1).strip() if hook_zeile else None,
        "hook": _quoted(hook_zeile.group(1)) if hook_zeile else None,
        "mehrwert": meta.get("mehrwert"), "motiv": meta.get("motiv"), "familie": meta.get("familie"),
        "szenen": szenen, "szenen_unbekannt": unbekannt, "hat_szenen": bool(re.search(r"(?m)^\*\*Szenen", sec)),
        "zeilenende": [],
    }


def lese_eingabe(raw):
    """Liste von Reels: aus einer Vorratsdatei ("## Reel N: Titel"), einem einzelnen Block oder reinem Skripttext."""
    raw = unicodedata.normalize("NFC", raw.lstrip("\ufeff").replace("\r\n", "\n"))   # "\u00fc" auch aus zerlegter Schreibweise
    reels = []
    for sec in re.split(r"(?m)^## ", raw)[1:]:
        kopf = re.match(r"Reel\s+(\d+):\s*(.+)", sec)
        if kopf:
            reels.append(_block(sec, f"Reel {kopf.group(1)}: {kopf.group(2).strip()}"))
    if reels:
        return reels
    if re.search(r"(?m)^- Sprechtext: ", raw):
        return [_block(raw, "Reel-Block")]
    zeilen = [z.strip() for z in raw.splitlines() if z.strip() and not re.match(r"^#(?:\s|$)", z.strip())]
    ohne_ende = [i + 1 for i, z in enumerate(zeilen[:-1]) if not re.search("[.!?\u2026\u201C\"]$", z)]
    return [{"titel": "Skript", "block": False, "sprechtext": " ".join(zeilen), "angebot": None, "saeule": None,
             "hook_zeile": None, "hook": None, "mehrwert": None, "motiv": None, "familie": None, "szenen": [],
             "szenen_unbekannt": [], "hat_szenen": False, "zeilenende": ohne_ende}]


# ------------------------------------------------------------------ Analyse
def analysiere(reel, wpm=WPM, pause=PAUSE, nach_woertern=False, angebot=None, dauer_min=DAUER_MIN,
               dauer_max=DAUER_MAX, szenen=None, projekt=None, preise=None, preise_grund=None):
    """preise/preise_grund wie aus lade_preise(projekt); ohne preise sind Beträge nur als HINWEIS gemeldet."""
    roh = " ".join(reel["sprechtext"].split())
    text = ohne_markup(roh)
    teile = saetze(text)
    if not teile:
        return None
    if szenen is None:
        szenen = reel.get("szenen") or []
    angebot = (angebot or reel.get("angebot") or "").strip().lower() or None
    if angebot is None and reel.get("block"):
        angebot = "keins"                          # wie render/inhalt.mjs: ohne Zeile gilt "keins"
    zoom, mit_markup = schluesselwoerter(roh)

    zeilen, t = [], ANLAUF
    for i, s in enumerate(teile):
        sprech = stimmentext(s)
        dauer = sprechzeit(sprech, wpm, nach_woertern)
        sz = szenen[i] if i < len(szenen) else None
        zeilen.append({
            "n": i + 1, "start": round(t, 2), "dauer": round(dauer, 2), "ende": round(t + dauer, 2),
            "woerter": len(s.split()), "silben": silben(sprech), "rolle": "TIPP", "text": s,
            "szene": (f"bild {sz['wert']}" if sz["art"] == "bild" else sz["art"]) if sz else "",
            "zoom": zoom[i] if i < len(zoom) else [],
        })
        t += dauer + pause
    zeilen[0]["rolle"] = "HOOK"
    if len(zeilen) > 1:
        zeilen[-1]["rolle"] = "CTA"
    sprech_ende = zeilen[-1]["ende"]
    gesamt = sprech_ende + NACHLAUF
    n_woerter = len(text.split())
    netto = sum(z["dauer"] for z in zeilen)
    sek_je_wort = netto / n_woerter if n_woerter else 0.0
    fehler, zeit, hinweis = [], [], []

    # ---- feste Regeln (automatik/reel-regeln.mjs), die Automatik lehnt sonst ab
    if not WORTE_MIN <= n_woerter <= WORTE_MAX:
        fehler.append(f"Sprechtext hat {n_woerter} Wörter, erlaubt {WORTE_MIN} bis {WORTE_MAX}")
    if not SAETZE_MIN <= len(teile) <= SAETZE_MAX:
        fehler.append(f"Sprechtext hat {len(teile)} Sätze, erlaubt {SAETZE_MIN} bis {SAETZE_MAX}")
    hook_w = len(teile[0].split())
    if hook_w > HOOK_WORTE_MAX:
        fehler.append(f"Satz 1 (Hook) hat {hook_w} Wörter, höchstens {HOOK_WORTE_MAX}")
    if not HANDLUNG_RE.search(teile[-1]):
        fehler.append("letzter Satz fordert nicht zum Speichern, Folgen, Teilen, Kommentieren oder \"Link in der Bio\" auf")
    link = bool(LINK_BIO_RE.search(text))
    if angebot is None:
        hinweis.append("Angebot unbekannt, Prüfung \"Link in der Bio\" übersprungen. Mit --angebot werkzeug|entwurf|keins nachholen.")
    elif angebot != "keins" and not link:
        fehler.append(f"Angebot {angebot}, aber kein \"Link in der Bio\" im Sprechtext")
    elif angebot == "keins" and link:
        fehler.append("\"Link in der Bio\" im Sprechtext, aber Angebot keins")
    for v in regelverstoesse(roh, preise):
        fehler.append(f"Sprechtext: {v}")
    pruef_texte = [("Sprechtext", roh)]

    # ---- Reel-Block: Felder, Hook-Zeile, Szenen
    if reel.get("block"):
        if reel.get("saeule") == "fundstuecke":
            fehler.append("Säule fundstuecke: Fundstücke gibt es nur als Karussell, Reels filmen nur vamela.de")
        if reel.get("hook_zeile") is None:
            fehler.append("Hook-Zeile fehlt (**Hook (Cover und erster Satz, wörtlich):** „…“)")
        elif reel.get("hook") is None:
            fehler.append("Hook-Zeile ohne „…“: der Parser (render/inhalt.mjs) liest sie dann nicht")
        else:
            hw = len(woerter(reel["hook"]))
            if hw > HOOK_WORTE_MAX:
                fehler.append(f"Hook-Zeile hat {hw} Wörter, höchstens {HOOK_WORTE_MAX}")
            elif hw > HOOK_WORTE_RENDERER:
                hinweis.append(f"Hook-Zeile hat {hw} Wörter: erlaubt, aber der Renderer meldet \"Hook zu lang (> 9 Wörter)\" "
                               f"und setzt die Überschrift klein. Neun oder weniger.")
            for v in regelverstoesse(reel["hook"], preise):
                fehler.append(f"Hook-Zeile: {v}")
            pruef_texte.append(("Hook-Zeile", reel["hook"]))
        mw = (reel.get("mehrwert") or "").strip()
        if not mw:
            fehler.append("Zeile \"- Mehrwert:\" fehlt (ein Satz: Du kannst / Du weißt / Du hast …)")
        else:
            if not MEHRWERT_RE.search(mw):
                fehler.append("Mehrwert beginnt nicht mit \"Du kannst\", \"Du weißt\", \"Du hast\" (oder bekommst, erkennst, "
                              "findest, sparst, vermeidest)")
            if not 30 <= len(mw) <= 220:
                fehler.append(f"Mehrwert hat {len(mw)} Zeichen, erlaubt 30 bis 220")
            if _satz_anzahl_mehrwert(mw) > 1:
                fehler.append("Mehrwert: genau ein Satz")
            if SPRUCH_RE.search(mw):
                fehler.append("Mehrwert klingt nach Spruch statt nach Nutzen")
        for v in pruefe_motiv(reel.get("motiv")):
            fehler.append(f"Zeile \"- Motiv:\": {v}")
        if (reel.get("familie") or "").strip().lower() not in ("nacht", "tag"):
            fehler.append("Zeile \"- Familie: nacht|tag\" fehlt oder ist falsch")
        if not reel.get("hat_szenen"):
            fehler.append("Abschnitt **Szenen** fehlt (je Satz eine Zeile: nacht:, tag:, aufnahme: oder bild:)")
    for u in reel.get("szenen_unbekannt") or []:
        fehler.append(f"Szene {u}: Art unbekannt, erlaubt sind nacht, tag, aufnahme, bild (der Parser überspringt die Zeile)")
    if szenen or reel.get("hat_szenen"):
        if len(szenen) != len(teile):
            fehler.append(f"{len(szenen)} Szenen für {len(teile)} Sätze (je Satz genau eine)")
        if sum(1 for s in szenen if s["art"] == "aufnahme") > AUFNAHMEN_MAX:
            fehler.append(f"mehr als {AUFNAHMEN_MAX} Bildschirmaufnahmen")
        for pos, s in enumerate(szenen, 1):
            # Nummer wie in der Datei; der Parser ordnet nach Reihenfolge zu, deshalb bei Abweichung beides
            k = s["nr"] if s["nr"] == pos else f"{s['nr']} (Position {pos})"
            if s["art"] == "aufnahme":
                if not re.match(r"^https://vamela\.de/", s["wert"]):
                    fehler.append(f"Szene {k}: Aufnahme nur von https://vamela.de/…")
            elif s["art"] == "bild":
                if not re.match(r"^[\w-]+$", s["wert"]):
                    fehler.append(f"Szene {k}: \"bild:\" erwartet einen Dateinamen aus bilder/vorrat/ wie k20")
                elif projekt and not os.path.isfile(os.path.join(projekt, "bilder", "vorrat", s["wert"] + ".png")):
                    fehler.append(f"Szene {k}: bilder/vorrat/{s['wert']}.png fehlt")
            else:
                for v in pruefe_motiv(s["wert"]):
                    fehler.append(f"Szene {k}: {v}")
        if szenen and not projekt and any(s["art"] == "bild" for s in szenen):
            hinweis.append(f"bild:-Szenen nur dem Format nach geprüft (kein Projektordner). Mit --projekt {PROJEKT_STANDARD} "
                           "wird auch geprüft, ob die Datei in bilder/vorrat/ liegt.")

    # ---- Zeit
    spanne = f"{zahl(dauer_min, 0)} bis {zahl(dauer_max, 0)} s"
    if gesamt > dauer_max and sek_je_wort:
        k = max(1, math.ceil((gesamt - dauer_max) / sek_je_wort))
        zeit.append(f"Reel dauert geschätzt {zahl(gesamt)} s, Ziel {spanne}. Kürze um etwa {wort_n(k)} oder einen Satz "
                    f"(jeder Satz weniger spart dazu {zahl(pause)} s Pause).")
    elif gesamt < dauer_min and sek_je_wort:
        k = max(1, math.ceil((dauer_min - gesamt) / sek_je_wort))
        zeit.append(f"Reel dauert geschätzt {zahl(gesamt)} s, Ziel {spanne}. Etwa {wort_n(k)} mehr.")
    passt = int(max(0.0, dauer_max - ANLAUF - NACHLAUF - (len(teile) - 1) * pause) / sek_je_wort) if sek_je_wort else 0
    hinweis.append(f"Bei diesem Tempo und {len(teile)} Sätzen passen etwa {wort_n(passt)} in {zahl(dauer_max, 0)} s "
                   f"(der Sprechtext hat {n_woerter}).")

    h_ende = zeilen[0]["ende"]
    if h_ende > HOOK_ZU_LANG:
        je_wort = zeilen[0]["dauer"] / max(1, zeilen[0]["woerter"])
        k = max(1, int((HOOK_OK - ANLAUF) / je_wort))
        zeit.append(f"Hook endet erst bei {zahl(h_ende)} s, die Hook-Karte steht nur bis {zahl(HOOK_KARTE)} s. "
                    f"Kürze Satz 1 auf etwa {wort_n(k)} oder nimm kürzere Wörter.")
    elif h_ende > HOOK_OK:
        hinweis.append(f"Hook endet bei {zahl(h_ende)} s, die Hook-Karte steht bis {zahl(HOOK_KARTE)} s. Kürzer wäre besser.")
    else:
        hinweis.append(f"Hook endet bei {zahl(h_ende)} s, passt zur Hook-Karte (0 bis {zahl(HOOK_KARTE)} s).")

    lang = [z["n"] for z in zeilen if z["dauer"] > LANGER_SATZ]
    if lang:
        hinweis.append(f"Satz {', '.join(map(str, lang))} dauert über {zahl(LANGER_SATZ, 0)} s. Teile ihn, der Schnitt "
                       f"sitzt auf jedem Satz.")
    if len(zeilen) > 1 and zeilen[-1]["dauer"] > SCHLUSS_LANG:
        hinweis.append(f"Schlusssatz dauert {zahl(zeilen[-1]['dauer'])} s, die Abschlusskarte mit diesem Satz steht nur "
                       f"die letzten {zahl(ENDKARTE)} s. Kurz halten.")

    # ---- Loop: greift der Schlusssatz ein Wort aus dem Hook auf?
    def stamm(w):
        w = w.lower()
        for suf in ("ern", "en", "er", "es", "e", "n", "s"):
            if len(w) - len(suf) >= 4 and w.endswith(suf):
                return w[:-len(suf)]
        return w

    def inhalt(s):
        return [w for w in TOKEN_RE.findall(s) if w.lower() not in STOPWOERTER and len(w) > 2]

    erste, letzte = inhalt(teile[0]), inhalt(teile[-1])
    gleich = []
    for a in erste:
        for b in letzte:
            sa, sb = stamm(a), stamm(b)
            if (sa == sb or (len(sa) >= 5 and len(sb) >= 5 and sa[:5] == sb[:5])) and a.lower() not in [g.lower() for g in gleich]:
                gleich.append(a)
    if len(teile) > 1 and gleich:
        hinweis.append(f"Loop: der Schlusssatz greift \"{', '.join(gleich[:3])}\" aus dem Hook auf. Beim Wiederholen "
                       f"schließt sich der Kreis.")
    elif len(teile) > 1:
        # Substantive sind groß geschrieben; das erste Wort des Satzes zählt dafür nicht
        nomen = [w for k, w in enumerate(TOKEN_RE.findall(teile[0])) if k > 0 and w[:1].isupper()
                 and w.lower() not in STOPWOERTER and len(w) > 2] or erste
        kandidat = max(nomen, key=len) if nomen else None
        hinweis.append("Kein Loop: der Schlusssatz greift kein Wort aus dem Hook auf." +
                       (f" Wenn es passt, nimm \"{kandidat}\" noch einmal in den Schlusssatz." if kandidat else ""))

    # ---- Preise im Zusammenhang, "Sie" an einem späteren Satzanfang (kein FEHLER: kann "sie", Plural, sein)
    for wo, t_pruef in pruef_texte:
        for h in preis_hinweise(t_pruef, preise, preise_grund):
            h = h if wo == "Sprechtext" else f"Hook-Zeile: {h}"
            if h not in hinweis:
                hinweis.append(h)
        spaeter = list(dict.fromkeys(w for w, anfang in sie_form(t_pruef)[1] if not anfang))
        if spaeter:
            liste = ", ".join(f"„{w}“" for w in spaeter[:3])
            hinweis.append(f"{wo}: Sie-Form? {liste} am Satzanfang. Passt nur, wenn „sie“ (Plural) gemeint ist, "
                           f"die Anrede ist Du.")

    # ---- Aussprache, Stimme, Untertitel
    if re.search(r"(?i)vamela(?!\.info)", text):
        hinweis.append("Aussprache: \"vamela.de\" spricht die Stimme als \"Fameela Punkt D E\", so ist es gerechnet. Im Skript, "
                       "in den Untertiteln und im Bild bleibt vamela.de. Den Text für die Stimme gibt --stimmentext aus.")
    if "@" in text:
        hinweis.append("@ im Sprechtext: Die Stimme liest das Zeichen womöglich mit. Im Sprechtext ohne @, das Handle gehört in die Caption.")
    if re.search(r"\d", text):
        hinweis.append("Ziffern im Sprechtext: Nach der Aufnahme anhören, ob die Stimme sie so liest, wie du sie meinst. "
                       "Ausgeschrieben (\"drei\") ist eindeutig.")
    breit = sorted({w.strip(".,;:!?…„“\"") for w in text.split() if len(w.strip(".,;:!?…„“\"")) > UNTERTITEL_ZEICHEN + 1})
    if breit:
        hinweis.append(f"Sehr lange Wörter ({', '.join(breit[:3])}): Ein Untertitel fasst etwa {UNTERTITEL_ZEICHEN} Zeichen, "
                       f"das Wort steht allein und kann eng werden. Kürzer geht oft (\"Google-Profil\").")
    if reel.get("zeilenende"):
        hinweis.append(f"Zeile {', '.join(map(str, reel['zeilenende']))} endet ohne Satzzeichen und wird mit der nächsten "
                       f"verbunden. Setz einen Punkt, wenn dort ein Satz enden soll.")
    hinweis.append(("Punch-Zoom auf den markierten Wörtern." if mit_markup else
                    "Punch-Zoom ohne Markup: je Satz das längste Wort (Spalte Zoom). Mit *wort*, _wort_ oder ==wort== "
                    "bestimmst du selbst, wo der Schnitt zoomt."))
    ende_karte = gesamt - ENDKARTE
    unter_hook = [z["n"] for z in zeilen if z["start"] < HOOK_KARTE]
    unter_end = [z["n"] for z in zeilen if z["ende"] > ende_karte]
    hinweis.append(f"Hook-Karte (0 bis {zahl(HOOK_KARTE)} s) liegt über Satz {', '.join(map(str, unter_hook))}, "
                   f"Abschlusskarte (ab {zahl(ende_karte)} s) über Satz {', '.join(map(str, unter_end))}.")

    return {
        "titel": reel["titel"], "wpm": wpm, "pause": pause, "modell": "woerter" if nach_woertern else "silben",
        "woerter": n_woerter, "saetze": len(teile), "silben": sum(z["silben"] for z in zeilen),
        "sprechzeit": round(netto, 2), "reel_sekunden": round(gesamt, 2), "hook_ende": h_ende,
        "ziel": [dauer_min, dauer_max], "angebot": angebot,
        "beats": zeilen, "fehler": fehler, "zeit": zeit, "hinweis": hinweis,
        "stimmentext": stimmentext(roh),
    }


# ------------------------------------------------------------------ Messung gegen eine Aufnahme
def messung(pfad, wpm=WPM, pause=PAUSE, nach_woertern=False):
    """Vergleicht die Schätzung mit echten Wortzeiten ({"woerter": [{wort, satz, start, ende}]}, render/wortzeiten.mjs)."""
    with open(pfad, encoding="utf-8") as f:
        ws = json.load(f)["woerter"]
    gruppen = {}
    for w in ws:
        gruppen.setdefault(w["satz"], []).append(w)
    reihe, zeilen = sorted(gruppen), []
    for k in reihe:
        g = gruppen[k]
        txt = " ".join(x["wort"] for x in g)
        sprech = stimmentext(txt)
        gem = g[-1]["ende"] - g[0]["start"]
        sch = sprechzeit(sprech, wpm, nach_woertern)
        zeilen.append({"satz": k + 1, "text": txt, "woerter": len(g), "silben": silben(sprech), "gemessen": round(gem, 2),
                       "geschaetzt": round(sch, 2), "abweichung_prozent": round((sch - gem) / gem * 100, 1) if gem else None})
    pausen = [gruppen[b][0]["start"] - gruppen[a][-1]["ende"] for a, b in zip(reihe, reihe[1:])]
    netto = sum(z["gemessen"] for z in zeilen)
    s_ges = sum(z["silben"] for z in zeilen)
    gesprochen = sum(len(stimmentext(z["text"]).split()) for z in zeilen)
    letztes = ws[-1]["ende"]
    geschaetzt = ANLAUF + sum(z["geschaetzt"] for z in zeilen) + pause * len(pausen) + NACHLAUF
    abw = [abs(z["abweichung_prozent"]) for z in zeilen if z["abweichung_prozent"] is not None]
    return {
        "datei": pfad, "woerter": len(ws), "saetze": len(reihe), "silben": s_ges,
        "erstes_wort_s": ws[0]["start"], "letztes_wort_ende_s": letztes,
        "reel_sekunden_gemessen": round(letztes + NACHLAUF, 2), "reel_sekunden_geschaetzt": round(geschaetzt, 2),
        "abweichung_gesamt_prozent": round((geschaetzt - (letztes + NACHLAUF)) / (letztes + NACHLAUF) * 100, 1),
        "abweichung_je_satz_mittel_prozent": round(sum(abw) / len(abw), 1) if abw else None,
        "wpm_netto_gemessen": round(len(ws) / netto * 60, 1) if netto else None,
        "wpm_kalibriert": (round(gesprochen / netto * 60, 1) if nach_woertern else
                           round(s_ges / netto * 60 / SILBEN_JE_WORT, 1)) if netto else None,
        "pausen": [round(p, 2) for p in pausen], "pause_mittel": round(sum(pausen) / len(pausen), 2) if pausen else None,
        "saetze_detail": zeilen,
    }


# ------------------------------------------------------------------ Ausgabe
def zeige(a, out=sys.stdout):
    kopf = (f"BEAT-TABELLE · {a['titel']} · {a['woerter']} Wörter, {a['saetze']} Sätze · Reel ca. "
            f"{zahl(a['reel_sekunden'])} s (Ziel {zahl(a['ziel'][0], 0)} bis {zahl(a['ziel'][1], 0)} s)")
    linie = "=" * min(max(len(kopf), 78), 110)
    print("\n" + kopf, file=out)
    print(f"Tempo {zahl(a['wpm'], 0)} Wörter/Min. ohne Pausen ({'nach Wortzahl' if a['modell'] == 'woerter' else 'nach Silben'}), "
          f"Satzpause {zahl(a['pause'])} s, reine Sprechzeit {zahl(a['sprechzeit'])} s"
          + (f", Angebot {a['angebot']}" if a["angebot"] else ""), file=out)
    print(linie, file=out)
    print(f"  {'Nr':>2}  {'von':<7}{'bis':<7}{'Dauer':>6}  {'Wörter':>6}  {'Rolle':<5}  {'Szene':<9}  {'Zoom':<15} Satz", file=out)
    for z in a["beats"]:
        zm = ", ".join(z["zoom"])[:15]
        print(f"  {z['n']:>2}  {zeitcode(z['start']):<7}{zeitcode(z['ende']):<7}{zahl(z['dauer']):>4} s  {z['woerter']:>6}  "
              f"{z['rolle']:<5}  {z['szene'][:9]:<9}  {zm:<15} {z['text']}", file=out)
    print("-" * len(linie), file=out)
    for f in a["fehler"]:
        print(f"  [FEHLER]   {f}", file=out)
    for w in a["zeit"]:
        print(f"  [ZEIT]     {w}", file=out)
    for h in a["hinweis"]:
        print(f"  [HINWEIS]  {h}", file=out)
    if not a["fehler"]:
        print("  Kein FEHLER in den geprüften Regeln." +
              (" Die Zeit liegt noch außerhalb des Ziels." if a["zeit"] else ""), file=out)
    print("", file=out)


def zeige_uebersicht(liste, out=sys.stdout):
    print("ÜBERSICHT", file=out)
    print("=" * 78, file=out)
    print(f"  {'Reel':<42}{'Wörter':>7}{'Sätze':>6}{'Reel-s':>8}{'Hook-s':>8}  Fehler", file=out)
    for a in liste:
        t = a["titel"] if len(a["titel"]) <= 40 else a["titel"][:37] + "..."
        print(f"  {t:<42}{a['woerter']:>7}{a['saetze']:>6}{zahl(a['reel_sekunden']):>8}{zahl(a['hook_ende']):>8}  "
              f"{len(a['fehler'])}", file=out)
    print("\nZeiten sind Schätzungen (je Satz grob 10 bis 20 % daneben). Maßgeblich ist die echte Aufnahme.\n", file=out)


def zeige_messung(m, out=sys.stdout):
    print(f"\nMESSUNG · {m['datei']}", file=out)
    print("=" * 78, file=out)
    print(f"  {m['woerter']} Wörter, {m['saetze']} Sätze, {m['silben']} Silben in Stimmenfassung", file=out)
    print(f"  {'Satz':<5}{'Silben':>7}{'gemessen':>10}{'geschätzt':>11}{'Abw.':>8}   Text", file=out)
    for z in m["saetze_detail"]:
        t = z["text"] if len(z["text"]) <= 40 else z["text"][:37] + "..."
        ab = zahl(z["abweichung_prozent"], 0) if z["abweichung_prozent"] is not None else "-"
        print(f"  {z['satz']:<5}{z['silben']:>7}{zahl(z['gemessen']):>8} s{zahl(z['geschaetzt']):>9} s{ab:>6} %   {t}", file=out)
    print("-" * 78, file=out)
    print(f"  erstes Wort bei {zahl(m['erstes_wort_s'], 2)} s, letztes Wort endet bei {zahl(m['letztes_wort_ende_s'], 2)} s", file=out)
    if m["pausen"]:
        print(f"  Satzpausen: {', '.join(zahl(p, 2) for p in m['pausen'])} s (Mittel {zahl(m['pause_mittel'], 2)} s)", file=out)
    print(f"  Reel-Länge gemessen {zahl(m['reel_sekunden_gemessen'])} s (letztes Wort + {zahl(NACHLAUF)} s), geschätzt "
          f"{zahl(m['reel_sekunden_geschaetzt'])} s ({zahl(m['abweichung_gesamt_prozent'], 1)} %)", file=out)
    if m["abweichung_je_satz_mittel_prozent"] is not None:
        print(f"  Abweichung je Satz im Mittel {zahl(m['abweichung_je_satz_mittel_prozent'], 0)} %", file=out)
    if m["wpm_netto_gemessen"]:
        print(f"  reine Sprechzeit: {zahl(m['wpm_netto_gemessen'], 0)} Wörter/Min.", file=out)
    if m["wpm_kalibriert"]:
        p = m["pause_mittel"] if m["pause_mittel"] is not None else PAUSE
        print(f"  Nachziehen: --wpm {m['wpm_kalibriert']:.0f} --pause {p:.2f}", file=out)
    print("", file=out)


def main():
    ap = argparse.ArgumentParser(
        description="Sprechtext eines VAMELA-Reels als Beat-Tabelle mit Zeiten und Regelprüfung.",
        epilog="Mit Eingabe, --wortzeiten und --json kommt genau ein JSON-Objekt: {\"reels\": [...], \"messung\": {...}}.")
    ap.add_argument("input", nargs="?", default=None, help="Skript, Reel-Block oder Vorratsdatei; - für Stdin")
    ap.add_argument("--text", help="Sprechtext direkt auf der Kommandozeile")
    ap.add_argument("--wpm", type=float, default=WPM, help=f"Tempo ohne Pausen in Wörtern pro Minute (Standard {WPM:.0f})")
    ap.add_argument("--pause", type=float, default=PAUSE, help=f"Pause zwischen zwei Sätzen in Sekunden (Standard {PAUSE})")
    ap.add_argument("--woerter", action="store_true", help="nur nach Wortzahl rechnen statt nach Silben")
    ap.add_argument("--angebot", choices=["werkzeug", "entwurf", "keins"], help="Angebot (für \"Link in der Bio\")")
    ap.add_argument("--min", type=float, default=DAUER_MIN, dest="dauer_min", help="kürzeste Reel-Länge in s (Standard 15)")
    ap.add_argument("--max", type=float, default=DAUER_MAX, dest="dauer_max", help="längste Reel-Länge in s (Standard 25)")
    ap.add_argument("--szenen", help="Datei mit Szenenzeilen (\"1. nacht: …\"), wenn sie nicht im Block stehen")
    ap.add_argument("--projekt", help="Projektordner vamela-insta: Preise aus data/fakten.json, bild:-Szenen in "
                                      f"bilder/vorrat/ (ohne Angabe {PROJEKT_STANDARD}, wenn es ihn gibt)")
    ap.add_argument("--stimmentext", action="store_true", help="nur den Text ausgeben, wie er an die Stimme geht")
    ap.add_argument("--wortzeiten", help="Wortzeiten einer Aufnahme (stimme/<id>.woerter.json) mit der Schätzung vergleichen")
    ap.add_argument("--json", action="store_true",
                    help="JSON statt Tabelle; mit Eingabe und --wortzeiten ein Objekt {\"reels\": [...], \"messung\": {...}}")
    args = ap.parse_args()
    if args.wpm <= 0 or args.pause < 0:
        print("--wpm muss größer als 0 sein, --pause mindestens 0", file=sys.stderr)
        sys.exit(2)
    if args.stimmentext and args.wortzeiten:
        print("--stimmentext und --wortzeiten gehen nicht zusammen: --stimmentext gibt nur den Text für die Stimme aus",
              file=sys.stderr)
        sys.exit(2)

    # Wortzeiten zuerst: Sind sie kaputt, gibt es Ausgang 2 und keinen halben Bericht.
    m = None
    if args.wortzeiten:
        try:
            m = messung(args.wortzeiten, args.wpm, args.pause, args.woerter)
        except (OSError, ValueError, KeyError, IndexError, TypeError, ZeroDivisionError) as e:
            print(f"Wortzeiten nicht lesbar: {e}", file=sys.stderr)
            sys.exit(2)
        if args.input is None and not args.text:
            print(json.dumps(m, indent=2, ensure_ascii=False)) if args.json else zeige_messung(m)
            return
    if args.input is None and not args.text:
        args.input = "-"
    projekt = args.projekt
    if projekt is not None and not os.path.isdir(projekt):
        print(f"Projektordner nicht gefunden: {projekt}", file=sys.stderr)
        sys.exit(2)
    if projekt is None:
        projekt = projekt_standard()
    preise, preise_grund = lade_preise(projekt)
    try:
        if args.text:
            raw = args.text
        elif args.input == "-":
            raw = sys.stdin.read()
        else:
            with open(args.input, encoding="utf-8") as f:
                raw = f.read()
        szenen = None
        if args.szenen:
            with open(args.szenen, encoding="utf-8") as f:
                szenen, _ = szenen_liste("**Szenen**\n" + unicodedata.normalize("NFC", f.read()))
    except (OSError, UnicodeDecodeError) as e:
        print(f"Eingabe nicht lesbar: {e}", file=sys.stderr)
        sys.exit(2)

    reels = lese_eingabe(raw)
    if args.stimmentext:
        texte = [stimmentext(r["sprechtext"]) for r in reels if r["sprechtext"].strip()]
        if not texte:
            print("leerer Sprechtext", file=sys.stderr)
            sys.exit(2)
        print("\n".join(texte))
        return
    ergebnisse = []
    for r in reels:
        a = analysiere(r, wpm=args.wpm, pause=args.pause, nach_woertern=args.woerter, angebot=args.angebot,
                       dauer_min=args.dauer_min, dauer_max=args.dauer_max, szenen=szenen, projekt=projekt,
                       preise=preise, preise_grund=preise_grund)
        if a:
            ergebnisse.append(a)
    if not ergebnisse:
        print("leerer Sprechtext (bei einem Reel-Block fehlt \"- Sprechtext: …\")", file=sys.stderr)
        sys.exit(2)

    if args.json:
        daten = ergebnisse if len(ergebnisse) > 1 else ergebnisse[0]
        if m is not None:
            daten = {"reels": ergebnisse, "messung": m}
        print(json.dumps(daten, indent=2, ensure_ascii=False))
    else:
        for a in ergebnisse:
            zeige(a)
        if len(ergebnisse) > 1:
            zeige_uebersicht(ergebnisse)
        else:
            print("Zeiten sind Schätzungen (je Satz grob 10 bis 20 % daneben). Maßgeblich ist die echte Aufnahme.\n")
        if m is not None:
            zeige_messung(m)
    sys.exit(1 if any(a["fehler"] for a in ergebnisse) else 0)


if __name__ == "__main__":
    main()
