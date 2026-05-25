import type { DashboardResumen } from '@/types/dashboard'

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
