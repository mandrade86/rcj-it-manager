import { Router } from 'express'
import mongoose from 'mongoose'

import { Config } from '../db/models/Config.js'
import { Empresa } from '../db/models/Empresa.js'
import {
  CONFIG_CLAVE_EHR_COMPANY_LIST,
  syncEmpresasFromEhr,
} from '../utils/ehrCompanyList.js'
import {
  buildEliminarLoteResponse,
  parseEliminarLoteIds,
} from '../utils/eliminarLote.js'

type ConfigValorLean = { valor?: string | null }

type EmpresaOrigenLean = {
  _id: mongoose.Types.ObjectId
  origen?: 'manual' | 'ehr'
}

export const empresasRouter = Router()

/** GET /api/empresas/config/list-url */
empresasRouter.get('/config/list-url', async (_req, res, next) => {
  try {
    const cfg = await Config.findOne({ clave: CONFIG_CLAVE_EHR_COMPANY_LIST }).lean<ConfigValorLean | null>()
    res.json({ url: cfg?.valor?.trim() ?? '' })
  } catch (err) {
    next(err)
  }
})

/** POST /api/empresas/config/list-url */
empresasRouter.post('/config/list-url', async (req, res, next) => {
  try {
    const { url } = req.body as { url?: string }
    await Config.findOneAndUpdate(
      { clave: CONFIG_CLAVE_EHR_COMPANY_LIST },
      { valor: typeof url === 'string' ? url.trim() : '' },
      { upsert: true },
    )
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

/** POST /api/empresas/sync — descarga Company/list del EHR y hace upsert */
empresasRouter.post('/sync', async (_req, res, next) => {
  try {
    const result = await syncEmpresasFromEhr()
    if (!result.ok) {
      res.status(502).json({
        error: result.advertencia ?? 'No se pudo obtener el listado de empresas',
        ...result,
      })
      return
    }
    res.json(result)
  } catch (err) {
    next(err)
  }
})

empresasRouter.get('/', async (req, res, next) => {
  try {
    const q = req.query.activo
    const filter: Record<string, unknown> = {}
    if (q === 'true' || q === '1') filter.activo = true
    if (q === 'false' || q === '0') filter.activo = false
    const rows = await Empresa.find(filter).sort({ nombre: 1 }).lean()
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

empresasRouter.post('/eliminar-lote', async (req, res, next) => {
  try {
    const parsed = parseEliminarLoteIds((req.body as { ids?: unknown }).ids)
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error })
      return
    }
    const { validIds, omitidos } = parsed
    const docs = await Empresa.find({ _id: { $in: validIds } })
      .select('_id origen')
      .lean<EmpresaOrigenLean[]>()
    const eliminar: string[] = []
    const errores: Array<{ id: string; error: string }> = []
    const encontrados = new Set(docs.map((d) => String(d._id)))
    for (const id of validIds) {
      if (!encontrados.has(id)) continue
      const doc = docs.find((d) => String(d._id) === id)
      if (doc?.origen === 'ehr') {
        errores.push({
          id,
          error: 'Empresa EHR: no se elimina (desactívala si aplica).',
        })
        continue
      }
      eliminar.push(id)
    }
    const noEncontrados = validIds.filter((id) => !encontrados.has(id))
    if (eliminar.length > 0) {
      await Empresa.deleteMany({ _id: { $in: eliminar } })
    }
    res.json(buildEliminarLoteResponse(eliminar, omitidos, noEncontrados, errores))
  } catch (err) {
    next(err)
  }
})

empresasRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const doc = await Empresa.findById(id).lean()
    if (!doc) {
      res.status(404).json({ error: 'Empresa no encontrada' })
      return
    }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

empresasRouter.post('/', async (req, res, next) => {
  try {
    const { codigo, nombre, descripcion, color, activo } = req.body as Record<string, unknown>
    if (!codigo || !nombre || typeof codigo !== 'string' || typeof nombre !== 'string') {
      res.status(400).json({ error: 'Código y nombre son obligatorios' })
      return
    }
    const doc = await Empresa.create({
      codigo: codigo.trim(),
      nombre: nombre.trim(),
      descripcion: typeof descripcion === 'string' ? descripcion : '',
      color: typeof color === 'string' && color.trim() ? color.trim() : '#002060',
      activo: activo !== false,
      origen: 'manual',
    })
    res.status(201).json(doc)
  } catch (err) {
    next(err)
  }
})

empresasRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const existing = await Empresa.findById(id).lean<EmpresaOrigenLean | null>()
    if (!existing) {
      res.status(404).json({ error: 'Empresa no encontrada' })
      return
    }

    if (existing.origen === 'ehr') {
      const b = req.body as Record<string, unknown>
      const patch: Record<string, unknown> = {}
      if (typeof b.descripcion === 'string') patch.descripcion = b.descripcion
      if (typeof b.color === 'string' && b.color.trim()) patch.color = b.color.trim()
      if (typeof b.activo === 'boolean') patch.activo = b.activo
      const doc = await Empresa.findByIdAndUpdate(id, patch, { new: true, runValidators: true }).lean()
      res.json(doc)
      return
    }

    const { _id, __v, createdAt, updatedAt, ehr_empresa_id, origen, ...rest } = req.body as Record<
      string,
      unknown
    >
    void _id
    void __v
    void createdAt
    void updatedAt
    void ehr_empresa_id
    void origen
    if (typeof rest.codigo === 'string') rest.codigo = rest.codigo.trim()
    if (typeof rest.nombre === 'string') rest.nombre = rest.nombre.trim()
    const doc = await Empresa.findByIdAndUpdate(id, rest, { new: true, runValidators: true }).lean()
    if (!doc) {
      res.status(404).json({ error: 'Empresa no encontrada' })
      return
    }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

empresasRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const doc = await Empresa.findById(id).lean<EmpresaOrigenLean | null>()
    if (!doc) {
      res.status(404).json({ error: 'Empresa no encontrada' })
      return
    }
    if (doc.origen === 'ehr') {
      res.status(400).json({
        error:
          'Las empresas sincronizadas desde el EHR no se eliminan. Desactívalas si no deben aparecer en formularios.',
      })
      return
    }
    await Empresa.findByIdAndDelete(id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
