import { useCallback, useMemo, useState } from 'react'

import { mensajeServidorNoDisponible, isServerUnavailableError } from '@/lib/fetchRetry'
import { ejecutarEliminarMaestroLote } from '@/lib/maestroBulkDelete'
import { useMaestroSeleccion } from '@/hooks/useMaestroSeleccion'

type Options = {
  recurso: string
  visibleIds: string[]
  etiqueta?: string
  confirmar?: (count: number) => string
  onAfterDelete?: () => void | Promise<void>
}

export function useMaestroBulkDelete({
  recurso,
  visibleIds,
  etiqueta = 'registro(s)',
  confirmar,
  onAfterDelete,
}: Options) {
  const sel = useMaestroSeleccion(visibleIds)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const handleEliminarSeleccionados = useCallback(async () => {
    const ids = [...sel.selectedIds]
    if (ids.length === 0) return
    setBulkDeleting(true)
    try {
      const msg =
        confirmar?.(ids.length) ??
        `¿Eliminar ${ids.length} registro(s)? Esta acción no se puede deshacer.`
      const ok = await ejecutarEliminarMaestroLote(recurso, ids, {
        confirmar: msg,
        etiqueta,
      })
      if (ok) {
        sel.clear()
        await onAfterDelete?.()
      }
    } catch (ex) {
      const msg = isServerUnavailableError(ex)
        ? mensajeServidorNoDisponible()
        : ex instanceof Error
          ? ex.message
          : 'No se pudo eliminar el lote'
      window.alert(msg)
    } finally {
      setBulkDeleting(false)
    }
  }, [sel, recurso, etiqueta, confirmar, onAfterDelete])

  const showBar = useMemo(() => visibleIds.length > 0, [visibleIds.length])

  return {
    ...sel,
    bulkDeleting,
    showBar,
    handleEliminarSeleccionados,
  }
}
