export const KPI_TIPOS_CALCULO = [
  'auto_meta',
  'ultimo_registro',
  'promedio_registros',
  'max_registro',
  'min_registro',
  'proyectos_vinculados',
] as const

export type KpiTipoCalculo = (typeof KPI_TIPOS_CALCULO)[number]

export const META_TIPOS_CALCULO = ['promedio_kpis', 'min_kpis', 'max_kpis'] as const

export type MetaTipoCalculo = (typeof META_TIPOS_CALCULO)[number]

export const KPI_TIPO_CALCULO_LABELS: Record<KpiTipoCalculo, string> = {
  auto_meta: 'Automático (según meta y último valor)',
  ultimo_registro: 'Último registro vs meta',
  promedio_registros: 'Promedio de registros vs meta',
  max_registro: 'Valor máximo vs meta',
  min_registro: 'Valor mínimo vs meta',
  proyectos_vinculados: 'Promedio avance de proyectos vinculados',
}

export const META_TIPO_CALCULO_LABELS: Record<MetaTipoCalculo, string> = {
  promedio_kpis: 'Promedio de KPIs de la meta',
  min_kpis: 'Peor KPI (mínimo)',
  max_kpis: 'Mejor KPI (máximo)',
}

export function isKpiTipoCalculo(v: unknown): v is KpiTipoCalculo {
  return typeof v === 'string' && (KPI_TIPOS_CALCULO as readonly string[]).includes(v)
}

export function isMetaTipoCalculo(v: unknown): v is MetaTipoCalculo {
  return typeof v === 'string' && (META_TIPOS_CALCULO as readonly string[]).includes(v)
}
