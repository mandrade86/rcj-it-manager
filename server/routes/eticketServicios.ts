import { Router } from 'express'

import { ServicioEticket } from '../db/models/ServicioEticket.js'
import { requirePermiso } from '../middleware/requireAuth.js'
import { isEticketConfigured } from '../utils/eticketClient.js'
import { sincronizarServiciosEticket } from '../utils/eticketSync.js'

export const eticketServiciosRouter = Router()

const canView = requirePermiso('eticket:servicios:ver')

eticketServiciosRouter.get('/status', canView, (_req, res) => {
  res.json({
    ok: true,
    configurado: isEticketConfigured(),
    base_url: Boolean((process.env.ETICKET_API_BASE_URL ?? '').trim()),
    cron: process.env.ETICKET_SYNC_CRON === 'true',
    intervalo_minutos: Number(process.env.ETICKET_SYNC_INTERVAL_MINUTES) || 15,
  })
})

eticketServiciosRouter.get('/', canView, async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim()
    const filter: Record<string, unknown> = {}
    if (q) {
      filter.$or = [
        { title: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { ticketNumber: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { requesterEmail: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { system: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { externalId: q },
      ]
    }
    const items = await ServicioEticket.find(filter).sort({ importedAt: -1, createdAt: -1 }).limit(200).lean()
    res.json({ items, total: items.length })
  } catch (err) {
    next(err)
  }
})

eticketServiciosRouter.post('/sync', canView, async (_req, res, next) => {
  try {
    if (!isEticketConfigured()) {
      res.status(503).json({
        error: 'eTicket no configurado. Define ETICKET_API_BASE_URL y ETICKET_API_KEY en el .env.',
      })
      return
    }
    const result = await sincronizarServiciosEticket()
    res.json({ ok: true, ...result })
  } catch (err) {
    next(err)
  }
})

eticketServiciosRouter.get('/:id', canView, async (req, res, next) => {
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
    next(err)
  }
})
