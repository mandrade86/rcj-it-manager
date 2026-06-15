import mongoose from 'mongoose'

import { Empleado } from '../db/models/Empleado.js'
import { Usuario } from '../db/models/Usuario.js'
import { resolveVisibleEmpleadoIds } from './empleadoScope.js'

/** Estados de proyecto considerados «en marcha» para métricas del dashboard. */
export const PROYECTO_ESTADOS_ACTIVOS = [
  'Planificado',
  'En revisión',
  'Aprobado',
  'En progreso',
] as const

export function isAdminProyectos(permisos: string[]): boolean {
  return permisos.includes('*') || permisos.includes('proyectos:ver-todos')
}

/** Departamentos visibles: usuario, rol (`departamentos_ids`) y empleado (`departamentos_a_cargo`). */
export async function resolveDepartamentosUsuario(
  userId: string,
): Promise<mongoose.Types.ObjectId[]> {
  const user = await Usuario.findById(userId)
    .select('departamento_id empleado_id')
    .populate<{
      rol_id: { departamento_id?: unknown; departamentos_ids?: unknown[] } | null
    }>('rol_id', 'departamento_id departamentos_ids')
    .lean()
  if (!user) return []

  const seen = new Set<string>()
  const add = (id: unknown) => {
    if (id == null) return
    const s = String(id)
    if (mongoose.isValidObjectId(s)) seen.add(s)
  }

  add(user.departamento_id)

  const rol = user.rol_id as { departamento_id?: unknown; departamentos_ids?: unknown[] } | null
  add(rol?.departamento_id)
  for (const id of rol?.departamentos_ids ?? []) add(id)

  if (user.empleado_id) {
    const emp = await Empleado.findById(user.empleado_id).select('departamentos_a_cargo').lean()
    for (const id of emp?.departamentos_a_cargo ?? []) add(id)
  }

  return [...seen].map((id) => new mongoose.Types.ObjectId(id))
}

/**
 * Filtro Mongo de proyectos visibles: propios, equipo (jerarquía / rol) y
 * departamentales de los departamentos asignados al usuario o su rol.
 */
export async function buildProyectoScopeFilter(
  userId: string,
  permisos: string[],
): Promise<Record<string, unknown>> {
  if (isAdminProyectos(permisos)) return {}

  const orConds: Record<string, unknown>[] = [{ usuario_id: new mongoose.Types.ObjectId(userId) }]

  const empleadoScope = await resolveVisibleEmpleadoIds(userId)
  if (empleadoScope.visibleIds.length > 0) {
    const usuariosEquipo = await Usuario.find({
      empleado_id: { $in: empleadoScope.visibleIds },
      activo: true,
    })
      .select('_id')
      .lean()
    const idsEquipo = usuariosEquipo.map((usr) => usr._id)
    if (idsEquipo.length > 0) orConds.push({ usuario_id: { $in: idsEquipo } })
  }

  const deptIds = await resolveDepartamentosUsuario(userId)
  if (deptIds.length > 0) {
    orConds.push({ departamento_id: { $in: deptIds } })
  }

  orConds.push({ 'participantes.usuario_id': new mongoose.Types.ObjectId(userId) })

  return { $or: orConds }
}

/** Proyectos donde el usuario figura explícitamente como participante. */
export function buildProyectoParticipoFilter(userId: string): Record<string, unknown> {
  return { 'participantes.usuario_id': new mongoose.Types.ObjectId(userId) }
}

/** Proyectos del equipo (sin el propio usuario). */
export async function buildProyectoEquipoFilter(
  userId: string,
  permisos: string[],
): Promise<Record<string, unknown>> {
  if (isAdminProyectos(permisos)) return {}
  const empleadoScope = await resolveVisibleEmpleadoIds(userId)
  if (empleadoScope.isAdmin) return {}
  const empleadoIds = empleadoScope.visibleIds.filter((id) => id !== empleadoScope.selfEmpleadoId)
  if (empleadoIds.length === 0) return { usuario_id: { $in: [] } }
  const usuariosEquipo = await Usuario.find({
    empleado_id: { $in: empleadoIds },
    activo: true,
  })
    .select('_id')
    .lean()
  return { usuario_id: { $in: usuariosEquipo.map((usr) => usr._id) } }
}
