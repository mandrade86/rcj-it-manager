import { Router } from 'express'

import { Config } from '../db/models/Config.js'
import { requirePermiso } from '../middleware/requireAuth.js'

const CLAVE = 'workspace_nombre'
const DEFAULT_NOMBRE = 'Project Management & Talent'

export const workspaceConfigRouter = Router()

workspaceConfigRouter.get('/', async (_req, res, next) => {
  try {
    const doc = await Config.findOne({ clave: CLAVE }).lean() as { valor?: string } | null
    const nombre = typeof doc?.valor === 'string' && doc.valor.trim()
      ? doc.valor.trim()
      : DEFAULT_NOMBRE
    res.json({ nombre })
  } catch (err) {
    next(err)
  }
})

workspaceConfigRouter.put('/', requirePermiso('usuarios:editar'), async (req, res, next) => {
  try {
    const nombre = String((req.body as { nombre?: unknown })?.nombre ?? '').trim().slice(0, 80)
    if (!nombre) {
      res.status(400).json({ error: 'Escribe el nombre del área.' })
      return
    }
    await Config.findOneAndUpdate(
      { clave: CLAVE },
      { valor: nombre },
      { upsert: true },
    )
    res.json({ nombre })
  } catch (err) {
    next(err)
  }
})
