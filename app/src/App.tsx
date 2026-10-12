import { useCallback, useEffect, useState } from 'react'
import { api, type SetupState } from './api'
import Setup from './views/Setup'
import { Auswertung, Beitraege, Berichte, Einstellungen, Kalender, Lernen, Material, Protokoll, Uebersicht } from './views/Bereiche'

// Untertitel je Ansicht; das letzte Wort steht als kursives Akzentwort wie auf den Covern
const UNTER: Record<string, string> = {
  Übersicht: 'Was läuft, was als Nächstes kommt.',
  Kalender: 'Die nächsten Wochen auf einen Blick.',
  Beiträge: 'Jeder Beitrag mit Prüfung und Status.',
  Auswertung: 'Follower, Reichweite, was wirkt.',
  Lernen: 'Was der Optimierer gelernt hat.',
  Material: 'Bilder und Vorlagen für die Automatik.',
  Berichte: 'Die Wochenberichte zum Nachlesen.',
  Protokoll: 'Jeder Lauf, jede Meldung.',
  Einstellungen: 'Zugänge, Pause, Feinheiten.',
}

const AREAS = ['Übersicht', 'Kalender', 'Beiträge', 'Auswertung', 'Lernen', 'Material', 'Berichte', 'Protokoll', 'Einstellungen']

export default function App() {
  const [state, setState] = useState<SetupState | null>(null)
  const [area, setArea] = useState('Übersicht')
  const [reopenSetup, setReopenSetup] = useState(false)

  const refresh = useCallback(() => {
    api.state().then(setState)
  }, [])
  useEffect(refresh, [refresh])
  // Tastenkürzel ⌘1 bis ⌘9 wechseln die Ansicht
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.metaKey && /^[1-9]$/.test(e.key)) { setArea(AREAS[+e.key - 1]); e.preventDefault() }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  if (!state) return null
  if (!state.finished || reopenSetup) {
    return <Setup state={state} refresh={refresh} onFinished={() => setReopenSetup(false)} />
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-[232px] shrink-0 flex-col px-4 pb-6 pt-14" style={{ background: 'var(--side)', borderRight: '1px solid var(--line)', backdropFilter: 'blur(20px)' }} data-tauri-drag-region>
        <div className="mb-7 flex items-center gap-2.5 px-3" data-tauri-drag-region>
          <img src="/logo.png" alt="VAMELA" className="h-[18px] w-auto" />
          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: 'rgba(255,91,20,.16)', color: 'var(--o2)', boxShadow: 'inset 0 0 0 1px rgba(255,122,51,.4)' }}>Insta</span>
        </div>
        <nav className="flex flex-col gap-1">
          {AREAS.map((a, i) => (
            <button
              key={a}
              onClick={() => setArea(a)}
              className={`flex items-center justify-between rounded-full px-4 py-2.5 text-left text-[14px] transition ${area === a ? 'nav-aktiv' : 'hover:bg-white/5'}`}
              style={{ fontWeight: area === a ? 600 : 400, color: area === a ? '#fff' : '#c9c9c9' }}
            >
              {a}
              <span className="text-[11px]" style={{ color: area === a ? 'var(--o2)' : '#6f6f6f' }}>
                ⌘{i + 1}
              </span>
            </button>
          ))}
        </nav>
        <div className="mt-auto px-3 text-[12px] leading-relaxed" style={{ color: '#6f6f6f' }}>@vamela.de<br />Webdesign &amp; Grafik</div>
      </aside>
      <main className="flex-1 overflow-y-auto px-12 pb-12 pt-14" data-tauri-drag-region>
        <header className="mb-8" data-tauri-drag-region>
          <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.03em]">{area}<span className="verlauf">.</span></h1>
          <p className="mt-2 text-[15px]" style={{ color: 'var(--muted)' }}>
            {UNTER[area].split(' ').slice(0, -1).join(' ')} <span className="ser text-[19px] text-white">{UNTER[area].split(' ').slice(-1)}</span>
          </p>
        </header>
        {area === 'Übersicht' && <Uebersicht />}
        {area === 'Kalender' && <Kalender />}
        {area === 'Beiträge' && <Beitraege />}
        {area === 'Auswertung' && <Auswertung />}
        {area === 'Lernen' && <Lernen />}
        {area === 'Material' && <Material state={state} />}
        {area === 'Berichte' && <Berichte />}
        {area === 'Protokoll' && <Protokoll />}
        {area === 'Einstellungen' && <Einstellungen state={state} onSetup={() => setReopenSetup(true)} />}
      </main>
    </div>
  )
}
