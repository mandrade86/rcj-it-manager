import type { DepartamentoDoc } from './departamento'

export type PlantillaItem = {
  _id?: string
  codigo?: string
  seccion?: string
  requisito: string
  tipo_requisito?: 'Indispensable' | 'Recomendado'
  plazo_estimado?: string
  recurso?: string
}

export type PlantillaCarreraDoc = {
  _id: string
  nombre: string
  descripcion?: string
  departamento_id?: string | DepartamentoDoc | null
  tipo_ruta: string
  activo?: boolean
  items: PlantillaItem[]
  createdAt?: string
  updatedAt?: string
}

export function deptFromPlantilla(p: PlantillaCarreraDoc): DepartamentoDoc | null {
  const d = p.departamento_id
  if (!d || typeof d === 'string') return null
  return d as DepartamentoDoc
}
