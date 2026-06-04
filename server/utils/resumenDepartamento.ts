import mongoose from 'mongoose'

import { Departamento } from '../db/models/Departamento.js'
import { KPI } from '../db/models/KPI.js'
import { Proyecto } from '../db/models/Proyecto.js'
import type { ProyectoAvanceLean } from './kpiPct.js'
import { Tarea } from '../db/models/Tarea.js'
import { Colaborador } from '../db/models/Colaborador.js'
import type { MetaDeptoDoc } from './metasDepartamento.js'
import { kpiPromedioGlobal, pctCumplimientoKpi, ultimoRegistro, type KpiLean } from './kpiPct.js'
import { combinarAvanceMeta, metaIdDesdeEjeProyecto } from './metaDesdeProyecto.js'
import { PROYECTO_ESTADOS_ACTIVOS } from './proyectoScope.js'

export type ResumenDepartamentoDto = {
  departamento: {
    _id: string
    codigo: string
    nombre: string
    color?: string
  }
  metas: {
    id: string
    titulo: string
    objetivo: string
    valor_objetivo: string
    kpi_count: number
    avance_pct: number
    kpis: {
      _id: string
      nombre: string
      eje: string
      meta: string | null
      unidad: string | null
      avance_pct: number
      tiene_registro: boolean
    }[]
  }[]
  kpi_promedio_pct: number
  plan_trabajo: {
    proyectos_total: number
    proyectos_activos: number
    tareas_vencidas: number
    avance_por_fase: { fase: number; count: number; pct: number }[]
    proyectos: {
      _id: string
      nombre: string
      eje: string
      fase: number | null
      estado: string
      prioridad: string
      avance: number
      responsable: string | null
      fecha_inicio: string | null
      fecha_fin: string | null
      meta_kpi: string | null
    }[]
  }
  equipo: { total: number; activos: number }
  lectura_rapida: string
}

function pctMetaEstrategica(
  kpis: KpiLean[],
  meta: MetaDeptoDoc,
  extraPorKpiId: Map<string, ProyectoAvanceLean[]>,
): number {
  const subset = kpis.filter((k) => String((k as { meta_id?: string }).meta_id ?? '') === meta.id)
  if (!subset.length) return 0
  const pcts = subset.map((k) =>
    pctCumplimientoKpi(k, extraPorKpiId.get(String(k._id)) ?? []),
  )
  if (meta.tipo_calculo === 'min_kpis') return Math.min(...pcts)
  if (meta.tipo_calculo === 'max_kpis') return Math.max(...pcts)
  return Math.round(pcts.reduce((a, n) => a + n, 0) / pcts.length)
}

function buildLecturaRapida(input: {
  metas: ResumenDepartamentoDto['metas']
  plan: ResumenDepartamentoDto['plan_trabajo']
}): string {
  const { metas, plan } = input
  const sinMedicion = metas.filter((m) => m.kpi_count > 0 && m.avance_pct === 0).length
  const fase1 = plan.avance_por_fase.find((f) => f.fase === 1)

  if (metas.length === 0) {
    return 'Configure las metas estratégicas del departamento en Objetivos estratégicos.'
  }
  if (sinMedicion === metas.length && plan.proyectos_total > 0) {
    return `Portafolio con ${plan.proyectos_activos} proyectos activos; registre valores de KPI para medir las ${metas.length} metas del año.`
  }
  if (plan.tareas_vencidas > 0) {
    return `Hay ${plan.tareas_vencidas} tarea(s) vencida(s). Fase 1 al ${fase1?.pct ?? 0} % de avance promedio.`
  }
  const mejor = [...metas].sort((a, b) => b.avance_pct - a.avance_pct)[0]
  if (mejor && mejor.avance_pct > 0) {
    return `Meta con mayor avance: ${mejor.titulo} (${mejor.avance_pct} %). ${plan.proyectos_activos} proyectos activos en el plan.`
  }
  return `${plan.proyectos_activos} proyectos activos · Fase 1: ${fase1?.count ?? 0} proyectos (${fase1?.pct ?? 0} % avance prom.).`
}

async function resolveItDepartamentoId(): Promise<mongoose.Types.ObjectId | null> {
  const it =
    (await Departamento.findOne({ codigo: 'DEP-8' }).select('_id').lean()) ??
    (await Departamento.findOne({ ehr_departamento_id: 8 }).select('_id').lean()) ??
    (await Departamento.findOne({ codigo: 'IT' }).select('_id').lean()) ??
    (await Departamento.findOne({ nombre: /^IT$/i }).select('_id').lean())
  return it?._id ? (it._id as mongoose.Types.ObjectId) : null
}

/** Resuelve departamento por id explícito; si no existe o es inválido, usa IT (DEP-8). */
export async function resolveDepartamentoId(
  preferId?: string | null,
): Promise<mongoose.Types.ObjectId | null> {
  if (preferId && mongoose.isValidObjectId(preferId)) {
    const oid = new mongoose.Types.ObjectId(preferId)
    const exists = await Departamento.exists({ _id: oid })
    if (exists) return oid
  }
  return resolveItDepartamentoId()
}

export async function buildResumenDepartamento(
  departamentoId: mongoose.Types.ObjectId,
): Promise<ResumenDepartamentoDto | null> {
  const dept = await Departamento.findById(departamentoId).lean()
  if (!dept) return null

  const metasCfg = ((dept.metas_estrategicas ?? []) as MetaDeptoDoc[]).filter((m) => m.activa !== false)

  const kpis = (await KPI.find({ departamento_id: departamentoId })
    .populate({ path: 'proyecto_ids', select: 'porcentaje_avance estado' })
    .lean()) as (KpiLean & {
    meta_id?: string
    _id: unknown
    nombre?: string
    eje?: string
    unidad?: string
    tipo_calculo?: string
  })[]

  const proyConKpi = await Proyecto.find({
    departamento_id: departamentoId,
    kpi_id: { $ne: null },
  })
    .select('kpi_id porcentaje_avance estado')
    .lean()

  const extraPorKpiId = new Map<string, ProyectoAvanceLean[]>()
  for (const p of proyConKpi) {
    if (!p.kpi_id) continue
    const kid = String(p.kpi_id)
    const list = extraPorKpiId.get(kid) ?? []
    list.push({
      porcentaje_avance: p.porcentaje_avance,
      estado: p.estado,
    })
    extraPorKpiId.set(kid, list)
  }

  const proyectosDept = await Proyecto.find({ departamento_id: departamentoId })
    .sort({ fase: 1, prioridad: 1, nombre: 1 })
    .lean()
  const proyectosLegacy = await Proyecto.find({
    $or: [{ departamento_id: null }, { departamento_id: { $exists: false } }],
  })
    .sort({ fase: 1, nombre: 1 })
    .lean()
  const allProyectos = [...proyectosDept, ...proyectosLegacy]

  function avancePlanPorMeta(metaId: string): number {
    const matched = allProyectos.filter((p) => metaIdDesdeEjeProyecto(p.eje) === metaId)
    if (!matched.length) return 0
    const pcts = matched.map((p) => {
      if (p.estado === 'Completado') return 100
      const v = p.porcentaje_avance ?? 0
      return Math.max(0, Math.min(100, Math.round(v)))
    })
    return Math.round(pcts.reduce((a, n) => a + n, 0) / pcts.length)
  }

  const metas = metasCfg.map((m) => {
    const kpisMeta = kpis.filter((k) => String(k.meta_id ?? '') === m.id)
    const kpiPct = pctMetaEstrategica(kpis, m, extraPorKpiId)
    const planPct = avancePlanPorMeta(m.id)
    return {
      id: m.id,
      titulo: m.titulo || m.id,
      objetivo: m.objetivo,
      valor_objetivo: m.valor_objetivo,
      kpi_count: kpisMeta.length,
      avance_pct: combinarAvanceMeta(kpiPct, planPct),
      kpis: kpisMeta.map((k) => {
        const kid = String(k._id)
        const reg = ultimoRegistro(k)
        const avance = pctCumplimientoKpi(k, extraPorKpiId.get(kid) ?? [])
        return {
          _id: String(k._id),
          nombre: k.nombre ?? '—',
          eje: k.eje ?? '',
          meta: k.meta ?? null,
          unidad: k.unidad ?? null,
          avance_pct: avance,
          tiene_registro: reg?.valor != null && !Number.isNaN(Number(reg.valor)),
        }
      }),
    }
  })

  const proyectoIds = allProyectos.map((p) => p._id)
  const startDay = new Date()
  startDay.setHours(0, 0, 0, 0)

  const tareasVencidas =
    proyectoIds.length === 0
      ? 0
      : await Tarea.countDocuments({
          proyecto_id: { $in: proyectoIds },
          fecha_fin: { $lt: startDay },
          estado: { $nin: ['Completado'] },
        })

  const avancePorFase = ([1, 2, 3] as const).map((fase) => {
    const list = allProyectos.filter((p) => p.fase === fase)
    const pct =
      list.length > 0
        ? Math.round(list.reduce((s, p) => s + (p.porcentaje_avance ?? 0), 0) / list.length)
        : 0
    return { fase, count: list.length, pct }
  })

  const activos = allProyectos.filter((p) =>
    PROYECTO_ESTADOS_ACTIVOS.includes(p.estado as (typeof PROYECTO_ESTADOS_ACTIVOS)[number]),
  ).length

  const equipoTotal = await Colaborador.countDocuments({ departamento_id: departamentoId })
  const equipoActivos = await Colaborador.countDocuments({
    departamento_id: departamentoId,
    estado: 'Activo',
  })

  const plan_trabajo = {
    proyectos_total: allProyectos.length,
    proyectos_activos: activos,
    tareas_vencidas: tareasVencidas,
    avance_por_fase: avancePorFase,
    proyectos: allProyectos.map((p) => ({
      _id: String(p._id),
      nombre: p.nombre,
      eje: p.eje ?? '',
      fase: p.fase ?? null,
      estado: p.estado ?? 'Planificado',
      prioridad: p.prioridad ?? 'Media',
      avance: p.porcentaje_avance ?? 0,
      responsable: p.responsable ?? null,
      fecha_inicio: p.fecha_inicio ? new Date(p.fecha_inicio).toISOString() : null,
      fecha_fin: p.fecha_fin ? new Date(p.fecha_fin).toISOString() : null,
      meta_kpi: p.meta_kpi ?? null,
    })),
  }

  const dto: ResumenDepartamentoDto = {
    departamento: {
      _id: String(dept._id),
      codigo: dept.codigo ?? '',
      nombre: dept.nombre ?? '',
      color: dept.color ?? '#002060',
    },
    metas,
    kpi_promedio_pct: kpis.length ? kpiPromedioGlobal(kpis, extraPorKpiId) : 0,
    plan_trabajo,
    equipo: { total: equipoTotal, activos: equipoActivos },
    lectura_rapida: '',
  }
  dto.lectura_rapida = buildLecturaRapida({ metas: dto.metas, plan: dto.plan_trabajo })
  return dto
}
