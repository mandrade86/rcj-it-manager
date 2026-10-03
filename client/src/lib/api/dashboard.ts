import type { DashboardResumen } from '@/types/dashboard'
import type { ResumenDepartamento } from '@/types/resumenDepartamento'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchDashboardResumen(): Promise<DashboardResumen> {
  const res = await fetch('/api/dashboard/resumen')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<DashboardResumen>
}

export type MiDiaTarea = {
  _id: string
  nombre: string
  proyecto_id: string
  proyecto_nombre: string
  responsable: string
  responsable_id: string
  fecha_fin: string | null
  estado: string
  prioridad: string | null
  porcentaje: number
}

export type MiDiaAprobacion = {
  _id: string
  titulo: string
  detalle: string
  href: string
}

export type MiDiaResumen = {
  vencidas: MiDiaTarea[]
  hoy: MiDiaTarea[]
  proximas: MiDiaTarea[]
  completadas: MiDiaTarea[]
  aprobaciones?: MiDiaAprobacion[]
}

export async function fetchMiDia(): Promise<MiDiaResumen> {
  const res = await fetch('/api/dashboard/mi-dia')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<MiDiaResumen>
}

export async function fetchResumenDepartamento(
  departamentoId?: string,
): Promise<ResumenDepartamento> {
  const q = departamentoId ? `?departamento_id=${encodeURIComponent(departamentoId)}` : ''
  const res = await fetch(`/api/dashboard/resumen-departamento${q}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<ResumenDepartamento>
}
