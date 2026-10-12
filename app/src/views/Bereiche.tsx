import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, errorText, type SetupState } from '../api'
import { Button, Check, Field, Link, Note, Spinner } from '../ui'

// ---------- Daten ----------
export type Item = {
  id: string; typ: 'karussell' | 'story' | 'reel'; titel: string; angebot?: string; saeule?: string | null; hook_stil?: string | null; serie?: string | null
  fruehestens?: string | null; dateien: string[]; caption: string; hashtags: string[]
  status: 'neu' | 'geprueft' | 'abgelehnt' | 'aufgegeben' | 'veroeffentlicht' | 'fehler'; geplant?: string | null
  qa?: { verdikt: string; gruende: string[]; am: string } | null; ig?: { id: string; permalink: string; am: string } | null; fehler?: string | null
}
type Messwerte = { konto: { datum: string; follower: number }[]; beitraege: Record<string, { id: string | null; titel: string | null; typ: string; permalink: string; zeit: string; verlauf: Record<string, number | string>[] }> }
type Params = { feed: { uhrzeit: string; tage: Record<string, string> }; stories: { uhrzeit: string; tage: number[] }; puffer_min: number }
type Lauf = { name: string; status: string; conclusion: string; createdAt: string; displayTitle: string; url: string; event: string }

function useRepo<T>(pfad: string, leer: T, json = true) {
  const [data, setData] = useState<T>(leer)
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const neu = useCallback(() => {
    setLaedt(true)
    api.repoDatei(pfad).then((t) => { setData(json ? JSON.parse(t) : (t as unknown as T)); setFehler(null) }).catch((e) => setFehler(errorText(e))).finally(() => setLaedt(false))
  }, [pfad, json])
  useEffect(neu, [neu])
  return { data, laedt, fehler, neu }
}

const TYP: Record<string, { name: string; farbe: string }> = { karussell: { name: 'Karussell', farbe: '#ff7a33' }, reel: { name: 'Reel', farbe: '#f4f4f4' }, story: { name: 'Story', farbe: '#ffb020' } }
const STATUS: Record<string, { name: string; farbe: string }> = { neu: { name: 'ungeprüft', farbe: 'var(--muted)' }, geprueft: { name: 'bereit', farbe: 'var(--ok)' }, abgelehnt: { name: 'abgelehnt', farbe: 'var(--err)' }, aufgegeben: { name: 'aufgegeben', farbe: 'var(--err)' }, veroeffentlicht: { name: 'veröffentlicht', farbe: 'var(--accent)' }, fehler: { name: 'Fehler', farbe: 'var(--err)' } }

const Card = ({ children, title, right }: { children: ReactNode; title?: string; right?: ReactNode }) => (
  <section className="karte p-6">
    {(title || right) && (
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"><span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--o)', boxShadow: '0 0 10px var(--o)' }} />{title}</h3>
        {right}
      </div>
    )}
    {children}
  </section>
)
const Chip = ({ text, farbe }: { text: string; farbe: string }) => (
  <span className="inline-block rounded-full px-3 py-1 text-[12px] font-medium" style={{ color: farbe, background: `color-mix(in srgb, ${farbe} 14%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${farbe} 40%, transparent)` }}>{text}</span>
)
const Zahl = ({ wert, label, sub, glut, anteil }: { wert: ReactNode; label: string; sub?: string; glut?: boolean; anteil?: number }) => (
  <div className="karte relative overflow-hidden p-6">
    {glut && <div className="pointer-events-none absolute -bottom-16 -right-10 h-40 w-56 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(255,91,20,.45), transparent)' }} />}
    <div className={`relative text-[40px] font-semibold leading-none tracking-[-0.03em] ${glut ? 'verlauf' : ''}`}>{wert}</div>
    <div className="mt-2 text-[13px]" style={{ color: 'var(--muted)' }}>{label}</div>
    {sub && <div className="mt-1 text-[12px]" style={{ color: 'var(--muted)' }}>{sub}</div>}
    {anteil != null && <div className="mt-4 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,.08)' }}><div className="h-full rounded-full" style={{ width: `${Math.min(100, anteil * 100)}%`, background: 'linear-gradient(90deg, var(--od), var(--o2))', boxShadow: '0 0 12px var(--o)' }} /></div>}
  </div>
)
const Laden = ({ fehler, laedt }: { fehler: string | null; laedt: boolean }) => (fehler ? <Note tone="err">{fehler}</Note> : laedt ? <Spinner /> : null)
const datum = (s: string) => new Date(s).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const tag = (d: Date) => d.toISOString().slice(0, 10)

const SAEULE: Record<string, string> = { tipps: 'Tipps für Betriebe', werkzeuge: 'Gratis-Werkzeug', design: 'Design', fundstuecke: 'Fundstück' }

// Cover eines Beitrags im 4:5-Format, wie im Instagram-Raster
function Cover({ item, breite }: { item: Item; breite?: number }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    const f = item.dateien.find((d) => d.endsWith('.jpg'))
    if (f) api.repoBild(f).then(setSrc).catch(() => setSrc(null))
  }, [item])
  return (
    <div className="relative shrink-0 overflow-hidden rounded-2xl" style={{ width: breite ?? '100%', aspectRatio: '4 / 5', background: 'rgba(255,255,255,.04)', boxShadow: '0 0 0 1px rgba(255,255,255,.08), 0 24px 40px -24px rgba(255,91,20,.55)' }}>
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
    </div>
  )
}

// Follower-Verlauf als leuchtende Linie mit Fläche
function Kurve({ werte }: { werte: number[] }) {
  if (werte.length < 2) return <Note>Noch keine Messung.</Note>
  const w = 360, h = 110, min = Math.min(...werte), max = Math.max(...werte), sp = max - min || 1
  const pkt = werte.map((v, i) => [(i / (werte.length - 1)) * w, h - 8 - ((v - min) / sp) * (h - 20)])
  const linie = pkt.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 w-full" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="kf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff5b14" stopOpacity=".38" /><stop offset="1" stopColor="#ff5b14" stopOpacity="0" /></linearGradient>
        <filter id="kg"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <path d={`${linie} L${w},${h} L0,${h} Z`} fill="url(#kf)" />
      <path d={linie} fill="none" stroke="#ff5b14" strokeWidth="5" filter="url(#kg)" opacity=".7" />
      <path d={linie} fill="none" stroke="#ff8a3d" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx={pkt[pkt.length - 1][0]} cy={pkt[pkt.length - 1][1]} r="5" fill="#fff" stroke="#ff5b14" strokeWidth="3" />
    </svg>
  )
}

// ---------- Übersicht ----------
export function Uebersicht() {
  const q = useRepo<Item[]>('plan/queue.json', [])
  const mw = useRepo<Messwerte>('data/messwerte.json', { konto: [], beitraege: {} })
  const params = useRepo<Params | null>('plan/params.json', null)
  const [pause, setPause] = useState<boolean | null>(null)
  const [laeufe, setLaeufe] = useState<Lauf[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { api.pauseStatus().then(setPause).catch(() => setPause(null)); api.laeufe().then((t) => setLaeufe(JSON.parse(t))).catch(() => {}) }, [])
  const bereit = q.data.filter((x) => x.status === 'geprueft' && x.typ !== 'story')
  const ziel = params.data?.puffer_min ?? 10
  const pubs = q.data.filter((x) => x.status === 'veroeffentlicht').sort((a, b) => (b.ig?.am || '').localeCompare(a.ig?.am || ''))
  const k = mw.data.konto
  const fol = k.length ? k[k.length - 1].follower : null
  const fol7 = k.length > 1 ? k[Math.max(0, k.length - 8)].follower : null
  const start = async (datei: string, trocken?: boolean) => { setMsg(null); try { await api.workflowStarten(datei, trocken); setMsg('Gestartet. Das Ergebnis erscheint in ein bis zwei Minuten unter Protokoll.') } catch (e) { setMsg(errorText(e)) } }
  return (
    <div className="flex max-w-[980px] flex-col gap-5">
      <Laden fehler={q.fehler} laedt={q.laedt} />
      <div className="grid grid-cols-3 gap-4">
        <Zahl wert={<>{bereit.length}<span style={{ color: '#6f6f6f' }}>/{ziel}</span></>} label="Puffer geprüfter Beiträge" sub={bereit.length < 5 ? 'wird knapp' : 'ausreichend'} anteil={bereit.length / ziel} />
        <Zahl wert={pubs.length} label="veröffentlicht" sub={pubs[0] ? `zuletzt ${datum(pubs[0].ig!.am)}` : 'noch nichts'} />
        <Zahl wert={pause === null ? '–' : pause ? 'Pause' : 'läuft'} label="Automatik" sub={pause ? 'nichts wird veröffentlicht' : `Feed ${(params.data?.feed.uhrzeiten ?? [params.data?.feed.uhrzeit]).join(' und ')} Uhr`} />
      </div>
      <div className="grid grid-cols-[1.35fr_1fr] gap-4">
        <section className="karte relative flex gap-6 overflow-hidden p-5">
          <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(255,91,20,.28), transparent)' }} />
          {bereit[0] ? (
            <>
              <Cover item={bereit[0]} breite={196} />
              <div className="relative flex min-w-0 flex-col py-1">
                <span className="text-[13px]" style={{ color: 'var(--muted)' }}>Nächster Beitrag</span>
                <h2 className="mt-1 text-[26px] font-semibold leading-[1.12] tracking-[-0.025em]">{bereit[0].titel}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Chip text={TYP[bereit[0].typ].name} farbe={TYP[bereit[0].typ].farbe} />
                  {bereit[0].saeule && <Chip text={SAEULE[bereit[0].saeule] ?? bereit[0].saeule} farbe="#c9c9c9" />}
                </div>
                <p className="mt-auto text-[14px]" style={{ color: 'var(--muted)' }}>
                  {bereit[0].geplant ? <>geplant <span className="ser text-[18px] text-white">{datum(bereit[0].geplant)}</span></> : 'nach Plan'}
                </p>
              </div>
            </>
          ) : <Note>Kein geprüfter Beitrag bereit.</Note>}
        </section>
        <section className="karte relative overflow-hidden p-6">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px]" style={{ color: 'var(--muted)' }}>Follower, 3 Wochen</span>
            <span className="text-[13px] font-medium" style={{ color: 'var(--o2)' }}>{fol != null && fol7 != null ? `${fol - fol7 >= 0 ? '+' : ''}${fol - fol7} diese Woche` : ''}</span>
          </div>
          <div className="verlauf mt-1 text-[44px] font-semibold leading-none tracking-[-0.03em]">{fol ?? '–'}</div>
          <Kurve werte={k.slice(-21).map((x) => x.follower)} />
        </section>
      </div>
      {bereit.length > 1 && (
        <Card title="Als Nächstes" right={<span className="text-[12px]" style={{ color: 'var(--muted)' }}>Reihenfolge nach Plan</span>}>
          <div className="grid grid-cols-5 gap-3">
            {bereit.slice(1, 6).map((x) => (
              <div key={x.id} className="min-w-0">
                <Cover item={x} />
                <div className="mt-2 truncate text-[13px] font-medium">{x.titel}</div>
                <div className="text-[12px]" style={{ color: 'var(--muted)' }}>{TYP[x.typ].name}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Card title="Zuletzt veröffentlicht">
          {pubs.length === 0 ? <Note>Noch nichts veröffentlicht.</Note> : (
            <ul className="flex flex-col gap-2">{pubs.slice(0, 4).map((x) => <li key={x.id} className="flex justify-between gap-3"><span>{x.titel}</span><Link href={x.ig!.permalink}>ansehen</Link></li>)}</ul>
          )}
        </Card>
        <Card title="Letzte Abläufe">
          <ul className="flex flex-col gap-2">
            {laeufe.slice(0, 4).map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-3"><span>{l.name}</span><span style={{ color: l.conclusion === 'success' ? 'var(--ok)' : l.status !== 'completed' ? 'var(--warn)' : 'var(--err)' }}>{l.status !== 'completed' ? 'läuft' : l.conclusion === 'success' ? 'ok' : 'Fehler'}</span></li>
            ))}
            {laeufe.length === 0 && <Note>Noch keine Abläufe.</Note>}
          </ul>
        </Card>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button kind="quiet" onClick={() => start('produzieren.yml')}>Puffer jetzt auffüllen</Button>
        <Button kind="quiet" onClick={() => start('veroeffentlichen.yml', true)}>Veröffentlichen testen (Trockenlauf)</Button>
        <Button kind="quiet" onClick={() => { q.neu(); mw.neu() }}>Aktualisieren</Button>
        {msg && <Note>{msg}</Note>}
      </div>
    </div>
  )
}

// ---------- Kalender ----------
export function Kalender() {
  const q = useRepo<Item[]>('plan/queue.json', [])
  const params = useRepo<Params | null>('plan/params.json', null)
  const zellen = useMemo(() => {
    if (!params.data) return null
    const heute = new Date()
    const start = new Date(heute); start.setDate(heute.getDate() - ((heute.getDay() + 6) % 7))
    const bereit = { karussell: q.data.filter((x) => x.status === 'geprueft' && x.typ === 'karussell'), reel: q.data.filter((x) => x.status === 'geprueft' && x.typ === 'reel' && !x.serie), serie: q.data.filter((x) => x.status === 'geprueft' && x.typ === 'reel' && x.serie), story: q.data.filter((x) => x.status === 'geprueft' && x.typ === 'story') }
    const zaehler = { karussell: 0, reel: 0, serie: 0, story: 0 }
    const wochen: { tag: Date; eintraege: { item?: Item; text: string; typ: string; getan: boolean }[] }[][] = []
    for (let w = 0; w < 5; w++) {
      const woche = []
      for (let d = 0; d < 7; d++) {
        const tagD = new Date(start); tagD.setDate(start.getDate() + w * 7 + d)
        const wd = tagD.getDay()
        const eintraege: { item?: Item; text: string; typ: string; getan: boolean }[] = []
        const t = tag(tagD)
        for (const x of q.data.filter((x) => x.status === 'veroeffentlicht' && x.ig?.am && tag(new Date(x.ig.am)) === t)) eintraege.push({ item: x, text: x.titel, typ: x.typ, getan: true })
        if (tagD >= new Date(tag(heute))) {
          const art: string | undefined = params.data.feed.tage[String(wd)]
          if (art && !eintraege.some((e) => e.typ !== 'story')) {
            const key = art === 'reel' && wd === 3 ? 'serie' : art === 'reel' ? 'reel' : 'karussell'
            const it = bereit[key][zaehler[key]++]
            eintraege.push({ item: it, text: it ? it.titel : 'noch nichts bereit', typ: art, getan: false })
          }
          if (params.data.stories.tage.includes(wd) && !eintraege.some((e) => e.typ === 'story')) {
            const it = bereit.story[zaehler.story++]
            eintraege.push({ item: it, text: it ? it.titel : 'noch nichts bereit', typ: 'story', getan: false })
          }
        }
        woche.push({ tag: tagD, eintraege })
      }
      wochen.push(woche)
    }
    return wochen
  }, [q.data, params.data])
  return (
    <div className="max-w-[1040px]">
      <Laden fehler={q.fehler || params.fehler} laedt={q.laedt} />
      <p className="mb-4 text-[13px]" style={{ color: 'var(--muted)' }}>Feed {(params.data?.feed.uhrzeiten ?? [params.data?.feed.uhrzeit]).join(', ')} Uhr, Stories {(params.data?.stories.uhrzeiten ?? [params.data?.stories.uhrzeit]).join(', ')} Uhr (Berliner Zeit). Zukünftige Felder zeigen, was nach der aktuellen Reihenfolge drankäme.</p>
      <div className="grid grid-cols-7 gap-1.5 text-[12px]" style={{ color: 'var(--muted)' }}>{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => <div key={d} className="px-1">{d}</div>)}</div>
      <div className="mt-1 flex flex-col gap-1.5">
        {zellen?.map((w, i) => (
          <div key={i} className="grid grid-cols-7 gap-1.5">
            {w.map((c, j) => (
              <div key={j} className="min-h-[92px] rounded-lg p-2" style={{ background: 'var(--panel)', border: `1px solid ${tag(c.tag) === tag(new Date()) ? 'var(--accent)' : 'var(--line)'}`, opacity: c.tag < new Date(tag(new Date())) && !c.eintraege.length ? 0.4 : 1 }}>
                <div className="mb-1 text-[11px]" style={{ color: 'var(--muted)' }}>{c.tag.getDate()}.{c.tag.getMonth() + 1}.</div>
                {c.eintraege.map((e, k) => (
                  <div key={k} className="mb-1 rounded px-1.5 py-1 text-[11.5px] leading-tight" style={{ background: 'var(--bg)', borderLeft: `3px solid ${TYP[e.typ]?.farbe}`, opacity: e.item || e.getan ? 1 : 0.5 }}>
                    {e.getan && <span style={{ color: 'var(--ok)' }}>✓ </span>}{e.text}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- Beiträge ----------
function Vorschau({ item }: { item: Item }) {
  const [bilder, setBilder] = useState<string[]>([])
  const [fehler, setFehler] = useState<string | null>(null)
  useEffect(() => {
    const jpg = item.dateien.filter((f) => f.endsWith('.jpg')).slice(0, 4)
    Promise.all(jpg.map((f) => api.repoBild(f))).then(setBilder).catch((e) => setFehler(errorText(e)))
  }, [item])
  if (item.status === 'veroeffentlicht') return item.ig ? <Link href={item.ig.permalink}>Auf Instagram ansehen</Link> : null
  return (
    <div>
      <div className="flex gap-2">{bilder.map((b, i) => <img key={i} src={b} className="h-40 rounded-lg" />)}{!bilder.length && !fehler && <Spinner />}</div>
      {fehler && <Note tone="warn">Vorschau nicht verfügbar ({fehler.slice(0, 80)})</Note>}
    </div>
  )
}
export function Beitraege() {
  const q = useRepo<Item[]>('plan/queue.json', [])
  const [filter, setFilter] = useState('alle')
  const [offen, setOffen] = useState<string | null>(null)
  const liste = q.data.filter((x) => filter === 'alle' || (filter === 'problem' ? x.status === 'abgelehnt' || x.status === 'aufgegeben' || x.status === 'fehler' : x.status === filter))
  return (
    <div className="max-w-[980px]">
      <div className="mb-4 flex flex-wrap gap-2">
        {[['alle', 'Alle'], ['geprueft', 'Bereit'], ['veroeffentlicht', 'Veröffentlicht'], ['neu', 'Ungeprüft'], ['problem', 'Probleme']].map(([k, n]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-4 py-2 text-[13px] font-medium transition ${filter === k ? 'knopf-o' : 'knopf-glas'}`}>{n}</button>
        ))}
      </div>
      <Laden fehler={q.fehler} laedt={q.laedt} />
      {(() => { const x = liste.find((y) => y.id === offen); return x ? (
        <section className="karte mb-5 flex flex-col gap-3 p-6">
          <div className="flex items-center gap-3">
            <Chip text={TYP[x.typ].name} farbe={TYP[x.typ].farbe} />
            <h2 className="flex-1 text-[20px] font-semibold tracking-[-0.02em]">{x.titel}</h2>
            <Chip text={STATUS[x.status].name} farbe={STATUS[x.status].farbe} />
            <button className="knopf-glas rounded-full px-3 py-1 text-[13px]" onClick={() => setOffen(null)}>schließen</button>
          </div>
          <Details x={x} />
        </section>
      ) : null })()}
      <div className="grid grid-cols-4 gap-4">
        {liste.map((x) => (
          <button key={x.id} className="group min-w-0 text-left" onClick={() => setOffen(offen === x.id ? null : x.id)}>
            <div className="relative transition group-hover:-translate-y-0.5">
              <Cover item={x} />
              <div className="absolute right-2.5 top-2.5 rounded-full" style={{ background: 'rgba(10,10,10,.72)', backdropFilter: 'blur(8px)' }}><Chip text={TYP[x.typ].name} farbe={TYP[x.typ].farbe} /></div>
              <div className="absolute bottom-2.5 left-2.5 rounded-full" style={{ background: 'rgba(10,10,10,.72)', backdropFilter: 'blur(8px)' }}><Chip text={STATUS[x.status].name} farbe={STATUS[x.status].farbe} /></div>
            </div>
            <div className="mt-2.5 line-clamp-2 text-[13.5px] font-medium leading-snug" style={{ color: offen === x.id ? 'var(--o2)' : 'var(--text)' }}>{x.titel}</div>
          </button>
        ))}
        {!liste.length && !q.laedt && <Note>Nichts in dieser Ansicht.</Note>}
      </div>
    </div>
  )
}

function Details({ x }: { x: Item }) {
  return (
              <div className="flex flex-col gap-3">
                <Vorschau item={x} />
                {x.qa && x.qa.gruende.length > 0 && <Note tone="err">Prüfung: {x.qa.gruende.join(' | ')}</Note>}
                {x.fehler && <Note tone="err">{x.fehler}</Note>}
                {x.fruehestens && <Note>Frühestens am {x.fruehestens}</Note>}
                <pre className="whitespace-pre-wrap text-[13px] leading-relaxed" style={{ fontFamily: 'inherit', userSelect: 'text' }}>{x.caption}{x.hashtags?.length ? '\n\n' + x.hashtags.join(' ') : ''}</pre>
              </div>
  )
}

// ---------- Auswertung ----------
export function Auswertung() {
  const mw = useRepo<Messwerte>('data/messwerte.json', { konto: [], beitraege: {} })
  const k = mw.data.konto
  const beitraege = Object.values(mw.data.beitraege).sort((a, b) => b.zeit.localeCompare(a.zeit))
  const w = (b: (typeof beitraege)[number], key: string) => b.verlauf[b.verlauf.length - 1]?.[key] ?? '–'
  return (
    <div className="flex max-w-[980px] flex-col gap-5">
      <Laden fehler={mw.fehler} laedt={mw.laedt} />
      <Card title="Follower">
        {k.length < 2 ? <Note>Noch zu wenige Messungen. Die Automatik misst täglich.</Note> : (
          <><Kurve werte={k.map((x) => x.follower)} /><div className="mt-2 flex justify-between text-[12px]" style={{ color: 'var(--muted)' }}><span>{k[0].datum}</span><span>{k[k.length - 1].datum}: <b className="text-white">{k[k.length - 1].follower}</b></span></div></>
        )}
      </Card>
      <Card title="Beiträge">
        {!beitraege.length ? <Note>Noch keine Kennzahlen.</Note> : (
          <table className="w-full text-[13px]"><thead><tr style={{ color: 'var(--muted)', textAlign: 'left' }}><th className="pb-2">Beitrag</th><th>Ansichten</th><th>Reichweite</th><th>Likes</th><th>Gespeichert</th><th>Geteilt</th></tr></thead>
            <tbody>{beitraege.map((b, i) => <tr key={i} style={{ borderTop: '1px solid var(--line)' }}><td className="py-2 pr-3"><Link href={b.permalink}>{b.titel || b.permalink.slice(-11)}</Link></td><td>{w(b, 'views')}</td><td>{w(b, 'reach')}</td><td>{w(b, 'likes')}</td><td>{w(b, 'saved')}</td><td>{w(b, 'shares')}</td></tr>)}</tbody></table>
        )}
      </Card>
    </div>
  )
}

// ---------- Lernen ----------
export function Lernen() {
  const t = useRepo<string>('learnings.md', '', false)
  return (
    <div className="max-w-[760px]">
      <Laden fehler={t.fehler} laedt={t.laedt} />
      <div className="flex flex-col gap-2 text-[14px] leading-relaxed" style={{ userSelect: 'text' }}>
        {t.data.split('\n').map((l, i) => l.startsWith('## ') ? <h3 key={i} className="mt-5 text-[17px] font-semibold">{l.slice(3)}</h3> : l.startsWith('# ') ? null : l.startsWith('- ') ? <p key={i} className="pl-3" style={{ color: 'var(--text)' }}>• {l.slice(2)}</p> : l.trim() ? <p key={i} style={{ color: 'var(--muted)' }}>{l}</p> : null)}
      </div>
    </div>
  )
}

// ---------- Material ----------
export function Material({ state }: { state: SetupState }) {
  const fotos = useRepo<{ id: number; kind: string }[]>('data/fotos.json', [])
  const cov = useRepo<Record<string, number | string>>('data/cover-nutzung.json', {})
  const [drive, setDrive] = useState<number | null>(null)
  const [driveFehler, setDriveFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const zaehlen = () => api.fotosZaehlen().then((n) => { setDrive(n); setDriveFehler(null) }).catch((e) => setDriveFehler(errorText(e)))
  useEffect(() => { void zaehlen() }, [])
  const hoch = async () => { setBusy(true); setMsg(null); try { setMsg({ tone: 'ok', text: await api.fotosHochladen() }); void zaehlen() } catch (e) { setMsg({ tone: 'err', text: errorText(e) }) } finally { setBusy(false) } }
  const covers = Object.values(cov.data).filter((v) => typeof v === 'number').length
  const textCovers = Object.values(cov.data).filter((v) => v === 'text').length
  const portraets = fotos.data.filter((f) => f.kind === 'portrait' || f.kind === 'ruecken' || f.kind === 'ereignis' || f.kind === 'buch').length
  return (
    <div className="flex max-w-[860px] flex-col gap-5">
      <Card title="Fotos in Google Drive">
        <p className="mb-3">Ordner <b>{state.drive_folder}/Fotos</b>: {drive != null ? `${drive} Dateien` : driveFehler ? '' : <Spinner />}</p>
        {driveFehler && <Note tone="err">{driveFehler}</Note>}
        <p className="mb-3 text-[13px]" style={{ color: 'var(--muted)' }}>Optionaler Ablageordner für Bilder und Aufnahmen. Bilder aus dem Ordner „VAMELA“ auf diesem Mac kannst du mit einem Klick hochladen (nichts wird überschrieben).</p>
        <Button busy={busy} onClick={hoch}>Bilder aus ~/VAMELA hochladen</Button>
        {msg && <div className="mt-3"><Note tone={msg.tone}>{msg.text}</Note></div>}
      </Card>
      <Card title="Cover-Regel: jedes Foto nur einmal">
        <p><b>{covers}</b> von {portraets} Fotos waren schon Cover{textCovers ? `, dazu ${textCovers} reine Textcover` : ''}.</p>
        {portraets - covers < 6 && <Note tone="warn">Es werden neue Fotos gebraucht. Ohne sie kommen bald nur noch Textcover.</Note>}
      </Card>
    </div>
  )
}

// ---------- Berichte ----------
export function Berichte() {
  const idx = useRepo<string[]>('data/berichte/index.json', [])
  const [offen, setOffen] = useState<string | null>(null)
  const [text, setText] = useState('')
  useEffect(() => { if (offen) api.repoDatei(`data/berichte/${offen}.txt`).then(setText).catch((e) => setText(errorText(e))) }, [offen])
  return (
    <div className="flex max-w-[760px] flex-col gap-3">
      <Note>Jeden Montag geht der Bericht per Mail an dich. Hier steht dieselbe Fassung.</Note>
      {idx.data.length === 0 && !idx.laedt && <Note>Noch kein Bericht.</Note>}
      {[...idx.data].reverse().map((d) => (
        <Card key={d} title={d} right={<Button kind="quiet" onClick={() => setOffen(offen === d ? null : d)}>{offen === d ? 'Zuklappen' : 'Lesen'}</Button>}>
          {offen === d && <pre className="whitespace-pre-wrap text-[13px] leading-relaxed" style={{ fontFamily: 'inherit', userSelect: 'text' }}>{text}</pre>}
        </Card>
      ))}
    </div>
  )
}

// ---------- Protokoll ----------
export function Protokoll() {
  const [laeufe, setLaeufe] = useState<Lauf[]>([])
  const [fehler, setFehler] = useState<string | null>(null)
  const [log, setLog] = useState('')
  const [zeigeLog, setZeigeLog] = useState(false)
  const neu = () => { api.laeufe().then((t) => setLaeufe(JSON.parse(t))).catch((e) => setFehler(errorText(e))); api.logLesen(80).then(setLog) }
  useEffect(neu, [])
  return (
    <div className="flex max-w-[980px] flex-col gap-5">
      <Card title="Abläufe auf GitHub" right={<Button kind="quiet" onClick={neu}>Aktualisieren</Button>}>
        {fehler && <Note tone="err">{fehler}</Note>}
        <table className="w-full text-[13px]"><tbody>
          {laeufe.map((l, i) => (
            <tr key={i} style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <td className="py-2 pr-3">{l.name}</td><td style={{ color: 'var(--muted)' }}>{datum(l.createdAt)}</td>
              <td style={{ color: l.conclusion === 'success' ? 'var(--ok)' : l.status !== 'completed' ? 'var(--warn)' : 'var(--err)' }}>{l.status !== 'completed' ? 'läuft' : l.conclusion === 'success' ? 'ok' : l.conclusion}</td>
              <td className="text-right"><Link href={l.url}>Details</Link></td>
            </tr>
          ))}
        </tbody></table>
      </Card>
      <Card title="Protokoll dieser App" right={<Button kind="quiet" onClick={() => setZeigeLog(!zeigeLog)}>{zeigeLog ? 'Ausblenden' : 'Anzeigen'}</Button>}>
        {zeigeLog && <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap text-[12px]" style={{ userSelect: 'text' }}>{log}</pre>}
      </Card>
    </div>
  )
}

// ---------- Einstellungen ----------
const SECRETS: [string, string][] = [['IG_ACCESS_TOKEN', 'Instagram-Zugang'], ['IG_USER_ID', 'Instagram-Konto'], ['CLAUDE_CODE_OAUTH_TOKEN', 'Claude-Abo'], ['RCLONE_DRIVE_TOKEN', 'Google Drive'], ['GMAIL_APP_PASSWORD', 'Gmail'], ['TOKEN_KEY', 'Schlüssel für die Token-Erneuerung'], ['MEDIA_TOKEN', 'GitHub-Zugriff für Bilder (vamela-insta-media)']]
export function Einstellungen({ state, onSetup }: { state: SetupState; onSetup: () => void }) {
  const [secrets, setSecrets] = useState<string[] | null>(null)
  const [pause, setPause] = useState<boolean | null>(null)
  const [token, setToken] = useState('')
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const laden = () => { api.secretsListe().then(setSecrets).catch(() => setSecrets([])); api.pauseStatus().then(setPause).catch(() => {}) }
  useEffect(laden, [])
  const sichern = async () => { try { await api.secretSetzen('MEDIA_TOKEN', token); setToken(''); setMsg({ tone: 'ok', text: 'Gespeichert.' }); laden() } catch (e) { setMsg({ tone: 'err', text: errorText(e) }) } }
  const fehlt = secrets && !secrets.includes('MEDIA_TOKEN')
  return (
    <div className="flex max-w-[760px] flex-col gap-5">
      <Card title="Automatik">
        <div className="flex items-center justify-between gap-4">
          <div><div className="font-medium">{pause ? 'Pausiert' : 'Läuft'}</div><Note>Bei Pause veröffentlicht die Automatik nichts, bis du sie wieder einschaltest.</Note></div>
          <Button kind={pause ? 'primary' : 'quiet'} onClick={async () => { await api.pauseSetzen(!pause); setPause(!pause) }}>{pause ? 'Fortsetzen' : 'Pausieren'}</Button>
        </div>
      </Card>
      <Card title="Verbindungen">
        <ul className="flex flex-col gap-2">
          <li className="flex items-center gap-3"><Check ok={!!state.github_login} /> GitHub {state.github_login ? `(${state.github_login})` : ''}</li>
          <li className="flex items-center gap-3"><Check ok={!!state.drive_folder} /> Google Drive {state.drive_folder ? `(Ordner ${state.drive_folder})` : ''}</li>
          <li className="flex items-center gap-3"><Check ok={!!state.instagram_username} /> Instagram {state.instagram_username ? `(@${state.instagram_username})` : ''}</li>
          <li className="flex items-center gap-3"><Check ok={state.gmail_ok} /> Gmail für die Berichte</li>
          {SECRETS.map(([n, l]) => <li key={n} className="flex items-center gap-3"><Check ok={!!secrets?.includes(n)} /> {l} <span className="text-[12px]" style={{ color: 'var(--muted)' }}>({n})</span></li>)}
        </ul>
        <div className="mt-4"><Button kind="quiet" onClick={onSetup}>Einrichtung öffnen</Button></div>
      </Card>
      {fehlt && (
        <Card title="Noch nötig: Zugriff für Bilder">
          <p className="mb-3 text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>Instagram holt Bilder von einer öffentlichen Adresse. Dafür legt die Automatik sie kurz im öffentlichen Repository <b>vamela-insta-media</b> ab und braucht dazu einen eigenen, eng begrenzten GitHub-Zugriff: <Link href="https://github.com/settings/personal-access-tokens/new">Neues Token anlegen</Link>, Name „vamela-insta-media“, Repository access: „Only select repositories“ und dort nur <b>vamela-insta-media</b>, Berechtigung „Contents: Read and write“, Ablauf ein Jahr. Das Token unten einfügen.</p>
          <div className="mb-4 rounded-lg p-4" style={{ border: '1px solid var(--line)' }}>
            <div className="mb-1 font-medium">Einfachster Weg für den Start</div>
            <p className="mb-3 text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>Nutzt den GitHub-Zugang, mit dem diese App schon angemeldet ist. Er gilt für alle deine Repositories und liegt nur als Secret im privaten Repository. Später kannst du ihn unten durch ein enges Token ersetzen.</p>
            <Button onClick={async () => { try { await api.mediaTokenAusGithub(); setMsg({ tone: 'ok', text: 'Eingerichtet.' }); laden() } catch (e) { setMsg({ tone: 'err', text: errorText(e) }) } }}>Mit meinem GitHub-Zugang einrichten</Button>
          </div>
          <Field label="Oder: enges GitHub-Token einfügen" value={token} onChange={setToken} secret placeholder="github_pat_…" />
          <div className="mt-3"><Button disabled={token.trim().length < 20} onClick={sichern}>Speichern</Button></div>
          {msg && <div className="mt-3"><Note tone={msg.tone}>{msg.text}</Note></div>}
        </Card>
      )}
    </div>
  )
}
