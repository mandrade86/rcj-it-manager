import { Router } from 'express'

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
          'eTicket no configurado. En el servidor D:\\rcj-it-manager\\.env define ETICKET_API_BASE_URL=https://eticket.rcjcorporacion.com y ETICKET_API_KEY, luego Restart-Service RCJITManager.',
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
