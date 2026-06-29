const MAX_TAGS = 20
const MAX_TAG_LEN = 40

/** Normaliza etiquetas: trim, dedupe case-insensitive, límite de cantidad y longitud. */
export function normalizeTareaTags(raw: unknown): string[] {
  const items: string[] = []
  if (Array.isArray(raw)) {
    for (const x of raw) {
      if (typeof x === 'string') items.push(x)
    }
  } else if (typeof raw === 'string') {
    items.push(...raw.split(/[,;]+/))
  }

  const seen = new Set<string>()
  const out: string[] = []
  for (const t of items) {
    const s = t.trim().slice(0, MAX_TAG_LEN)
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
    if (out.length >= MAX_TAGS) break
  }
  return out
}

export function parseTagsFromExcel(raw: unknown): string[] {
  if (raw == null || raw === '') return []
  return normalizeTareaTags(String(raw))
}
