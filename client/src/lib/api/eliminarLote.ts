import { fetchWithRetry, isServerUnavailableError, mensajeServidorNoDisponible } from '@/lib/fetchRetry'
import type { EliminarLoteResponse } from '@/types/eliminarLote'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

/** POST /api/{recurso}/eliminar-lote */
export async function eliminarMaestroLote(
  recurso: string,
  ids: string[],
): Promise<EliminarLoteResponse> {
  try {
    const res = await fetchWithRetry(`/api/${recurso}/eliminar-lote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json() as Promise<EliminarLoteResponse>
  } catch (ex) {
    if (isServerUnavailableError(ex)) throw new Error(mensajeServidorNoDisponible())
    throw ex
  }
}
