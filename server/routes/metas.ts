import { Router } from 'express'
import mongoose from 'mongoose'

import {
  createMeta,
  deleteMeta,
  deleteMetasLote,
  getMeta,
  listMetas,
  updateMeta,
} from '../utils/metasCrud.js'

export const metasRouter = Router()

function canEditMetas(permisos: string[]): boolean {
  return permisos.includes('*') || permisos.includes('kpis:editar') || permisos.includes('maestros:editar')
}

function canViewMetas(permisos: string[]): boolean {
  return (
    canEditMetas(permisos) ||
    permisos.includes('kpis:ver') ||
    permisos.includes('maestros:ver')
  )
}

/** GET /api/metas — listado (filtro departamento_id, activa). */
metasRouter.get('/', async (req, res, next) => {
  try {
    const u = req.user
    if (!u || !canViewMetas(u.permisos)) {
      res.status(403).json({ error: 'Sin permiso para ver metas' })
      return
    }
    const departamento_id =
      typeof req.query.departamento_id === 'string' ? req.query.departamento_id : undefined
    const activa =
      req.query.activa === 'true' || req.query.activa === 'false'
        ? (req.query.activa as 'true' | 'false')
        : undefined
    if (departamento_id && !mongoose.isValidObjectId(departamento_id)) {
      res.status(400).json({ error: 'departamento_id inválido' })
      return
    }
    const rows = await listMetas({ departamento_id, activa })
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

/** POST /api/metas/eliminar-lote { items: [{ departamento_id, meta_id }] } */
metasRouter.post('/eliminar-lote', async (req, res, next) => {
  try {
    const u = req.user
    if (!u || !canEditMetas(u.permisos)) {
      res.status(403).json({ error: 'Sin permiso' })
      return
    }
    const raw = (req.body as { items?: unknown }).items
    if (!Array.isArray(raw) || raw.length === 0) {
      res.status(400).json({ error: 'Envía items con al menos una meta.' })
      return
    }
    const items = raw
      .map((x) => {
        if (!x || typeof x !== 'object') return null
        const o = x as Record<string, unknown>
        const departamento_id = String(o.departamento_id ?? '').trim()
        const meta_id = String(o.meta_id ?? '').trim()
        if (!mongoose.isValidObjectId(departamento_id) || !meta_id) return null
        return { departamento_id, meta_id }
      })
      .filter((x): x is { departamento_id: string; meta_id: string } => x != null)

    const r = await deleteMetasLote(items)
    res.json(r)
  } catch (err) {
    next(err)
  }
})

/** GET /api/metas/:departamentoId/:metaId */
metasRouter.get('/:departamentoId/:metaId', async (req, res, next) => {
  try {
    const u = req.user
    if (!u || !canViewMetas(u.permisos)) {
      res.status(403).json({ error: 'Sin permiso' })
      return
    }
    const { departamentoId, metaId } = req.params
    if (!mongoose.isValidObjectId(departamentoId)) {
      res.status(400).json({ error: 'departamentoId inválido' })
      return
    }
    const row = await getMeta(departamentoId, metaId)
    if (!row) {
      res.status(404).json({ error: 'Meta no encontrada' })
      return
    }
    res.json(row)
  } catch (err) {
    next(err)
  }
})

/** POST /api/metas — crear meta en un departamento. */
metasRouter.post('/', async (req, res, next) => {
  try {
    const u = req.user
    if (!u || !canEditMetas(u.permisos)) {
      res.status(403).json({ error: 'Sin permiso para crear metas' })
      return
    }
    const body = req.body as Record<string, unknown>
    const departamento_id = String(body.departamento_id ?? '').trim()
    if (!mongoose.isValidObjectId(departamento_id)) {
      res.status(400).json({ error: 'departamento_id es obligatorio' })
      return
    }
    const doc = await createMeta({
      departamento_id,
      id: typeof body.id === 'string' ? body.id : undefined,
      titulo: String(body.titulo ?? ''),
      objetivo: typeof body.objetivo === 'string' ? body.objetivo : undefined,
      valor_objetivo: typeof body.valor_objetivo === 'string' ? body.valor_objetivo : undefined,
      tipo_calculo: typeof body.tipo_calculo === 'string' ? body.tipo_calculo : undefined,
      activa: body.activa !== false,
    })
    res.status(201).json(doc)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al crear meta'
    res.status(400).json({ error: msg })
  }
})

/** PUT /api/metas/:departamentoId/:metaId */
metasRouter.put('/:departamentoId/:metaId', async (req, res, next) => {
  try {
    const u = req.user
    if (!u || !canEditMetas(u.permisos)) {
      res.status(403).json({ error: 'Sin permiso' })
      return
    }
    const { departamentoId, metaId } = req.params
    if (!mongoose.isValidObjectId(departamentoId)) {
      res.status(400).json({ error: 'departamentoId inválido' })
      return
    }
    const body = req.body as Record<string, unknown>
    const doc = await updateMeta(departamentoId, metaId, {
      ...(body.titulo !== undefined ? { titulo: String(body.titulo) } : {}),
      ...(body.objetivo !== undefined ? { objetivo: String(body.objetivo) } : {}),
      ...(body.valor_objetivo !== undefined ? { valor_objetivo: String(body.valor_objetivo) } : {}),
      ...(body.tipo_calculo !== undefined ? { tipo_calculo: String(body.tipo_calculo) } : {}),
      ...(body.activa !== undefined ? { activa: Boolean(body.activa) } : {}),
    })
    res.json(doc)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al actualizar'
    res.status(400).json({ error: msg })
  }
})

/** DELETE /api/metas/:departamentoId/:metaId */
metasRouter.delete('/:departamentoId/:metaId', async (req, res, next) => {
  try {
    const u = req.user
    if (!u || !canEditMetas(u.permisos)) {
      res.status(403).json({ error: 'Sin permiso' })
      return
    }
    const { departamentoId, metaId } = req.params
    if (!mongoose.isValidObjectId(departamentoId)) {
      res.status(400).json({ error: 'departamentoId inválido' })
      return
    }
    await deleteMeta(departamentoId, metaId)
    res.status(204).send()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al eliminar'
    res.status(400).json({ error: msg })
  }
})
