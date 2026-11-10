import mongoose from 'mongoose'

import { Proyecto } from '../db/models/Proyecto.js'
import { Tarea } from '../db/models/Tarea.js'
import { calcularRiesgo } from './proyectoRiesgo.js'
import {
  buildProyectoScopeFilter,
  PROYECTO_ESTADOS_ACTIVOS,
} from './proyectoScope.js'
import { appPublicUrl } from './mailer.js'

export type PmoProyectoResumen = {
  _id: string
  nombre: string
  estado: string
  prioridad?: string | null
  porcentaje_avance: number
  fecha_fin: string | null
  riesgo: 'Alto' | 'Medio' | 'Bajo' | 'Sin fecha'
  motivo_riesgo: string
  href: string
}

export type PmoTareaResumen = {
  _id: string
  nombre: string
  proyecto_id: string
  proyecto_nombre: string
  estado: string
  fecha_fin: string | null
  vencida: boolean
  href: string
}

export type PmoBriefingPersonal = {
  generado_en: string
  usuario: { _id: string; nombre: string }
  proyectos_activos: number
  proyectos: PmoProyectoResumen[]
  tareas_vencidas: PmoTareaResumen[]
  tareas_por_vencer: PmoTareaResumen[]
  riesgos_altos: PmoProyectoResumen[]
  texto: string
}

export type PmoBriefingPortafolio = {
  generado_en: string
  filtro_departamento_id: string | null
  totales: {
    proyectos: number
    activos: number
    completados: number
    bloqueados: number
    tareas_vencidas: number
    riesgos_altos: number
  }
  por_estado: Array<{ estado: string; cantidad: number }>
  por_eje: Array<{ eje: string; cantidad: number }>
  top_atrasados: PmoProyectoResumen[]
  riesgos_altos: PmoProyectoResumen[]
  texto: string
}

export type PmoProyectoDetalle = {
  proyecto: PmoProyectoResumen & {
    eje?: string | null
    responsable?: string | null
    fecha_inicio: string | null
  }
  tareas_abiertas: PmoTareaResumen[]
  texto: string
}

type AuthCtx = { _id: string; nombre: string; permisos: string[]; empleado_id?: string | null }

function iso(d?: Date | string | null): string | null {
  if (!d) return null
  const x = d instanceof Date ? d : new Date(d)
  return Number.isNaN(x.getTime()) ? null : x.toISOString()
}

function hrefProyecto(id: string): string {
  return `${appPublicUrl()}/proyectos/${encodeURIComponent(id)}`
}

function startOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

type ProyectoLean = {
  _id: string
  nombre: string
  estado: string
  prioridad?: string | null
  porcentaje_avance?: number | null
  fecha_inicio?: Date | null
  fecha_fin?: Date | null
  eje?: string | null
  responsable?: string | null
  riesgos_registro?: Array<{ nivel?: string | null }>
}

type TareaLean = {
  _id: unknown
  nombre: string
  proyecto_id: string
  estado: string
  fecha_fin?: Date | null
  responsable_id?: unknown
  responsable?: string | null
}

async function cargarProyectosYTareas(
  filter: Record<string, unknown>,
): Promise<{ proyectos: ProyectoLean[]; tareas: TareaLean[]; mapaNombre: Map<string, string> }> {
  const proyectos = (await Proyecto.find(filter)
    .select('nombre estado prioridad porcentaje_avance fecha_inicio fecha_fin eje responsable riesgos_registro')
    .lean()) as unknown as ProyectoLean[]
  const ids = proyectos.map((p) => p._id)
  const mapaNombre = new Map(proyectos.map((p) => [String(p._id), p.nombre]))
  const tareas = ids.length
    ? ((await Tarea.find({ proyecto_id: { $in: ids } })
        .select('nombre proyecto_id estado fecha_fin responsable_id responsable')
        .lean()) as unknown as TareaLean[])
    : []
  return { proyectos, tareas, mapaNombre }
}

function resumirProyecto(p: ProyectoLean, tareas: TareaLean[]): PmoProyectoResumen {
  const delProy = tareas.filter((t) => String(t.proyecto_id) === String(p._id))
  const riesgo = calcularRiesgo(
    {
      estado: p.estado,
      fecha_inicio: p.fecha_inicio,
      fecha_fin: p.fecha_fin,
      porcentaje_avance: p.porcentaje_avance ?? 0,
    },
    delProy.map((t) => ({ estado: t.estado })),
  )
  const manualAlto = (p.riesgos_registro ?? []).some((r) => r.nivel === 'Alto')
  return {
    _id: String(p._id),
    nombre: p.nombre,
    estado: p.estado,
    prioridad: p.prioridad ?? null,
    porcentaje_avance: p.porcentaje_avance ?? 0,
    fecha_fin: iso(p.fecha_fin),
    riesgo: manualAlto ? 'Alto' : riesgo.nivel,
    motivo_riesgo: manualAlto ? 'Riesgo documentado alto' : riesgo.motivo,
    href: hrefProyecto(String(p._id)),
  }
}

function tareaEsMia(t: TareaLean, ctx: AuthCtx): boolean {
  if (ctx.empleado_id && t.responsable_id && String(t.responsable_id) === ctx.empleado_id) return true
  const nom = (ctx.nombre || '').trim()
  if (nom && t.responsable && t.responsable.trim().toLowerCase() === nom.toLowerCase()) return true
  return false
}

function resumirTarea(t: TareaLean, mapaNombre: Map<string, string>, hoy: Date): PmoTareaResumen {
  const fin = t.fecha_fin ? new Date(t.fecha_fin) : null
  const vencida = Boolean(fin && !Number.isNaN(fin.getTime()) && fin < hoy && t.estado !== 'Completado')
  const pid = String(t.proyecto_id)
  return {
    _id: String(t._id),
    nombre: t.nombre,
    proyecto_id: pid,
    proyecto_nombre: mapaNombre.get(pid) ?? pid,
    estado: t.estado,
    fecha_fin: iso(t.fecha_fin),
    vencida,
    href: hrefProyecto(pid),
  }
}

function textoPersonal(b: Omit<PmoBriefingPersonal, 'texto'>): string {
  const lineas = [
    `Hola ${b.usuario.nombre}, soy PMO Personal.`,
    `Tienes ${b.proyectos_activos} proyecto(s) activo(s).`,
    `Tareas vencidas: ${b.tareas_vencidas.length}. Por vencer (7 días): ${b.tareas_por_vencer.length}.`,
    `Proyectos en riesgo alto: ${b.riesgos_altos.length}.`,
  ]
  if (b.tareas_vencidas[0]) {
    lineas.push(`Más urgente: "${b.tareas_vencidas[0].nombre}" (${b.tareas_vencidas[0].proyecto_nombre}).`)
  } else if (b.riesgos_altos[0]) {
    lineas.push(`Atención: "${b.riesgos_altos[0].nombre}" — ${b.riesgos_altos[0].motivo_riesgo}.`)
  }
  return lineas.join('\n')
}

export async function buildBriefingPersonal(ctx: AuthCtx): Promise<PmoBriefingPersonal> {
  const scope = await buildProyectoScopeFilter(ctx._id, ctx.permisos)
  const { proyectos, tareas, mapaNombre } = await cargarProyectosYTareas(scope)
  const hoy = startOfDay()
  const en7 = addDays(hoy, 7)
  const activosSet = new Set<string>(PROYECTO_ESTADOS_ACTIVOS)

  const resumenes = proyectos.map((p) => resumirProyecto(p, tareas))
  const proyectosActivos = resumenes.filter((p) => activosSet.has(p.estado) || p.estado === 'Bloqueado' || p.estado === 'En pausa')
  const riesgosAltos = resumenes.filter((p) => p.riesgo === 'Alto' && p.estado !== 'Completado' && p.estado !== 'Cancelado')

  const mias = tareas.filter((t) => tareaEsMia(t, ctx) && t.estado !== 'Completado')
  const vencidas: PmoTareaResumen[] = []
  const porVencer: PmoTareaResumen[] = []
  for (const t of mias) {
    const r = resumirTarea(t, mapaNombre, hoy)
    const fin = t.fecha_fin ? new Date(t.fecha_fin) : null
    if (!fin || Number.isNaN(fin.getTime())) continue
    if (fin < hoy) vencidas.push(r)
    else if (fin <= en7) porVencer.push(r)
  }
  vencidas.sort((a, b) => String(a.fecha_fin).localeCompare(String(b.fecha_fin)))
  porVencer.sort((a, b) => String(a.fecha_fin).localeCompare(String(b.fecha_fin)))

  const base: Omit<PmoBriefingPersonal, 'texto'> = {
    generado_en: new Date().toISOString(),
    usuario: { _id: ctx._id, nombre: ctx.nombre },
    proyectos_activos: proyectosActivos.length,
    proyectos: proyectosActivos.slice(0, 20),
    tareas_vencidas: vencidas.slice(0, 15),
    tareas_por_vencer: porVencer.slice(0, 15),
    riesgos_altos: riesgosAltos.slice(0, 10),
  }
  return { ...base, texto: textoPersonal(base) }
}

export async function buildBriefingPortafolio(
  ctx: AuthCtx,
  departamentoId?: string | null,
): Promise<PmoBriefingPortafolio> {
  let filter: Record<string, unknown> = await buildProyectoScopeFilter(ctx._id, ctx.permisos)
  if (departamentoId && mongoose.isValidObjectId(departamentoId)) {
    const dept = { departamento_id: new mongoose.Types.ObjectId(departamentoId) }
    filter = Object.keys(filter).length === 0 ? dept : { $and: [filter, dept] }
  }

  const { proyectos, tareas, mapaNombre } = await cargarProyectosYTareas(filter)
  const hoy = startOfDay()
  const activosSet = new Set<string>(PROYECTO_ESTADOS_ACTIVOS)
  const resumenes = proyectos.map((p) => resumirProyecto(p, tareas))

  const porEstado = new Map<string, number>()
  const porEje = new Map<string, number>()
  for (const p of proyectos) {
    porEstado.set(p.estado, (porEstado.get(p.estado) ?? 0) + 1)
    const eje = (p.eje || 'Sin eje').trim() || 'Sin eje'
    porEje.set(eje, (porEje.get(eje) ?? 0) + 1)
  }

  const riesgosAltos = resumenes.filter((p) => p.riesgo === 'Alto' && p.estado !== 'Completado' && p.estado !== 'Cancelado')
  const topAtrasados = resumenes
    .filter((p) => {
      if (p.estado === 'Completado' || p.estado === 'Cancelado') return false
      if (!p.fecha_fin) return false
      return new Date(p.fecha_fin) < hoy
    })
    .sort((a, b) => String(a.fecha_fin).localeCompare(String(b.fecha_fin)))
    .slice(0, 10)

  const tareasVencidas = tareas.filter((t) => {
    if (t.estado === 'Completado') return false
    if (!t.fecha_fin) return false
    return new Date(t.fecha_fin) < hoy
  }).length

  const totales = {
    proyectos: proyectos.length,
    activos: proyectos.filter((p) => activosSet.has(p.estado)).length,
    completados: proyectos.filter((p) => p.estado === 'Completado').length,
    bloqueados: proyectos.filter((p) => p.estado === 'Bloqueado').length,
    tareas_vencidas: tareasVencidas,
    riesgos_altos: riesgosAltos.length,
  }

  const texto = [
    'PMO Personal — resumen de portafolio',
    `Proyectos: ${totales.proyectos} (activos ${totales.activos}, bloqueados ${totales.bloqueados}, completados ${totales.completados}).`,
    `Tareas vencidas: ${totales.tareas_vencidas}. Riesgos altos: ${totales.riesgos_altos}.`,
    topAtrasados[0] ? `Más atrasado: "${topAtrasados[0].nombre}".` : 'Sin proyectos con fecha vencida.',
  ].join('\n')

  void mapaNombre
  return {
    generado_en: new Date().toISOString(),
    filtro_departamento_id: departamentoId && mongoose.isValidObjectId(departamentoId) ? departamentoId : null,
    totales,
    por_estado: [...porEstado.entries()].map(([estado, cantidad]) => ({ estado, cantidad })).sort((a, b) => b.cantidad - a.cantidad),
    por_eje: [...porEje.entries()].map(([eje, cantidad]) => ({ eje, cantidad })).sort((a, b) => b.cantidad - a.cantidad),
    top_atrasados: topAtrasados,
    riesgos_altos: riesgosAltos.slice(0, 10),
    texto,
  }
}

export async function buildProyectoDetalle(
  ctx: AuthCtx,
  query: string,
): Promise<PmoProyectoDetalle | null> {
  const q = query.trim()
  if (!q) return null
  const scope = await buildProyectoScopeFilter(ctx._id, ctx.permisos)
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const filter = {
    $and: [
      scope,
      {
        $or: [
          { _id: q },
          { nombre: new RegExp(esc, 'i') },
        ],
      },
    ],
  }
  const proyectos = (await Proyecto.find(filter)
    .select('nombre estado prioridad porcentaje_avance fecha_inicio fecha_fin eje responsable riesgos_registro')
    .limit(5)
    .lean()) as unknown as ProyectoLean[]
  if (proyectos.length === 0) return null
  const exact = proyectos.find((p) => String(p._id).toLowerCase() === q.toLowerCase()) ?? proyectos[0]
  const { tareas, mapaNombre } = await cargarProyectosYTareas({ _id: exact._id })
  const resumen = resumirProyecto(exact, tareas)
  const hoy = startOfDay()
  const abiertas = tareas
    .filter((t) => t.estado !== 'Completado')
    .map((t) => resumirTarea(t, mapaNombre, hoy))
    .slice(0, 15)
  const texto = [
    `Proyecto ${resumen._id}: ${resumen.nombre}`,
    `Estado: ${resumen.estado} · Avance: ${resumen.porcentaje_avance}% · Riesgo: ${resumen.riesgo} (${resumen.motivo_riesgo})`,
    `Tareas abiertas: ${abiertas.length}.`,
    abiertas[0] ? `Ejemplo: "${abiertas[0].nombre}" (${abiertas[0].estado}).` : 'Sin tareas abiertas.',
  ].join('\n')
  return {
    proyecto: {
      ...resumen,
      eje: exact.eje ?? null,
      responsable: exact.responsable ?? null,
      fecha_inicio: iso(exact.fecha_inicio),
    },
    tareas_abiertas: abiertas,
    texto,
  }
}
