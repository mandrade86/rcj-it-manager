import type { EmpresaDoc } from '@/types/empresa'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchEmpresas(params?: { activo?: boolean }): Promise<EmpresaDoc[]> {
  const q = new URLSearchParams()
  if (params?.activo !== undefined) q.set('activo', String(params.activo))
  const url = `/api/empresas${q.toString() ? `?${q}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EmpresaDoc[]>
}

export async function createEmpresa(body: Record<string, unknown>): Promise<EmpresaDoc> {
  const res = await fetch('/api/empresas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EmpresaDoc>
}

export async function updateEmpresa(id: string, body: Record<string, unknown>): Promise<EmpresaDoc> {
  const res = await fetch(`/api/empresas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EmpresaDoc>
}

export async function deleteEmpresa(id: string): Promise<void> {
  const res = await fetch(`/api/empresas/${id}`, { method: 'DELETE' })
  if (res.status === 204) return
  if (!res.ok) throw new Error(await parseError(res))
}

export async function fetchEmpresasListUrl(): Promise<{ url: string }> {
  const res = await fetch('/api/empresas/config/list-url')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ url: string }>
}

export async function saveEmpresasListUrl(url: string): Promise<void> {
  const res = await fetch('/api/empresas/config/list-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export type SyncEmpresasResult = {
  ok: boolean
  insertados: number
  actualizados: number
  errores: number
  total: number
  advertencia?: string
}

export async function syncEmpresas(): Promise<SyncEmpresasResult> {
  const res = await fetch('/api/empresas/sync', { method: 'POST' })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<SyncEmpresasResult>
}
