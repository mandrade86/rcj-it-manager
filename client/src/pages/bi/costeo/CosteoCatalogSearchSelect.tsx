import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type CatalogOption = {
  value: string
  label: string
  code: string
}

type Props = {
  id?: string
  options: CatalogOption[]
  value: string
  allValue: string
  allLabel: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  hint?: string
  compact?: boolean
}

function matchesQuery(haystack: string, q: string): boolean {
  if (!q) return true
  return haystack
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .includes(
      q
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase(),
    )
}

/** Búsqueda unificada por código o nombre + selección en lista. */
export function CosteoCatalogSearchSelect({
  id,
  options,
  value,
  allValue,
  allLabel,
  onChange,
  placeholder = 'Buscar por código o nombre…',
  disabled,
  className,
  hint,
  compact,
}: Props) {
  const selected = options.find((o) => o.value === value)
  const [query, setQuery] = useState(
    value === allValue ? '' : selected ? `${selected.code} — ${selected.label}` : '',
  )
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value === allValue) {
      setQuery('')
      return
    }
    const opt = options.find((o) => o.value === value)
    if (opt) setQuery(`${opt.code} — ${opt.label}`)
  }, [value, options, allValue])

  const filtradas = useMemo(() => {
    const q = query.trim()
    // Si el query es exactamente la selección actual, mostrar catálogo completo
    if (
      selected &&
      q === `${selected.code} — ${selected.label}`
    ) {
      return options.slice(0, 80)
    }
    if (!q) return options.slice(0, 80)
    return options
      .filter((o) => matchesQuery(`${o.code} ${o.label}`, q))
      .slice(0, 80)
  }, [options, query, selected])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function selectOption(opt: CatalogOption | null) {
    if (!opt) {
      onChange(allValue)
      setQuery('')
    } else {
      onChange(opt.value)
      setQuery(`${opt.code} — ${opt.label}`)
    }
    setOpen(false)
  }

  function clear() {
    selectOption(null)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const list = [{ value: allValue, label: allLabel, code: '' } as CatalogOption, ...filtradas]
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, Math.max(0, list.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && open) {
      e.preventDefault()
      const item = list[highlight]
      if (item?.value === allValue) selectOption(null)
      else if (item) selectOption(item)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const listItems: Array<CatalogOption | { value: typeof allValue; label: string; code: '' }> = [
    { value: allValue, label: allLabel, code: '' },
    ...filtradas,
  ]

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <div className={cn('relative', compact ? 'mt-0.5' : 'mt-1')}>
        <Search
          className={cn(
            'absolute top-1/2 -translate-y-1/2 text-[var(--text-muted)]',
            compact ? 'left-2.5 size-3.5' : 'left-3 size-4',
          )}
        />
        <Input
          id={id}
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
          className={cn(compact ? 'h-8 pl-8 pr-14 text-xs' : 'pl-9 pr-16')}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setHighlight(0)
            if (value !== allValue) onChange(allValue)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-1.5">
          {query ? (
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={clear}
              tabIndex={-1}
              aria-label="Limpiar"
              disabled={disabled}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
          <ChevronDown className={cn('text-muted-foreground', compact ? 'size-3.5' : 'size-4')} />
        </div>
      </div>

      {open && !disabled ? (
        <ul
          className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md"
          role="listbox"
        >
          {listItems.length === 1 && filtradas.length === 0 && query.trim() ? (
            <li className="px-3 py-1.5 text-xs text-muted-foreground">Sin coincidencias</li>
          ) : null}
          {listItems.map((item, i) => (
            <li key={item.value === allValue ? allValue : item.value}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight || value === item.value}
                className={cn(
                  'flex w-full flex-col items-start px-2.5 py-1.5 text-left text-xs hover:bg-muted',
                  (i === highlight || value === item.value) && 'bg-muted',
                )}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => {
                  if (item.value === allValue) selectOption(null)
                  else selectOption(item as CatalogOption)
                }}
              >
                {item.value === allValue ? (
                  <span className="font-medium text-[var(--navy)]">{item.label}</span>
                ) : (
                  <>
                    <span className="font-medium leading-tight">{item.label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{item.code}</span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {hint ? <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{hint}</p> : null}
    </div>
  )
}
