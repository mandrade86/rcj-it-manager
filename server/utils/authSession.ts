import type { Types } from 'mongoose'

type RolAuth = { _id: Types.ObjectId; nombre: string; permisos: string[] }

type UsuarioPopulated = {
  _id: Types.ObjectId
  email: string
  nombre: string
  rol_id: RolAuth
  roles_ids?: RolAuth[] | null
  empleado_id: { _id: Types.ObjectId; codigo: string; nombre: string } | null
  departamento_id:
    | { _id: Types.ObjectId; codigo: string; nombre: string; lleva_gastos?: boolean }
    | null
}

export function unirPermisosDeRoles(
  roles: Array<{ permisos?: string[] } | null | undefined>,
): string[] {
  const set = new Set<string>()
  for (const rol of roles) {
    for (const p of rol?.permisos ?? []) {
      if (p) set.add(p)
    }
  }
  return [...set]
}

export function buildAuthPayload(user: UsuarioPopulated) {
  const rol = user.rol_id
  const extras = Array.isArray(user.roles_ids) ? user.roles_ids : []
  const emp = user.empleado_id
  const dept = user.departamento_id
  const nombres = [rol?.nombre, ...extras.map((r) => r?.nombre)].filter(Boolean)

  return {
    _id: String(user._id),
    email: user.email,
    nombre: user.nombre,
    rol: nombres.join(' · ') || rol?.nombre || '',
    permisos: unirPermisosDeRoles([rol, ...extras]),
    empleado_id: emp ? String(emp._id) : null,
    empleado_codigo: emp?.codigo ?? null,
    empleado_nombre: emp?.nombre ?? null,
    departamento_id: dept ? String(dept._id) : null,
    departamento_codigo: dept?.codigo ?? null,
    departamento_nombre: dept?.nombre ?? null,
    departamento_lleva_gastos: dept ? Boolean(dept.lleva_gastos) : false,
  }
}
