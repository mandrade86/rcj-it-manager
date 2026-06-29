import { useMemo, useState } from 'react'
import { X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MAX_TAREA_TAGS, normalizeTareaTags, tareaTagClass } from '@/lib/tareaTags'
import { cn } from '@/lib/utils'

type Props = {
  id?: string
  value: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  className?: string
}

export function TareaTagsInput({ id, value, onChange, suggestions = [], className }: Props) {
  const [draft, setDraft] = useState('')

  const sugerenciasFiltradas = useMemo(() => {
    const q = draft.trim().toLowerCase()
    const actuales = new Set(value.map((t) => t.toLowerCase()))
    return suggestions
      .filter((s) => !actuales.has(s.toLowerCase()))
      .filter((s) => !q || s.toLowerCase().includes(q))
      .slice(0, 8)
  }, [draft, suggestions, value])

  function addTag(raw: string) {
    const next = normalizeTareaTags([...value, raw])
    if (next.length === value.length) return
    onChange(next)
    setDraft('')
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t.toLowerCase() !== tag.toLowerCase()))
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (draft.trim()) addTag(draft)
    } else if (e.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={id}>Tags</Label>
      <div className="rounded-md border border-input bg-transparent px-2 py-2 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        {value.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {value.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className={cn('gap-1 pr-1 text-xs font-normal', tareaTagClass(tag))}
              >
                {tag}
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-black/10"
                  onClick={() => removeTag(tag)}
                  aria-label={`Quitar tag ${tag}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <Input
          id={id}
          value={draft}
          disabled={value.length >= MAX_TAREA_TAGS}
          placeholder={
            value.length >= MAX_TAREA_TAGS
              ? `Máximo ${MAX_TAREA_TAGS} tags`
              : 'Escribe y presiona Enter o coma…'
          }
          className="h-8 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (draft.trim()) addTag(draft)
          }}
        />
      </div>
      {sugerenciasFiltradas.length > 0 && draft.trim() && (
        <div className="flex flex-wrap gap-1.5">
          {sugerenciasFiltradas.map((s) => (
            <button
              key={s}
              type="button"
              className={cn(
                'rounded-full border px-2 py-0.5 text-xs hover:opacity-80',
                tareaTagClass(s),
              )}
              onClick={() => addTag(s)}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Etiquetas para filtrar y agrupar (ej. urgente, infra, fase-1). Máx. {MAX_TAREA_TAGS}.
      </p>
    </div>
  )
}
