import type { Tarea, TareaEstado } from '@/types/tarea'

export function dependeDeIds(t: Tarea): string[] {
  return (t.depende_de_ids ?? []).map(String)
}

export function mapaTareas(tareas: Tarea[]): Map<string, Tarea> {
  return new Map(tareas.map((t) => [t._id, t]))
}

export function nombresPredecesoras(t: Tarea, mapa: Map<string, Tarea>): string[] {
  return dependeDeIds(t)
    .map((id) => mapa.get(id)?.nombre)
    .filter((n): n is string => Boolean(n))
}

/** True si alguna predecesora no está completada. */
export function tareaBloqueadaPorDependencias(t: Tarea, mapa: Map<string, Tarea>): boolean {
  return dependeDeIds(t).some((id) => {
    const pred = mapa.get(id)
    return pred != null && pred.estado !== 'Completado'
  })
}

export function estadoTareaColor(estado: TareaEstado): string {
  switch (estado) {
    case 'Completado':
      return 'bg-[var(--lime-lt)] text-[var(--navy)] border-[var(--lime)]/40'
    case 'En progreso':
      return 'bg-[var(--blue-lt)] text-[var(--navy)] border-[var(--navy)]/20'
    case 'Bloqueado':
      return 'bg-destructive/10 text-destructive border-destructive/30'
    default:
      return 'bg-muted/50 text-muted-foreground border-border'
  }
}

/**
 * Agrupa tareas por nivel en el grafo de dependencias (0 = sin predecesoras).
 * Tareas con ciclo o predecesora faltante van al último nivel posible.
 */
export function agruparTareasPorNivel(tareas: Tarea[]): string[][] {
  const ids = new Set(tareas.map((t) => t._id))
  const preds = new Map<string, string[]>()
  for (const t of tareas) {
    preds.set(t._id, dependeDeIds(t).filter((id) => ids.has(id)))
  }

  const nivel = new Map<string, number>()
  const visiting = new Set<string>()

  function depth(id: string): number {
    if (nivel.has(id)) return nivel.get(id)!
    if (visiting.has(id)) return 0
    visiting.add(id)
    const ps = preds.get(id) ?? []
    const d = ps.length === 0 ? 0 : 1 + Math.max(...ps.map(depth))
    visiting.delete(id)
    nivel.set(id, d)
    return d
  }

  for (const t of tareas) depth(t._id)

  const maxN = Math.max(0, ...[...nivel.values()])
  const niveles: string[][] = Array.from({ length: maxN + 1 }, () => [])
  for (const t of tareas) {
    niveles[nivel.get(t._id) ?? 0]!.push(t._id)
  }
  return niveles.filter((n) => n.length > 0)
}

/** Tareas que dependen directamente de `tareaId`. */
export function sucesorasDirectas(tareaId: string, tareas: Tarea[]): Tarea[] {
  return tareas.filter((t) => dependeDeIds(t).includes(tareaId))
}

export type TareaSalud = 'ok' | 'en_riesgo' | 'atrasada'

function inicioDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)
}

function parseFechaTarea(raw?: string | null): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : inicioDia(d)
}

/**
 * Atrasada: fecha fin vencida y no completada.
 * En riesgo: vence en ≤5 días sin completar, o bloqueada por deps con fin ≤7 días.
 */
export function evaluarSaludTarea(
  t: Tarea,
  mapa: Map<string, Tarea>,
  hoy: Date = new Date(),
): TareaSalud {
  if (t.estado === 'Completado') return 'ok'

  const hoyD = inicioDia(hoy)
  const fin = parseFechaTarea(t.fecha_fin)
  const msDia = 24 * 60 * 60 * 1000

  if (fin && fin < hoyD) return 'atrasada'

  if (fin) {
    const dias = Math.round((fin.getTime() - hoyD.getTime()) / msDia)
    if (dias >= 0 && dias <= 5) return 'en_riesgo'
    if (dias <= 7 && (t.porcentaje ?? 0) < 50 && t.estado !== 'Completado') {
      return 'en_riesgo'
    }
  }

  if (tareaBloqueadaPorDependencias(t, mapa) && fin) {
    const dias = Math.round((fin.getTime() - hoyD.getTime()) / msDia)
    if (dias <= 7) return 'en_riesgo'
  }

  return 'ok'
}

export function etiquetaSaludTarea(salud: TareaSalud): string | null {
  switch (salud) {
    case 'atrasada':
      return 'Atrasada'
    case 'en_riesgo':
      return 'En riesgo'
    default:
      return null
  }
}

export function saludTareaCardClass(salud: TareaSalud): string {
  switch (salud) {
    case 'atrasada':
      return 'border-red-600 bg-red-50 shadow-red-200/60 ring-1 ring-red-400/50'
    case 'en_riesgo':
      return 'border-red-400 bg-red-50/80 ring-1 ring-red-300/40'
    default:
      return 'border-border bg-card'
  }
}
