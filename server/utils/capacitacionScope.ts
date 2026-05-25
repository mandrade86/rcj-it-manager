import mongoose from 'mongoose'

import { Departamento } from '../db/models/Departamento.js'
import { isAdminProyectos, resolveDepartamentosUsuario } from './proyectoScope.js'

export type CapacitacionScope = {
  isGlobal: boolean
  departamentoIds: mongoose.Types.ObjectId[]
  departamentoIdStrings: Set<string>
}

export type CapacitacionAlcanceResponse = {
  isGlobal: boolean
  requiereDepartamentos: boolean
  departamentos: { _id: string; codigo: string; nombre: string; color?: string }[]
  etiqueta: string
  descripcion: string
}

export async function resolveCapacitacionScope(
  userId: string,
  permisos: string[],
): Promise<CapacitacionScope> {
  const isGlobal = isAdminProyectos(permisos)
  const departamentoIds = isGlobal ? [] : await resolveDepartamentosUsuario(userId)
  return {
    isGlobal,
    departamentoIds,
    departamentoIdStrings: new Set(departamentoIds.map(String)),
  }
}

export function departamentoIdsFromCapLean(
  cap: { departamentos_ids?: unknown[] },
): string[] {
  return (cap.departamentos_ids ?? [])
    .map((d) => {
      if (d == null) return ''
      if (typeof d === 'object' && '_id' in (d as object)) {
        return String((d as { _id: unknown })._id)
      }
      return String(d)
    })
    .filter(Boolean)
}

/** Capacitación visible si es global o si comparte al menos un departamento con el usuario. */
export function capVisibleEnScope(
  cap: { departamentos_ids?: unknown[] },
  scope: CapacitacionScope,
): boolean {
  if (scope.isGlobal) return true
  const capDepts = departamentoIdsFromCapLean(cap)
  if (capDepts.length === 0) return false
  if (scope.departamentoIdStrings.size === 0) return false
  return capDepts.some((id) => scope.departamentoIdStrings.has(id))
}

export function mongoFilterCapacitacionesScope(
  scope: CapacitacionScope,
): Record<string, unknown> {
  if (scope.isGlobal) return {}
  if (scope.departamentoIds.length === 0) {
    return { _id: { $in: [] } }
  }
  return { departamentos_ids: { $in: scope.departamentoIds } }
}

export async function buildCapacitacionAlcanceResponse(
  scope: CapacitacionScope,
): Promise<CapacitacionAlcanceResponse> {
  if (scope.isGlobal) {
    return {
      isGlobal: true,
      requiereDepartamentos: false,
      departamentos: [],
      etiqueta: 'Todos los departamentos',
      descripcion:
        'Ves y gestionas el catálogo completo. Puedes dejar una capacitación abierta a todos los departamentos o restringirla por departamento.',
    }
  }

  const rows = await Departamento.find({ _id: { $in: scope.departamentoIds } })
    .select('codigo nombre color')
    .sort({ codigo: 1 })
    .lean()

  const departamentos = rows.map((d) => ({
    _id: String(d._id),
    codigo: d.codigo ?? '',
    nombre: d.nombre ?? '',
    color: d.color ?? undefined,
  }))

  const codes = departamentos.map((d) => d.codigo || d.nombre).filter(Boolean)
  const deptList = codes.length ? codes.join(', ') : 'ninguno asignado'

  return {
    isGlobal: false,
    requiereDepartamentos: true,
    departamentos,
    etiqueta:
      departamentos.length === 1
        ? `Departamento: ${departamentos[0].nombre}`
        : `Departamentos asignados (${departamentos.length})`,
    descripcion:
      departamentos.length > 0
        ? `Solo ves y gestionas capacitaciones etiquetadas para: ${deptList}. Al crear una nueva, se preasignan tus departamentos.`
        : 'Tu usuario no tiene departamentos asignados en el perfil o el rol. Contacta a IT para configurar departamento_id o departamentos_ids en tu rol.',
  }
}

export function normalizeDepartamentosBody(
  raw: unknown,
): mongoose.Types.ObjectId[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((v): v is string => typeof v === 'string' && mongoose.isValidObjectId(v))
    .map((id) => new mongoose.Types.ObjectId(id))
}

/** Valida y aplica valores por defecto de departamentos_ids en create/update. */
export function applyDepartamentosScopeToBody(
  body: Record<string, unknown>,
  scope: CapacitacionScope,
): { ok: true; body: Record<string, unknown> } | { ok: false; status: number; error: string } {
  let ids = normalizeDepartamentosBody(body.departamentos_ids)

  if (!scope.isGlobal) {
    if (ids.length === 0) {
      if (scope.departamentoIds.length === 0) {
        return {
          ok: false,
          status: 403,
          error:
            'No tienes departamentos asignados. No puedes crear capacitaciones hasta que tu rol o perfil incluya al menos un departamento.',
        }
      }
      ids = [...scope.departamentoIds]
    } else {
      const allowed = scope.departamentoIdStrings
      const fuera = ids.filter((oid) => !allowed.has(String(oid)))
      if (fuera.length > 0) {
        return {
          ok: false,
          status: 403,
          error: 'Solo puedes asignar departamentos incluidos en tu alcance (rol y perfil).',
        }
      }
    }
  }

  return { ok: true, body: { ...body, departamentos_ids: ids } }
}
