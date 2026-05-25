import type { DepartamentoDoc } from './departamento'

export type RubricaCriterio = {
  categoria: string
  criterio: string
  descripcion?: string
}

export type PerfilPuestoDoc = {
  _id: string
  codigo: string
  titulo: string
  departamento_id?: string | DepartamentoDoc | null
  nivel?: string
  reporta_a?: string
  objetivo?: string
  requisitos?: string[]
  responsabilidades?: string[]
  autoridad?: string[]
  educacion?: string
  experiencia?: string
  competencias?: string[]
  /** Posición de jefatura (con personal a cargo). */
  tiene_personal_a_cargo?: boolean
  rubrica_criterios?: RubricaCriterio[]
  kpis_evaluacion?: PerfilKpiEvaluacion[]
  notas?: string
  createdAt?: string
  updatedAt?: string
}

export type PerfilKpiEvaluacion = {
  kpi_id: string
  peso: number
  descripcion?: string
}

export type PerfilKpisEvaluacionResponse = {
  perfil_id: string
  codigo: string
  titulo: string
  items: {
    kpi_id: string
    kpi: {
      _id: string
      nombre: string
      eje?: string
      meta?: string
      unidad?: string
      frecuencia?: string
      descripcion?: string
    } | null
    peso: number
    descripcion?: string
  }[]
  total_peso: number
}

export type RubricaResolver = {
  fuente: 'perfil' | 'legacy_puesto'
  perfil_id?: string
  perfil_codigo?: string
  perfil_titulo?: string
  codigo_puesto?: string
  criterios: RubricaCriterio[]
}

export type PerfilPuestoMini = {
  _id: string
  codigo: string
  titulo: string
  nivel?: string
  tiene_personal_a_cargo?: boolean
}

export function deptFromPerfil(p: PerfilPuestoDoc): DepartamentoDoc | null {
  const d = p.departamento_id
  if (!d || typeof d === 'string') return null
  return d as DepartamentoDoc
}
