import {
  endOfISOWeek,
  format,
  setISOWeek,
  setISOWeekYear,
  startOfISOWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import type mongoose from 'mongoose'

import { Proyecto } from '../db/models/Proyecto.js'
import { Tarea } from '../db/models/Tarea.js'

export type RangoSemana = { inicio: Date; fin: Date; iso: string }

export function parseIsoWeek(semana: string): RangoSemana | null {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(semana.trim())
  if (!m) return null
  const year = Number(m[1])
  const week = Number(m[2])
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null

  let base = setISOWeekYear(new Date(), year)
  base = setISOWeek(base, week)
  const inicio = startOfISOWeek(base)
  inicio.setHours(0, 0, 0, 0)
  const fin = endOfISOWeek(base)
  fin.setHours(23, 59, 59, 999)

  return {
    inicio,
    fin,
    iso: `${year}-W${String(week).padStart(2, '0')}`,
  }
}

function overlapsWeek(
  start: Date | null | undefined,
  end: Date | null | undefined,
  weekStart: Date,
  weekEnd: Date,
): boolean {
  const s = start ? new Date(start) : null
  const e = end ? new Date(end) : null
  if (s && e) return s <= weekEnd && e >= weekStart
  if (s) return s <= weekEnd
  if (e) return e >= weekStart
  return false
}

function tareaAplicaSemana(
  tarea: {
    estado: string
    fecha_inicio?: Date | null
    fecha_fin?: Date | null
    updatedAt?: Date
  },
  inicio: Date,
  fin: Date,
): boolean {
  const estado = tarea.estado
  const updated = tarea.updatedAt ? new Date(tarea.updatedAt) : null
  const updatedEnSemana = updated != null && updated >= inicio && updated <= fin

  if (estado === 'Completado') {
    return updatedEnSemana
  }

  if (estado === 'En progreso' || estado === 'Bloqueado') {
    return true
  }

  if (overlapsWeek(tarea.fecha_inicio, tarea.fecha_fin, inicio, fin)) {
    return true
  }

  if (updatedEnSemana) return true

  return false
}

function etiquetaSemana(inicio: Date, fin: Date, iso: string): string {
  const num = iso.split('-W')[1] ?? ''
  const rango = `${format(inicio, 'd MMM', { locale: es })} – ${format(fin, 'd MMM yyyy', { locale: es })}`
  return `Semana ${num} · ${rango}`
}

export async function generarReporteSemanalTareas(opts: {
  semana: string
  alcance?: string
  proyecto_id?: string
  departamento_id?: string
}) {
  const rango = parseIsoWeek(opts.semana)
  if (!rango) {
    return { error: 'Parámetro semana inválido. Use formato YYYY-Www (ej. 2026-W26).' }
  }

  const { inicio, fin, iso } = rango
  const alcance = opts.alcance ?? 'todos'

  const proyectoFilter: Record<string, unknown> = {
    estado: { $nin: ['Cancelado'] },
  }
  if (alcance === 'proyecto' && opts.proyecto_id) {
    proyectoFilter._id = opts.proyecto_id
  } else if (alcance === 'departamento' && opts.departamento_id) {
    proyectoFilter.departamento_id = opts.departamento_id
  }

  const proyectos = await Proyecto.find(proyectoFilter)
    .select('_id nombre eje estado porcentaje_avance')
    .sort({ nombre: 1 })
    .lean() as Array<{
      _id: string
      nombre: string
      eje?: string
      estado?: string
      porcentaje_avance?: number
    }>

  if (proyectos.length === 0) {
    return {
      semana: {
        iso,
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        etiqueta: etiquetaSemana(inicio, fin, iso),
      },
      alcance,
      resumen: {
        total_proyectos: 0,
        total_tareas: 0,
        completadas: 0,
        en_progreso: 0,
        pendientes: 0,
        bloqueadas: 0,
      },
      proyectos: [],
    }
  }

  const proyectoIds = proyectos.map((p) => p._id)
  const tareas = await Tarea.find({ proyecto_id: { $in: proyectoIds } })
    .sort({ fecha_fin: 1, nombre: 1 })
    .lean() as Array<{
      _id: mongoose.Types.ObjectId
      proyecto_id: string
      nombre: string
      estado: string
      porcentaje?: number
      responsable?: string
      fecha_inicio?: Date
      fecha_fin?: Date
      updatedAt?: Date
      comentarios?: Array<{ texto: string; createdAt?: Date }>
      tags?: string[]
    }>

  const tareasPorProyecto = new Map<string, typeof tareas>()
  for (const t of tareas) {
    if (!tareaAplicaSemana(t, inicio, fin)) continue
    const list = tareasPorProyecto.get(t.proyecto_id) ?? []
    list.push(t)
    tareasPorProyecto.set(t.proyecto_id, list)
  }

  let completadas = 0
  let enProgreso = 0
  let pendientes = 0
  let bloqueadas = 0
  let totalTareas = 0

  const proyectosReporte = proyectos
    .map((p) => {
      const list = tareasPorProyecto.get(p._id) ?? []
      if (list.length === 0) return null

      const tareasFmt = list.map((t) => {
        totalTareas++
        if (t.estado === 'Completado') completadas++
        else if (t.estado === 'En progreso') enProgreso++
        else if (t.estado === 'Bloqueado') bloqueadas++
        else pendientes++

        const comentarios = [...(t.comentarios ?? [])].sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
        )
        const ultimo = comentarios[0]?.texto?.trim()

        return {
          _id: String(t._id),
          nombre: t.nombre,
          estado: t.estado,
          porcentaje: t.porcentaje ?? 0,
          responsable: t.responsable ?? null,
          fecha_inicio: t.fecha_inicio?.toISOString() ?? null,
          fecha_fin: t.fecha_fin?.toISOString() ?? null,
          ultimo_comentario: ultimo || null,
          tags: t.tags ?? [],
        }
      })

      return {
        proyecto_id: p._id,
        proyecto_nombre: p.nombre,
        eje: p.eje ?? null,
        estado_proyecto: p.estado ?? null,
        avance_proyecto: p.porcentaje_avance ?? 0,
        tareas: tareasFmt,
      }
    })
    .filter((p): p is NonNullable<typeof p> => p != null)

  return {
    semana: {
      iso,
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
      etiqueta: etiquetaSemana(inicio, fin, iso),
    },
    alcance,
    resumen: {
      total_proyectos: proyectosReporte.length,
      total_tareas: totalTareas,
      completadas,
      en_progreso: enProgreso,
      pendientes,
      bloqueadas,
    },
    proyectos: proyectosReporte,
  }
}
