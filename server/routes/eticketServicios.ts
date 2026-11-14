import { Router } from 'express'

import { Proyecto } from '../db/models/Proyecto.js'
import { ServicioEticket } from '../db/models/ServicioEticket.js'
import {
  diagnosticarEticket,
  eticketConfigPublic,
  isEticketConfigured,
} from '../utils/eticketClient.js'
import { sincronizarServiciosEticket } from '../utils/eticketSync.js'

export const eticketServiciosRouter = Router()

/** Admin (*), permiso dedicado, o quien ya ve proyectos. */
function canViewEticket(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
): void {
  const user = req.user
  if (!user) {
    res.status(401).json({ error: 'No autorizado' })
    return
  }
  const ok =
    user.permisos.includes('*') ||
    user.permisos.includes('eticket:servicios:ver') ||
    user.permisos.includes('proyectos:ver') ||
    user.permisos.includes('proyectos:ver-todos')
  if (!ok) {
    res.status(403).json({ error: 'Sin permiso para servicios eTicket' })
    return
  }
  next()
}

const canView = canViewEticket

eticketServiciosRouter.get('/status', canView, (_req, res) => {
  const cfg = eticketConfigPublic()
  res.json({
    ok: true,
    ...cfg,
    cron: process.env.ETICKET_SYNC_CRON === 'true',
    intervalo_minutos: Number(process.env.ETICKET_SYNC_INTERVAL_MINUTES) || 15,
  })
})

eticketServiciosRouter.get('/diag', canView, async (_req, res) => {
  try {
    const diag = await diagnosticarEticket()
    res.status(diag.ok ? 200 : 502).json(diag)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: msg, ...eticketConfigPublic() })
  }
})

eticketServiciosRouter.get('/', canView, async (req, res) => {
  try {
    const q = String(req.query.q ?? '').trim()
    const proyectoId = String(req.query.proyecto_id ?? '').trim()
    const sinProyecto = req.query.sin_proyecto === '1' || req.query.sin_proyecto === 'true'
    const filter: Record<string, unknown> = {}
    if (q) {
      const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$or = [
        { title: new RegExp(esc, 'i') },
        { ticketNumber: new RegExp(esc, 'i') },
        { requesterEmail: new RegExp(esc, 'i') },
        { system: new RegExp(esc, 'i') },
        { externalId: q },
      ]
    }
    if (sinProyecto) {
      filter.$and = [
        ...(Array.isArray(filter.$and) ? (filter.$and as unknown[]) : []),
        { $or: [{ proyecto_id: null }, { proyecto_id: '' }, { proyecto_id: { $exists: false } }] },
      ]
    } else if (proyectoId) {
      filter.proyecto_id = proyectoId
    }
    const items = await ServicioEticket.find(filter)
      .sort({ importedAt: -1, createdAt: -1 })
      .limit(200)
      .lean()
    res.json({ items, total: items.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[eticket] GET / falló:', msg)
    res.status(500).json({ error: msg, detalle: msg })
  }
})

eticketServiciosRouter.post('/sync', canView, async (_req, res) => {
  try {
    if (!isEticketConfigured()) {
      res.status(503).json({
        error:
          'eTicket no configurado. En el servidor define ETICKET_API_BASE_URL=https://nitnbof6w9.execute-api.us-east-1.amazonaws.com/prod y ETICKET_API_KEY, luego reinicia el portal.',
      })
      return
    }
    const result = await sincronizarServiciosEticket()
    res.json({ ok: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[eticket-sync] POST /sync falló:', msg)
    res.status(502).json({ error: msg, detalle: msg })
  }
})

eticketServiciosRouter.patch('/:id/proyecto', canView, async (req, res) => {
  try {
    const id = req.params.id
    const rawId = req.body?.proyecto_id
    const proyectoId =
      rawId === null || rawId === undefined || rawId === ''
        ? null
        : String(rawId).trim()

    let doc = null as { _id: unknown } | null
    if (/^[a-fA-F0-9]{24}$/.test(id)) {
      doc = (await ServicioEticket.findById(id).select('_id')) as { _id: unknown } | null
    }
    if (!doc) {
      doc = (await ServicioEticket.findOne({
        $or: [{ externalId: id }, { ticketNumber: id }],
      }).select('_id')) as { _id: unknown } | null
    }
    if (!doc) {
      res.status(404).json({ error: 'Servicio no encontrado' })
      return
    }

    let proyectoNombre = ''
    if (proyectoId) {
      const proy = await Proyecto.findById(proyectoId).select('_id nombre').lean()
      if (!proy) {
        res.status(400).json({ error: `Proyecto no encontrado: ${proyectoId}` })
        return
      }
      proyectoNombre = String(proy.nombre ?? '')
    }

    const updated = await ServicioEticket.findByIdAndUpdate(
      doc._id,
      {
        $set: {
          proyecto_id: proyectoId,
          proyecto_nombre: proyectoNombre,
          asignado_at: proyectoId ? new Date() : null,
          asignado_por: proyectoId ? (req.user?.email || req.user?.nombre || '') : '',
        },
      },
      { new: true },
    ).lean()

    res.json(updated)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg, detalle: msg })
  }
})

eticketServiciosRouter.get('/:id', canView, async (req, res) => {
  try {
    const id = req.params.id
    let doc = null as Record<string, unknown> | null
    if (/^[a-fA-F0-9]{24}$/.test(id)) {
      doc = (await ServicioEticket.findById(id).lean()) as Record<string, unknown> | null
    }
    if (!doc) {
      doc = (await ServicioEticket.findOne({
        $or: [{ externalId: id }, { ticketNumber: id }],
      }).lean()) as Record<string, unknown> | null
    }
    if (!doc) {
      res.status(404).json({ error: 'Servicio no encontrado' })
      return
    }
    res.json(doc)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg, detalle: msg })
  }
})
