import type { UsuarioDoc } from '@/types/usuario'

async function parseError(res: Response): Promise<string> {
  try { const j = (await res.json()) as { error?: string }; return j.error ?? res.statusText }
  catch { return res.statusText }
}

export async function fetchUsuarios(): Promise<UsuarioDoc[]> {
  const res = await fetch('/api/usuarios')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<UsuarioDoc[]>
}

export async function createUsuario(body: Record<string, unknown>): Promise<UsuarioDoc> {
  const res = await fetch('/api/usuarios', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<UsuarioDoc>
}

export async function updateUsuario(id: string, body: Record<string, unknown>): Promise<UsuarioDoc> {
  const res = await fetch(`/api/usuarios/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<UsuarioDoc>
}

export async function resetPasswordUsuario(id: string, password_nuevo: string): Promise<void> {
  const res = await fetch(`/api/usuarios/${id}/reset-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password_nuevo }),
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function deleteUsuario(id: string): Promise<void> {
  const res = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' })
  if (res.status === 204) return
  if (!res.ok) throw new Error(await parseError(res))
}
