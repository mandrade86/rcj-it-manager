import { Router } from 'express'
import mongoose from 'mongoose'

import { Departamento } from '../db/models/Departamento.js'
import { KPI } from '../db/models/KPI.js'
import {
  catalogoClaveParaDepartamento,
  kpisSugeridosParaDepartamento,
} from '../db/kpisSugeridos.js'
import { clearKpiFromProyectos, syncKpiProyectoVinculos } from '../utils/syncKpiProyectos.js'
import {
  metaIdPermitidoParaDepartamento,
  resolverMetaIdKpi,
} from '../utils/metasDepartamento.js'

export const kpisRouter = Router()

const ALLOWED = [
  'departamento_id',
  'meta_id',
  'tipo',
  'tipo_calculo',
  'eje',
  'nombre',
  'descripcion',
  'meta',
  'unidad',
  'frecuencia',
  'responsable',
  'proyecto_ids',
] as const

const KPI_POPULATE = [
  { path: 'departamento_id', select: 'codigo nombre color metas_estrategicas' },
  { path: 'proyecto_ids', select: '_id nombre eje estado porcentaje_avance' },
] as const

function normalizeProyectoIdsBody(raw: unknown): string[] {
  if (raw == null) return []
  const arr = Array.isArray(raw) ? raw : [raw]
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of arr) {
    const s =
      typeof item === 'string'
        ? item.trim()
        : item && typeof item === 'object' && '_id' in item
          ? String((item as { _id: unknown })._id).trim()
          : ''
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

function pickBody(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of ALLOWED) {
    if (raw[k] === undefined) continue
    if (k === 'departamento_id') {
      const v = raw[k]
      if (v === null || v === '') {
        out[k] = null
      } else if (typeof v === 'string' && mongoose.isValidObjectId(v)) {
        out[k] = new mongoose.Types.ObjectId(v)
      }
      continue
    }
    if (k === 'proyecto_ids') {
      out[k] = normalizeProyectoIdsBody(raw[k])
      continue
    }
    out[k] = raw[k]
  }
  const eje = typeof out.eje === 'string' ? out.eje.trim() : ''
  if (eje && (out.tipo === undefined || out.tipo === '')) {
    out.tipo = eje
  }
  if (typeof out.tipo === 'string') out.tipo = out.tipo.trim()
  return out
}

async function aplicarMetaIdKpi(
  body: Record<string, unknown>,
): Promise<string | null> {
  const resolved = resolverMetaIdKpi(body)
  if (resolved) body.meta_id = resolved
  const deptId = body.departamento_id
  const metaId = body.meta_id
  if (deptId && metaId) {
    return metaIdPermitidoParaDepartamento(deptId, metaId)
  }
  if (deptId && !metaId) {
    return 'Selecciona la meta estratégica del departamento para este KPI.'
  }
  return null
}

kpisRouter.get('/', async (req, res, next) => {
  try {
    const { departamento_id } = req.query
    const filter: Record<string, unknown> = {}
    if (typeof departamento_id === 'string' && departamento_id !== '') {
      if (departamento_id === 'none') {
        filter.departamento_id = { $in: [null, undefined] }
      } else if (mongoose.isValidObjectId(departamento_id)) {
        filter.departamento_id = new mongoose.Types.ObjectId(departamento_id)
      } else {
        res.status(400).json({ error: 'departamento_id inválido' })
        return
      }
    }
    const rows = await KPI.find(filter)
      .populate(KPI_POPULATE)
      .sort({ eje: 1, nombre: 1 })
      .lean()
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

kpisRouter.get('/sugerencias', async (req, res, next) => {
  try {
    const { departamento_id } = req.query
    if (typeof departamento_id !== 'string' || !mongoose.isValidObjectId(departamento_id)) {
      res.status(400).json({ error: 'departamento_id inválido' })
      return
    }
    const dept = await Departamento.findById(departamento_id)
      .select('codigo nombre ehr_departamento_id')
      .lean()
    if (!dept) {
      res.status(404).json({ error: 'Departamento no encontrado' })
      return
    }
    const catalogoClave = catalogoClaveParaDepartamento(dept)
    const sugeridos = kpisSugeridosParaDepartamento(dept)
    const existentes = await KPI.find({ departamento_id: dept._id })
      .select('nombre')
      .lean()
    const setNombres = new Set(existentes.map((e) => String(e.nombre).toLowerCase().trim()))
    const items = sugeridos.map((s) => ({
      ...s,
      yaExiste: setNombres.has(s.nombre.toLowerCase().trim()),
    }))
    res.json({
      departamento: { _id: dept._id, codigo: dept.codigo, nombre: dept.nombre },
      catalogo_clave: catalogoClave,
      total: items.length,
      sugerencias: items,
    })
  } catch (err) {
    next(err)
  }
})

kpisRouter.post('/aplicar-sugerencias', async (req, res, next) => {
  try {
    const { departamento_id, nombres } = req.body as {
      departamento_id?: string
      nombres?: string[]
    }
    if (typeof departamento_id !== 'string' || !mongoose.isValidObjectId(departamento_id)) {
      res.status(400).json({ error: 'departamento_id inválido' })
      return
    }
    const dept = await Departamento.findById(departamento_id)
      .select('codigo nombre ehr_departamento_id')
      .lean()
    if (!dept) {
      res.status(404).json({ error: 'Departamento no encontrado' })
      return
    }
    const catalogo = kpisSugeridosParaDepartamento(dept)
    if (catalogo.length === 0) {
      res.status(404).json({
        error: `No hay catálogo de sugerencias para el departamento ${dept.codigo ?? ''}. Solo IT, RRHH, FIN, OPS, COM y LEG tienen plantilla.`,
      })
      return
    }
    if (!Array.isArray(nombres) || nombres.length === 0) {
      res.status(400).json({ error: 'Debes indicar al menos un nombre de KPI a crear.' })
      return
    }
    const seleccion = new Set(nombres.map((n) => String(n).toLowerCase().trim()))
    const itemsAplicar = catalogo.filter((c) => seleccion.has(c.nombre.toLowerCase().trim()))
    const existentes = await KPI.find({ departamento_id: dept._id })
      .select('nombre')
      .lean()
    const setNombres = new Set(existentes.map((e) => String(e.nombre).toLowerCase().trim()))
    const aInsertar = itemsAplicar.filter((c) => !setNombres.has(c.nombre.toLowerCase().trim()))
    if (aInsertar.length === 0) {
      res.json({ creados: 0, omitidos: itemsAplicar.length })
      return
    }
    await KPI.insertMany(
      aInsertar.map((c) => ({
        departamento_id: dept._id,
        eje: c.eje,
        nombre: c.nombre,
        descripcion: c.descripcion ?? c.nombre,
        meta: c.meta,
        unidad: c.unidad,
        frecuencia: c.frecuencia,
      })),
    )
    res.status(201).json({
      creados: aInsertar.length,
      omitidos: itemsAplicar.length - aInsertar.length,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * Elimina varios KPIs y desvincula proyectos asociados.
 * POST /api/kpis/eliminar-lote  { ids: string[] }
 */
kpisRouter.post('/eliminar-lote', async (req, res, next) => {
  try {
    const u = req.user
    if (!u) {
      res.status(401).json({ error: 'No autenticado' })
      return
    }
    if (!u.permisos.includes('*') && !u.permisos.includes('kpis:editar')) {
      res.status(403).json({ error: 'No tienes permiso para eliminar KPIs' })
      return
    }

    const raw = (req.body as { ids?: unknown }).ids
    if (!Array.isArray(raw) || raw.length === 0) {
      res.status(400).json({ error: 'Envía un arreglo ids con al menos un id de KPI.' })
      return
    }
    const ids = [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))]
    if (ids.length > 200) {
      res.status(400).json({ error: 'Máximo 200 KPIs por solicitud.' })
      return
    }

    const validIds = ids.filter((id) => mongoose.isValidObjectId(id))
    const omitidos = ids.filter((id) => !validIds.includes(id))

    const found = await KPI.find({ _id: { $in: validIds } }).select('_id').lean()
    const eliminar = found.map((d) => String(d._id))
    const noEncontrados = validIds.filter((id) => !eliminar.includes(id))

    for (const kid of eliminar) {
      await clearKpiFromProyectos(kid)
    }
    if (eliminar.length > 0) {
      await KPI.deleteMany({ _id: { $in: eliminar } })
    }

    res.json({
      eliminados: eliminar.length,
      ids: eliminar,
      omitidos: [...omitidos, ...noEncontrados],
    })
  } catch (err) {
    next(err)
  }
})

kpisRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const doc = await KPI.findById(id).populate(KPI_POPULATE).lean()
    if (!doc) {
      res.status(404).json({ error: 'KPI no encontrado' })
      return
    }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

kpisRouter.post('/', async (req, res, next) => {
  try {
    const raw = req.body as Record<string, unknown>
    const body = pickBody(raw)
    if (!body.nombre || !body.eje) {
      res.status(400).json({ error: 'Nombre y eje son obligatorios' })
      return
    }
    const metaErr = await aplicarMetaIdKpi(body)
    if (metaErr) {
      res.status(400).json({ error: metaErr })
      return
    }
    const created = await KPI.create(body)
    const vinculacion = await syncKpiProyectoVinculos(created._id, {
      departamento_id: created.departamento_id,
      eje: created.eje,
      tipo: created.tipo,
      meta: created.meta,
      proyecto_ids: raw.proyecto_ids,
    })
    const populated = await KPI.findById(created._id).populate(KPI_POPULATE).lean()
    res.status(201).json({ ...populated, vinculacion })
  } catch (err) {
    next(err)
  }
})

kpisRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const raw = req.body as Record<string, unknown>
    const body = pickBody(raw)
    const current = await KPI.findById(id).select('departamento_id nombre meta_id').lean()
    if (!current) {
      res.status(404).json({ error: 'KPI no encontrado' })
      return
    }
    const merged: Record<string, unknown> = {
      departamento_id:
        body.departamento_id !== undefined ? body.departamento_id : current.departamento_id,
      nombre: body.nombre !== undefined ? body.nombre : current.nombre,
      meta_id: body.meta_id !== undefined ? body.meta_id : current.meta_id,
    }
    const metaErr = await aplicarMetaIdKpi(merged)
    if (metaErr) {
      res.status(400).json({ error: metaErr })
      return
    }
    if (merged.meta_id !== undefined) body.meta_id = merged.meta_id
    const doc = await KPI.findByIdAndUpdate(id, { $set: body }, { new: true }).lean()
    if (!doc) {
      res.status(404).json({ error: 'KPI no encontrado' })
      return
    }
    const vinculacion = await syncKpiProyectoVinculos(doc._id, {
      departamento_id: doc.departamento_id,
      eje: doc.eje,
      tipo: doc.tipo,
      meta: doc.meta,
      proyecto_ids: raw.proyecto_ids !== undefined ? raw.proyecto_ids : doc.proyecto_ids,
    })
    const populated = await KPI.findById(doc._id).populate(KPI_POPULATE).lean()
    res.json({ ...populated, vinculacion })
  } catch (err) {
    next(err)
  }
})

kpisRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const doc = await KPI.findByIdAndDelete(id).lean()
    if (!doc) {
      res.status(404).json({ error: 'KPI no encontrado' })
      return
    }
    await clearKpiFromProyectos(id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
