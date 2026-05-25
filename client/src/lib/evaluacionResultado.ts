const SCORES: Record<string, number> = {
  'No cumple': 1,
  'En desarrollo': 2,
  Cumple: 3,
  Supera: 4,
}

export type ResultadoGlobal = 'No cumple' | 'En desarrollo' | 'Cumple' | 'Supera'

export function calcularResultadoGlobal(
  criterios: { calificacion?: string | null }[],
): ResultadoGlobal {
  const vals = criterios
    .map((c) => SCORES[c.calificacion ?? ''] ?? 0)
    .filter((n) => n > 0)
  if (vals.length === 0) return 'En desarrollo'
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  if (avg < 1.75) return 'No cumple'
  if (avg < 2.75) return 'En desarrollo'
  if (avg < 3.75) return 'Cumple'
  return 'Supera'
}
