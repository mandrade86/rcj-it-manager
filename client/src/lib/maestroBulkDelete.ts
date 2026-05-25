import { eliminarMaestroLote } from '@/lib/api/eliminarLote'
import { mensajeEliminarLote } from '@/types/eliminarLote'

export async function ejecutarEliminarMaestroLote(
  recurso: string,
  ids: string[],
  opts?: { confirmar?: string; etiqueta?: string },
): Promise<boolean> {
  if (ids.length === 0) return false
  const msg =
    opts?.confirmar ??
    `¿Eliminar ${ids.length} registro(s)? Esta acción no se puede deshacer.`
  if (!window.confirm(msg)) return false
  const r = await eliminarMaestroLote(recurso, ids)
  window.alert(mensajeEliminarLote(r, opts?.etiqueta))
  return r.eliminados > 0
}
