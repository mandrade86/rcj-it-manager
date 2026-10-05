import { Router } from 'express'
import mongoose from 'mongoose'

import { Evaluacion } from '../db/models/Evaluacion.js'
import { EvaluacionKPI } from '../db/models/EvaluacionKPI.js'
import { PlanCarrera } from '../db/models/PlanCarrera.js'
import { Colaborador } from '../db/models/Colaborador.js'
import { Empleado } from '../db/models/Empleado.js'
import { Departamento } from '../db/models/Departamento.js'
import { KPI } from '../db/models/KPI.js'
import { Proyecto } from '../db/models/Proyecto.js'
import { Tarea } from '../db/models/Tarea.js'
import { Capacitacion } from '../db/models/Capacitacion.js'
import { Rol } from '../db/models/Rol.js'
import { Usuario } from '../db/models/Usuario.js'
import { Auditoria } from '../db/models/Auditoria.js'
import {
  buildKpiFilter,
  countCapacitacionesEnProgreso,
  resolveDashboardScope,
} from '../utils/dashboardScope.js'
import {
  buildPortfolioSnapshot,
  type EmpleadoCargaInfo,
  type PortfolioProyecto,
  type PortfolioTarea,
} from '../utils/dashboardPortfolio.js'
import { PROYECTO_ESTADOS_ACTIVOS } from '../utils/proyectoScope.js'
import { kpiPromedioGlobal, type KpiLean } from '../utils/kpiPct.js'
import type { MetaDeptoDoc } from '../utils/metasDepartamento.js'
import {
  buildResumenDepartamento,
  resolveDepartamentoId,
} from '../utils/resumenDepartamento.js'

export const dashboardRouter = Router()

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

/** GET /api/dashboard/mi-dia — tareas asignadas al usuario actual, agrupadas. */
dashboardRouter.get('/mi-dia', async (req, res, next) => {
  try {
    const u = req.user
    if (!u) {
      res.status(401).json({ error: 'No autenticado' })
      return
    }

    const or: Record<string, unknown>[] = []
    if (u.empleado_id && mongoose.isValidObjectId(u.empleado_id)) {
      or.push({ responsable_id: new mongoose.Types.ObjectId(u.empleado_id) })
    }
    const nombre = (u.empleado_nombre || u.nombre || '').trim()
    if (nombre) {
      const esc = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      or.push({ responsable: new RegExp(`^${esc}$`, 'i') })
    }

    const startDay = new Date()
    startDay.setHours(0, 0, 0, 0)
    const endDay = new Date(startDay)
    endDay.setHours(23, 59, 59, 999)
    const doneSince = new Date(startDay)
    doneSince.setDate(doneSince.getDate() - 14)

    const rows = or.length === 0
      ? []
      : await Tarea.find({ $or: or })
      .select('nombre proyecto_id responsable responsable_id fecha_fin estado prioridad porcentaje updatedAt')
      .sort({ fecha_fin: 1, nombre: 1 })
      .lean()

    const proyectoIds = [...new Set(rows.map((t) => t.proyecto_id).filter(Boolean).map(String))]
    const proyectos = await Proyecto.find({ _id: { $in: proyectoIds } })
      .select('_id nombre')
      .lean()
    const nombreProyecto = new Map(proyectos.map((p) => [String(p._id), p.nombre ?? String(p._id)]))

    type Item = {
      _id: string
      nombre: string
      proyecto_id: string
      proyecto_nombre: string
      responsable: string
      responsable_id: string
      fecha_fin: Date | null
      estado: string
      prioridad: string | null
      porcentaje: number
    }

    const toItem = (t: (typeof rows)[number]): Item => {
      const pid = t.proyecto_id ? String(t.proyecto_id) : ''
      return {
        _id: String(t._id),
        nombre: t.nombre,
        proyecto_id: pid,
        proyecto_nombre: pid ? (nombreProyecto.get(pid) ?? pid) : 'Personal',
        responsable: t.responsable ?? '',
        responsable_id: t.responsable_id ? String(t.responsable_id) : '',
        fecha_fin: t.fecha_fin ?? null,
        estado: t.estado,
        prioridad: t.prioridad ?? null,
        porcentaje: t.porcentaje ?? 0,
      }
    }

    const vencidas: Item[] = []
    const hoy: Item[] = []
    const proximas: Item[] = []
    const completadas: Item[] = []

    for (const t of rows) {
      const item = toItem(t)
      if (t.estado === 'Completado') {
        const upd = t.updatedAt ? new Date(t.updatedAt) : null
        if (!upd || upd >= doneSince) completadas.push(item)
        continue
      }
      const fin = t.fecha_fin ? new Date(t.fecha_fin) : null
      if (fin && fin < startDay) vencidas.push(item)
      else if (fin && fin >= startDay && fin <= endDay) hoy.push(item)
      else proximas.push(item)
    }

    const puedeVerEval = (u.permisos ?? []).includes('*')
      || (u.permisos ?? []).includes('equipo:ver')
      || (u.permisos ?? []).includes('equipo:editar')
    const aprobaciones = puedeVerEval
      ? (await Evaluacion.find({
          $or: [
            { 'firmas.colaborador': { $ne: true } },
            { 'firmas.coordinador': { $ne: true } },
            { 'firmas.jefe': { $ne: true } },
            { 'firmas.rrhh': { $ne: true } },
          ],
        })
          .sort({ updatedAt: -1 })
          .limit(8)
          .select('fecha decision firmas')
          .lean()).map((ev) => {
          const firmas = (ev.firmas ?? {}) as Record<string, boolean>
          const faltan = ['colaborador', 'coordinador', 'jefe', 'rrhh'].filter((k) => firmas[k] !== true)
          return {
            _id: String(ev._id),
            titulo: ev.decision ? `Evaluación · ${ev.decision}` : 'Evaluación pendiente de firma',
            detalle: faltan.length ? `Falta firma: ${faltan.join(', ')}` : 'Pendiente',
            href: '/equipo',
          }
        })
      : []

    res.json({ vencidas, hoy, proximas, completadas, aprobaciones })
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
    const kpiFilter = buildKpiFilter(scope)

    const startDay = new Date()
    startDay.setHours(0, 0, 0, 0)
    const end14 = new Date(startDay)
    end14.setDate(end14.getDate() + 14)
    end14.setHours(23, 59, 59, 999)

    const [
      proyectosLean,
      capsEnProgreso,
      kpisLean,
      faseRows,
    ] = await Promise.all([
      Proyecto.find(proyectoBase)
        .select(
          '_id nombre eje fase estado prioridad porcentaje_avance responsable fecha_inicio fecha_fin presupuesto_planificado presupuesto_asignado presupuesto_ejecutado moneda_presupuesto riesgos_registro createdAt',
        )
        .lean(),
      countCapacitacionesEnProgreso(scope),
      KPI.find(kpiFilter)
        .populate({ path: 'proyecto_ids', select: '_id nombre eje estado porcentaje_avance' })
        .lean(),
      Proyecto.aggregate<{ _id: number; avg: number }>([
        { $match: proyectoBase },
        { $group: { _id: '$fase', avg: { $avg: '$porcentaje_avance' } } },
      ]),
    ])

    const proyectoIds = proyectosLean.map((p) => p._id)
    const proyectosTotal = proyectosLean.length
    const proyectosActivos = proyectosLean.filter((p) =>
      PROYECTO_ESTADOS_ACTIVOS.includes(
        p.estado as (typeof PROYECTO_ESTADOS_ACTIVOS)[number],
      ),
    ).length

    const tareasLean =
      proyectoIds.length === 0
        ? []
        : await Tarea.find({ proyecto_id: { $in: proyectoIds } })
            .select(
              'nombre proyecto_id estado prioridad porcentaje fecha_fin responsable responsable_id createdAt updatedAt',
            )
            .lean()

    const responsableIds = [
      ...new Set(
        tareasLean
          .map((t) => (t.responsable_id ? String(t.responsable_id) : ''))
          .filter((id) => mongoose.isValidObjectId(id)),
      ),
    ]
    const responsableNombres = [
      ...new Set(
        tareasLean
          .filter((t) => !t.responsable_id && (t.responsable || '').trim())
          .map((t) => (t.responsable as string).trim()),
      ),
    ]
    const empleadosCarga: EmpleadoCargaInfo[] =
      responsableIds.length === 0 && responsableNombres.length === 0
        ? []
        : (
            await Empleado.find({
              $or: [
                ...(responsableIds.length ? [{ _id: { $in: responsableIds } }] : []),
                ...(responsableNombres.length
                  ? [{ nombre: { $in: responsableNombres }, activo: { $ne: false } }]
                  : []),
              ],
            })
              .select('nombre departamento departamento_id')
              .populate('departamento_id', 'nombre')
              .lean()
          ).map((e) => {
            const dept = e.departamento_id
            const deptNombre =
              dept && typeof dept === 'object' && 'nombre' in dept
                ? String((dept as { nombre?: string }).nombre || '')
                : e.departamento || ''
            const deptId =
              dept && typeof dept === 'object' && '_id' in dept
                ? String((dept as { _id: unknown })._id)
                : dept
                  ? String(dept)
                  : null
            return {
              _id: String(e._id),
              nombre: e.nombre,
              departamento: deptNombre || e.departamento || 'Sin equipo',
              departamento_id: deptId,
            }
          })

    const portfolio = buildPortfolioSnapshot(
      proyectosLean as unknown as PortfolioProyecto[],
      tareasLean as unknown as PortfolioTarea[],
      startDay,
      empleadosCarga,
    )
    const tareasVencidas = portfolio.tareas.vencidas

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
      portfolio,
    })
  } catch (err) {
    next(err)
  }
})

function tiene(permisos: string[], clave: string): boolean {
  return permisos.includes('*') || permisos.includes(clave)
}

dashboardRouter.get('/paneles', async (req, res, next) => {
  try {
    const u = req.user
    if (!u) { res.status(401).json({ error: 'No autenticado' }); return }
    const permisos = u.permisos ?? []
    const rrhh = tiene(permisos, 'equipo:ver') || tiene(permisos, 'empleados:ver') || tiene(permisos, 'capacitaciones:ver')
    const admin = tiene(permisos, 'usuarios:ver') || tiene(permisos, 'roles:ver')
    const out: Record<string, unknown> = {}
    if (rrhh) {
      const mesRaw = Number(req.query.mes)
      const mes = Number.isInteger(mesRaw) && mesRaw >= 1 && mesRaw <= 12
        ? mesRaw
        : new Date().getMonth() + 1
      const anio = new Date().getFullYear()
      const desde = new Date(anio, mes - 1, 1)
      const hasta = new Date(anio, mes, 1)

      const [activos, inactivos, caps, firmas, planesDocs] = await Promise.all([
        Empleado.countDocuments({ activo: { $ne: false } }),
        Empleado.countDocuments({ activo: false }),
        Capacitacion.countDocuments({ estado: 'En progreso' }),
        Evaluacion.countDocuments({
          $or: [
            { 'firmas.colaborador': { $ne: true } },
            { 'firmas.coordinador': { $ne: true } },
            { 'firmas.jefe': { $ne: true } },
            { 'firmas.rrhh': { $ne: true } },
          ],
        }),
        PlanCarrera.find()
          .select('colaborador_id tipo mes_evaluacion items.estado')
          .lean(),
      ])

      const colIds = planesDocs.map((p) => p.colaborador_id)
      const [colaboradores, evals, evalsKpi] = await Promise.all([
        Colaborador.find({ _id: { $in: colIds } }).select('nombre puesto estado').lean(),
        Evaluacion.find({
          colaborador_id: { $in: colIds },
          fecha: { $gte: desde, $lt: hasta },
        }).select('colaborador_id fecha resultado_global').sort({ fecha: -1 }).lean(),
        EvaluacionKPI.find({
          colaborador_id: { $in: colIds },
          fecha: { $gte: desde, $lt: hasta },
        }).select('colaborador_id fecha nivel_cumplimiento').sort({ fecha: -1 }).lean(),
      ])
      const colMap = new Map(colaboradores.map((c) => [String(c._id), c]))
      const evalMap = new Map<string, { fecha: Date; resultado: string }>()
      for (const ev of evals) {
        const id = String(ev.colaborador_id)
        if (!evalMap.has(id) && ev.fecha) {
          evalMap.set(id, { fecha: ev.fecha, resultado: ev.resultado_global ?? 'Registrada' })
        }
      }
      for (const ev of evalsKpi) {
        const id = String(ev.colaborador_id)
        const previa = evalMap.get(id)
        if (ev.fecha && (!previa || ev.fecha > previa.fecha)) {
          evalMap.set(id, { fecha: ev.fecha, resultado: ev.nivel_cumplimiento ?? 'Registrada' })
        }
      }

      const planes = planesDocs.flatMap((p) => {
        const col = colMap.get(String(p.colaborador_id))
        if (!col) return []
        const items = p.items ?? []
        const total = items.length
        const completados = items.filter((it) => it.estado === 'Completado').length
        return [{
          colaborador_id: String(p.colaborador_id),
          nombre: col.nombre,
          puesto: col.puesto,
          tipo: p.tipo,
          mes_evaluacion: p.mes_evaluacion ?? null,
          items_total: total,
          items_completados: completados,
          avance_pct: total > 0 ? Math.round((completados / total) * 100) : 0,
        }]
      }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

      const evaluaciones_mes = planes
        .filter((p) => p.mes_evaluacion === mes)
        .map((p) => {
          const ev = evalMap.get(p.colaborador_id)
          return {
            colaborador_id: p.colaborador_id,
            nombre: p.nombre,
            puesto: p.puesto,
            tipo: p.tipo,
            tiene_evaluacion: Boolean(ev),
            fecha: ev?.fecha.toISOString() ?? null,
            resultado: ev?.resultado ?? null,
          }
        })

      out.rrhh = {
        mes,
        anio,
        empleados_activos: activos,
        empleados_inactivos: inactivos,
        capacitaciones_en_progreso: caps,
        evaluaciones_sin_firma: firmas,
        planes_total: planes.length,
        planes_sin_mes: planes.filter((p) => p.mes_evaluacion == null).length,
        evaluaciones_pendientes_mes: evaluaciones_mes.filter((e) => !e.tiene_evaluacion).length,
        planes,
        evaluaciones_mes,
      }
    }
    if (admin) {
      const [activos, inactivos, roles, accesos, auditoria] = await Promise.all([
        Usuario.countDocuments({ activo: { $ne: false } }),
        Usuario.countDocuments({ activo: false }),
        Rol.countDocuments({ activo: { $ne: false } }),
        Usuario.find({ activo: { $ne: false } })
          .select('nombre ultimo_acceso')
          .sort({ ultimo_acceso: -1 })
          .limit(6)
          .lean(),
        Auditoria.find().sort({ createdAt: -1 }).limit(6).lean(),
      ])
      out.admin = {
        usuarios_activos: activos,
        usuarios_inactivos: inactivos,
        roles,
        accesos: accesos.map((a) => ({
          nombre: a.nombre,
          ultimo_acceso: a.ultimo_acceso ?? null,
        })),
        auditoria: auditoria.map((r) => ({
          _id: String(r._id),
          usuario_nombre: r.usuario_nombre || '—',
          accion: r.accion,
          entidad: r.entidad,
          detalle: r.detalle,
          ip: r.ip || '—',
          createdAt: r.createdAt,
        })),
      }
    }
    res.json(out)
  } catch (err) {
    next(err)
  }
})

dashboardRouter.get('/notificaciones', async (req, res, next) => {
  try {
    const u = req.user
    if (!u) { res.status(401).json({ error: 'No autenticado' }); return }
    const items: Array<{
      id: string
      tipo: string
      titulo: string
      detalle: string
      fecha: string | null
      href: string
    }> = []

    const or: Record<string, unknown>[] = []
    if (u.empleado_id && mongoose.isValidObjectId(u.empleado_id)) {
      or.push({ responsable_id: new mongoose.Types.ObjectId(u.empleado_id) })
    }
    const nombre = (u.empleado_nombre || u.nombre || '').trim()
    if (nombre) {
      const esc = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      or.push({ responsable: new RegExp(`^${esc}$`, 'i') })
    }
    if (or.length) {
      const startDay = new Date()
      startDay.setHours(0, 0, 0, 0)
      const end7 = new Date(startDay)
      end7.setDate(end7.getDate() + 7)
      const tareas = await Tarea.find({
        $or: or,
        estado: { $ne: 'Completado' },
      })
        .select('nombre proyecto_id fecha_fin estado')
        .sort({ fecha_fin: 1 })
        .limit(30)
        .lean()
      const pids = [...new Set(tareas.map((t) => String(t.proyecto_id ?? '')).filter(Boolean))]
      const proyectos = await Proyecto.find({ _id: { $in: pids } }).select('_id nombre').lean()
      const mapa = new Map(proyectos.map((p) => [String(p._id), p.nombre]))
      for (const t of tareas) {
        const fin = t.fecha_fin ? new Date(t.fecha_fin) : null
        if (fin && fin > end7) continue
        const pid = String(t.proyecto_id ?? '')
        const vencida = Boolean(fin && fin < startDay)
        items.push({
          id: `tarea-${t._id}`,
          tipo: vencida ? 'vencida' : 'tarea',
          titulo: t.nombre,
          detalle: `${vencida ? 'Vencida' : 'Por vencer'} · ${mapa.get(pid) ?? 'Tarea'}`,
          fecha: fin ? fin.toISOString() : null,
          href: pid ? `/proyectos/${encodeURIComponent(pid)}` : '/mis-tareas',
        })
      }
    }

    const permisos = u.permisos ?? []
    if (tiene(permisos, 'equipo:ver') || tiene(permisos, 'equipo:editar')) {
      const evals = await Evaluacion.find({
        $or: [
          { 'firmas.colaborador': { $ne: true } },
          { 'firmas.coordinador': { $ne: true } },
          { 'firmas.jefe': { $ne: true } },
          { 'firmas.rrhh': { $ne: true } },
        ],
      })
        .sort({ updatedAt: -1 })
        .limit(8)
        .select('decision updatedAt')
        .lean()
      for (const ev of evals) {
        items.push({
          id: `eval-${ev._id}`,
          tipo: 'aprobacion',
          titulo: ev.decision ? `Evaluación · ${ev.decision}` : 'Evaluación pendiente de firma',
          detalle: 'Falta al menos una firma',
          fecha: ev.updatedAt ? new Date(ev.updatedAt).toISOString() : null,
          href: '/equipo',
        })
      }
    }

    res.json({ items })
  } catch (err) {
    next(err)
  }
})
