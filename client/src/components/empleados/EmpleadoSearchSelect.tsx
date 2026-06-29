import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { EmpleadoDoc } from '@/types/empleado'

type Value = {
  responsable: string
  responsable_id: string
}

type Props = {
  id?: string
  empleados: EmpleadoDoc[]
  value: Value
  onChange: (value: Value) => void
  placeholder?: string
  className?: string
}

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

export function EmpleadoSearchSelect({
  id,
  empleados,
  value,
  onChange,
  placeholder = 'Buscar por nombre…',
  className,
}: Props) {
  const [query, setQuery] = useState(value.responsable)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(value.responsable)
  }, [value.responsable, value.responsable_id])

  const opciones = useMemo(() => {
    const q = norm(query.trim())
    const list = [...empleados].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    if (!q) return list.slice(0, 20)
    return list
      .filter((e) => {
        const hay = `${e.nombre} ${e.puesto ?? ''} ${e.codigo ?? ''}`
        return norm(hay).includes(q)
      })
      .slice(0, 20)
  }, [empleados, query])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function selectEmpleado(emp: EmpleadoDoc) {
    onChange({ responsable: emp.nombre, responsable_id: String(emp._id) })
    setQuery(emp.nombre)
    setOpen(false)
  }

  function clear() {
    onChange({ responsable: '', responsable_id: '' })
    setQuery('')
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, Math.max(0, opciones.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && open && opciones[highlight]) {
      e.preventDefault()
      selectEmpleado(opciones[highlight]!)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <div className="relative">
        <Input
          id={id}
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            const v = e.target.value
            setQuery(v)
            setOpen(true)
            setHighlight(0)
            if (!v.trim()) {
              onChange({ responsable: '', responsable_id: '' })
            } else if (value.responsable_id) {
              onChange({ responsable: v, responsable_id: '' })
            } else {
              onChange({ responsable: v, responsable_id: '' })
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="pr-16"
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2">
          {query && (
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={clear}
              tabIndex={-1}
              aria-label="Limpiar"
            >
              <X className="size-3.5" />
            </button>
          )}
          <ChevronDown className="size-4 text-muted-foreground" />
        </div>
      </div>

      {open && (
        <ul
          className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md"
          role="listbox"
        >
          {opciones.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Sin coincidencias. Puedes dejar el nombre escrito manualmente.
            </li>
          ) : (
            opciones.map((emp, i) => (
              <li key={String(emp._id)}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  className={cn(
                    'flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted',
                    i === highlight && 'bg-muted',
                    emp.activo === false && 'opacity-60',
                  )}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => selectEmpleado(emp)}
                >
                  <span className="font-medium">{emp.nombre}</span>
                  {(emp.puesto || emp.codigo) && (
                    <span className="text-xs text-muted-foreground">
                      {[emp.puesto, emp.codigo].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
