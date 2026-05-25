import type { ReactNode } from 'react'

import { Input } from '@/components/ui/input'
import { MAESTRO_SELECT_CLASS, type MaestroActivoFilter } from '@/lib/maestroList'

type Props = {
  busqueda: string
  onBusquedaChange: (value: string) => void
  busquedaPlaceholder?: string
  filterActivo?: MaestroActivoFilter
  onFilterActivoChange?: (value: MaestroActivoFilter) => void
  showActivoFilter?: boolean
  count: number
  total?: number
  countLabel?: string
  children?: ReactNode
}

export function MaestroListToolbar({
  busqueda,
  onBusquedaChange,
  busquedaPlaceholder = 'Buscar…',
  filterActivo = 'all',
  onFilterActivoChange,
  showActivoFilter = true,
  count,
  total,
  countLabel = 'registro(s)',
  children,
}: Props) {
  const totalCount = total ?? count

  return (
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">Buscar</label>
          <Input
            className="h-9 w-[220px] sm:w-[260px]"
            placeholder={busquedaPlaceholder}
            value={busqueda}
            onChange={(e) => onBusquedaChange(e.target.value)}
          />
        </div>
        {showActivoFilter && onFilterActivoChange && (
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Estado</label>
            <select
              className={MAESTRO_SELECT_CLASS + ' min-w-[140px]'}
              value={filterActivo}
              onChange={(e) => onFilterActivoChange(e.target.value as MaestroActivoFilter)}
            >
              <option value="all">Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
            </select>
          </div>
        )}
        {children}
      </div>
      <span className="pb-0.5 text-sm text-muted-foreground">
        {count === totalCount ? (
          <>
            {count} {countLabel}
          </>
        ) : (
          <>
            {count} de {totalCount} {countLabel}
          </>
        )}
      </span>
    </div>
  )
}
