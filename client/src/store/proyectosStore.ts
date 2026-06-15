import { create } from 'zustand'

import * as api from '@/lib/api/proyectos'
import { notifyKpiDataChanged } from '@/lib/kpiSync'
import type { EliminarProyectosLoteResponse } from '@/lib/api/proyectos'
import type { Proyecto } from '@/types/proyecto'

/**
 * `alcance` controla la vista del usuario:
 *  - 'mis': solo los proyectos donde es propietario (usuario_id).
 *  - 'equipo': proyectos de usuarios vinculados a mis subalternos.
 *  - 'depto': proyectos de su departamento.
 *  - 'todos': todo lo que el backend permita (admins ven la organización).
 */
export type ProyectoAlcance = 'mis' | 'equipo' | 'depto' | 'participo' | 'todos'

type Filters = {
  fase: string
  eje: string
  estado: string
  prioridad: string
  tipo: string
  /** Solo en vista «Todos» (admin): filtrar por departamento. */
  departamento_id: string
  /** Filtrar proyectos que incluyan esta empresa en `empresa_ids`. */
  empresa_id: string
}

type ProyectosState = {
  list: Proyecto[]
  loading: boolean
  error: string | null
  filters: Filters
  alcance: ProyectoAlcance
  miUsuarioId: string | null
  miDepartamentoId: string | null
  setFilters: (f: Partial<Filters>) => void
  setAlcance: (a: ProyectoAlcance) => void
  setIdentidad: (usuarioId: string | null, departamentoId: string | null) => void
  load: () => Promise<void>
  create: (body: Record<string, unknown>) => Promise<Proyecto>
  update: (id: string, body: Record<string, unknown>) => Promise<Proyecto>
  remove: (id: string) => Promise<void>
  removeMany: (ids: string[]) => Promise<EliminarProyectosLoteResponse>
  transicionar: (id: string, a: string, comentario?: string) => Promise<Proyecto>
}

export const useProyectosStore = create<ProyectosState>((set, get) => ({
  list: [],
  loading: false,
  error: null,
  filters: { fase: '', eje: '', estado: '', prioridad: '', tipo: '', departamento_id: '', empresa_id: '' },
  alcance: 'depto',
  miUsuarioId: null,
  miDepartamentoId: null,

  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  setAlcance: (a) => set({ alcance: a }),
  setIdentidad: (usuarioId, departamentoId) =>
    set({ miUsuarioId: usuarioId, miDepartamentoId: departamentoId }),

  load: async () => {
    set({ loading: true, error: null })
    try {
      const s = get()
      const { fase, eje, estado, prioridad, tipo, departamento_id: filtroDept, empresa_id: filtroEmp } = s.filters
      const params: Parameters<typeof api.fetchProyectos>[0] = {
        fase: fase || undefined,
        eje: eje || undefined,
        estado: estado || undefined,
        prioridad: prioridad || undefined,
        tipo: tipo || undefined,
      }
      if (filtroEmp) params.empresa_id = filtroEmp
      if (s.alcance === 'mis' && s.miUsuarioId) params.usuario_id = s.miUsuarioId
      if (s.alcance === 'equipo') params.scope = 'equipo'
      if (s.alcance === 'participo') params.scope = 'participo'
      if (s.alcance === 'depto' && s.miDepartamentoId) {
        params.departamento_id = s.miDepartamentoId
      } else if (s.alcance === 'todos' && filtroDept) {
        params.departamento_id = filtroDept
      }

      const list = await api.fetchProyectos(params)
      set({ list, loading: false })
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : 'Error al cargar proyectos',
        loading: false,
      })
    }
  },

  create: async (body) => {
    const doc = await api.createProyecto(body)
    await get().load()
    return doc
  },
  update: async (id, body) => {
    const doc = await api.updateProyecto(id, body)
    await get().load()
    notifyKpiDataChanged()
    return doc
  },
  remove: async (id) => {
    await api.deleteProyecto(id)
    await get().load()
  },
  removeMany: async (ids) => {
    const r = await api.deleteProyectosLote(ids)
    await get().load()
    return r
  },
  transicionar: async (id, a, comentario) => {
    const doc = await api.transicionarProyecto(id, a, comentario)
    await get().load()
    notifyKpiDataChanged()
    return doc
  },
}))
