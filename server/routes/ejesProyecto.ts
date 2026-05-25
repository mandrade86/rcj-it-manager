import { Router } from 'express'
import mongoose from 'mongoose'

import { EjeProyecto } from '../db/models/EjeProyecto.js'
import {
  buildEliminarLoteResponse,
  parseEliminarLoteIds,
} from '../utils/eliminarLote.js'

export const ejesProyectoRouter = Router()

ejesProyectoRouter.get('/', async (req, res, next) => {
  try {
    const q = req.query.activo
    const filter: Record<string, unknown> = {}
    if (q === 'true' || q === '1') filter.activo = true
    if (q === 'false' || q === '0') filter.activo = false
    const rows = await EjeProyecto.find(filter).sort({ orden: 1, nombre: 1 }).lean()
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

ejesProyectoRouter.post('/eliminar-lote', async (req, res, next) => {
  try {
    const parsed = parseEliminarLoteIds((req.body as { ids?: unknown }).ids)
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error })
      return
    }
    const { validIds, omitidos } = parsed
    const found = await EjeProyecto.find({ _id: { $in: validIds } }).select('_id').lean()
    const eliminar = found.map((d) => String(d._id))
    const noEncontrados = validIds.filter((id) => !eliminar.includes(id))
    if (eliminar.length > 0) {
      await EjeProyecto.deleteMany({ _id: { $in: eliminar } })
    }
    res.json(buildEliminarLoteResponse(eliminar, omitidos, noEncontrados))
  } catch (err) {
    next(err)
  }
})

ejesProyectoRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const doc = await EjeProyecto.findById(id).lean()
    if (!doc) {
      res.status(404).json({ error: 'Eje no encontrado' })
      return
    }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

ejesProyectoRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>
    const codigo = typeof body.codigo === 'string' ? body.codigo.trim().toUpperCase() : ''
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
    if (!codigo || !nombre) {
      res.status(400).json({ error: 'Código y nombre son obligatorios' })
      return
    }
    const doc = await EjeProyecto.create({
      codigo,
      nombre,
      descripcion: typeof body.descripcion === 'string' ? body.descripcion : '',
      color: typeof body.color === 'string' && body.color.trim() ? body.color.trim() : '#1F4E79',
      orden: typeof body.orden === 'number' && Number.isFinite(body.orden) ? body.orden : 0,
      activo: body.activo !== false,
    })
    res.status(201).json(doc)
  } catch (err) {
    next(err)
  }
})

ejesProyectoRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const { _id, __v, createdAt, updatedAt, ...rest } = req.body as Record<string, unknown>
    void _id
    void __v
    void createdAt
    void updatedAt
    if (typeof rest.codigo === 'string') rest.codigo = rest.codigo.trim().toUpperCase()
    if (typeof rest.nombre === 'string') rest.nombre = rest.nombre.trim()
    const doc = await EjeProyecto.findByIdAndUpdate(id, rest, { new: true, runValidators: true }).lean()
    if (!doc) {
      res.status(404).json({ error: 'Eje no encontrado' })
      return
    }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

ejesProyectoRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    await EjeProyecto.findByIdAndDelete(id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
