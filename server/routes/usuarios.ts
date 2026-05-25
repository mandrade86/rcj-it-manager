import { Router } from 'express'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'

import { Usuario } from '../db/models/Usuario.js'
import {
  buildEliminarLoteResponse,
  parseEliminarLoteIds,
} from '../utils/eliminarLote.js'

export const usuariosRouter = Router()

const BCRYPT_ROUNDS = 10

const ALLOWED = [
  'nombre', 'email', 'rol_id', 'empleado_id', 'empleados_ids', 'departamento_id', 'activo',
] as const

function pickBody(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const k of ALLOWED) {
    if (body[k] === undefined) continue
    if (k === 'empleados_ids') {
      const raw = body[k]
      out[k] = Array.isArray(raw) ? raw.filter((v) => typeof v === 'string' && v.length > 0) : []
    } else if (k === 'empleado_id' || k === 'departamento_id') {
      // Permitir desasignar enviando '' o null
      const v = body[k]
      out[k] = v === '' || v == null ? null : v
    } else {
      out[k] = body[k]
    }
  }
  return out
}

const POPULATE_FIELDS = [
  { path: 'rol_id', select: 'nombre permisos' },
  { path: 'empleado_id', select: 'codigo nombre puesto departamento' },
  { path: 'empleados_ids', select: 'codigo nombre puesto departamento' },
  { path: 'departamento_id', select: 'codigo nombre color' },
] as const

usuariosRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await Usuario.find()
      .select('-password')
      .populate(POPULATE_FIELDS)
      .sort({ nombre: 1 })
      .lean()
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

usuariosRouter.post('/eliminar-lote', async (req, res, next) => {
  try {
    const parsed = parseEliminarLoteIds((req.body as { ids?: unknown }).ids)
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error })
      return
    }
    const { validIds, omitidos } = parsed
    const found = await Usuario.find({ _id: { $in: validIds } }).select('_id').lean()
    const eliminar = found.map((d) => String(d._id))
    const noEncontrados = validIds.filter((id) => !eliminar.includes(id))
    if (eliminar.length > 0) {
      await Usuario.deleteMany({ _id: { $in: eliminar } })
    }
    res.json(buildEliminarLoteResponse(eliminar, omitidos, noEncontrados))
  } catch (err) {
    next(err)
  }
})

usuariosRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    const doc = await Usuario.findById(id)
      .select('-password')
      .populate(POPULATE_FIELDS)
      .lean()
    if (!doc) { res.status(404).json({ error: 'Usuario no encontrado' }); return }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

usuariosRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>
    const { nombre, email, password, rol_id } = body
    if (!nombre || !email || !password || !rol_id) {
      res.status(400).json({ error: 'Nombre, email, contraseña y rol son requeridos' }); return
    }
    const empleadosRaw = body.empleados_ids
    const empleados_ids = Array.isArray(empleadosRaw)
      ? empleadosRaw.filter((v) => typeof v === 'string' && v.length > 0)
      : []
    const hash = await bcrypt.hash(password as string, BCRYPT_ROUNDS)
    const doc = await Usuario.create({
      nombre,
      email,
      password: hash,
      rol_id,
      empleado_id: (body.empleado_id as string) || null,
      empleados_ids,
      departamento_id: (body.departamento_id as string) || null,
      activo: (body.activo as boolean | undefined) ?? true,
    })
    const full = await Usuario.findById(doc._id)
      .select('-password')
      .populate(POPULATE_FIELDS)
      .lean()
    res.status(201).json(full)
  } catch (err) {
    next(err)
  }
})

usuariosRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    const body = pickBody(req.body as Record<string, unknown>)
    if (Object.keys(body).length === 0) { res.status(400).json({ error: 'Sin campos para actualizar' }); return }
    const doc = await Usuario.findByIdAndUpdate(id, body, { new: true, runValidators: true })
      .select('-password')
      .populate(POPULATE_FIELDS)
      .lean()
    if (!doc) { res.status(404).json({ error: 'Usuario no encontrado' }); return }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

usuariosRouter.post('/:id/reset-password', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    const { password_nuevo } = req.body as Record<string, string>
    if (!password_nuevo || password_nuevo.length < 6) {
      res.status(400).json({ error: 'Contraseña debe tener al menos 6 caracteres' }); return
    }
    const hash = await bcrypt.hash(password_nuevo, BCRYPT_ROUNDS)
    await Usuario.findByIdAndUpdate(id, { password: hash })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

usuariosRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    await Usuario.findByIdAndDelete(id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
