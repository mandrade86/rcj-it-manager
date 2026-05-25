import type { MetaDoc, MetaFormBody } from '@/types/meta'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchMetas(params?: {
  departamento_id?: string
  activa?: 'true' | 'false'
}): Promise<MetaDoc[]> {
  const q = new URLSearchParams()
  if (params?.departamento_id) q.set('departamento_id', params.departamento_id)
  if (params?.activa) q.set('activa', params.activa)
  const url = `/api/metas${q.toString() ? `?${q}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<MetaDoc[]>
}

export async function createMeta(body: MetaFormBody): Promise<MetaDoc> {
  const res = await fetch('/api/metas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<MetaDoc>
}

export async function updateMeta(
  departamentoId: string,
  metaId: string,
  body: Partial<Omit<MetaFormBody, 'departamento_id' | 'id'>>,
): Promise<MetaDoc> {
  const res = await fetch(`/api/metas/${encodeURIComponent(departamentoId)}/${encodeURIComponent(metaId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<MetaDoc>
}

export async function deleteMeta(departamentoId: string, metaId: string): Promise<void> {
  const res = await fetch(
    `/api/metas/${encodeURIComponent(departamentoId)}/${encodeURIComponent(metaId)}`,
    { method: 'DELETE' },
  )
  if (res.status === 204) return
  if (!res.ok) throw new Error(await parseError(res))
}

export async function deleteMetasLote(
  items: Array<{ departamento_id: string; meta_id: string }>,
): Promise<{ eliminados: number; errores: Array<{ key: string; error: string }> }> {
  const res = await fetch('/api/metas/eliminar-lote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ eliminados: number; errores: Array<{ key: string; error: string }> }>
}

export function metaRowKey(m: MetaDoc): string {
  return `${m.departamento_id}::${m.id}`
}
