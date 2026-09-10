import { ApiRequestError, readApiError } from '@/lib/api/errors'
import type { UsuarioDoc } from '@/types/usuario'

export async function fetchUsuarios(): Promise<UsuarioDoc[]> {
  const res = await fetch('/api/usuarios')
  if (!res.ok) throw await readApiError(res)
  return res.json() as Promise<UsuarioDoc[]>
}

export async function createUsuario(body: Record<string, unknown>): Promise<UsuarioDoc> {
  const res = await fetch('/api/usuarios', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw await readApiError(res)
  return res.json() as Promise<UsuarioDoc>
}

export type ImportUsuariosResult = {
  ok: boolean
  hoja: string
  totalFilas: number
  creados: number
  omitidos: number
  errores: { fila: number; error: string }[]
}

export async function descargarPlantillaUsuarios(): Promise<void> {
  const res = await fetch('/api/usuarios/plantilla-excel')
  if (!res.ok) throw await readApiError(res)
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition')
  const match = cd?.match(/filename="?([^";]+)"?/)
  const filename = match?.[1] ?? 'Usuarios-plantilla.xlsx'
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function importUsuariosExcel(file: File): Promise<ImportUsuariosResult> {
  const body = new FormData()
  body.append('archivo', file)
  const res = await fetch('/api/usuarios/importar-excel', { method: 'POST', body })
  if (!res.ok) throw await readApiError(res)
  return res.json() as Promise<ImportUsuariosResult>
}

export async function updateUsuario(id: string, body: Record<string, unknown>): Promise<UsuarioDoc> {
  const res = await fetch(`/api/usuarios/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw await readApiError(res)
  return res.json() as Promise<UsuarioDoc>
}

export async function resetPasswordUsuario(id: string, password_nuevo: string): Promise<void> {
  const res = await fetch(`/api/usuarios/${id}/reset-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password_nuevo }),
  })
  if (!res.ok) throw await readApiError(res)
}

export async function deleteUsuario(id: string): Promise<void> {
  const res = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' })
  if (res.status === 204) return
  if (!res.ok) throw await readApiError(res)
}

export { ApiRequestError }
