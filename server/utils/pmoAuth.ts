import mongoose from 'mongoose'

import { Usuario } from '../db/models/Usuario.js'
import { unirPermisosDeRoles } from './authSession.js'

export type AuthCtx = {
  _id: string
  nombre: string
  email: string
  permisos: string[]
  empleado_id?: string | null
}

/** Resuelve un usuario activo del portal por correo/UPN (Teams). */
export async function resolverUsuarioPorEmail(emailRaw: string): Promise<AuthCtx | null> {
  const email = emailRaw.trim().toLowerCase()
  if (!email.includes('@')) return null

  const user = await Usuario.findOne({ email, activo: { $ne: false } })
    .select('nombre email empleado_id rol_id roles_ids')
    .populate('rol_id', 'permisos')
    .populate('roles_ids', 'permisos')
    .lean() as {
    _id: unknown
    nombre?: string
    email?: string
    empleado_id?: unknown
    rol_id?: { permisos?: string[] } | null
    roles_ids?: Array<{ permisos?: string[] }> | null
  } | null

  if (!user) return null
  const rol = user.rol_id
  const extras = user.roles_ids ?? []
  return {
    _id: String(user._id),
    nombre: user.nombre || email,
    email: user.email || email,
    permisos: unirPermisosDeRoles([rol, ...extras]),
    empleado_id: user.empleado_id ? String(user.empleado_id) : null,
  }
}

export function authCtxDesdeJwt(user: {
  _id: string
  nombre: string
  email: string
  permisos: string[]
  empleado_id?: string | null
}): AuthCtx {
  return {
    _id: user._id,
    nombre: user.nombre,
    email: user.email,
    permisos: user.permisos,
    empleado_id: user.empleado_id ?? null,
  }
}

export function esObjectId(id: string): boolean {
  return mongoose.isValidObjectId(id)
}
