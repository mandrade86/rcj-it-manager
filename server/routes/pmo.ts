import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'

import { authCtxDesdeJwt } from '../utils/pmoAuth.js'
import {
  buildBriefingPersonal,
  buildBriefingPortafolio,
} from '../utils/pmoBriefing.js'
import { responderPmo } from '../utils/pmoIntents.js'
import { puedePmoPersonal, puedePmoPortafolio } from '../utils/pmoPermisos.js'

export const pmoRouter = Router()

function requirePmoPersonal(req: Request, res: Response, next: NextFunction): void {
  const u = req.user
  if (!u) { res.status(401).json({ error: 'No autorizado' }); return }
  if (!puedePmoPersonal(u.permisos)) {
    res.status(403).json({ error: 'Sin permiso pmo:personal (o proyectos:ver / dashboard:ver)' })
    return
  }
  next()
}

function requirePmoPortafolio(req: Request, res: Response, next: NextFunction): void {
  const u = req.user
  if (!u) { res.status(401).json({ error: 'No autorizado' }); return }
  if (!puedePmoPortafolio(u.permisos)) {
    res.status(403).json({ error: 'Sin permiso pmo:portafolio (o proyectos:ver-todos)' })
    return
  }
  next()
}

pmoRouter.get('/briefing/personal', requirePmoPersonal, async (req, res, next) => {
  try {
    const ctx = authCtxDesdeJwt(req.user!)
    res.json(await buildBriefingPersonal(ctx))
  } catch (err) {
    next(err)
  }
})

pmoRouter.get('/briefing/portafolio', requirePmoPortafolio, async (req, res, next) => {
  try {
    const ctx = authCtxDesdeJwt(req.user!)
    const dept = typeof req.query.departamento_id === 'string' ? req.query.departamento_id : null
    res.json(await buildBriefingPortafolio(ctx, dept))
  } catch (err) {
    next(err)
  }
})

pmoRouter.post('/preguntar', requirePmoPersonal, async (req, res, next) => {
  try {
    const texto = String((req.body as { texto?: unknown })?.texto ?? '').trim()
    if (!texto) {
      res.status(400).json({ error: 'Envía { texto: "..." }' })
      return
    }
    const ctx = authCtxDesdeJwt(req.user!)
    res.json(await responderPmo(texto, ctx))
  } catch (err) {
    next(err)
  }
})
