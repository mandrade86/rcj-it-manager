import type { AuthUser } from '@/store/authStore'

async function parseError(res: Response): Promise<string> {
  try { const j = (await res.json()) as { error?: string }; return j.error ?? res.statusText }
  catch { return res.statusText }
}

export type AuthLoginConfig = {
  activeDirectory: boolean
  providerLabel: string
  usernameHint: string
  localFallback: boolean
  emailDomains: string[]
}

export async function fetchAuthLoginConfig(): Promise<AuthLoginConfig> {
  const res = await fetch('/api/auth/config')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<AuthLoginConfig>
}

export async function loginApi(usuario: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, password }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ token: string; user: AuthUser }>
}

export async function getMeApi(): Promise<AuthUser> {
  const res = await fetch('/api/auth/me')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<AuthUser>
}

/** Devuelve los datos planos del usuario (shape compatible con AuthUser). */
export async function getSesionApi(): Promise<AuthUser> {
  const res = await fetch('/api/auth/sesion')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<AuthUser>
}

export async function cambiarPasswordApi(password_actual: string, password_nuevo: string): Promise<void> {
  const res = await fetch('/api/auth/cambiar-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password_actual, password_nuevo }),
  })
  if (!res.ok) throw new Error(await parseError(res))
}
