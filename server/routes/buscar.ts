import { Router } from 'express'

import { Empleado } from '../db/models/Empleado.js'
import { KPI } from '../db/models/KPI.js'
import { Proyecto } from '../db/models/Proyecto.js'
import { Tarea } from '../db/models/Tarea.js'
import { resolveVisibleEmpleadoIds } from '../utils/empleadoScope.js'
import { buildProyectoScopeFilter } from '../utils/proyectoScope.js'
import { resolveDepartamentosUsuario } from '../utils/proyectoScope.js'

export const buscarRouter = Router()

function puede(permisos: string[], clave: string): boolean {
  return permisos.includes('*') || permisos.includes(clave)
}

function rx(q: string): RegExp {
  return new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
}

export type BusquedaHit = {
  tipo: 'proyecto' | 'tarea' | 'empleado' | 'kpi'
  id: string
  titulo: string
  subtitulo: string
  href: string
}

buscarRouter.get('/', async (req, res, next) => {
  try {
    const u = req.user
    if (!u) {
      res.status(401).json({ error: 'No autenticado' })
      return
    }
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (q.length < 2) {
      res.json({ resultados: [] as BusquedaHit[] })
      return
    }
    const permisos = u.permisos ?? []
    const re = rx(q)
    const resultados: BusquedaHit[] = []

    if (puede(permisos, 'proyectos:ver')) {
      const scope = await buildProyectoScopeFilter(u._id, permisos)
      const proyectos = await Proyecto.find({
        $and: [scope, { $or: [{ nombre: re }, { _id: re }] }],
      })
        .select('_id nombre estado')
        .limit(8)
        .lean()
      for (const p of proyectos) {
        resultados.push({
          tipo: 'proyecto',
          id: String(p._id),
          titulo: p.nombre,
          subtitulo: `${p._id} · ${p.estado}`,
          href: `/proyectos/${encodeURIComponent(String(p._id))}`,
        })
      }
      const ids = await Proyecto.find(scope).distinct('_id')
      const tareas = await Tarea.find({ proyecto_id: { $in: ids }, nombre: re })
        .select('nombre proyecto_id estado')
        .limit(8)
        .lean()
      const pids = [...new Set(tareas.map((t) => String(t.proyecto_id ?? '')))]
      const nombres = await Proyecto.find({ _id: { $in: pids } }).select('_id nombre').lean()
      const mapa = new Map(nombres.map((p) => [String(p._id), p.nombre]))
      for (const t of tareas) {
        const pid = String(t.proyecto_id ?? '')
        resultados.push({
          tipo: 'tarea',
          id: String(t._id),
          titulo: t.nombre,
          subtitulo: `${mapa.get(pid) ?? 'Proyecto'} · ${t.estado}`,
          href: pid ? `/proyectos/${encodeURIComponent(pid)}` : '/mis-tareas',
        })
      }
    }

    if (puede(permisos, 'empleados:ver') || puede(permisos, 'equipo:ver')) {
      const vis = await resolveVisibleEmpleadoIds(u._id)
      const base = vis.isAdmin
        ? { activo: { $ne: false } }
        : { _id: { $in: vis.visibleIds }, activo: { $ne: false } }
      const empleados = await Empleado.find({
        $and: [base, { $or: [{ nombre: re }, { codigo: re }, { puesto: re }] }],
      })
        .select('nombre codigo puesto')
        .limit(8)
        .lean()
      for (const e of empleados) {
        resultados.push({
          tipo: 'empleado',
          id: String(e._id),
          titulo: e.nombre,
          subtitulo: [e.codigo, e.puesto].filter(Boolean).join(' · '),
          href: puede(permisos, 'empleados:ver') ? '/maestros/empleados' : '/equipo',
        })
      }
    }

    if (puede(permisos, 'kpis:ver')) {
      const deptIds = await resolveDepartamentosUsuario(u._id)
      const filtroDept = puede(permisos, '*') || deptIds.length === 0
        ? {}
        : { departamento_id: { $in: deptIds } }
      const kpis = await KPI.find({ ...filtroDept, nombre: re })
        .select('nombre eje meta')
        .limit(8)
        .lean()
      for (const k of kpis) {
        resultados.push({
          tipo: 'kpi',
          id: String(k._id),
          titulo: k.nombre,
          subtitulo: [k.eje, k.meta].filter(Boolean).join(' · '),
          href: '/kpis',
        })
      }
    }

    res.json({ resultados })
  } catch (err) {
    next(err)
  }
})
