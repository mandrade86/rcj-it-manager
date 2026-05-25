import { Empleado } from '../db/models/Empleado.js'
import { Usuario } from '../db/models/Usuario.js'

/**
 * Resolves the set of empleados visible to a user.
 *
 * Scope rules (non-admin):
 *  1. `empleado_id` — Identidad del usuario (nodo «Tú» en organigrama).
 *  2. `empleados_ids` — Asignaciones explícitas adicionales en el usuario.
 *  3. Subordinados descubiertos en cascada vía `Empleado.jefe_id` (BFS desde
 *     cada id de partida).
 *  4. `departamentos_a_cargo` del empleado vinculado y `departamentos_ids` del rol —
 *     empleados activos cuyo `departamento_id` está en esas listas (sin duplicar jerarquía).
 *
 * Admin (`*` permission): ve todo el maestro de empleados.
 */
export async function resolveVisibleEmpleadoIds(userId: string): Promise<{
  isAdmin: boolean
  visibleIds: string[]
  selfEmpleadoId: string | null
  directIds: string[]
  autoDirectIds: string[]
  /** Ids añadidos solo por departamentos_a_cargo (no por jefe_id). */
  deptStartIds: string[]
}> {
  const empty = {
    isAdmin: false,
    visibleIds: [] as string[],
    selfEmpleadoId: null as string | null,
    directIds: [] as string[],
    autoDirectIds: [] as string[],
    deptStartIds: [] as string[],
  }
  const user = await Usuario.findById(userId)
    .populate<{
      rol_id: {
        permisos?: string[]
        departamento_id?: unknown
        departamentos_ids?: unknown[]
      } | null
    }>('rol_id', 'permisos departamento_id departamentos_ids')
    .lean()
  if (!user) return empty

  const permisos = (user.rol_id as { permisos?: string[] } | null)?.permisos ?? []
  if (permisos.includes('*')) return { ...empty, isAdmin: true }

  const selfEmpleadoId = user.empleado_id ? String(user.empleado_id) : null
  const directIds = (user.empleados_ids ?? []).map((id) => String(id))

  const empleadoLinked = selfEmpleadoId
    ? await Empleado.findById(selfEmpleadoId).select('departamentos_a_cargo').lean()
    : null
  const rol = user.rol_id as {
    departamento_id?: unknown
    departamentos_ids?: unknown[]
  } | null
  const rolDeptIds = [
    ...(rol?.departamentos_ids ?? []).map((id) => String(id)),
    rol?.departamento_id ? String(rol.departamento_id) : null,
  ].filter((id): id is string => Boolean(id))
  const empleadoDeptIds = (empleadoLinked?.departamentos_a_cargo ?? []).map((id) => String(id))
  const deptChargeIds = [...new Set([...empleadoDeptIds, ...rolDeptIds])]

  const startSet = new Set<string>()
  if (selfEmpleadoId) startSet.add(selfEmpleadoId)
  for (const id of directIds) startSet.add(id)

  if (startSet.size === 0 && deptChargeIds.length === 0) {
    return { ...empty, selfEmpleadoId, directIds, deptStartIds: [] }
  }

  const all = await Empleado.find({}, { _id: 1, jefe_id: 1 }).lean()
  const childrenMap = new Map<string, string[]>()
  for (const e of all) {
    if (!e.jefe_id) continue
    const k = String(e.jefe_id)
    if (!childrenMap.has(k)) childrenMap.set(k, [])
    childrenMap.get(k)!.push(String(e._id))
  }

  const autoDirectIds = selfEmpleadoId ? (childrenMap.get(selfEmpleadoId) ?? []) : []

  const visible = new Set<string>(startSet)
  if (startSet.size > 0) {
    const queue: string[] = [...startSet]
    while (queue.length > 0) {
      const current = queue.shift()!
      const kids = childrenMap.get(current)
      if (!kids) continue
      for (const child of kids) {
        if (!visible.has(child)) {
          visible.add(child)
          queue.push(child)
        }
      }
    }
  }

  const deptStartIds: string[] = []
  if (deptChargeIds.length > 0) {
    const inDepts = await Empleado.find({
      departamento_id: { $in: deptChargeIds },
      activo: { $ne: false },
    })
      .select('_id')
      .lean()
    for (const e of inDepts) {
      const id = String(e._id)
      if (!visible.has(id)) {
        visible.add(id)
        deptStartIds.push(id)
      }
    }
  }

  return {
    isAdmin: false,
    visibleIds: [...visible],
    selfEmpleadoId,
    directIds,
    autoDirectIds,
    deptStartIds,
  }
}
