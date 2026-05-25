import { useMemo, useState } from 'react'
import { ArrowDownUp, ChevronDown, Filter, Search, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { PROYECTO_SORT_PRESETS } from '@/lib/proyectosList'
import { PROYECTO_ESTADOS } from '@/types/proyecto'

export type ProyectosFiltersState = {
  tipo: string
  estado: string
  prioridad: string
  eje: string
  fase: string
  departamento_id: string
  empresa_id: string
}

type Props = {
  filters: ProyectosFiltersState
  setFilters: (patch: Partial<ProyectosFiltersState>) => void
  busqueda: string
  setBusqueda: (v: string) => void
  sortPresetId: string
  onSortPreset: (presetId: string) => void
  displayCount: number
  totalCount: number
  ejesCatalogo: string[]
  empresasOptions: [string, string][]
  departamentosOptions: [string, string][]
  showDepartamentoFilter: boolean
}

const selectClass =
  'h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40'

function FilterField({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
  className?: string
}) {
  const id = `pf-${label.replace(/\s/g, '-')}`
  return (
    <div className={cn('grid gap-0.5', className)}>
      <label htmlFor={id} className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <select id={id} className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v || '_'} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  )
}

export function ProyectosFiltrosBar({
  filters,
  setFilters,
  busqueda,
  setBusqueda,
  sortPresetId,
  onSortPreset,
  displayCount,
  totalCount,
  ejesCatalogo,
  empresasOptions,
  departamentosOptions,
  showDepartamentoFilter,
}: Props) {
  const [open, setOpen] = useState(false)

  const activeChips = useMemo(() => {
    const chips: { key: keyof ProyectosFiltersState; label: string }[] = []
    if (filters.estado) chips.push({ key: 'estado', label: `Estado: ${filters.estado}` })
    if (filters.fase) chips.push({ key: 'fase', label: `Fase ${filters.fase}` })
    if (filters.eje) chips.push({ key: 'eje', label: `Eje: ${filters.eje}` })
    if (filters.prioridad) chips.push({ key: 'prioridad', label: `Prioridad: ${filters.prioridad}` })
    if (filters.tipo) {
      chips.push({
        key: 'tipo',
        label: filters.tipo === 'individual' ? 'Tipo: Individual' : 'Tipo: Departamental',
      })
    }
    if (filters.empresa_id) {
      const emp = empresasOptions.find(([id]) => id === filters.empresa_id)
      chips.push({ key: 'empresa_id', label: emp ? `Empresa: ${emp[1]}` : 'Empresa' })
    }
    if (filters.departamento_id) {
      const dep = departamentosOptions.find(([id]) => id === filters.departamento_id)
      chips.push({ key: 'departamento_id', label: dep ? `Depto: ${dep[1]}` : 'Departamento' })
    }
    return chips
  }, [filters, empresasOptions, departamentosOptions])

  const activeCount = activeChips.length + (busqueda.trim() ? 1 : 0)

  function clearAll() {
    setBusqueda('')
    setFilters({
      tipo: '',
      estado: '',
      prioridad: '',
      eje: '',
      fase: '',
      departamento_id: '',
      empresa_id: '',
    })
  }

  function clearChip(key: keyof ProyectosFiltersState) {
    setFilters({ [key]: '' })
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 p-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder="Buscar ID, nombre, responsable…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="relative">
          <ArrowDownUp className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <select
            className={cn(selectClass, 'h-8 w-[168px] pl-7')}
            value={sortPresetId}
            onChange={(e) => onSortPreset(e.target.value)}
            aria-label="Ordenar por"
          >
            {PROYECTO_SORT_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            {sortPresetId === 'custom' && <option value="custom">Personalizado</option>}
          </select>
        </div>

        <Button
          type="button"
          variant={open ? 'secondary' : 'outline'}
          size="sm"
          className="h-8 gap-1.5 shrink-0"
          onClick={() => setOpen((v) => !v)}
        >
          <Filter className="size-3.5" />
          Filtros
          {activeCount > 0 && (
            <Badge className="h-5 min-w-5 justify-center bg-[var(--lime)] px-1 text-[10px] text-[var(--navy)]">
              {activeCount}
            </Badge>
          )}
          <ChevronDown className={cn('size-3.5 transition', open && 'rotate-180')} />
        </Button>

        {activeCount > 0 && (
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clearAll}>
            Limpiar
          </Button>
        )}

        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
          {displayCount === totalCount
            ? `${displayCount} proyecto${displayCount === 1 ? '' : 's'}`
            : `${displayCount} de ${totalCount}`}
        </span>
      </div>

      {!open && activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border/60 px-2 py-1.5">
          {activeChips.map((c) => (
            <button
              key={c.key}
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--lime)]/40 bg-[var(--lime-lt)] px-2 py-0.5 text-[10px] font-medium text-[var(--navy)] hover:bg-[var(--lime-lt)]/80"
              onClick={() => clearChip(c.key)}
            >
              {c.label}
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="grid gap-2 border-t border-border bg-muted/20 p-2 sm:grid-cols-3 lg:grid-cols-6">
          <FilterField
            label="Estado"
            value={filters.estado}
            onChange={(v) => setFilters({ estado: v })}
            options={[['', 'Todos'], ...PROYECTO_ESTADOS.map((s) => [s, s] as [string, string])]}
          />
          <FilterField
            label="Fase"
            value={filters.fase}
            onChange={(v) => setFilters({ fase: v })}
            options={[
              ['', 'Todas'],
              ['1', 'Fase 1'],
              ['2', 'Fase 2'],
              ['3', 'Fase 3'],
            ]}
          />
          <FilterField
            label="Eje"
            value={filters.eje}
            onChange={(v) => setFilters({ eje: v })}
            options={[['', 'Todos'], ...ejesCatalogo.map((e) => [e, e] as [string, string])]}
          />
          <FilterField
            label="Prioridad"
            value={filters.prioridad}
            onChange={(v) => setFilters({ prioridad: v })}
            options={[
              ['', 'Todas'],
              ['Alta', 'Alta'],
              ['Media', 'Media'],
              ['Baja', 'Baja'],
            ]}
          />
          <FilterField
            label="Tipo"
            value={filters.tipo}
            onChange={(v) => setFilters({ tipo: v })}
            options={[
              ['', 'Todos'],
              ['individual', 'Individual'],
              ['departamental', 'Departamental'],
            ]}
          />
          <FilterField
            label="Empresa"
            value={filters.empresa_id}
            onChange={(v) => setFilters({ empresa_id: v })}
            options={[['', 'Todas'], ...empresasOptions]}
          />
          {showDepartamentoFilter && (
            <FilterField
              className="sm:col-span-2 lg:col-span-3"
              label="Departamento"
              value={filters.departamento_id}
              onChange={(v) => setFilters({ departamento_id: v })}
              options={[['', 'Todos los departamentos'], ...departamentosOptions]}
            />
          )}
        </div>
      )}
    </div>
  )
}
