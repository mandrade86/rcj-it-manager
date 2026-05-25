import { Router } from 'express'
import mongoose from 'mongoose'

import { Empleado } from '../db/models/Empleado.js'
import { RegistroVacacion } from '../db/models/RegistroVacacion.js'
import {
  calcularVacacionesHN,
  diasHabilesEntre,
} from '../utils/vacacionesHN.js'

export const vacacionesRouter = Router()

/**
 * GET /api/vacaciones/empleado/:empleadoId
 * Devuelve el cálculo legal (Honduras) de vacaciones para el empleado,
 * junto con el historial de períodos registrados.
 *
 * Query opcional:
 *   - fecha_corte (ISO date): para simular el cálculo a una fecha específica.
 */
vacacionesRouter.get('/empleado/:empleadoId', async (req, res, next) => {
  try {
    const { empleadoId } = req.params
    if (!mongoose.isValidObjectId(empleadoId)) {
      res.status(400).json({ error: 'Identificador de empleado inválido' })
      return
    }
    const empleado = await Empleado.findById(empleadoId)
      .select('_id codigo nombre puesto fecha_ingreso datos_externos activo')
      .lean()
    if (!empleado) {
      res.status(404).json({ error: 'Empleado no encontrado' })
      return
    }

    const fechaCorte = typeof req.query.fecha_corte === 'string' && req.query.fecha_corte
      ? new Date(req.query.fecha_corte)
      : new Date()

    const registros = await RegistroVacacion.find({ empleado_id: empleado._id })
      .sort({ fecha_inicio: -1 })
      .lean()

    // Días gozados = suma de días_habiles de registros con estado distinto de Cancelado,
    // y cuya fecha_inicio <= fechaCorte
    const gozados = registros
      .filter((r) => r.estado !== 'Cancelado' && new Date(r.fecha_inicio).getTime() <= fechaCorte.getTime())
      .reduce((acc, r) => acc + (Number(r.dias_habiles) || 0), 0)

    const calculo = calcularVacacionesHN(empleado.fecha_ingreso, fechaCorte, gozados)

    res.json({
      empleado: {
        _id: empleado._id,
        codigo: empleado.codigo,
        nombre: empleado.nombre,
        puesto: empleado.puesto,
        activo: empleado.activo,
        fecha_ingreso: empleado.fecha_ingreso,
      },
      calculo,
      registros,
    })
  } catch (err) {
    next(err)
  }
})

function parseEmpleadoIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .filter((s) => mongoose.isValidObjectId(s))
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => mongoose.isValidObjectId(s))
  }
  return []
}

async function buildVacacionesResumen(ids: string[]) {
  if (ids.length === 0) return []
  const empleados = await Empleado.find({ _id: { $in: ids } })
    .select('_id fecha_ingreso')
    .lean()
  const registros = await RegistroVacacion.find({
    empleado_id: { $in: ids },
    estado: { $ne: 'Cancelado' },
  })
    .select('empleado_id dias_habiles')
    .lean()

  const gozadosPorEmpleado = new Map<string, number>()
  for (const r of registros) {
    const key = String(r.empleado_id)
    gozadosPorEmpleado.set(key, (gozadosPorEmpleado.get(key) ?? 0) + (Number(r.dias_habiles) || 0))
  }

  const ahora = new Date()
  return empleados.map((e) => {
    const gozados = gozadosPorEmpleado.get(String(e._id)) ?? 0
    const c = calcularVacacionesHN(e.fecha_ingreso, ahora, gozados)
    return {
      empleado_id: String(e._id),
      fecha_ingreso: e.fecha_ingreso,
      aniosServicio: c.aniosServicio,
      diasAcumuladosTotales: c.diasAcumuladosTotales,
      diasGozados: c.diasGozados,
      diasDisponibles: c.diasDisponibles,
      proximoAniversario: c.proximoAniversario,
      proximoDerecho: c.proximoDerecho,
    }
  })
}

/**
 * POST /api/vacaciones/resumen
 * Cálculo en lote (body JSON) — evita URL demasiado larga con muchos empleados.
 */
vacacionesRouter.post('/resumen', async (req, res, next) => {
  try {
    const ids = parseEmpleadoIds((req.body as { empleado_ids?: unknown })?.empleado_ids)
    const resumen = await buildVacacionesResumen(ids)
    res.json({ resumen })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/vacaciones/resumen?empleado_ids=id1,id2 (listas pequeñas; preferir POST)
 */
vacacionesRouter.get('/resumen', async (req, res, next) => {
  try {
    const raw = typeof req.query.empleado_ids === 'string' ? req.query.empleado_ids : ''
    if (raw.length > 4000) {
      res.status(400).json({
        error: 'Demasiados identificadores en la URL. Use POST /api/vacaciones/resumen con body JSON.',
      })
      return
    }
    const ids = parseEmpleadoIds(raw)
    const resumen = await buildVacacionesResumen(ids)
    res.json({ resumen })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/vacaciones
 * Registra un nuevo período de vacaciones.
 * Body: { empleado_id, fecha_inicio, fecha_fin, dias_habiles?, estado?, notas? }
 * Si no se envía `dias_habiles`, se calculan automáticamente (lun-vie inclusivo).
 */
vacacionesRouter.post('/', async (req, res, next) => {
  try {
    const userId = req.user?._id ?? null
    const {
      empleado_id, fecha_inicio, fecha_fin, dias_habiles, estado, notas,
    } = req.body as Record<string, unknown>

    if (typeof empleado_id !== 'string' || !mongoose.isValidObjectId(empleado_id)) {
      res.status(400).json({ error: 'empleado_id inválido' })
      return
    }
    if (!fecha_inicio || !fecha_fin) {
      res.status(400).json({ error: 'fecha_inicio y fecha_fin son obligatorios' })
      return
    }
    const ini = new Date(String(fecha_inicio))
    const fin = new Date(String(fecha_fin))
    if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime())) {
      res.status(400).json({ error: 'Fechas inválidas' })
      return
    }
    if (fin.getTime() < ini.getTime()) {
      res.status(400).json({ error: 'La fecha fin debe ser igual o posterior al inicio' })
      return
    }

    const empleado = await Empleado.findById(empleado_id).select('_id').lean()
    if (!empleado) {
      res.status(404).json({ error: 'Empleado no encontrado' })
      return
    }

    const diasFinal = typeof dias_habiles === 'number' && dias_habiles >= 0
      ? dias_habiles
      : diasHabilesEntre(ini, fin)

    const estadoFinal = typeof estado === 'string' &&
      ['Programado', 'Aprobado', 'Gozado', 'Cancelado'].includes(estado)
      ? estado
      : 'Aprobado'

    const doc = await RegistroVacacion.create({
      empleado_id,
      fecha_inicio: ini,
      fecha_fin: fin,
      dias_habiles: diasFinal,
      estado: estadoFinal,
      notas: typeof notas === 'string' ? notas : '',
      registrado_por: userId,
    })
    res.status(201).json(doc.toObject())
  } catch (err) {
    next(err)
  }
})

vacacionesRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const allowed = ['fecha_inicio', 'fecha_fin', 'dias_habiles', 'estado', 'notas'] as const
    const $set: Record<string, unknown> = {}
    const body = req.body as Record<string, unknown>
    for (const k of allowed) {
      if (body[k] === undefined) continue
      if (k === 'fecha_inicio' || k === 'fecha_fin') {
        $set[k] = new Date(String(body[k]))
      } else {
        $set[k] = body[k]
      }
    }
    // Si actualizan fechas pero no días, recalculamos
    if (
      ($set.fecha_inicio || $set.fecha_fin) &&
      body.dias_habiles === undefined
    ) {
      const cur = await RegistroVacacion.findById(id).lean()
      if (!cur) {
        res.status(404).json({ error: 'Registro no encontrado' })
        return
      }
      const ini = ($set.fecha_inicio as Date) ?? cur.fecha_inicio
      const fin = ($set.fecha_fin as Date) ?? cur.fecha_fin
      $set.dias_habiles = diasHabilesEntre(ini, fin)
    }
    const doc = await RegistroVacacion.findByIdAndUpdate(id, { $set }, { new: true }).lean()
    if (!doc) {
      res.status(404).json({ error: 'Registro no encontrado' })
      return
    }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

vacacionesRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const doc = await RegistroVacacion.findByIdAndDelete(id).lean()
    if (!doc) {
      res.status(404).json({ error: 'Registro no encontrado' })
      return
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
