export function formatLps(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return '—'
  const formatted = new Intl.NumberFormat('es-HN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
  return `Lps ${formatted}`
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
