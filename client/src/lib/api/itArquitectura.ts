import type {
  ApiEndpointIT,
  ChecklistItemIT,
  DeudaJiraSugerencia,
  DeudaTecnica,
  JiraConfigIT,
  JiraStatusResumen,
  SistemaIT,
} from '@/types/itArquitectura'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; message?: string }
    return j.error ?? j.message ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function getSistemasITApi(): Promise<SistemaIT[]> {
  const res = await fetch('/api/it/sistemas')
  if (!res.ok) throw new Error(await parseError(res))
  const json = (await res.json()) as { data: SistemaIT[] }
  return json.data
}

export async function createSistemaITApi(body: Partial<SistemaIT>): Promise<SistemaIT> {
  const res = await fetch('/api/it/sistemas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const json = (await res.json()) as { data: SistemaIT }
  return json.data
}

export async function updateSistemaITApi(id: string, body: Partial<SistemaIT>): Promise<SistemaIT> {
  const res = await fetch(`/api/it/sistemas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const json = (await res.json()) as { data: SistemaIT }
  return json.data
}

export async function deleteSistemaITApi(id: string): Promise<void> {
  const res = await fetch(`/api/it/sistemas/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function getDeudaTecnicaApi(): Promise<{
  items: DeudaTecnica[]
  jiraResumen: JiraStatusResumen | null
}> {
  const res = await fetch('/api/it/deuda-tecnica')
  if (!res.ok) throw new Error(await parseError(res))
  const json = (await res.json()) as {
    data: DeudaTecnica[]
    jira?: { enabled: boolean; resumen?: JiraStatusResumen }
  }
  return {
    items: json.data,
    jiraResumen: json.jira?.enabled && json.jira.resumen ? json.jira.resumen : null,
  }
}

export async function syncDeudaJiraApi(): Promise<{
  sync: { synced: number; notFound: string[]; errors: string[] }
  resumen: JiraStatusResumen
  items: DeudaTecnica[]
}> {
  const res = await fetch('/api/it/deuda-tecnica/jira/sync', { method: 'POST' })
  if (!res.ok) throw new Error(await parseError(res))
  const json = (await res.json()) as {
    data: {
      sync: { synced: number; notFound: string[]; errors: string[] }
      resumen: JiraStatusResumen
      items: DeudaTecnica[]
    }
  }
  return json.data
}

export async function createDeudaTecnicaApi(body: Partial<DeudaTecnica>): Promise<DeudaTecnica> {
  const res = await fetch('/api/it/deuda-tecnica', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const json = (await res.json()) as { data: DeudaTecnica }
  return json.data
}

export async function updateDeudaTecnicaApi(id: string, body: Partial<DeudaTecnica>): Promise<DeudaTecnica> {
  const res = await fetch(`/api/it/deuda-tecnica/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const json = (await res.json()) as { data: DeudaTecnica }
  return json.data
}

export async function deleteDeudaTecnicaApi(id: string): Promise<void> {
  const res = await fetch(`/api/it/deuda-tecnica/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function getJiraConfigITApi(): Promise<JiraConfigIT> {
  const res = await fetch('/api/it/deuda-tecnica/jira/config')
  if (!res.ok) throw new Error(await parseError(res))
  const json = (await res.json()) as { data: JiraConfigIT }
  return json.data
}

export async function getDeudaJiraSugerenciaApi(id: string): Promise<DeudaJiraSugerencia> {
  const res = await fetch(`/api/it/deuda-tecnica/${id}/jira/sugerencia`)
  if (!res.ok) throw new Error(await parseError(res))
  const json = (await res.json()) as { data: DeudaJiraSugerencia }
  return json.data
}

export async function createDeudaJiraIssueApi(
  id: string,
  body?: { summary?: string },
): Promise<{ deuda: DeudaTecnica; jira: { key: string; url: string } }> {
  const res = await fetch(`/api/it/deuda-tecnica/${id}/jira`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const json = (await res.json()) as {
    data: { deuda: DeudaTecnica; jira: { key: string; url: string } }
  }
  return json.data
}

export async function getApiEndpointsITApi(): Promise<ApiEndpointIT[]> {
  const res = await fetch('/api/it/endpoints')
  if (!res.ok) throw new Error(await parseError(res))
  const json = (await res.json()) as { data: ApiEndpointIT[] }
  return json.data
}

export async function createApiEndpointITApi(body: Partial<ApiEndpointIT>): Promise<ApiEndpointIT> {
  const res = await fetch('/api/it/endpoints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const json = (await res.json()) as { data: ApiEndpointIT }
  return json.data
}

export async function updateApiEndpointITApi(id: string, body: Partial<ApiEndpointIT>): Promise<ApiEndpointIT> {
  const res = await fetch(`/api/it/endpoints/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const json = (await res.json()) as { data: ApiEndpointIT }
  return json.data
}

export async function getChecklistItemsITApi(): Promise<ChecklistItemIT[]> {
  const res = await fetch('/api/it/checklist-items')
  if (!res.ok) throw new Error(await parseError(res))
  const json = (await res.json()) as { data: ChecklistItemIT[] }
  return json.data
}

export async function createChecklistItemITApi(body: Partial<ChecklistItemIT>): Promise<ChecklistItemIT> {
  const res = await fetch('/api/it/checklist-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const json = (await res.json()) as { data: ChecklistItemIT }
  return json.data
}
