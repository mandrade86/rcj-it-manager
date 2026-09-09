import { useMemo } from 'react'

import { usePagination } from '@/hooks/usePagination'

const COLUMNAS_SELECT_EXACTO = new Set([
  'anio',
  'categoria',
  'empresa',
  'proveedor',
  'subcategoria',
  'tipo',
])

const COLUMNAS_OPCIONES = [
  'anio',
  'categoria',
  'empresa',
  'proveedor',
  'subcategoria',
  'tipo',
] as const

function filtroActivo(valor: string | undefined): boolean {
  return Boolean(valor && valor !== 'todos')
}

export function useGastosDetalleTabla<T>(
  filas: T[] | undefined,
  busqueda: string,
  filtrosColumnas: Record<string, string>,
  matchBusqueda: (f: T, q: string) => boolean,
  getValorColumna: (f: T, columna: string) => string,
) {
  const filasFiltradas = useMemo(() => {
    if (!filas?.length) return []
    const q = busqueda.trim().toLowerCase()
    return filas.filter((f) => {
      for (const [col, filtro] of Object.entries(filtrosColumnas)) {
        if (!filtroActivo(filtro)) continue
        const valor = getValorColumna(f, col).toLowerCase()
        const fLower = filtro.toLowerCase()
        if (COLUMNAS_SELECT_EXACTO.has(col)) {
          if (valor !== fLower) return false
        } else if (!valor.includes(fLower)) {
          return false
        }
      }
      if (q && !matchBusqueda(f, q)) return false
      return true
    })
  }, [filas, busqueda, filtrosColumnas, matchBusqueda, getValorColumna])

  const opcionesColumna = useMemo(() => {
    const result: Record<string, string[]> = {}
    if (!filas?.length) return result
    for (const col of COLUMNAS_OPCIONES) {
      const vals = [
        ...new Set(
          filas
            .map((f) => getValorColumna(f, col))
            .filter((v) => v && v !== '—'),
        ),
      ].sort((a, b) => a.localeCompare(b, 'es'))
      if (vals.length) result[col] = vals
    }
    return result
  }, [filas, getValorColumna])

  const resetKey = `${busqueda}|${JSON.stringify(filtrosColumnas)}`

  const pagination = usePagination(filasFiltradas.length, { resetKey })

  const filasPagina = pagination.slice(filasFiltradas)

  const hayFiltrosColumna = Object.values(filtrosColumnas).some(filtroActivo)

  return {
    filasFiltradas,
    filasPagina,
    opcionesColumna,
    pagination,
    hayFiltrosColumna,
  }
}
