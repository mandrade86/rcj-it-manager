import {
  addWeeks,
  differenceInCalendarDays,
  format,
  startOfWeek,
  subWeeks,
} from 'date-fns'
import { es } from 'date-fns/locale'

import { calcularRiesgo } from './proyectoRiesgo.js'
import { PROYECTO_ESTADOS_ACTIVOS } from './proyectoScope.js'

const ACTIVOS = new Set<string>(PROYECTO_ESTADOS_ACTIVOS)
const CERRADOS = new Set(['Completado', 'Cancelado'])

export type PortfolioProyecto = {
  _id: string
  nombre: string
  eje?: string | null
  fase?: number | null
  estado: string
  prioridad?: string | null
  porcentaje_avance?: number | null
  responsable?: string | null
  fecha_inicio?: Date | string | null
  fecha_fin?: Date | string | null
  presupuesto_planificado?: number | null
  presupuesto_asignado?: number | null
  presupuesto_ejecutado?: number | null
  moneda_presupuesto?: string | null
  createdAt?: Date | string | null
  riesgos_registro?: Array<{ nivel?: string | null }>
}

export type PortfolioTarea = {
  _id?: unknown
  nombre?: string | null
  proyecto_id: string
  estado: string
  prioridad?: string | null
  porcentaje?: number | null
  fecha_fin?: Date | string | null
  responsable?: string | null
  responsable_id?: unknown
  createdAt?: Date | string | null
  updatedAt?: Date | string | null
}

export type EmpleadoCargaInfo = {
  _id: string
  nombre: string
  departamento: string
  departamento_id: string | null
}

export type CargaTrabajoRow = {
  id: string
  nombre: string
  extra: string
  pendientes: number
  en_progreso: number
  bloqueadas: number
  vencidas: number
  completadas: number
  abiertas: number
}

export type TareaCargaDetalle = {
  _id: string
  nombre: string
  proyecto_id: string
  proyecto_nombre: string
  estado: string
  fecha_fin: string | null
  persona_id: string
  persona: string
  equipo_id: string
  equipo: string
  vencida: boolean
}

function toDate(raw: Date | string | null | undefined): Date | null {
  if (raw == null || raw === '') return null
  const d = raw instanceof Date ? raw : new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function num(v: number | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function tiempoTranscurridoPct(
  inicio: Date | null,
  fin: Date | null,
  hoy: Date,
): number | null {
  if (!inicio || !fin) return null
  const dur = Math.max(1, differenceInCalendarDays(fin, inicio))
  const trans = differenceInCalendarDays(hoy, inicio)
  return Math.round(clamp((trans / dur) * 100, 0, 140))
}

function weekKey(d: Date): string {
  return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

function weekLabel(d: Date): string {
  return format(startOfWeek(d, { weekStartsOn: 1 }), "d MMM", { locale: es })
}

function emptyCarga(id: string, nombre: string, extra: string): CargaTrabajoRow {
  return {
    id,
    nombre,
    extra,
    pendientes: 0,
    en_progreso: 0,
    bloqueadas: 0,
    vencidas: 0,
    completadas: 0,
    abiertas: 0,
  }
}

function sortCarga(a: CargaTrabajoRow, b: CargaTrabajoRow) {
  if (b.vencidas !== a.vencidas) return b.vencidas - a.vencidas
  if (b.abiertas !== a.abiertas) return b.abiertas - a.abiertas
  return a.nombre.localeCompare(b.nombre, 'es')
}

function resolveAsignacion(
  t: PortfolioTarea,
  byId: Map<string, EmpleadoCargaInfo>,
  byName: Map<string, EmpleadoCargaInfo>,
): { personaId: string; persona: string; equipoId: string; equipo: string } {
  const rid = t.responsable_id ? String(t.responsable_id) : ''
  const emp = (rid && byId.get(rid)) || (t.responsable ? byName.get(t.responsable.trim().toLowerCase()) : undefined)
  if (emp) {
    const equipo = emp.departamento || 'Sin equipo'
    return {
      personaId: emp._id,
      persona: emp.nombre,
      equipoId: emp.departamento_id || `eq:${equipo}`,
      equipo,
    }
  }
  const nombre = (t.responsable || '').trim()
  if (nombre) {
    return {
      personaId: `nom:${nombre.toLowerCase()}`,
      persona: nombre,
      equipoId: 'sin-equipo',
      equipo: 'Sin equipo',
    }
  }
  return {
    personaId: 'sin-asignar',
    persona: 'Sin asignar',
    equipoId: 'sin-asignar',
    equipo: 'Sin asignar',
  }
}

export function buildCargaTrabajo(
  proyectos: PortfolioProyecto[],
  tareas: PortfolioTarea[],
  empleados: EmpleadoCargaInfo[],
  hoy: Date,
): {
  por_persona: CargaTrabajoRow[]
  por_equipo: CargaTrabajoRow[]
  detalle: TareaCargaDetalle[]
} {
  const byId = new Map(empleados.map((e) => [e._id, e]))
  const byName = new Map(empleados.map((e) => [e.nombre.trim().toLowerCase(), e]))
  const proyectoNombre = new Map(proyectos.map((p) => [String(p._id), p.nombre]))
  const personas = new Map<string, CargaTrabajoRow>()
  const equipos = new Map<string, CargaTrabajoRow>()
  const detalle: TareaCargaDetalle[] = []
  const startDay = new Date(hoy)
  startDay.setHours(0, 0, 0, 0)

  const bump = (row: CargaTrabajoRow, estado: string, vencida: boolean) => {
    if (estado === 'Completado') {
      row.completadas += 1
      return
    }
    row.abiertas += 1
    if (estado === 'En progreso') row.en_progreso += 1
    else if (estado === 'Bloqueado') row.bloqueadas += 1
    else row.pendientes += 1
    if (vencida) row.vencidas += 1
  }

  for (const t of tareas) {
    const asg = resolveAsignacion(t, byId, byName)
    const fin = toDate(t.fecha_fin)
    const vencida = t.estado !== 'Completado' && !!fin && fin < startDay
    const persona = personas.get(asg.personaId) ?? emptyCarga(asg.personaId, asg.persona, asg.equipo)
    bump(persona, t.estado, vencida)
    personas.set(asg.personaId, persona)
    const equipo = equipos.get(asg.equipoId) ?? emptyCarga(asg.equipoId, asg.equipo, '')
    bump(equipo, t.estado, vencida)
    equipos.set(asg.equipoId, equipo)

    if (t.estado !== 'Completado') {
      detalle.push({
        _id: String(t._id ?? ''),
        nombre: t.nombre || 'Tarea',
        proyecto_id: String(t.proyecto_id),
        proyecto_nombre: proyectoNombre.get(String(t.proyecto_id)) ?? String(t.proyecto_id),
        estado: t.estado,
        fecha_fin: fin ? fin.toISOString() : null,
        persona_id: asg.personaId,
        persona: asg.persona,
        equipo_id: asg.equipoId,
        equipo: asg.equipo,
        vencida,
      })
    }
  }

  detalle.sort((a, b) => {
    if (a.vencida !== b.vencida) return a.vencida ? -1 : 1
    if (a.estado === 'Bloqueado' && b.estado !== 'Bloqueado') return -1
    if (b.estado === 'Bloqueado' && a.estado !== 'Bloqueado') return 1
    const fa = a.fecha_fin ? new Date(a.fecha_fin).getTime() : Number.POSITIVE_INFINITY
    const fb = b.fecha_fin ? new Date(b.fecha_fin).getTime() : Number.POSITIVE_INFINITY
    return fa - fb
  })

  return {
    por_persona: [...personas.values()].sort(sortCarga),
    por_equipo: [...equipos.values()].sort(sortCarga),
    detalle: detalle.slice(0, 250),
  }
}

export function buildPortfolioSnapshot(
  proyectos: PortfolioProyecto[],
  tareas: PortfolioTarea[],
  hoy = new Date(),
  empleados: EmpleadoCargaInfo[] = [],
) {
  const tareasPorProyecto = new Map<string, PortfolioTarea[]>()
  for (const t of tareas) {
    const id = String(t.proyecto_id)
    const list = tareasPorProyecto.get(id)
    if (list) list.push(t)
    else tareasPorProyecto.set(id, [t])
  }

  const porEstadoMap = new Map<string, number>()
  const porPrioridadMap = new Map<string, number>()
  const porEjeMap = new Map<string, { count: number; avance: number }>()

  let planificado = 0
  let asignado = 0
  let ejecutado = 0
  let proyectosConPresupuesto = 0
  let sobrecosto = 0

  let saludEnCurso = 0
  let saludRiesgo = 0
  let saludCritico = 0
  let saludSinFecha = 0
  let bloqueados = 0
  let completados = 0
  let atrasados = 0
  let sumAvanceActivos = 0
  let nActivos = 0
  let sumAvanceEsperado = 0
  let nConCalendario = 0

  const atencion: Array<{
    _id: string
    nombre: string
    estado: string
    prioridad: string
    porcentaje_avance: number
    fecha_fin: string | null
    responsable: string
    nivel: string
    motivo: string
    color: string
    tiempo_pct: number | null
  }> = []

  const timeline: Array<{
    _id: string
    nombre: string
    estado: string
    eje: string
    porcentaje_avance: number
    fecha_inicio: string | null
    fecha_fin: string | null
    color: string
  }> = []

  const schedule: Array<{
    _id: string
    nombre: string
    tiempo: number
    avance: number
    nivel: string
  }> = []

  for (const p of proyectos) {
    const estado = p.estado || 'Planificado'
    porEstadoMap.set(estado, (porEstadoMap.get(estado) ?? 0) + 1)
    const prio = p.prioridad || 'Media'
    porPrioridadMap.set(prio, (porPrioridadMap.get(prio) ?? 0) + 1)
    const eje = (p.eje || '').trim() || 'Sin eje'
    const ejeRow = porEjeMap.get(eje) ?? { count: 0, avance: 0 }
    ejeRow.count += 1
    ejeRow.avance += num(p.porcentaje_avance)
    porEjeMap.set(eje, ejeRow)

    const plan = num(p.presupuesto_planificado)
    const asig = num(p.presupuesto_asignado)
    const ejec = num(p.presupuesto_ejecutado)
    if (plan > 0) {
      proyectosConPresupuesto += 1
      planificado += plan
      if (ejec > plan) sobrecosto += ejec - plan
    }
    asignado += asig
    ejecutado += ejec

    const ts = (tareasPorProyecto.get(String(p._id)) ?? []).map((t) => ({ estado: t.estado }))
    const riesgo = calcularRiesgo(
      {
        estado,
        fecha_inicio: p.fecha_inicio,
        fecha_fin: p.fecha_fin,
        porcentaje_avance: num(p.porcentaje_avance),
        createdAt: p.createdAt,
      },
      ts,
    )

    const fin = toDate(p.fecha_fin)
    const inicio = toDate(p.fecha_inicio) ?? toDate(p.createdAt)
    const tiempo = tiempoTranscurridoPct(inicio, fin, hoy)
    const avance = Math.round(num(p.porcentaje_avance))

    if (estado === 'Completado') completados += 1
    if (estado === 'Bloqueado') bloqueados += 1
    if (!CERRADOS.has(estado) && fin && fin < hoy && avance < 100) atrasados += 1

    if (ACTIVOS.has(estado) || estado === 'Bloqueado' || estado === 'En pausa') {
      nActivos += 1
      sumAvanceActivos += avance
      if (tiempo != null) {
        sumAvanceEsperado += Math.min(100, tiempo)
        nConCalendario += 1
        schedule.push({
          _id: String(p._id),
          nombre: p.nombre,
          tiempo: Math.min(100, tiempo),
          avance,
          nivel: riesgo.nivel,
        })
      }
      timeline.push({
        _id: String(p._id),
        nombre: p.nombre,
        estado,
        eje,
        porcentaje_avance: avance,
        fecha_inicio: inicio ? inicio.toISOString() : null,
        fecha_fin: fin ? fin.toISOString() : null,
        color: riesgo.color,
      })

      if (riesgo.nivel === 'Alto') saludCritico += 1
      else if (riesgo.nivel === 'Medio') saludRiesgo += 1
      else if (riesgo.nivel === 'Sin fecha') saludSinFecha += 1
      else saludEnCurso += 1

      if (riesgo.nivel === 'Alto' || riesgo.nivel === 'Medio') {
        atencion.push({
          _id: String(p._id),
          nombre: p.nombre,
          estado,
          prioridad: prio,
          porcentaje_avance: avance,
          fecha_fin: fin ? fin.toISOString() : null,
          responsable: p.responsable ?? '',
          nivel: riesgo.nivel,
          motivo: riesgo.motivo,
          color: riesgo.color,
          tiempo_pct: tiempo,
        })
      }
    }
  }

  atencion.sort((a, b) => {
    if (a.nivel !== b.nivel) return a.nivel === 'Alto' ? -1 : 1
    return a.porcentaje_avance - b.porcentaje_avance
  })

  timeline.sort((a, b) => {
    const fa = a.fecha_fin ? new Date(a.fecha_fin).getTime() : Number.POSITIVE_INFINITY
    const fb = b.fecha_fin ? new Date(b.fecha_fin).getTime() : Number.POSITIVE_INFINITY
    return fa - fb
  })

  let tPend = 0
  let tProg = 0
  let tDone = 0
  let tBlock = 0
  let tVenc = 0
  const startDay = new Date(hoy)
  startDay.setHours(0, 0, 0, 0)

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = startOfWeek(subWeeks(hoy, 7 - i), { weekStartsOn: 1 })
    return { key: weekKey(start), label: weekLabel(start), creadas: 0, completadas: 0 }
  })
  const weekIndex = new Map(weeks.map((w, i) => [w.key, i]))
  const windowStart = startOfWeek(subWeeks(hoy, 7), { weekStartsOn: 1 })

  for (const t of tareas) {
    if (t.estado === 'Completado') tDone += 1
    else if (t.estado === 'En progreso') tProg += 1
    else if (t.estado === 'Bloqueado') tBlock += 1
    else tPend += 1

    const fin = toDate(t.fecha_fin)
    if (t.estado !== 'Completado' && fin && fin < startDay) tVenc += 1

    const created = toDate(t.createdAt)
    if (created && created >= windowStart) {
      const idx = weekIndex.get(weekKey(created))
      if (idx != null) weeks[idx].creadas += 1
    }
    if (t.estado === 'Completado') {
      const doneAt = toDate(t.updatedAt) ?? toDate(t.createdAt)
      if (doneAt && doneAt >= windowStart) {
        const idx = weekIndex.get(weekKey(doneAt))
        if (idx != null) weeks[idx].completadas += 1
      }
    }
  }

  const estaSemana = weeks[weeks.length - 1]?.completadas ?? 0
  const semanaAnterior = weeks[weeks.length - 2]?.completadas ?? 0

  const avancePromedio = nActivos > 0 ? Math.round(sumAvanceActivos / nActivos) : 0
  const avanceEsperado =
    nConCalendario > 0 ? Math.round(sumAvanceEsperado / nConCalendario) : null
  const saludDenominador = saludEnCurso + saludRiesgo + saludCritico + saludSinFecha
  const saludPct =
    saludDenominador > 0 ? Math.round((saludEnCurso / saludDenominador) * 100) : 0
  const burnPct = planificado > 0 ? Math.round((ejecutado / planificado) * 100) : null
  const asignadoPct = planificado > 0 ? Math.round((asignado / planificado) * 100) : null

  const insights: string[] = []
  const enAlerta = saludRiesgo + saludCritico
  if (saludDenominador > 0) {
    insights.push(
      enAlerta === 0
        ? `Los ${saludDenominador} proyectos en marcha están dentro de lo esperado.`
        : `${enAlerta} de ${saludDenominador} proyectos en marcha requieren atención (${saludCritico} críticos).`,
    )
  }
  if (tVenc > 0) {
    insights.push(
      `${tVenc} tarea${tVenc === 1 ? '' : 's'} vencida${tVenc === 1 ? '' : 's'} frente a ${nActivos} proyecto${nActivos === 1 ? '' : 's'} activo${nActivos === 1 ? '' : 's'}: hay cuello de botella de ejecución.`,
    )
  }
  const carga = buildCargaTrabajo(proyectos, tareas, empleados, hoy)
  const topPersona = carga.por_persona.find((p) => p.id !== 'sin-asignar')
  if (topPersona && topPersona.vencidas >= 3) {
    insights.push(
      `${topPersona.nombre} concentra ${topPersona.vencidas} tareas vencidas: revisa redistribución o bloqueos.`,
    )
  }
  const sinAsignar = carga.por_persona.find((p) => p.id === 'sin-asignar')
  if (sinAsignar && sinAsignar.abiertas >= 5) {
    insights.push(`${sinAsignar.abiertas} tareas abiertas no tienen responsable asignado.`)
  }
  if (burnPct != null && avanceEsperado != null) {
    const gap = burnPct - avancePromedio
    if (Math.abs(gap) >= 15) {
      insights.push(
        gap > 0
          ? `El gasto va ${gap} pts por delante del avance (${burnPct}% ejecutado vs ${avancePromedio}% de progreso).`
          : `El avance (${avancePromedio}%) va por delante del gasto (${burnPct}% ejecutado).`,
      )
    }
  }
  if (avanceEsperado != null) {
    const calGap = avancePromedio - avanceEsperado
    if (calGap <= -10) {
      insights.push(
        `El portafolio va ${Math.abs(calGap)} pts detrás del calendario (avance ${avancePromedio}% vs esperado ${avanceEsperado}%).`,
      )
    } else if (calGap >= 10) {
      insights.push(
        `El portafolio adelanta el calendario por ${calGap} pts (avance ${avancePromedio}% vs esperado ${avanceEsperado}%).`,
      )
    }
  }
  if (insights.length === 0) {
    insights.push('Aún no hay suficiente historial de fechas o presupuesto para un diagnóstico automático.')
  }

  const ESTADOS_ORDEN = [
    'Idea',
    'Planificado',
    'En revisión',
    'Aprobado',
    'En progreso',
    'Bloqueado',
    'En pausa',
    'Completado',
    'Cancelado',
  ]

  return {
    salud: {
      pct_en_curso: saludPct,
      en_curso: saludEnCurso,
      en_riesgo: saludRiesgo,
      critico: saludCritico,
      sin_fecha: saludSinFecha,
      bloqueados,
      atrasados,
      completados,
      activos: nActivos,
    },
    avance_promedio: avancePromedio,
    avance_esperado: avanceEsperado,
    presupuesto: {
      planificado: Math.round(planificado * 100) / 100,
      asignado: Math.round(asignado * 100) / 100,
      ejecutado: Math.round(ejecutado * 100) / 100,
      sobrecosto: Math.round(sobrecosto * 100) / 100,
      proyectos_con_presupuesto: proyectosConPresupuesto,
      burn_pct: burnPct,
      asignado_pct: asignadoPct,
    },
    por_estado: ESTADOS_ORDEN.filter((e) => (porEstadoMap.get(e) ?? 0) > 0).map((estado) => ({
      estado,
      count: porEstadoMap.get(estado) ?? 0,
    })),
    por_prioridad: (['Alta', 'Media', 'Baja'] as const)
      .filter((p) => (porPrioridadMap.get(p) ?? 0) > 0)
      .map((prioridad) => ({ prioridad, count: porPrioridadMap.get(prioridad) ?? 0 })),
    por_eje: [...porEjeMap.entries()]
      .map(([eje, v]) => ({
        eje,
        count: v.count,
        avance: v.count > 0 ? Math.round(v.avance / v.count) : 0,
      }))
      .sort((a, b) => b.count - a.count),
    tareas: {
      total: tareas.length,
      pendientes: tPend,
      en_progreso: tProg,
      completadas: tDone,
      bloqueadas: tBlock,
      vencidas: tVenc,
      pct_completadas: tareas.length > 0 ? Math.round((tDone / tareas.length) * 100) : 0,
      esta_semana: estaSemana,
      semana_anterior: semanaAnterior,
      throughput: weeks,
    },
    schedule,
    timeline: timeline.slice(0, 18),
    atencion: atencion.slice(0, 12),
    insights: insights.slice(0, 3),
    carga,
    ventana_gantt: {
      inicio: subWeeks(hoy, 4).toISOString(),
      fin: addWeeks(hoy, 8).toISOString(),
    },
  }
}

export type PortfolioSnapshot = ReturnType<typeof buildPortfolioSnapshot>
