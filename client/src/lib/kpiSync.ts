import type { KpiDoc } from '@/types/kpi'

/** Evento global: KPIs o metas de departamento cambiaron (registro, edición, proyecto, etc.). */
export const KPI_DATA_CHANGED = 'rcj:kpi-data-changed'

export function notifyKpiDataChanged(): void {
  window.dispatchEvent(new CustomEvent(KPI_DATA_CHANGED))
}

export function subscribeKpiDataChanged(handler: () => void): () => void {
  window.addEventListener(KPI_DATA_CHANGED, handler)
  return () => window.removeEventListener(KPI_DATA_CHANGED, handler)
}

/** Fusiona un KPI actualizado (p. ej. tras registrar valor) conservando populate previo. */
export function mergeKpiInList(list: KpiDoc[], updated: KpiDoc): KpiDoc[] {
  const id = String(updated._id)
  const idx = list.findIndex((k) => k._id === id)
  if (idx < 0) {
    return [...list, { ...updated, _id: id }]
  }
  const prev = list[idx]
  const merged: KpiDoc = {
    ...prev,
    ...updated,
    _id: id,
    departamento_id: updated.departamento_id ?? prev.departamento_id,
    proyecto_ids: updated.proyecto_ids?.length ? updated.proyecto_ids : prev.proyecto_ids,
    registros: updated.registros ?? prev.registros,
  }
  return list.map((k, i) => (i === idx ? merged : k))
}

export function normalizeKpiFromApi(raw: KpiDoc): KpiDoc {
  return {
    ...raw,
    _id: typeof raw._id === 'string' ? raw._id : String(raw._id),
  }
}
