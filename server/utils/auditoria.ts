import type { NextFunction, Request, Response } from 'express'

import { Auditoria } from '../db/models/Auditoria.js'

export function clientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0]!.trim().slice(0, 64)
  return (req.ip || req.socket.remoteAddress || '').slice(0, 64)
}

export async function registrarAuditoria(entry: {
  usuario_id?: string
  usuario_nombre?: string
  accion: string
  entidad?: string
  entidad_id?: string
  detalle?: string
  ip?: string
}): Promise<void> {
  await Auditoria.create({
    usuario_id: entry.usuario_id ?? '',
    usuario_nombre: entry.usuario_nombre ?? '',
    accion: entry.accion.slice(0, 40),
    entidad: (entry.entidad ?? '').slice(0, 40),
    entidad_id: (entry.entidad_id ?? '').slice(0, 80),
    detalle: (entry.detalle ?? '').slice(0, 240),
    ip: entry.ip ?? '',
  })
}

function etiquetaRuta(path: string): { entidad: string; entidad_id: string } {
  const parts = path.replace(/^\/api\//, '').split('/').filter(Boolean)
  return {
    entidad: parts[0] ?? 'api',
    entidad_id: parts[1] ?? '',
  }
}

/** Registra POST/PUT/PATCH/DELETE que terminan bien. No guarda el cuerpo. */
export function auditMutations(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return
    if (res.statusCode >= 400) return
    const path = req.originalUrl.split('?')[0] ?? ''
    if (path.startsWith('/api/auditoria') || path.startsWith('/api/buscar')) return
    const { entidad, entidad_id } = etiquetaRuta(path)
    const accion = req.method === 'POST' ? 'crear' : req.method === 'DELETE' ? 'eliminar' : 'editar'
    void registrarAuditoria({
      usuario_id: req.user?._id,
      usuario_nombre: req.user?.nombre,
      accion,
      entidad,
      entidad_id,
      detalle: `${req.method} ${path}`.slice(0, 240),
      ip: clientIp(req),
    }).catch(() => undefined)
  })
  next()
}
