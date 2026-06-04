import { Empleado } from '../db/models/Empleado.js'
import { Usuario } from '../db/models/Usuario.js'
import { authenticateUserViaEhr, isAdLoginEnabled } from './ehrAuth.js'

export type LoginIdentifier = {
  raw: string
  username: string
  emailCandidates: string[]
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
    return {
      raw: trimmed,
      username,
      emailCandidates: [email],
    }
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
  const emails = [...new Set([...id.emailCandidates, id.raw.toLowerCase()])]

  let user = await Usuario.findOne({ email: { $in: emails }, activo: true })
    .populate<{ rol_id: { _id: string; nombre: string; permisos: string[] } }>('rol_id', 'nombre permisos')
    .populate<{ empleado_id: { _id: string; codigo: string; nombre: string } | null }>('empleado_id', 'codigo nombre')
    .populate<{
      departamento_id: { _id: string; codigo: string; nombre: string; lleva_gastos?: boolean } | null
    }>('departamento_id', 'codigo nombre lleva_gastos')

  if (user) return user

  const empleado = await Empleado.findOne({
    activo: true,
    $or: [
      { email: { $in: emails } },
      { codigo: new RegExp(`^${escapeRegex(id.username)}$`, 'i') },
    ],
  }).lean()

  if (!empleado) return null

  return Usuario.findOne({ empleado_id: empleado._id, activo: true })
    .populate<{ rol_id: { _id: string; nombre: string; permisos: string[] } }>('rol_id', 'nombre permisos')
    .populate<{ empleado_id: { _id: string; codigo: string; nombre: string } | null }>('empleado_id', 'codigo nombre')
    .populate<{
      departamento_id: { _id: string; codigo: string; nombre: string; lleva_gastos?: boolean } | null
    }>('departamento_id', 'codigo nombre lleva_gastos')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Valida usuario/contraseña contra Active Directory (vía API EHR corporativa). */
export async function authenticateWithActiveDirectory(
  loginId: string,
  password: string,
): Promise<void> {
  const id = parseLoginIdentifier(loginId)
  const attempts = [id.raw, id.username, ...id.emailCandidates]
  let lastErr: Error | null = null

  for (const candidate of [...new Set(attempts)]) {
    if (!candidate) continue
    try {
      await authenticateUserViaEhr(candidate, password)
      return
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }

  throw lastErr ?? new Error('Credenciales de Active Directory incorrectas.')
}

export function isLocalPasswordFallbackEnabled(): boolean {
  return process.env.AUTH_LOCAL_FALLBACK !== 'false'
}

export async function getAuthLoginConfig() {
  const adEnabled = isAdLoginEnabled()
  const domains = (process.env.AD_EMAIL_DOMAINS ?? 'rcjcorp.com,grupoc.com')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
  const primaryDomain = domains[0] ?? 'rcjcorp.com'

  const localFallback = isLocalPasswordFallbackEnabled()

  return {
    activeDirectory: adEnabled,
    providerLabel: 'Active Directory RCJ',
    usernameHint: `usuario@${primaryDomain}`,
    localFallback,
    emailDomains: domains,
    loginModes:
      adEnabled && localFallback
        ? (['active_directory', 'local'] as const)
        : adEnabled
          ? (['active_directory'] as const)
          : (['local'] as const),
    helpText:
      adEnabled && localFallback
        ? 'Puedes usar Active Directory o la contraseña local configurada en Maestros → Usuarios.'
        : adEnabled
          ? 'Autenticación con Active Directory. Debes tener usuario activo en IT Manager.'
          : 'Inicia sesión con el correo y contraseña local de IT Manager.',
  }
}
