#!/usr/bin/env python3
"""
hookscore.py - bewertet den ersten Satz eines VAMELA-Reels (oder die Hook-Zeile)
auf fünf Eigenschaften und reiht mehrere Hooks gegeneinander.

Was das ist: fünf Regeln, lokal aus dem Text allein gerechnet, je 0 bis 100.
  LÄNGE        4 bis 9 Wörter sind ideal. 10 ist die VAMELA-Obergrenze für Satz 1
               und die Hook-Zeile (automatik/reel-regeln.mjs), ab 10 meldet der
               Renderer "Hook zu lang". Mehr als 10 ist ein REGEL-Verstoß. Gezählt
               wird wie im Projekt: durch Leerzeichen getrennt, ohne Akzent-Markup.
  KONKRETHEIT  Etwas Prüfbares: eine Zahl (auch ausgeschrieben: "drei", "zwei",
               "dreihundert"), Euro oder Prozent, ein Format oder eine Abkürzung (JPG,
               QR, DPI), ein Ort oder eine Plattform (Freising, Google), eine Zielgruppe
               (Handwerker, Biergarten) oder ein greifbares Ding aus der VAMELA-Welt
               (Formular, Aufsteller, Visitenkarte). Großschreibung zählt nicht, im
               Deutschen sind alle Substantive groß. Die Wortlisten stehen unten.
  EINSATZ      Steht etwas auf dem Spiel? Verneinung, Fehler, Verlust, Defekt, Warnung,
               Abo und Kosten zählen ganz, schwache Wörter (aber, doch, überhaupt) halb.
               Ein Preis zählt nur, wenn jeder Betrag in data/fakten.json steht.
  VORDERLAST   Steht das Gewicht vorn? Ein leerer Anfang ("Also", "Das ist", "Kennst du")
               kostet 30 Punkte, ein spätes erstes Gewicht auch.
  ANREDE       Du-Form: "du", "dein", "dir" oder ein Befehl am Anfang. Ich-Form, "man"
               und "ihr" zählen weniger. Die Sie-Form ist ein REGEL-Verstoß.
Dazu DEALBREAKER (Begrüßung wie "Hey Leute", Vorrede wie "Heute zeige ich dir" oder
"In diesem Video", Bitte um Aufmerksamkeit wie "Nicht weiterscrollen") und REGEL-Verstöße
gegen VAMELA (mehr als 10 Wörter, Hashtag, Emoji, Klammer, Webadresse mit Pfad,
vamela.info, Sie-Form, offener Platzhalter, Erfolgsversprechen wie "Platz 1 in Google",
"abmahnfrei" oder "sicher mehr Kunden", Verknappung, Rabatt, Streichpreis wie "49 € statt
249 €" oder "nur 49 €", Betrag nicht in data/fakten.json, "viele fragen mich"). Die Sie-Form
zählt auch am Anfang: "Sie suchen …" oder "Ihre Website …" hat davor keinen Bezug, ein
Hook beginnt nie in der dritten Person Plural. Jede Meldung kostet 15 Punkte, und mit
Meldung liegt der Hook höchstens bei 45: So ist er nicht verwendbar, erst die Meldung beheben.
Preise kommen aus <projekt>/data/fakten.json (--projekt, ohne Angabe /Users/test/vamela-insta,
wenn es den Ordner gibt). Ohne lesbare fakten.json steht bei jedem Betrag ein HINWEIS
"Preise ungeprüft", und der Preis zählt nicht für EINSATZ.
Gesamt = Mittel der fünf mal 0,6 plus schwächste mal 0,4 minus Meldungen.
STARK ab 70 ohne Meldung und ohne Eigenschaft unter 55, OK ab 50, sonst SCHWACH.

Was das NICHT ist: eine Reichweitenprognose. Die Schwellen sind Setzungen aus den
VAMELA-Regeln und dem englischen Vorbild, nicht an deutschen Hooks gemessen. Das
Vorbild meldet für sich selbst: echte Hooks gegen absichtlich schlechte trennt es gut,
gute Hooks eines Kontos gegen dessen schwache kaum besser als ein Münzwurf. Für diese
deutsche Fassung gibt es keine Messung. Sie fängt Begrüßungen, Vorreden, zu lange Hooks
und Zeilen ohne Substanz. Welcher von zwei brauchbaren Hooks läuft, entscheiden Bild,
Schnitt, Stimme und wem Instagram das Reel zeigt. Den Insights traust du mehr.

Braucht beats.py im selben Ordner (Sprechzeit von Satz 1 und die Inhaltsregeln) und
liest hooks.json (welche Formel der Hook trifft).

Aufruf (python3 -I, nur Standardbibliothek, kein Netz)
  python3 -I hookscore.py hooks.txt                  # ein Hook je Zeile, gereiht
  python3 -I hookscore.py --hook "Dein Formular kann still kaputt sein."
  pbpaste | python3 -I hookscore.py -
  python3 -I hookscore.py hooks.txt --json
  python3 -I hookscore.py hooks.txt --projekt /pfad/zu/vamela-insta
  Zeilen mit "# " am Anfang sind Kommentare. Ausgang 0, wenn der beste Hook mindestens
  70 hat, sonst 1, bei leerer Eingabe oder fehlendem Projektordner 2.
"""

import argparse
import importlib.util
import json
import os
import re
import statistics
import sys
import unicodedata

HIER = os.path.dirname(os.path.abspath(__file__))


def _lade_beats():
    """beats.py aus demselben Ordner laden, ohne __pycache__ im Skill-Ordner anzulegen."""
    pfad = os.path.join(HIER, "beats.py")
    alt = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        spec = importlib.util.spec_from_file_location("ig_reel_beats", pfad)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    finally:
        sys.dont_write_bytecode = alt


try:
    BEATS = _lade_beats()
except Exception as e:                                          # noqa: BLE001
    raise ImportError(f"hookscore.py braucht beats.py im selben Ordner ({HIER}): {e}")

HOOK_WORTE_MAX = BEATS.HOOK_WORTE_MAX            # 10
HOOK_WORTE_RENDERER = BEATS.HOOK_WORTE_RENDERER  # 9
ZEICHEN_ZWEI_ZEILEN = 60
MIT_MELDUNG_MAX = 45.0                           # mit DEALBREAKER oder REGEL-Verstoß nie über SCHWACH
# Erlaubte Preise aus data/fakten.json des Standard-Projekts; main() nimmt --projekt. Auch ig-viral/swipe.py ruft
# run(text) und bekommt so dieselbe Preisprüfung.
PREISE, PREISE_GRUND = BEATS.lade_preise(BEATS.projekt_standard())
_STANDARD = object()                             # Platzhalter: "Preise aus PREISE nehmen"

# ------------------------------------------------------------------ Wortlisten (zum Erweitern gedacht)
_ZAHL_TEILE = (r"(?:null|ein|zwei|drei|vier|fünf|sechs|sech|sieben|sieb|acht|neun|zehn|elf|zwölf|zwanzig|dreißig|"
               r"dreissig|zig|hundert|tausend|und)")
ZAHLWORT_RE = re.compile(rf"^{_ZAHL_TEILE}+(?:te[rnsm]?|ste[rnsm]?|mal|fach|fache[rnsm]?|erlei)?$")
ORDINAL_RE = re.compile(r"^(?:zweit|dritt|viert|fünft|sechst|siebt|neunt|zehnt|elft|zwölft)e[rnsm]?$")
NICHT_ZAHL = {"ein", "eine", "einer", "eines", "einem", "einen", "eins", "und", "einmal", "einfach", "einfache",
              "einfachen", "einfacher", "einfaches", "einerlei", "einst", "einzig"}
ZAHL_EXTRA = {"halb", "halbe", "halben", "halber", "halbes", "hälfte", "doppelt", "doppelte", "doppelten", "dutzend",
              "million", "millionen", "milliarde", "milliarden", "euro", "cent", "prozent"}

ORTE = {"freising", "erding", "moosburg", "haag", "zolling", "landshut", "dachau", "münchen", "amper", "landkreis",
        "bayern", "oberbayern", "google", "instagram", "tiktok", "whatsapp", "facebook", "youtube", "maps", "github",
        "vamela", "schlossallee", "bachmaier", "rott", "iphone", "android"}

DINGE = """
logo formular anfrage spam spamordner ordner telefonnummer nummer rufnummer speisekarte karte visitenkarte flyer
briefkopf aufsteller schild fahrzeug auto aufkleber folie schaufenster theke tresen kasse rechnung profil profilbild
titelbild kategorie hauptkategorie öffnungszeit bewertung rezension stern kommentar code link impressum startseite
handy smartphone button knopf menü ladezeit druckerei druckdatei datei dateiformat format auflösung banner plakat
aushang beschriftung plotter vektor vektordatei pixel foto bild scan schrift schriftart farbe farbcode favicon
signatur unterschrift überweisung wlan passwort gästenetz domain browser werkzeug vorlage checkliste kamera
postfach mail adresse eintrag zeltkarte qr dpi jpg png svg pdf eps dxf programm kontakt kontaktdaten kontaktweg app
""".split()
GRUPPEN = """
handwerker handwerk schreiner schreinerei tischler elektriker maler installateur gärtner friseur salon wirt
gastronom gastronomie biergarten café cafe pizzeria restaurant gasthaus gasthof bäcker bäckerei metzger metzgerei
praxis physio physiotherapeut torbauer reinigung ferienwohnung verein ladenbesitzer inhaber selbstständige
selbständige gründer gast gäste handwerksbetrieb familienbetrieb
""".split()
_SUFFIXE = ("", "s", "e", "n", "en", "er", "ern", "es", "se", "in", "innen", "nen")


def _formen(staemme):
    return {st + suf: st for st in staemme for suf in _SUFFIXE}


DINGE_FORMEN = _formen(DINGE)
GRUPPEN_FORMEN = _formen(GRUPPEN)


def _stamm_in(teil, formen):
    """Ist teil eine Form aus formen oder ein Kompositum, das darauf endet (Kontakt-formular, Handy-foto)?"""
    if teil in formen:
        return formen[teil]
    for k in range(3, len(teil) - 1):
        if teil[k:] in formen:
            return formen[teil[k:]]
    return None


# Einsatz: (Name, Muster, Gewicht). Jeder Name zählt höchstens einmal.
EINSATZ = [(n, re.compile(r, re.IGNORECASE), g) for n, r, g in [
    ("Verneinung", r"\b(?:nie|niemals|nichts|niemand|keiner|nirgends|nicht|kein|keine|keinen|keinem|keines|ohne|weder)\b", 1.0),
    ("Fehler", r"\b(?:falsch\w*|fehler\w*|irrtum|irrst|mythos|mythen|lüge\w*|verkehrt|schief\w*|daneben|peinlich\w*)\b", 1.0),
    ("Verlust", r"\b(?:verlier\w*|verlor\w*|verlust\w*|verschenk\w*|verpass\w*|versäum\w*|übersehen|entgeh\w*|kostet|"
                r"kostest|gekostet|teuer\w*|bezahlst|zahlst)\b", 1.0),
    ("Defekt", r"\b(?:kaputt\w*|defekt\w*|abgelaufen|läuft\s+ab|ablaufen|veraltet\w*|unsichtbar\w*|unlesbar\w*|unscharf\w*|"
               r"verpixelt\w*|pixelig\w*|pixel-?logo\w*|pixelbild\w*|ruiniert\w*|bremst|gehackt|offline|wertlos\w*|"
               r"nutzlos\w*|sinnlos\w*|unbrauchbar\w*|verschwind\w*|verschwunden|ins\s+leere|spam\w*)\b", 1.0),
    ("Warnung", r"\b(?:stopp\w*|aufhören|hör\w*\s+auf|lass\s+das|finger\s+weg|achtung|vorsicht|warnung|risiko|gefahr|"
                r"problem\w*|schluss\s+mit|bloß)\b", 1.0),
    ("Geheimnis", r"\b(?:geheim\w*|wahrheit|versteckt\w*|verrät|verraten|unbequem\w*|insider)\b", 1.0),
    ("Gratis", r"\b(?:gratis\w*|kostenlos\w*|umsonst)\b", 1.0),
    ("Abo", r"\b(?:abo|abos|abofalle|abokosten|abonnement\w*|gebühr\w*|monatlich\w*)\b", 1.0),
    ("Gegensatz", r"\b(?:statt|stattdessen|anstatt|versus|vs)\b", 1.0),
    ("Zustand", r"\b(?:alt|alte|alten|alter|altes|leer\w*|stumm|still\w*)\b", 0.5),
    ("Zweifel", r"\b(?:überhaupt|wirklich|tatsächlich|eigentlich|vielleicht|womöglich|angeblich)\b", 0.5),
    ("Aber", r"\b(?:aber|doch|sondern|sonst|außer|trotzdem|dennoch)\b", 0.5),
    ("Zeitpunkt", r"\b(?:bevor|bis|noch|schon|erst|nur|längst|sofort)\b", 0.5),
]]

# Leere Anfänge, Wort für Wort verglichen (klein, ohne Satzzeichen)
LEERE_ANFAENGE = [tuple(a.split()) for a in [
    "also", "ok", "okay", "ähm", "äh", "naja", "na", "tja", "ja", "hey", "hi", "hallo", "servus", "moin", "leute",
    "heute", "grundsätzlich", "ehrlich gesagt", "eigentlich", "zuerst", "erstmal", "kurz", "kennst du", "kennt ihr",
    "weißt du", "wisst ihr", "wusstest du", "hast du schon", "hast du gewusst", "willst du", "möchtest du",
    "stell dir vor", "ich möchte", "ich will", "ich wollte", "ich zeige", "es gibt", "es ist", "das ist", "das sind",
    "hier ist", "hier sind", "dies ist", "in diesem", "in dieser", "im heutigen", "wenn man", "man kann", "viele",
    "jeder", "manche", "lass uns", "lasst uns", "willkommen",
]]

# Du-Imperative am Satzanfang. Formen mit -e (schicke, prüfe) zählen über die Regel in check_anrede mit.
# Bewusst nicht drin: Wörter, die am Anfang meist Substantive sind (Tipp, Test, Plan, Buch, Spiel, Acht).
IMPERATIVE = set("""
schick prüf hol nimm lass hör mach schreib zeig frag nutz leg stell setz check teste speicher scann lies sieh
schau guck vergiss spar druck bestell kopier füg gib bau wähl nenn sag such find denk probier klau öffn lösch kündig
ersetz räum wirf pack drück klick lad änder bleib geh komm fang rechn miss zähl vergleiche achte merk notier ruf
versuch trau schalt zeichn plane buche sichere übernimm gönn lern starte meld trag fahr tausch
""".split())

# Begrüßung und Bitte um Aufmerksamkeit zählen nur am Anfang und nur, wenn sie nicht in Anführungszeichen stehen
# („Willkommen auf unserer Website.“ als zitiertes schlechtes Beispiel ist keine Begrüßung).
DEALBREAKER = [
    (re.compile(r"^[^\w„“\"»‚']*(?:hey|hi|hallo|hello|servus|moin(?:sen)?|grüß\s+(?:gott|dich|euch)|griaß\s+(?:di|eich|enk|euch)|"
                r"guten\s+(?:tag|morgen|abend)|(?:herzlich\s+)?willkommen|na\s+(?:ihr|du|leute)|was\s+geht|"
                r"liebe\s+(?:leute|community|freunde)|meine\s+lieben|ihr\s+lieben|"
                r"schön,?\s+dass\s+(?:du|ihr)\s+(?:wieder\s+)?(?:da|hier)\s+(?:bist|seid))\b", re.IGNORECASE),
     "Begrüßung (\"Hey Leute\"). Niemand ist für eine Begrüßung in den Feed gekommen."),
    (re.compile(r"\b(?:in\s+(?:diesem|dem|meinem)\s+(?:heutigen\s+|kurzen\s+|neuen\s+)?(?:video|reel|clip|beitrag|post|short)|"
                r"im\s+heutigen\s+(?:video|reel|clip|beitrag)|"
                r"heute\s+(?:zeige|erkläre|erzähle|verrate|bringe)\s+ich|"
                r"heute\s+(?:geht\s+es|geht's|gehts|sprechen\s+wir|reden\s+wir|schauen\s+wir|will\s+ich|möchte\s+ich)|"
                r"ich\s+(?:zeige|erkläre|erzähle|verrate)\s+(?:dir|euch|ihnen)|"
                r"ich\s+(?:möchte|will|werde|wollte)\s+(?:dir|euch|ihnen)\s+(?:heute\s+|jetzt\s+|gleich\s+|kurz\s+)?"
                r"(?:\w+\s+){0,3}?(?:zeigen|erklären|erzählen|sagen|verraten|vorstellen)|"
                r"lass\s+mich\s+(?:dir|euch)\s+(?:\w+\s+){0,2}?(?:zeigen|erklären|erzählen)|"
                r"gleich\s+(?:zeige|erkläre|erfährst|siehst)|"
                r"bleib\s+bis\s+zum\s+(?:ende|schluss)|am\s+ende\s+(?:des|vom|dieses)\s+(?:videos|reels|clips))\b",
                re.IGNORECASE),
     "Vorrede (\"In diesem Video\", \"Heute zeige ich dir\"). Streich sie und fang mit dem Ergebnis an."),
    (re.compile(r"^[^\w„“\"»‚']*(?:stopp?\s+(?:das\s+|mal\s+)?(?:scrollen|scroll)|nicht\s+(?:weiter\s*)?scrollen|"
                r"scroll\s+(?:nicht|bloß\s+nicht)\s+weiter|hör\s+auf\s+zu\s+scrollen|bleib\s+(?:kurz\s+|mal\s+)?(?:hier|stehen|dran)|"
                r"warte\s+(?:kurz|mal|einen\s+moment)|moment\s+mal|hör\s+(?:mal\s+|kurz\s+)?(?:gut\s+)?zu|aufgepasst|"
                r"achtung,?\s+achtung)\b", re.IGNORECASE),
     "Bittet um Aufmerksamkeit (\"Nicht weiterscrollen\"). Wer sie sich verdient, muss nicht darum bitten."),
]

DU_RE = re.compile(r"\b(?:du|dir|dich|dein\w*|deins)\b", re.IGNORECASE)
IHR_RE = re.compile(r"\b(?:ihr|euch|euer|eure[mnrs]?)\b", re.IGNORECASE)
ICH_RE = re.compile(r"\b(?:ich|mein\w*|mir|mich|wir|unser\w*|uns)\b", re.IGNORECASE)
MAN_RE = re.compile(r"\bman\b", re.IGNORECASE)
QUOTE_PAARE = {"„": "“", "\"": "\"", "»": "«", "“": "”"}
RAND = ".,;:!?…„“”\"»«‚‘’()"


# ------------------------------------------------------------------ Hilfsfunktionen
def zahl(x, stellen=1):
    return f"{x:.{stellen}f}".replace(".", ",")


def clamp(n):
    return max(0.0, min(100.0, n))


def normalisiere(zeile):
    """Listenzeichen weg, Leerraum glätten; Anführungszeichen nur weg, wenn sie die ganze Zeile umschließen."""
    zeile = unicodedata.normalize("NFC", zeile)                   # "ü" auch aus zerlegter Schreibweise
    t = " ".join(re.sub(r"^\s*(?:[-*•]|\d+[.)])\s+", "", zeile.strip()).split())
    if len(t) >= 2 and t[0] in QUOTE_PAARE and t[-1] == QUOTE_PAARE[t[0]] and not any(
            c in t[1:-1] for c in "„“”\"»«"):
        t = t[1:-1].strip()
    return t


def woerter(text):
    """Wörter wie im Projekt (Leerzeichen, ohne Markup). Ein allein stehendes "/" trennt bei Karussell-Covern
    Überschrift und Unterzeile und zählt dort nicht (automatik/karussell-regeln.mjs), also auch hier nicht."""
    return [w for w in BEATS.woerter(text) if w != "/"]


def ist_gross(text):
    b = [c for c in text if c.isalpha()]
    return bool(b) and sum(c.isupper() for c in b) / len(b) > 0.6


def marker(text, gross=None):
    """Konkrete Marker: Liste von (Wort, Arten) mit Arten aus zahl, format, ort, ding, gruppe.
    gross: Text in Großbuchstaben (Hook-Karte in Versalien), dann zählt Großschreibung nicht als Abkürzung."""
    if gross is None:
        gross = ist_gross(text)
    out = []
    for w in woerter(text):
        sauber = w.strip(RAND)
        arten = set()
        if re.search(r"\d", w) or "€" in w or "%" in w:
            arten.add("zahl")
        for teil in re.split(r"[\W_]+", sauber):
            if not teil:
                continue
            low = teil.lower()
            if low not in NICHT_ZAHL and (ZAHLWORT_RE.match(low) or ORDINAL_RE.match(low) or low in ZAHL_EXTRA):
                arten.add("zahl")
            if not gross and len(teil) >= 2 and teil.isalpha() and teil.isupper():
                arten.add("format")
            if low in ORTE:
                arten.add("ort")
            if _stamm_in(low, DINGE_FORMEN):
                arten.add("ding")
            if _stamm_in(low, GRUPPEN_FORMEN):
                arten.add("gruppe")
        if arten:
            out.append((sauber, arten))
    return out


def einsatz_treffer(text):
    flach = BEATS.ohne_markup(text)
    treffer = []
    for name, rx, gew in EINSATZ:
        m = rx.search(flach)
        if m:
            treffer.append((name, m.group(0), gew))
    return treffer


def satz1(text):
    teile = BEATS.saetze(BEATS.ohne_markup(text))
    return teile[0] if teile else text


def satz1_ende(text):
    """Geschätzter Zeitpunkt, an dem die Stimme Satz 1 fertig gesprochen hat (Anlauf plus Sprechzeit, beats.py)."""
    return BEATS.ANLAUF + BEATS.sprechzeit(BEATS.stimmentext(satz1(text)))


# ------------------------------------------------------------------ die fünf Eigenschaften
def check_laenge(text):
    n = len(woerter(text))
    zeichen = len(text.strip())
    ende = satz1_ende(text)
    if 4 <= n <= HOOK_WORTE_RENDERER:
        score = 100.0
    elif n < 4:
        score = 100.0 - (4 - n) * 25
    elif n == HOOK_WORTE_MAX:
        score = 85.0
    else:
        score = 60.0 - (n - HOOK_WORTE_MAX - 1) * 12
    if zeichen > ZEICHEN_ZWEI_ZEILEN:
        score -= 10
    if ende > BEATS.HOOK_ZU_LANG:
        score -= 10
    detail = (f"{n} Wörter, {zeichen} Zeichen, Satz 1 gesprochen bis ca. {zahl(ende)} s "
              f"(ideal 4 bis {HOOK_WORTE_RENDERER} Wörter, Obergrenze {HOOK_WORTE_MAX}; Hook-Karte bis "
              f"{zahl(BEATS.HOOK_KARTE)} s)")
    if n == HOOK_WORTE_MAX:
        detail += "; ab 10 Wörtern meldet der Renderer \"Hook zu lang\""
    return clamp(score), detail


def check_konkretheit(text):
    m = marker(text)
    zahlen = sum(1 for _, a in m if "zahl" in a)
    sonst = sum(1 for _, a in m if a - {"zahl"})
    punkte = min(zahlen, 2) * 40 + min(sonst, 3) * 25
    score = 15.0 if punkte == 0 else clamp(45 + punkte)
    if not m:
        return score, "nichts Prüfbares: keine Zahl, kein Format, kein Ort, kein greifbares Ding"
    return score, f"{len(m)} konkrete(r) Marker: {', '.join(w for w, _ in m[:4])}"


def check_einsatz(text, preise=_STANDARD):
    preise = PREISE if preise is _STANDARD else preise
    treffer = einsatz_treffer(text)
    summe = sum(g for _, _, g in treffer)
    worte = [w.lower() for _, w, _ in treffer]
    betraege = BEATS.preise_im_text(BEATS.ohne_markup(text))
    if betraege and preise is not None and all(p in preise for p in betraege):   # nur belegte Preise zählen
        summe += 1.0
        worte.append("ein belegter Preis")
    if summe < 0.5:
        score = 20.0
    elif summe < 1.0:
        score = 45.0
    elif summe < 2.0:
        score = 70.0
    else:
        score = 100.0
    if not worte:
        return score, "nichts steht auf dem Spiel: Was verliert, verpasst oder macht der Zuschauer falsch?"
    return score, f"Spannung durch: {', '.join(worte[:4])}"


def _gewicht(wort, gross):
    """Erstes Gewicht im Satz: konkreter Marker oder starkes Spannungswort."""
    if marker(wort, gross):
        return True
    return any(g >= 1.0 and rx.search(wort) for _, rx, g in EINSATZ)


def check_vorderlast(text):
    w = woerter(text)
    if not w:
        return 0.0, "leer"
    low = [x.strip(RAND).lower() for x in w]
    abzug, leer = 0, None
    if re.match(r"^so,", w[0], re.IGNORECASE):
        abzug, leer = 30, "so,"
    else:
        for anfang in LEERE_ANFAENGE:
            if tuple(low[:len(anfang)]) == anfang:
                abzug, leer = 30, " ".join(anfang)
                break
    gross = ist_gross(text)
    pos = next((i for i, x in enumerate(w) if _gewicht(x, gross)), None)
    if pos is None:
        basis, wo = 30.0, "kein Gewicht im ganzen Satz (keine Zahl, kein Ding, kein Spannungswort)"
    elif pos <= 3:
        basis, wo = 100.0, f"erstes Gewicht bei Wort {pos + 1} (\"{w[pos].strip(RAND)}\")"
    elif pos <= 6:
        basis, wo = 70.0, f"erstes Gewicht erst bei Wort {pos + 1} (\"{w[pos].strip(RAND)}\"), könnte nach vorn"
    else:
        basis, wo = 40.0, f"erstes Gewicht erst bei Wort {pos + 1} (\"{w[pos].strip(RAND)}\"), zu spät"
    return clamp(basis - abzug), wo + (f"; leerer Anfang \"{leer}\"" if leer else "")


def _sie_form(flach):
    """Sie-Form wie beats.sie_form(): sicher, oder am Anfang des Hooks ("Sie suchen", "Ihre Website"), wo kein Bezug davor
    steht. Ein späterer Satzanfang zählt hier nicht, den meldet hinweise()."""
    sicher, fraglich = BEATS.sie_form(flach)
    return bool(sicher) or any(anfang for _, anfang in fraglich)


def check_anrede(text):
    flach = BEATS.ohne_markup(text)
    erstes = next(iter(re.findall(r"[^\W\d_]+", flach)), "").lower()
    if DU_RE.search(flach):
        return 100.0, "spricht den Zuschauer mit du/dein an"
    if erstes in IMPERATIVE or (erstes.endswith("e") and erstes[:-1] in IMPERATIVE):
        return 90.0, f"Befehl am Anfang (\"{erstes}\")"
    if _sie_form(flach):
        return 30.0, "Sie-Form: VAMELA schreibt Du"
    if IHR_RE.search(flach):
        return 75.0, "spricht mehrere an (ihr/euch); VAMELA spricht eine Person an: du"
    if ICH_RE.search(flach):
        return 65.0, "Ich-Form, der Zuschauer kommt nicht vor"
    if MAN_RE.search(flach):
        return 40.0, "\"man\": niemand ist gemeint"
    return 35.0, "dritte Person, niemand im Raum"


CHECKS = ["LÄNGE", "KONKRETHEIT", "EINSATZ", "VORDERLAST", "ANREDE"]


def meldungen(text, preise=_STANDARD):
    """DEALBREAKER und REGEL-Verstöße als Liste. preise wie BEATS.lade_preise(); ohne Angabe PREISE."""
    preise = PREISE if preise is _STANDARD else preise
    flach = BEATS.ohne_markup(text)
    out = [f"DEALBREAKER: {msg}" for rx, msg in DEALBREAKER if rx.search(flach)]
    n = len(woerter(text))
    if n > HOOK_WORTE_MAX:
        out.append(f"REGEL: Hook hat {n} Wörter, VAMELA erlaubt höchstens {HOOK_WORTE_MAX}.")
    out.extend(f"REGEL: {v}." for v in BEATS.regelverstoesse(text, preise))
    return out


def hinweise(text, preise=_STANDARD, grund=None):
    """Hinweise ohne Punktabzug."""
    if preise is _STANDARD:
        preise, grund = PREISE, PREISE_GRUND
    flach = BEATS.ohne_markup(text)
    h = list(BEATS.preis_hinweise(flach, preise, grund))
    spaeter = list(dict.fromkeys(w for w, anfang in BEATS.sie_form(flach)[1] if not anfang))
    if spaeter:
        liste = ", ".join(f"„{w}“" for w in spaeter[:3])
        h.append(f"Sie-Form? {liste} am Satzanfang. Passt nur, wenn „sie“ (Plural) gemeint ist, die Anrede ist Du.")
    teile = BEATS.saetze(flach)
    if len(teile) > 1:
        h.append(f"{len(teile)} Sätze in der Zeile. Gesprochen ist nur Satz 1 der Hook ({len(teile[0].split())} Wörter), "
                 f"als Hook-Zeile zählt die ganze Zeile.")
    if re.search(r"(?i)vamela(?!\.info)", flach):
        h.append("Aussprache: \"vamela.de\" spricht die Stimme als \"Fameela Punkt D E\", im Bild bleibt vamela.de.")
    if re.search(r"\d\s?(?:%|prozent)|\bprozent\b|\b(?:jede[rsnm]?)\s+(?:zweite|dritte|vierte|fünfte|zehnte)\b|"
                 r"\b(?:studie|umfrage|statistik)\w*", flach, re.IGNORECASE):
        h.append("Prozent, Studie oder \"jeder Zweite\": nur mit Quelle, die im Reel genannt wird. Sonst {{Zahl fehlt}}.")
    if re.search(r"\d", flach):
        h.append("Ziffern: Für die Stimme ausgeschrieben (\"drei\") ist eindeutig, auf der Hook-Karte dürfen Ziffern stehen.")
    if re.match(r"^\W*(?:das|dies|hier)\s+(?:ist|sind)\b", flach, re.IGNORECASE):
        h.append("\"Das ist …\" trägt nur, wenn das Ding schon im ersten Bild zu sehen ist.")
    return h


def run(text, preise=_STANDARD):
    """(Ergebnisse je Eigenschaft, Gesamtwert, Urteil, Meldungen). Diese Form nutzt auch ig-viral/swipe.py, mit einem
    Argument; dann gelten die Preise aus PREISE (data/fakten.json des Standard-Projekts)."""
    preise = PREISE if preise is _STANDARD else preise
    text = normalisiere(text)
    ergebnisse = {
        "LÄNGE": check_laenge(text),
        "KONKRETHEIT": check_konkretheit(text),
        "EINSATZ": check_einsatz(text, preise),
        "VORDERLAST": check_vorderlast(text),
        "ANREDE": check_anrede(text),
    }
    flags = meldungen(text, preise)
    werte = [ergebnisse[c][0] for c in CHECKS]
    # Die schwächste Eigenschaft deckelt den Hook: eine schlechte reicht, damit der Daumen weiterwischt.
    gesamt = clamp(statistics.mean(werte) * 0.6 + min(werte) * 0.4 - len(flags) * 15)
    if flags:                                    # so nicht verwendbar: höchstens SCHWACH
        gesamt = min(gesamt, MIT_MELDUNG_MAX)
    urteil = "STARK" if gesamt >= 70 and min(werte) >= 55 and not flags else ("OK" if gesamt >= 50 else "SCHWACH")
    return ergebnisse, gesamt, urteil, flags


# ------------------------------------------------------------------ Formel aus hooks.json
def lade_formeln(pfad=None):
    pfad = pfad or os.path.join(HIER, "hooks.json")
    try:
        with open(pfad, encoding="utf-8") as f:
            d = json.load(f)
        nach_id = {h["id"]: h for h in d["hooks"]}
        reihe = d.get("classify_order") or sorted(nach_id)
        return [(i, nach_id[i]["name"], re.compile(nach_id[i]["match"], re.IGNORECASE)) for i in reihe if i in nach_id]
    except (OSError, ValueError, KeyError, re.error):
        return None


FORMELN = lade_formeln()


def formel(text, formeln=None):
    """Erste Formel aus hooks.json (Reihenfolge classify_order), deren match passt: (id, Name) oder (None, None)."""
    formeln = FORMELN if formeln is None else formeln
    flach = BEATS.ohne_markup(normalisiere(text))
    for fid, name, rx in formeln or []:
        if rx.search(flach):
            return fid, name
    return None, None


# ------------------------------------------------------------------ Ausgabe
def balken(score, breite=24):
    voll = round(score / 100 * breite)
    return "#" * voll + "." * (breite - voll)


def zeige_einzeln(d, out=sys.stdout):
    print("\nHOOK-BEWERTUNG", file=out)
    print("=" * 66, file=out)
    print(f"  „{d['hook']}“\n", file=out)
    for name in CHECKS:
        c = d["checks"][name]
        print(f"  {name:<12} {balken(c['score'])} {zahl(c['score']):>5}", file=out)
        print(f"  {'':<12} {c['detail']}", file=out)
    print("-" * 66, file=out)
    print(f"  {'HOOK-WERT':<12} {balken(d['score'])} {zahl(d['score']):>5}   {d['urteil']}", file=out)
    if FORMELN is not None:
        f = d["formel"]
        print(f"  {'FORMEL':<12} " + (f"#{f['id']} {f['name']}" if f else "keine Formel aus hooks.json erkannt"), file=out)
    for f in d["flags"]:
        print(f"\n  {f}", file=out)
    for h in d["hinweise"]:
        print(f"\n  HINWEIS: {h}", file=out)
    if d["urteil"] != "STARK":
        print(f"\n  Schwächste Eigenschaft: {d['schwaechste']}. Die zuerst verbessern und noch einmal laufen lassen.", file=out)
    print("", file=out)


def zeige_tabelle(zeilen, out=sys.stdout):
    print("\nHOOK-RANGLISTE\n" + "=" * 78, file=out)
    for i, r in enumerate(zeilen, 1):
        pfeil = "->" if i == 1 else "  "
        hook = r["hook"] if len(r["hook"]) <= 56 else r["hook"][:53] + "..."
        f = f"#{r['formel']['id']}" if r["formel"] else "--"
        print(f"{pfeil} {zahl(r['score']):>5} {r['urteil']:<8}{f:<4} {hook}", file=out)
        print(f"        schwächste: {r['schwaechste']} ({r['checks'][r['schwaechste']]['score']:.0f})"
              + (f"; Formel: {r['formel']['name']}" if r["formel"] else ""), file=out)
        for fl in r["flags"]:
            print(f"        {fl}", file=out)
    print("\nNimm den obersten. Liegt der oberste unter 50, ist keiner davon der Hook.\n", file=out)


def bewerte(zeile, preise=_STANDARD, grund=None):
    if preise is _STANDARD:
        preise, grund = PREISE, PREISE_GRUND
    ergebnisse, gesamt, urteil, flags = run(zeile, preise)
    fid, fname = formel(zeile)
    hook = normalisiere(zeile)
    return {
        "hook": hook,
        "checks": {k: {"score": round(v[0], 1), "detail": v[1]} for k, v in ergebnisse.items()},
        "schwaechste": min(CHECKS, key=lambda c: ergebnisse[c][0]),
        "flags": flags, "hinweise": hinweise(hook, preise, grund),
        "formel": {"id": fid, "name": fname} if fid else None,
        "satz1_ende_s": round(satz1_ende(hook), 2),
        "score": round(gesamt, 1), "urteil": urteil,
    }


def main():
    ap = argparse.ArgumentParser(description="Bewertet Reel-Hooks auf fünf Eigenschaften (Deutsch, VAMELA-Regeln).")
    ap.add_argument("input", nargs="?", default="-", help="Datei mit einem Hook je Zeile, oder - für Stdin")
    ap.add_argument("--hook", help="einen einzelnen Hook bewerten")
    ap.add_argument("--projekt", help="Projektordner vamela-insta für die Preise aus data/fakten.json "
                                      f"(ohne Angabe {BEATS.PROJEKT_STANDARD}, wenn es ihn gibt)")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    preise, grund = PREISE, PREISE_GRUND
    if args.projekt is not None:
        if not os.path.isdir(args.projekt):
            print(f"Projektordner nicht gefunden: {args.projekt}", file=sys.stderr)
            sys.exit(2)
        preise, grund = BEATS.lade_preise(args.projekt)

    if args.hook:
        zeilen = [args.hook]
    else:
        try:
            if args.input == "-":
                roh = sys.stdin.read()
            else:
                with open(args.input, encoding="utf-8") as f:
                    roh = f.read()
        except (OSError, UnicodeDecodeError) as e:
            print(f"Eingabe nicht lesbar: {e}", file=sys.stderr)
            sys.exit(2)
        zeilen = [z for z in roh.lstrip("\ufeff").splitlines() if not re.match(r"^\s*#(?:\s|$)", z)]
    zeilen = [z for z in zeilen if normalisiere(z)]
    if not zeilen:
        print("nichts zu bewerten", file=sys.stderr)
        sys.exit(2)

    daten = [bewerte(z, preise, grund) for z in zeilen]
    if args.json:
        print(json.dumps(daten if len(daten) > 1 else daten[0], indent=2, ensure_ascii=False))
    elif len(daten) == 1:
        zeige_einzeln(daten[0])
    else:
        zeige_tabelle(sorted(daten, key=lambda r: -r["score"]))
    sys.exit(0 if max(d["score"] for d in daten) >= 70 else 1)


if __name__ == "__main__":
    main()
