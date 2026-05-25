import { Router } from 'express'
import mongoose from 'mongoose'

import { Capacitacion } from '../db/models/Capacitacion.js'
import { ProveedorCapacitacion } from '../db/models/ProveedorCapacitacion.js'
import {
  buildEliminarLoteResponse,
  parseEliminarLoteIds,
} from '../utils/eliminarLote.js'

export const proveedoresCapacitacionRouter = Router()

const ALLOWED = ['nombre', 'descripcion', 'sitio_web', 'contacto', 'activo'] as const

function pickBody(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const k of ALLOWED) if (body[k] !== undefined) out[k] = body[k]
  return out
}

proveedoresCapacitacionRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await ProveedorCapacitacion.find().sort({ nombre: 1 }).lean()
    res.json(rows)
  } catch (err) { next(err) }
})

proveedoresCapacitacionRouter.post('/eliminar-lote', async (req, res, next) => {
  try {
    const parsed = parseEliminarLoteIds((req.body as { ids?: unknown }).ids)
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error })
      return
    }
    const { validIds, omitidos } = parsed
    const found = await ProveedorCapacitacion.find({ _id: { $in: validIds } })
      .select('_id')
      .lean()
    const foundIds = found.map((d) => String(d._id))
    const noEncontrados = validIds.filter((id) => !foundIds.includes(id))
    const eliminar: string[] = []
    const errores: Array<{ id: string; error: string }> = []
    for (const id of foundIds) {
      const inUse = await Capacitacion.exists({ proveedor_id: id })
      if (inUse) {
        errores.push({
          id,
          error: 'Existen capacitaciones vinculadas a este proveedor',
        })
        continue
      }
      eliminar.push(id)
    }
    if (eliminar.length > 0) {
      await ProveedorCapacitacion.deleteMany({ _id: { $in: eliminar } })
    }
    res.json(buildEliminarLoteResponse(eliminar, omitidos, noEncontrados, errores))
  } catch (err) {
    next(err)
  }
})

proveedoresCapacitacionRouter.post('/', async (req, res, next) => {
  try {
    const body = pickBody(req.body as Record<string, unknown>)
    if (typeof body.nombre !== 'string' || !body.nombre.trim()) {
      res.status(400).json({ error: 'El nombre es obligatorio' }); return
    }
    body.nombre = (body.nombre as string).trim()
    const existing = await ProveedorCapacitacion.findOne({
      nombre: { $regex: `^${(body.nombre as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    })
    if (existing) { res.status(409).json({ error: 'Ya existe un proveedor con ese nombre' }); return }
    const doc = await ProveedorCapacitacion.create(body)
    res.status(201).json(doc.toObject())
  } catch (err) { next(err) }
})

proveedoresCapacitacionRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'ID inválido' }); return
    }
    const body = pickBody(req.body as Record<string, unknown>)
    if (Object.keys(body).length === 0) {
      res.status(400).json({ error: 'Sin campos para actualizar' }); return
    }
    const doc = await ProveedorCapacitacion.findByIdAndUpdate(id, body, {
      new: true, runValidators: true,
    }).lean()
    if (!doc) { res.status(404).json({ error: 'Proveedor no encontrado' }); return }
    res.json(doc)
  } catch (err) { next(err) }
})

proveedoresCapacitacionRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'ID inválido' }); return
    }
    const inUse = await Capacitacion.exists({ proveedor_id: id })
    if (inUse) {
      res.status(409).json({
        error: 'No se puede eliminar: existen capacitaciones vinculadas a este proveedor',
      }); return
    }
    await ProveedorCapacitacion.findByIdAndDelete(id)
    res.status(204).send()
  } catch (err) { next(err) }
})
