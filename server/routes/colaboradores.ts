import { Router } from 'express'
import mongoose from 'mongoose'

import { Capacitacion } from '../db/models/Capacitacion.js'
import { Colaborador } from '../db/models/Colaborador.js'
import { Departamento } from '../db/models/Departamento.js'
import { Empleado } from '../db/models/Empleado.js'
import { Evaluacion } from '../db/models/Evaluacion.js'
import { PlanCarrera } from '../db/models/PlanCarrera.js'

export const colaboradoresRouter = Router()

/**
 * Encuentra (o auto-crea) el Colaborador vinculado a un Empleado del maestro.
 * Permite reutilizar las pestañas de perfil (evaluaciones, plan de carrera,
 * capacitaciones) desde la nueva vista de Equipo basada en Empleado.
 */
colaboradoresRouter.get('/por-empleado/:empleadoId', async (req, res, next) => {
  try {
    const { empleadoId } = req.params
    if (!mongoose.isValidObjectId(empleadoId)) {
      res.status(400).json({ error: 'ID de empleado inválido' }); return
    }
    const empleado = await Empleado.findById(empleadoId)
      .populate('departamento_id', 'codigo nombre')
      .lean()
    if (!empleado) { res.status(404).json({ error: 'Empleado no encontrado' }); return }

    // 1. Búsqueda por empleado_id explícito
    let colab = await Colaborador.findOne({ empleado_id: empleado._id }).lean()
    if (colab) { res.json(colab); return }

    // 2. Match por código (compatibilidad con datos existentes)
    if (empleado.codigo) {
      const match = await Colaborador.findOne({ codigo: empleado.codigo })
      if (match) {
        if (!match.empleado_id) {
          match.empleado_id = empleado._id
          await match.save()
        }
        res.json(match.toObject()); return
      }
    }

    // 3. Auto-crear desde el empleado del maestro
    const dept = empleado.departamento_id && typeof empleado.departamento_id === 'object'
      ? empleado.departamento_id as { _id: mongoose.Types.ObjectId; codigo?: string; nombre?: string }
      : null
    const codigoBase = empleado.codigo || `EMP-${String(empleado._id).slice(-6)}`
    let codigo = codigoBase
    let n = 1
    while (await Colaborador.exists({ codigo })) {
      n += 1
      codigo = `${codigoBase}-${n}`
    }

    // Si no hay departamento, intentar uno "General" para no romper el required del modelo
    let deptId = dept?._id ?? null
    if (!deptId) {
      let general = await Departamento.findOne({ codigo: 'GEN' })
      if (!general) {
        general = await Departamento.create({ codigo: 'GEN', nombre: 'General' })
      }
      deptId = general._id
    }

    const creado = await Colaborador.create({
      codigo,
      nombre: empleado.nombre,
      puesto: empleado.puesto || 'Sin puesto definido',
      codigo_puesto: codigo,
      departamento_id: deptId,
      empleado_id: empleado._id,
      frente: dept?.nombre || empleado.departamento || 'General',
      estado: 'Activo',
    })
    res.status(201).json(creado.toObject())
  } catch (err) {
    next(err)
  }
})

colaboradoresRouter.get('/', async (req, res, next) => {
  try {
    const { frente, estado } = req.query
    const filter: Record<string, string> = {}
    if (typeof frente === 'string' && frente.length > 0) filter.frente = frente
    if (typeof estado === 'string' && estado.length > 0) filter.estado = estado
    const rows = await Colaborador.find(filter).sort({ codigo: 1 }).lean()
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/colaboradores/me
 * Devuelve (o autocrea desde Empleado) el colaborador del usuario logueado.
 * Se basa en `req.user.empleado_id` que viene en el JWT.
 */
colaboradoresRouter.get('/me', async (req, res, next) => {
  try {
    const empleadoId = req.user?.empleado_id
    if (!empleadoId || !mongoose.isValidObjectId(empleadoId)) {
      res.status(404).json({
        error: 'Tu usuario no está vinculado a un empleado. Pide al administrador que asigne tu empleado.',
      })
      return
    }
    const empleado = await Empleado.findById(empleadoId)
      .populate('departamento_id', 'codigo nombre')
      .lean()
    if (!empleado) {
      res.status(404).json({ error: 'El empleado vinculado a tu usuario ya no existe' })
      return
    }
    // Reusa la lógica de búsqueda/auto-creación
    let colab = await Colaborador.findOne({ empleado_id: empleado._id })
      .populate('perfil_puesto_id')
      .lean()
    if (colab) {
      res.json(colab)
      return
    }
    if (empleado.codigo) {
      const match = await Colaborador.findOne({ codigo: empleado.codigo })
      if (match) {
        if (!match.empleado_id) {
          match.empleado_id = empleado._id
          await match.save()
        }
        const full = await Colaborador.findById(match._id).populate('perfil_puesto_id').lean()
        res.json(full)
        return
      }
    }
    const dept = empleado.departamento_id && typeof empleado.departamento_id === 'object'
      ? empleado.departamento_id as { _id: mongoose.Types.ObjectId; codigo?: string; nombre?: string }
      : null
    const codigoBase = empleado.codigo || `EMP-${String(empleado._id).slice(-6)}`
    let codigo = codigoBase
    let n = 1
    while (await Colaborador.exists({ codigo })) {
      n += 1
      codigo = `${codigoBase}-${n}`
    }
    let deptId = dept?._id ?? null
    if (!deptId) {
      let general = await Departamento.findOne({ codigo: 'GEN' })
      if (!general) general = await Departamento.create({ codigo: 'GEN', nombre: 'General' })
      deptId = general._id
    }
    const creado = await Colaborador.create({
      codigo,
      nombre: empleado.nombre,
      puesto: empleado.puesto || 'Sin puesto definido',
      codigo_puesto: codigo,
      departamento_id: deptId,
      empleado_id: empleado._id,
      frente: dept?.nombre || empleado.departamento || 'General',
      estado: 'Activo',
    })
    colab = await Colaborador.findById(creado._id).populate('perfil_puesto_id').lean()
    res.status(201).json(colab)
  } catch (err) {
    next(err)
  }
})

colaboradoresRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const doc = await Colaborador.findById(id)
      .populate('perfil_puesto_id')
      .populate('departamento_id', 'codigo nombre color')
      .lean()
    if (!doc) {
      res.status(404).json({ error: 'Colaborador no encontrado' })
      return
    }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

colaboradoresRouter.post('/', async (req, res, next) => {
  try {
    const doc = await Colaborador.create(req.body)
    res.status(201).json(doc)
  } catch (err) {
    next(err)
  }
})

colaboradoresRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const { _id, __v, createdAt, updatedAt, ...rest } = req.body as Record<
      string,
      unknown
    >
    const doc = await Colaborador.findByIdAndUpdate(id, rest, {
      new: true,
      runValidators: true,
    })
      .populate('perfil_puesto_id')
      .populate('departamento_id', 'codigo nombre color')
      .lean()
    if (!doc) {
      res.status(404).json({ error: 'Colaborador no encontrado' })
      return
    }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

colaboradoresRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const exists = await Colaborador.findById(id).select('_id').lean()
    if (!exists) {
      res.status(404).json({ error: 'Colaborador no encontrado' })
      return
    }
    const oid = new mongoose.Types.ObjectId(id)
    const [ev, pl, cap] = await Promise.all([
      Evaluacion.exists({ colaborador_id: oid }),
      PlanCarrera.exists({ colaborador_id: oid }),
      Capacitacion.exists({ 'asignados.colaborador_id': oid }),
    ])
    if (ev || pl || cap) {
      res.status(409).json({
        error:
          'No se puede eliminar: existen evaluaciones, plan de carrera o capacitaciones vinculadas.',
      })
      return
    }
    await Colaborador.findByIdAndDelete(id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
