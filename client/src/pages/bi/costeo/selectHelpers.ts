/** Radix Select no permite SelectItem con value="" */
export function hasSelectValue(value: string | undefined | null): value is string {
  return Boolean(value?.trim())
}

/** Solo primera letra mayúscula (resto minúsculas). Útil para nombres SAP en MAYÚSCULAS. */
export function sentenceCase(value: string): string {
  const t = value.trim()
  if (!t) return value
  const lower = t.toLocaleLowerCase('es')
  return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1)
}
