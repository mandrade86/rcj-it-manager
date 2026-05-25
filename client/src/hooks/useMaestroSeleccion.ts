import { useCallback, useEffect, useMemo, useState } from 'react'

/** Selección múltiple para tablas de maestros (filas visibles). */
export function useMaestroSeleccion(visibleIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const valid = new Set(visibleIds)
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [visibleIds])

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const all = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id))
      if (all) return new Set()
      return new Set(visibleIds)
    })
  }, [visibleIds])

  const clear = useCallback(() => setSelectedIds(new Set()), [])

  const allSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id)),
    [visibleIds, selectedIds],
  )

  const someSelected = useMemo(
    () => visibleIds.some((id) => selectedIds.has(id)),
    [visibleIds, selectedIds],
  )

  return {
    selectedIds,
    seleccionCount: selectedIds.size,
    allSelected,
    someSelected,
    toggle,
    toggleAll,
    clear,
  }
}
