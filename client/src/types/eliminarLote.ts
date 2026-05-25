export type EliminarLoteResponse = {
  eliminados: number
  ids: string[]
  omitidos: string[]
  errores: Array<{ id: string; error: string }>
}

export function mensajeEliminarLote(r: EliminarLoteResponse, etiqueta = 'registro(s)'): string {
  let msg = `Se eliminaron ${r.eliminados} ${etiqueta}.`
  if (r.omitidos.length > 0) {
    msg += `\n\nOmitidos (${r.omitidos.length}): no encontrados o id inválido.`
  }
  if (r.errores.length > 0) {
    const det = r.errores
      .slice(0, 5)
      .map((e) => `• ${e.error}`)
      .join('\n')
    msg += `\n\nNo eliminados (${r.errores.length}):\n${det}${r.errores.length > 5 ? '\n…' : ''}`
  }
  return msg
}
