const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
]

/** Orígenes permitidos para CORS (incluye APP_PUBLIC_URL y variante http/https). */
export function buildCorsOrigins(): string[] {
  const origins = new Set<string>(DEFAULT_CORS_ORIGINS)

  for (const part of (process.env.CORS_ORIGINS ?? '').split(',')) {
    const o = part.trim()
    if (o) origins.add(o)
  }

  const publicUrl = process.env.APP_PUBLIC_URL?.trim()
  if (publicUrl) {
    try {
      const u = new URL(publicUrl)
      origins.add(u.origin)
      const altScheme = u.protocol === 'https:' ? 'http:' : 'https:'
      origins.add(`${altScheme}//${u.host}`)
    } catch {
      /* URL inválida en APP_PUBLIC_URL */
    }
  }

  return [...origins]
}
