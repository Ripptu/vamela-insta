#!/usr/bin/env python3
"""
humanize.py - nimmt den Maschinen-Fingerabdruck aus einem Entwurf. Standard: Deutsch.

Drei Durchgänge, in dieser Reihenfolge:

  1. UNSICHTBAR  löscht Zeichen, die keine Tastatur erzeugt (Nullbreite-Zeichen,
                 weiche Trennstriche, BOM, Tag-Zeichen, Richtungsmarken) und macht
                 geschützte oder schmale Leerzeichen zu normalen. Der Verbinder
                 zwischen zwei Emojis und Flaggen-Emojis bleiben heil.
  2. TYPOGRAFIE  Deutsch: „…“, ‚…‘, »…«, ’ und … bleiben. Der Halbgeviertstrich in
                 Spannen (9–17 Uhr, 5–10 €, Mo–Fr) bleibt. Geviertstrich und
                 freistehender Gedankenstrich ( – ) werden Komma oder Punkt,
                 englische “…” und gerade "…" werden „…“.
  3. FLOSKELN    ersetzt die Floskeln aus slop.json durch schlichte Wörter, behält
                 Groß/klein und lässt Links, Domains, @Namen und #Hashtags in Ruhe.

Satzmuster („Es geht nicht nur um X, sondern um Y“, Dreierlisten, Emoji-
Aufzählungen) und VAMELA-Hinweise (Preis, Rabatt, Versprechen, Rechtsthema)
werden nur GEMELDET. Einen Satz umbauen braucht Urteil, das ist Arbeit fürs
Modell, nicht für einen regulären Ausdruck. Die VAMELA-Hinweise kommen aus
Entwurf UND Ergebnis: Was nur im Entwurf stand, steht als „verdeckt“ im Bericht.
Der Bericht zählt außerdem die Wörter vorher und nachher, Satz 1 und jeden
Satz, dessen Anfang gelöscht wurde.

Aufruf (Python 3.9, nur Standardbibliothek, kein Netz)
  python3 -I humanize.py entwurf.txt
  python3 -I humanize.py entwurf.txt --bericht
  pbpaste | python3 -I humanize.py - --bericht
  python3 -I humanize.py entwurf.txt --json
  python3 -I humanize.py entwurf.txt -o sauber.txt
  python3 -I humanize.py sprechtext.txt --sprechtext --bericht  # Reel: vamela.de ohne @, 35-60 Wörter, Hook <= 10
  python3 -I humanize.py entwurf.txt --sprache en      # englischer Fallback
"""

import argparse
import json
import os
import re
import sys
import unicodedata

HIER = os.path.dirname(os.path.abspath(__file__))
LEXIKON = os.path.join(HIER, "slop.json")

# Links, E-Mails, @Namen, #Hashtags und Domains (vamela.de/…, github.com/…)
# werden vor den Durchgängen 2 und 3 durch Platzhalter ersetzt.
SCHUTZ_RE = re.compile(
    r"https?://\S+"
    r"|www\.\S+"
    r"|[\w.+-]+@[\w-]+(?:\.[\w-]+)+"
    r"|@\w(?:[\w.]*\w)?"
    r"|#\w+"
    r"|\b[\w-]+(?:\.[\w-]+)*\.(?:de|com|org|net|io|ai|app|dev|eu|at|ch|info|me|co|tv|shop)\b"
    r"(?:/[^\s,;!?)\]»“”„\"]*)?"
)
TOKEN_RE = re.compile(r"\w+(?:[-'’]\w+)*")                 # Wörter und Zahlen
WORT_RE = re.compile(r"[^\W\d_]+(?:[-'’][^\W\d_]+)*")      # nur Wörter, mit Umlauten und ß

MARKE = "\x01"                 # „hier begann ein Satz, nächstes Wort groß“
P_AUF, P_ZU = "\uE010", "\uE011"   # Platzhalter für geschützte Stellen (Privatbereich, kein \w)
E_AUF, E_ZU = "\uE012", "\uE013"   # Platzhalter für Emoji-Folgen im Durchgang 1
PUNKT = "\uE000"               # maskierter Punkt (Abkürzungen) beim Satzteilen
SPUR = "\uE021"                # „hier wurde ein Satzanfang gelöscht“, bleibt bis zum Bericht

# Satz 1 und Wortzahl so, wie die Automatik sie zählt (render/orange.mjs saetze(),
# automatik/reel-regeln.mjs): Wörter durch Leerraum getrennt, Satzende vor Großbuchstabe.
ENDE_RE = re.compile("[.!?\u2026](?=\\s+[A-ZÄÖÜ\u201E\"0-9*_=])")
ABK_ENDE_RE = re.compile(r"(^|\s)(z|d|u|o|bzw|ca|Nr|Dr|St|usw|inkl|ggf|evtl|vgl|bspw|[A-ZÄÖÜa-zäöü])\.$")
SPRECH = {"min": 35, "max": 60, "hook": 10}    # feste Regeln für Sprechtexte (automatik/reel-regeln.mjs)

EMOJI = ("[\U0001F000-\U0001FAFF\u2600-\u27BF\u2B00-\u2BFF\u2300-\u23FF"
         "\u3030\u303D\u3297\u3299\u00A9\u00AE\u203C\u2049\u2122\u2139\u2194-\u21AA\u24C2\u25AA-\u25FE]")
EMOJI_FOLGE_RE = re.compile(
    EMOJI + "[\uFE0F\U0001F3FB-\U0001F3FF]*(?:\u200D" + EMOJI + "[\uFE0F\U0001F3FB-\U0001F3FF]*)+"
    "|\U0001F3F4[\U000E0020-\U000E007E]+\U000E007F")

ABKUERZUNGEN = [
    "z.B.", "d.h.", "u.a.", "o.ä.", "u.v.m.", "i.d.R.", "s.o.", "s.u.", "z.T.", "u.U.", "bzw.", "ca.",
    "usw.", "etc.", "ggf.", "evtl.", "inkl.", "zzgl.", "exkl.", "vgl.", "bspw.", "sog.", "Nr.", "Str.",
    "Tel.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa.", "max.", "min.", "mind.", "Dr.", "Prof.", "St.",
    "Hr.", "Fa.", "Abb.", "Kap.", "Jh.", "Mio.", "Mrd.", "Tsd.", "gem.", "lt.", "insb.", "allg.", "Std.",
    "Sek.", "Jan.", "Feb.", "Apr.", "Aug.", "Sep.", "Sept.", "Okt.", "Nov.", "Dez.",
]
ABK_RE = re.compile(r"(?<![\w.])(?:" + "|".join(
    r"\.\s?".join(re.escape(t) for t in a.split(".") if t) + r"\."
    for a in sorted(ABKUERZUNGEN, key=len, reverse=True)) + ")", re.IGNORECASE)
MONATE = ("Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember"
          "|Jan|Feb|Mär|Apr|Jun|Jul|Aug|Sep|Sept|Okt|Nov|Dez")
ORDINAL_RE = re.compile(r"(?<![\w.])(\d{1,3})\.(?=\s+(?:(?:" + MONATE + r")\b|[a-zäöüß]))")

DE_FUNKTION = {"der", "die", "das", "und", "ist", "nicht", "ein", "eine", "du", "dein", "deine", "mit",
               "für", "auf", "ich", "sich", "auch", "es", "zu", "den", "dem", "von", "wie", "im", "bei",
               "oder", "aber", "wenn", "dass", "noch", "nur", "mehr", "sind", "hat", "kann", "dir", "mal"}
EN_FUNKTION = {"the", "and", "is", "not", "a", "an", "you", "your", "with", "for", "on", "i", "to", "of",
               "it", "that", "this", "are", "be", "can", "have", "how", "what", "if", "or", "but", "just",
               "we", "our", "my", "me", "they", "their", "at", "from", "by", "as", "will", "do", "don't",
               "it's", "was", "were", "has", "there", "about", "than", "more", "get", "make", "people"}


# ------------------------------------------------------------------ Grundlagen

def lexikon_laden(pfad=LEXIKON):
    with open(pfad, encoding="utf-8") as fh:
        return json.load(fh)


def fakten_einlesen(lex, pfad):
    """Werkzeug- und Referenznamen aus data/fakten.json zur Konkretheits-Liste nehmen."""
    with open(pfad, encoding="utf-8") as fh:
        fakten = json.load(fh)
    namen = [re.sub(r"\s*\(.*?\)\s*", " ", w.get("name", "")).strip()
             for w in fakten.get("werkzeuge", []) + fakten.get("referenzen", [])]
    konkret = lex["de"].setdefault("konkret", {})
    konkret["werkzeuge"] = sorted(set(konkret.get("werkzeuge", [])) | {n for n in namen if n})
    lex.pop("_cache", None)


def _cache(lex):
    return lex.setdefault("_cache", {})


def sprache_bestimmen(text):
    tokens = [t.lower() for t in TOKEN_RE.findall(text)]
    de = sum(1 for t in tokens if t in DE_FUNKTION)
    en = sum(1 for t in tokens if t in EN_FUNKTION)
    return "en" if en >= 3 and en > de * 1.5 else "de"


def woerter(text):
    """Wörter ohne Links, @Namen und Hashtags. Umlaute und ß zählen als Buchstaben."""
    return WORT_RE.findall(SCHUTZ_RE.sub(" ", text))


def saetze(text, sprache="de"):
    """Sätze mit mehr als zwei Wörtern. Deutsch: z. B., bzw., 5.000, 12.10.2026, 5. November
    trennen keinen Satz."""
    t = SCHUTZ_RE.sub(" ", text)
    if sprache == "de":
        t = ABK_RE.sub(lambda m: m.group(0).replace(".", PUNKT), t)
        t = re.sub(r"(?<=\d)\.(?=\d)", PUNKT, t)
        t = ORDINAL_RE.sub(lambda m: m.group(1) + PUNKT, t)
    teile = [s.replace(PUNKT, ".").strip() for s in re.findall(r"[^.!?…\n]+[.!?…]*", t)]
    return [s for s in teile if len(TOKEN_RE.findall(s)) > 2]


def am_satzanfang(s, pos):
    i = pos - 1
    while i >= 0 and s[i] in " \t":
        i -= 1
    return i < 0 or s[i] in ".!?:\n(„»\"" + MARKE


def schuetzen(text):
    """Links, Domains, @Namen und #Hashtags gegen Platzhalter tauschen."""
    gefunden = []

    def ablegen(m):
        s, rest = m.group(0), ""
        while len(s) > 1 and s[-1] in ".,;:!?)»“”\"'":
            rest, s = s[-1] + rest, s[:-1]
        gefunden.append(s)
        return P_AUF + chr(0xE100 + len(gefunden) - 1) + P_ZU + rest

    return SCHUTZ_RE.sub(ablegen, text), gefunden


def wiederherstellen(text, gefunden):
    for i, s in enumerate(gefunden):
        text = text.replace(P_AUF + chr(0xE100 + i) + P_ZU, s)
    return text


def _cp(spec):
    """'U+200B' -> 0x200B;  'U+E0000-U+E007F' -> (start, ende)."""
    if "-" in spec:
        a, b = spec.split("-")
        return (int(a[2:], 16), int(b[2:], 16))
    return int(spec[2:], 16)


def kurz(s, n=60):
    s = "".join(c for c in s if unicodedata.category(c) != "Cf")
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= n else s[:n - 1] + "…"


def _beispiel(text, m, rand=25):
    """Fundstelle zeigen. Lange Treffer selbst; kurze (ein Wort, ein Zeichen) mit ihrer Zeile,
    wenn die kürzer als 60 Zeichen ist, sonst mit 25 Zeichen Umgebung, an Wortgrenzen geschnitten."""
    if len(m.group(0).strip()) >= 15:
        return kurz(m.group(0))
    anfang = text.rfind("\n", 0, m.start()) + 1
    ende = text.find("\n", m.end())
    ende = len(text) if ende == -1 else ende
    if len(kurz(text[anfang:ende], 10 ** 6)) < 60:
        return kurz(text[anfang:ende])
    a, b = max(anfang, m.start() - rand), min(ende, m.end() + rand)
    if a > anfang:
        leer = text.find(" ", a, m.start())
        a = leer + 1 if leer != -1 else a
    if b < ende:
        leer = text.rfind(" ", m.end(), b)
        b = leer if leer != -1 else b
    return ("…" if a > anfang else "") + kurz(text[a:b], 10 ** 6) + ("…" if b < ende else "")


def wortzahl(text):
    """Wörter wie automatik/reel-regeln.mjs: alles zwischen Leerraum."""
    return len(text.split())


def erster_satz(text):
    """Satz 1 der ersten Zeile mit Text, getrennt wie saetze() in render/orange.mjs."""
    zeile = next((z.strip() for z in text.split("\n") if z.strip()), "")
    for m in ENDE_RE.finditer(zeile):
        if not ABK_ENDE_RE.search(zeile[:m.start() + 1]):
            return zeile[:m.start() + 1]
    return zeile


# ------------------------------------------------------------------ 1. unsichtbar

AKTIONEN = {"löschen": "", "delete": "", "leerzeichen": " ", "space": " ", "zeile": "\n", "bindestrich": "-"}


def unsichtbar_entfernen(text, lex):
    """Gibt (text, treffer). Emoji-Folgen mit Verbinder und Flaggen bleiben."""
    gesichert = []

    def sichern(m):
        gesichert.append(m.group(0))
        return E_AUF + chr(0xE100 + len(gesichert) - 1) + E_ZU

    text = EMOJI_FOLGE_RE.sub(sichern, text)
    treffer = []
    for e in lex["invisible"]:
        cp = _cp(e["cp"])
        if isinstance(cp, tuple):
            muster = "[" + re.escape(chr(cp[0])) + "-" + re.escape(chr(cp[1])) + "]"
        else:
            muster = re.escape(chr(cp))
        n = len(re.findall(muster, text))
        if n:
            treffer.append({"name": e["cp"] + " " + e["name"], "anzahl": n, "aktion": e["action"]})
            text = re.sub(muster, AKTIONEN.get(e["action"], ""), text)
    rest = [c for c in text if unicodedata.category(c) == "Cf"]
    if rest:
        treffer.append({"name": "weitere unsichtbare Formatzeichen", "anzahl": len(rest), "aktion": "löschen"})
        text = "".join(c for c in text if unicodedata.category(c) != "Cf")
    for i, s in enumerate(gesichert):
        text = text.replace(E_AUF + chr(0xE100 + i) + E_ZU, s)
    return text, treffer


# ------------------------------------------------------------------ 2. Typografie

STRICH_RE = re.compile(r"[ \t]*—[ \t]*|[ \t]+–[ \t]+")


def _ist_spanne(links, rechts, cfg):
    """9 – 17 Uhr, 5 – 10 €, Mo – Fr: Halbgeviertstrich in einer Spanne bleibt."""
    woerter_spanne = set(cfg.get("spannen_woerter", []))

    def passt(t):
        t = t.strip(".,;:()[]")
        return bool(re.fullmatch(r"\d[\d.,:]*", t)) or t in woerter_spanne

    ml = re.search(r"(\S+)\s*$", links)
    mr = re.match(r"\s*(\S+)", rechts)
    return bool(ml and mr and passt(ml.group(1)) and passt(mr.group(1)))


def freie_gedankenstriche(text, cfg):
    """Zahl der freistehenden Halbgeviertstriche, die keine Spanne sind."""
    n = 0
    for zeile in text.split("\n"):
        for m in re.finditer(r"[ \t]+–[ \t]+", zeile):
            if not _ist_spanne(zeile[:m.start()], zeile[m.end():], cfg):
                n += 1
    return n


def _gedankenstriche(zeile, cfg, zaehle):
    konj = set(cfg.get("konjunktionen_nach_strich", []))
    ab = cfg.get("punkt_ab_woertern", 4)
    # Strich am Zeilenende fällt weg.
    m = re.search(r"(?:[ \t]*—|[ \t]+–)[ \t]*$", zeile)
    if m:
        zaehle("—" if "—" in m.group(0) else "–")
        zeile = zeile[:m.start()]
    striche = [m for m in STRICH_RE.finditer(zeile)
               if "—" in m.group(0) or not _ist_spanne(zeile[:m.start()], zeile[m.end():], cfg)]
    if not striche:
        return zeile
    enden = [m.end() for m in re.finditer(r"[.!?…]+(?=\s|$)", zeile)]

    def satz(pos):
        anfang = max([e for e in enden if e <= pos] or [0])
        ende = min([e for e in enden if e > pos] or [len(zeile)])
        return anfang, ende

    gruppen = {}
    for m in striche:
        gruppen.setdefault(satz(m.start()), []).append(m)
    ersetzungen = []          # (start, ende, ersatz, nächstes Wort groß)
    for (anfang, ende), liste in gruppen.items():
        i = 0
        while i < len(liste):
            m = liste[i]
            if i + 1 < len(liste):
                zwischen = zeile[m.end():liste[i + 1].start()]
                if len(TOKEN_RE.findall(zwischen)) <= 12:
                    ersetzungen += [(m.start(), m.end(), ", ", False),
                                    (liste[i + 1].start(), liste[i + 1].end(), ", ", False)]
                    i += 2
                    continue
            links = zeile[anfang:m.start()]
            rechts_ende = liste[i + 1].start() if i + 1 < len(liste) else ende
            rechts = zeile[m.end():rechts_ende]
            rw = TOKEN_RE.findall(rechts)
            lw = TOKEN_RE.findall(links)
            if not rechts.strip(" \t.,;:!?…"):          # Strich direkt vor dem Satzende
                ersetzungen.append((m.start(), m.end(), "", False))
            elif not links.strip():                     # Strich am Satzanfang
                ersetzungen.append((m.start(), m.end(), " " if zeile[:m.start()].strip() else "", False))
            elif not rw or not lw:                      # nur Link, @Name oder Emoji auf einer Seite
                ersetzungen.append((m.start(), m.end(), ", ", False))
            elif rw[0].lower() in konj:
                ersetzungen.append((m.start(), m.end(), ", ", False))
            elif len(lw) >= ab and len(rw) >= ab:
                ersetzungen.append((m.start(), m.end(), ". ", True))
            else:
                ersetzungen.append((m.start(), m.end(), ", ", False))
            i += 1
    teile, pos = [], 0
    for start, ende, ersatz, gross in sorted(ersetzungen):
        zaehle("—" if "—" in zeile[start:ende] else "–")
        teile += [zeile[pos:start], ersatz]
        pos = ende
        if gross:
            mg = re.match(r"(\s*)([^\W\d_])", zeile[pos:])
            if mg:
                teile.append(mg.group(1) + mg.group(2).upper())
                pos += mg.end()
    teile.append(zeile[pos:])
    return "".join(teile)


def typografie_de(text, cfg):
    zaehler = {}

    def zaehle(name, n=1):
        zaehler[name] = zaehler.get(name, 0) + n

    def englisch(m):
        zaehle("“…” englische Anführungszeichen -> „…“")
        return "„" + m.group(1) + "“"

    text = re.sub(r"“([^„“”\n]{1,300}?)”", englisch, text)
    n = text.count("”")
    if n:
        zaehle("” englisches Schlusszeichen -> “", n)
        text = text.replace("”", "“")
    if cfg.get("gerade_anfuehrungszeichen_umwandeln", True):
        zeilen = text.split("\n")
        for i, z in enumerate(zeilen):
            if z.count('"') >= 2 and z.count('"') % 2 == 0:
                neu, n = re.subn(r'(?<![\w"])"(?=\S)([^"\n]{1,200}?)(?<=\S)"(?![\w"])', "„\\1“", z)
                if n:
                    zaehle('gerade "…" -> „…“', n)
                    zeilen[i] = neu
        text = "\n".join(zeilen)
    zeichen = "".join(re.escape(c) for c in cfg.get("aufzaehlungszeichen", []))
    if zeichen:
        text, n = re.subn(r"(?m)^([ \t]*)[" + zeichen + r"][ \t]+", r"\1- ", text)
        if n:
            zaehle("Aufzählungszeichen am Zeilenanfang -> -", n)
    text, n = re.subn(r"(\d)[ \t]*—[ \t]*(?=\d)", "\\1–", text)
    if n:
        zaehle("— zwischen Zahlen -> – (Spanne)", n)
    striche = {}

    def strich(z):
        striche[z] = striche.get(z, 0) + 1

    text = "\n".join(_gedankenstriche(z, cfg, strich) for z in text.split("\n"))
    if striche.get("—"):
        zaehle("— Geviertstrich als Satztrenner -> Komma oder Punkt", striche["—"])
    if striche.get("–"):
        zaehle("– freistehender Gedankenstrich -> Komma oder Punkt", striche["–"])
    text = re.sub(r",[ \t]*([,.;:!?])", r"\1", text)
    text = re.sub(r"[ \t]+,", ",", text)
    text = re.sub(r"(?<=\S)[ \t]{2,}(?=\S)", " ", text)
    return text, [{"name": k, "anzahl": v} for k, v in zaehler.items()]


def typografie_en(text, teil):
    """Englischer Fallback, Verhalten wie im Original."""
    treffer = []
    for e in teil.get("typographic", []):
        ch = e["from"]
        n = text.count(ch)
        if not n:
            continue
        treffer.append({"name": f"{ch} {e['name']} -> {e['to'].strip() or '(Leerzeichen)'}", "anzahl": n})
        if ch == "—":
            text = re.sub(r"\s*—\s*", ", ", text)
        elif ch == "–":
            text = re.sub(r"\s*–\s*(?=\d)", "-", text)
            text = re.sub(r"\s+–\s+", ", ", text)
            text = text.replace("–", "-")
        else:
            text = text.replace(ch, e["to"])
    text = re.sub(r",\s*([,.;:!?])", r"\1", text)
    text = re.sub(r",\s*\n", "\n", text)
    return text, treffer


# ------------------------------------------------------------------ 3. Floskeln

def _muster_bauen(e):
    if "muster" in e:
        kern = e["muster"]
    elif "formen" in e:
        kern = "|".join(re.escape(f).replace(r"\ ", r"\s+")
                        for f in sorted(e["formen"], key=len, reverse=True))
    else:
        kern = re.escape(e["find"]).replace(r"\ ", r"\s+")
    endung = ""
    if e.get("flexion") == "adj":
        endung = "(?P<endung>e|em|en|er|es)" + ("" if e.get("grundform", True) is False else "?")
    return re.compile(r"(?<![\w-])(?:" + kern + ")" + endung + r"(?![\w-])", re.IGNORECASE)


def _eintraege(lex, sprache):
    c = _cache(lex)
    if ("floskeln", sprache) not in c:
        teil = lex[sprache]
        liste = sorted(teil.get("words", []) + teil.get("phrases", []),
                       key=lambda e: len(e["find"]), reverse=True)
        c[("floskeln", sprache)] = [(e, _muster_bauen(e)) for e in liste]
    return c[("floskeln", sprache)]


def _ersatz(e, m):
    if "formen" in e:
        return e["formen"].get(re.sub(r"\s+", " ", m.group(0).lower()), e["replace"])
    if e.get("flexion") == "adj":
        endung = m.group("endung") or ""
        if not endung and isinstance(e.get("grundform"), str):
            return e["grundform"]
        return e["replace"] + endung
    if "muster" in e:
        return m.expand(e["replace"])
    return e["replace"]


def fall_angleichen(quelle, ersatz):
    """Großschreibung der Fundstelle übernehmen. Großgeschriebener Ersatz (Nomen,
    Namen) bleibt groß."""
    if not ersatz:
        return ersatz
    buchstaben = [c for c in quelle if c.isalpha()]
    if len(buchstaben) > 1 and all(c.isupper() for c in buchstaben):
        return ersatz.upper()
    if quelle[:1].isupper() and ersatz[:1].islower():
        return ersatz[:1].upper() + ersatz[1:]
    return ersatz


def floskeln_ersetzen(text, lex, sprache="de", sprechtext=False):
    """Floskeln ersetzen, längste zuerst. Gibt (text, treffer). Einträge mit "satzanfang": true
    greifen nur am Satzanfang. Im Sprechtext steht eine eingesetzte Adresse als vamela.de ohne @."""
    treffer = []
    for e, muster in _eintraege(lex, sprache):
        funde, ersatzliste = [], []

        def ersetzen(m, e=e, funde=funde, ersatzliste=ersatzliste):
            if e.get("satzanfang") and not am_satzanfang(m.string, m.start()):
                return m.group(0)
            funde.append(m.group(0))
            ersatz = _ersatz(e, m)
            if sprechtext:
                ersatz = ersatz.replace("@vamela.de", "vamela.de")
            if ersatz == "":
                ersatzliste.append("")
                if am_satzanfang(m.string, m.start()) and m.group(0)[:1].isupper():
                    return MARKE
                return ""
            ersatz = fall_angleichen(m.group(0), ersatz)
            ersatzliste.append(ersatz)
            return ersatz

        text = muster.sub(ersetzen, text)
        if funde:
            treffer.append({"find": e["find"], "ersatz": ersatzliste[0] or "(gelöscht)",
                            "anzahl": len(funde), "familie": e.get("family", ""), "beispiel": kurz(funde[0])})
    return text, treffer


def aufraeumen(text, sprache="de"):
    """Nach Löschungen bleiben Satzzeichen-Reste. Die lesen sich schlechter als die Floskel."""
    text = re.sub(r"(?<=\S)[ \t]{2,}", " ", text)
    text = re.sub(r"(?m)^([ \t]*)(?:(?:[,;:]|\.(?!\.))+[ \t]*)+(?=\S)", r"\1", text)
    text = re.sub(r"(?m)^ (?=\S)", "", text)       # ein Leerzeichen bleibt nach einer Löschung, tiefere Einzüge sind gewollt
    text = re.sub(r"[ \t]+([,.;:!?])", r"\1", text)
    text = re.sub(r",[ \t]*([,.;:!?])", r"\1", text)
    text = re.sub(r"([.!?])[ \t]*[,;:]+", r"\1", text)
    text = text.replace("...", "\uE020")
    text = re.sub(r"\.[ \t]*\.+", ".", text)
    text = re.sub(r"([!?])[ \t]*\.", r"\1", text)
    text = text.replace("\uE020", "...")
    text = re.sub(r"(?m)^[ \t]+$", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    if sprache == "en":
        text = re.sub(r",\s*(also|so|still|basically|in the end)\s*,\s*",
                      lambda m: ". " + m.group(1)[0].upper() + m.group(1)[1:] + ", ", text)
    return text


def satzanfaenge_gross(original):
    """Wer Satzanfänge kleinschreibt, schreibt bewusst so. Dann nichts großmachen."""
    anfaenge = re.findall(r"(?:^|[.!?]\s+|\n)\s*([^\W\d_])", original)
    return bool(anfaenge) and sum(1 for c in anfaenge if c.isupper()) * 2 >= len(anfaenge)


def marken_aufloesen(text, gross):
    """Nach einer Löschung am Satzanfang: verwaiste Satzzeichen weg, nächstes Wort groß.
    Vor dem Wort bleibt eine SPUR, damit der Bericht den neuen Satzanfang zeigen kann."""
    text = re.sub(MARKE + r"[ \t]*(?:[,;:.!?][ \t]*)*([^\W\d_])",
                  lambda m: SPUR + (m.group(1).upper() if gross else m.group(1)), text)
    text = re.sub(MARKE + r"[ \t]*(?:[,;:.!?][ \t]*)*", "", text)
    return re.sub(r"(?m)[ \t]+$", "", text)


def spuren_lesen(text):
    """Gibt (text ohne SPUR, [{satz, satz1}]): jeder Satz, dessen Anfang gelöscht wurde.
    satz1 heißt: Das ist jetzt Satz 1, also der Hook."""
    geloescht = []
    for m in re.finditer(SPUR, text):
        zeile = text[m.end():].replace(SPUR, "").split("\n", 1)[0]
        satz = zeile
        for e in ENDE_RE.finditer(zeile):
            if not ABK_ENDE_RE.search(zeile[:e.start() + 1]):
                satz = zeile[:e.start() + 1]
                break
        geloescht.append({"satz": kurz(satz, 90), "satz1": not text[:m.start()].replace(SPUR, "").strip()})
    return text.replace(SPUR, ""), geloescht


# ------------------------------------------------------------------ Melden

def _regelliste(lex, schluessel, liste):
    c = _cache(lex)
    if schluessel not in c:
        c[schluessel] = [(s, re.compile(s["regex"], re.MULTILINE)) for s in liste]
    return c[schluessel]


def konkret_re(lex):
    c = _cache(lex)
    if "konkret_re" not in c:
        k = lex.get("de", {}).get("konkret", {})
        begriffe = [b for f in ("werkzeuge", "dinge", "orte", "referenzen", "zeit") for b in k.get(f, [])]
        begriffe = sorted(set(begriffe), key=len, reverse=True)
        if begriffe:
            kern = "|".join(re.escape(b).replace(r"\ ", r"\s+") for b in begriffe)
            c["konkret_re"] = re.compile(r"(?<![\w-])(?:" + kern + r")(?:e?s|e?n|e|er)?(?![\w-])", re.IGNORECASE)
        else:
            c["konkret_re"] = None
    return c["konkret_re"]


def strukturen_pruefen(text, lex, sprache="de", satzlaenge=True):
    liste = lex.get("gemeinsam", {}).get("structures", []) + lex[sprache].get("structures", [])
    k_re = konkret_re(lex)
    funde = []
    for s, muster in _regelliste(lex, ("strukturen", sprache), liste):
        treffer = list(muster.finditer(text))
        if s.get("ausnahme_konkret") and k_re:
            treffer = [m for m in treffer
                       if not all(k_re.fullmatch(g) for g in m.groups() if g)]
        if not treffer or len(treffer) < s.get("mindestens", 1):
            continue
        if "max" in s and len(treffer) <= s["max"]:
            continue
        funde.append({"id": s["id"], "name": s["name"], "anzahl": len(treffer), "fix": s["fix"],
                      "beispiel": _beispiel(text, treffer[0])})
    if satzlaenge:
        laengen = [len(TOKEN_RE.findall(s)) for s in saetze(text, sprache)]
        if len(laengen) >= 4:
            mittel = sum(laengen) / len(laengen)
            streu = (sum((n - mittel) ** 2 for n in laengen) / len(laengen)) ** 0.5 / mittel
            if streu < 0.35:
                funde.append({
                    "id": "gleichfoermig", "anzahl": len(laengen), "beispiel": "",
                    "name": f"Gleichförmige Satzlänge (Streuung {streu:.2f})".replace(".", ","),
                    "fix": "Brich einen Satz in zwei. Lass einen anderen lang laufen. Maschinen schreiben gleichmäßig."})
    return funde


def marke_pruefen(text, lex, sprechtext=False):
    """VAMELA-Regeln: melden, nichts ändern, nicht werten. Einträge mit "nur": "sprechtext"
    zählen nur mit sprechtext=True."""
    funde = []
    for s, muster in _regelliste(lex, "marke", lex.get("marke", [])):
        if s.get("nur") == "sprechtext" and not sprechtext:
            continue
        treffer = list(muster.finditer(text))
        if not treffer or ("max" in s and len(treffer) <= s["max"]):
            continue
        funde.append({"id": s["id"], "name": s["name"], "anzahl": len(treffer), "fix": s["fix"],
                      "beispiel": _beispiel(text, treffer[0])})
    return funde


def marke_vereinigen(original, text, lex, sprechtext=False):
    """VAMELA-Hinweise aus Entwurf und Ergebnis. Ein Ersatz darf keinen Regelverstoß verstecken:
    Was nur im Entwurf stand, bekommt "verdeckt": True, weniger Treffer als im Entwurf "anzahl_entwurf"."""
    vorher = {h["id"]: h for h in marke_pruefen(original, lex, sprechtext)}
    funde = marke_pruefen(text, lex, sprechtext)
    da = {h["id"] for h in funde}
    for h in funde:
        v = vorher.get(h["id"])
        if v and v["anzahl"] > h["anzahl"]:
            h["anzahl_entwurf"] = v["anzahl"]
    for i, h in vorher.items():
        if i not in da:
            h["verdeckt"] = True
            funde.append(h)
    reihe = {s["id"]: n for n, s in enumerate(lex.get("marke", []))}
    return sorted(funde, key=lambda h: reihe.get(h["id"], len(reihe)))


def umfang_pruefen(original, text, geloescht, sprechtext=False):
    """Wortzahl und Satz 1 vorher und nachher. Mit sprechtext die festen Grenzen fürs Reel."""
    s1_vorher, s1 = erster_satz(original), erster_satz(text)
    u = {"woerter_vorher": wortzahl(original), "woerter_nachher": wortzahl(text),
         "satz1_vorher": wortzahl(s1_vorher), "satz1_nachher": wortzahl(s1), "satz1": kurz(s1, 90),
         "satz1_geaendert": kurz(s1_vorher, 10 ** 6) != kurz(s1, 10 ** 6),
         "satzanfang_geloescht": geloescht, "meldungen": []}
    if sprechtext:
        n = u["woerter_nachher"]
        if not SPRECH["min"] <= n <= SPRECH["max"]:
            u["meldungen"].append(f"Sprechtext hat {n} Wörter, erlaubt {SPRECH['min']} bis {SPRECH['max']}.")
        if u["satz1_nachher"] > SPRECH["hook"]:
            u["meldungen"].append(f"Satz 1 (Hook) hat {u['satz1_nachher']} Wörter, höchstens {SPRECH['hook']}.")
    return u


# ------------------------------------------------------------------ Ablauf

def humanize(text, lex, sprache=None, sprechtext=False):
    sprache = sprache or lex.get("standardsprache", "de")
    if sprache == "auto":
        sprache = sprache_bestimmen(text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    original = text
    text, unsichtbar = unsichtbar_entfernen(text, lex)
    text, links = schuetzen(text)
    if sprache == "de":
        text, typo = typografie_de(text, lex["de"].get("typografie", {}))
    else:
        text, typo = typografie_en(text, lex[sprache])
    text, floskeln = floskeln_ersetzen(text, lex, sprache, sprechtext)
    text = aufraeumen(text, sprache)
    text = marken_aufloesen(text, satzanfaenge_gross(original))
    text, geloescht = spuren_lesen(wiederherstellen(text, links))
    text = text.strip() + "\n"
    return text, {
        "sprache": sprache,
        "sprechtext": sprechtext,
        "unsichtbar": unsichtbar,
        "typografie": typo,
        "floskeln": floskeln,
        "satzmuster": strukturen_pruefen(text, lex, sprache),
        "vamela": marke_vereinigen(original, text, lex, sprechtext),
        "umfang": umfang_pruefen(original, text, geloescht, sprechtext),
    }


def bericht_ausgeben(b, out=sys.stderr):
    def kopf(titel):
        print(f"\n{titel}\n" + "-" * len(titel), file=out)

    entfernt = sum(h["anzahl"] for k in ("unsichtbar", "typografie", "floskeln") for h in b[k])
    u = b["umfang"]
    zaehlen = (u["woerter_vorher"] != u["woerter_nachher"] or u["satz1_geaendert"]
               or u["satzanfang_geloescht"] or b.get("sprechtext"))
    kopf(f"HUMANIZE-BERICHT (Sprache: {b['sprache']}{', Sprechtext' if b.get('sprechtext') else ''})")
    print(f"{entfernt} Maschinen-Spuren entfernt, {len(b['satzmuster'])} Satzmuster zum Umschreiben, "
          f"{len(b['vamela'])} VAMELA-Hinweise zum Prüfen", file=out)
    print(f"Umfang: {u['woerter_vorher']} -> {u['woerter_nachher']} Wörter, "
          f"Satz 1: {u['satz1_vorher']} -> {u['satz1_nachher']} Wörter", file=out)
    if b["unsichtbar"]:
        kopf("1. UNSICHTBARE ZEICHEN")
        for h in b["unsichtbar"]:
            print(f"  {h['anzahl']:>3}x  {h['name']}  -> {h['aktion']}", file=out)
    if b["typografie"]:
        kopf("2. TYPOGRAFIE")
        for h in b["typografie"]:
            print(f"  {h['anzahl']:>3}x  {h['name']}", file=out)
    if b["floskeln"]:
        kopf("3. FLOSKELN")
        for h in b["floskeln"]:
            print(f"  {h['anzahl']:>3}x  {h['beispiel']}  -> {h['ersatz']}   [{h['familie']}]", file=out)
    if b["satzmuster"]:
        kopf("4. SATZMUSTER (nicht automatisch geändert, selbst umschreiben)")
        for h in b["satzmuster"]:
            bsp = f"   z. B. „{h['beispiel']}“" if h["beispiel"] else ""
            print(f"  {h['anzahl']:>3}x  {h['name']}{bsp}\n        {h['fix']}", file=out)
    if b["vamela"]:
        kopf("5. VAMELA-HINWEISE (nicht geändert, prüfen)")
        for h in b["vamela"]:
            wo = ""
            if h.get("verdeckt"):
                wo = "   [nur im Entwurf: durch Ersatz entfernt oder verdeckt, Stelle prüfen]"
            elif h.get("anzahl_entwurf"):
                wo = f"   [im Entwurf {h['anzahl_entwurf']}x: Rest durch Ersatz entfernt oder verdeckt, prüfen]"
            print(f"  {h['anzahl']:>3}x  {h['name']}   z. B. „{h['beispiel']}“{wo}\n        {h['fix']}", file=out)
    if zaehlen:
        kopf("6. NEU ZÄHLEN (der Ersatz ändert Länge und Satzanfänge)")
        print(f"  Satz 1 jetzt ({u['satz1_nachher']} Wörter): „{u['satz1']}“", file=out)
        for g in u["satzanfang_geloescht"]:
            hook = "  (jetzt Satz 1, der Hook)" if g["satz1"] else ""
            print(f"  Satzanfang gelöscht: „{g['satz']}“{hook}\n"
                  f"        Noch ein ganzer Satz? Sonst neu schreiben.", file=out)
        for meldung in u["meldungen"]:
            print(f"  {meldung} Kürzen oder ergänzen, nichts erfinden.", file=out)
        if b.get("sprechtext") and not u["meldungen"]:
            print(f"  Zahlen passen: {u['woerter_nachher']} Wörter ({SPRECH['min']} bis {SPRECH['max']}), "
                  f"Hook {u['satz1_nachher']} Wörter (höchstens {SPRECH['hook']}). Ob Satz 1 ein ganzer Satz ist, "
                  f"prüfst du selbst.", file=out)
        elif not b.get("sprechtext"):
            print(f"  Sprechtext: {SPRECH['min']} bis {SPRECH['max']} Wörter, Satz 1 höchstens {SPRECH['hook']} "
                  f"(--sprechtext zählt mit). Karussell: Seite 1 höchstens 10, Seiten 2 bis 5 etwa 20.", file=out)
    if not entfernt and not b["satzmuster"] and not b["vamela"] and not u["meldungen"]:
        kopf("SAUBER")
        print("  Nichts zu entfernen, nichts zu melden.", file=out)
    print("", file=out)


# ------------------------------------------------------------------ Selbsttest

# (Eingabe, erwartete Ausgabe oder None, Erwartungen an den Bericht, Sprechtext)
# Erwartungen: vamela / satzmuster = diese ids müssen gemeldet sein, verdeckt = diese ids nur im Entwurf,
# satz1_geloescht = der Anfang von Satz 1 wurde gelöscht, beispiel = (id, Text im Beispiel), meldungen = Anzahl.
SELBSTTEST = [
    ("Das ist unglaublich.", "Das ist unglaublich.", {}, False),
    ("Das Ergebnis ist unglaublich.", "Das Ergebnis ist unglaublich.", {}, False),
    ("Der Aufwand ist immens.", "Der Aufwand ist groß.", {}, False),
    ("Der Unterschied ist enorm, wirklich.", "Der Unterschied ist groß, wirklich.", {}, False),
    ("Der Aufwand ist enorm und lohnt sich.", "Der Aufwand ist enorm und lohnt sich.", {}, False),
    ("Das spart enorm Zeit.", "Das spart enorm Zeit.", {}, False),
    ("Das hilft enorm bei der Suche.", "Das hilft enorm bei der Suche.", {}, False),
    ("Das ist enorm wichtig und unglaublich schnell.", "Das ist sehr wichtig und sehr schnell.", {}, False),
    ("Ein unglaublicher Aufwand, enorme Kosten.", "Ein starker Aufwand, große Kosten.", {}, False),
    ("Der Tisch ist aus massiver Eiche, die Schreinerei Muster baut massive Möbel.",
     "Der Tisch ist aus massiver Eiche, die Schreinerei Muster baut massive Möbel.", {}, False),
    ("Das hat eine massive Wirkung, die Anfragen sind massiv gestiegen.",
     "Das hat eine starke Wirkung, die Anfragen sind stark gestiegen.", {}, False),
    ("So wirst du vom Algorithmus gepusht.", "So wirst du vom Algorithmus gepusht.", {"vamela": ["algorithmus"]}, False),
    ("Der Algorithmus liebt Reels.", "Der Algorithmus liebt Reels.", {"vamela": ["algorithmus"]}, False),
    ("Lass uns reden, wenn du Fragen hast.", "Lass uns reden, wenn du Fragen hast.",
     {"vamela": ["wir-form"], "satzmuster": ["lass-uns"]}, False),
    ("Tauchen ist ein schönes Hobby.", "Tauchen ist ein schönes Hobby.", {}, False),
    ("Er taucht in den See ein.", "Er taucht in den See ein.", {}, False),
    ("Tauche ein in die Welt der Schriften.", "Steige ein in die Welt der Schriften.", {"satzmuster": ["welt-der"]}, False),
    ("Folge mir für mehr Tipps.", "Folge @vamela.de für {{Nutzen der Säule}}.", {"vamela": ["platzhalter"]}, False),
    ("Folge mir für mehr Tipps.", "Folge vamela.de für {{Nutzen der Säule}}.", {"vamela": ["platzhalter"]}, True),
    ("Seien wir ehrlich: Dein Google-Profil ist leer.", "Dein Google-Profil ist leer.",
     {"verdeckt": ["wir-form"], "satz1_geloescht": True}, False),
    ("In diesem Video zeige ich dir, wie du vom Algorithmus gepusht wirst.", "Wie du vom Algorithmus gepusht wirst.",
     {"vamela": ["algorithmus"], "satz1_geloescht": True}, False),
    ("Mehr dazu auf vamela.de/werkzeuge, speicher dir das.", "Mehr dazu auf vamela.de/werkzeuge, speicher dir das.",
     {"vamela": ["sprechtext-adresse"], "meldungen": 1}, True),
    ("Offen 9–17 Uhr, Mo–Fr. Das ist gut — wirklich gut.", "Offen 9–17 Uhr, Mo–Fr. Das ist gut, wirklich gut.", {}, False),
    ("Heute ist eine Website mehr als nur eine Visitenkarte. Sie bringt garantiert neue Kunden. Das Ergebnis? Mehr Anfragen.",
     None, {"beispiel": [("versprechen", "garantiert"), ("inszenierte-frage", "Das Ergebnis?")]}, False),
]


def selbsttest(lex, out=sys.stdout):
    """Feste Fälle durchlaufen. Gibt die Zahl der Fehler zurück."""
    fehler = 0
    for eingabe, erwartet, soll, sprech in SELBSTTEST:
        text, b = humanize(eingabe, lex, "de", sprechtext=sprech)
        text = text.strip()
        vamela = {h["id"]: h for h in b["vamela"]}
        muster = {h["id"]: h for h in b["satzmuster"]}
        probleme = []
        if erwartet is not None and text != erwartet:
            probleme.append(f"Ausgabe „{text}“, erwartet „{erwartet}“")
        probleme += [f"VAMELA-Hinweis {i} fehlt" for i in soll.get("vamela", []) if i not in vamela]
        probleme += [f"Satzmuster {i} fehlt" for i in soll.get("satzmuster", []) if i not in muster]
        probleme += [f"{i} nicht als verdeckt gemeldet" for i in soll.get("verdeckt", [])
                     if not vamela.get(i, {}).get("verdeckt")]
        if "satz1_geloescht" in soll and soll["satz1_geloescht"] != any(
                g["satz1"] for g in b["umfang"]["satzanfang_geloescht"]):
            probleme.append("gelöschter Anfang von Satz 1 nicht erkannt" if soll["satz1_geloescht"]
                            else "Satz 1 fälschlich als gekürzt gemeldet")
        for i, stueck in soll.get("beispiel", []):
            bsp = {**vamela, **muster}.get(i, {}).get("beispiel", "")
            if stueck not in bsp:
                probleme.append(f"Beispiel für {i} zeigt „{bsp}“, ohne „{stueck}“")
        if "meldungen" in soll and len(b["umfang"]["meldungen"]) != soll["meldungen"]:
            probleme.append(f"{len(b['umfang']['meldungen'])} Formatmeldungen, erwartet {soll['meldungen']}")
        fehler += bool(probleme)
        zeichen = "ok    " if not probleme else "FEHLER"
        print(f"{zeichen} {kurz(eingabe, 58)}{'  [Sprechtext]' if sprech else ''}", file=out)
        for p in probleme:
            print(f"         {p}", file=out)
    print(f"\n{len(SELBSTTEST) - fehler} von {len(SELBSTTEST)} Fällen bestanden.", file=out)
    return fehler


def _utf8():
    for strom in (sys.stdin, sys.stdout, sys.stderr):
        try:
            strom.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass


def main():
    _utf8()
    ap = argparse.ArgumentParser(description="Nimmt den Maschinen-Fingerabdruck aus einem Entwurf (Standard: Deutsch).")
    ap.add_argument("eingabe", nargs="?", default="-", help="Datei, oder - für stdin")
    ap.add_argument("-o", "--ausgabe", "--out", dest="ausgabe", help="bereinigten Text hierhin schreiben statt auf stdout")
    ap.add_argument("--bericht", "--report", dest="bericht", action="store_true", help="Änderungen auf stderr zeigen")
    ap.add_argument("--json", action="store_true", help="{text, bericht} als JSON ausgeben")
    ap.add_argument("--sprache", choices=["de", "en", "auto"], help="Standard: de (aus slop.json)")
    ap.add_argument("--lexikon", "--lexicon", dest="lexikon", default=LEXIKON, help="Pfad zu slop.json")
    ap.add_argument("--fakten", help="optional: data/fakten.json, Werkzeugnamen zählen dann als konkret")
    ap.add_argument("--sprechtext", action="store_true",
                    help="Sprechtext fürs Reel: eingesetzte Adresse als vamela.de ohne @, Adressen melden, "
                         f"{SPRECH['min']} bis {SPRECH['max']} Wörter und Hook bis {SPRECH['hook']} Wörter prüfen")
    ap.add_argument("--selbsttest", action="store_true", help="feste Testfälle gegen slop.json laufen lassen (Exit 1 bei Fehler)")
    args = ap.parse_args()

    if args.selbsttest:
        lex = lexikon_laden(args.lexikon)
        sys.exit(1 if selbsttest(lex) else 0)
    if args.eingabe == "-":
        roh = sys.stdin.read()
    else:
        with open(args.eingabe, encoding="utf-8") as fh:
            roh = fh.read()
    lex = lexikon_laden(args.lexikon)
    if args.fakten:
        fakten_einlesen(lex, args.fakten)
    sauber, bericht = humanize(roh, lex, args.sprache, sprechtext=args.sprechtext)

    if args.json:
        print(json.dumps({"text": sauber, "bericht": bericht}, indent=2, ensure_ascii=False))
        return
    if args.ausgabe:
        with open(args.ausgabe, "w", encoding="utf-8") as fh:
            fh.write(sauber)
        print(f"geschrieben: {args.ausgabe}", file=sys.stderr)
    else:
        sys.stdout.write(sauber)
    if args.bericht:
        bericht_ausgeben(bericht)


if __name__ == "__main__":
    main()
