import { Router } from 'express'
import mongoose from 'mongoose'

import { Rol } from '../db/models/Rol.js'
import { Usuario } from '../db/models/Usuario.js'
import {
  buildEliminarLoteResponse,
  parseEliminarLoteIds,
} from '../utils/eliminarLote.js'

export const rolesRouter = Router()

export const PERMISOS_DISPONIBLES = [
  { clave: '*', descripcion: 'Administrador — acceso completo' },
  { clave: 'dashboard:ver', descripcion: 'Dashboard — ver' },
  { clave: 'proyectos:ver', descripcion: 'Proyectos — ver los propios y de su departamento' },
  { clave: 'proyectos:ver-todos', descripcion: 'Proyectos — ver los de todos los departamentos' },
  { clave: 'proyectos:editar', descripcion: 'Proyectos — crear, editar y eliminar' },
  { clave: 'equipo:ver', descripcion: 'Equipo — ver colaboradores' },
  { clave: 'equipo:editar', descripcion: 'Equipo — editar colaboradores' },
  { clave: 'capacitaciones:ver', descripcion: 'Capacitaciones — ver' },
  { clave: 'capacitaciones:editar', descripcion: 'Capacitaciones — editar' },
  { clave: 'gastos:ver', descripcion: 'Gastos — ver' },
  { clave: 'kpis:ver', descripcion: 'KPIs — ver' },
  { clave: 'kpis:editar', descripcion: 'KPIs — registrar valores' },
  { clave: 'maestros:ver', descripcion: 'Maestros — ver catálogos' },
  { clave: 'maestros:editar', descripcion: 'Maestros — editar catálogos' },
  { clave: 'empleados:ver', descripcion: 'Empleados / Organigrama — ver' },
  { clave: 'empleados:editar', descripcion: 'Empleados — editar' },
  { clave: 'usuarios:ver', descripcion: 'Usuarios — ver' },
  { clave: 'usuarios:editar', descripcion: 'Usuarios — crear/editar' },
  { clave: 'roles:ver', descripcion: 'Roles — ver' },
  { clave: 'roles:editar', descripcion: 'Roles — crear/editar' },
]

rolesRouter.get('/permisos-disponibles', (_req, res) => {
  res.json(PERMISOS_DISPONIBLES)
})

const POPULATE_FIELDS = [
  { path: 'departamento_id', select: 'codigo nombre color' },
  { path: 'departamentos_ids', select: 'codigo nombre color' },
  { path: 'perfil_puesto_id', select: 'codigo titulo nivel tiene_personal_a_cargo' },
] as const

function normalizeRolDepartamentos(body: Record<string, unknown>): void {
  let ids: string[] = []
  if (Array.isArray(body.departamentos_ids)) {
    ids = body.departamentos_ids.filter(
      (v): v is string => typeof v === 'string' && mongoose.isValidObjectId(v),
    )
  } else if (
    typeof body.departamento_id === 'string' &&
    body.departamento_id !== '' &&
    mongoose.isValidObjectId(body.departamento_id)
  ) {
    ids = [body.departamento_id]
  }
  body.departamentos_ids = ids
  body.departamento_id = ids[0] ?? null
}

rolesRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await Rol.find().populate(POPULATE_FIELDS).sort({ nombre: 1 }).lean()
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

rolesRouter.post('/eliminar-lote', async (req, res, next) => {
  try {
    const parsed = parseEliminarLoteIds((req.body as { ids?: unknown }).ids)
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error })
      return
    }
    const { validIds, omitidos } = parsed
    const found = await Rol.find({ _id: { $in: validIds } }).select('_id').lean()
    const foundIds = found.map((d) => String(d._id))
    const noEncontrados = validIds.filter((id) => !foundIds.includes(id))
    const eliminar: string[] = []
    const errores: Array<{ id: string; error: string }> = []
    for (const id of foundIds) {
      const count = await Usuario.countDocuments({ rol_id: id })
      if (count > 0) {
        errores.push({
          id,
          error: `No se puede eliminar: ${count} usuario(s) usan este rol`,
        })
        continue
      }
      eliminar.push(id)
    }
    if (eliminar.length > 0) {
      await Rol.deleteMany({ _id: { $in: eliminar } })
    }
    res.json(buildEliminarLoteResponse(eliminar, omitidos, noEncontrados, errores))
  } catch (err) {
    next(err)
  }
})

rolesRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    const doc = await Rol.findById(id).populate(POPULATE_FIELDS).lean()
    if (!doc) { res.status(404).json({ error: 'Rol no encontrado' }); return }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

rolesRouter.post('/', async (req, res, next) => {
  try {
    const {
      nombre, descripcion, departamento_id, perfil_puesto_id, permisos, activo,
    } = req.body as Record<string, unknown>
    if (!nombre) { res.status(400).json({ error: 'Nombre requerido' }); return }
    const payload: Record<string, unknown> = {
      nombre,
      descripcion,
      departamento_id,
      departamentos_ids: req.body.departamentos_ids,
      perfil_puesto_id: (perfil_puesto_id as string) || null,
      permisos: permisos ?? [],
      activo,
    }
    normalizeRolDepartamentos(payload)
    const doc = await Rol.create(payload)
    const full = await Rol.findById(doc._id).populate(POPULATE_FIELDS).lean()
    res.status(201).json(full)
  } catch (err) {
    next(err)
  }
})

rolesRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    const { _id, __v, createdAt, updatedAt, ...rest } = req.body as Record<string, unknown>
    void _id; void __v; void createdAt; void updatedAt
    if (rest.departamento_id === '') rest.departamento_id = null
    if (rest.perfil_puesto_id === '') rest.perfil_puesto_id = null
    if (rest.departamentos_ids !== undefined || rest.departamento_id !== undefined) {
      normalizeRolDepartamentos(rest)
    }
    const doc = await Rol.findByIdAndUpdate(id, rest, { new: true, runValidators: true })
      .populate(POPULATE_FIELDS)
      .lean()
    if (!doc) { res.status(404).json({ error: 'Rol no encontrado' }); return }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

rolesRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    const count = await Usuario.countDocuments({ rol_id: id })
    if (count > 0) {
      res.status(409).json({ error: `No se puede eliminar: ${count} usuario(s) usan este rol` })
      return
    }
    await Rol.findByIdAndDelete(id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
