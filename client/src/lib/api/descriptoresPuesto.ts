export type DescriptorPuestoDoc = {
  _id?: string
  codigo_puesto: string
  titulo: string
  reporta_a: string
  objetivo: string
  requisitos: string[]
  autoridad: string[]
  responsabilidades: string[]
  educacion: string
  experiencia: string
  competencias: string[]
  notas: string
  createdAt?: string
  updatedAt?: string
}

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; detalle?: string }
    return j.error ?? j.detalle ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchDescriptorPuesto(
  codigo_puesto: string,
): Promise<DescriptorPuestoDoc | null> {
  const res = await fetch(`/api/descriptores-puesto/${encodeURIComponent(codigo_puesto)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<DescriptorPuestoDoc>
}

export async function updateDescriptorPuesto(
  codigo_puesto: string,
  body: Omit<DescriptorPuestoDoc, '_id' | 'codigo_puesto' | 'createdAt' | 'updatedAt'>,
): Promise<DescriptorPuestoDoc> {
  const res = await fetch(`/api/descriptores-puesto/${encodeURIComponent(codigo_puesto)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<DescriptorPuestoDoc>
}
