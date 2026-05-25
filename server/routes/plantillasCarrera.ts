import { Router } from 'express'
import mongoose from 'mongoose'

import { PlantillaCarrera } from '../db/models/PlantillaCarrera.js'
import { PlanCarrera } from '../db/models/PlanCarrera.js'
import {
  buildEliminarLoteResponse,
  parseEliminarLoteIds,
} from '../utils/eliminarLote.js'

export const plantillasCarreraRouter = Router()

const ALLOWED = ['nombre', 'descripcion', 'departamento_id', 'tipo_ruta', 'activo', 'items'] as const

function pickBody(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const k of ALLOWED) if (body[k] !== undefined) out[k] = body[k]
  return out
}

plantillasCarreraRouter.get('/', async (req, res, next) => {
  try {
    const { departamento_id } = req.query
    const filter: Record<string, unknown> = {}
    if (typeof departamento_id === 'string' && mongoose.isValidObjectId(departamento_id)) {
      filter.departamento_id = new mongoose.Types.ObjectId(departamento_id)
    }
    const rows = await PlantillaCarrera.find(filter)
      .populate('departamento_id', 'codigo nombre color')
      .sort({ nombre: 1 })
      .lean()
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

plantillasCarreraRouter.post('/eliminar-lote', async (req, res, next) => {
  try {
    const parsed = parseEliminarLoteIds((req.body as { ids?: unknown }).ids)
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error })
      return
    }
    const { validIds, omitidos } = parsed
    const found = await PlantillaCarrera.find({ _id: { $in: validIds } }).select('_id').lean()
    const eliminar = found.map((d) => String(d._id))
    const noEncontrados = validIds.filter((id) => !eliminar.includes(id))
    if (eliminar.length > 0) {
      await PlantillaCarrera.deleteMany({ _id: { $in: eliminar } })
    }
    res.json(buildEliminarLoteResponse(eliminar, omitidos, noEncontrados))
  } catch (err) {
    next(err)
  }
})

plantillasCarreraRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const doc = await PlantillaCarrera.findById(id)
      .populate('departamento_id', 'codigo nombre color')
      .lean()
    if (!doc) { res.status(404).json({ error: 'Plantilla no encontrada' }); return }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

plantillasCarreraRouter.post('/', async (req, res, next) => {
  try {
    const body = pickBody(req.body as Record<string, unknown>)
    if (!body.nombre || !body.tipo_ruta) {
      res.status(400).json({ error: 'Nombre y tipo_ruta son obligatorios' })
      return
    }
    if (!body.items) body.items = []
    const doc = await PlantillaCarrera.create(body)
    const full = await PlantillaCarrera.findById(doc._id)
      .populate('departamento_id', 'codigo nombre color')
      .lean()
    res.status(201).json(full)
  } catch (err) {
    next(err)
  }
})

plantillasCarreraRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const body = pickBody(req.body as Record<string, unknown>)
    if (Object.keys(body).length === 0) {
      res.status(400).json({ error: 'Sin campos para actualizar' })
      return
    }
    const doc = await PlantillaCarrera.findByIdAndUpdate(id, body, {
      new: true, runValidators: true,
    }).populate('departamento_id', 'codigo nombre color').lean()
    if (!doc) { res.status(404).json({ error: 'Plantilla no encontrada' }); return }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

plantillasCarreraRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    await PlantillaCarrera.findByIdAndDelete(id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

/** POST /api/plantillas-carrera/asignar — instancia la plantilla para un colaborador */
plantillasCarreraRouter.post('/asignar', async (req, res, next) => {
  try {
    const { colaborador_id, plantilla_id, fecha_inicio, periodo_estimado, responsable_seguimiento } =
      req.body as Record<string, unknown>

    if (!colaborador_id || !mongoose.isValidObjectId(colaborador_id as string)) {
      res.status(400).json({ error: 'colaborador_id inválido' })
      return
    }
    if (!plantilla_id || !mongoose.isValidObjectId(plantilla_id as string)) {
      res.status(400).json({ error: 'plantilla_id inválido' })
      return
    }

    const plantilla = await PlantillaCarrera.findById(plantilla_id).lean()
    if (!plantilla) { res.status(404).json({ error: 'Plantilla no encontrada' }); return }

    const existe = await PlanCarrera.findOne({ colaborador_id }).lean()
    if (existe) {
      res.status(409).json({ error: 'El colaborador ya tiene un plan de carrera asignado' })
      return
    }

    const items = (plantilla.items ?? []).map((it) => ({
      codigo: it.codigo,
      seccion: it.seccion,
      requisito: it.requisito,
      tipo_requisito: it.tipo_requisito,
      plazo_estimado: it.plazo_estimado,
      recurso: it.recurso,
      estado: 'Pendiente' as const,
      notas: '',
    }))

    const plan = await PlanCarrera.create({
      colaborador_id,
      plantilla_id,
      tipo: plantilla.tipo_ruta,
      fecha_inicio: fecha_inicio ? new Date(fecha_inicio as string) : new Date(),
      periodo_estimado: periodo_estimado ?? plantilla.descripcion,
      responsable_seguimiento,
      items,
    })

    res.status(201).json(plan)
  } catch (err) {
    next(err)
  }
})
