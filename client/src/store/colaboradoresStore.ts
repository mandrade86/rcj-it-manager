import { create } from 'zustand'

import * as api from '@/lib/api/colaboradores'
import type { Colaborador } from '@/types/colaborador'

type Filters = { frente: string; estado: string }

type ColaboradoresState = {
  list: Colaborador[]
  loading: boolean
  error: string | null
  filters: Filters
  setFilters: (f: Partial<Filters>) => void
  load: () => Promise<void>
  create: (body: Record<string, unknown>) => Promise<Colaborador>
  update: (id: string, body: Record<string, unknown>) => Promise<Colaborador>
  remove: (id: string) => Promise<void>
}

export const useColaboradoresStore = create<ColaboradoresState>((set, get) => ({
  list: [],
  loading: false,
  error: null,
  filters: { frente: '', estado: '' },
  setFilters: (f) =>
    set((s) => ({
      filters: { ...s.filters, ...f },
    })),
  load: async () => {
    set({ loading: true, error: null })
    try {
      const { frente, estado } = get().filters
      const list = await api.fetchColaboradores({
        frente: frente || undefined,
        estado: estado || undefined,
      })
      set({ list, loading: false })
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : 'Error al cargar',
        loading: false,
      })
    }
  },
  create: async (body) => {
    const doc = await api.createColaborador(body)
    await get().load()
    return doc
  },
  update: async (id, body) => {
    const doc = await api.updateColaborador(id, body)
    await get().load()
    return doc
  },
  remove: async (id) => {
    await api.deleteColaborador(id)
    await get().load()
  },
}))
