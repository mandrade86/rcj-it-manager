import mongoose from 'mongoose'

export const ELIMINAR_LOTE_MAX = 200

export type EliminarLoteResponse = {
  eliminados: number
  ids: string[]
  omitidos: string[]
  errores: Array<{ id: string; error: string }>
}

export function parseEliminarLoteIds(
  raw: unknown,
): { error: string } | { validIds: string[]; omitidos: string[] } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'Envía un arreglo ids con al menos un id.' }
  }
  const ids = [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))]
  if (ids.length > ELIMINAR_LOTE_MAX) {
    return { error: `Máximo ${ELIMINAR_LOTE_MAX} registros por solicitud.` }
  }
  const validIds = ids.filter((id) => mongoose.isValidObjectId(id))
  const omitidos = ids.filter((id) => !validIds.includes(id))
  return { validIds, omitidos }
}

export function buildEliminarLoteResponse(
  eliminados: string[],
  omitidosInicial: string[],
  noEncontrados: string[],
  errores: Array<{ id: string; error: string }> = [],
): EliminarLoteResponse {
  return {
    eliminados: eliminados.length,
    ids: eliminados,
    omitidos: [...omitidosInicial, ...noEncontrados],
    errores,
  }
}
