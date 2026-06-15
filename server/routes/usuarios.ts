import { Router } from 'express'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'

import { Usuario } from '../db/models/Usuario.js'
import {
  buildEliminarLoteResponse,
  parseEliminarLoteIds,
} from '../utils/eliminarLote.js'
import { normalizeDomainLogin } from '../utils/directoryAuth.js'
import { isAdLoginEnabled } from '../utils/ehrAuth.js'
import { duplicateUsuarioMessage } from '../utils/usuarioErrors.js'

export const usuariosRouter = Router()

const BCRYPT_ROUNDS = 10

const ALLOWED = [
  'nombre', 'email', 'rol_id', 'empleado_id', 'empleados_ids', 'departamento_id', 'activo',
] as const

function toObjectIdOrNull(value: unknown): mongoose.Types.ObjectId | null | 'invalid' {
  if (value === '' || value == null) return null
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) return 'invalid'
  return new mongoose.Types.ObjectId(value)
}

function pickBody(body: Record<string, unknown>): Record<string, unknown> | { error: string; field?: string } {
  const out: Record<string, unknown> = {}
  for (const k of ALLOWED) {
    if (body[k] === undefined) continue
    if (k === 'empleados_ids') {
      const raw = body[k]
      const ids = Array.isArray(raw)
        ? raw.filter((v) => typeof v === 'string' && v.length > 0)
        : []
      for (const id of ids) {
        if (!mongoose.isValidObjectId(id)) {
          return { error: 'Uno de los empleados adicionales no es válido.', field: 'empleados_ids' }
        }
      }
      out[k] = ids
    } else if (k === 'empleado_id' || k === 'departamento_id' || k === 'rol_id') {
      const parsed = toObjectIdOrNull(body[k])
      if (parsed === 'invalid') {
        const labels: Record<string, string> = {
          rol_id: 'El rol seleccionado no es válido.',
          empleado_id: 'El empleado vinculado no es válido.',
          departamento_id: 'El departamento seleccionado no es válido.',
        }
        return { error: labels[k] ?? `Valor inválido para ${k}`, field: k }
      }
      out[k] = parsed
    } else if (k === 'email' && typeof body[k] === 'string') {
      out[k] = body[k].trim().toLowerCase()
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
      .select('-password -mfa_secret -mfa_pending_secret')
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
    const selfId = req.user?._id
    const idsToDelete = selfId ? validIds.filter((id) => id !== selfId) : validIds
    const omitSelf = selfId && validIds.includes(selfId) ? [selfId] : []
    const found = await Usuario.find({ _id: { $in: idsToDelete } }).select('_id').lean()
    const eliminar = found.map((d) => String(d._id))
    const noEncontrados = validIds.filter((id) => !eliminar.includes(id))
    if (eliminar.length > 0) {
      await Usuario.deleteMany({ _id: { $in: eliminar } })
    }
    res.json(buildEliminarLoteResponse(eliminar, [...omitidos, ...omitSelf], noEncontrados))
  } catch (err) {
    next(err)
  }
})

usuariosRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    const doc = await Usuario.findById(id)
      .select('-password -mfa_secret -mfa_pending_secret')
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
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
    const password = body.password
    const rol_id = body.rol_id
    const esUsuarioDominio = body.es_usuario_dominio === true

    if (!nombre) {
      res.status(400).json({ error: 'El nombre completo es obligatorio.', field: 'nombre' })
      return
    }
    if (!rol_id || typeof rol_id !== 'string') {
      res.status(400).json({ error: 'Debes seleccionar un rol para el usuario.', field: 'rol_id' })
      return
    }

    const email = body.email
    if (!email || typeof email !== 'string' || !email.trim()) {
      res.status(400).json({
        error: 'El correo electrónico corporativo es obligatorio.',
        field: 'email',
      })
      return
    }
    const emailNorm = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      res.status(400).json({
        error: 'El formato del correo no es válido (ej. nombre.apellido@rcjcorp.com).',
        field: 'email',
      })
      return
    }

    let loginDominio = ''
    if (esUsuarioDominio) {
      loginDominio = normalizeDomainLogin(String(body.login_dominio ?? ''))
      if (!loginDominio) {
        res.status(400).json({
          error: 'Escribe el usuario de dominio (ej. nombre.apellido), sin @ ni dominio.',
          field: 'login_dominio',
        })
        return
      }
      if (loginDominio.includes('@')) {
        res.status(400).json({
          error: 'El usuario de dominio no debe incluir @ ni el dominio (solo nombre.apellido).',
          field: 'login_dominio',
        })
        return
      }
      if (!/^[a-z0-9._-]+$/.test(loginDominio)) {
        res.status(400).json({
          error: 'El usuario de dominio solo puede tener letras, números, punto, guion o guion bajo.',
          field: 'login_dominio',
        })
        return
      }
    }

    const empleadosRaw = body.empleados_ids
    const empleados_ids = Array.isArray(empleadosRaw)
      ? empleadosRaw.filter((v) => typeof v === 'string' && v.length > 0)
      : []
    if (!mongoose.isValidObjectId(rol_id)) {
      res.status(400).json({ error: 'El rol seleccionado no es válido.', field: 'rol_id' })
      return
    }
    const empId = toObjectIdOrNull(body.empleado_id)
    if (empId === 'invalid') {
      res.status(400).json({ error: 'El empleado vinculado no es válido.', field: 'empleado_id' })
      return
    }
    if (empId) {
      const taken = await Usuario.findOne({ empleado_id: empId }).select('nombre').lean()
      if (taken) {
        res.status(409).json({
          error: `Ese empleado ya está vinculado al usuario «${taken.nombre}». Elige otro empleado o edita el usuario existente.`,
          field: 'empleado_id',
        })
        return
      }
    }
    const deptId = toObjectIdOrNull(body.departamento_id)
    if (deptId === 'invalid') {
      res.status(400).json({ error: 'El departamento seleccionado no es válido.', field: 'departamento_id' })
      return
    }
    const pwd = typeof password === 'string' ? password.trim() : ''
    if (!isAdLoginEnabled() && !esUsuarioDominio) {
      if (pwd.length < 8) {
        res.status(400).json({
          error: 'La contraseña es obligatoria para el acceso a IT Manager (mínimo 8 caracteres).',
          field: 'password',
        })
        return
      }
    } else if (pwd.length > 0 && pwd.length < 8) {
      res.status(400).json({
        error: 'La contraseña local debe tener al menos 8 caracteres.',
        field: 'password',
      })
      return
    }
    const hash = pwd.length >= 8 ? await bcrypt.hash(pwd, BCRYPT_ROUNDS) : ''
    const doc = await Usuario.create({
      nombre,
      email: emailNorm,
      login_dominio: esUsuarioDominio ? loginDominio : '',
      es_usuario_dominio: esUsuarioDominio,
      password: hash,
      rol_id,
      empleado_id: empId,
      empleados_ids,
      departamento_id: deptId,
      activo: (body.activo as boolean | undefined) ?? true,
    })
    const full = await Usuario.findById(doc._id)
      .select('-password -mfa_secret -mfa_pending_secret')
      .populate(POPULATE_FIELDS)
      .lean()
    res.status(201).json(full)
  } catch (err) {
    const code = (err as { code?: number }).code
    if (code === 11000) {
      const dup = duplicateUsuarioMessage((err as { keyPattern?: Record<string, unknown> }).keyPattern)
      res.status(409).json(dup)
      return
    }
    next(err)
  }
})

usuariosRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    const picked = pickBody(req.body as Record<string, unknown>)
    if ('error' in picked) {
      res.status(400).json({ error: picked.error, field: picked.field })
      return
    }
    const body = picked
    if (Object.keys(body).length === 0) { res.status(400).json({ error: 'Sin campos para actualizar' }); return }
    const doc = await Usuario.findByIdAndUpdate(id, body, { new: true, runValidators: true })
      .select('-password -mfa_secret -mfa_pending_secret')
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
    if (!password_nuevo || password_nuevo.length < 8) {
      res.status(400).json({ error: 'Contraseña debe tener al menos 8 caracteres' }); return
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
