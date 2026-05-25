import { Router } from 'express'
import mongoose from 'mongoose'

import { KPI } from '../db/models/KPI.js'

export const kpiRegistrosRouter = Router()

kpiRegistrosRouter.get('/', async (req, res, next) => {
  try {
    const { kpi_id } = req.query
    if (typeof kpi_id !== 'string' || !mongoose.isValidObjectId(kpi_id)) {
      res.status(400).json({ error: 'Query kpi_id inválido o ausente' })
      return
    }
    const doc = await KPI.findById(kpi_id).select('nombre eje meta unidad registros').lean()
    if (!doc) {
      res.status(404).json({ error: 'KPI no encontrado' })
      return
    }
    const registros = [...(doc.registros ?? [])].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
    )
    res.json({
      kpi_id: doc._id,
      nombre: doc.nombre,
      eje: doc.eje,
      meta: doc.meta,
      unidad: doc.unidad,
      registros,
    })
  } catch (err) {
    next(err)
  }
})

kpiRegistrosRouter.post('/', async (req, res, next) => {
  try {
    const { kpi_id, fecha, valor, notas } = req.body as Record<string, unknown>
    if (typeof kpi_id !== 'string' || !mongoose.isValidObjectId(kpi_id)) {
      res.status(400).json({ error: 'kpi_id inválido' })
      return
    }
    if (fecha === undefined || fecha === null || fecha === '') {
      res.status(400).json({ error: 'La fecha es obligatoria' })
      return
    }
    const v =
      valor === undefined || valor === null || valor === ''
        ? undefined
        : Number(valor)
    if (v !== undefined && Number.isNaN(v)) {
      res.status(400).json({ error: 'valor debe ser numérico' })
      return
    }
    const doc = await KPI.findById(kpi_id)
    if (!doc) {
      res.status(404).json({ error: 'KPI no encontrado' })
      return
    }
    doc.registros.push({
      fecha: new Date(fecha as string | Date),
      valor: v,
      notas: typeof notas === 'string' ? notas : notas != null ? String(notas) : undefined,
    })
    await doc.save()
    const lean = await KPI.findById(kpi_id).lean()
    res.status(201).json(lean)
  } catch (err) {
    next(err)
  }
})
