export const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const

export function nombreMes(mes: number | null | undefined): string {
  if (mes == null || mes < 1 || mes > 12) return 'Sin mes'
  return MESES[mes - 1] ?? 'Sin mes'
}
