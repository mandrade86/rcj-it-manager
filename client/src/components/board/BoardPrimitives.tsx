import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Paleta tablero estilo Monday, con colores corporativos RCJ.
 * Estructura Monday (grupos, pills, filas) + identidad RCJ (navy / lime / ejes).
 */
export const BOARD = {
  bg: '#f8f9fa',
  card: '#ffffff',
  border: '#e0e4e8',
  borderSoft: '#f1f3f5',
  text: '#1a1a2e',
  muted: '#6b7280',
  /** Navy RCJ — acciones principales y foco */
  primary: '#002060',
  primaryHover: '#001848',
  /** Lime RCJ — éxito / listo */
  accent: '#70ad47',
  accentSoft: '#eaf5d9',
  /** En curso (tono soft / ámbar RCJ) */
  orange: '#c9a227',
  green: '#70ad47',
  /** Seguridad / bloqueado */
  red: '#c00000',
  gray: '#9ca3af',
  /** Infra — avatares / info */
  blue: '#1f4e79',
  /** Gobierno IT — prioridad media */
  indigo: '#4527a0',
  /** Prioridad alta = navy */
  purple: '#002060',
  hover: '#dce6f1',
  selected: '#eaf5d9',
} as const

export function BoardShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('space-y-3 rounded-lg border p-3', className)}
      style={{ backgroundColor: BOARD.bg, borderColor: BOARD.border }}
    >
      {children}
    </div>
  )
}

export function BoardToolbar({
  left,
  right,
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar',
  filterSlot,
}: {
  left?: ReactNode
  right?: ReactNode
  search?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
  filterSlot?: ReactNode
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 py-1"
    >
      {left}
      {onSearchChange != null && (
        <div className="relative min-w-[160px] max-w-xs flex-1">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2"
            style={{ color: BOARD.muted }}
          />
          <Input
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 bg-white pl-8 text-xs"
            style={{ borderColor: '#c5c7d0' }}
          />
        </div>
      )}
      {filterSlot}
      {right != null && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  )
}

export function BoardPill({
  label,
  bg,
  text = '#ffffff',
  className,
}: {
  label: string
  bg: string
  text?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[72px] items-center justify-center rounded-sm px-2 py-1 text-[11px] font-semibold tracking-wide',
        className,
      )}
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  )
}

export function BoardAvatar({
  name,
  className,
}: {
  name?: string | null
  className?: string
}) {
  const initials = (() => {
    if (!name?.trim()) return '?'
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  })()
  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white',
        className,
      )}
      style={{ backgroundColor: BOARD.blue }}
      title={name ?? undefined}
    >
      {initials}
    </span>
  )
}

export function BoardDistBar({
  items,
}: {
  items: Array<{ key: string; count: number; color: string }>
}) {
  const total = items.reduce((s, i) => s + i.count, 0)
  if (total === 0) {
    return <div className="h-2 w-full rounded-full" style={{ backgroundColor: BOARD.borderSoft }} />
  }
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full"
      style={{ backgroundColor: BOARD.borderSoft }}
    >
      {items
        .filter((i) => i.count > 0)
        .map((i) => (
          <div
            key={i.key}
            className="h-full"
            style={{ width: `${(i.count / total) * 100}%`, backgroundColor: i.color }}
            title={`${i.key}: ${i.count}`}
          />
        ))}
    </div>
  )
}

export function BoardGroup({
  label,
  color,
  count,
  defaultOpen = true,
  children,
  summary,
}: {
  label: string
  color: string
  count: number
  defaultOpen?: boolean
  children: ReactNode
  summary?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section
      className="overflow-hidden rounded-md border bg-white shadow-sm"
      style={{ borderColor: BOARD.border }}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--blue-lt)]/60"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <ChevronDown className="size-4" style={{ color: BOARD.text }} />
        ) : (
          <ChevronRight className="size-4" style={{ color: BOARD.text }} />
        )}
        <span className="inline-block size-3 rounded-sm" style={{ backgroundColor: color }} />
        <span className="text-sm font-bold" style={{ color: BOARD.text }}>
          {label}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: BOARD.borderSoft, color: BOARD.text }}
        >
          {count}
        </span>
      </button>
      {open && (
        <>
          <div className="overflow-x-auto border-t" style={{ borderColor: BOARD.borderSoft }}>
            {children}
          </div>
          {summary}
        </>
      )}
    </section>
  )
}

export function BoardTable({
  children,
  minWidth = '980px',
}: {
  children: ReactNode
  minWidth?: string
}) {
  return (
    <table className="w-full border-collapse text-left text-xs" style={{ minWidth }}>
      {children}
    </table>
  )
}

export function BoardTh({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <th
      className={cn(
        'px-2 py-2 text-[11px] font-medium uppercase tracking-wide',
        className,
      )}
      style={{ color: BOARD.muted, backgroundColor: BOARD.bg }}
    >
      {children}
    </th>
  )
}

export function BoardAddLink({
  onClick,
  label = 'Agregar',
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium hover:underline"
      style={{ color: BOARD.primary }}
      onClick={onClick}
    >
      + {label}
    </button>
  )
}

/** Fila «+ Agregar» estilo Monday: clic → input; Enter crea; Esc cancela. */
export function BoardQuickAdd({
  active,
  value,
  onChange,
  onSubmit,
  onCancel,
  onActivate,
  busy = false,
  color = BOARD.gray,
  label = 'Agregar tarea',
  placeholder = 'Nombre de la tarea…',
}: {
  active: boolean
  value: string
  onChange: (v: string) => void
  onSubmit: () => void | Promise<void>
  onCancel: () => void
  onActivate: () => void
  busy?: boolean
  color?: string
  label?: string
  placeholder?: string
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!active) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [active, busy])

  if (!active) {
    return <BoardAddLink onClick={onActivate} label={label} />
  }

  return (
    <form
      className="flex items-center gap-2 px-1 py-0.5"
      onSubmit={(e) => {
        e.preventDefault()
        void onSubmit()
      }}
    >
      <span
        className="inline-block h-7 w-1 shrink-0 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <input
        ref={inputRef}
        value={value}
        disabled={busy}
        placeholder={placeholder}
        className="h-8 min-w-0 flex-1 rounded-md border bg-white px-2 text-[13px] outline-none focus-visible:border-[var(--navy)] focus-visible:ring-2 focus-visible:ring-[var(--navy)]/20"
        style={{ borderColor: BOARD.border, color: BOARD.text }}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        onBlur={() => {
          if (!value.trim() && !busy) onCancel()
        }}
      />
      <button
        type="submit"
        disabled={busy || !value.trim()}
        className="h-8 shrink-0 rounded-md px-3 text-xs font-semibold text-white disabled:opacity-40"
        style={{ backgroundColor: BOARD.primary }}
        onMouseDown={(e) => e.preventDefault()}
      >
        {busy ? '…' : 'Agregar'}
      </button>
    </form>
  )
}

export function formatBoardDateShort(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-HN', { month: 'short', day: 'numeric' }).replace('.', '')
}

export function formatBoardRelative(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs} h`
  const days = Math.floor(hrs / 24)
  if (days < 14) return `hace ${days} d`
  return d.toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
