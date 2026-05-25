import { Router } from 'express'
import mongoose from 'mongoose'

import { KPI } from '../db/models/KPI.js'
import { PerfilPuesto } from '../db/models/PerfilPuesto.js'
import { requirePermiso } from '../middleware/requireAuth.js'
import {
  buildEliminarLoteResponse,
  parseEliminarLoteIds,
} from '../utils/eliminarLote.js'

export const perfilesPuestoRouter = Router()

const ALLOWED = [
  'codigo', 'titulo', 'departamento_id', 'nivel', 'reporta_a', 'objetivo',
  'requisitos', 'responsabilidades', 'autoridad', 'educacion', 'experiencia',
  'competencias', 'tiene_personal_a_cargo', 'rubrica_criterios', 'notas',
] as const

function pickBody(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const k of ALLOWED) if (body[k] !== undefined) out[k] = body[k]
  return out
}

/** Sanitiza un arreglo de criterios para la rúbrica. */
function normalizarCriterios(raw: unknown): { categoria: string; criterio: string; descripcion: string }[] {
  if (!Array.isArray(raw)) return []
  const out: { categoria: string; criterio: string; descripcion: string }[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const cat = typeof r.categoria === 'string' ? r.categoria.trim() : ''
    const crit = typeof r.criterio === 'string' ? r.criterio.trim() : ''
    if (!cat || !crit) continue
    out.push({
      categoria: cat,
      criterio: crit,
      descripcion: typeof r.descripcion === 'string' ? r.descripcion.trim() : '',
    })
  }
  return out
}

perfilesPuestoRouter.get('/', async (req, res, next) => {
  try {
    const { departamento_id } = req.query
    const filter: Record<string, unknown> = {}
    if (typeof departamento_id === 'string' && mongoose.isValidObjectId(departamento_id)) {
      filter.departamento_id = new mongoose.Types.ObjectId(departamento_id)
    }
    const rows = await PerfilPuesto.find(filter)
      .populate('departamento_id', 'codigo nombre color')
      .sort({ codigo: 1 })
      .lean()
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

/** GET /api/perfiles-puesto/:id/rubrica — devuelve solo los criterios de la rúbrica del perfil. */
perfilesPuestoRouter.get('/:id/rubrica', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const doc = await PerfilPuesto.findById(id).select('codigo titulo rubrica_criterios').lean()
    if (!doc) { res.status(404).json({ error: 'Perfil no encontrado' }); return }
    res.json({
      perfil_id: doc._id,
      codigo: doc.codigo,
      titulo: doc.titulo,
      criterios: doc.rubrica_criterios ?? [],
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/perfiles-puesto/:id/kpis-evaluacion
 * Devuelve los KPIs configurados (ponderados) que componen la evaluación
 * por cumplimiento de KPI para este perfil de puesto.
 *
 * Lectura libre para roles con acceso al maestro. La modificación es admin-only.
 */
perfilesPuestoRouter.get('/:id/kpis-evaluacion', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const doc = await PerfilPuesto.findById(id)
      .select('codigo titulo kpis_evaluacion')
      .populate({
        path: 'kpis_evaluacion.kpi_id',
        select: 'nombre eje meta unidad frecuencia descripcion',
      })
      .lean()
    if (!doc) {
      res.status(404).json({ error: 'Perfil no encontrado' })
      return
    }
    const items = (doc.kpis_evaluacion ?? []).map((it: { kpi_id: unknown; peso: number; descripcion?: string }) => {
      const kpi = it.kpi_id as { _id?: unknown; nombre?: string; eje?: string; meta?: string; unidad?: string; frecuencia?: string; descripcion?: string } | string | null
      const kpiObj = kpi && typeof kpi === 'object' ? kpi : null
      return {
        kpi_id: kpiObj?._id ?? kpi,
        kpi: kpiObj
          ? {
              _id: kpiObj._id,
              nombre: kpiObj.nombre,
              eje: kpiObj.eje,
              meta: kpiObj.meta,
              unidad: kpiObj.unidad,
              frecuencia: kpiObj.frecuencia,
              descripcion: kpiObj.descripcion,
            }
          : null,
        peso: it.peso,
        descripcion: it.descripcion ?? '',
      }
    })
    const totalPeso = items.reduce((acc, it) => acc + (Number(it.peso) || 0), 0)
    res.json({
      perfil_id: doc._id,
      codigo: doc.codigo,
      titulo: doc.titulo,
      items,
      total_peso: totalPeso,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * PUT /api/perfiles-puesto/:id/kpis-evaluacion
 * Reemplaza completamente la lista. Solo Administrador (permiso `*`).
 * Body: { items: [{ kpi_id, peso, descripcion? }] }
 * La suma de pesos debe ser exactamente 100.
 */
perfilesPuestoRouter.put('/:id/kpis-evaluacion', requirePermiso('*'), async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const raw = (req.body as { items?: unknown }).items
    if (!Array.isArray(raw)) {
      res.status(400).json({ error: 'items debe ser un arreglo' })
      return
    }
    const items: { kpi_id: mongoose.Types.ObjectId; peso: number; descripcion: string }[] = []
    const seen = new Set<string>()
    for (const it of raw) {
      if (!it || typeof it !== 'object') continue
      const r = it as Record<string, unknown>
      const kid = typeof r.kpi_id === 'string' ? r.kpi_id : ''
      if (!mongoose.isValidObjectId(kid)) continue
      if (seen.has(kid)) {
        res.status(400).json({ error: `KPI duplicado en la lista: ${kid}` })
        return
      }
      seen.add(kid)
      const peso = Number(r.peso)
      if (!Number.isFinite(peso) || peso < 0 || peso > 100) {
        res.status(400).json({ error: 'El peso debe estar entre 0 y 100' })
        return
      }
      items.push({
        kpi_id: new mongoose.Types.ObjectId(kid),
        peso,
        descripcion: typeof r.descripcion === 'string' ? r.descripcion.trim() : '',
      })
    }
    if (items.length === 0) {
      res.status(400).json({ error: 'Debes seleccionar al menos un KPI' })
      return
    }
    const totalPeso = items.reduce((acc, it) => acc + it.peso, 0)
    if (Math.abs(totalPeso - 100) > 0.01) {
      res.status(400).json({
        error: `La suma de pesos debe ser 100. Actual: ${totalPeso}`,
      })
      return
    }
    // Verificar que todos los KPIs existen
    const kpiCount = await KPI.countDocuments({ _id: { $in: items.map((it) => it.kpi_id) } })
    if (kpiCount !== items.length) {
      res.status(400).json({ error: 'Algún KPI seleccionado ya no existe' })
      return
    }
    const doc = await PerfilPuesto.findByIdAndUpdate(
      id,
      { kpis_evaluacion: items },
      { new: true, runValidators: true },
    )
      .select('codigo titulo kpis_evaluacion')
      .populate({
        path: 'kpis_evaluacion.kpi_id',
        select: 'nombre eje meta unidad frecuencia descripcion',
      })
      .lean()
    if (!doc) {
      res.status(404).json({ error: 'Perfil no encontrado' })
      return
    }
    res.json({
      perfil_id: doc._id,
      codigo: doc.codigo,
      titulo: doc.titulo,
      items: doc.kpis_evaluacion ?? [],
      total_peso: 100,
    })
  } catch (err) {
    next(err)
  }
})

/** PUT /api/perfiles-puesto/:id/rubrica — reemplaza la rúbrica del perfil. */
perfilesPuestoRouter.put('/:id/rubrica', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const criterios = normalizarCriterios((req.body as { criterios?: unknown }).criterios)
    if (criterios.length === 0) {
      res.status(400).json({ error: 'Debes enviar al menos un criterio válido (categoria y criterio).' })
      return
    }
    const doc = await PerfilPuesto.findByIdAndUpdate(
      id,
      { rubrica_criterios: criterios },
      { new: true, runValidators: true },
    ).select('codigo titulo rubrica_criterios').lean()
    if (!doc) { res.status(404).json({ error: 'Perfil no encontrado' }); return }
    res.json({
      perfil_id: doc._id,
      codigo: doc.codigo,
      titulo: doc.titulo,
      criterios: doc.rubrica_criterios ?? [],
    })
  } catch (err) {
    next(err)
  }
})

perfilesPuestoRouter.post('/eliminar-lote', async (req, res, next) => {
  try {
    const parsed = parseEliminarLoteIds((req.body as { ids?: unknown }).ids)
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error })
      return
    }
    const { validIds, omitidos } = parsed
    const found = await PerfilPuesto.find({ _id: { $in: validIds } }).select('_id').lean()
    const eliminar = found.map((d) => String(d._id))
    const noEncontrados = validIds.filter((id) => !eliminar.includes(id))
    if (eliminar.length > 0) {
      await PerfilPuesto.deleteMany({ _id: { $in: eliminar } })
    }
    res.json(buildEliminarLoteResponse(eliminar, omitidos, noEncontrados))
  } catch (err) {
    next(err)
  }
})

perfilesPuestoRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const doc = await PerfilPuesto.findById(id)
      .populate('departamento_id', 'codigo nombre color')
      .lean()
    if (!doc) { res.status(404).json({ error: 'Perfil no encontrado' }); return }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

perfilesPuestoRouter.post('/', async (req, res, next) => {
  try {
    const body = pickBody(req.body as Record<string, unknown>)
    if (!body.codigo || !body.titulo) {
      res.status(400).json({ error: 'Código y título son obligatorios' })
      return
    }
    const doc = await PerfilPuesto.create(body)
    const full = await PerfilPuesto.findById(doc._id)
      .populate('departamento_id', 'codigo nombre color')
      .lean()
    res.status(201).json(full)
  } catch (err) {
    next(err)
  }
})

perfilesPuestoRouter.put('/:id', async (req, res, next) => {
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
    const doc = await PerfilPuesto.findByIdAndUpdate(id, body, {
      new: true, runValidators: true,
    }).populate('departamento_id', 'codigo nombre color').lean()
    if (!doc) { res.status(404).json({ error: 'Perfil no encontrado' }); return }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

perfilesPuestoRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    await PerfilPuesto.findByIdAndDelete(id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
