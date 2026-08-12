import { create } from 'zustand'

import {
  fetchRecetaDetalle,
  fetchRecetasCatalogo,
  fetchRecetasGeneral,
  fetchVentasAnalisis,
  fetchVentasCatalogo,
} from '@/lib/api/costeoMuestras'
import type {
  RecetaCatalogoItem,
  RecetaDetallePayload,
  RecetasMatrizPayload,
  VentaAnalisisPayload,
  VentaCatalogoPayload,
} from '@/types/costeoMuestras'

export type VentasFiltrosMemoria = {
  receta: string
  codigo_cliente: string
  desde: string
  hasta: string
}

function keyOf(parts: Record<string, string | undefined>): string {
  return Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k] ?? ''}`)
    .join('|')
}

type CosteoMuestrasState = {
  /** Matriz General Recetas */
  general: RecetasMatrizPayload | null
  generalLoading: boolean

  /** Catálogo dropdown Costos por receta */
  catalogoRecetas: RecetaCatalogoItem[] | null
  catalogoLoading: boolean
  recetaSeleccion: string

  /** Detalle por código de receta */
  detalles: Record<string, RecetaDetallePayload>
  detalleLoadingCode: string | null

  /** Ventas: catálogo e análisis por clave de filtros */
  ventasCatalogo: Record<string, VentaCatalogoPayload>
  ventasAnalisis: Record<string, VentaAnalisisPayload>
  ventasFiltros: VentasFiltrosMemoria
  ventasCatalogoLoading: boolean
  ventasAnalisisLoading: boolean

  loadedAt: string | null
  /** Sube en cada invalidate para que las pestañas recarguen. */
  cacheEpoch: number

  loadGeneral: (opts?: { force?: boolean }) => Promise<RecetasMatrizPayload>
  loadCatalogoRecetas: (opts?: { force?: boolean }) => Promise<RecetaCatalogoItem[]>
  setRecetaSeleccion: (code: string) => void
  loadDetalle: (code: string, opts?: { force?: boolean }) => Promise<RecetaDetallePayload>
  setVentasFiltros: (f: Partial<VentasFiltrosMemoria>) => void
  loadVentasCatalogo: (opts?: { force?: boolean }) => Promise<VentaCatalogoPayload>
  loadVentasAnalisis: (opts?: { force?: boolean }) => Promise<VentaAnalisisPayload>
  /** Limpia toda la memoria (p. ej. al sincronizar SAP). */
  invalidate: () => void
}

/** Clave estable para caches por filtro (exportada para lecturas en UI). */
export function costeoCacheKey(parts: Record<string, string | undefined>): string {
  return keyOf(parts)
}

const VENTAS_FILTROS_INI: VentasFiltrosMemoria = {
  receta: '__todas__',
  codigo_cliente: '__todos__',
  desde: '',
  hasta: '',
}

export const useCosteoMuestrasStore = create<CosteoMuestrasState>((set, get) => ({
  general: null,
  generalLoading: false,
  catalogoRecetas: null,
  catalogoLoading: false,
  recetaSeleccion: '',
  detalles: {},
  detalleLoadingCode: null,
  ventasCatalogo: {},
  ventasAnalisis: {},
  ventasFiltros: { ...VENTAS_FILTROS_INI },
  ventasCatalogoLoading: false,
  ventasAnalisisLoading: false,
  loadedAt: null,
  cacheEpoch: 0,

  loadGeneral: async ({ force } = {}) => {
    const cached = get().general
    if (cached && !force) return cached
    set({ generalLoading: true })
    try {
      const payload = await fetchRecetasGeneral()
      set({ general: payload, loadedAt: new Date().toISOString() })
      return payload
    } finally {
      set({ generalLoading: false })
    }
  },

  loadCatalogoRecetas: async ({ force } = {}) => {
    const cached = get().catalogoRecetas
    if (cached && !force) return cached
    set({ catalogoLoading: true })
    try {
      const { catalogo } = await fetchRecetasCatalogo()
      set((s) => ({
        catalogoRecetas: catalogo,
        recetaSeleccion:
          s.recetaSeleccion ||
          catalogo.find((r) => r.receta_code?.trim())?.receta_code ||
          '',
        loadedAt: new Date().toISOString(),
      }))
      return catalogo
    } finally {
      set({ catalogoLoading: false })
    }
  },

  setRecetaSeleccion: (code) => set({ recetaSeleccion: code }),

  loadDetalle: async (code, { force } = {}) => {
    const trimmed = code.trim()
    if (!trimmed) throw new Error('Receta requerida')
    const cached = get().detalles[trimmed]
    if (cached && !force) return cached
    set({ detalleLoadingCode: trimmed })
    try {
      const payload = await fetchRecetaDetalle(trimmed)
      set((s) => ({
        detalles: { ...s.detalles, [trimmed]: payload },
        loadedAt: new Date().toISOString(),
      }))
      return payload
    } finally {
      set({ detalleLoadingCode: null })
    }
  },

  setVentasFiltros: (f) =>
    set((s) => ({ ventasFiltros: { ...s.ventasFiltros, ...f } })),

  loadVentasCatalogo: async ({ force } = {}) => {
    const f = get().ventasFiltros
    const receta = f.receta === '__todas__' ? undefined : f.receta
    const k = keyOf({
      receta,
      desde: f.desde || undefined,
      hasta: f.hasta || undefined,
    })
    const cached = get().ventasCatalogo[k]
    if (cached && !force) return cached
    set({ ventasCatalogoLoading: true })
    try {
      const payload = await fetchVentasCatalogo({
        receta,
        recetaExact: true,
        desde: f.desde || undefined,
        hasta: f.hasta || undefined,
      })
      set((s) => ({
        ventasCatalogo: { ...s.ventasCatalogo, [k]: payload },
        loadedAt: new Date().toISOString(),
      }))
      return payload
    } finally {
      set({ ventasCatalogoLoading: false })
    }
  },

  loadVentasAnalisis: async ({ force } = {}) => {
    const f = get().ventasFiltros
    const receta = f.receta === '__todas__' ? undefined : f.receta
    const codigo_cliente = f.codigo_cliente === '__todos__' ? undefined : f.codigo_cliente
    const k = keyOf({
      receta,
      codigo_cliente,
      desde: f.desde || undefined,
      hasta: f.hasta || undefined,
    })
    const cached = get().ventasAnalisis[k]
    if (cached && !force) return cached
    set({ ventasAnalisisLoading: true })
    try {
      const payload = await fetchVentasAnalisis({
        codigo_cliente,
        receta,
        recetaExact: true,
        desde: f.desde || undefined,
        hasta: f.hasta || undefined,
      })
      set((s) => ({
        ventasAnalisis: { ...s.ventasAnalisis, [k]: payload },
        loadedAt: new Date().toISOString(),
      }))
      return payload
    } finally {
      set({ ventasAnalisisLoading: false })
    }
  },

  invalidate: () =>
    set((s) => ({
      general: null,
      catalogoRecetas: null,
      detalles: {},
      ventasCatalogo: {},
      ventasAnalisis: {},
      loadedAt: null,
      cacheEpoch: s.cacheEpoch + 1,
    })),
}))
