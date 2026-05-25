import { Router, type Request, type Response, type NextFunction } from 'express'
import mongoose from 'mongoose'

import { Capacitacion } from '../db/models/Capacitacion.js'
import { recalcCapacitacionEstado } from './capacitaciones.js'
import { capVisibleEnScope, resolveCapacitacionScope } from '../utils/capacitacionScope.js'
import { normalizeCertificadoStored } from '../utils/certificadoStored.js'
import { uploadCertificado } from '../utils/multerCertificados.js'

async function assertCapacitacionEnAlcance(
  req: Request,
  cap: { departamentos_ids?: unknown[] },
): Promise<boolean> {
  const userId = req.user?._id
  if (!userId) return false
  const scope = await resolveCapacitacionScope(userId, req.user?.permisos ?? [])
  return capVisibleEnScope(cap, scope)
}

const POPULATE_FIELDS = [
  { path: 'asignados.colaborador_id', select: 'nombre codigo puesto frente estado departamento_id' },
  { path: 'proveedor_id', select: 'nombre sitio_web activo' },
  { path: 'departamentos_ids', select: 'codigo nombre color' },
] as const

const ESTADOS_ASIG = ['Pendiente', 'En progreso', 'Completado'] as const

/** PUT /api/capacitacion-colaboradores/:id — :id = capacitación; body incluye colaborador_id. */
export const capacitacionColaboradoresRouter = Router()

capacitacionColaboradoresRouter.put('/:id', async (req, res, next) => {
  try {
    const { id: capacitacionId } = req.params
    if (!mongoose.isValidObjectId(capacitacionId)) {
      res.status(400).json({ error: 'Identificador de capacitación inválido' })
      return
    }
    const { colaborador_id, estado, fecha_completado, calificacion, certificado } =
      req.body as Record<string, unknown>
    if (typeof colaborador_id !== 'string' || !mongoose.isValidObjectId(colaborador_id)) {
      res.status(400).json({ error: 'colaborador_id inválido' })
      return
    }
    const colOid = new mongoose.Types.ObjectId(colaborador_id)
    const cap = await Capacitacion.findById(capacitacionId)
    if (!cap) {
      res.status(404).json({ error: 'Capacitación no encontrada' })
      return
    }
    if (!(await assertCapacitacionEnAlcance(req, cap))) {
      res.status(403).json({ error: 'Capacitación fuera de tu alcance por departamento' })
      return
    }
    const row = cap.asignados.find((a) => a.colaborador_id?.equals(colOid))
    if (!row) {
      res.status(404).json({ error: 'Asignación no encontrada para ese colaborador' })
      return
    }
    if (estado !== undefined) {
      if (typeof estado !== 'string' || !ESTADOS_ASIG.includes(estado as (typeof ESTADOS_ASIG)[number])) {
        res.status(400).json({ error: 'Estado de asignación inválido' })
        return
      }
      row.estado = estado as (typeof ESTADOS_ASIG)[number]
    }
    if (fecha_completado !== undefined) {
      if (fecha_completado === null || fecha_completado === '') {
        row.fecha_completado = undefined
      } else if (typeof fecha_completado === 'string' || fecha_completado instanceof Date) {
        row.fecha_completado = new Date(fecha_completado as string | Date)
      }
    }
    if (calificacion !== undefined) {
      if (calificacion === null || calificacion === '') {
        row.calificacion = undefined
      } else {
        const n = Number(calificacion)
        if (Number.isNaN(n)) {
          res.status(400).json({ error: 'calificacion debe ser numérico' })
          return
        }
        row.calificacion = n
      }
    }
    if (certificado !== undefined) {
      row.certificado =
        certificado === null || certificado === ''
          ? undefined
          : normalizeCertificadoStored(String(certificado))
    }
    cap.estado = recalcCapacitacionEstado(cap.asignados)
    await cap.save()
    const full = await Capacitacion.findById(capacitacionId).populate(POPULATE_FIELDS).lean()
    res.json(full)
  } catch (err) {
    next(err)
  }
})

/** POST /api/capacitacion-colaboradores/:id/certificado — subir certificado */
capacitacionColaboradoresRouter.post(
  '/:id/certificado',
  (req: Request, res: Response, next: NextFunction) => {
    uploadCertificado(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Error al subir archivo' })
        return
      }
      next()
    })
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: capacitacionId } = req.params
      if (!mongoose.isValidObjectId(capacitacionId)) {
        res.status(400).json({ error: 'Identificador de capacitación inválido' })
        return
      }
      const colaborador_id = (req.body as Record<string, unknown>).colaborador_id as string
      if (!colaborador_id || !mongoose.isValidObjectId(colaborador_id)) {
        res.status(400).json({ error: 'colaborador_id inválido' })
        return
      }
      const file = req.file
      if (!file) {
        res.status(400).json({ error: 'No se recibió ningún archivo' })
        return
      }
      const colOid = new mongoose.Types.ObjectId(colaborador_id)
      const cap = await Capacitacion.findById(capacitacionId)
      if (!cap) {
        res.status(404).json({ error: 'Capacitación no encontrada' })
        return
      }
      if (!(await assertCapacitacionEnAlcance(req, cap))) {
        res.status(403).json({ error: 'Capacitación fuera de tu alcance por departamento' })
        return
      }
      const row = cap.asignados.find((a) => a.colaborador_id?.equals(colOid))
      if (!row) {
        res.status(404).json({ error: 'Asignación no encontrada para ese colaborador' })
        return
      }
      row.certificado = file.filename
      row.certificado_nombre = file.originalname
      await cap.save()
      const full = await Capacitacion.findById(capacitacionId)
        .populate(POPULATE_FIELDS)
        .lean()
      res.json(full)
    } catch (err) {
      next(err)
    }
  },
)
