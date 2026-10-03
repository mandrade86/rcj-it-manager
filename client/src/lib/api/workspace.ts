async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchWorkspaceNombre(): Promise<string> {
  const res = await fetch('/api/config/workspace')
  if (!res.ok) throw new Error(await parseError(res))
  const j = (await res.json()) as { nombre?: string }
  return (j.nombre ?? '').trim() || 'Project Management & Talent'
}

export async function updateWorkspaceNombre(nombre: string): Promise<string> {
  const res = await fetch('/api/config/workspace', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const j = (await res.json()) as { nombre?: string }
  return (j.nombre ?? nombre).trim()
}
