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
