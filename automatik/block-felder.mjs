// Zusatzfelder je Vorratsblock (Karussell, Reel, Story) und ihre Pflichtregeln:
//   - Mehrwert: …   ein Satz, was der Follower danach kann, weiß oder hat („Du kannst …“). Pflicht in jedem Block
//                   (Christian, 12.10.2026: „Alle Posts sollen einen Mehrwert für meine Follower bieten“).
//   - Motiv: …      kurze englische Bildbeschreibung für einen KI-Bildgenerator, ohne Markenfiguren, Logos und Personen.
//   - Familie: nacht | tag   nacht = Tech/KI/Gaming, dunkel mit oranger Glut; tag = Tier- oder Objekt-Metapher auf Orange/Weiß.
//   - Repo / Lizenz / Sterne   nur und Pflicht bei Säule fundstuecke (siehe automatik/repo-check.mjs).
//
// Der Parser (render/inhalt.mjs) gibt diese Zeilen nicht weiter; deshalb liest dieses Modul sie selbst aus dem Markdown.
//   felderAusText(md)            -> Map „Karussell 13“ -> { mehrwert, motiv, familie, repo, lizenz, sterne }
//   ergaenze(liste, md, wort)    -> Blöcke mit den Feldern (vorhandene Felder des Parsers bleiben)
//   felderFuer(item)             -> Felder eines Queue-Eintrags über item.quelle (sucht Basis- und Auto-Datei)
//   pruefeZusatz(block)          -> Liste der Verstöße (leer = in Ordnung)
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
export const FAMILIEN = ['nacht', 'tag']
export const FELDER = { mehrwert: 'mehrwert', motiv: 'motiv', familie: 'familie', repo: 'repo', lizenz: 'lizenz', sterne: 'sterne' }

/** Alle Blöcke „## Karussell|Reel|Story N: Titel“ mit ihren Zusatzfeldern. */
export function felderAusText(md) {
  const out = new Map()
  for (const sec of String(md || '').split(/^## /m).slice(1)) {
    const kopf = /^(Karussell|Reel|Story) (\d+):/.exec(sec)
    if (!kopf) continue
    const f = {}
    for (const m of sec.matchAll(/^- ([^:\n]+): (.+)$/gm)) {
      const k = FELDER[m[1].trim().toLowerCase()]
      if (k) f[k] = m[2].trim()
    }
    if (f.familie) f.familie = f.familie.toLowerCase()
    out.set(`${kopf[1]} ${+kopf[2]}`, f)
  }
  return out
}

/** Hängt die Zusatzfelder an gelesene Blöcke an (wort: Karussell, Reel oder Story). */
export function ergaenze(liste, md, wort) {
  const f = felderAusText(md)
  return liste.map((x) => {
    const z = f.get(`${wort} ${x.nr}`) || {}
    const neu = { ...x }
    for (const k of Object.keys(FELDER)) if (neu[k] == null && z[k] != null) neu[k] = z[k]
    return neu
  })
}

const DATEIEN = {
  Karussell: ['docs/content-posts.md', 'docs/content-posts-auto.md'],
  Reel: ['docs/content-reels.md', 'docs/content-reels-auto.md'],
  Story: ['docs/content-stories-auto.md'],
}
/** Felder eines Queue-Eintrags aus seinem Vorratsblock (quelle „docs/…md#Karussell 13“). Null, wenn nicht auffindbar. */
export function felderFuer(item = {}, { root = ROOT } = {}) {
  const m = /^(.*?)#(Karussell|Reel|Story) (\d+)$/.exec(String(item.quelle || ''))
  if (!m) return null
  const [, datei, wort, nr] = m
  for (const d of [datei, ...DATEIEN[wort].filter((x) => x !== datei)]) {
    const p = path.join(root, d)
    if (!fs.existsSync(p)) continue
    const f = felderAusText(fs.readFileSync(p, 'utf8')).get(`${wort} ${+nr}`)
    if (f) return f
  }
  return null
}

// ------------------------------------------------------------------------------------------------- Regeln

/** Der Mehrwert-Satz beginnt mit einem dieser Verben: was der Follower danach kann, weiß oder hat. */
export const MEHRWERT_ANFANG = /^Du (kannst|weißt|hast|bekommst|erkennst|findest|sparst|vermeidest)\b/
/** Reine Image- oder Spruch-Formulierungen ohne Nutzen. */
const SPRUCH = /\b(Inspiration|inspiriert|Motivation|motiviert|Leidenschaft|große Ideen|Ideen brauchen|Mut zu|Vision|Träume|Herzblut|Qualität, die)\b/i
/** Echte Marken, Spielfiguren und Logos, die nie ins Bildmotiv dürfen (stattdessen „voxel-style“, „retro game“ usw.). */
// (Allerweltswörter wie apple, windows, android oder halo stehen bewusst nicht drin; deren Logos fängt die Logo-Regel.)
export const MARKEN = /\b(minecraft|creeper|steve|mario|luigi|nintendo|zelda|pok[eé]mon|pikachu|fortnite|roblox|sonic the hedgehog|pac-?man|tetris|lego|disney|pixar|marvel|star wars|playstation|xbox|overwatch|valorant|elden ring|cyberpunk 2077|the sims|among us|animal crossing|call of duty|gta|grand theft auto|league of legends|harry potter|hogwarts|mickey|batman|spider-?man|superman|barbie|hello kitty|iphone|ipad|macbook|google|microsoft|openai|chatgpt|claude|anthropic|instagram|facebook|whatsapp|tiktok|youtube|github|octocat|adobe|photoshop|figma|nvidia|tesla)\b/i
/** Keine Personen im Motiv (CLAUDE.md: keine Fotos von Personen). Hände sind erlaubt. */
const PERSON = /\b(person|people|man|men|woman|women|girl|boy|child|children|kid|face|faces|portrait|selfie|human|crowd|businessman|businesswoman)\b/i

// Satzende nur, wenn danach keine Ziffer und kein Kleinbuchstabe folgt (vamela.de, 1.490)
const saetze = (t) => (String(t).match(/(?:[^.!?]|[.!?](?=[\da-zäöü]))+[.!?]+/g) || [String(t)]).filter((s) => s.trim().length > 2).length

/** Verstöße eines Bildmotivs (auch für die Motiv-Ideen in data/trends.json). */
export function pruefeMotiv(motiv) {
  const f = []
  const mo = String(motiv || '').trim()
  if (!mo) return ['Zeile „- Motiv: …“ fehlt (kurze englische Bildbeschreibung)']
  const w = mo.split(/\s+/).length
  if (/[äöüÄÖÜß„“]/.test(mo) || !/\b(a|an|the|with|of|on|in)\b/i.test(mo)) f.push('Motiv muss Englisch sein')
  if (w < 5 || w > 45) f.push(`Motiv hat ${w} Wörter, erlaubt sind 5 bis 45`)
  const marke = MARKEN.exec(mo)
  if (marke) f.push(`Motiv nennt die Marke oder Figur „${marke[0]}“ (stattdessen allgemein: voxel-style, retro game, robot …)`)
  if (/\blogos?\b|\bbrand(ed|s)?\b|\btrademark/i.test(mo)) f.push('Motiv: keine Logos oder Marken')
  const person = PERSON.exec(mo)
  if (person) f.push(`Motiv zeigt eine Person („${person[0]}“), keine Personen`)
  if (/\b(text|words|letters|caption|headline|typography)\b/i.test(mo)) f.push('Motiv: keine Schrift im Bild (die setzt der Renderer)')
  return f
}

/** Verstöße gegen die Zusatzfelder eines Blocks (Mehrwert, Motiv, Familie und bei fundstuecke Repo, Lizenz, Sterne). */
export function pruefeZusatz(b = {}) {
  const f = []
  const mw = String(b.mehrwert || '').trim()
  if (!mw) f.push('Zeile „- Mehrwert: …“ fehlt (ein Satz: was der Follower danach kann, weiß oder hat)')
  else {
    if (!MEHRWERT_ANFANG.test(mw)) f.push(`Mehrwert muss mit „Du kannst“, „Du weißt“, „Du hast“ (oder bekommst, erkennst, findest, sparst, vermeidest) beginnen: „${mw.slice(0, 40)}“`)
    if (mw.length < 30 || mw.length > 220) f.push(`Mehrwert hat ${mw.length} Zeichen, erlaubt sind 30 bis 220`)
    if (saetze(mw.replace(/\b(z|d|u|bzw|ca|etc)\.\s?(B|h|a)?\.?/g, '')) > 1) f.push('Mehrwert: genau ein Satz')
    if (SPRUCH.test(mw)) f.push('Mehrwert klingt nach Spruch statt nach Nutzen')
  }
  f.push(...pruefeMotiv(b.motiv))
  if (!FAMILIEN.includes(String(b.familie || '').toLowerCase())) f.push(`Zeile „- Familie: nacht | tag“ fehlt oder ist „${b.familie || ''}“`)
  const fund = b.saeule === 'fundstuecke'
  if (fund) {
    if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(String(b.repo || ''))) f.push('Säule fundstuecke ohne Zeile „- Repo: owner/name“')
    if (!b.lizenz) f.push('Säule fundstuecke ohne Zeile „- Lizenz: …“ (SPDX-Kennung wie MIT)')
    if (!/^rund \d{1,3}(?:\.\d{3})* \(Stand \d{2}\.\d{2}\.\d{4}\)$/.test(String(b.sterne || ''))) f.push('Säule fundstuecke ohne Zeile „- Sterne: rund N (Stand TT.MM.JJJJ)“')
  } else if (b.repo) f.push('Zeile „Repo“ nur bei Säule fundstuecke')
  return f
}
