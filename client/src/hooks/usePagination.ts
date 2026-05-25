import { useCallback, useEffect, useState } from 'react'

/** Valores estándar para el selector «por página». */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

export const DEFAULT_PAGE_SIZE = 25

type UsePaginationOptions = {
  initialPageSize?: number
  /** Al cambiar (filtros, búsqueda, orden), reinicia a la página 1 */
  resetKey?: string | number
}

export function usePagination(totalItems: number, options?: UsePaginationOptions) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(options?.initialPageSize ?? DEFAULT_PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [options?.resetKey])

  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalItems) / pageSize))

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages))
  }, [totalPages])

  const slice = useCallback(
    <T,>(items: readonly T[]): T[] => {
      if (items.length === 0) return []
      const start = (page - 1) * pageSize
      return items.slice(start, start + pageSize)
    },
    [page, pageSize],
  )

  const setPageSize = useCallback((n: number) => {
    const next = PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number])
      ? n
      : DEFAULT_PAGE_SIZE
    setPageSizeState(next)
    setPage(1)
  }, [])

  const safeTotal = Math.max(0, totalItems)
  const fromItem = safeTotal === 0 ? 0 : (page - 1) * pageSize + 1
  const toItem = Math.min(page * pageSize, safeTotal)

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    slice,
    fromItem,
    toItem,
    totalItems: safeTotal,
  }
}
