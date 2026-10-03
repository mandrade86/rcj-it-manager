import { Router } from 'express'

import { requirePermiso } from '../middleware/requireAuth.js'
import { guardarTareaEstados, leerTareaEstados } from '../utils/tareaEstados.js'

export const tareaEstadosRouter = Router()

tareaEstadosRouter.get('/', async (_req, res, next) => {
  try {
    res.json(await leerTareaEstados())
  } catch (err) {
    next(err)
  }
})

tareaEstadosRouter.put('/', requirePermiso('proyectos:editar'), async (req, res, next) => {
  try {
    const list = await guardarTareaEstados((req.body as { estados?: unknown })?.estados ?? req.body)
    res.json(list)
  } catch (err) {
    next(err)
  }
})
