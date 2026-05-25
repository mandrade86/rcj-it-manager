import type { KpiDoc } from '@/types/kpi'

export function normalizeKpiTipo(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

/** KPI aplicable a un proyecto según tipo/eje del KPI y eje del proyecto. */
export function kpiMatchesProyectoEje(kpi: KpiDoc, proyectoEje: string | null | undefined): boolean {
  const pe = normalizeKpiTipo(proyectoEje)
  if (!pe) return true
  const kt = normalizeKpiTipo(kpi.tipo || kpi.eje)
  const ke = normalizeKpiTipo(kpi.eje)
  return kt === pe || ke === pe
}
