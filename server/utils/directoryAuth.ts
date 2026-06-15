import { Empleado } from '../db/models/Empleado.js'
import { Usuario } from '../db/models/Usuario.js'
import { authenticateUserViaEhr, isAdLoginEnabled } from './ehrAuth.js'

const USUARIO_POPULATE = [
  { path: 'rol_id', select: 'nombre permisos' },
  { path: 'empleado_id', select: 'codigo nombre' },
  { path: 'departamento_id', select: 'codigo nombre lleva_gastos' },
] as const

export type LoginIdentifier = {
  raw: string
  username: string
  emailCandidates: string[]
}

/** Normaliza usuario de dominio: quita prefijo RCJ\ y parte @ si la escribieron por error. */
export function normalizeDomainLogin(raw: string): string {
  const trimmed = raw.trim().replace(/^(?:RCJ\\|rcj\\)/i, '')
  const at = trimmed.indexOf('@')
  const base = (at >= 0 ? trimmed.slice(0, at) : trimmed).trim().toLowerCase()
  return base
}

export function parseLoginIdentifier(raw: string): LoginIdentifier {
  const trimmed = raw.trim()
  const domains = (process.env.AD_EMAIL_DOMAINS ?? 'rcjcorp.com,grupoc.com')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)

  if (trimmed.includes('@')) {
    const email = trimmed.toLowerCase()
    const username = email.split('@')[0] ?? email
    return { raw: trimmed, username, emailCandidates: [email] }
  }

  const username = trimmed.replace(/^(?:RCJ\\|rcj\\)/i, '')
  const emails = domains.map((d) => `${username.toLowerCase()}@${d}`)
  return {
    raw: trimmed,
    username,
    emailCandidates: emails.length ? emails : [`${username.toLowerCase()}@rcjcorp.com`],
  }
}

export async function findUsuarioByLoginId(loginId: string) {
  const id = parseLoginIdentifier(loginId)
  const loginKeys = [
    ...new Set([
      ...id.emailCandidates,
      id.username.toLowerCase(),
      id.raw.toLowerCase(),
      normalizeDomainLogin(id.raw),
    ]),
  ].filter(Boolean)

  let user = await Usuario.findOne({
    activo: true,
    $or: [{ email: { $in: loginKeys } }, { login_dominio: { $in: loginKeys } }],
  }).populate(USUARIO_POPULATE)
  if (user) return user

  const empleado = await Empleado.findOne({
    activo: true,
    $or: [
      { email: { $in: loginKeys } },
      { codigo: new RegExp(`^${escapeRegex(id.username)}$`, 'i') },
    ],
  }).lean()

  if (!empleado) return null

  return Usuario.findOne({ empleado_id: empleado._id, activo: true }).populate(USUARIO_POPULATE)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const AD_LOGIN_PER_ATTEMPT_MS = 8_000
const AD_LOGIN_MAX_ATTEMPTS = 4

/** Solo detiene reintentos si el EHR indica contraseña incorrecta (no formato de usuario). */
function isDefinitiveAdCredentialFailure(err: Error): boolean {
  return /contraseña|password|credenciales inválidas|credenciales incorrectas/i.test(err.message)
}

/** Formatos típicos de usuario Windows/AD para probar contra el EHR (orden de prioridad). */
export function buildAdLoginAttempts(loginId: string): string[] {
  const id = parseLoginIdentifier(loginId)
  const domain = (process.env.AD_DOMAIN ?? 'RCJ').trim()
  const user = id.username.toLowerCase()
  const raw = id.raw.trim()
  const domains = (process.env.AD_EMAIL_DOMAINS ?? 'rcjcorp.com,grupoc.com')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
  const primaryDomain = domains[0] ?? 'rcjcorp.com'
  const primaryEmail = `${user}@${primaryDomain}`

  const attempts: string[] = []
  if (raw.includes('\\') || raw.includes('@')) {
    attempts.push(raw)
  } else {
    attempts.push(user, primaryEmail)
    if (domain) attempts.push(`${domain}\\${user}`)
  }
  for (const email of id.emailCandidates) {
    attempts.push(email)
  }

  return [...new Set(attempts.map((a) => a.trim()).filter(Boolean))].slice(0, AD_LOGIN_MAX_ATTEMPTS)
}

/** Valida usuario/contraseña contra Active Directory (API EHR corporativa). */
export async function authenticateWithActiveDirectory(
  loginId: string,
  password: string,
): Promise<void> {
  const attempts = buildAdLoginAttempts(loginId)
  let lastErr: Error | null = null

  for (const candidate of attempts) {
    try {
      await authenticateUserViaEhr(candidate, password, {
        timeoutMs: AD_LOGIN_PER_ATTEMPT_MS,
        singleFormat: true,
      })
      return
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      if (lastErr && isDefinitiveAdCredentialFailure(lastErr)) break
    }
  }

  throw lastErr ?? new Error('Usuario o contraseña de Windows incorrectos.')
}

/** Login con contraseña almacenada en IT Manager (bcrypt). */
export function isPlatformLoginEnabled(): boolean {
  return !isAdLoginEnabled()
}

/** Solo para emergencias cuando AD está activo (AUTH_LOCAL_FALLBACK=true). */
export function isLocalPasswordFallbackEnabled(): boolean {
  return process.env.AUTH_LOCAL_FALLBACK === 'true'
}

export async function getAuthLoginConfig() {
  const domains = (process.env.AD_EMAIL_DOMAINS ?? 'rcjcorp.com,grupoc.com')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
  const primaryDomain = domains[0] ?? 'rcjcorp.com'

  return {
    activeDirectory: false,
    platformLogin: true,
    providerLabel: 'IT Manager',
    usernameHint: `correo@${primaryDomain}`,
    adDomain: (process.env.AD_DOMAIN ?? 'RCJ').trim(),
    localFallback: true,
    emailDomains: domains,
    helpText:
      'Inicia sesión con el correo y contraseña asignados a tu usuario en IT Manager (Maestros → Usuarios).',
  }
}
