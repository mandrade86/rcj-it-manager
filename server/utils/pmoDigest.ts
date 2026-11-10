import { Usuario } from '../db/models/Usuario.js'
import { unirPermisosDeRoles } from './authSession.js'
import { buildBriefingPersonal, buildBriefingPortafolio } from './pmoBriefing.js'
import { puedePmoPersonal, puedePmoPortafolio } from './pmoPermisos.js'
import { enviarTeams, isTeamsConfigured } from './teams.js'
import type { AuthCtx } from './pmoAuth.js'

export type DigestResult = {
  configurado: boolean
  personal_enviados: number
  personal_fallidos: number
  portafolio_enviados: number
  portafolio_fallidos: number
  omitidos: number
}

function aCtx(u: {
  _id: unknown
  nombre?: string
  email?: string
  empleado_id?: unknown
  rol_id?: { permisos?: string[] } | null
  roles_ids?: Array<{ permisos?: string[] }> | null
}): AuthCtx {
  return {
    _id: String(u._id),
    nombre: u.nombre || String(u.email),
    email: String(u.email || '').toLowerCase(),
    permisos: unirPermisosDeRoles([u.rol_id, ...(u.roles_ids ?? [])]),
    empleado_id: u.empleado_id ? String(u.empleado_id) : null,
  }
}

/**
 * Envía digest PMO por Teams a usuarios con email.
 * Personal: quienes pueden PMO personal y tienen algo relevante (vencidos/riesgos) o siempre un resumen corto.
 * Portafolio: solo roles con pmo:portafolio.
 */
export async function enviarDigestsPmo(): Promise<DigestResult> {
  const out: DigestResult = {
    configurado: isTeamsConfigured(),
    personal_enviados: 0,
    personal_fallidos: 0,
    portafolio_enviados: 0,
    portafolio_fallidos: 0,
    omitidos: 0,
  }
  if (!out.configurado) return out

  const users = await Usuario.find({ activo: { $ne: false }, email: { $exists: true, $ne: '' } })
    .select('nombre email empleado_id rol_id roles_ids')
    .populate('rol_id', 'permisos')
    .populate('roles_ids', 'permisos')
    .lean() as unknown as Array<{
    _id: unknown
    nombre?: string
    email?: string
    empleado_id?: unknown
    rol_id?: { permisos?: string[] } | null
    roles_ids?: Array<{ permisos?: string[] }> | null
  }>

  for (const raw of users) {
    const ctx = aCtx(raw)
    if (!ctx.email.includes('@')) {
      out.omitidos++
      continue
    }

    if (puedePmoPersonal(ctx.permisos)) {
      try {
        const b = await buildBriefingPersonal(ctx)
        const relevante =
          b.tareas_vencidas.length > 0 ||
          b.tareas_por_vencer.length > 0 ||
          b.riesgos_altos.length > 0
        // Digest diario: siempre un resumen corto; si no hay nada urgente, mensaje positivo.
        const mensaje = relevante
          ? b.texto
          : `${b.texto}\n\nNo tienes pendientes urgentes hoy.`
        const r = await enviarTeams({
          destinatario: ctx.email,
          titulo: 'PMO Personal — tu resumen',
          mensaje,
          url: b.proyectos[0]?.href,
          boton: 'Abrir portal',
        })
        if (r.ok) out.personal_enviados++
        else {
          out.personal_fallidos++
          console.warn(`[pmo-digest] personal ${ctx.email}: ${r.error}`)
        }
      } catch (e) {
        out.personal_fallidos++
        console.warn('[pmo-digest] personal error', e)
      }
    }

    if (puedePmoPortafolio(ctx.permisos)) {
      try {
        const b = await buildBriefingPortafolio(ctx)
        const r = await enviarTeams({
          destinatario: ctx.email,
          titulo: 'PMO Personal — portafolio',
          mensaje: b.texto,
          boton: 'Abrir dashboard',
        })
        if (r.ok) out.portafolio_enviados++
        else {
          out.portafolio_fallidos++
          console.warn(`[pmo-digest] portafolio ${ctx.email}: ${r.error}`)
        }
      } catch (e) {
        out.portafolio_fallidos++
        console.warn('[pmo-digest] portafolio error', e)
      }
    }
  }

  console.log('[pmo-digest]', out)
  return out
}

let digestTimer: ReturnType<typeof setInterval> | null = null

/** Arranca digest periódico si PMO_DIGEST_CRON=true (intervalo en horas, default 24). */
export function startPmoDigestCron(): void {
  if (process.env.PMO_DIGEST_CRON !== 'true') return
  if (digestTimer) return
  const horas = Math.max(1, Number(process.env.PMO_DIGEST_INTERVAL_HOURS) || 24)
  const ms = horas * 60 * 60 * 1000
  console.log(`[pmo-digest] cron activo cada ${horas}h`)
  digestTimer = setInterval(() => {
    void enviarDigestsPmo().catch((e) => console.warn('[pmo-digest] cron falló', e))
  }, ms)
  // Primera corrida diferida 2 min (dejar que Mongo conecte)
  setTimeout(() => {
    void enviarDigestsPmo().catch((e) => console.warn('[pmo-digest] primer envío falló', e))
  }, 120_000)
}
