import type { AuthCtx } from './pmoAuth.js'
import {
  buildBriefingPersonal,
  buildBriefingPortafolio,
  buildProyectoDetalle,
} from './pmoBriefing.js'
import { puedePmoPortafolio } from './pmoPermisos.js'
import { appPublicUrl } from './mailer.js'

export type PmoIntent =
  | 'ayuda'
  | 'personal_resumen'
  | 'personal_atrasados'
  | 'personal_riesgos'
  | 'proyecto_detalle'
  | 'portafolio_resumen'
  | 'desconocido'

export type PmoRespuesta = {
  intent: PmoIntent
  texto: string
  href?: string
  datos?: unknown
}

export function detectarIntent(textoRaw: string): { intent: PmoIntent; query?: string } {
  const t = textoRaw.trim().toLowerCase()
  if (!t) return { intent: 'ayuda' }

  if (/\b(ayuda|help|comandos|qué puedes|que puedes)\b/.test(t)) return { intent: 'ayuda' }

  if (/\b(portafolio|portafolio|jefatura|departamento|executive|ejecutivo)\b/.test(t)) {
    return { intent: 'portafolio_resumen' }
  }

  if (/\b(riesgo|riesgos)\b/.test(t)) return { intent: 'personal_riesgos' }

  if (/\b(atrasad|vencid|retrasad|overdue)\b/.test(t)) return { intent: 'personal_atrasados' }

  const mProy =
    t.match(/\bproyecto\s+([a-z0-9][a-z0-9._-]{1,40})\b/i) ||
    t.match(/\b(inv|ad|pr|it)-?\d{2,}\b/i)
  if (mProy) {
    const q = (mProy[1] || mProy[0] || '').trim()
    return { intent: 'proyecto_detalle', query: q }
  }
  if (/\bproyecto\s+(.+)$/i.test(textoRaw.trim())) {
    const q = textoRaw.trim().replace(/^.*?\bproyecto\s+/i, '').trim()
    if (q) return { intent: 'proyecto_detalle', query: q }
  }

  if (/\b(resumen|cómo voy|como voy|status|estado|briefing|hola|buenos|buenas)\b/.test(t)) {
    return { intent: 'personal_resumen' }
  }

  return { intent: 'desconocido' }
}

function textoAyuda(): string {
  return [
    'Soy **PMO Personal**. Puedo ayudarte con:',
    '• `resumen` — tu situación de proyectos y tareas',
    '• `atrasados` / `vencidos` — lo que ya se pasó de fecha',
    '• `riesgos` — proyectos en riesgo alto',
    '• `proyecto INV-001` o `proyecto Nombre` — detalle de un proyecto',
    '• `portafolio` — vista jefatura (si tienes permiso)',
    `Portal: ${appPublicUrl()}`,
  ].join('\n')
}

export async function responderPmo(texto: string, ctx: AuthCtx): Promise<PmoRespuesta> {
  const { intent, query } = detectarIntent(texto)

  if (intent === 'ayuda' || intent === 'desconocido') {
    const extra = intent === 'desconocido'
      ? `No entendí «${texto.trim()}».\n\n`
      : ''
    return { intent: intent === 'desconocido' ? 'desconocido' : 'ayuda', texto: extra + textoAyuda(), href: appPublicUrl() }
  }

  if (intent === 'personal_resumen') {
    const b = await buildBriefingPersonal(ctx)
    return { intent, texto: b.texto, href: `${appPublicUrl()}/`, datos: b }
  }

  if (intent === 'personal_atrasados') {
    const b = await buildBriefingPersonal(ctx)
    const lineas = [
      `Tareas vencidas (${b.tareas_vencidas.length}):`,
      ...b.tareas_vencidas.slice(0, 8).map((t) => `• ${t.nombre} — ${t.proyecto_nombre}`),
      b.tareas_vencidas.length === 0 ? 'Ninguna tarea vencida. ¡Bien!' : '',
      '',
      `Proyectos con fecha vencida / riesgo: ${b.riesgos_altos.filter((p) => p.fecha_fin && new Date(p.fecha_fin) < new Date()).length}`,
    ].filter(Boolean)
    return { intent, texto: lineas.join('\n'), href: `${appPublicUrl()}/mis-tareas`, datos: { tareas_vencidas: b.tareas_vencidas } }
  }

  if (intent === 'personal_riesgos') {
    const b = await buildBriefingPersonal(ctx)
    const lineas = [
      `Riesgos altos (${b.riesgos_altos.length}):`,
      ...b.riesgos_altos.slice(0, 8).map((p) => `• ${p._id} ${p.nombre} — ${p.motivo_riesgo}`),
      b.riesgos_altos.length === 0 ? 'No hay proyectos en riesgo alto en tu alcance.' : '',
    ].filter(Boolean)
    return { intent, texto: lineas.join('\n'), href: `${appPublicUrl()}/proyectos`, datos: { riesgos_altos: b.riesgos_altos } }
  }

  if (intent === 'proyecto_detalle') {
    const det = await buildProyectoDetalle(ctx, query ?? '')
    if (!det) {
      return {
        intent,
        texto: `No encontré el proyecto «${query ?? ''}» en tu alcance. Prueba con el código (ej. INV-001) o parte del nombre.`,
        href: `${appPublicUrl()}/proyectos`,
      }
    }
    return { intent, texto: det.texto, href: det.proyecto.href, datos: det }
  }

  if (intent === 'portafolio_resumen') {
    if (!puedePmoPortafolio(ctx.permisos)) {
      return {
        intent,
        texto: 'No tienes permiso de portafolio/jefatura (`pmo:portafolio`). Puedes pedir `resumen` de tus proyectos.',
        href: appPublicUrl(),
      }
    }
    const b = await buildBriefingPortafolio(ctx)
    return { intent, texto: b.texto, href: `${appPublicUrl()}/dashboard`, datos: b }
  }

  return { intent: 'ayuda', texto: textoAyuda(), href: appPublicUrl() }
}
