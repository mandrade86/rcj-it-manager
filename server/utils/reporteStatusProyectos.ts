import mongoose from 'mongoose'

import { Departamento } from '../db/models/Departamento.js'
import { Proyecto } from '../db/models/Proyecto.js'
import { Tarea } from '../db/models/Tarea.js'
import { buildProyectoScopeFilter, isAdminProyectos, resolveDepartamentosUsuario } from './proyectoScope.js'
import { calcularRiesgo } from './proyectoRiesgo.js'

export type ReporteStatusProyectoItem = {
  proyecto_id: string
  nombre: string
  departamento_id?: string | null
  eje?: string | null
  fase?: number | null
  estado: string
  prioridad: string
  porcentaje_avance: number
  responsable?: string | null
  propietario?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  meta_kpi?: string | null
  tareas_total: number
  tareas_completadas: number
  tareas_en_progreso: number
  tareas_bloqueadas: number
  tareas_pendientes: number
  riesgo_auto: { nivel: string; motivo: string; color: string }
  riesgos_registrados: number
  riesgos_alto: number
}

export type ReporteStatusDepartamento = {
  departamento_id: string | null
  departamento_nombre: string
  departamento_codigo?: string | null
  resumen: {
    total_proyectos: number
    activos: number
    completados: number
    bloqueados: number
    avance_promedio: number
  }
  proyectos: ReporteStatusProyectoItem[]
}

export async function generarReporteStatusProyectos(opts: {
  userId: string
  permisos: string[]
  alcance?: string
  departamento_id?: string
  proyecto_id?: string
}) {
  const alcance = opts.alcance ?? 'todos'
  const scope = await buildProyectoScopeFilter(opts.userId, opts.permisos)
  const filter: Record<string, unknown> = {
    ...scope,
    estado: { $ne: 'Cancelado' },
  }

  if (opts.proyecto_id) {
    filter._id = opts.proyecto_id
  }

  if (alcance === 'departamento' && opts.departamento_id) {
    if (!mongoose.isValidObjectId(opts.departamento_id)) {
      return { error: 'departamento_id inválido' }
    }
    if (!isAdminProyectos(opts.permisos)) {
      const permitidos = await resolveDepartamentosUsuario(opts.userId)
      const allowed = new Set(permitidos.map((id) => String(id)))
      if (!allowed.has(opts.departamento_id)) {
        return { error: 'Solo puedes consultar proyectos de tus departamentos asignados.' }
      }
    }
    filter.departamento_id = opts.departamento_id
  }

  const proyectos = await Proyecto.find(filter)
    .populate('departamento_id', 'codigo nombre color')
    .populate('usuario_id', 'nombre email')
    .sort({ departamento_id: 1, nombre: 1 })
    .lean() as Array<{
      _id: string
      nombre: string
      eje?: string
      fase?: number
      estado: string
      prioridad: string
      porcentaje_avance?: number
      responsable?: string
      fecha_inicio?: Date
      fecha_fin?: Date
      meta_kpi?: string
      riesgos_registro?: Array<{ nivel?: string }>
      departamento_id?: { _id: mongoose.Types.ObjectId; codigo?: string; nombre?: string } | null
      usuario_id?: { nombre?: string; email?: string } | null
    }>

  const proyectoIds = proyectos.map((p) => p._id)
  const tareasAgg = proyectoIds.length > 0
    ? await Tarea.aggregate<{ _id: string; total: number; completadas: number; en_progreso: number; bloqueadas: number; pendientes: number; estados: string[] }>([
        { $match: { proyecto_id: { $in: proyectoIds } } },
        {
          $group: {
            _id: '$proyecto_id',
            total: { $sum: 1 },
            completadas: { $sum: { $cond: [{ $eq: ['$estado', 'Completado'] }, 1, 0] } },
            en_progreso: { $sum: { $cond: [{ $eq: ['$estado', 'En progreso'] }, 1, 0] } },
            bloqueadas: { $sum: { $cond: [{ $eq: ['$estado', 'Bloqueado'] }, 1, 0] } },
            pendientes: { $sum: { $cond: [{ $eq: ['$estado', 'Pendiente'] }, 1, 0] } },
            estados: { $push: '$estado' },
          },
        },
      ])
    : []

  const tareasPorProyecto = new Map(tareasAgg.map((t) => [t._id, t]))

  const porDept = new Map<string, ReporteStatusDepartamento>()

  for (const p of proyectos) {
    const dept = p.departamento_id as { _id?: mongoose.Types.ObjectId; codigo?: string; nombre?: string } | null
    const deptKey = dept?._id ? String(dept._id) : '__sin_depto__'
    const deptNombre = dept?.nombre ?? 'Sin departamento'
    const deptCodigo = dept?.codigo ?? null

    if (!porDept.has(deptKey)) {
      porDept.set(deptKey, {
        departamento_id: dept?._id ? String(dept._id) : null,
        departamento_nombre: deptNombre,
        departamento_codigo: deptCodigo,
        resumen: {
          total_proyectos: 0,
          activos: 0,
          completados: 0,
          bloqueados: 0,
          avance_promedio: 0,
        },
        proyectos: [],
      })
    }

    const ts = tareasPorProyecto.get(p._id)
    const owner = p.usuario_id as { nombre?: string; email?: string } | null
    const riesgosReg = p.riesgos_registro ?? []
    const tareasEstados = (ts?.estados ?? []).map((e) => ({ estado: e }))
    const riesgoAuto = calcularRiesgo(
      {
        estado: p.estado,
        fecha_inicio: p.fecha_inicio,
        fecha_fin: p.fecha_fin,
        porcentaje_avance: p.porcentaje_avance,
      },
      tareasEstados,
    )
    const item: ReporteStatusProyectoItem = {
      proyecto_id: p._id,
      nombre: p.nombre,
      departamento_id: dept?._id ? String(dept._id) : null,
      eje: p.eje ?? null,
      fase: p.fase ?? null,
      estado: p.estado,
      prioridad: p.prioridad,
      porcentaje_avance: p.porcentaje_avance ?? 0,
      responsable: p.responsable ?? null,
      propietario: owner?.nombre ?? owner?.email ?? null,
      fecha_inicio: p.fecha_inicio?.toISOString() ?? null,
      fecha_fin: p.fecha_fin?.toISOString() ?? null,
      meta_kpi: p.meta_kpi ?? null,
      tareas_total: ts?.total ?? 0,
      tareas_completadas: ts?.completadas ?? 0,
      tareas_en_progreso: ts?.en_progreso ?? 0,
      tareas_bloqueadas: ts?.bloqueadas ?? 0,
      tareas_pendientes: ts?.pendientes ?? 0,
      riesgo_auto: riesgoAuto,
      riesgos_registrados: riesgosReg.length,
      riesgos_alto: riesgosReg.filter((r) => r.nivel === 'Alto').length,
    }

    const grupo = porDept.get(deptKey)!
    grupo.proyectos.push(item)
    grupo.resumen.total_proyectos++
    if (p.estado === 'Completado') grupo.resumen.completados++
    else if (p.estado === 'Bloqueado') grupo.resumen.bloqueados++
    else if (['En progreso', 'Aprobado', 'Planificado', 'En revisión'].includes(p.estado)) {
      grupo.resumen.activos++
    }
  }

  const departamentos = [...porDept.values()]
    .map((d) => {
      const avance = d.proyectos.length > 0
        ? Math.round(
            d.proyectos.reduce((s, p) => s + p.porcentaje_avance, 0) / d.proyectos.length,
          )
        : 0
      return {
        ...d,
        resumen: { ...d.resumen, avance_promedio: avance },
      }
    })
    .sort((a, b) => a.departamento_nombre.localeCompare(b.departamento_nombre, 'es'))

  const totalProyectos = proyectos.length
  const resumenGlobal = {
    total_proyectos: totalProyectos,
    total_departamentos: departamentos.length,
    activos: departamentos.reduce((s, d) => s + d.resumen.activos, 0),
    completados: departamentos.reduce((s, d) => s + d.resumen.completados, 0),
    bloqueados: departamentos.reduce((s, d) => s + d.resumen.bloqueados, 0),
    avance_promedio: totalProyectos > 0
      ? Math.round(
          proyectos.reduce((s, p) => s + (p.porcentaje_avance ?? 0), 0) / totalProyectos,
        )
      : 0,
    riesgos_registrados: departamentos.reduce(
      (s, d) => s + d.proyectos.reduce((ss, p) => ss + p.riesgos_registrados, 0),
      0,
    ),
    riesgos_alto: departamentos.reduce(
      (s, d) => s + d.proyectos.reduce((ss, p) => ss + p.riesgos_alto, 0),
      0,
    ),
  }

  const deptIdsVisibles = [...new Set(
    proyectos
      .map((p) => {
        const d = p.departamento_id as { _id?: mongoose.Types.ObjectId } | null
        return d?._id ? String(d._id) : null
      })
      .filter(Boolean),
  )]

  let departamentosCatalogo: Array<{ _id: string; nombre: string; codigo?: string }> = []
  if (isAdminProyectos(opts.permisos)) {
    departamentosCatalogo = (await Departamento.find({ activo: { $ne: false } })
      .select('nombre codigo')
      .sort({ nombre: 1 })
      .lean()).map((d) => ({
        _id: String(d._id),
        nombre: d.nombre ?? '',
        codigo: d.codigo,
      }))
  } else if (deptIdsVisibles.length > 0) {
    departamentosCatalogo = (await Departamento.find({ _id: { $in: deptIdsVisibles } })
      .select('nombre codigo')
      .sort({ nombre: 1 })
      .lean()).map((d) => ({
        _id: String(d._id),
        nombre: d.nombre ?? '',
        codigo: d.codigo,
      }))
  }

  return {
    generado_en: new Date().toISOString(),
    alcance,
    departamento_id: alcance === 'departamento' ? opts.departamento_id ?? null : null,
    proyecto_id: opts.proyecto_id ?? null,
    resumen: resumenGlobal,
    departamentos,
    departamentos_disponibles: departamentosCatalogo,
  }
}
