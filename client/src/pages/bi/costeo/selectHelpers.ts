/** Radix Select no permite SelectItem con value="" */
export function hasSelectValue(value: string | undefined | null): value is string {
  return Boolean(value?.trim())
}
