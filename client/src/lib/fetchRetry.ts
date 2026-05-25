const RETRY_STATUS = new Set([502, 503, 504])

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: { retries?: number; delayMs?: number },
): Promise<Response> {
  const retries = opts?.retries ?? 2
  const delayMs = opts?.delayMs ?? 800
  let lastRes: Response | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init)
      if (!RETRY_STATUS.has(res.status) || attempt === retries) {
        return res
      }
      lastRes = res
    } catch (err) {
      if (attempt === retries) throw err
    }
    await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)))
  }

  return lastRes ?? fetch(input, init)
}

export function isServerUnavailableError(ex: unknown): boolean {
  if (!(ex instanceof Error)) return false
  const m = ex.message.toLowerCase()
  return (
    m.includes('502') ||
    m.includes('503') ||
    m.includes('504') ||
    m.includes('bad gateway') ||
    m.includes('failed to fetch') ||
    m.includes('network')
  )
}

export function mensajeServidorNoDisponible(): string {
  return 'El servidor no respondió (puede estar reiniciando). Espera unos segundos e intenta de nuevo.'
}
