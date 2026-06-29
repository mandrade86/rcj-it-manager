import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

import { Usuario } from '../db/models/Usuario.js'

export const JWT_SECRET = process.env.JWT_SECRET ?? 'rcj_it_2026_local_secret'

export type JwtPayload = {
  _id: string
  email: string
  nombre: string
  rol: string
  permisos: string[]
  /** ID del Empleado al que está amarrado el usuario (puede no existir). */
  empleado_id?: string | null
  empleado_codigo?: string | null
  empleado_nombre?: string | null
  /** Departamento asignado al usuario (no al empleado). */
  departamento_id?: string | null
  departamento_codigo?: string | null
  departamento_nombre?: string | null
  departamento_lleva_gastos?: boolean
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No autorizado. Inicia sesión.' })
    return
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
    const user = await Usuario.findById(payload._id)
      .select('activo rol_id departamento_id empleado_id email nombre')
      .populate<{ rol_id: { nombre?: string; permisos?: string[] } | null }>(
        'rol_id',
        'nombre permisos',
      )
      .populate<{ departamento_id: { codigo?: string; nombre?: string; lleva_gastos?: boolean } | null }>(
        'departamento_id',
        'codigo nombre lleva_gastos',
      )
      .populate<{ empleado_id: { _id: unknown; codigo?: string; nombre?: string } | null }>(
        'empleado_id',
        'codigo nombre',
      )
      .lean()

    if (!user || user.activo === false) {
      res.status(401).json({ error: 'Usuario inactivo o no encontrado.' })
      return
    }

    const rol = user.rol_id as { nombre?: string; permisos?: string[] } | null
    const dept = user.departamento_id as {
      _id?: unknown
      codigo?: string
      nombre?: string
      lleva_gastos?: boolean
    } | null
    const emp = user.empleado_id as { _id?: unknown; codigo?: string; nombre?: string } | null

    req.user = {
      _id: String(user._id),
      email: user.email ?? payload.email,
      nombre: user.nombre ?? payload.nombre,
      rol: rol?.nombre ?? payload.rol,
      permisos: rol?.permisos ?? [],
      empleado_id: emp?._id != null ? String(emp._id) : payload.empleado_id ?? null,
      empleado_codigo: emp?.codigo ?? payload.empleado_codigo ?? null,
      empleado_nombre: emp?.nombre ?? payload.empleado_nombre ?? null,
      departamento_id: dept?._id != null ? String(dept._id) : payload.departamento_id ?? null,
      departamento_codigo: dept?.codigo ?? payload.departamento_codigo ?? null,
      departamento_nombre: dept?.nombre ?? payload.departamento_nombre ?? null,
      departamento_lleva_gastos: dept ? Boolean(dept.lleva_gastos) : payload.departamento_lleva_gastos,
    }
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado. Inicia sesión nuevamente.' })
  }
}

export function requirePermiso(permiso: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user
    if (!user) { res.status(401).json({ error: 'No autorizado' }); return }
    if (user.permisos.includes('*') || user.permisos.includes(permiso)) {
      next()
      return
    }
    res.status(403).json({ error: 'Sin permiso para esta acción' })
  }
}
