import { Proyecto } from '../db/models/Proyecto.js'
import { Tarea } from '../db/models/Tarea.js'

/** Ejecutado de una tarea: monto_ejecutado explícito, o prorrateo por % avance. */
export function ejecutadoDeTarea(t: {
  monto_asignado?: number | null
  monto_ejecutado?: number | null
  porcentaje?: number | null
  estado?: string | null
}): number {
  if (t.monto_ejecutado != null && Number.isFinite(Number(t.monto_ejecutado))) {
    return Math.max(0, Number(t.monto_ejecutado))
  }
  const asignado = t.monto_asignado != null && Number.isFinite(Number(t.monto_asignado))
    ? Math.max(0, Number(t.monto_asignado))
    : 0
  if (asignado <= 0) return 0
  if (t.estado === 'Completado') return asignado
  const pct = Math.min(100, Math.max(0, Number(t.porcentaje) || 0))
  return (asignado * pct) / 100
}

export function asignadoDeTarea(t: { monto_asignado?: number | null }): number {
  if (t.monto_asignado == null || !Number.isFinite(Number(t.monto_asignado))) return 0
  return Math.max(0, Number(t.monto_asignado))
}

/**
 * Recalcula avance % y rollup de presupuesto desde las tareas del proyecto.
 * - presupuesto_asignado = Σ monto_asignado
 * - presupuesto_ejecutado = Σ ejecutadoDeTarea (monto_ejecutado o prorrateo por %)
 */
export async function recalcularAvanceProyecto(proyectoId: string) {
  const tareas = await Tarea.find({ proyecto_id: proyectoId })
    .select('porcentaje estado monto_asignado monto_ejecutado')
    .lean()

  if (tareas.length === 0) {
    await Proyecto.findByIdAndUpdate(proyectoId, {
      porcentaje_avance: 0,
      presupuesto_asignado: 0,
      presupuesto_ejecutado: 0,
    })
    return
  }

  const sumPct = tareas.reduce((acc, t) => acc + (t.porcentaje ?? 0), 0)
  const avg = Math.round(sumPct / tareas.length)
  const asignado = tareas.reduce((acc, t) => acc + asignadoDeTarea(t), 0)
  const ejecutado = tareas.reduce((acc, t) => acc + ejecutadoDeTarea(t), 0)

  await Proyecto.findByIdAndUpdate(proyectoId, {
    porcentaje_avance: avg,
    presupuesto_asignado: Math.round(asignado * 100) / 100,
    presupuesto_ejecutado: Math.round(ejecutado * 100) / 100,
  })
}
