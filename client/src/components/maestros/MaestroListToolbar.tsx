import type { ReactNode } from 'react'
import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { BOARD } from '@/components/board/BoardPrimitives'
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

/** Toolbar unificado estilo tablero (Monday) para todos los maestros. */
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
    <div
      className="flex flex-wrap items-center gap-2 rounded-md border bg-white px-3 py-2 shadow-sm"
      style={{ borderColor: BOARD.border }}
    >
      <div className="relative min-w-[180px] max-w-xs flex-1">
        <Search
          className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2"
          style={{ color: BOARD.muted }}
        />
        <Input
          className="h-8 bg-white pl-8 text-xs"
          style={{ borderColor: '#c5c7d0' }}
          placeholder={busquedaPlaceholder}
          value={busqueda}
          onChange={(e) => onBusquedaChange(e.target.value)}
        />
      </div>
      {showActivoFilter && onFilterActivoChange && (
        <select
          className={MAESTRO_SELECT_CLASS + ' h-8 min-w-[120px] text-xs'}
          value={filterActivo}
          onChange={(e) => onFilterActivoChange(e.target.value as MaestroActivoFilter)}
        >
          <option value="all">Todos</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
      )}
      {children}
      <span className="ml-auto text-xs" style={{ color: BOARD.muted }}>
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
