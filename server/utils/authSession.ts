import type { Types } from 'mongoose'

type UsuarioPopulated = {
  _id: Types.ObjectId
  email: string
  nombre: string
  rol_id: { _id: Types.ObjectId; nombre: string; permisos: string[] }
  empleado_id: { _id: Types.ObjectId; codigo: string; nombre: string } | null
  departamento_id:
    | { _id: Types.ObjectId; codigo: string; nombre: string; lleva_gastos?: boolean }
    | null
}

export function buildAuthPayload(user: UsuarioPopulated) {
  const rol = user.rol_id
  const emp = user.empleado_id
  const dept = user.departamento_id

  return {
    _id: String(user._id),
    email: user.email,
    nombre: user.nombre,
    rol: rol.nombre,
    permisos: rol.permisos ?? [],
    empleado_id: emp ? String(emp._id) : null,
    empleado_codigo: emp?.codigo ?? null,
    empleado_nombre: emp?.nombre ?? null,
    departamento_id: dept ? String(dept._id) : null,
    departamento_codigo: dept?.codigo ?? null,
    departamento_nombre: dept?.nombre ?? null,
    departamento_lleva_gastos: dept ? Boolean(dept.lleva_gastos) : false,
  }
}
