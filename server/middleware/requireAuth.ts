import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

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

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No autorizado. Inicia sesión.' })
    return
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
    req.user = payload
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
