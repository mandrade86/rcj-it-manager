/** Día calendario `YYYY-MM-DD`. */
export function isoDia(value: unknown): string {
  if (!value) return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    const p = (n: number) => String(n).padStart(2, '0')
    return `${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())}`
  }
  const m = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return m?.[1] ?? ''
}

function hoyIso(): string {
  return isoDia(new Date())
}

function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  dt.setDate(dt.getDate() + dias)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

function diasEntre(inicio: string, fin: string): number {
  const a = inicio.split('-').map(Number)
  const b = fin.split('-').map(Number)
  const da = new Date(a[0] ?? 1970, (a[1] ?? 1) - 1, a[2] ?? 1)
  const db = new Date(b[0] ?? 1970, (b[1] ?? 1) - 1, b[2] ?? 1)
  return Math.round((db.getTime() - da.getTime()) / 86_400_000) + 1
}

function alMediodia(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

/**
 * Al crear una tarea: el inicio sale del proyecto si no viene en el cuerpo.
 * La duración (días inclusivos) calcula el fin, o el rango calcula la duración.
 */
export function aplicarFechasAlCrear(
  body: Record<string, unknown>,
  inicioProyecto: unknown,
): void {
  const durRaw = body.duracion_dias
  const duracion = typeof durRaw === 'number'
    ? Math.floor(durRaw)
    : typeof durRaw === 'string' && durRaw.trim()
      ? Math.floor(Number(durRaw))
      : NaN

  const inicio = isoDia(body.fecha_inicio) || isoDia(inicioProyecto) || hoyIso()
  body.fecha_inicio = alMediodia(inicio)

  const fin = isoDia(body.fecha_fin)
  if (fin) {
    body.fecha_fin = alMediodia(fin)
    body.duracion_dias = Math.max(1, diasEntre(inicio, fin))
    return
  }
  if (Number.isFinite(duracion) && duracion >= 1) {
    body.duracion_dias = duracion
    body.fecha_fin = alMediodia(sumarDias(inicio, duracion - 1))
    return
  }
  delete body.duracion_dias
}

