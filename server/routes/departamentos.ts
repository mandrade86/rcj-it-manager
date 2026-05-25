import { Router } from 'express'
import mongoose from 'mongoose'

import { Departamento } from '../db/models/Departamento.js'
import { normalizarMetasBody } from '../utils/metasDepartamento.js'
import {
  buildEliminarLoteResponse,
  parseEliminarLoteIds,
} from '../utils/eliminarLote.js'

export const departamentosRouter = Router()

function normalizarEjes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const eje = item.trim()
    if (!eje || seen.has(eje.toLowerCase())) continue
    seen.add(eje.toLowerCase())
    out.push(eje)
  }
  return out
}

departamentosRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await Departamento.find()
      .populate('empresa_id', 'nombre codigo ehr_empresa_id')
      .sort({ ehr_empresa_id: 1, nombre: 1 })
      .lean()
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

departamentosRouter.post('/eliminar-lote', async (req, res, next) => {
  try {
    const parsed = parseEliminarLoteIds((req.body as { ids?: unknown }).ids)
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error })
      return
    }
    const { validIds, omitidos } = parsed
    const found = await Departamento.find({ _id: { $in: validIds } }).select('_id').lean()
    const eliminar = found.map((d) => String(d._id))
    const noEncontrados = validIds.filter((id) => !eliminar.includes(id))
    if (eliminar.length > 0) {
      await Departamento.deleteMany({ _id: { $in: eliminar } })
    }
    res.json(buildEliminarLoteResponse(eliminar, omitidos, noEncontrados))
  } catch (err) {
    next(err)
  }
})

departamentosRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const doc = await Departamento.findById(id).populate('empresa_id', 'nombre codigo ehr_empresa_id').lean()
    if (!doc) { res.status(404).json({ error: 'Departamento no encontrado' }); return }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

departamentosRouter.post('/', async (req, res, next) => {
  try {
    const {
      codigo,
      nombre,
      descripcion,
      color,
      activo,
      ejes_proyecto,
      lleva_gastos,
      archivo_gastos,
    } = req.body as Record<string, unknown>
    if (!codigo || !nombre) {
      res.status(400).json({ error: 'Código y nombre son obligatorios' })
      return
    }
    const llevaGastos = Boolean(lleva_gastos)
    const archivo = typeof archivo_gastos === 'string' ? archivo_gastos.trim() : ''
    const doc = await Departamento.create({
      codigo,
      nombre,
      descripcion,
      color,
      activo,
      ejes_proyecto: normalizarEjes(ejes_proyecto),
      lleva_gastos: llevaGastos,
      archivo_gastos: llevaGastos ? archivo : '',
    })
    res.status(201).json(doc)
  } catch (err) {
    next(err)
  }
})

departamentosRouter.put('/:id/metas', async (req, res, next) => {
  try {
    const u = req.user
    if (!u) {
      res.status(401).json({ error: 'No autenticado' })
      return
    }
    if (
      !u.permisos.includes('*') &&
      !u.permisos.includes('kpis:editar') &&
      !u.permisos.includes('maestros:editar')
    ) {
      res.status(403).json({ error: 'No tienes permiso para configurar metas' })
      return
    }
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const metas = normalizarMetasBody((req.body as { metas_estrategicas?: unknown }).metas_estrategicas)
    if (!metas) {
      res.status(400).json({ error: 'Envía metas_estrategicas como arreglo de 5 metas.' })
      return
    }
    const doc = await Departamento.findByIdAndUpdate(
      id,
      { $set: { metas_estrategicas: metas } },
      { new: true, runValidators: true },
    )
      .populate('empresa_id', 'nombre codigo ehr_empresa_id')
      .lean()
    if (!doc) {
      res.status(404).json({ error: 'Departamento no encontrado' })
      return
    }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

departamentosRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const { _id, __v, createdAt, updatedAt, ...rest } = req.body as Record<string, unknown>
    void _id; void __v; void createdAt; void updatedAt
    if (rest.ejes_proyecto !== undefined) {
      rest.ejes_proyecto = normalizarEjes(rest.ejes_proyecto)
    }
    if (rest.lleva_gastos !== undefined) {
      rest.lleva_gastos = Boolean(rest.lleva_gastos)
    }
    if (rest.archivo_gastos !== undefined) {
      rest.archivo_gastos = typeof rest.archivo_gastos === 'string'
        ? (rest.archivo_gastos as string).trim()
        : ''
    }
    // Si desactivan el manejo de gastos, limpiamos el archivo asociado.
    if (rest.lleva_gastos === false) {
      rest.archivo_gastos = ''
    }
    const doc = await Departamento.findByIdAndUpdate(id, rest, {
      new: true, runValidators: true,
    }).lean()
    if (!doc) { res.status(404).json({ error: 'Departamento no encontrado' }); return }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

departamentosRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    await Departamento.findByIdAndDelete(id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
