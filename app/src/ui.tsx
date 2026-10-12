import type { ReactNode } from 'react'

export function Button({
  children,
  onClick,
  busy,
  disabled,
  kind = 'primary',
}: {
  children: ReactNode
  onClick?: () => void
  busy?: boolean
  disabled?: boolean
  kind?: 'primary' | 'quiet'
}) {
  const base = 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[14px] font-medium transition-opacity disabled:opacity-45'
  const style =
    kind === 'primary'
      ? { background: 'var(--accent)', color: 'var(--accent-text)' }
      : { background: 'transparent', color: 'var(--accent)', border: '1px solid var(--line)' }
  return (
    <button className={base} style={style} onClick={onClick} disabled={disabled || busy}>
      {busy && <Spinner />}
      {children}
    </button>
  )
}

export function BigButton({ children, onClick, busy, disabled }: { children: ReactNode; onClick: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <button
      className="inline-flex items-center gap-3 rounded-xl px-6 py-3.5 text-[15px] font-semibold shadow-sm transition-opacity disabled:opacity-45"
      style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
      onClick={onClick}
      disabled={disabled || busy}
    >
      {busy && <Spinner />}
      {children}
    </button>
  )
}

export function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
}

export function Check({ ok, size = 20 }: { ok: boolean; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: ok ? 'var(--ok)' : 'transparent',
        border: ok ? 'none' : '1.5px solid var(--line)',
      }}
    >
      {ok && (
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 12 12" fill="none">
          <path d="M2 6.5 5 9l5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

export function Field({
  label,
  value,
  onChange,
  secret,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  secret?: boolean
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px]" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <input
        type={secret ? 'password' : 'text'}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-[14px] outline-none focus:ring-2"
        style={{ background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)' }}
      />
    </label>
  )
}

export function Note({ tone = 'muted', children }: { tone?: 'muted' | 'ok' | 'err' | 'warn'; children: ReactNode }) {
  return (
    <p className="text-[13px] leading-relaxed" style={{ color: `var(--${tone === 'muted' ? 'muted' : tone})` }}>
      {children}
    </p>
  )
}

export function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        import('./api').then(({ api }) => api.openUrl(href))
      }}
      className="underline underline-offset-2"
      style={{ color: 'var(--accent)', cursor: 'pointer' }}
    >
      {children}
    </a>
  )
}
