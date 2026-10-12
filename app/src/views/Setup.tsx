import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api, errorText, on, type Check as CheckResult, type Done, type SetupState } from '../api'
import { BigButton, Button, Check, Field, Link, Note } from '../ui'

type StepId = 'github' | 'claude' | 'drive' | 'instagram' | 'gmail' | 'check'

const STEPS: { id: StepId; title: string; short: string }[] = [
  { id: 'github', title: 'GitHub verbinden', short: 'GitHub' },
  { id: 'claude', title: 'Claude-Abo verbinden', short: 'Claude-Abo' },
  { id: 'drive', title: 'Google Drive verbinden', short: 'Google Drive' },
  { id: 'instagram', title: 'Instagram verbinden', short: 'Instagram' },
  { id: 'gmail', title: 'Gmail für die Berichte', short: 'Gmail' },
  { id: 'check', title: 'Abschlusstest', short: 'Abschlusstest' },
]

function isDone(id: StepId, s: SetupState): boolean {
  switch (id) {
    case 'github':
      return !!s.github_login && s.repos_ok
    case 'claude':
      return s.claude_ok
    case 'drive':
      return !!s.drive_folder
    case 'instagram':
      return !!s.instagram_username
    case 'gmail':
      return s.gmail_ok
    case 'check':
      return s.finished
  }
}

export default function Setup({ state, refresh, onFinished }: { state: SetupState; refresh: () => void; onFinished: () => void }) {
  const firstOpen = STEPS.find((s) => !isDone(s.id, state))?.id ?? 'check'
  const [active, setActive] = useState<StepId>(firstOpen)

  const advance = () => {
    refresh()
    const idx = STEPS.findIndex((s) => s.id === active)
    setActive(STEPS[Math.min(idx + 1, STEPS.length - 1)].id)
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-[260px] shrink-0 flex-col px-4 pb-6 pt-14" style={{ background: 'var(--side)', borderRight: '1px solid var(--line)' }} data-tauri-drag-region>
        <h1 className="mb-1 px-2 text-[17px] font-semibold">Einrichtung</h1>
        <p className="mb-5 px-2 text-[13px]" style={{ color: 'var(--muted)' }}>
          Sechs Schritte. Danach läuft alles ohne Terminal.
        </p>
        <nav className="flex flex-col gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-left text-[14px]"
              style={{ background: active === s.id ? 'var(--panel)' : 'transparent', fontWeight: active === s.id ? 600 : 400 }}
            >
              <Check ok={isDone(s.id, state)} />
              <span>
                <span style={{ color: 'var(--muted)' }}>{i + 1}. </span>
                {s.short}
              </span>
            </button>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto px-12 pb-12 pt-14" data-tauri-drag-region>
        <div className="max-w-[640px]">
          {active === 'github' && <GitHubStep state={state} onDone={advance} />}
          {active === 'claude' && <ClaudeStep state={state} onDone={advance} />}
          {active === 'drive' && <DriveStep state={state} onDone={advance} />}
          {active === 'instagram' && <InstagramStep state={state} onDone={advance} />}
          {active === 'gmail' && <GmailStep state={state} onDone={advance} />}
          {active === 'check' && <CheckStep onFinished={() => { refresh(); onFinished() }} />}
        </div>
      </main>
    </div>
  )
}

function StepShell({ title, intro, children, done }: { title: string; intro: ReactNode; children: ReactNode; done?: boolean }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-3">
        <h2 className="text-[24px] font-semibold tracking-tight">{title}</h2>
        {done && <Check ok size={22} />}
      </div>
      <div className="mb-6 text-[14px] leading-relaxed" style={{ color: 'var(--muted)' }}>
        {intro}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function useEvent<T>(name: string, fn: (p: T) => void) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => on<T>(name, (p) => ref.current(p)), [name])
}

// ---------- 1 GitHub ----------

function GitHubStep({ state, onDone }: { state: SetupState; onDone: () => void }) {
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err' | 'muted'; text: string } | null>(null)
  const [repos, setRepos] = useState<string[]>([])

  const createRepos = async () => {
    setBusy(true)
    try {
      setRepos(await api.githubRepos())
      setMsg({ tone: 'ok', text: 'Beide Repositories sind bereit.' })
      onDone()
    } catch (e) {
      setMsg({ tone: 'err', text: errorText(e) })
    } finally {
      setBusy(false)
    }
  }

  useEvent<string>('github:code', setCode)
  useEvent<Done>('github:done', (d) => {
    setBusy(false)
    if (d.ok) {
      setMsg({ tone: 'ok', text: `Angemeldet als ${d.detail}.` })
      void createRepos()
    } else setMsg({ tone: 'err', text: d.detail })
  })

  return (
    <StepShell
      title="GitHub verbinden"
      done={!!state.github_login && state.repos_ok}
      intro="Auf GitHub laufen später Veröffentlichung und Auswertung, auch wenn dein Mac aus ist. Die App legt dort zwei Repositories an: vamela-insta (privat) und vamela-insta-media (öffentlich, nur für fertige Bilder und Videos)."
    >
      {state.github_login && (
        <Note tone="ok">
          Angemeldet als {state.github_login}
          {state.repos_ok ? ', Repositories vorhanden.' : '.'}
        </Note>
      )}
      <div>
        <BigButton
          busy={busy}
          onClick={() => {
            setBusy(true)
            setMsg(null)
            setCode(null)
            void api.githubLogin()
          }}
        >
          {state.github_login ? 'Erneut anmelden' : 'Bei GitHub anmelden'}
        </BigButton>
      </div>
      {code && (
        <div className="rounded-xl p-5" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <p className="mb-2 text-[13px]" style={{ color: 'var(--muted)' }}>
            Der Browser hat sich geöffnet. Gib dort diesen Code ein (er liegt auch in der Zwischenablage):
          </p>
          <p className="font-mono text-[32px] font-semibold tracking-[0.15em]" style={{ userSelect: 'text' }}>
            {code}
          </p>
          <p className="mt-2 text-[13px]" style={{ color: 'var(--muted)' }}>
            Kein Fenster? <Link href="https://github.com/login/device">github.com/login/device</Link>
          </p>
        </div>
      )}
      {state.github_login && !state.repos_ok && !busy && <Button onClick={createRepos}>Repositories anlegen</Button>}
      {repos.map((r) => (
        <Note key={r} tone="ok">
          {r}
        </Note>
      ))}
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
    </StepShell>
  )
}

// ---------- 2 Claude ----------

function ClaudeStep({ state, onDone }: { state: SetupState; onDone: () => void }) {
  const [running, setRunning] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [manual, setManual] = useState('')
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err' | 'muted'; text: string } | null>(null)

  useEvent<string>('claude:url', setUrl)
  useEvent<Done>('claude:done', (d) => {
    setRunning(false)
    if (d.ok) {
      setMsg({ tone: 'ok', text: 'Claude-Abo verbunden. Der Token liegt im Schlüsselbund und als Secret im Repository.' })
      onDone()
    } else setMsg({ tone: 'err', text: d.detail })
  })

  const start = async () => {
    setRunning(true)
    setMsg(null)
    setUrl(null)
    try {
      await api.claudeSetup()
    } catch (e) {
      setRunning(false)
      setMsg({ tone: 'err', text: errorText(e) })
    }
  }

  return (
    <StepShell
      title="Claude-Abo verbinden"
      done={state.claude_ok}
      intro="Die Denk-Läufe (Planen, Prüfen, Auswerten) laufen mit deinem bestehenden Claude-Abo. Es gibt keinen Schlüssel mit Abrechnung pro Nutzung, deshalb entstehen keine Zusatzkosten."
    >
      <div>
        <BigButton busy={running} onClick={start}>
          {state.claude_ok ? 'Erneut verbinden' : 'Claude-Abo verbinden'}
        </BigButton>
      </div>
      {running && (
        <div className="rounded-xl p-5" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <p className="mb-3 text-[13px]" style={{ color: 'var(--muted)' }}>
            Melde dich im Browser an. Zeigt die Seite am Ende einen Code, füge ihn hier ein.
          </p>
          {url && (
            <p className="mb-3 text-[13px]">
              Browser nicht offen? <Link href={url}>Anmeldeseite öffnen</Link>
            </p>
          )}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Field label="Code aus dem Browser (falls verlangt)" value={code} onChange={setCode} />
            </div>
            <Button
              kind="quiet"
              disabled={!code.trim()}
              onClick={() => {
                void api.claudeSend(code.trim())
                setCode('')
              }}
            >
              Senden
            </Button>
          </div>
        </div>
      )}
      <details className="text-[13px]" style={{ color: 'var(--muted)' }}>
        <summary style={{ cursor: 'pointer' }}>Token selbst einfügen</summary>
        <div className="mt-3 flex items-end gap-3">
          <div className="flex-1">
            <Field label="Token (beginnt mit sk-ant-oat)" value={manual} onChange={setManual} secret />
          </div>
          <Button
            kind="quiet"
            disabled={!manual.trim()}
            onClick={async () => {
              try {
                await api.claudeManual(manual)
                setManual('')
                setMsg({ tone: 'ok', text: 'Token gespeichert.' })
                onDone()
              } catch (e) {
                setMsg({ tone: 'err', text: errorText(e) })
              }
            }}
          >
            Speichern
          </Button>
        </div>
      </details>
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
    </StepShell>
  )
}

// ---------- 3 Drive ----------

function DriveStep({ state, onDone }: { state: SetupState; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [folders, setFolders] = useState<string[] | null>(null)
  const [choice, setChoice] = useState('VAMELA')
  const [result, setResult] = useState<string[]>([])
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err' | 'muted'; text: string } | null>(null)

  const loadFolders = async () => {
    setMsg({ tone: 'muted', text: 'Lade Ordner aus Google Drive …' })
    try {
      const f = await api.driveFolders()
      setFolders(f)
      setMsg(null)
      if (f.includes('VAMELA')) setChoice('VAMELA')
    } catch (e) {
      const t = errorText(e)
      setMsg(t.includes('Noch nicht angemeldet') ? null : { tone: 'err', text: t })
    }
  }

  // Ist Google schon verbunden, sofort die Ordner zeigen, ohne erneute Anmeldung.
  useEffect(() => {
    void loadFolders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEvent<Done>('drive:done', (d) => {
    setBusy(false)
    if (d.ok) {
      setMsg({ tone: 'ok', text: 'Google Drive verbunden.' })
      void loadFolders()
    } else setMsg({ tone: 'err', text: d.detail })
  })

  useEffect(() => {
    if (state.drive_folder) setChoice(state.drive_folder)
  }, [state.drive_folder])

  const apply = async () => {
    setBusy(true)
    try {
      setResult(await api.driveSetup(choice))
      setMsg({ tone: 'ok', text: `Ordner ${choice} ist bereit.` })
      onDone()
    } catch (e) {
      setMsg({ tone: 'err', text: errorText(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <StepShell
      title="Google Drive verbinden"
      done={!!state.drive_folder}
      intro="Markenordner, Entwürfe, Aufnahmen und Vorlagen liegen (optional) in einem Drive-Ordner. Die App liest daraus und legt fehlende Unterordner an. Sie löscht nichts."
    >
      {state.drive_folder && <Note tone="ok">Ordner: {state.drive_folder}</Note>}
      {folders ? (
        <Note tone="ok">Google ist verbunden. Wähle unten den Ordner.</Note>
      ) : (
        <div>
          <BigButton
            busy={busy}
            onClick={() => {
              setBusy(true)
              setMsg(null)
              void api.driveConnect()
            }}
          >
            Mit Google anmelden
          </BigButton>
        </div>
      )}
      {!folders && <Button kind="quiet" onClick={loadFolders}>Ordner aus Drive laden</Button>}
      {folders && (
        <Button
          kind="quiet"
          onClick={() => {
            setFolders(null)
            setBusy(true)
            void api.driveConnect()
          }}
        >
          Anderes Google-Konto verwenden
        </Button>
      )}
      {folders && (
        <div className="rounded-xl p-5" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <p className="mb-3 text-[13px]" style={{ color: 'var(--muted)' }}>
            Welcher Ordner soll es sein? Gibt es ihn nicht, wird er angelegt.
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {[...new Set(['VAMELA', ...folders])].map((f) => (
              <button
                key={f}
                onClick={() => setChoice(f)}
                className="rounded-lg px-3 py-1.5 text-[13px]"
                style={{
                  background: choice === f ? 'var(--accent)' : 'transparent',
                  color: choice === f ? 'var(--accent-text)' : 'var(--text)',
                  border: '1px solid var(--line)',
                }}
              >
                {f}
                {!folders.includes(f) ? ' (neu)' : ''}
              </button>
            ))}
          </div>
          <Button busy={busy} onClick={apply}>
            Ordner „{choice}“ einrichten
          </Button>
        </div>
      )}
      {result.length > 0 && (
        <ul className="text-[13px]" style={{ color: 'var(--muted)' }}>
          {result.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
    </StepShell>
  )
}

// ---------- 4 Instagram ----------

const IG_STEPS: ReactNode[] = [
  <>
    Öffne <Link href="https://developers.facebook.com/apps/">developers.facebook.com/apps</Link> und melde dich mit deinem Facebook-Konto an. Beim ersten Mal legst du dort ein Entwicklerkonto an (kostenlos).
  </>,
  <>
    Klicke auf <b>App erstellen</b>. Anwendungsfall: <b>Andere</b>, Typ: <b>Business</b>. Name: „VAMELA Insta“.
  </>,
  <>
    In der App: <b>Produkt hinzufügen</b> → <b>Instagram</b> → <b>API-Einrichtung mit Instagram-Anmeldung</b>.
  </>,
  <>
    Unter <b>App-Rollen → Rollen</b> das Instagram-Konto <b>@vamela.de</b> als <b>Instagram-Tester</b> hinzufügen. Danach nimmst du die Einladung in Instagram unter <b>Einstellungen → Websites und Apps → Tester-Einladungen</b> an.
  </>,
  <>
    Zurück bei <b>API-Einrichtung</b>: Bei „Zugriffstoken generieren“ das Konto <b>@vamela.de</b> wählen, anmelden, Berechtigungen erlauben (Inhalte veröffentlichen und Einblicke lesen). Den angezeigten Token kopieren und unten einfügen.
  </>,
]

function InstagramStep({ state, onDone }: { state: SetupState; onDone: () => void }) {
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err' | 'muted'; text: string } | null>(null)

  const save = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const name = await api.instagramSave(token)
      setToken('')
      setMsg({ tone: 'ok', text: `${name} verbunden.` })
      onDone()
    } catch (e) {
      setMsg({ tone: 'err', text: errorText(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <StepShell
      title="Instagram verbinden"
      done={!!state.instagram_username}
      intro="Damit die Automatik veröffentlichen und auswerten darf, braucht sie eine kostenlose Meta-Entwickler-App. Das dauert etwa zehn Minuten und ist einmalig."
    >
      {state.instagram_username && <Note tone="ok">Verbunden mit @{state.instagram_username}</Note>}
      <ol className="flex flex-col gap-3">
        {IG_STEPS.map((s, i) => (
          <li key={i} className="flex gap-3 text-[14px] leading-relaxed">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold" style={{ background: 'var(--line)' }}>
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <Note>Nur mit Tester-Rolle darf die App im Entwicklungsmodus auf das Konto @vamela.de zugreifen. Eine App-Prüfung durch Meta ist dafür nicht nötig.</Note>
      <Field label="Zugriffstoken von Instagram" value={token} onChange={setToken} secret placeholder="IGAA…" />
      <div>
        <BigButton busy={busy} disabled={token.trim().length < 20} onClick={save}>
          Token prüfen und speichern
        </BigButton>
      </div>
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
    </StepShell>
  )
}

// ---------- 5 Gmail ----------

function GmailStep({ state, onDone }: { state: SetupState; onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err' | 'muted'; text: string } | null>(null)

  return (
    <StepShell
      title="Gmail für die Berichte"
      done={state.gmail_ok}
      intro={
        <>
          Jeden Montag kommt ein kurzer Bericht an stockmeier.ch@gmail.com. Dafür braucht die Automatik ein App-Passwort, nicht dein normales Passwort. Erstellen unter{' '}
          <Link href="https://myaccount.google.com/apppasswords">myaccount.google.com/apppasswords</Link> (Name: „VAMELA Insta“). Google zeigt 16 Buchstaben.
        </>
      }
    >
      <Field label="App-Passwort (16 Zeichen)" value={pw} onChange={setPw} secret placeholder="abcd efgh ijkl mnop" />
      <div>
        <BigButton
          busy={busy}
          disabled={pw.replace(/\s/g, '').length !== 16}
          onClick={async () => {
            setBusy(true)
            setMsg(null)
            try {
              await api.gmailSave(pw)
              setPw('')
              setMsg({ tone: 'ok', text: 'Testmail gesendet. Schau in dein Postfach.' })
              onDone()
            } catch (e) {
              setMsg({ tone: 'err', text: errorText(e) })
            } finally {
              setBusy(false)
            }
          }}
        >
          Speichern und Testmail senden
        </BigButton>
      </div>
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
    </StepShell>
  )
}

// ---------- 6 Abschlusstest ----------

function CheckStep({ onFinished }: { onFinished: () => void }) {
  const [busy, setBusy] = useState(false)
  const [checks, setChecks] = useState<CheckResult[] | null>(null)

  const run = async () => {
    setBusy(true)
    try {
      setChecks(await api.finalCheck())
    } finally {
      setBusy(false)
    }
  }
  const allOk = !!checks && checks.every((c) => c.ok)

  return (
    <StepShell title="Abschlusstest" intro="Die App prüft jetzt alle Verbindungen, nur lesend. Es wird nichts veröffentlicht und nichts gelöscht." done={allOk}>
      <div>
        <BigButton busy={busy} onClick={run}>
          Alle Verbindungen prüfen
        </BigButton>
      </div>
      {checks && (
        <ul className="overflow-hidden rounded-xl" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
          {checks.map((c, i) => (
            <li key={c.name} className="flex items-start gap-3 px-4 py-3" style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <Check ok={c.ok} />
              <div>
                <div className="text-[14px] font-medium">{c.name}</div>
                <div className="text-[13px]" style={{ color: c.ok ? 'var(--muted)' : 'var(--err)' }}>
                  {c.detail}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {allOk && (
        <div>
          <BigButton onClick={onFinished}>Weiter zur Übersicht</BigButton>
        </div>
      )}
    </StepShell>
  )
}
