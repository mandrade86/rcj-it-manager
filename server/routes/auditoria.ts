import { Router } from 'express'

import { Auditoria } from '../db/models/Auditoria.js'
import { requirePermiso } from '../middleware/requireAuth.js'

export const auditoriaRouter = Router()

auditoriaRouter.get('/', requirePermiso('roles:ver'), async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const filter: Record<string, unknown> = {}
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [
        { usuario_nombre: rx },
        { accion: rx },
        { entidad: rx },
        { detalle: rx },
        { ip: rx },
      ]
    }
    const rows = await Auditoria.find(filter).sort({ createdAt: -1 }).limit(200).lean()
    res.json(rows.map((r) => ({
      _id: String(r._id),
      usuario_nombre: r.usuario_nombre || '—',
      accion: r.accion,
      entidad: r.entidad,
      entidad_id: r.entidad_id,
      detalle: r.detalle,
      ip: r.ip || '—',
      createdAt: r.createdAt,
    })))
  } catch (err) {
    next(err)
  }
})
