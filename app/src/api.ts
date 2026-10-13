import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import { vorschau, IST_VORSCHAU } from './vorschau'

// Im Browser (npm run dev ohne Tauri) liefert vorschau.ts Beispieldaten, damit sich die Oberfläche prüfen lässt.
const invoke = <T,>(cmd: string, args?: Record<string, unknown>): Promise<T> => (IST_VORSCHAU ? vorschau<T>(cmd, args) : tauriInvoke<T>(cmd, args))
import { listen as tauriListen } from '@tauri-apps/api/event'

export type SetupState = {
  github_login: string | null
  repos_ok: boolean
  claude_ok: boolean
  drive_folder: string | null
  instagram_username: string | null
  gmail_ok: boolean
  tiktok_keys: boolean
  tiktok_ok: boolean
  finished: boolean
}

export type Done = { ok: boolean; detail: string }
export type Check = { name: string; ok: boolean; detail: string }

export const api = {
  state: () => invoke<SetupState>('get_state'),
  openUrl: (url: string) => invoke('open_url', { url }),
  githubLogin: () => invoke('github_login'),
  githubRepos: () => invoke<string[]>('github_repos'),
  claudeSetup: () => invoke('claude_setup'),
  claudeSend: (text: string) => invoke('claude_send', { text }),
  claudeManual: (token: string) => invoke('claude_manual', { token }),
  driveConnect: () => invoke('drive_connect'),
  driveFolders: () => invoke<string[]>('drive_folders'),
  driveSetup: (folder: string) => invoke<string[]>('drive_setup', { folder }),
  instagramSave: (token: string) => invoke<string>('instagram_save', { token }),
  tiktokSave: (clientKey: string, clientSecret: string) => invoke('tiktok_save', { clientKey, clientSecret }),
  tiktokAnmelden: () => invoke('tiktok_anmelden'),
  tiktokCode: (code: string) => invoke<string>('tiktok_code', { code }),
  gmailSave: (password: string) => invoke('gmail_save', { password }),
  finalCheck: () => invoke<Check[]>('final_check'),
  repoDatei: (pfad: string) => invoke<string>('repo_datei', { pfad }),
  repoBild: (pfad: string) => invoke<string>('repo_bild', { pfad }),
  laeufe: () => invoke<string>('actions_laeufe'),
  pauseStatus: () => invoke<boolean>('pause_status'),
  pauseSetzen: (an: boolean) => invoke('pause_setzen', { an }),
  workflowStarten: (datei: string, trocken?: boolean) => invoke('workflow_starten', { datei, trocken }),
  secretsListe: () => invoke<string[]>('secrets_liste'),
  secretSetzen: (name: string, wert: string) => invoke('secret_setzen', { name, wert }),
  mediaTokenAusGithub: () => invoke('media_token_aus_github'),
  fotosHochladen: (quelle?: string) => invoke<string>('fotos_hochladen', { quelle }),
  fotosZaehlen: () => invoke<number>('fotos_zaehlen'),
  logLesen: (zeilen: number) => invoke<string>('log_lesen', { zeilen }),
}

/** Hört auf ein Ereignis aus dem Rust-Teil und gibt die Abmeldung zurück. */
export function on<T>(event: string, fn: (payload: T) => void): () => void {
  let stop: (() => void) | undefined
  let cancelled = false
  if (IST_VORSCHAU) return () => {}
  tauriListen<T>(event, (e) => fn(e.payload)).then((u) => {
    if (cancelled) u()
    else stop = u
  })
  return () => {
    cancelled = true
    stop?.()
  }
}

export function errorText(e: unknown): string {
  return typeof e === 'string' ? e : e instanceof Error ? e.message : JSON.stringify(e)
}
