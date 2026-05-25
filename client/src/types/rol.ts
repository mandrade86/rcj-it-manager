import type { DepartamentoDoc } from './departamento'
import type { PerfilPuestoMini } from './perfilPuesto'

export type RolDoc = {
  _id: string
  nombre: string
  descripcion?: string
  departamento_id?: string | DepartamentoDoc | null
  departamentos_ids?: (string | DepartamentoDoc)[]
  perfil_puesto_id?: string | PerfilPuestoMini | null
  permisos: string[]
  activo?: boolean
  createdAt?: string
  updatedAt?: string
}

export function departamentoIdsFromRol(r: RolDoc): string[] {
  const fromArr = (r.departamentos_ids ?? []).map((d) => (typeof d === 'string' ? d : d._id))
  if (fromArr.length > 0) return fromArr
  const single = r.departamento_id
  if (!single) return []
  return [typeof single === 'string' ? single : single._id]
}

function deptFromRolLegacySingle(r: RolDoc): DepartamentoDoc | null {
  const d = r.departamento_id
  if (!d || typeof d === 'string') return null
  return d as DepartamentoDoc
}

export function departamentosFromRol(r: RolDoc): DepartamentoDoc[] {
  const arr = r.departamentos_ids ?? []
  const populated = arr.filter((d): d is DepartamentoDoc => typeof d !== 'string')
  if (populated.length > 0) return populated
  const one = deptFromRolLegacySingle(r)
  return one ? [one] : []
}

/** Primer departamento (compatibilidad con código que espera uno solo). */
export function deptFromRol(r: RolDoc): DepartamentoDoc | null {
  return departamentosFromRol(r)[0] ?? null
}

export function perfilFromRol(r: RolDoc): PerfilPuestoMini | null {
  const p = r.perfil_puesto_id
  if (!p || typeof p === 'string') return null
  return p as PerfilPuestoMini
}

export function perfilIdFromRol(r: RolDoc): string | null {
  const p = r.perfil_puesto_id
  if (!p) return null
  return typeof p === 'string' ? p : p._id
}
