/** Día calendario `YYYY-MM-DD` (hora local). */
export function isoDia(value: string | Date | null | undefined): string {
  if (!value) return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    const p = (n: number) => String(n).padStart(2, '0')
    return `${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())}`
  }
  const m = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return m?.[1] ?? ''
}

export function hoyIso(): string {
  return isoDia(new Date())
}

/** Suma días de calendario a una fecha ISO (puede ser negativo). */
export function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  dt.setDate(dt.getDate() + dias)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

/** Días inclusivos entre inicio y fin. 1 si ambas fechas son el mismo día. */
export function diasEntre(inicio: string, fin: string): number {
  const a = inicio.split('-').map(Number)
  const b = fin.split('-').map(Number)
  const da = new Date(a[0] ?? 1970, (a[1] ?? 1) - 1, a[2] ?? 1)
  const db = new Date(b[0] ?? 1970, (b[1] ?? 1) - 1, b[2] ?? 1)
  return Math.round((db.getTime() - da.getTime()) / 86_400_000) + 1
}

export function finDesdeDuracion(inicio: string, duracionDias: number): string {
  return sumarDias(inicio, Math.max(1, Math.floor(duracionDias)) - 1)
}
