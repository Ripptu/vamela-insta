#!/usr/bin/env python3
"""
detect.py - fünf lokale Prüfungen, wie maschinell ein Entwurf wirkt. Standard: Deutsch.

Was das ist:  fünf Faustregeln nach den Signalen, auf die öffentliche KI-Detektoren
achten: Satzrhythmus (Burstiness), Konkretheit, Floskeln, typografischer
Fingerabdruck und Stimme. Alles wird lokal aus dem Text berechnet, nichts wird
hochgeladen.

Was das NICHT ist:  GPTZero, Originality, Copyleaks, Winston oder Turnitin. Es ruft
deren Schnittstellen nicht auf und kann ihr Urteil nicht versprechen. Die
Schwellen stammen aus dem englischen Original und sind nicht an deutschen Texten
geeicht.

Jede Prüfung gibt einen MENSCH-WERT von 0 bis 100. Höher ist besser.
Deutsch: Satzgrenzen beachten z. B., bzw., 5.000 und 12.10.2026; Eigennamen werden
NICHT über Großschreibung erkannt (im Deutschen sind alle Substantive groß),
sondern über Zahlen, vamela.de-Adressen, Links und die Begriffsliste in slop.json.

Kurze Texte: Unter 4 Sätzen wertet SATZRHYTHMUS nicht, unter 25 Wörtern
KONKRETHEIT und STIMME nicht. Diese Prüfungen stehen dann auf „zählt nicht“ und
gehen weder in den Mittelwert noch ins Minimum ein. Ein Kommentar, eine DM oder
eine Story wird so nur über FLOSKELN und FINGERABDRUCK beurteilt und kann
BESTANDEN erreichen. Ohne ein einziges Wort heißt das Urteil LEER.

Exit-Code: 0 BESTANDEN, 1 PRÜFEN oder AUFFÄLLIG, 2 LEER (nichts zu prüfen).

Aufruf (Python 3.9, nur Standardbibliothek, kein Netz)
  python3 -I detect.py entwurf.txt
  pbpaste | python3 -I detect.py -
  python3 -I detect.py entwurf.txt --json
  python3 -I detect.py vorher.txt nachher.txt        # zwei Fassungen vergleichen
  python3 -I detect.py entwurf.txt --fakten /Users/test/vamela-insta/data/fakten.json
"""

import argparse
import importlib.util
import json
import os
import re
import statistics
import sys
import unicodedata

sys.dont_write_bytecode = True          # kein __pycache__ im Skill-Ordner
HIER = os.path.dirname(os.path.abspath(__file__))
LEXIKON = os.path.join(HIER, "slop.json")


def _humanize_laden():
    """humanize.py über den festen Pfad laden (python3 -I legt den Skriptordner nicht in sys.path)."""
    spec = importlib.util.spec_from_file_location("ig_human_humanize", os.path.join(HIER, "humanize.py"))
    modul = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modul)
    return modul


hz = _humanize_laden()

ZAHL_RE = re.compile(r"(?<![\w.,])\d+(?:[.,:]\d+)*")
MUSTERNAME_RE = re.compile(r"(?<![\w-])[^\W\d_]{3,}\s+Muster(?![\w-])")

# Englischer Fallback, wie im Original
EN_WORT_RE = re.compile(r"[A-Za-z']+")
EN_KURZFORM = re.compile(r"\b\w+'(?:s|t|re|ve|ll|d|m)\b", re.IGNORECASE)
EN_PRONOMEN = re.compile(r"\b(i|me|my|mine|we|us|our|you|your)\b", re.IGNORECASE)
EN_ZAHL = re.compile(r"\b\d[\d,.]*%?\b|\$\d")
EN_NAME = re.compile(r"(?<![.!?]\s)(?<!^)\b[A-Z][a-z]{2,}\b", re.MULTILINE)

PRUEFUNGEN = ["SATZRHYTHMUS", "KONKRETHEIT", "FLOSKELN", "FINGERABDRUCK", "STIMME"]
ZAEHLT_NICHT = None             # Wert einer Prüfung, die bei diesem Text nichts aussagt (zu kurz)


def begrenzen(n):
    return max(0.0, min(100.0, n))


def skala(wert, mensch, maschine):
    """wert auf 0-100 abbilden: `mensch` -> 100, `maschine` -> 0."""
    if mensch == maschine:
        return 50.0
    return begrenzen((wert - maschine) / (mensch - maschine) * 100)


def komma(x, stellen=2):
    return f"{x:.{stellen}f}".replace(".", ",")


def _woerter(text, sprache):
    return hz.woerter(text) if sprache == "de" else EN_WORT_RE.findall(text)


def pruefe_satzrhythmus(text, lex, sprache):
    """Menschen wechseln die Satzlänge stark. Modelle schreiben gleichmäßig."""
    laengen = [len(hz.TOKEN_RE.findall(s)) for s in hz.saetze(text, sprache)]
    if len(laengen) < 4:
        return ZAEHLT_NICHT, "zählt nicht: zu kurz zum Beurteilen (unter 4 Sätzen)"
    mittel = statistics.mean(laengen)
    streu = statistics.pstdev(laengen) / mittel if mittel else 0
    return skala(streu, mensch=0.70, maschine=0.22), \
        f"Streuung {komma(streu)} über {len(laengen)} Sätze (Ziel 0,55+)"


def pruefe_konkretheit(text, lex, sprache):
    """Zahlen, Adressen, Werkzeuge, Orte. Floskeltext bleibt abstrakt."""
    w = _woerter(text, sprache)
    if len(w) < 25:
        return ZAEHLT_NICHT, "zählt nicht: zu kurz zum Beurteilen (unter 25 Wörtern)"
    if sprache != "de":
        treffer = len(EN_ZAHL.findall(text)) + len(set(EN_NAME.findall(text)))
        dichte = treffer * 100 / len(w)
        return skala(dichte, 6.0, 0.5), \
            f"{treffer} konkrete Angaben, {komma(dichte, 1)} je 100 Wörter (Ziel 4+)"
    sauber = hz.SCHUTZ_RE.sub(" ", text)
    zahlwoerter = {z.lower() for z in lex["de"].get("konkret", {}).get("zahlwoerter", [])}
    zahlen = len(ZAHL_RE.findall(sauber)) + sum(1 for t in hz.woerter(sauber) if t.lower() in zahlwoerter)
    k_re = hz.konkret_re(lex)
    begriffe = {re.sub(r"\s+", " ", m.group(0).lower()) for m in k_re.finditer(sauber)} if k_re else set()
    begriffe |= {m.lower() for m in MUSTERNAME_RE.findall(sauber)}
    adressen = {m.group(0).lower().rstrip(".,;:!?)") for m in hz.SCHUTZ_RE.finditer(text)
                if not m.group(0).startswith("#")}
    treffer = zahlen + len(begriffe) + len(adressen)
    dichte = treffer * 100 / len(w)
    return skala(dichte, mensch=6.0, maschine=0.5), \
        (f"{treffer} konkrete Angaben ({zahlen} Zahlen, {len(begriffe)} Begriffe, {len(adressen)} Adressen), "
         f"{komma(dichte, 1)} je 100 Wörter (Ziel 4+)")


def pruefe_floskeln(text, lex, sprache):
    """Dichte der Floskeln aus slop.json, gezählt wie humanize.py sie ersetzt."""
    w = _woerter(text, sprache)
    if not w:
        return ZAEHLT_NICHT, "zählt nicht: keine Wörter"
    _, bericht = hz.humanize(text, lex, sprache)
    n = sum(h["anzahl"] for h in bericht["floskeln"])
    gefunden = sorted({h["find"] for h in bericht["floskeln"]})
    dichte = n * 100 / len(w)
    detail = f"{n} Floskeln, {komma(dichte, 1)} je 100 Wörter"
    if gefunden:
        detail += " (" + ", ".join(gefunden[:4]) + (", …" if len(gefunden) > 4 else "") + ")"
    return skala(dichte, mensch=0.0, maschine=4.0), detail


def pruefe_fingerabdruck(text, lex, sprache):
    """Zeichen, die eine Handytastatur nicht erzeugt."""
    if sprache != "de":
        unsichtbar = sum(1 for c in text if unicodedata.category(c) == "Cf")
        geviert = text.count("—")
        typo = sum(text.count(c) for c in "‘’“”")
        ellipse = text.count("…")
        hart = sum(text.count(c) for c in "\u00A0\u202F\u2009")
        summe = unsichtbar * 4 + geviert * 2 + typo + ellipse + hart
        je1k = summe * 1000 / max(len(text), 1)
        return skala(je1k, 0.0, 12.0), \
            f"{unsichtbar} unsichtbar, {geviert} Geviertstrich, {typo} typografische Anführung, {ellipse} Auslassung, {hart} feste Leerzeichen"
    _, funde = hz.unsichtbar_entfernen(text, lex)
    unsichtbar = sum(h["anzahl"] for h in funde if h["aktion"] in ("löschen", "delete"))
    hart = sum(h["anzahl"] for h in funde if h["aktion"] not in ("löschen", "delete"))
    geviert = text.count("—")
    gedanken = hz.freie_gedankenstriche(text, lex["de"].get("typografie", {}))
    englisch = text.count("”")
    summe = unsichtbar * 4 + geviert * 2 + gedanken + englisch + hart
    je1k = summe * 1000 / max(len(text), 1)
    return skala(je1k, mensch=0.0, maschine=12.0), \
        (f"{unsichtbar} unsichtbar, {geviert} Geviertstrich, {gedanken} Gedankenstrich, "
         f"{englisch} englische Anführung, {hart} feste Leerzeichen oder Bindestriche („…“ zählt nicht)")


def pruefe_stimme(text, lex, sprache):
    """Alltagssprache, direkte Ansprache und die Satzmuster, zu denen Modelle greifen."""
    w = _woerter(text, sprache)
    if len(w) < 25:
        return ZAEHLT_NICHT, "zählt nicht: zu kurz zum Beurteilen (unter 25 Wörtern)"
    je100 = 100 / len(w)
    if sprache == "de":
        st = lex["de"]["stimme"]
        sauber = hz.SCHUTZ_RE.sub(" ", text)
        alltag = sum(len(re.findall(r, sauber, re.IGNORECASE)) for r in st["alltag"]) * je100
        pronomen = {p.lower() for p in st["pronomen"]}
        n_person = sum(1 for t in hz.woerter(sauber) if t.lower() in pronomen)
        sie = "|".join(re.escape(s) for s in st.get("anrede_sie", []))
        if sie:
            n_person += sum(1 for m in re.finditer(r"\b(?:" + sie + r")\b", sauber)
                            if not hz.am_satzanfang(sauber, m.start()))
        imperative = {i.lower() for i in st.get("imperative", [])}
        fuell = "|".join(re.escape(f) for f in st.get("satzanfang_fuellwoerter", []))
        anfang = r"(?:^|[.!?:]\s+|\n\s*)(?:(?:" + fuell + r")\s+)?([^\W\d_]+)" if fuell else \
            r"(?:^|[.!?:]\s+|\n\s*)([^\W\d_]+)"
        n_person += sum(1 for m in re.finditer(anfang, sauber, re.IGNORECASE) if m.group(1).lower() in imperative)
        person = n_person * je100
        mensch_alltag, label_alltag, label_person = 3.0, "Alltagswörter", "direkte Ansprache"
    else:
        alltag = len(EN_KURZFORM.findall(text)) * je100
        person = len(EN_PRONOMEN.findall(text)) * je100
        mensch_alltag, label_alltag, label_person = 3.0, "Kurzformen", "Personalpronomen"
    muster, namen = 0, []
    for f in hz.strukturen_pruefen(text, lex, sprache, satzlaenge=False):
        muster += min(f["anzahl"], 3)
        namen.append(f["id"])
    aufz = [len(b.split()) for b in re.findall(r"(?m)^\s*[-*•]\s+(.+)$", text)]
    gleich = len(aufz) >= 3 and statistics.pstdev(aufz) < 1.6
    wert = (skala(alltag, mensch=mensch_alltag, maschine=0.0) * 0.35
            + skala(person, mensch=8.0, maschine=1.0) * 0.35
            + begrenzen(100 - muster * 22) * 0.30)
    if gleich:
        wert -= 12
        namen.append("gleiche-aufzaehlung")
    detail = (f"{komma(alltag, 1)} {label_alltag}, {komma(person, 1)} {label_person} je 100 Wörter, "
              f"{muster} Satzmuster")
    if namen:
        detail += " [" + ", ".join(namen[:4]) + (", …" if len(namen) > 4 else "") + "]"
    return begrenzen(wert), detail


def pruefen(text, lex, sprache):
    if sprache == "auto":
        sprache = hz.sprache_bestimmen(text)
    ergebnisse = {
        "SATZRHYTHMUS": pruefe_satzrhythmus(text, lex, sprache),
        "KONKRETHEIT": pruefe_konkretheit(text, lex, sprache),
        "FLOSKELN": pruefe_floskeln(text, lex, sprache),
        "FINGERABDRUCK": pruefe_fingerabdruck(text, lex, sprache),
        "STIMME": pruefe_stimme(text, lex, sprache),
    }
    hinweise = hz.marke_pruefen(text, lex)
    gewertet = [ergebnisse[p][0] for p in gewertete(ergebnisse)]
    if not _woerter(text, sprache) or not gewertet:
        return ergebnisse, None, "LEER", sprache, hinweise
    # Nur Prüfungen, die bei diesem Text etwas aussagen. Die schwächste zieht mit:
    # einem Detektor reicht ein Signal.
    gesamt = statistics.mean(gewertet) * 0.6 + min(gewertet) * 0.4
    urteil = "BESTANDEN" if gesamt >= 70 and min(gewertet) >= 55 else ("PRÜFEN" if gesamt >= 50 else "AUFFÄLLIG")
    return ergebnisse, gesamt, urteil, sprache, hinweise


def gewertete(ergebnisse):
    """Namen der Prüfungen, die bei diesem Text werten (nicht „zu kurz“)."""
    return [p for p in PRUEFUNGEN if ergebnisse[p][0] is not ZAEHLT_NICHT]


def balken(wert, breite=24):
    if wert is None:
        return "-" * breite
    voll = round(wert / 100 * breite)
    return "#" * voll + "." * (breite - voll)


def wert_text(wert):
    return "–" if wert is None else komma(wert, 1)


def ausgeben(ergebnisse, gesamt, urteil, hinweise, titel=None, out=sys.stdout):
    kopf = "KI-PRÜFPANEL" + (f"  -  {titel}" if titel else "")
    print("\n" + kopf, file=out)
    print("=" * max(len(kopf), 62), file=out)
    for name in PRUEFUNGEN:
        wert, detail = ergebnisse[name]
        print(f"  {name:<13} {balken(wert)} {wert_text(wert):>5}", file=out)
        print(f"  {'':<13} {detail}", file=out)
    print("-" * 62, file=out)
    print(f"  {'MENSCH-WERT':<13} {balken(gesamt)} {wert_text(gesamt):>5}   {urteil}", file=out)
    zaehlen = gewertete(ergebnisse)
    if urteil == "LEER":
        print("\n  Keine Wörter, nichts zu prüfen. Kein weiterer Durchgang: Text schreiben oder weglassen.", file=out)
    elif len(zaehlen) < len(PRUEFUNGEN):
        print(f"\n  Kurzer Text: gewertet nur {', '.join(zaehlen)}.", file=out)
    if urteil in ("PRÜFEN", "AUFFÄLLIG"):
        schwach = min(zaehlen, key=lambda p: ergebnisse[p][0])
        print(f"\n  Schwächstes Signal: {schwach}. Das zuerst verbessern.", file=out)
    if hinweise:
        print("\n  VAMELA-Hinweise (zählen nicht zur Wertung):", file=out)
        for h in hinweise:
            print(f"    {h['anzahl']}x {h['name']} („{h['beispiel']}“): {h['fix']}", file=out)
    print("", file=out)


# (Text, erwartetes Urteil, erwartete gewertete Prüfungen oder None)
SELBSTTEST = [
    ("", "LEER", []),
    ("🙂🙂", "LEER", []),
    ("Schreinerei Muster in Freising: Öffnungszeiten ins Google-Profil, dann rufen weniger Leute umsonst an. "
     "Speicher dir das.", "BESTANDEN", ["FLOSKELN", "FINGERABDRUCK"]),
    ("Unsere nahtlose, ganzheitliche Lösung ist ein absolutes Muss für deinen Betrieb.", "AUFFÄLLIG",
     ["FLOSKELN", "FINGERABDRUCK"]),
    ("Dein QR-Code auf der Theke ist zu klein. Druck ihn mindestens drei Zentimeter breit, dann scannt ihn auch "
     "das alte Handy. Ich hab das bei der Schreinerei Muster in Freising getestet. Teste es mal selbst. Speicher "
     "dir das für deinen nächsten Flyer, bevor du in die Druckerei gehst.", None, PRUEFUNGEN),
]


def selbsttest(lex, out=sys.stdout):
    fehler = 0
    for text, soll_urteil, soll_gewertet in SELBSTTEST:
        ergebnisse, gesamt, urteil, _, _ = pruefen(text, lex, "de")
        zaehlt = [] if urteil == "LEER" else gewertete(ergebnisse)
        probleme = []
        if soll_urteil and urteil != soll_urteil:
            probleme.append(f"Urteil {urteil}, erwartet {soll_urteil}")
        if soll_gewertet is not None and zaehlt != soll_gewertet:
            probleme.append(f"gewertet {zaehlt}, erwartet {soll_gewertet}")
        fehler += bool(probleme)
        print(f"{'ok    ' if not probleme else 'FEHLER'} {hz.kurz(text, 58) or '(leer)'}  -> {wert_text(gesamt)} {urteil}",
              file=out)
        for p in probleme:
            print(f"         {p}", file=out)
    print(f"\n{len(SELBSTTEST) - fehler} von {len(SELBSTTEST)} Fällen bestanden.", file=out)
    return fehler


def main():
    hz._utf8()
    ap = argparse.ArgumentParser(description="Bewertet, wie maschinell ein Entwurf wirkt (Standard: Deutsch).")
    ap.add_argument("eingabe", nargs="?", default="-", help="Datei, oder - für stdin")
    ap.add_argument("vergleich", nargs="?", help="zweite Datei, für vorher/nachher")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--sprache", choices=["de", "en", "auto"], help="Standard: de (aus slop.json)")
    ap.add_argument("--lexikon", "--lexicon", dest="lexikon", default=LEXIKON)
    ap.add_argument("--fakten", help="optional: data/fakten.json, Werkzeugnamen zählen dann als konkret")
    ap.add_argument("--selbsttest", action="store_true", help="feste Testfälle laufen lassen (Exit 1 bei Fehler)")
    args = ap.parse_args()

    lex = hz.lexikon_laden(args.lexikon)
    if args.selbsttest:
        sys.exit(1 if selbsttest(lex) else 0)
    if args.fakten:
        hz.fakten_einlesen(lex, args.fakten)
    sprache = args.sprache or lex.get("standardsprache", "de")

    def lesen(pfad):
        if pfad == "-":
            return sys.stdin.read()
        with open(pfad, encoding="utf-8") as fh:
            return fh.read()

    ziele = [(args.eingabe, lesen(args.eingabe))]
    if args.vergleich:
        ziele.append((args.vergleich, lesen(args.vergleich)))

    daten, laeufe = [], []
    for name, text in ziele:
        ergebnisse, gesamt, urteil, spr, hinweise = pruefen(text, lex, sprache)
        laeufe.append((ergebnisse, gesamt, urteil, hinweise))
        zaehlt = [] if urteil == "LEER" else gewertete(ergebnisse)
        daten.append({
            "quelle": name,
            "sprache": spr,
            "pruefungen": {k: {"wert": None if v[0] is None else round(v[0], 1), "gewertet": k in zaehlt,
                               "detail": v[1]} for k, v in ergebnisse.items()},
            "gewertet": zaehlt,
            "mensch_wert": None if gesamt is None else round(gesamt, 1),
            "urteil": urteil,
            "vamela_hinweise": hinweise,
        })

    if args.json:
        print(json.dumps(daten if args.vergleich else daten[0], indent=2, ensure_ascii=False))
    else:
        for (name, _), (ergebnisse, gesamt, urteil, hinweise) in zip(ziele, laeufe):
            ausgeben(ergebnisse, gesamt, urteil, hinweise, titel=os.path.basename(name) if args.vergleich else None)
        if args.vergleich:
            a, b = daten
            veraenderung = ""
            if a["mensch_wert"] is not None and b["mensch_wert"] is not None:
                delta = b["mensch_wert"] - a["mensch_wert"]
                veraenderung = f"   ({'+' if delta >= 0 else '-'}{komma(abs(delta), 1)})"
            print(f"  {wert_text(a['mensch_wert'])} {a['urteil']}  ->  "
                  f"{wert_text(b['mensch_wert'])} {b['urteil']}{veraenderung}\n")
    urteil = daten[-1]["urteil"]
    sys.exit(0 if urteil == "BESTANDEN" else (2 if urteil == "LEER" else 1))


if __name__ == "__main__":
    main()
