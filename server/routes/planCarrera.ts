import { Router } from 'express'
import mongoose from 'mongoose'

import { PlanCarrera } from '../db/models/PlanCarrera.js'

const ESTADOS_ITEM = ['Pendiente', 'En progreso', 'Completado'] as const

/** Lectura y actualización de ítems del plan de carrera. */
export const planCarreraRouter = Router()

planCarreraRouter.put('/item/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador de ítem inválido' })
      return
    }
    const itemOid = new mongoose.Types.ObjectId(id)
    const { estado, notas } = req.body as { estado?: unknown; notas?: unknown }

    const $set: Record<string, string> = {}
    if (estado !== undefined) {
      if (typeof estado !== 'string' || !ESTADOS_ITEM.includes(estado as (typeof ESTADOS_ITEM)[number])) {
        res.status(400).json({ error: 'Estado inválido' })
        return
      }
      $set['items.$.estado'] = estado
    }
    if (notas !== undefined) {
      $set['items.$.notas'] = typeof notas === 'string' ? notas : String(notas ?? '')
    }
    if (Object.keys($set).length === 0) {
      res.status(400).json({ error: 'Envía estado y/o notas' })
      return
    }

    const updated = await PlanCarrera.findOneAndUpdate(
      { 'items._id': itemOid },
      { $set },
      { new: true, runValidators: true },
    ).lean()

    if (!updated) {
      res.status(404).json({ error: 'Ítem no encontrado' })
      return
    }
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

planCarreraRouter.get('/:colaborador_id', async (req, res, next) => {
  try {
    const { colaborador_id } = req.params
    if (!mongoose.isValidObjectId(colaborador_id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const doc = await PlanCarrera.findOne({ colaborador_id }).lean()
    res.json(doc ?? null)
  } catch (err) {
    next(err)
  }
})
