/**
 * Uso: npx tsx server/scripts/resumenDeptIT.ts
 */
import { connectDb, disconnectDb } from '../db/connection.js'
import { Departamento } from '../db/models/Departamento.js'
import { KPI } from '../db/models/KPI.js'
import { Proyecto } from '../db/models/Proyecto.js'
import { Tarea } from '../db/models/Tarea.js'
import { Colaborador } from '../db/models/Colaborador.js'
import { kpiPromedioGlobal, ultimoRegistro, calcPct, type KpiLean } from '../utils/kpiPct.js'
import { PROYECTO_ESTADOS_ACTIVOS } from '../utils/proyectoScope.js'

async function main() {
  await connectDb()

  const dept =
    (await Departamento.findOne({ codigo: 'IT' }).lean()) ??
    (await Departamento.findOne({ ehr_departamento_id: 8 }).lean()) ??
    (await Departamento.findOne({ nombre: /informática|tecnolog/i }).lean())

  if (!dept) {
    console.log(JSON.stringify({ error: 'Departamento IT no encontrado' }, null, 2))
    return
  }

  const deptId = dept._id

  const metas = (dept.metas_estrategicas ?? []).filter((m) => m.activa !== false)
  const kpis = (await KPI.find({ departamento_id: deptId }).lean()) as KpiLean[]

  const metasConAvance = metas.map((m) => {
    const kpisMeta = kpis.filter((k) => k.meta_id === m.id)
    const pcts = kpisMeta
      .map((k) => {
        const reg = ultimoRegistro(k)
        if (!reg || reg.valor == null) return null
        try {
          return calcPct(k, reg.valor)
        } catch {
          return null
        }
      })
      .filter((p): p is number => p != null)
    const avance =
      pcts.length === 0
        ? null
        : m.tipo_calculo === 'minimo_kpis'
          ? Math.min(...pcts)
          : m.tipo_calculo === 'maximo_kpis'
            ? Math.max(...pcts)
            : Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
    return {
      id: m.id,
      titulo: m.titulo,
      objetivo: m.objetivo,
      valor_objetivo: m.valor_objetivo,
      tipo_calculo: m.tipo_calculo,
      kpi_count: kpisMeta.length,
      avance_pct: avance,
      kpis: kpisMeta.map((k) => ({
        nombre: k.nombre,
        eje: k.eje,
        meta: k.meta,
        ultimo: ultimoRegistro(k),
        pct: (() => {
          const reg = ultimoRegistro(k)
          if (!reg || reg.valor == null) return null
          try {
            return calcPct(k, reg.valor)
          } catch {
            return null
          }
        })(),
      })),
    }
  })

  const proyectos = await Proyecto.find({ departamento_id: deptId })
    .sort({ fase: 1, prioridad: 1 })
    .lean()
  const proyectosSinDept = await Proyecto.find({
    $or: [{ departamento_id: null }, { departamento_id: { $exists: false } }],
  })
    .sort({ fase: 1 })
    .lean()

  const allProyectos = [...proyectos, ...proyectosSinDept]
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

  const equipo = await Colaborador.find({ departamento_id: deptId })
    .select('nombre codigo puesto estado nivel')
    .lean()

  const porFase = [1, 2, 3].map((f) => {
    const list = allProyectos.filter((p) => p.fase === f)
    const avg =
      list.length > 0
        ? Math.round(list.reduce((s, p) => s + (p.porcentaje_avance ?? 0), 0) / list.length)
        : 0
    return { fase: f, count: list.length, avance_promedio: avg }
  })

  console.log(
    JSON.stringify(
      {
        departamento: {
          _id: String(deptId),
          codigo: dept.codigo,
          nombre: dept.nombre,
        },
        metas_estrategicas: metasConAvance,
        kpi_promedio_global: kpis.length ? kpiPromedioGlobal(kpis) : null,
        plan_trabajo: {
          proyectos_total: allProyectos.length,
          proyectos_activos: allProyectos.filter((p) =>
            PROYECTO_ESTADOS_ACTIVOS.includes(p.estado as (typeof PROYECTO_ESTADOS_ACTIVOS)[number]),
          ).length,
          tareas_vencidas: tareasVencidas,
          por_fase: porFase,
          proyectos: allProyectos.map((p) => ({
            _id: p._id,
            nombre: p.nombre,
            eje: p.eje,
            fase: p.fase,
            estado: p.estado,
            prioridad: p.prioridad,
            avance: p.porcentaje_avance,
            responsable: p.responsable,
            fecha_inicio: p.fecha_inicio,
            fecha_fin: p.fecha_fin,
            meta_kpi: p.meta_kpi,
          })),
        },
        equipo: {
          total: equipo.length,
          activos: equipo.filter((c) => c.estado === 'Activo').length,
          miembros: equipo,
        },
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => disconnectDb())
