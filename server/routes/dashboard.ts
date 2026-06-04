import { Router } from 'express'
import mongoose from 'mongoose'

import { Departamento } from '../db/models/Departamento.js'
import { KPI } from '../db/models/KPI.js'
import { Proyecto } from '../db/models/Proyecto.js'
import { Tarea } from '../db/models/Tarea.js'
import {
  buildKpiFilter,
  countCapacitacionesEnProgreso,
  resolveDashboardScope,
} from '../utils/dashboardScope.js'
import { PROYECTO_ESTADOS_ACTIVOS } from '../utils/proyectoScope.js'
import { kpiPromedioGlobal, type KpiLean } from '../utils/kpiPct.js'
import type { MetaDeptoDoc } from '../utils/metasDepartamento.js'
import {
  buildResumenDepartamento,
  resolveDepartamentoId,
} from '../utils/resumenDepartamento.js'

export const dashboardRouter = Router()

const filtroActivos = { estado: { $in: [...PROYECTO_ESTADOS_ACTIVOS] } }

function mergeFilters(
  base: Record<string, unknown>,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  if (!Object.keys(base).length) return extra
  if (!Object.keys(extra).length) return base
  return { $and: [base, extra] }
}

/** GET /api/dashboard/resumen-departamento?departamento_id= — metas + plan de trabajo visual */
dashboardRouter.get('/resumen-departamento', async (req, res, next) => {
  try {
    const u = req.user
    if (!u) {
      res.status(401).json({ error: 'No autenticado' })
      return
    }
    const prefer =
      typeof req.query.departamento_id === 'string' ? req.query.departamento_id : u.departamento_id
    const deptId = await resolveDepartamentoId(prefer ?? null)
    if (!deptId) {
      res.status(503).json({
        error:
          'No se encontró el departamento IT en la base de datos. Ejecute la carga inicial (INIT_DATA_ON_START) o revise Maestro · Departamentos.',
      })
      return
    }
    const dto = await buildResumenDepartamento(deptId)
    if (!dto) {
      res.status(503).json({ error: 'No se pudo construir el resumen del departamento.' })
      return
    }
    res.json(dto)
  } catch (err) {
    next(err)
  }
})

dashboardRouter.get('/resumen', async (req, res, next) => {
  try {
    const u = req.user
    if (!u) {
      res.status(401).json({ error: 'No autenticado' })
      return
    }

    const scope = await resolveDashboardScope(u._id, u.permisos ?? [])
    const proyectoBase = scope.proyectoFilter
    const filtroActivosProyectos = mergeFilters(proyectoBase, filtroActivos)
    const kpiFilter = buildKpiFilter(scope)

    const startDay = new Date()
    startDay.setHours(0, 0, 0, 0)
    const end14 = new Date(startDay)
    end14.setDate(end14.getDate() + 14)
    end14.setHours(23, 59, 59, 999)

    const proyectoIds = await Proyecto.find(proyectoBase).distinct('_id')

    const [
      proyectosTotal,
      proyectosActivos,
      tareasVencidas,
      capsEnProgreso,
      kpisLean,
      faseRows,
    ] = await Promise.all([
      Proyecto.countDocuments(proyectoBase),
      Proyecto.countDocuments(filtroActivosProyectos),
      proyectoIds.length === 0
        ? Promise.resolve(0)
        : Tarea.countDocuments({
            proyecto_id: { $in: proyectoIds },
            fecha_fin: { $lt: startDay },
            estado: { $nin: ['Completado'] },
          }),
      countCapacitacionesEnProgreso(scope),
      KPI.find(kpiFilter)
        .populate({ path: 'proyecto_ids', select: '_id nombre eje estado porcentaje_avance' })
        .lean(),
      Proyecto.aggregate<{ _id: number; avg: number }>([
        { $match: proyectoBase },
        { $group: { _id: '$fase', avg: { $avg: '$porcentaje_avance' } } },
      ]),
    ])

    const fromColl = Proyecto.collection.name
    const tareasProximas =
      proyectoIds.length === 0
        ? []
        : await Tarea.aggregate<{
            _id: unknown
            nombre: string
            proyecto_id: string
            responsable?: string
            fecha_fin: Date
            estado: string
            proyecto_nombre?: string
          }>([
            {
              $match: {
                proyecto_id: { $in: proyectoIds },
                fecha_fin: { $gte: startDay, $lte: end14 },
                estado: { $nin: ['Completado'] },
              },
            },
            {
              $lookup: {
                from: fromColl,
                localField: 'proyecto_id',
                foreignField: '_id',
                as: 'proj',
              },
            },
            {
              $project: {
                nombre: 1,
                proyecto_id: 1,
                responsable: 1,
                fecha_fin: 1,
                estado: 1,
                proyecto_nombre: { $arrayElemAt: ['$proj.nombre', 0] },
              },
            },
            { $sort: { fecha_fin: 1 } },
            { $limit: 30 },
          ])

    const faseMap = new Map<number, number>()
    for (const r of faseRows) {
      if (r._id === 1 || r._id === 2 || r._id === 3) {
        faseMap.set(r._id, Math.round(r.avg ?? 0))
      }
    }
    const avancePorFase = ([1, 2, 3] as const).map((fase) => ({
      fase,
      pct: faseMap.get(fase) ?? 0,
    }))

    const kpi_promedio_pct = kpiPromedioGlobal(kpisLean as KpiLean[])

    const deptIdsForMetas = new Set<string>(
      scope.departamentoIds.map((id) => String(id)),
    )
    if (deptIdsForMetas.size === 0) {
      for (const k of kpisLean as { departamento_id?: unknown }[]) {
        const d = k.departamento_id
        const id =
          d && typeof d === 'object' && '_id' in d
            ? String((d as { _id: unknown })._id)
            : d
              ? String(d)
              : ''
        if (mongoose.isValidObjectId(id)) deptIdsForMetas.add(id)
      }
    }
    const deptRows =
      deptIdsForMetas.size > 0
        ? await Departamento.find({
            _id: {
              $in: [...deptIdsForMetas].map((id) => new mongoose.Types.ObjectId(id)),
            },
          })
            .select('metas_estrategicas')
            .lean()
        : []
    const metasMap = new Map<string, MetaDeptoDoc>()
    for (const d of deptRows) {
      for (const m of (d.metas_estrategicas ?? []) as MetaDeptoDoc[]) {
        if (m.activa === false) continue
        if (!metasMap.has(m.id)) metasMap.set(m.id, m)
      }
    }

    res.json({
      alcance: scope.alcance,
      proyectos_activos: proyectosActivos,
      proyectos_total: proyectosTotal,
      tareas_vencidas: tareasVencidas,
      kpi_promedio_pct,
      capacitaciones_en_progreso: capsEnProgreso,
      avance_por_fase: avancePorFase,
      tareas_proximas: tareasProximas.map((t) => ({
        _id: String(t._id),
        nombre: t.nombre,
        proyecto_id: t.proyecto_id,
        proyecto_nombre: t.proyecto_nombre ?? t.proyecto_id,
        responsable: t.responsable ?? '',
        fecha_fin: t.fecha_fin,
        estado: t.estado,
      })),
      kpis: kpisLean,
      metas_estrategicas: [...metasMap.values()],
    })
  } catch (err) {
    next(err)
  }
})
