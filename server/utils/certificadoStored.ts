/**
 * Valor persistido en MongoDB: solo nombre de archivo (ej. 1779725453215_foo.png).
 * Acepta datos legacy con prefijo /api/certificados/ o URLs absolutas locales.
 */
export function normalizeCertificadoStored(
  stored: string | null | undefined,
): string | undefined {
  if (!stored?.trim()) return undefined
  let s = stored.trim().replace(/\\/g, '/')

  if (s.startsWith('http://') || s.startsWith('https://')) {
    try {
      const u = new URL(s)
      const m = u.pathname.match(/\/api\/certificados\/(.+)$/i)
      if (m?.[1]) return decodeURIComponent(m[1])
    } catch {
      /* URL relativa o inválida */
    }
    return s
  }

  if (s.startsWith('/api/certificados/')) {
    s = s.slice('/api/certificados/'.length)
  } else {
    s = s.replace(/^\/+/, '').replace(/^api\/certificados\//i, '')
  }
  return s || undefined
}
