async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; detalle?: string }
    return j.error ?? j.detalle ?? res.statusText
  } catch {
    return res.statusText
  }
}

export type PlanCarreraItem = {
  _id?: string
  codigo?: string
  seccion?: string
  requisito: string
  tipo_requisito?: 'Indispensable' | 'Recomendado'
  plazo_estimado?: string
  recurso?: string
  estado?: 'Pendiente' | 'En progreso' | 'Completado'
  notas?: string
}

export type PlanCarreraDoc = {
  _id: string
  colaborador_id: string
  tipo: 'N2_a_Coord' | 'Jr_a_Mid' | 'Mid_a_Senior'
  fecha_inicio?: string
  periodo_estimado?: string
  responsable_seguimiento?: string
  items: PlanCarreraItem[]
}

export async function fetchPlanCarrera(
  colaboradorId: string,
): Promise<PlanCarreraDoc | null> {
  const res = await fetch(`/api/plan-carrera/${colaboradorId}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<PlanCarreraDoc | null>
}

export async function updatePlanCarreraItem(
  itemId: string,
  patch: { estado?: PlanCarreraItem['estado']; notas?: string },
): Promise<PlanCarreraDoc> {
  const body: Record<string, string> = {}
  if (patch.estado !== undefined) body.estado = patch.estado
  if (patch.notas !== undefined) body.notas = patch.notas
  const res = await fetch(`/api/plan-carrera/item/${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<PlanCarreraDoc>
}
