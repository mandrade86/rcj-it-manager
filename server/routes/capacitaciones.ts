import { Router } from 'express'
import mongoose from 'mongoose'

import { Capacitacion } from '../db/models/Capacitacion.js'
import { Colaborador } from '../db/models/Colaborador.js'
import { Empleado } from '../db/models/Empleado.js'
import {
  applyDepartamentosScopeToBody,
  buildCapacitacionAlcanceResponse,
  capVisibleEnScope,
  isAdminCapacitaciones,
  mongoFilterCapacitacionesScope,
  resolveCapacitacionScope,
} from '../utils/capacitacionScope.js'
import { resolveVisibleEmpleadoIds } from '../utils/empleadoScope.js'

export const capacitacionesRouter = Router()

const POPULATE_FIELDS = [
  { path: 'asignados.colaborador_id', select: 'nombre codigo puesto frente estado departamento_id' },
  { path: 'proveedor_id', select: 'nombre sitio_web activo' },
  { path: 'departamentos_ids', select: 'codigo nombre color' },
] as const

const ESTADOS = ['Pendiente', 'En progreso', 'Completado'] as const

export function recalcCapacitacionEstado(
  asignados: { estado?: string }[],
): (typeof ESTADOS)[number] {
  if (!asignados.length) return 'Pendiente'
  if (asignados.every((a) => a.estado === 'Completado')) return 'Completado'
  if (asignados.some((a) => a.estado === 'En progreso' || a.estado === 'Completado')) {
    return 'En progreso'
  }
  return 'Pendiente'
}

function pickBody(body: Record<string, unknown>) {
  const allowed = [
    'nombre',
    'proveedor',
    'proveedor_id',
    'departamentos_ids',
    'modalidad',
    'duracion_horas',
    'costo',
    'fecha_inicio',
    'fecha_fin',
    'estado',
  ] as const
  const out: Record<string, unknown> = {}
  for (const k of allowed) {
    if (body[k] === undefined) continue
    if (k === 'proveedor_id') {
      out[k] = body[k] === '' || body[k] === null ? null : body[k]
    } else if (k === 'departamentos_ids') {
      const raw = body[k]
      out[k] = Array.isArray(raw)
        ? raw.filter((v) => typeof v === 'string' && mongoose.isValidObjectId(v))
        : []
    } else {
      out[k] = body[k]
    }
  }
  return out
}

capacitacionesRouter.get('/alcance', async (req, res, next) => {
  try {
    const userId = req.user?._id
    if (!userId) {
      res.status(401).json({ error: 'No autorizado' })
      return
    }
    const permisos = req.user?.permisos ?? []
    const scope = await resolveCapacitacionScope(userId, permisos)
    const payload = await buildCapacitacionAlcanceResponse(scope)
    res.json(payload)
  } catch (err) {
    next(err)
  }
})

capacitacionesRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user?._id
    if (!userId) {
      res.status(401).json({ error: 'No autorizado' })
      return
    }
    const permisos = req.user?.permisos ?? []
    const scope = await resolveCapacitacionScope(userId, permisos)

    const { colaborador_id, estado } = req.query
    const filter: Record<string, unknown> = {}
    const colOid =
      typeof colaborador_id === 'string' && mongoose.isValidObjectId(colaborador_id)
        ? new mongoose.Types.ObjectId(colaborador_id)
        : null

    if (colOid) {
      filter.asignados = { $elemMatch: { colaborador_id: colOid } }
    }

    const deptFilter = mongoFilterCapacitacionesScope(scope)
    if (!scope.isGlobal) {
      if (colOid) {
        filter.$or = [
          deptFilter,
          { asignados: { $elemMatch: { colaborador_id: colOid } } },
        ]
        delete filter.asignados
      } else {
        Object.assign(filter, deptFilter)
      }
    }

    let rows = await Capacitacion.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ nombre: 1 })
      .lean()

    if (!scope.isGlobal) {
      rows = rows.filter((r) => {
        if (capVisibleEnScope(r, scope)) return true
        if (!colOid) return false
        return (r.asignados ?? []).some((a) => {
          const c = a.colaborador_id
          const id =
            c && typeof c === 'object' && '_id' in c
              ? String((c as { _id: unknown })._id)
              : String(c)
          return id === String(colOid)
        })
      })
    }

    if (typeof estado === 'string' && ESTADOS.includes(estado as (typeof ESTADOS)[number])) {
      rows = rows.filter((r) => r.estado === estado)
    }
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

capacitacionesRouter.post('/', async (req, res, next) => {
  try {
    const userId = req.user?._id
    if (!userId) {
      res.status(401).json({ error: 'No autorizado' })
      return
    }
    const nombre = (req.body as { nombre?: unknown }).nombre
    if (typeof nombre !== 'string' || !nombre.trim()) {
      res.status(400).json({ error: 'El nombre es obligatorio' })
      return
    }
    let body = pickBody(req.body as Record<string, unknown>)
    const scope = await resolveCapacitacionScope(userId, req.user?.permisos ?? [])
    const deptApplied = applyDepartamentosScopeToBody(body, scope)
    if (!deptApplied.ok) {
      res.status(deptApplied.status).json({ error: deptApplied.error })
      return
    }
    body = pickBody(deptApplied.body)
    body.nombre = nombre.trim()
    if (body.estado !== undefined && !ESTADOS.includes(body.estado as (typeof ESTADOS)[number])) {
      delete body.estado
    }
    const doc = await Capacitacion.create({
      ...body,
      asignados: [],
    })
    const full = await Capacitacion.findById(doc._id).populate(POPULATE_FIELDS).lean()
    res.status(201).json(full)
  } catch (err) {
    next(err)
  }
})

capacitacionesRouter.post('/:id/asignar', async (req, res, next) => {
  try {
    const userId = req.user?._id
    if (!userId) {
      res.status(401).json({ error: 'No autorizado' })
      return
    }
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const raw = (req.body as { colaborador_ids?: unknown }).colaborador_ids
    if (!Array.isArray(raw) || raw.length === 0) {
      res.status(400).json({ error: 'colaborador_ids debe ser un arreglo no vacío' })
      return
    }
    const ids = raw.filter((x): x is string => typeof x === 'string' && mongoose.isValidObjectId(x))
    if (ids.length !== raw.length) {
      res.status(400).json({ error: 'Todos los colaborador_ids deben ser ObjectId válidos' })
      return
    }
    const cap = await Capacitacion.findById(id)
    if (!cap) {
      res.status(404).json({ error: 'Capacitación no encontrada' })
      return
    }

    const capScope = await resolveCapacitacionScope(userId, req.user?.permisos ?? [])
    if (!capVisibleEnScope(cap, capScope)) {
      res.status(403).json({ error: 'Capacitación fuera de tu alcance por departamento' })
      return
    }

    const colaboradores = await Colaborador.find({ _id: { $in: ids } })
      .select('_id nombre empleado_id departamento_id')
      .lean()
    if (colaboradores.length !== ids.length) {
      res.status(400).json({ error: 'Uno o más colaboradores no existen' })
      return
    }

    const deptPermitidos = new Set((cap.departamentos_ids ?? []).map((d) => String(d)))
    if (deptPermitidos.size > 0) {
      const fueraDepto = colaboradores.filter((c) => {
        const deptId = c.departamento_id ? String(c.departamento_id) : ''
        return !deptPermitidos.has(deptId)
      })
      if (fueraDepto.length > 0) {
        res.status(403).json({
          error: 'Hay colaboradores fuera de los departamentos permitidos para esta capacitación',
        })
        return
      }
    }

    const permisos = req.user?.permisos ?? []
    const scope = await resolveVisibleEmpleadoIds(userId)
    if (!isAdminCapacitaciones(permisos) && !scope.isAdmin) {
      const visiblesActivos = await Empleado.find(
        {
          _id: { $in: scope.visibleIds },
          activo: true,
        },
        { _id: 1 },
      ).lean()
      const allowedEmpleadoIds = new Set(visiblesActivos.map((e) => String(e._id)))
      if (scope.selfEmpleadoId) allowedEmpleadoIds.delete(scope.selfEmpleadoId)

      const fueraAlcance = colaboradores.filter((c) => {
        const empleadoId = c.empleado_id ? String(c.empleado_id) : ''
        return !empleadoId || !allowedEmpleadoIds.has(empleadoId)
      })

      if (fueraAlcance.length > 0) {
        res.status(403).json({
          error: 'Solo puedes asignar capacitaciones a tu personal activo a cargo',
        })
        return
      }
    }

    for (const cid of ids) {
      const oid = new mongoose.Types.ObjectId(cid)
      const exists = cap.asignados.some((a) => a.colaborador_id?.equals(oid))
      if (!exists) {
        cap.asignados.push({ colaborador_id: oid, estado: 'Pendiente' })
      }
    }
    cap.estado = recalcCapacitacionEstado(cap.asignados)
    await cap.save()
    const full = await Capacitacion.findById(id).populate(POPULATE_FIELDS).lean()
    res.json(full)
  } catch (err) {
    next(err)
  }
})

capacitacionesRouter.put('/:id', async (req, res, next) => {
  try {
    const userId = req.user?._id
    if (!userId) {
      res.status(401).json({ error: 'No autorizado' })
      return
    }
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const existing = await Capacitacion.findById(id).lean()
    if (!existing) {
      res.status(404).json({ error: 'Capacitación no encontrada' })
      return
    }
    const scope = await resolveCapacitacionScope(userId, req.user?.permisos ?? [])
    if (!capVisibleEnScope(existing, scope)) {
      res.status(403).json({ error: 'Capacitación fuera de tu alcance por departamento' })
      return
    }

    let rawPatch = req.body as Record<string, unknown>
    if (rawPatch.departamentos_ids !== undefined) {
      const deptApplied = applyDepartamentosScopeToBody(
        { departamentos_ids: rawPatch.departamentos_ids },
        scope,
      )
      if (!deptApplied.ok) {
        res.status(deptApplied.status).json({ error: deptApplied.error })
        return
      }
      rawPatch = { ...rawPatch, departamentos_ids: deptApplied.body.departamentos_ids }
    }

    const patch = pickBody(rawPatch)
    if (
      patch.estado !== undefined &&
      !ESTADOS.includes(patch.estado as (typeof ESTADOS)[number])
    ) {
      delete patch.estado
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: 'No hay campos válidos para actualizar' })
      return
    }
    const doc = await Capacitacion.findByIdAndUpdate(id, patch, {
      new: true,
      runValidators: true,
    })
    if (!doc) {
      res.status(404).json({ error: 'Capacitación no encontrada' })
      return
    }
    const full = await Capacitacion.findById(id).populate(POPULATE_FIELDS).lean()
    res.json(full)
  } catch (err) {
    next(err)
  }
})

capacitacionesRouter.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user?._id
    if (!userId) {
      res.status(401).json({ error: 'No autorizado' })
      return
    }
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const doc = await Capacitacion.findById(id).populate(POPULATE_FIELDS).lean()
    if (!doc) {
      res.status(404).json({ error: 'Capacitación no encontrada' })
      return
    }
    const scope = await resolveCapacitacionScope(userId, req.user?.permisos ?? [])
    if (!capVisibleEnScope(doc, scope)) {
      res.status(403).json({ error: 'Capacitación fuera de tu alcance por departamento' })
      return
    }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})
