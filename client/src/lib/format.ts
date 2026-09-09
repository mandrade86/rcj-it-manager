export type MonedaDisplay = 'USD' | 'HNL'

export function formatUsd(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatLps(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return '—'
  const formatted = new Intl.NumberFormat('es-HN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
  return `Lps ${formatted}`
}

/** Formatea un monto según la moneda de la empresa (USD o Lempiras). */
export function formatMoney(value?: number | null, moneda: MonedaDisplay | string | null = 'USD'): string {
  if (value == null || Number.isNaN(value)) return '—'
  if (String(moneda).toUpperCase() === 'HNL') return formatLps(value)
  return formatUsd(value)
}

export function formatDateDMY(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-HN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
