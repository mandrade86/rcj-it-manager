import { afterEach, describe, expect, it } from 'vitest'
import { buildCorsOrigins } from './corsOrigins.js'

describe('buildCorsOrigins', () => {
  const prevCors = process.env.CORS_ORIGINS
  const prevPublic = process.env.APP_PUBLIC_URL

  afterEach(() => {
    if (prevCors === undefined) delete process.env.CORS_ORIGINS
    else process.env.CORS_ORIGINS = prevCors
    if (prevPublic === undefined) delete process.env.APP_PUBLIC_URL
    else process.env.APP_PUBLIC_URL = prevPublic
  })

  it('incluye orígenes por defecto del portal y bot', () => {
    delete process.env.CORS_ORIGINS
    delete process.env.APP_PUBLIC_URL
    const origins = buildCorsOrigins()
    expect(origins).toContain('https://portal.rcjcorp.hn')
    expect(origins).toContain('https://dev-bot.rcjcorp.hn')
    expect(origins).toContain('http://localhost:5173')
  })

  it('agrega CORS_ORIGINS y APP_PUBLIC_URL (http + https)', () => {
    process.env.CORS_ORIGINS = 'https://portal-dev.rcjcorp.hn'
    process.env.APP_PUBLIC_URL = 'https://portal-dev.rcjcorp.hn'
    const origins = buildCorsOrigins()
    expect(origins).toContain('https://portal-dev.rcjcorp.hn')
    expect(origins).toContain('http://portal-dev.rcjcorp.hn')
  })
})
