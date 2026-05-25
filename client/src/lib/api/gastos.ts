import type {
  GastosContexto,
  GastosDepartamentoOpcion,
  GastosFinancieroPayload,
  GastosOpexPayload,
  GastosUltimoSync,
} from '@/types/gastos'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

function withDept(url: string, departamentoId?: string | null): string {
  if (!departamentoId) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}departamento_id=${encodeURIComponent(departamentoId)}`
}

export async function fetchGastosDepartamentos(): Promise<GastosDepartamentoOpcion[]> {
  const res = await fetch('/api/gastos/departamentos')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<GastosDepartamentoOpcion[]>
}

export async function fetchGastosOpex(departamentoId?: string | null): Promise<GastosOpexPayload> {
  const res = await fetch(withDept('/api/gastos/opex', departamentoId))
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<GastosOpexPayload>
}

export async function fetchGastosFinanciero(
  departamentoId?: string | null,
): Promise<GastosFinancieroPayload> {
  const res = await fetch(withDept('/api/gastos/financiero', departamentoId))
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<GastosFinancieroPayload>
}

export type GastosDiagHoja = {
  nombre: string
  esFinanciera: boolean
  esOpex: boolean
  cabeceras: string[]
  filas: number
}

export type GastosDiagnostico = {
  archivoExiste: boolean
  hojas: GastosDiagHoja[]
  error?: string
  contexto?: GastosContexto
}

export async function fetchGastosDiagnostico(
  departamentoId?: string | null,
): Promise<GastosDiagnostico> {
  const res = await fetch(withDept('/api/gastos/diagnostico', departamentoId))
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<GastosDiagnostico>
}

export async function fetchGastosUltimoSync(
  departamentoId?: string | null,
): Promise<GastosUltimoSync> {
  const res = await fetch(withDept('/api/gastos/ultimo-sync', departamentoId))
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<GastosUltimoSync>
}

export async function postGastosAnalizarOpexIA(
  params?: { departamento_id?: string },
): Promise<{ ok: boolean; analisis: string; generadoEn: string }> {
  const qs = params?.departamento_id
    ? `?departamento_id=${encodeURIComponent(params.departamento_id)}`
    : ''
  const r = await fetch(`/api/gastos/analizar-opex-ia${qs}`, { method: 'POST' })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? 'Error al analizar gastos')
  }
  return r.json() as Promise<{ ok: boolean; analisis: string; generadoEn: string }>
}

export async function postGastosSync(departamentoId?: string | null): Promise<{
  syncAt: string
  contexto: GastosContexto
  opex: GastosOpexPayload
  financiero: GastosFinancieroPayload
}> {
  const res = await fetch(withDept('/api/gastos/sync', departamentoId), { method: 'POST' })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{
    syncAt: string
    contexto: GastosContexto
    opex: GastosOpexPayload
    financiero: GastosFinancieroPayload
  }>
}
