import type { DepartamentoDoc } from './departamento'
import type { RolDoc } from './rol'

export type EmpleadoMini = {
  _id: string
  codigo?: string
  nombre: string
  puesto?: string
  departamento?: string
}

export type UsuarioDoc = {
  _id: string
  nombre: string
  email: string
  /** Usuario AD sin @dominio. */
  login_dominio?: string
  es_usuario_dominio?: boolean
  rol_id?: string | RolDoc | null
  /** Identidad del usuario en el maestro de empleados (su número de empleado). */
  empleado_id?: string | EmpleadoMini | null
  /** Asignaciones adicionales explícitas (alcance extra). */
  empleados_ids?: Array<string | EmpleadoMini>
  departamento_id?: string | DepartamentoDoc | null
  activo?: boolean
  mfa_enabled?: boolean
  ultimo_acceso?: string | null
  createdAt?: string
  updatedAt?: string
}

export function rolFromUsuario(u: UsuarioDoc): RolDoc | null {
  const r = u.rol_id
  if (!r || typeof r === 'string') return null
  return r as RolDoc
}

export function deptFromUsuario(u: UsuarioDoc): DepartamentoDoc | null {
  const d = u.departamento_id
  if (!d || typeof d === 'string') return null
  return d as DepartamentoDoc
}

export function empleadoFromUsuario(u: UsuarioDoc): EmpleadoMini | null {
  const e = u.empleado_id
  if (!e || typeof e === 'string') return null
  return e as EmpleadoMini
}

export function empleadoIdFromUsuario(u: UsuarioDoc): string | null {
  const e = u.empleado_id
  if (!e) return null
  return typeof e === 'string' ? e : e._id
}

export function empleadosFromUsuario(u: UsuarioDoc): EmpleadoMini[] {
  const arr = u.empleados_ids ?? []
  return arr.filter((e): e is EmpleadoMini => typeof e !== 'string' && e != null)
}

export function loginDisplayFromUsuario(u: UsuarioDoc): string {
  return u.email
}

export function empleadoIdsFromUsuario(u: UsuarioDoc): string[] {
  const arr = u.empleados_ids ?? []
  return arr.map((e) => (typeof e === 'string' ? e : e._id))
}
