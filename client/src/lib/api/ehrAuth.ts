export type EhrAuthStatus = {
  loginUrl: string
  username: string
  hasPassword: boolean
  hasToken: boolean
  tokenExpiresAt: string | null
}

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchEhrAuth(): Promise<EhrAuthStatus> {
  const res = await fetch('/api/ehr/auth')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EhrAuthStatus>
}

export async function saveEhrAuth(body: {
  loginUrl: string
  username: string
  password?: string
}): Promise<EhrAuthStatus> {
  const res = await fetch('/api/ehr/auth', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EhrAuthStatus>
}

export async function loginEhrApi(body?: {
  loginUrl?: string
  username?: string
  password?: string
}): Promise<EhrAuthStatus & { ok: boolean; message?: string }> {
  const res = await fetch('/api/ehr/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EhrAuthStatus & { ok: boolean; message?: string }>
}

export async function logoutEhrApi(): Promise<void> {
  const res = await fetch('/api/ehr/auth/logout', { method: 'POST' })
  if (!res.ok) throw new Error(await parseError(res))
}
