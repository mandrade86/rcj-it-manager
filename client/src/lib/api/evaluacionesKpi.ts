import type {
  EvaluacionKpiDoc,
  EvaluacionKpiTemplate,
} from '@/types/evaluacionKpi'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchTemplateEvaluacionKpi(
  colaboradorId: string,
): Promise<EvaluacionKpiTemplate> {
  const res = await fetch(`/api/evaluaciones-kpi/template/${colaboradorId}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EvaluacionKpiTemplate>
}

export async function fetchEvaluacionesKpiPorColaborador(
  colaboradorId: string,
  tipo?: 'autoevaluacion' | 'jefe',
): Promise<EvaluacionKpiDoc[]> {
  const q = tipo ? `?tipo=${encodeURIComponent(tipo)}` : ''
  const res = await fetch(`/api/evaluaciones-kpi/colaborador/${colaboradorId}${q}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EvaluacionKpiDoc[]>
}

export async function fetchEvaluacionKpi(id: string): Promise<EvaluacionKpiDoc> {
  const res = await fetch(`/api/evaluaciones-kpi/${id}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EvaluacionKpiDoc>
}

export async function createEvaluacionKpi(
  body: Partial<EvaluacionKpiDoc>,
): Promise<EvaluacionKpiDoc> {
  const res = await fetch('/api/evaluaciones-kpi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EvaluacionKpiDoc>
}

export async function updateEvaluacionKpi(
  id: string,
  body: Partial<EvaluacionKpiDoc>,
): Promise<EvaluacionKpiDoc> {
  const res = await fetch(`/api/evaluaciones-kpi/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EvaluacionKpiDoc>
}

export async function deleteEvaluacionKpi(id: string): Promise<void> {
  const res = await fetch(`/api/evaluaciones-kpi/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseError(res))
}
