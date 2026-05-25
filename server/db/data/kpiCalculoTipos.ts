/** Cómo se calcula el % de cumplimiento de un KPI (0–100). */
export const KPI_TIPOS_CALCULO = [
  'auto_meta',
  'ultimo_registro',
  'promedio_registros',
  'max_registro',
  'min_registro',
  'proyectos_vinculados',
] as const

export type KpiTipoCalculo = (typeof KPI_TIPOS_CALCULO)[number]

/** Cómo se agrega el avance de una meta anual a partir de sus KPIs. */
export const META_TIPOS_CALCULO = [
  'promedio_kpis',
  'min_kpis',
  'max_kpis',
] as const

export type MetaTipoCalculo = (typeof META_TIPOS_CALCULO)[number]

export function isKpiTipoCalculo(v: unknown): v is KpiTipoCalculo {
  return typeof v === 'string' && (KPI_TIPOS_CALCULO as readonly string[]).includes(v)
}

export function isMetaTipoCalculo(v: unknown): v is MetaTipoCalculo {
  return typeof v === 'string' && (META_TIPOS_CALCULO as readonly string[]).includes(v)
}
