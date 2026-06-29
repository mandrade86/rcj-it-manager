const TAG_PALETTE = [
  'border-[#1F4E79]/30 bg-[#DCE6F1] text-[#1F4E79]',
  'border-[#70AD47]/40 bg-[#EAF5D9] text-[#375623]',
  'border-[#4527A0]/30 bg-[#EDE7F6] text-[#4527A0]',
  'border-[#C00000]/25 bg-[#FCE8E8] text-[#C00000]',
  'border-[#7F6000]/30 bg-[#FFF8E1] text-[#7F6000]',
  'border-[#0F6E56]/30 bg-[#E0F2EF] text-[#0F6E56]',
] as const

export const MAX_TAREA_TAGS = 20

export function normalizeTareaTags(raw: string[] | string | undefined): string[] {
  const items = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[,;]+/)
      : []

  const seen = new Set<string>()
  const out: string[] = []
  for (const t of items) {
    const s = t.trim().slice(0, 40)
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
    if (out.length >= MAX_TAREA_TAGS) break
  }
  return out
}

export function collectTagsFromTareas(tareas: { tags?: string[] | null }[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of tareas) {
    for (const tag of t.tags ?? []) {
      const key = tag.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(tag)
    }
  }
  return out.sort((a, b) => a.localeCompare(b, 'es'))
}

function hashTag(tag: string): number {
  let h = 0
  for (let i = 0; i < tag.length; i++) {
    h = (h * 31 + tag.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function tareaTagClass(tag: string): string {
  return TAG_PALETTE[hashTag(tag.toLowerCase()) % TAG_PALETTE.length]!
}
