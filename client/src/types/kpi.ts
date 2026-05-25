export type KpiRegistro = {
  fecha: string
  valor?: number | null
  notas?: string | null
}

export type KpiDepartamentoRef = {
  _id: string
  codigo?: string
  nombre?: string
  color?: string
}

export type KpiProyectoMini = {
  _id: string
  nombre: string
  eje?: string | null
  estado?: string | null
  porcentaje_avance?: number | null
}

export type KpiVinculacionResponse = {
  vinculados: number
  proyecto_ids: string[]
}

export type KpiDoc = {
  _id: string
  departamento_id?: string | KpiDepartamentoRef | null
  /** Meta estratégica del departamento (amarre explícito). */
  meta_id?: MetaEstrategicaId | string | null
  /** Tipo para vincular con proyectos (por defecto igual al eje). */
  tipo?: string | null
  eje: string
  nombre: string
  proyecto_ids?: (string | KpiProyectoMini)[] | null
  vinculacion?: KpiVinculacionResponse
  descripcion?: string | null
  meta?: string | null
  unidad?: string | null
  frecuencia?: 'Mensual' | 'Trimestral' | 'Anual' | 'Único' | string | null
  responsable?: string | null
  /** Cómo se calcula el % de cumplimiento (ver kpiAvance.ts). */
  tipo_calculo?: string | null
  registros?: KpiRegistro[]
  createdAt?: string
  updatedAt?: string
}

export function kpiDepartamentoId(k: KpiDoc): string | null {
  const d = k.departamento_id
  if (!d) return null
  return typeof d === 'string' ? d : d._id
}

export function kpiDepartamentoRef(k: KpiDoc): KpiDepartamentoRef | null {
  const d = k.departamento_id
  if (!d || typeof d === 'string') return null
  return d
}

export function kpiProyectoIdList(k: KpiDoc): string[] {
  const raw = k.proyecto_ids
  if (!raw?.length) return []
  return raw
    .map((p) => (typeof p === 'string' ? p : p?._id))
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}

export type KpiSugerenciaItem = {
  eje: string
  nombre: string
  descripcion?: string
  meta: string
  unidad: string
  frecuencia: 'Mensual' | 'Trimestral' | 'Anual' | 'Único'
  yaExiste: boolean
}

export type KpiSugerenciasResponse = {
  departamento: { _id: string; codigo: string; nombre: string }
  /** Clave del catálogo usado (ej. IT) cuando el código en BD es DEP-8. */
  catalogo_clave?: string | null
  total: number
  sugerencias: KpiSugerenciaItem[]
}

export type KpiRegistrosResponse = {
  kpi_id: string
  nombre: string
  eje: string
  meta?: string | null
  unidad?: string | null
  registros: KpiRegistro[]
}

export type MetaEstrategicaId =
  | 'continuidad'
  | 'modernizacion'
  | 'eficiencia'
  | 'gobierno'
  | 'equipo'

export type MetaEstrategica = {
  id: MetaEstrategicaId
  titulo: string
  objetivo: string
}

export const METAS_ESTRATEGICAS: MetaEstrategica[] = [
  {
    id: 'continuidad',
    titulo: 'Continuidad operativa',
    objetivo: 'Uptime tier A, incidentes, EDR, MFA, SLA WAN',
  },
  {
    id: 'modernizacion',
    titulo: 'Modernización',
    objetivo: 'MTTFR P1 y resolución N1',
  },
  {
    id: 'eficiencia',
    titulo: 'Eficiencia de costos',
    objetivo: 'Reducción OPEX TI',
  },
  {
    id: 'gobierno',
    titulo: 'Gobierno IT',
    objetivo: 'Proyectos con caso de negocio',
  },
  {
    id: 'equipo',
    titulo: 'Equipo',
    objetivo: 'Coordinadores contratados',
  },
]

export function isMetaEstrategicaId(v: unknown): v is MetaEstrategicaId {
  return typeof v === 'string' && METAS_ESTRATEGICAS.some((m) => m.id === v)
}

/** Meta vinculada al KPI; sin inferencia automática por nombre. */
export function metaEstrategicaDeKpi(k: KpiDoc): string {
  if (k.meta_id && typeof k.meta_id === 'string' && k.meta_id.trim()) return k.meta_id.trim()
  return 'sin_meta'
}
