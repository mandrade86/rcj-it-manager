import { Config } from '../db/models/Config.js'

export const DEFAULT_EHR_BASE = 'https://ehr.rcjcorp.hn:8095'
/** Endpoint real del EHR RCJ (POST JSON UserName + Password). */
export const DEFAULT_EHR_LOGIN_URL = `${DEFAULT_EHR_BASE}/api/Login`

const LEGACY_WRONG_LOGIN_URLS = new Set([
  `${DEFAULT_EHR_BASE}/api/Auth/login`,
  `${DEFAULT_EHR_BASE}/api/Auth/Login`,
  `${DEFAULT_EHR_BASE}/api/auth/login`,
])

export const EHR_CONFIG_KEYS = {
  loginUrl: 'ehr_auth_login_url',
  username: 'ehr_username',
  password: 'ehr_password',
  accessToken: 'ehr_access_token',
  tokenExpiresAt: 'ehr_token_expires_at',
} as const

export type EhrAuthStatus = {
  loginUrl: string
  username: string
  hasPassword: boolean
  hasToken: boolean
  tokenExpiresAt: string | null
}

async function getConfig(clave: string): Promise<string | null> {
  const row = await Config.findOne({ clave }).lean<{ valor?: string | null } | null>()
  const v = row?.valor?.trim()
  return v || null
}

/** Corrige URL de login guardada con ruta obsoleta (/api/Auth/login → 404). */
export async function normalizeEhrLoginUrl(): Promise<void> {
  const stored = await getConfig(EHR_CONFIG_KEYS.loginUrl)
  if (stored && LEGACY_WRONG_LOGIN_URLS.has(stored)) {
    await setConfig(EHR_CONFIG_KEYS.loginUrl, DEFAULT_EHR_LOGIN_URL)
  }
}

async function resolveEhrLoginUrl(): Promise<string> {
  await normalizeEhrLoginUrl()
  return (
    process.env.EHR_LOGIN_URL?.trim() ||
    (await getConfig(EHR_CONFIG_KEYS.loginUrl)) ||
    DEFAULT_EHR_LOGIN_URL
  )
}

async function setConfig(clave: string, valor: string): Promise<void> {
  await Config.findOneAndUpdate({ clave }, { valor }, { upsert: true, new: true })
}

export async function getEhrAuthStatus(): Promise<EhrAuthStatus> {
  const loginUrl = await resolveEhrLoginUrl()
  const username =
    process.env.EHR_USERNAME?.trim() || (await getConfig(EHR_CONFIG_KEYS.username)) || ''
  const hasPassword = Boolean(
    process.env.EHR_PASSWORD?.trim() || (await getConfig(EHR_CONFIG_KEYS.password)),
  )
  const token = await getConfig(EHR_CONFIG_KEYS.accessToken)
  const expiresRaw = await getConfig(EHR_CONFIG_KEYS.tokenExpiresAt)
  const hasToken = Boolean(token && isTokenStillValid(expiresRaw))
  return {
    loginUrl,
    username,
    hasPassword,
    hasToken,
    tokenExpiresAt: expiresRaw,
  }
}

function isTokenStillValid(expiresRaw: string | null): boolean {
  if (!expiresRaw) return true
  const t = Date.parse(expiresRaw)
  if (Number.isNaN(t)) return true
  return t > Date.now() + 60_000
}

export async function saveEhrAuthConfig(input: {
  loginUrl?: string
  username?: string
  password?: string
}): Promise<void> {
  if (input.loginUrl !== undefined) {
    await setConfig(EHR_CONFIG_KEYS.loginUrl, input.loginUrl.trim())
  }
  if (input.username !== undefined) {
    await setConfig(EHR_CONFIG_KEYS.username, input.username.trim())
  }
  if (input.password !== undefined && input.password.length > 0) {
    await setConfig(EHR_CONFIG_KEYS.password, input.password)
    await clearEhrToken()
  }
}

export async function clearEhrToken(): Promise<void> {
  await Config.deleteMany({
    clave: { $in: [EHR_CONFIG_KEYS.accessToken, EHR_CONFIG_KEYS.tokenExpiresAt] },
  })
}

function extractTokenFromJson(json: unknown): { token: string; expiresInSec?: number } | null {
  if (!json || typeof json !== 'object') return null
  const root = json as Record<string, unknown>
  const nested =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root.result && typeof root.result === 'object'
        ? (root.result as Record<string, unknown>)
        : null

  const pick = (o: Record<string, unknown>): string | null => {
    for (const k of [
      'token',
      'access_token',
      'accessToken',
      'bearerToken',
      'jwt',
      'Token',
    ]) {
      const v = o[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
    return null
  }

  const token = pick(root) ?? (nested ? pick(nested) : null)
  if (!token) return null

  let expiresInSec: number | undefined
  const expRaw =
    root.expires_in ?? root.expiresIn ?? nested?.expires_in ?? nested?.expiresIn
  if (typeof expRaw === 'number' && expRaw > 0) expiresInSec = expRaw
  if (typeof expRaw === 'string' && /^\d+$/.test(expRaw)) expiresInSec = Number(expRaw)

  return { token, expiresInSec }
}

async function persistToken(token: string, expiresInSec?: number): Promise<void> {
  await setConfig(EHR_CONFIG_KEYS.accessToken, token)
  if (expiresInSec && expiresInSec > 0) {
    const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString()
    await setConfig(EHR_CONFIG_KEYS.tokenExpiresAt, expiresAt)
  } else {
    await Config.deleteOne({ clave: EHR_CONFIG_KEYS.tokenExpiresAt })
  }
}

async function tryLoginRequest(
  url: string,
  init: RequestInit,
): Promise<{ token: string; expiresInSec?: number } | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 25_000)
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal })
    const text = await r.text()
    let json: unknown = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    if (!r.ok) {
      const msg = parseEhrErrorBody(json, text, r.status)
      throw new Error(msg)
    }
    const hit = extractTokenFromJson(json)
    if (hit) return hit
    const plain = text?.trim().replace(/^"|"$/g, '')
    if (plain && /^eyJ[\w-]*\.[\w-]*\.[\w-]*$/.test(plain)) {
      return { token: plain }
    }
    if (plain && plain.length > 20 && !plain.startsWith('{')) {
      return { token: plain }
    }
    throw new Error('La respuesta de login no incluyó un token reconocible.')
  } finally {
    clearTimeout(t)
  }
}

/**
 * Obtiene token del EHR (cache en Config o login con usuario/contraseña).
 */
export async function loginEhr(force = false): Promise<string> {
  const cached = await getConfig(EHR_CONFIG_KEYS.accessToken)
  const expiresRaw = await getConfig(EHR_CONFIG_KEYS.tokenExpiresAt)
  if (!force && cached && isTokenStillValid(expiresRaw)) {
    return cached
  }

  const loginUrl = await resolveEhrLoginUrl()
  const username =
    process.env.EHR_USERNAME?.trim() || (await getConfig(EHR_CONFIG_KEYS.username))
  const password =
    process.env.EHR_PASSWORD?.trim() || (await getConfig(EHR_CONFIG_KEYS.password))

  if (!username || !password) {
    throw new Error(
      'Configura usuario y contraseña del EHR (Maestros → Empleados → Servicio externo) antes de sincronizar.',
    )
  }

  const isTokenEndpoint = /\/token\/?$/i.test(loginUrl)

  const attempts: Array<{ label: string; run: () => Promise<{ token: string; expiresInSec?: number }> }> =
    []

  if (isTokenEndpoint) {
    const body = new URLSearchParams({
      grant_type: 'password',
      username,
      password,
    })
    attempts.push({
      label: 'OAuth /Token',
      run: () =>
        tryLoginRequest(loginUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        }),
    })
  } else {
    const jsonBodies: Record<string, unknown>[] = [
      { UserName: username, Password: password },
      { userName: username, password },
      { username, password },
    ]
    for (const payload of jsonBodies) {
      attempts.push({
        label: JSON.stringify(payload).slice(0, 40),
        run: () =>
          tryLoginRequest(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload),
          }),
      })
    }
  }

  let lastErr: Error | null = null
  for (const att of attempts) {
    try {
      const hit = await att.run()
      await persistToken(hit.token, hit.expiresInSec)
      return hit.token
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }

  throw new Error(
    lastErr?.message ??
      'No se pudo iniciar sesión en el EHR. Verifica URL de login, usuario y contraseña.',
  )
}

async function ensureEhrToken(): Promise<string> {
  return loginEhr(false)
}

/**
 * GET/POST al EHR con Authorization Bearer. Reintenta login si responde 401.
 */
export async function fetchEhr(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const doFetch = async (token: string) => {
    const headers = new Headers(init.headers)
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json')
    }
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 30_000)
    try {
      return await fetch(url, { ...init, headers, signal: ctrl.signal })
    } finally {
      clearTimeout(t)
    }
  }

  let token = await ensureEhrToken()
  let r = await doFetch(token)
  if (r.status === 401) {
    await clearEhrToken()
    token = await loginEhr(true)
    r = await doFetch(token)
  }
  return r
}

export async function fetchEhrJson(url: string, init?: RequestInit): Promise<unknown> {
  const r = await fetchEhr(url, init)
  if (!r.ok) {
    throw new Error(`El servicio respondió con ${r.status}`)
  }
  return r.json() as Promise<unknown>
}
