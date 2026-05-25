import type { EvaluacionDoc, RubricaTemplateItem } from '@/types/evaluacion'
import type { RubricaResolver } from '@/types/perfilPuesto'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; detalle?: string }
    return j.error ?? j.detalle ?? res.statusText
  } catch {
    return res.statusText
  }
}

/**
 * Resuelve la rúbrica aplicable a un colaborador.
 * El backend prefiere la rúbrica del PerfilPuesto vinculado; si no existe,
 * cae a la rúbrica legacy por código de puesto.
 */
export async function fetchRubricaColaborador(colaboradorId: string): Promise<RubricaResolver> {
  const res = await fetch(`/api/evaluaciones/rubrica-colaborador/${colaboradorId}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<RubricaResolver>
}

export async function fetchRubricaDesarrollo(): Promise<RubricaTemplateItem[]> {
  const res = await fetch('/api/evaluaciones/rubrica-desarrollo')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<RubricaTemplateItem[]>
}

export async function fetchRubricaPorPuesto(
  codigo_puesto: string,
): Promise<{ codigo_puesto: string; clave: string; criterios: RubricaTemplateItem[] }> {
  const res = await fetch(
    `/api/evaluaciones/rubrica/${encodeURIComponent(codigo_puesto)}`,
  )
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{
    codigo_puesto: string
    clave: string
    criterios: RubricaTemplateItem[]
  }>
}

export async function updateRubricaPorPuesto(
  codigo_puesto: string,
  criterios: RubricaTemplateItem[],
): Promise<{ codigo_puesto: string; clave: string; criterios: RubricaTemplateItem[] }> {
  const res = await fetch(
    `/api/evaluaciones/rubrica/${encodeURIComponent(codigo_puesto)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criterios }),
    },
  )
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{
    codigo_puesto: string
    clave: string
    criterios: RubricaTemplateItem[]
  }>
}

export async function fetchEvaluaciones(
  colaboradorId: string,
  tipo?: 'autoevaluacion' | 'jefe',
): Promise<EvaluacionDoc[]> {
  const q = new URLSearchParams({ colaborador_id: colaboradorId })
  if (tipo) q.set('tipo', tipo)
  const res = await fetch(`/api/evaluaciones?${q}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EvaluacionDoc[]>
}

export async function fetchEvaluacion(id: string): Promise<EvaluacionDoc> {
  const res = await fetch(`/api/evaluaciones/${id}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EvaluacionDoc>
}

export async function createEvaluacion(
  body: Record<string, unknown>,
): Promise<EvaluacionDoc> {
  const res = await fetch('/api/evaluaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EvaluacionDoc>
}

export async function updateEvaluacion(
  id: string,
  body: Record<string, unknown>,
): Promise<EvaluacionDoc> {
  const res = await fetch(`/api/evaluaciones/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EvaluacionDoc>
}
