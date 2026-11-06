#!/usr/bin/env python3
"""
caption.py: prüft eine Caption für @vamela.de (Instagram, gespiegelt auf
TikTok) und zeigt im Kasten, was der Feed vor dem „… mehr“ zeigt.

Der Feed zeigt ungefähr die ersten 125 Zeichen, der Rest steckt hinter dem
Tippen. Die Zahl ist eine Näherung: Gerät, Schriftgröße und Zeilenumbrüche
verschieben sie. Deshalb gehört der konkrete Haken mit Abstand vor die Grenze,
am besten in die erste Zeile. Der Kasten schneidet nie mitten in einem
sichtbaren Zeichen (Umlaut, auch zerlegt, Emoji mit Hautton, Flagge) und, wo
es geht, nicht mitten im Wort.

Aufruf
  python3 -I caption.py caption.txt
  python3 -I caption.py caption.txt --keywords "QR Code erstellen kostenlos,Freising"
  python3 -I caption.py caption.txt --angebot werkzeug --hook "Text vom Cover"
  python3 -I caption.py caption.txt --typ karussell --keywords "QR Code erstellen kostenlos"
  python3 -I caption.py caption.txt --plattform tiktok
  pbpaste | python3 -I caption.py -
  python3 -I caption.py caption.txt --json
  python3 -I caption.py --selbsttest

Eingabe: die Caption, gern mit der Zeile „**Hashtags:** …“, oder ein ganzer
Vorratsblock ab „**Caption:**“. Preise und vamela.de-Pfade gleicht das
Werkzeug mit data/fakten.json ab, TikTok-Hashtags mit plan/tiktok-hashtags.json,
wenn es den Projektordner findet (--projekt, sonst aufwärts ab dem aktuellen
Ordner, sonst ~/vamela-insta). Kein Netz, nur Standardbibliothek, Python 3.9.

Exit-Code: 0 BEREIT, 1 PRÜFEN (nur Warnungen), 2 ÜBERARBEITEN (Fehler) oder Aufruffehler.
"""

import argparse
import json
import os
import re
import sys
import unicodedata

GRENZE = 2200        # ganze Caption mit Hashtags (automatik/instagram.mjs, MAX_CAPTION)
VORRAT_MAX = 2100    # Caption ohne Hashtags (automatik/pruefe-block.mjs lehnt längere ab)
FENSTER = 125        # sichtbar vor „… mehr“, Näherung
KASTEN = 52          # Innenbreite des Kastens in Spalten
HASHTAG_MAX = {"instagram": 5, "tiktok": 3}   # Projektregel; TikTok: 3 kuratierte
EMOJI_MAX = 3        # „sparsam“: ab dem vierten Emoji gibt es eine Warnung
STUFE = {"OK": 0, "WARN": 1, "FEHLER": 2}
URTEIL = {0: "BEREIT", 1: "PRÜFEN", 2: "ÜBERARBEITEN"}

# ---------------------------------------------------------------- Unicode


def _bereiche(spec):
    out = []
    for teil in spec.split():
        a, _, b = teil.partition("-")
        out.append((int(a, 16), int(b or a, 16)))
    return tuple(out)


# Emoji laut Unicode-Emoji-Liste (Emoji=Yes), ohne Ziffern, # und *.
EMOJI_BEREICHE = _bereiche("""
    1F004 1F0CF 1F170-1F171 1F17E-1F17F 1F18E 1F191-1F19A 1F1E6-1F1FF 1F201-1F251
    1F300-1F64F 1F680-1F6FF 1F7E0-1F7FF 1F90C-1F9FF 1FA70-1FAFF
    231A-231B 2328 23CF 23E9-23F3 23F8-23FA 2600-2604 260E 2611 2614-2615 2618 261D
    2620 2622-2623 2626 262A 262E-262F 2638-263A 2640 2642 2648-2653 265F-2660 2663
    2665-2666 2668 267B 267E-267F 2692-2697 2699 269B-269C 26A0-26A1 26A7 26AA-26AB
    26B0-26B1 26BD-26BE 26C4-26C5 26C8 26CE-26CF 26D1 26D3-26D4 26E9-26EA 26F0-26F5
    26F7-26FA 26FD 2702 2705 2708-270D 270F 2712 2714 2716 271D 2721 2728 2733-2734
    2744 2747 274C 274E 2753-2755 2757 2763-2764 2795-2797 27B0 27BF 2B1B-2B1C 2B50 2B55
""")
# Typografische Zeichen, die nur mit Variantenwähler FE0F als Emoji gelten (© ® ™ Pfeile …).
NUR_MIT_FE0F = _bereiche("""
    00A9 00AE 203C 2049 2122 2139 2194-2199 21A9-21AA 24C2 25AA-25AB 25B6 25C0
    25FB-25FE 27A1 2934-2935 2B05-2B07 3030 303D 3297 3299
""")
VS16, ZWJ, KAPPE = "\ufe0f", "\u200d", "\u20e3"
BINDE = "-\u2010\u2011"          # Bindestrich, Trennstrich, geschützter Bindestrich


def _in(cp, bereiche):
    return any(a <= cp <= b for a, b in bereiche)


def _haengt_an(ch):
    """Zeichen, die am vorigen hängen: Kombinationszeichen (zerlegte Umlaute), ZWJ, Varianten, Hauttöne, Tags."""
    cp = ord(ch)
    return (cp == 0x200D or 0xFE00 <= cp <= 0xFE0F or 0x1F3FB <= cp <= 0x1F3FF
            or 0xE0020 <= cp <= 0xE007F or 0xE0100 <= cp <= 0xE01EF
            or unicodedata.category(ch) in ("Mn", "Me", "Mc"))


def _ri(ch):
    return 0x1F1E6 <= ord(ch) <= 0x1F1FF


def graphemes(text):
    """Teilt in sichtbare Zeichen (vereinfachte Graphem-Cluster nach UAX 29)."""
    out, i, n = [], 0, len(text)
    while i < n:
        j = i + 1
        if _ri(text[i]) and j < n and _ri(text[j]):
            j += 1                                    # Flagge = zwei Regional-Indikatoren
        while j < n and (_haengt_an(text[j]) or (text[j - 1] == ZWJ and not text[j].isspace())):
            j += 1
        out.append(text[i:j])
        i = j
    return out


def ist_emoji(g):
    if KAPPE in g:
        return True                                   # Tastenkappe: Ziffer, FE0F, 20E3
    return any(_in(ord(ch), EMOJI_BEREICHE) or (VS16 in g and _in(ord(ch), NUR_MIT_FE0F)) for ch in g)


def _gbreite(g):
    """Spalten im Terminal: Emoji und breite Zeichen 2, Kombinationszeichen 0."""
    if VS16 in g or KAPPE in g or any(ord(ch) >= 0x1F000 and _in(ord(ch), EMOJI_BEREICHE) for ch in g):
        return 2
    breite = 0
    for ch in g:
        if not _haengt_an(ch):
            breite = max(breite, 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1)
    return breite


def anzeigebreite(text):
    return sum(_gbreite(g) for g in graphemes(text))


def utf16(text):
    """So zählt die Automatik (JavaScript .length): Emoji außerhalb der BMP zählen doppelt."""
    return len(text.encode("utf-16-le")) // 2


def normalisiere(text):
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")
    if text.startswith("\ufeff"):
        text = text[1:]
    return unicodedata.normalize("NFC", text)


def zahl(n):
    return "{:,}".format(n).replace(",", ".")

# ---------------------------------------------------------------- Fenster und Kasten


def sichtbares_fenster(text, grenze=FENSTER):
    """Was der Feed vor „… mehr“ zeigt: (Text, abgeschnitten?).

    Schnitt immer an einer Graphem-Grenze, möglichst vor einem Wort. Ist das letzte
    Wort so lang, dass mehr als 40 % des Fensters verloren gingen, schneidet er hart.
    """
    gs = graphemes(text)
    if len(gs) <= grenze:
        return text, False
    schnitt = grenze
    if not gs[grenze].isspace() and not gs[grenze - 1].isspace():
        k = grenze - 1
        while k > 0 and not gs[k].isspace():
            k -= 1
        if k >= grenze * 0.6:
            schnitt = k
    return "".join(gs[:schnitt]).rstrip(), True


def umbrechen(zeile, breite=KASTEN):
    """Bricht nach Anzeigebreite um, an Leerzeichen, ein überlanges Wort an einer Graphem-Grenze."""
    teile, akt = [], []
    for g in graphemes(zeile):
        w = _gbreite(g)
        while akt and sum(_gbreite(x) for x in akt) + w > breite:
            luecke = max((i for i, x in enumerate(akt) if x == " "), default=-1)
            if luecke > 0:
                teile.append("".join(akt[:luecke]).rstrip())
                akt = akt[luecke + 1:]
            else:
                teile.append("".join(akt))
                akt = []
        if g == " " and not akt:
            continue
        akt.append(g)
    teile.append("".join(akt).rstrip())
    return teile


def zeichne_kasten(fenster, abgeschnitten, aus, breite=KASTEN, max_zeilen=8):
    print("\n  SO ZEIGT ES DER FEED", file=aus)
    print("  ┌" + "─" * (breite + 2) + "┐", file=aus)
    zeilen = []
    for roh in fenster.split("\n"):
        zeilen.extend(umbrechen(roh, breite))
    if len(zeilen) > max_zeilen:
        zeilen = zeilen[:max_zeilen - 1] + ["…"]
    for z in zeilen:
        print("  │ " + z + " " * max(0, breite - anzeigebreite(z)) + " │", file=aus)
    ende = " … mehr ─" if abgeschnitten else " passt ganz ─"
    print("  └" + "─" * (breite + 2 - len(ende)) + ende + "┘", file=aus)

# ---------------------------------------------------------------- Muster

CAPTION_LABEL = re.compile(r"^[ \t]*\**[ \t]*caption[ \t]*:[ \t]*\**[ \t]*", re.I | re.M)
TAG_LABEL = re.compile(r"^[ \t]*\**[ \t]*hashtags?[ \t]*:?[ \t]*\**[ \t]*", re.I)
HASHTAG_RE = re.compile(r"(?<![\w&/#])#(?=\w*[^\W\d_])\w+")      # mindestens ein Buchstabe, Umlaute erlaubt
TAG_TOKEN = re.compile(r"#(?=\w*[^\W\d_])\w+")
ERWAEHNUNG_RE = re.compile(r"(?<![\w@.])@(\w(?:[\w.]*\w)?)")
WORT_RE = re.compile(r"[^\W_]+(?:[" + BINDE + r"][^\W_]+)*")      # Buchstaben und Ziffern, Unicode
URL_RE = re.compile(r"\bhttps?://[^\s<>\"“”„]+|\bwww\.[^\s<>\"“”„]+", re.I)
DOMAIN_RE = re.compile(
    r"(?<![\w@./-])((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+"
    r"(?:de|com|net|org|io|ai|app|info|eu|at|ch|co|dev|me|tv|shop|online|site|xyz|so|gg|ly))"
    r"(?![\w-])(/[^\s<>\"“”„,;)]*)?", re.I)
VAMELA_RE = re.compile(r"(?<![\w-])vamela\.([a-z]{2,})\b(/[^\s<>\"“”„,;)]*)?", re.I)
HANDLE_RE = re.compile(r"(?<![\w@.])@vamela(?!\.[a-z])\w*", re.I)
GITHUB_RE = re.compile(r"(?<![\w.-])github\.com/([\w.-]+)/([\w.-]+)", re.I)

GRUSS_RE = re.compile(
    r"^\W*(?:hallo|hallöchen|hey|hi|servus|grüß\s*(?:gott|di|dich|euch)|griaß\s*(?:di|eich)|moin"
    r"|guten\s+(?:morgen|tag|abend)|hello|na\s+ihr"
    r"|liebe\s+(?:leute|community|follower\w*|freunde|alle|kund\w*|leser\w*))\b", re.I)

# Aufforderungen. Folgen-Satz und Schlussfrage gehören zum Aufbau (docs/strategie.md),
# die übrigen sind Handlungen: davon reicht eine.
CTA = (
    # nur Imperative: „speicherst es“ oder „das Werkzeug speichert das“ sind keine Aufforderung
    ("Speichern", re.compile(
        r"\bspeichere?\s+(?:dir|euch)\b|\bspeichert\s+euch\b"
        r"|\bspeichere?\s+(?:den|diesen)\s+(?:beitrag|post|tipp|karussell|reel)\b"
        r"|\bspeichere?\s+(?:es|das|dies|ihn)\s*(?:[,.!]|$|\s+(?:für|ab)\b)"
        r"|\b(?:beitrag|post|karussell|tipp|reel|liste|checkliste)\s+(?:jetzt\s+|gleich\s+)?speichern\b"
        r"|(?:^|[.!?:]\s+)speichern\b|\b(?:jetzt|gleich|unbedingt|am\s+besten)\s+speichern\b", re.I | re.M)),
    ("Teilen", re.compile(
        r"\bteile?\s+(?:den|diesen|dieses|das)\s+(?:beitrag|post|tipp|karussell|reel|video)\b"
        r"|\bteile?\s+(?:es|das|ihn|dies)(?:\s+(?:mit|jemandem|deine\w*|einem|einer)\b|\s*(?:[,!]|$))"
        r"|\b(?:schicke?|sende?|leite?)\s+(?:es|das|ihn|den\s+beitrag|diesen\s+beitrag|den\s+post)\s+"
        r"(?:an|jemandem|weiter|deine\w*|einem|einer)\b"
        r"|(?:^|[.!?:]\s+)teilen\b|\b(?:beitrag|post|tipp)\s+teilen\b", re.I | re.M)),
    ("Kommentieren", re.compile(
        r"\bkommentier(?:e|t|en)?\b|\bin\s+(?:die|den)\s+kommentar(?:e|en)\b", re.I)),
    ("Link in der Bio", re.compile(
        r"\blink\s+(?:ist\s+|steht\s+|findest\s+du\s+)?(?:in\s+(?:der\s+|meiner\s+|unserer\s+)?bio|im\s+profil)\b", re.I)),
    ("Nachricht", re.compile(
        r"\b(?:schreib|schick)\w*\s+(?:mir|uns)\s+(?:eine\s+|gern\w*\s+)?(?:nachricht|dm|pn)\b"
        r"|\bper\s+(?:dm|pn|nachricht|direktnachricht)\b", re.I)),
    ("Folgen-Satz", re.compile(r"\bfolg(?:e|t)?\s+(?:@\w[\w.]*|mir|uns)\b", re.I)),
)
HANDLUNGEN = ("Speichern", "Teilen", "Kommentieren", "Link in der Bio", "Nachricht")
LINK_BIO_RE = dict(CTA)["Link in der Bio"]          # auch Varianten („Link im Profil“), für Aufforderungen
BIO_WOERTLICH_RE = re.compile(r"link in der bio", re.I)   # genau so prüft automatik/pruefe-block.mjs

MITNEHMEN_RE = re.compile(r"\bzum\s+mitnehmen\s*[:\u2013-]", re.I)
FOLGE_VAMELA_RE = re.compile(r"\bfolg(?:e|t)?\s+@vamela\.de\b", re.I)
REPO_ZEILE_RE = re.compile(r"\brepo:\s*github\.com/[\w.-]+/[\w.-]+", re.I)
LIZENZ_RE = re.compile(r"\blizenz:\s*\S", re.I)
STERNE_RE = re.compile(r"\brund\s+[\d.]+\s+sterne\b", re.I)
STAND_RE = re.compile(r"\bstand\s+\d{1,2}\.\d{1,2}\.\d{4}\b", re.I)

FUELL_TAGS = {"#viral", "#fyp", "#foryou", "#foryoupage", "#fy", "#fürdich", "#fürdichseite", "#explore",
              "#explorepage", "#trending", "#instagood", "#love", "#follow", "#followme", "#follow4follow",
              "#f4f", "#like4like", "#l4l", "#likeforlike", "#reels", "#reelsinstagram", "#viralreels",
              "#instadaily", "#photooftheday", "#picoftheday", "#instalike", "#bhfyp", "#tbt"}
MARKEN_TAGS = {"#github", "#instagram", "#facebook", "#meta", "#tiktok", "#canva", "#figma", "#adobe",
               "#photoshop", "#illustrator", "#chatgpt", "#openai", "#claude", "#gemini", "#wordpress",
               "#wix", "#jimdo", "#shopify", "#squarespace", "#apple", "#iphone", "#microsoft", "#windows",
               "#whatsapp", "#google"}
ORTSTAGS = {"#freising", "#erding", "#moosburg", "#landkreisfreising", "#landkreiserding", "#haag",
            "#haaganderamper", "#landshut", "#dachau"}

# Füllwörter wie automatik/suchbegriffe.mjs (FUELL), damit die Zählung der Automatik entspricht.
FUELL = {"der", "die", "das", "dein", "deine", "deinen", "ein", "eine", "im", "in", "auf", "mit", "ohne", "zum",
         "zur", "vom", "von", "für", "und", "oder", "ist", "wie", "was", "statt", "den", "dem", "des", "so", "als"}

# Konkretheit ohne Großschreibung: Zahlen, Zahlwörter, Gegenstände aus der Welt der Betriebe,
# Nutzenversprechen („So prüfst du“) und die Suchbegriffe.
ZAHLWOERTER = {"zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf",
               "zwanzig", "dreißig", "fünfzig", "hundert", "tausend", "einmal", "zweimal", "dreimal",
               "doppelt", "halb", "halbe", "halben"}
ANKER_GANZ = {"qr", "ki", "pdf", "svg", "png", "jpg", "jpeg", "eps", "dxf", "dpi", "px", "cm", "mm", "hex", "rgb",
              "cmyk", "ral", "seo", "url", "app", "wlan", "vcard", "pc", "mac", "ssl", "html", "css", "maps",
              "github", "repo", "repos", "repository", "opensource", "whatsapp", "navi"}
ANKER = ("website", "webseite", "homepage", "formular", "profil", "bewertung", "eintrag", "kategorie", "flyer",
         "aufsteller", "schild", "briefkopf", "schrift", "farbe", "kontrast", "datei", "vektor", "drucksache",
         "telefon", "öffnungszeit", "girocode", "signatur", "favicon", "hintergrund", "werkzeug", "generator",
         "browser", "checkliste", "handgriff", "schritt", "fehler", "vorlage", "layout", "größe", "format",
         "button", "adresse", "standort", "lesetest", "logo", "foto", "handy", "smartphone", "mail", "spam",
         "ordner", "anfrage", "anruf", "menü", "visitenkarte", "speisekarte", "aushang", "plakat", "banner",
         "aufkleber", "sticker", "schaufenster", "beschriftung", "buchstabe", "navigation", "landingpage",
         "titelbild", "stichwort", "suchbegriff", "keyword", "eingang", "parkplatz")
ANKER_ANFANG = ("bild", "druck", "google", "test")                # nur am Wortanfang (sonst „Vorbild“, „Eindruck“)
ANKER_ENDE = ("seite", "karte", "liste", "regel", "nummer", "code", "name")  # nur ganz oder am Wortende
_ANFANG = ANKER + ANKER_ANFANG
_ENDE_RE = re.compile("(?:" + "|".join(map(re.escape, ANKER + ANKER_ENDE)) + r")[^\W\d_]{0,3}$")
NUTZEN_RE = re.compile(r"\bso\s+[^\W\d_]+(?:st|t)\s+du\b|\bso\s+geht(?:['’]?s|\s+es)?\b|\bwie\s+du\b", re.I)

# Preise: „49 €“, „1.490 €“, „49,- €“, „49 Euro“, „€ 49“.
BETRAG = r"(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}|-{1,2}|\u2013))?"
PREIS_NACH = re.compile(r"(?<![\w.,])" + BETRAG + r"\s?(?:€|euro\b|eur\b)", re.I)
PREIS_VOR = re.compile(r"€\s?" + BETRAG + r"(?![\d,])")
# Streichpreis oder Prozent-Rabatt ist ein Angebot (FEHLER); das Wort allein kann Thema sein
# („Bewertungen mit Rabatten belohnen verstößt gegen die Richtlinien“), also nur WARN.
RABATT_ANGEBOT_RE = re.compile(
    r"\bstatt\s+(?:€\s?\d[\d.]*(?:,\d{1,2}|,-)?|\d[\d.]*(?:,\d{1,2}|,-)?\s?(?:€|euro\b|eur\b))"
    r"|\b\d+\s?(?:%|prozent)\s*(?:rabatt|sparen|günstiger|billiger|reduziert)", re.I)
RABATT_WORT_RE = re.compile(
    r"\b(?:rabatt\w*|aktionspreis\w*|sonderpreis\w*|sonderangebot\w*|preisnachlass\w*|gutscheincode\w*"
    r"|black\s+friday)\b", re.I)
BEISPIEL_DOMAIN_RE = re.compile(r"^(?:www\.)?(?:dein|deine|meine|ihre|beispiel|muster|example)[\w-]*\.", re.I)

# Versprechen und unbelegte Zahlen (CLAUDE.md: keine Erfolgsversprechen, keine erfundenen Statistiken, Erfolgszahlen
# oder Kundenstimmen, nichts „rechtssicher“).
_ZAHLWORT = r"(?:zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwanzig|dreißig|vierzig|fünfzig|hundert|tausend)"
PROZENT = r"(?<![\d.,])\d+(?:,\d+)?\s?(?:%|prozent\b)"
# „3 von 4 Kunden“, „neun von zehn Betrieben“, „jeder dritte Kunde“; nicht „4 von 5 Sternen“, nicht „Seite 2 von 6“
STATISTIK = (r"(?<![\d.,])(?<!seite\s)(?<!schritt\s)(?<!teil\s)(?<!folge\s)(?<!tipp\s)(?<!bild\s)(?<!frage\s)"
             r"\d+\s+von\s+\d+(?![\d.,]*\s*(?:sternen?|punkten)\b)"
             r"|\b(?:eine[mrs]?|" + _ZAHLWORT + r")\s+von\s+" + _ZAHLWORT + r"\b"
             r"|\bjede[mnrs]?\s+(?:zweite|dritte|vierte|fünfte|zehnte)[mnrs]?\s+"
             r"(?:kund|betrieb|nutzer|mensch|firm|unternehm|handwerk|gast|gäst|besucher|website|webseite)\w*")
# „über 200 zufriedene Kunden“, „bereits 30 Websites“, „mehr als zwanzig Betriebe“
ERFOLGSZAHL = (r"\b(?:über|mehr\s+als|bereits|schon|bisher|inzwischen|fast|knapp|rund)\s+(?:\d[\d.]*|" + _ZAHLWORT
               + r"|dutzende?)\s+(?:zufriedene[nr]?\s+|glückliche[nr]?\s+)?"
               r"(?:kund|betrieb|projekt|website|webseite|auftr[aä]g|referenz)\w*")
# Kundenstimme: „meine zufriedenen Kunden“, „200 zufriedene Kunden“, „Zufriedene Kunden sagen: …“. Das bloße
# „zufriedene Kunden“ bleibt frei, es ist im Bewertungs-Tipp üblich („Zufriedene Kunden denken selten von selbst daran“).
KUNDENSTIMME = (r"\b(?:meine[mnrs]?|unsere[mnrs]?|\d[\d.]*|" + _ZAHLWORT + r")\s+(?:[^\W\d_]+\s+)?"
                r"(?:zufriedene|glückliche|begeisterte)[nr]?\s+kund\w*"
                r"|\b(?:(?:zufriedene|glückliche|begeisterte)[nr]?|meine|unsere)\s+kund\w*\s+(?:sagen|schreiben|berichten|meinen)\s*:")
VERSPRECHEN = tuple((re.compile(m, re.I), name, stufe) for m, name, stufe in (
    (r"\bgarantier\w*|\bgarantie\w*", "Garantie", "FEHLER"),
    (r"\bplatz\s*(?:1|eins)\b|\bnummer\s*(?:1|eins)\b|\bnr\.?\s*1\b|(?<![\w#])#1\b"
     r"|\bganz\s+oben\s+bei\s+google\b|\berste[nrs]?\s+(?:platz|seite)\s+bei\s+google\b", "Platz 1", "FEHLER"),
    (r"\brechtssicher(?:e[mnrs]?)?\b|\babmahnsicher(?:e[mnrs]?)?\b|\babmahnfrei\w*", "Rechtsversprechen", "FEHLER"),
    (r"(?<![\d.,])100\s?(?:%|prozent\b)|\bhundert\s?prozent\w*", "100 %", "FEHLER"),
    (r"\b(?:dsgvo|datenschutz|rechts)[-\s]?konform\w*|\brechtssicherheit\b|\babmahnsicherheit\b",
     "Rechtsaussage", "WARN"),
    (PROZENT, "Prozentangabe", "WARN"),
    (STATISTIK, "Statistik ohne Beleg", "WARN"),
    (ERFOLGSZAHL, "Erfolgszahl ohne Beleg", "WARN"),
    (KUNDENSTIMME, "Kundenstimme ohne Beleg", "WARN"),
    (r"\bstudie\w*|\bstatistik\w*|\bumfrage\w*", "Studie oder Statistik", "WARN"),
    (r"\bverdopp\w*|\bverdreifach\w*|\bvervielfach\w*", "Vervielfachung", "WARN"),
))
UNBELEGTE_ZAHLEN = tuple(re.compile(m, re.I) for m in (PROZENT, STATISTIK, ERFOLGSZAHL))   # zählen nicht als Haken
# Zitat als Kundenstimme: Sprechverb im selben Satz davor oder dahinter („Kunden sagen: „…““) oder ein Name
# dahinter („…“ – Anna, wie automatik/story-regeln.mjs).
ZITAT_RE = re.compile(r"[„\"»«‚][^„“”\"»«\n]{3,200}[“”\"«»‘]")
SAGT_RE = re.compile(r"\b(?:sagt|sagen|sagte|sagten|schreibt|schrieb|schrieben|meint|meinte|meinten|erzählt|erzählte"
                     r"|berichtet|berichten|berichtete|lobt|loben|lobte|schwärmt|schwärmen|bestätigt|bestätigen)\b", re.I)
NAME_NACH_ZITAT_RE = re.compile(r"\s*[–—-]\s*[A-ZÄÖÜ][a-zäöüß]+")
NEG_RE = re.compile(r"\b(?:nicht|kein\w*|nie|niemals|niemand|ohne|weder|nirgends)\b", re.I)

# Rechtstexte nie anbieten oder verkaufen, Rechtsthemen nur mit Verweis auf Anwältin oder Anwalt (CLAUDE.md,
# docs/auftrag.md). „Datenschutz“ allein ist hier kein Rechtstext, weil es auch eine Eigenschaft eines Werkzeugs sein
# kann („Passwort bleibt im Browser, Datenschutz inklusive“); es zählt als Rechtsthema.
RECHTSTEXT_RE = re.compile(
    r"impressum\w*|\brechtstext\w*|\bdatenschutz[" + BINDE + r" ]?(?:erklärung|hinweis|seite|richtlinie|bestimmung|text)\w*"
    r"|\bagb(?:s|['’]s)?\b|\ballgemeinen?\s+geschäftsbedingungen\b|\bwiderrufsbelehrung\w*|\bnutzungsbedingungen\b"
    r"|\bcookie[" + BINDE + r" ]?richtlinie\w*", re.I)
RECHTSTHEMA_RE = re.compile(
    r"(?:impressum|datenschutz|geschäftsbedingung|nutzungsbedingung)\w*|\b(?:dsgvo|abmahn|widerruf|rechtstext)\w*"
    r"|\bagb(?:s|['’]s)?\b|\bcookie[" + BINDE + r" ]?banner\w*", re.I)     # wie RECHTSTHEMA in automatik/story-regeln.mjs
ANWALT_RE = re.compile(r"anw[aä]lt|kanzlei", re.I)
_TUN = r"(?:schreib|erstell|mach|bau|übernehm|kümmer|liefer|biet|formulier|setz|richt|pfleg|prüf|check|helf)"
# Angebot im selben Satz: „bei mir“, „ich erstelle“, „mach ich“, „inklusive“, „im Paket“; dazu „Link in der Bio“ und Preise.
# „für dich“ zählt nicht („Ein Impressum ist Pflicht, auch für dich“ ist ein Tipp, kein Angebot).
RECHT_ANGEBOT_RE = re.compile(
    r"\b(?:bei|von)\s+(?:mir|uns)\b|\b(?:ich|wir)\s+" + _TUN + r"\w*|\b" + _TUN + r"\w*\s+(?:ich|wir)\b"
    r"|\binkl\b|\binklusive\b|\bim\s+(?:paket|preis)\b|\bmit\s+(?:dabei|drin)\b|\bgleich\s+mit\b|\bdazu\s+gibt\s+es\b", re.I)
ABKUERZUNG_RE = re.compile(r"\b(?:inkl|zzgl|ggf|bzw|ca|evtl|usw|etc|nr|vgl|bspw|z\.\s?b|d\.\s?h|u\.\s?a)\.", re.I)

SIE_RE = re.compile(r"(?<=[^\s.!?:„“\"«»(])\s+(Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)\b")  # nur mitten im Satz
MARKUP_RE = re.compile(r"\*\*[^*\n]+\*\*|(?<![\w*])\*[^*\s][^*\n]*\*(?![\w*])|(?<!\w)_[^_\s][^_\n]*_(?!\w)|==[^=\n]+==")
PLATZHALTER_RE = re.compile(r"\{\{[^}]*\}\}|\bTODO\b|\bXXX+\b|\blorem\s+ipsum\b", re.I)
AUFGABE_RE = re.compile(r"\baufgabe\s*[12]\b", re.I)
DEKO_NR_RE = re.compile(r"^[ \t]*(?:0[1-9](?=[\s.)])|\d{1,2}\s?/\s?\d{1,2}(?=\s|$))", re.M)

# ---------------------------------------------------------------- Hilfen


def punkt(name, status, detail, hinweise=()):
    return {"pruefpunkt": name, "status": status, "detail": detail, "hinweise": list(hinweise)}


def schlimmer(a, b):
    return a if STUFE[a] >= STUFE[b] else b


def ist_tagzeile(zeile):
    rest = TAG_LABEL.sub("", zeile, count=1)
    teile = [t for t in re.split(r"[\s,;·|]+", rest.strip()) if t]
    return bool(teile) and all(TAG_TOKEN.fullmatch(t.rstrip(".")) for t in teile)


def extrahiere(text):
    """Nimmt aus einem Vorratsblock nur die Caption (ab „**Caption:**“ bis zur Hashtag-Zeile)."""
    m = CAPTION_LABEL.search(text)
    if not m:
        return text
    zeilen = text[m.end():].split("\n")
    for i, z in enumerate(zeilen):
        if TAG_LABEL.match(z) and ist_tagzeile(z):
            return "\n".join(zeilen[:i + 1])
    for i, z in enumerate(zeilen):
        if i and re.match(r"(?:#{1,6}\s|\|)", z):
            return "\n".join(zeilen[:i])
    return "\n".join(zeilen)


def such_tokens(text):
    """Wörter klein und ohne Satzzeichen, wie inhaltsWoerter() in automatik/suchbegriffe.mjs."""
    return re.sub(r"[^\w\s]|_", " ", text.lower()).split()


def inhalt(tokens):
    return [w for w in tokens if w not in FUELL]


def inhaltswoerter_js(text):
    """Genau wie inhaltsWoerter() in automatik/suchbegriffe.mjs: klein, Läufe aus Buchstaben und den Ziffern 0 bis 9,
    ohne Füllwörter. Grundlage für phrasenTags() und captionMitPhrase()."""
    t = "".join(ch if unicodedata.category(ch)[0] == "L" or "0" <= ch <= "9" else " " for ch in text.lower())
    return [w for w in t.split() if w not in FUELL]


def phrasen_tags(phrase):
    """Wie phrasenTags() in automatik/suchbegriffe.mjs: ganze Phrase, die ersten zwei Wörter, das erste Wort,
    je 3 bis 24 Zeichen (JavaScript-Länge), höchstens 2."""
    w = inhaltswoerter_js(phrase)
    tags = []
    for t in ("".join(w), "".join(w[:2]), w[0]) if w else ():
        if 3 <= utf16(t) <= 24 and t not in tags:
            tags.append(t)
    return ["#" + t for t in tags[:2]]


def saetze(text):
    """Sätze und Zeilen. Abkürzungen wie „inkl.“ oder „z. B.“ beenden keinen Satz (ihr Punkt fällt dafür weg)."""
    t = ABKUERZUNG_RE.sub(lambda m: m.group(0).replace(".", ""), text)
    return [s.strip() for s in re.split(r"(?<=[.!?…])\s+|\n+", t) if s.strip()]


ENDUNGEN = ("e", "en", "n", "s", "es", "er", "ern", "em")


def _wortform(a, b):
    """Weichen a und b nur in einer Endung ab (Bewertung, Bewertungen)?"""
    k, l = (a, b) if len(a) <= len(b) else (b, a)
    return a != b and len(k) >= 3 and l.startswith(k) and l[len(k):] in ENDUNGEN


def _teilfolge(nadel, heu):
    n = len(nadel)
    return n > 0 and any(heu[i:i + n] == nadel for i in range(len(heu) - n + 1))


def endet_mit_frage(text):
    gs = graphemes(text.rstrip())
    while gs and (ist_emoji(gs[-1]) or gs[-1].isspace() or gs[-1] in "“”\"'»«)"):
        gs.pop()
    return bool(gs) and gs[-1] == "?"


def _ist_anker(w):
    return (w in ANKER_GANZ or (w.endswith("s") and w[:-1] in ANKER_GANZ)
            or w.startswith(_ANFANG) or bool(_ENDE_RE.search(w)))


def _hooknorm(s):
    s = re.sub(r"\*\*|==|[*_]", "", s)
    s = re.sub(r"[„“”\"‚‘’'»«]", "", s)
    s = re.sub(r"\s*/\s*", " ", s)
    return re.sub(r"\s+", " ", s).strip().lower().rstrip(".!?:…")


def _verneint(text, start, ende):
    a = max(text.rfind(c, 0, start) for c in ".!?\n") + 1
    vor = " ".join(text[a:start].split()[-8:])
    return bool(NEG_RE.search(vor) or re.match(r"\s*(?:nicht|nie)\b", text[ende:ende + 20], re.I))


def preise_in(text):
    funde, belegt = [], []
    for rx in (PREIS_NACH, PREIS_VOR):
        for m in rx.finditer(text):
            if any(a < m.end() and m.start() < b for a, b in belegt):
                continue
            belegt.append((m.start(), m.end()))
            wert = str(int(m.group(1).replace(".", "")))
            dez = m.group(2) or ""
            if dez.isdigit() and int(dez):
                wert += "," + dez.ljust(2, "0")
            funde.append((m.start(), re.sub(r"\s", " ", m.group(0)), wert))
    return [(roh, wert) for _, roh, wert in sorted(funde)]


def fakten_preise(fakten):
    tabelle = {}
    for p in (fakten or {}).get("preise", []):
        if isinstance(p, dict):
            for roh, wert in preise_in(str(p.get("text", ""))):
                tabelle.setdefault(wert, []).append((roh, str(p.get("bedeutung", "")).strip()))
    return tabelle


def fakten_pfade(fakten):
    pfade = set()
    for feld in ("werkzeuge", "eigene_seiten", "referenzen"):
        for e in (fakten or {}).get(feld, []):
            if isinstance(e, dict) and e.get("pfad"):
                pfade.add(str(e["pfad"]).strip("/").lower())
    return pfade


def tiktok_liste(daten):
    tags = set()
    for feld in ("gruppen", "themen"):
        for liste in ((daten or {}).get(feld) or {}).values():
            if isinstance(liste, list):
                tags.update(unicodedata.normalize("NFC", str(t)).lower() for t in liste)
    return tags

# ---------------------------------------------------------------- Prüfpunkte


def pruefe_laenge(gepostet, koerper):
    g, k = utf16(gepostet), utf16(koerper)
    hinweise = []
    if g != len(gepostet):
        hinweise.append("Emojis außerhalb der Grundebene zählen doppelt, so zählt auch die Automatik")
    if not koerper.strip():
        return punkt("LÄNGE", "FEHLER", "die Caption hat keinen Text", hinweise)
    if not WORT_RE.search(koerper):
        return punkt("LÄNGE", "FEHLER", "die Caption hat keinen lesbaren Text (nur Emojis, Zeichen oder unsichtbare "
                                         "Zeichen): kein Hook, kein Mehrwert", hinweise)
    if g > GRENZE:
        return punkt("LÄNGE", "FEHLER", "{} / {} Zeichen, {} zu viel".format(zahl(g), zahl(GRENZE), zahl(g - GRENZE)), hinweise)
    if k > VORRAT_MAX:
        return punkt("LÄNGE", "FEHLER", "ohne Hashtags {} / {} Zeichen, automatik/pruefe-block.mjs lehnt das ab".format(
            zahl(k), zahl(VORRAT_MAX)), hinweise)
    return punkt("LÄNGE", "OK", "{} / {} Zeichen, ohne Hashtags {} / {}".format(
        zahl(g), zahl(GRENZE), zahl(k), zahl(VORRAT_MAX)), hinweise)


def pruefe_erste_zeile(erste, grenze, hook):
    if not erste:
        return punkt("ERSTE ZEILE", "FEHLER", "keine erste Zeile mit lesbarem Text, dort gehört der Haken hin")
    status, teile = "OK", []
    gs = graphemes(erste)
    if erste[0] in "#@":
        status = "FEHLER"
        teile.append("beginnt mit Hashtag oder Erwähnung, dort gehört der Haken hin")
    elif ist_emoji(gs[0]):
        status = "WARN"
        teile.append("beginnt mit einem Emoji")
    if not WORT_RE.search(erste):
        status = schlimmer(status, "WARN")
        teile.append("kein lesbares Wort in Zeile 1 (nur Emojis oder Zeichen), der Hook gehört dorthin")
    if GRUSS_RE.search(erste):
        status = schlimmer(status, "WARN")
        teile.append("Begrüßung verschenkt den sichtbaren Platz")
    if len(gs) > grenze:
        status = schlimmer(status, "WARN")
        teile.append("{} Zeichen, wird nach {} abgeschnitten: der Haken muss vorher stehen".format(len(gs), grenze))
    # „Suchphrase: Hook“ ist das Format, das publish.mjs selbst erzeugt (captionMitPhrase)
    if hook and not any(t.startswith(_hooknorm(hook)) for t in (_hooknorm(erste), _hooknorm(erste.partition(": ")[2]))):
        status = schlimmer(status, "WARN")
        teile.append("beginnt nicht wörtlich mit dem Hook vom Cover („{}“)".format(hook.strip()))
    if not teile:
        teile.append("{} Zeichen, passt ganz ins Fenster".format(len(gs)) + (", Hook wie auf dem Cover" if hook else ""))
    return punkt("ERSTE ZEILE", status, "; ".join(teile))


def unbelegte_zahlen(text):
    """Prozentangaben, Statistiken („3 von 4 Kunden“) und Erfolgszahlen („über 200 Kunden“) als (Anfang, Ende)."""
    return sorted({m.span() for rx in UNBELEGTE_ZAHLEN for m in rx.finditer(text)})


def finde_anker(fenster, keywords):
    funde = []
    unbelegt = unbelegte_zahlen(fenster)

    def belegbar(start, ende):                  # eine Zahl aus einer unbelegten Statistik ist kein Haken
        return not any(a <= start and ende <= b for a, b in unbelegt)

    for m in re.finditer(r"\d[\d.,]*", fenster):
        z = m.group(0).rstrip(".,")
        if belegbar(m.start(), m.start() + len(z)):
            funde.append("Zahl „{}“".format(z))
    for m in WORT_RE.finditer(fenster):
        wort = m.group(0)
        teile = [wort.lower()] + [t for t in re.split("[" + BINDE + "]", wort.lower()) if t]
        if any(t in ZAHLWOERTER for t in teile):
            if belegbar(*m.span()):
                funde.append("Zahlwort „{}“".format(wort))
        elif any(_ist_anker(t) for t in teile):
            funde.append("Gegenstand „{}“".format(wort))
    for m in NUTZEN_RE.finditer(fenster):
        funde.append("Nutzen „{}“".format(m.group(0)))
    fenster_tok = such_tokens(fenster)
    for k in keywords:
        kt = inhalt(such_tokens(k)) or such_tokens(k)
        if kt and all(w in fenster_tok for w in kt):
            funde.append("Suchbegriff „{}“".format(k))
    eindeutig = []
    for f in funde:
        if f not in eindeutig:
            eindeutig.append(f)
    return eindeutig


def pruefe_haken(fenster, keywords):
    funde = finde_anker(fenster, keywords)
    unbelegt = list(dict.fromkeys(fenster[a:b] for a, b in unbelegte_zahlen(fenster)))
    hinweise = ["zählt nicht als Haken, weil unbelegt (siehe VERSPRECHEN): " +
                ", ".join("„{}“".format(u) for u in unbelegt[:3])] if unbelegt else []
    if funde:
        mehr = " und {} weitere".format(len(funde) - 4) if len(funde) > 4 else ""
        return punkt("HAKEN KONKRET", "OK", ", ".join(funde[:4]) + mehr, hinweise)
    return punkt("HAKEN KONKRET", "WARN", "nichts Greifbares vor dem „… mehr“: keine Zahl, kein Gegenstand, "
                                          "kein Nutzenversprechen wie „So prüfst du …“", hinweise)


def pruefe_hashtags(tags, plattform, tiktok_tags, typ=None, eigene=(), gepostet=None):
    """eigene: die Tags der Hashtag-Zeile; gepostet: so setzt publish.mjs sie bei Karussells zusammen (oder None)."""
    limit = HASHTAG_MAX[plattform]
    klein = [t.lower() for t in tags]
    status, hinweise = "OK", []
    if len(tags) > limit:
        status = "FEHLER"
        detail = "{} Hashtags, erlaubt sind höchstens {}".format(len(tags), limit) + (
            " (TikTok: 3 kuratierte)" if plattform == "tiktok" else "")
    elif not tags and plattform == "instagram":
        status = "WARN"
        detail = "keine Hashtags: 1 bis 5, davon ein Ortstag"
    else:
        detail = "{} Hashtag(s){}".format(len(tags), ": " + " ".join(tags) if tags else "")
    doppelt = sorted({t for t in klein if klein.count(t) > 1})
    if doppelt:
        status = schlimmer(status, "WARN")
        hinweise.append("doppelt: " + " ".join(doppelt))
    fuell = [t for t in tags if t.lower() in FUELL_TAGS]
    if fuell:
        status = schlimmer(status, "WARN")
        hinweise.append("Massen-Tags ohne Bezug: " + " ".join(fuell))
    if plattform == "instagram":
        marken = [t for t in tags if t.lower() in MARKEN_TAGS]
        if marken:
            status = schlimmer(status, "WARN")
            hinweise.append("fremde Marken- oder Plattformnamen: " + " ".join(marken))
        orte = [t for t in tags if t.lower() in ORTSTAGS]
        if tags and not orte:
            status = schlimmer(status, "WARN")
            hinweise.append("kein Ortstag (#freising, #erding, #moosburg, #landkreisfreising)")
        elif len(orte) > 2:
            status = schlimmer(status, "WARN")
            hinweise.append("{} Ortstags, 1 bis 2 reichen".format(len(orte)))
        if len(tags) > HASHTAG_MAX["tiktok"]:
            hinweise.append("für TikTok auf 3 kuratierte kürzen (plan/tiktok-hashtags.json: 1 aus einer Gruppe, 2 zum Thema)")
        # Karussell: publish.mjs setzt bis zu 2 Tags aus der Suchphrase davor und kürzt dann auf 5
        ort = [t.lower() in ORTSTAGS for t in eigene]
        if gepostet is not None:
            weg = [t for t in eigene if t not in gepostet]
            hinweise.append("Karussell, so postet es publish.mjs: " + (" ".join(gepostet) or "keine Hashtags") +
                            ("; fällt weg: " + " ".join(weg) if weg else ""))
            if any(ort) and not any(t.lower() in ORTSTAGS for t in gepostet):
                status = schlimmer(status, "WARN")
                hinweise.append("dabei fällt jeder Ortstag weg: Ortstag als ersten eigenen Tag setzen, höchstens 3 eigene")
        elif typ == "karussell":
            hinweise.append("Karussell ohne --keywords: publish.mjs setzt bis zu 2 Tags aus der Suchphrase davor und "
                            "kürzt auf 5, nur die ersten 3 eigenen sind sicher")
            if any(ort) and not any(ort[:3]):
                status = schlimmer(status, "WARN")
                hinweise.append("kein Ortstag unter den ersten 3 eigenen: er kann wegfallen, Ortstag als ersten eigenen Tag setzen")
    elif tiktok_tags is None:
        hinweise.append("plan/tiktok-hashtags.json nicht gefunden, Auswahl nicht abgeglichen")
    else:
        fremd = [t for t in tags if t.lower() not in tiktok_tags]
        if fremd:
            status = schlimmer(status, "WARN")
            hinweise.append("nicht in plan/tiktok-hashtags.json: " + " ".join(fremd))
    return punkt("HASHTAGS", status, detail, hinweise)


def pruefe_hashtag_ort(tags, inline, fenster, tag_am_ende):
    if not tags:
        return punkt("HASHTAG-ORT", "OK", "keine Hashtags zu platzieren")
    teile = []
    if inline:
        teile.append("im Fließtext: " + " ".join(inline) + ". Suchbegriffe als Wörter, Tags in die eigene Zeile")
    if HASHTAG_RE.search(fenster):
        teile.append("ein Hashtag steht im sichtbaren Fenster")
    if not tag_am_ende:
        teile.append("die Hashtag-Zeile steht nicht am Ende")
    if teile:
        return punkt("HASHTAG-ORT", "WARN", "; ".join(teile))
    return punkt("HASHTAG-ORT", "OK", "eigene Zeile am Ende, außerhalb des Fensters")


def erkenne_aufforderungen(koerper):
    funde = [name for name, rx in CTA if rx.search(koerper)]
    if endet_mit_frage(koerper):
        funde.append("Schlussfrage")
    return funde


def pruefe_aufforderung(funde, koerper):
    handlungen = [f for f in funde if f in HANDLUNGEN]
    hinweise = []
    status = "OK"
    n_bio = len(LINK_BIO_RE.findall(koerper))
    if n_bio > 1:
        status = "WARN"
        hinweise.append("„Link in der Bio“ steht {}-mal, einmal reicht".format(n_bio))
    if not funde:
        return punkt("AUFFORDERUNG", "WARN", "keine: Schlussfrage, Folgen-Satz und höchstens eine Handlung "
                                             "(Speichern, Teilen, Kommentieren oder „Link in der Bio“)", hinweise)
    if len(handlungen) > 1:
        return punkt("AUFFORDERUNG", "WARN", "{} Handlungen ({}): eine reicht, Folgen-Satz und Schlussfrage "
                                             "zählen nicht mit".format(len(handlungen), ", ".join(handlungen)), hinweise)
    return punkt("AUFFORDERUNG", status, ", ".join(funde), hinweise)


def pruefe_aufbau(koerper, funde, angebot, fundstueck):
    status, fehlt = "OK", []
    bio = bool(BIO_WOERTLICH_RE.search(koerper))           # nur das zählt für automatik/pruefe-block.mjs
    varianten = []                                         # „Link im Profil“, „Link in meiner Bio“ …
    for m in LINK_BIO_RE.finditer(koerper):
        if not BIO_WOERTLICH_RE.search(m.group(0)):
            v = re.sub(r"\s+", " ", m.group(0))
            varianten.append("„{}“".format(v) + (" mit Sonderleerzeichen" if v.lower() == "link in der bio" else ""))
    woertlich = "wörtlich „Link in der Bio“ schreiben statt {}, automatik/pruefe-block.mjs erkennt nur das".format(
        ", ".join(varianten))
    if not MITNEHMEN_RE.search(koerper):
        fehlt.append(("WARN", "„Zum Mitnehmen:“ mit einem Handgriff für heute fehlt"))
    if not FOLGE_VAMELA_RE.search(koerper):
        fehlt.append(("WARN", "Folgen-Satz „Folge @vamela.de für …“ fehlt"))
    if "Schlussfrage" not in funde:
        zeilen = [z.strip() for z in koerper.split("\n") if z.strip()]
        letzter = re.split(r"(?<=[.!?…])\s+", zeilen[-1])[-1] if zeilen else ""
        gs = graphemes(letzter)
        letzter = "".join(gs[:70]) + ("…" if len(gs) > 70 else "")
        fehlt.append(("WARN", "der letzte Satz ist keine Frage an die Lesenden („{}“)".format(letzter)))
    if fundstueck:
        if bio or varianten:
            fehlt.append(("FEHLER", "Fundstück: Angebot ist immer „keins“, also kein „Link in der Bio“"))
        if not REPO_ZEILE_RE.search(koerper):
            fehlt.append(("WARN", "Faktenzeile „Repo: github.com/owner/name“ fehlt"))
        if not LIZENZ_RE.search(koerper):
            fehlt.append(("WARN", "„Lizenz: …“ fehlt"))
        if not STERNE_RE.search(koerper) or not STAND_RE.search(koerper):
            fehlt.append(("WARN", "Sterne nur als „rund N Sterne“ mit „Stand TT.MM.JJJJ“"))
    elif angebot in ("werkzeug", "entwurf"):
        if not bio:
            fehlt.append(("FEHLER", "Angebot {} ohne wörtliches „Link in der Bio“, automatik/pruefe-block.mjs lehnt das ab{}".format(
                angebot, " ({} zählt dort nicht)".format(", ".join(varianten)) if varianten else "")))
        elif varianten:
            fehlt.append(("WARN", woertlich))
    elif angebot == "keins" and (bio or varianten):
        fehlt.append(("FEHLER", "„Link in der Bio“ ohne Angebot, automatik/pruefe-block.mjs lehnt das ab" if bio else
                      "{} ohne Angebot: ohne Angebot kein Link-Hinweis".format(", ".join(varianten))))
    elif angebot is None and (bio or varianten):
        fehlt.append(("WARN", "„Link in der Bio“ nur mit Angebot Werkzeug oder Entwurf, mit --angebot bestätigen"))
        if varianten:
            fehlt.append(("WARN", woertlich))
    for stufe, _ in fehlt:
        status = schlimmer(status, stufe)
    if not fehlt:
        teile = ["Zum Mitnehmen", "Folgen-Satz", "Schlussfrage"]
        if bio:
            teile.append("Angebot mit Link in der Bio")
        if fundstueck:
            teile.append("Faktenzeile")
        return punkt("AUFBAU", "OK", ", ".join(teile))
    return punkt("AUFBAU", status, "; ".join(t for _, t in fehlt))


def pruefe_domain(text, fakten):
    status, teile, hinweise = "OK", [], []
    bekannt = fakten_pfade(fakten) if fakten else None
    eigene = 0
    for m in VAMELA_RE.finditer(text):
        tld = m.group(1).lower()
        if tld != "de":
            status = "FEHLER"
            zeile = text.count("\n", 0, m.start()) + 1
            teile.append("„{}“ in Zeile {}: die Domain ist vamela.de".format(m.group(0), zeile))
            continue
        eigene += 1
        pfad = (m.group(2) or "").rstrip(".:!?").strip("/").lower()
        if pfad and bekannt is not None and pfad not in bekannt:
            status = schlimmer(status, "WARN")
            hinweise.append("vamela.de/{} steht nicht in data/fakten.json".format(pfad))
    for m in HANDLE_RE.finditer(text):
        status = schlimmer(status, "WARN")
        teile.append("„{}“: das Konto heißt @vamela.de".format(m.group(0)))
    if not teile:
        teile.append("vamela.de korrekt ({}-mal)".format(eigene) if eigene else "keine eigene Adresse genannt")
    return punkt("DOMAIN", status, "; ".join(teile), hinweise)


def finde_links(text):
    urls = [m.group(0).rstrip(".,:;!?") for m in URL_RE.finditer(text)]
    spannen = [m.span() for m in URL_RE.finditer(text)]
    domains = []
    for m in DOMAIN_RE.finditer(text):
        if not any(a <= m.start() < b for a, b in spannen):
            domains.append(m.group(0).rstrip(".,:;!?"))
    return urls, domains


def pruefe_links(text):
    urls, domains = finde_links(text)
    status, teile = "OK", []
    if urls:
        status = "WARN"
        teile.append("{} Link(s) mit http oder www sind in der Caption nicht klickbar: {}. Für vamela.de reicht "
                     "„Link in der Bio“ bzw. die Domain als Text".format(len(urls), ", ".join(urls)))
    fremd, beispiele = [], []
    for d in domains:
        dl = d.lower()
        if dl.startswith("vamela."):
            continue
        if BEISPIEL_DOMAIN_RE.match(dl):
            beispiele.append(d)
            continue
        if dl.startswith("github.com"):
            if not GITHUB_RE.match(dl):
                status = schlimmer(status, "WARN")
                teile.append("Fundort vollständig als github.com/owner/name angeben")
            continue
        fremd.append(d)
    if fremd:
        status = schlimmer(status, "WARN")
        teile.append("fremde Adresse(n): {}. Nur vamela.de und beim Fundstück github.com/owner/name".format(", ".join(fremd)))
    if not teile:
        teile.append("keine toten Links im Text")
    hinweise = ["Beispieladresse, kein Link: " + ", ".join(beispiele)] if beispiele else []
    return punkt("LINKS", status, "; ".join(teile), hinweise)


def pruefe_preise(text, fakten):
    funde = preise_in(text)
    rabatt = [re.sub(r"\s+", " ", m.group(0)) for m in RABATT_ANGEBOT_RE.finditer(text)]
    rabatt_wort = [m.group(0) for m in RABATT_WORT_RE.finditer(text)]
    if not funde and not rabatt and not rabatt_wort:
        return punkt("PREISE", "OK", "keine Preise")
    status, hinweise = "WARN", []
    tabelle = fakten_preise(fakten) if fakten else None
    for roh, wert in funde:
        if tabelle is None:
            hinweise.append("„{}“: data/fakten.json nicht gefunden, von Hand abgleichen".format(roh))
        elif wert not in tabelle:
            status = "FEHLER"
            hinweise.append("„{}“ steht nicht in data/fakten.json".format(roh))
        else:
            schreib = sorted({r for r, _ in tabelle[wert]})
            if roh not in schreib:
                hinweise.append("„{}“: Schreibweise wie in data/fakten.json, also „{}“".format(roh, schreib[0]))
            hinweise.append("„{}“ laut data/fakten.json: {}".format(roh, "; ".join(b for _, b in tabelle[wert])))
    if rabatt:
        status = "FEHLER"
        hinweise.append("Streichpreis oder Rabatt ist verboten: " + ", ".join("„{}“".format(r) for r in rabatt))
    if rabatt_wort:
        hinweise.append(", ".join("„{}“".format(r) for r in rabatt_wort) + ": als eigenes Angebot verboten, als Thema erlaubt")
    if funde:
        detail = "{} Preis(e): nur Werte aus data/fakten.json, Bedeutung prüfen; publish.mjs gleicht vor dem Posten live ab".format(len(funde))
    else:
        detail = "Rabatt-Angebot gefunden" if rabatt else "Rabatt als Wort erwähnt"
    return punkt("PREISE", status, detail, hinweise)


def pruefe_versprechen(text):
    status, funde, belegt = "OK", [], []
    for rx, name, stufe in VERSPRECHEN:
        for m in rx.finditer(text):
            if any(a < m.end() and m.start() < b for a, b in belegt):
                continue
            belegt.append(m.span())
            s = stufe
            zusatz = ""
            if stufe == "FEHLER" and _verneint(text, m.start(), m.end()):
                s, zusatz = "WARN", ", verneint: Satz prüfen"
            status = schlimmer(status, s)
            funde.append("{} „{}“{}".format(name, m.group(0), zusatz))
    for z in kundenstimmen(text):
        status = schlimmer(status, "WARN")
        funde.append("Zitat als Kundenstimme {}".format(z))
    if not funde:
        return punkt("VERSPRECHEN", "OK", "keine Erfolgsversprechen, keine unbelegten Zahlen, Studien oder Kundenstimmen")
    return punkt("VERSPRECHEN", status, "; ".join(funde) + ". Nur Belegbares wie auf vamela.de, keine Rechtsaussagen")


def kundenstimmen(text):
    """Zitate mit Sprechverb im selben Satz („Kunden sagen: „…““) oder mit Namen dahinter („…“ – Anna)."""
    funde = []
    for m in ZITAT_RE.finditer(text):
        a, e = m.span()
        vor = text[max(max(text.rfind(c, 0, a) for c in ".!?\n") + 1, a - 60):a]
        zeile = text[e:].split("\n")[0]
        nach = re.split(r"[.!?]", zeile, maxsplit=1)[0][:40]
        if SAGT_RE.search(vor) or SAGT_RE.search(nach) or NAME_NACH_ZITAT_RE.match(zeile):
            funde.append(m.group(0))
    return funde


def pruefe_recht(koerper):
    """Rechtstexte nie anbieten (FEHLER, wenn ein Angebot im selben Satz steht und der Satz nicht auf eine Anwältin
    oder einen Anwalt verweist); jedes Rechtsthema nur mit diesem Verweis (sonst WARN)."""
    angebote = []
    for s in saetze(koerper):
        text = RECHTSTEXT_RE.search(s)
        if not text or ANWALT_RE.search(s):
            continue
        signal = RECHT_ANGEBOT_RE.search(s) or LINK_BIO_RE.search(s)
        preis = preise_in(s)
        if signal or preis:
            wort = signal.group(0) if signal else preis[0][0]
            angebote.append("„{}“ mit „{}{}“".format(text.group(0), wort, "." if wort.lower() == "inkl" else ""))
    themen = list(dict.fromkeys(m.group(0) for m in RECHTSTHEMA_RE.finditer(koerper)))
    anwalt = bool(ANWALT_RE.search(koerper))
    if angebote:
        return punkt("RECHT", "FEHLER", "Rechtstexte nie anbieten oder verkaufen: {}. Höchstens auf eine Anwältin oder "
                                        "einen Anwalt verweisen".format("; ".join(angebote[:3])),
                     [] if anwalt else ["dazu fehlt der Hinweis, es mit einer Anwältin oder einem Anwalt zu klären"])
    if themen and not anwalt:
        return punkt("RECHT", "WARN", "Rechtsthema ({}) ohne Hinweis, es mit einer Anwältin oder einem Anwalt zu "
                                      "klären".format(", ".join("„{}“".format(t) for t in themen[:3])))
    if themen:
        return punkt("RECHT", "OK", "Rechtsthema mit Verweis auf Anwältin oder Anwalt, kein Rechtstext angeboten")
    return punkt("RECHT", "OK", "kein Rechtsthema")


def pruefe_emojis(liste):
    if len(liste) > EMOJI_MAX:
        return punkt("EMOJIS", "WARN", "{} Emojis ({}): sparsam heißt höchstens {}".format(len(liste), "".join(liste), EMOJI_MAX))
    return punkt("EMOJIS", "OK", "{} Emoji(s){}".format(len(liste), " " + "".join(liste) if liste else ""))


def pruefe_stil(koerper):
    status, teile = "OK", []
    for rx, stufe, text in (
            (PLATZHALTER_RE, "FEHLER", "Platzhalter offen"),
            (AUFGABE_RE, "FEHLER", "„Aufgabe 1/2“-Schema, automatik/pruefe-block.mjs lehnt das ab"),
            (SIE_RE, "WARN", "Sie-Form, wir duzen"),
            (MARKUP_RE, "WARN", "Markdown oder Akzent-Markup, Instagram zeigt die Zeichen roh"),
            (DEKO_NR_RE, "WARN", "dekorative Nummerierung")):
        treffer = [m.group(0).strip() for m in rx.finditer(koerper)]
        if treffer:
            status = schlimmer(status, stufe)
            teile.append("{}: {}".format(text, ", ".join("„{}“".format(t) for t in treffer[:3])))
    if "\u2014" in koerper:
        status = schlimmer(status, "WARN")
        teile.append("Geviertstrich als Satztrenner, besser Punkt, Komma oder Doppelpunkt")
    if not teile:
        return punkt("STIL", "OK", "Du-Form, keine Platzhalter, kein Markup")
    return punkt("STIL", status, "; ".join(teile))


def pruefe_suche(keywords, koerper, erste, fenster, tags, typ=None):
    text_tok = such_tokens(HASHTAG_RE.sub(" ", koerper))
    fenster_tok = such_tokens(fenster)
    erste_js = set(inhaltswoerter_js(erste))                  # Zählung wie captionMitPhrase() in suchbegriffe.mjs
    tags_klein = {t.lower().lstrip("#") for t in tags}
    gefunden, teilweise, hinweise, unter60 = 0, 0, [], False
    for nr, k in enumerate(keywords):
        kt = such_tokens(k)
        ki = inhalt(kt) or kt
        pw = inhaltswoerter_js(k)
        anteil = sum(1 for w in pw if w in erste_js) / len(pw) if pw else 0
        unter60 = unter60 or (nr == 0 and anteil < 0.6)       # der erste Suchbegriff gilt als Suchphrase
        if _teilfolge(kt, text_tok):
            art = "wörtlich"
        elif all(w in text_tok for w in ki):
            art = "alle Wörter, andere Reihenfolge"
        else:
            da = [w for w in ki if w in text_tok]
            formen = [next(t for t in text_tok if _wortform(w, t)) for w in ki
                      if w not in text_tok and any(_wortform(w, t) for t in text_tok)]
            teile = ["{} von {} Wörtern genau".format(len(da), len(ki))] if da else []
            if formen:
                teile.append("andere Endung: " + ", ".join(formen))
            art = ", ".join(teile) or "fehlt"
            teilweise += 1 if teile else 0
            if art == "fehlt" and "".join(ki) in tags_klein:
                art += ", nur als Hashtag"
        if art in ("wörtlich", "alle Wörter, andere Reihenfolge"):
            gefunden += 1
            if _teilfolge(kt, fenster_tok) or all(w in fenster_tok for w in ki):
                art += ", im Fenster"
        hinweise.append("„{}“: {}".format(k, art) + (", erste Zeile {} %".format(round(anteil * 100)) if nr == 0 else ""))
    if unter60 and typ == "karussell":
        neu = graphemes("{}: {}".format(keywords[0], re.sub(r"^[„“\"]|[„“\"]$", "", erste)))
        hinweise.append("Karussell: die erste Zeile enthält weniger als 60 % der Inhaltswörter der Suchphrase, "
                        "publish.mjs postet sie so: „{}“".format("".join(neu[:80]) + ("…" if len(neu) > 80 else "")))
    elif unter60 and typ is None:
        hinweise.append("Karussell: enthält die erste Zeile weniger als 60 % der Inhaltswörter der Suchphrase "
                        "(erster Suchbegriff), setzt publish.mjs sie davor („Phrase: Hook“)")
    status = "OK" if gefunden == len(keywords) else ("WARN" if gefunden or teilweise else "FEHLER")
    return punkt("SUCHBEGRIFFE", status, "{} von {} vollständig im Text".format(gefunden, len(keywords)), hinweise)

# ---------------------------------------------------------------- Analyse


def analysiere(text, fenster=FENSTER, keywords=None, plattform="instagram", angebot=None,
               saeule=None, hook=None, fakten=None, tiktok_tags=None, typ=None):
    """Prüft eine Caption. fakten und tiktok_tags kommen vom Aufrufer (keine Dateizugriffe hier).
    typ „karussell“ bildet nach, wie publish.mjs die Hashtags zusammensetzt."""
    # Hook und Suchbegriffe wie die Caption nach NFC: zerlegte Umlaute (etwa aus macOS-Dateinamen) passen sonst nicht
    hook = normalisiere(hook).strip() if hook else hook
    keywords = [k for k in (normalisiere(k).strip() for k in (keywords or []) if k) if WORT_RE.search(k)]
    caption = extrahiere(normalisiere(text)).strip()
    zeilen = caption.split("\n")
    tagzeilen = {i for i, z in enumerate(zeilen) if z.strip() and ist_tagzeile(z)}
    koerper = "\n".join(z for i, z in enumerate(zeilen) if i not in tagzeilen).strip()
    gepostet = "\n".join(TAG_LABEL.sub("", z, count=1) if i in tagzeilen else z for i, z in enumerate(zeilen)).strip()
    tags = HASHTAG_RE.findall(gepostet)
    inline = HASHTAG_RE.findall(koerper)
    letzte = max((i for i, z in enumerate(zeilen) if z.strip()), default=-1)
    tag_am_ende = not tagzeilen or letzte in tagzeilen
    erste = koerper.split("\n")[0].strip() if koerper else ""      # so nimmt sie publish.mjs (ohne Hashtags)
    erste_feed = gepostet.split("\n")[0].strip() if gepostet else ""  # so sieht sie der Feed
    sichtbar, abgeschnitten = sichtbares_fenster(gepostet, fenster)
    emoji_liste = [g for g in graphemes(koerper) if ist_emoji(g)]
    funde = erkenne_aufforderungen(koerper)
    fundstueck = saeule == "fundstuecke" or bool(GITHUB_RE.search(koerper))
    urls, domains = finde_links(koerper)
    # Karussell auf Instagram: publish.mjs setzt phrasenTags(Suchphrase) vor die Tags der Hashtag-Zeile, kürzt auf 5
    eigene = [t for i in sorted(tagzeilen) for t in HASHTAG_RE.findall(zeilen[i])]
    tags_gepostet = None
    if typ == "karussell" and plattform == "instagram" and keywords:
        tags_gepostet = list(dict.fromkeys(phrasen_tags(keywords[0]) + eigene))[:5]

    punkte = [
        pruefe_laenge(gepostet, koerper),
        pruefe_erste_zeile(erste_feed if WORT_RE.search(koerper) else "", fenster, hook),
        pruefe_haken(sichtbar, keywords),
        pruefe_hashtags(tags, plattform, tiktok_tags, typ, eigene, tags_gepostet),
        pruefe_hashtag_ort(tags, inline, sichtbar, tag_am_ende),
        pruefe_aufforderung(funde, koerper),
        pruefe_aufbau(koerper, funde, angebot, fundstueck),
        pruefe_domain(caption, fakten),
        pruefe_links(koerper),
        pruefe_preise(koerper, fakten),
        pruefe_versprechen(koerper),
        pruefe_recht(koerper),
        pruefe_emojis(emoji_liste),
        pruefe_stil(koerper),
    ]
    if keywords:
        punkte.append(pruefe_suche(keywords, koerper, erste, sichtbar, tags, typ))
    schlimmste = max((STUFE[p["status"]] for p in punkte), default=0)
    return {
        "plattform": plattform, "typ": typ, "hashtags_gepostet": tags_gepostet,
        "zeichen": utf16(gepostet), "zeichen_ohne_hashtags": utf16(koerper),
        "grenze": GRENZE, "vorrat_max": VORRAT_MAX, "fenster": fenster,
        "sichtbar": sichtbar, "abgeschnitten": abgeschnitten,
        "erste_zeile": erste, "hashtags": tags,
        "erwaehnungen": ["@" + m for m in ERWAEHNUNG_RE.findall(koerper)],
        "links": urls + domains, "emojis": len(emoji_liste),
        "aufforderungen": funde, "preise": [roh for roh, _ in preise_in(koerper)],
        "fundstueck": fundstueck,
        "pruefpunkte": punkte, "urteil": URTEIL[schlimmste],
    }


def ausgeben(a, aus=sys.stdout):
    kopf = "CAPTION-CHECK · {} · {} / {} Zeichen · {} Hashtags · {} Aufforderung(en)".format(
        a["plattform"] + (" " + a["typ"] if a.get("typ") else ""), zahl(a["zeichen"]), zahl(a["grenze"]),
        len(a["hashtags"]), len(a["aufforderungen"]))
    print("\n" + kopf, file=aus)
    print("=" * max(len(kopf), 62), file=aus)
    zeichne_kasten(a["sichtbar"], a["abgeschnitten"], aus)
    print("", file=aus)
    for p in a["pruefpunkte"]:
        print("  {:<7}{:<15}{}".format(p["status"], p["pruefpunkt"], p["detail"]), file=aus)
        for h in p["hinweise"]:
            print("  {:<22}· {}".format("", h), file=aus)
    print("-" * max(len(kopf), 62), file=aus)
    print("  URTEIL  {}\n".format(a["urteil"]), file=aus)

# ---------------------------------------------------------------- Projektdateien


def finde_projekt(explizit=None):
    if explizit:
        kandidaten = [explizit]
    else:
        kandidaten, d = [], os.path.abspath(os.getcwd())
        while True:
            kandidaten.append(d)
            eltern = os.path.dirname(d)
            if eltern == d:
                break
            d = eltern
        kandidaten.append(os.path.expanduser("~/vamela-insta"))
    for k in kandidaten:
        if os.path.isfile(os.path.join(k, "data", "fakten.json")):
            return os.path.abspath(k)
    return None


def lade_json(pfad):
    try:
        with open(pfad, encoding="utf-8") as f:
            daten = json.load(f)
        return daten if isinstance(daten, dict) else None
    except (OSError, ValueError):
        return None

# ---------------------------------------------------------------- Selbsttest

_FAKTEN_PROBE = {
    "preise": [{"text": "49 €", "bedeutung": "Website Stufe Start, im Monat"},
               {"text": "1.490 €", "bedeutung": "Website Stufe Premium, einmalig"}],
    "werkzeuge": [{"pfad": "/qr-code-generator"}], "eigene_seiten": [{"pfad": "/"}],
}
_TIKTOK_PROBE = {"#kleinunternehmen", "#tipps", "#gratistools", "#website"}
_GUT = """QR-Code für deinen Flyer: So machst du ihn selbst, ohne Abo.

Viele Generatoren erzeugen Codes, die nur über eine Weiterleitung beim Anbieter laufen. Ein statischer Code trägt die Adresse direkt im Muster.

Zum Mitnehmen: Mach vor dem Druck einen Lesetest mit dem Handy, aus der Entfernung, aus der deine Kunden scannen.

Den QR-Code-Generator gibt es kostenlos und ohne Anmeldung auf vamela.de. Link in der Bio.

Folge @vamela.de für Gratis-Werkzeuge, die kleine Betriebe im Landkreis Freising wirklich brauchen.

Wo hängt dein QR-Code gerade?

**Hashtags:** #freising #qrcode #kleinunternehmen"""
_SCHLECHT = """Hallo Leute 👋🔥🚀✨

Wir sind die Nr. 1 für Webseiten in Freising \u2014 garantiert Platz 1 bei Google, 100 % rechtssicher! Jetzt nur 199 € statt 490 €.

Mehr auf https://vamela.info/leistungen

Teile das mit deinem Chef, speichere dir den Beitrag und kommentiere!

#viral #fyp #webdesign #Webdesign #freising #love"""


def _status(a, name):
    return next((p["status"] for p in a["pruefpunkte"] if p["pruefpunkt"] == name), None)


def selbsttest():
    faelle = []

    def pruefe(name, bedingung):
        faelle.append((name, bool(bedingung)))

    gut = analysiere(_GUT, keywords=["QR Code kostenlos", "Flyer"], angebot="werkzeug", fakten=_FAKTEN_PROBE)
    pruefe("gute Caption ist BEREIT", gut["urteil"] == "BEREIT")
    pruefe("gute Caption: Aufforderungen erkannt",
           gut["aufforderungen"] == ["Link in der Bio", "Folgen-Satz", "Schlussfrage"])
    schlecht = analysiere(_SCHLECHT, fakten=_FAKTEN_PROBE)
    pruefe("schlechte Caption ist ÜBERARBEITEN", schlecht["urteil"] == "ÜBERARBEITEN")
    for name, soll in (("HASHTAGS", "FEHLER"), ("DOMAIN", "FEHLER"), ("VERSPRECHEN", "FEHLER"), ("PREISE", "FEHLER"),
                       ("ERSTE ZEILE", "WARN"), ("EMOJIS", "WARN"), ("AUFFORDERUNG", "WARN"), ("LINKS", "WARN"),
                       ("STIL", "WARN")):
        pruefe("schlechte Caption: {} = {}".format(name, soll), _status(schlecht, name) == soll)

    sechs = "Drei Fehler im Google-Profil.\n\n#a1 #b2 #c3 #d4 #e5 #f6"
    pruefe("6 Hashtags: FEHLER", _status(analysiere(sechs), "HASHTAGS") == "FEHLER")
    pruefe("5 Hashtags: kein FEHLER", _status(analysiere(sechs.replace(" #f6", "")), "HASHTAGS") != "FEHLER")
    pruefe("TikTok, 4 Hashtags: FEHLER", _status(analysiere(sechs.replace(" #e5 #f6", ""), plattform="tiktok"), "HASHTAGS") == "FEHLER")
    pruefe("Hashtags mit Umlauten ganz", HASHTAG_RE.findall("#selbstständig #größe #produktivität") ==
           ["#selbstständig", "#größe", "#produktivität"])

    pruefe("vamela.info: FEHLER", _status(analysiere("Alles auf vamela.info, Link in der Bio."), "DOMAIN") == "FEHLER")
    pruefe("vamela.de: OK", _status(analysiere("Alles auf vamela.de/qr-code-generator.", fakten=_FAKTEN_PROBE), "DOMAIN") == "OK")
    pruefe("@vamela ohne .de: WARN", _status(analysiere("Folge @vamela für mehr."), "DOMAIN") == "WARN")

    # Fenster: Umlaute zerlegt (NFD), Schnitt an Wortgrenze, keine halben Zeichen
    roh = unicodedata.normalize("NFD", "Grüße für Bäcker, Öfen und Übergrößen in Moosburg. " * 4)
    nfc = normalisiere(roh)
    fen, ab = sichtbares_fenster(nfc)
    pruefe("Fenster: abgeschnitten und Präfix", ab and nfc.startswith(fen))
    pruefe("Fenster: Schnitt an Wortgrenze", nfc[len(fen)].isspace() or nfc[len(fen)] in ",.")
    pruefe("Fenster: NFC, ohne lose Kombinationszeichen", unicodedata.normalize("NFC", fen) == fen and
           not _haengt_an(nfc[len(fen)]))
    nfd = unicodedata.normalize("NFD", "ü" * 200)                  # ein Wort ohne Leerzeichen: harter Schnitt
    fen2, _ = sichtbares_fenster(nfd)
    pruefe("Fenster auf NFD: harter Schnitt halbiert keinen Umlaut",
           len(graphemes(fen2)) == 125 and not _haengt_an(nfd[len(fen2)]) and _haengt_an(fen2[-1]))
    lang = "ä" * 124 + "👨\u200d👩\u200d👧" + "b" * 20
    fen3, _ = sichtbares_fenster(lang)
    pruefe("Fenster: Familien-Emoji bleibt ganz", fen3.endswith("👨\u200d👩\u200d👧") and len(graphemes(fen3)) == 125)
    fen4, _ = sichtbares_fenster("ü" * 124 + "🇩🇪" + "x" * 5)
    pruefe("Fenster: Flagge bleibt ganz", fen4.endswith("🇩🇪"))
    pruefe("UTF-16 zählt Emoji doppelt", utf16("👍") == 2 and utf16("ä") == 1)

    emo = analysiere("Vier Emojis 👍🏽👨\u200d👩\u200d👧🇩🇪✨ sind zu viel.")
    pruefe("Emojis als Cluster gezählt (4) und WARN", emo["emojis"] == 4 and _status(emo, "EMOJIS") == "WARN")
    pruefe("Tastenkappe ist ein Emoji", [g for g in graphemes("1\ufe0f\u20e3 Tipp") if ist_emoji(g)] == ["1\ufe0f\u20e3"])
    pruefe("Pfeil ➤ und Haken ✓ sind keine Emojis", not any(ist_emoji(g) for g in graphemes("➤ ✓ → •")))

    pruefe("„Bild als PNG speichern“ ist keine Aufforderung",
           "Speichern" not in erkenne_aufforderungen("Du kannst das Bild als PNG speichern."))
    pruefe("„Speicher dir den Beitrag“ ist Speichern",
           "Speichern" in erkenne_aufforderungen("Speicher dir den Beitrag für später."))
    pruefe("Indikativ „speicherst es“, „teilt es mit“ ist keine Aufforderung",
           not erkenne_aufforderungen("Du wählst das Foto aus und speicherst es. Das Werkzeug teilt es mit niemandem."))
    pruefe("„Teile das, …“ ist Teilen", "Teilen" in erkenne_aufforderungen("Teile das, wenn es dir hilft."))
    pruefe("Rabatt als Thema nur WARN", _status(analysiere(
        "Bewertungen mit Rabatten belohnen verstößt gegen die Richtlinien von Google."), "PREISE") == "WARN")
    pruefe("Beispieladresse ist kein fremder Link",
           _status(analysiere("Deine Adresse heißt dann dein-betrieb.de/kontakt."), "LINKS") == "OK")
    such = analysiere("Die Größe vom Logo zählt.", keywords=["Logo Größe"])
    pruefe("Suchbegriff mit Umlaut gefunden", _status(such, "SUCHBEGRIFFE") == "OK")
    pruefe("Suchbegriff mit anderer Endung nur WARN", _status(analysiere(
        "Mehr Google-Bewertungen mit einem Aufsteller.", keywords=["Google Bewertung"]), "SUCHBEGRIFFE") == "WARN")
    pruefe("Suchbegriff fehlt ganz: FEHLER", _status(analysiere(
        "Drei Schriften reichen.", keywords=["Speisekarte gestalten"]), "SUCHBEGRIFFE") == "FEHLER")
    pruefe("Hashtag ganz vorn: FEHLER", _status(analysiere("#freising\n\nDrei Schriften reichen."), "ERSTE ZEILE") == "FEHLER")
    pruefe("Konkretheit ohne Großschreibung", not finde_anker("Große Ideen brauchen Platz", []))

    preis = analysiere("Website ab 49 € im Monat. Logo für 199 €. Oder 49€.", fakten=_FAKTEN_PROBE)
    ph = " ".join(h for p in preis["pruefpunkte"] if p["pruefpunkt"] == "PREISE" for h in p["hinweise"])
    pruefe("Preis außerhalb fakten.json: FEHLER", _status(preis, "PREISE") == "FEHLER" and "199 €" in ph)
    pruefe("Schreibweise 49€ wird gemeldet", "„49€“: Schreibweise" in ph)
    pruefe("bekannter Preis allein: WARN", _status(analysiere("Ab 1.490 € einmalig.", fakten=_FAKTEN_PROBE), "PREISE") == "WARN")
    pruefe("verneintes Versprechen nur WARN",
           _status(analysiere("Niemand kann dir Platz 1 bei Google garantieren."), "VERSPRECHEN") == "WARN")

    block = analysiere("## Karussell 9\n| 1 | Cover | x |\n\n**Caption:**\nDrei Schriften reichen.\n\n"
                       "**Hashtags:** #typografie #freising\n\n## Karussell 10\n#eins #zwei")
    pruefe("Vorratsblock: nur die Caption", block["hashtags"] == ["#typografie", "#freising"]
           and block["erste_zeile"] == "Drei Schriften reichen.")
    tt = analysiere("Drei Gratis-Tools für deinen Betrieb.\n\n#kleinunternehmen #tipps #github",
                    plattform="tiktok", tiktok_tags=_TIKTOK_PROBE)
    pruefe("TikTok: nicht kuratierter Tag wird gemeldet", _status(tt, "HASHTAGS") == "WARN")

    # Hook und Suchbegriff zerlegt (NFD), etwa aus kopierten macOS-Dateinamen
    zerlegt = lambda s: unicodedata.normalize("NFD", s)          # noqa: E731
    pruefe("Hook in NFD passt", _status(analysiere("Größe zählt für dein Logo.", hook=zerlegt("Größe zählt")),
                                        "ERSTE ZEILE") == "OK")
    pruefe("Suchbegriff in NFD gefunden", _status(analysiere("Die Größe vom Logo.", keywords=[zerlegt("Größe Logo")]),
                                                  "SUCHBEGRIFFE") == "OK")

    # ohne lesbaren Text
    for roh, name in (("🔥🔥", "nur Emojis"), ("​", "nur unsichtbares Zeichen")):
        a = analysiere(roh)
        pruefe("{}: ÜBERARBEITEN, LÄNGE und ERSTE ZEILE FEHLER".format(name), a["urteil"] == "ÜBERARBEITEN"
               and _status(a, "LÄNGE") == "FEHLER" and _status(a, "ERSTE ZEILE") == "FEHLER")
    a = analysiere("🔥🔥🔥\nDrei Schriften reichen.")
    pruefe("Emoji-Zeile vor dem Text: ERSTE ZEILE nur WARN", _status(a, "LÄNGE") == "OK" and _status(a, "ERSTE ZEILE") == "WARN")

    # Rechtstexte
    recht = analysiere("Impressum und Datenschutzerklärung bekommst du bei mir, Link in der Bio.", angebot="werkzeug")
    pruefe("Rechtstext angeboten: RECHT FEHLER", _status(recht, "RECHT") == "FEHLER" and recht["urteil"] == "ÜBERARBEITEN")
    pruefe("„inkl. Impressum und AGB für 490 €“: RECHT FEHLER",
           _status(analysiere("Website inkl. Impressum und AGB für 490 €."), "RECHT") == "FEHLER")
    pruefe("Rechtsthema mit Verweis auf Anwältin: RECHT OK", _status(analysiere(
        "Dein Impressum muss mit zwei Klicks erreichbar sein. Was drinsteht, klärst du mit einer Anwältin oder "
        "einem Anwalt."), "RECHT") == "OK")
    pruefe("Rechtsthema ohne Verweis: RECHT WARN", _status(analysiere("Ein Impressum braucht jede Website."), "RECHT") == "WARN")
    pruefe("„Datenschutz inklusive“ beim Werkzeug ist kein Rechtstext, nur Thema", _status(analysiere(
        "Dein Passwort bleibt im Browser, Datenschutz inklusive."), "RECHT") == "WARN")

    # „Link in der Bio“ nur wörtlich, wie automatik/pruefe-block.mjs
    pruefe("„Link im Profil“ mit Angebot Werkzeug: AUFBAU FEHLER",
           _status(analysiere(_GUT.replace("Link in der Bio.", "Link im Profil."), angebot="werkzeug"), "AUFBAU") == "FEHLER")
    nbsp = analysiere(_GUT.replace("Link in der Bio.", "Link in der Bio."), angebot="werkzeug")
    pruefe("„Link in der Bio“ mit geschütztem Leerzeichen: AUFBAU FEHLER", _status(nbsp, "AUFBAU") == "FEHLER"
           and "Sonderleerzeichen" in next(p["detail"] for p in nbsp["pruefpunkte"] if p["pruefpunkt"] == "AUFBAU"))
    pruefe("wörtlich plus Variante: AUFBAU WARN", _status(analysiere(_GUT.replace(
        "Link in der Bio.", "Link in der Bio. Der Link in meiner Bio führt direkt hin."), angebot="werkzeug"), "AUFBAU") == "WARN")

    # Karussell: Hashtags so, wie publish.mjs sie postet (phrasenTags davor, auf 5 gekürzt)
    pruefe("phrasenTags wie automatik/suchbegriffe.mjs",
           phrasen_tags("QR Code erstellen kostenlos") == ["#qrcodeerstellenkostenlos", "#qrcode"]
           and phrasen_tags("Website für Handwerker erstellen lassen kostenlos") == ["#websitehandwerker", "#website"]
           and phrasen_tags("Größe Logo") == ["#größelogo", "#größe"] and phrasen_tags("für die") == [])
    kar = analysiere(_GUT, keywords=["QR Code erstellen kostenlos"], angebot="werkzeug", typ="karussell", fakten=_FAKTEN_PROBE)
    pruefe("Karussell: gepostete Tags, Ortstag bleibt", _status(kar, "HASHTAGS") == "OK" and kar["hashtags_gepostet"] ==
           ["#qrcodeerstellenkostenlos", "#qrcode", "#freising", "#kleinunternehmen"])
    logo = "Dein Logo als Profilbild: So bleibt es lesbar.\n\n**Hashtags:** #logodesign #grafikdesign #kleinunternehmen #freising #erding"
    pruefe("Karussell: jeder Ortstag fällt weg: HASHTAGS WARN",
           _status(analysiere(logo, keywords=["Logo Profilbild"], typ="karussell"), "HASHTAGS") == "WARN")
    pruefe("Karussell ohne Suchphrase: Ortstag hinten: HASHTAGS WARN", _status(analysiere(logo, typ="karussell"), "HASHTAGS") == "WARN")
    pruefe("Karussell: Ortstag als erster eigener Tag bleibt", _status(analysiere(
        logo.replace("#logodesign #grafikdesign #kleinunternehmen #freising #erding", "#freising #logodesign #grafikdesign"),
        keywords=["Logo Profilbild"], typ="karussell"), "HASHTAGS") == "OK")
    pruefe("Reel: keine Phrasen-Tags", analysiere(logo, keywords=["Logo Profilbild"], typ="reel")["hashtags_gepostet"] is None)

    # erfundene Zahlen und Kundenstimmen
    stat = analysiere("3 von 4 Kunden suchen zuerst bei Google. Über 200 zufriedene Kunden sagen: „Endlich mehr Anfragen!“"
                      "\n\nZum Mitnehmen: Prüf heute dein Google-Profil.\n\nFolge @vamela.de für Tipps.\n\nWie suchst du?"
                      "\n\n**Hashtags:** #googleprofil #freising")
    vh = next(p["detail"] for p in stat["pruefpunkte"] if p["pruefpunkt"] == "VERSPRECHEN")
    pruefe("Statistik, Erfolgszahl und Zitat: VERSPRECHEN WARN", _status(stat, "VERSPRECHEN") == "WARN"
           and all(w in vh for w in ("Statistik ohne Beleg", "Erfolgszahl ohne Beleg", "Zitat als Kundenstimme")))
    pruefe("Zahl aus unbelegter Statistik ist kein Haken", "Zahl „3“" not in next(
        p["detail"] for p in stat["pruefpunkte"] if p["pruefpunkt"] == "HAKEN KONKRET"))
    pruefe("„Neun von zehn“, „jeder dritte Betrieb“, „meine zufriedenen Kunden“, „… sagen:“: WARN", all(
        _status(analysiere(t), "VERSPRECHEN") == "WARN" for t in (
            "Neun von zehn Betrieben vergessen das.", "Jeder dritte Betrieb hat kein Google-Profil.",
            "Meine zufriedenen Kunden wissen das.", "Zufriedene Kunden sagen: endlich mehr Anfragen.")))
    pruefe("Bewertungs-Tipp „Zufriedene Kunden denken selten daran“ ist keine Kundenstimme", _status(analysiere(
        "Zufriedene Kunden denken trotzdem selten von selbst daran. Frag sie."), "VERSPRECHEN") == "OK")
    pruefe("„4,8 von 5 Sternen“, „4 von 5 Sternen“, „Seite 2 von 6“ sind keine Statistik", all(
        _status(analysiere(t), "VERSPRECHEN") == "OK" for t in (
            "Dein Profil hat 4,8 von 5 Sternen.", "Ein Profil mit 4 von 5 Sternen.", "Mehr dazu auf Seite 2 von 6.")))
    pruefe("Zitat mit Namen ist Kundenstimme", kundenstimmen("„Super Arbeit!“ – Anna") == ["„Super Arbeit!“"])
    pruefe("Kommentar-Stichwort ist keine Kundenstimme", not kundenstimmen("Schreib „Entwurf“ in die Kommentare."))
    json.dumps(gut, ensure_ascii=False)

    for name, ok in faelle:
        print("  {}  {}".format("ok    " if ok else "FALSCH", name))
    falsch = sum(1 for _, ok in faelle if not ok)
    print("\nSelbsttest: {} von {} bestanden".format(len(faelle) - falsch, len(faelle)))
    return 1 if falsch else 0

# ---------------------------------------------------------------- Aufruf


def lies_eingabe(pfad):
    try:
        if pfad == "-":
            daten = sys.stdin.buffer.read()
        else:
            with open(pfad, "rb") as f:
                daten = f.read()
    except OSError as e:
        print("Fehler: {} lässt sich nicht lesen ({}).".format(pfad, e.strerror), file=sys.stderr)
        sys.exit(2)
    try:
        return daten.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        print("Fehler: {} ist kein UTF-8 (Byte {}).".format(pfad, e.start), file=sys.stderr)
        sys.exit(2)


def main(argv=None):
    for strom in (sys.stdout, sys.stderr):
        try:
            if (strom.encoding or "").lower().replace("-", "") != "utf8":
                strom.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    ap = argparse.ArgumentParser(description="Prüft eine Caption für @vamela.de (Instagram und TikTok).")
    ap.add_argument("eingabe", nargs="?", default="-", help="Datei mit der Caption oder - für stdin")
    ap.add_argument("--keywords", "--suchbegriffe", dest="keywords", default="",
                    help="Suchbegriffe, durch Komma getrennt (z. B. aus plan/suchbegriffe.json)")
    ap.add_argument("--plattform", choices=("instagram", "tiktok"), default="instagram",
                    help="tiktok: höchstens 3 kuratierte Hashtags")
    ap.add_argument("--angebot", type=str.lower, choices=("werkzeug", "entwurf", "keins"),
                    help="Angebot des Beitrags; steuert „Link in der Bio“")
    ap.add_argument("--saeule", type=str.lower, choices=("tipps", "werkzeuge", "design", "fundstuecke"))
    ap.add_argument("--typ", type=str.lower, choices=("karussell", "reel"),
                    help="karussell: Hashtags so, wie publish.mjs sie postet (Tags aus der Suchphrase davor, auf 5 gekürzt)")
    ap.add_argument("--hook", help="Hook vom Cover; die erste Zeile muss wörtlich damit beginnen")
    ap.add_argument("--fenster", "--truncate", dest="fenster", type=int, default=FENSTER,
                    help="sichtbare Zeichen vor „… mehr“ (Standard {})".format(FENSTER))
    ap.add_argument("--projekt", help="Projektordner mit data/fakten.json (Standard: Suche)")
    ap.add_argument("--json", action="store_true", help="Ergebnis als JSON")
    ap.add_argument("--selbsttest", action="store_true", help="eingebaute Tests ausführen")
    args = ap.parse_args(argv)
    if args.selbsttest:
        sys.exit(selbsttest())
    if args.fenster < 20:
        ap.error("--fenster muss mindestens 20 sein")

    projekt = finde_projekt(args.projekt)
    fakten = lade_json(os.path.join(projekt, "data", "fakten.json")) if projekt else None
    tiktok = lade_json(os.path.join(projekt, "plan", "tiktok-hashtags.json")) if projekt else None
    a = analysiere(lies_eingabe(args.eingabe), fenster=args.fenster, keywords=args.keywords.split(","),
                   plattform=args.plattform, angebot=args.angebot, saeule=args.saeule, hook=args.hook,
                   fakten=fakten, tiktok_tags=tiktok_liste(tiktok) if tiktok else None, typ=args.typ)
    a["projekt"] = projekt
    if args.json:
        print(json.dumps(a, indent=2, ensure_ascii=False))
    else:
        ausgeben(a)
        if not projekt:
            print("  Hinweis: Projektordner mit data/fakten.json nicht gefunden (--projekt).\n")
    sys.exit(STUFE[{"BEREIT": "OK", "PRÜFEN": "WARN", "ÜBERARBEITEN": "FEHLER"}[a["urteil"]]])


if __name__ == "__main__":
    main()
