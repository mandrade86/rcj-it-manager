export type EticketServicioItem = {
  externalId: string
  ticketNumber?: string
  source?: string
  sourceUrl?: string
  type?: string
  title: string
  descriptionHtml?: string
  descriptionText?: string
  status?: string
  priority?: string
  system?: string
  department?: string
  requesterEmail?: string
  requesterName?: string
  assigneeEmail?: string
  tags?: string[]
  authorizationStatus?: string | null
  developmentAdminApproval?: string | null
  form?: {
    formId?: string
    template?: string
    systemName?: string
    ownerEmail?: string
    ownerName?: string
  } | null
  createdAt?: string
  updatedAt?: string
  markedAt?: string
  markedBy?: string
  importStatus?: string
}

export type EticketListResponse = {
  items: EticketServicioItem[]
  total: number
}

function baseUrl(): string {
  return (process.env.ETICKET_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
}

function apiKey(): string {
  return (process.env.ETICKET_API_KEY ?? '').trim()
}

export function isEticketConfigured(): boolean {
  return Boolean(baseUrl() && apiKey())
}

export function eticketConfigPublic(): {
  configurado: boolean
  base_url: string
  tiene_key: boolean
} {
  const base = baseUrl()
  return {
    configurado: Boolean(base && apiKey()),
    base_url: base || '(vacío)',
    tiene_key: Boolean(apiKey()),
  }
}

function authHeaders(): Record<string, string> {
  const key = apiKey()
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-API-Key': key,
    Authorization: `Bearer ${key}`,
  }
}

function withTimeout(ms: number): AbortSignal {
  const ctrl = new AbortController()
  setTimeout(() => ctrl.abort(), ms).unref?.()
  return ctrl.signal
}

/** Rutas candidatas: algunos deploys montan el API en /api. */
function candidatePaths(path: string): string[] {
  const p = path.startsWith('/') ? path : `/${path}`
  const root = baseUrl()
  if (/\/api$/i.test(root)) return [p]
  return [p, `/api${p}`]
}

async function eticketFetch(path: string, init?: RequestInit): Promise<Response> {
  const root = baseUrl()
  if (!root) throw new Error('ETICKET_API_BASE_URL no configurada en el .env del servidor')
  if (!apiKey()) throw new Error('ETICKET_API_KEY no configurada en el .env del servidor')
  if (typeof fetch !== 'function') {
    throw new Error('Node no tiene fetch global (necesita Node 18+). Actualiza Node en el servidor.')
  }

  const paths = candidatePaths(path)
  let lastErr: Error | null = null

  for (const p of paths) {
    const url = `${root}${p}`
    try {
      console.log(`[eticket] ${init?.method ?? 'GET'} ${url}`)
      const res = await fetch(url, {
        ...init,
        headers: { ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) },
        signal: withTimeout(30_000),
      })
      if (res.status === 404 && paths.length > 1 && p === paths[0]) {
        console.warn(`[eticket] 404 en ${url}, probando variante /api`)
        continue
      }
      return res
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const hint = /abort/i.test(msg)
        ? 'timeout 30s'
        : /ENOTFOUND|ECONNREFUSED|cert|SSL|TLS/i.test(msg)
          ? 'red/DNS/certificado'
          : 'red'
      lastErr = new Error(`No se pudo conectar a eTicket (${url}) [${hint}]: ${msg}`)
      console.error('[eticket]', lastErr.message)
    }
  }
  throw lastErr ?? new Error('No se pudo conectar a eTicket')
}

/** GET /integrations/it-manager/services?status=pending|imported|all */
export async function fetchEticketServicios(
  status: 'pending' | 'imported' | 'all' = 'pending',
): Promise<EticketListResponse> {
  const q = status === 'all' ? 'all' : status
  const res = await eticketFetch(`/integrations/it-manager/services?status=${encodeURIComponent(q)}`)
  if (res.status === 401 || res.status === 403) {
    throw new Error(`eTicket rechazó la API key (${res.status}). Revisa ETICKET_API_KEY.`)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`eTicket GET services → ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = (await res.json()) as EticketListResponse | EticketServicioItem[]
  if (Array.isArray(data)) {
    return { items: data, total: data.length }
  }
  return {
    items: Array.isArray(data.items) ? data.items : [],
    total: typeof data.total === 'number' ? data.total : (data.items?.length ?? 0),
  }
}

/**
 * POST /integrations/it-manager/services/{id}/imported
 * 409 = ya importado (idempotente para el portal).
 */
export async function ackEticketImported(
  externalId: string,
  remoteServiceId: string,
  importedBy = 'it-rcj-manager',
): Promise<{ ok: boolean; already: boolean }> {
  const res = await eticketFetch(
    `/integrations/it-manager/services/${encodeURIComponent(externalId)}/imported`,
    {
      method: 'POST',
      body: JSON.stringify({ remoteServiceId, importedBy }),
    },
  )
  if (res.status === 409) return { ok: true, already: true }
  if (res.status === 401 || res.status === 403) {
    throw new Error(`eTicket rechazó la API key (${res.status}) al confirmar import`)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`eTicket POST imported → ${res.status}: ${text.slice(0, 300)}`)
  }
  return { ok: true, already: false }
}

/** Prueba de conectividad (sin importar). */
export async function diagnosticarEticket(): Promise<Record<string, unknown>> {
  const cfg = eticketConfigPublic()
  if (!cfg.configurado) {
    return { ...cfg, ok: false, error: 'Faltan ETICKET_API_BASE_URL o ETICKET_API_KEY en el servidor' }
  }
  try {
    const list = await fetchEticketServicios('pending')
    return {
      ...cfg,
      ok: true,
      pending: list.total,
      sample: list.items.slice(0, 3).map((i) => ({
        externalId: i.externalId,
        ticketNumber: i.ticketNumber,
        title: i.title,
      })),
    }
  } catch (e) {
    return {
      ...cfg,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
