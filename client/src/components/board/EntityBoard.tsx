import { useMemo, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  BOARD,
  BoardDistBar,
  BoardGroup,
  BoardShell,
  BoardTable,
  BoardTh,
  BoardToolbar,
} from '@/components/board/BoardPrimitives'
import { cn } from '@/lib/utils'

export type EntityBoardColumn<T> = {
  id: string
  label: string
  className?: string
  align?: 'left' | 'right'
  render: (row: T) => ReactNode
}

export type EntityBoardGroupDef<T> = {
  id: string
  label: string
  color: string
  match: (row: T) => boolean
}

type Props<T extends { _id: string }> = {
  rows: T[]
  columns: EntityBoardColumn<T>[]
  /** Si se omite, un solo grupo "Todos". */
  groups?: EntityBoardGroupDef<T>[]
  searchTexts?: (row: T) => Array<string | null | undefined>
  toolbarLeft?: ReactNode
  emptyMessage?: string
  minWidth?: string
  onRowClick?: (row: T) => void
  hideEmptyGroups?: boolean
  countLabel?: string
}

const DEFAULT_GROUPS: EntityBoardGroupDef<{ _id: string; activo?: boolean }>[] = [
  {
    id: 'activos',
    label: 'Activos',
    color: BOARD.green,
    match: (r) => r.activo !== false,
  },
  {
    id: 'inactivos',
    label: 'Inactivos',
    color: BOARD.gray,
    match: (r) => r.activo === false,
  },
]

export function EntityBoard<T extends { _id: string }>({
  rows,
  columns,
  groups,
  searchTexts,
  toolbarLeft,
  emptyMessage = 'No hay registros para mostrar.',
  minWidth = '860px',
  onRowClick,
  hideEmptyGroups = true,
  countLabel = 'registro',
}: Props<T>) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      const texts = searchTexts?.(row) ?? []
      return texts.some((t) => String(t ?? '').toLowerCase().includes(q))
    })
  }, [rows, busqueda, searchTexts])

  const groupDefs = (groups ?? DEFAULT_GROUPS) as EntityBoardGroupDef<T>[]

  if (rows.length === 0) {
    return (
      <BoardShell>
        <p
          className="rounded-md border border-dashed bg-white px-4 py-10 text-center text-sm"
          style={{ color: BOARD.muted, borderColor: BOARD.border }}
        >
          {emptyMessage}
        </p>
      </BoardShell>
    )
  }

  return (
    <BoardShell>
      <BoardToolbar
        search={busqueda}
        onSearchChange={setBusqueda}
        left={toolbarLeft}
        filterSlot={<span />}
        right={
          <span className="text-xs" style={{ color: BOARD.muted }}>
            {filtrados.length} {countLabel}
            {filtrados.length === 1 ? '' : 's'}
          </span>
        }
      />

      {filtrados.length === 0 ? (
        <p
          className="rounded-md border border-dashed bg-white px-4 py-8 text-center text-sm"
          style={{ color: BOARD.muted, borderColor: BOARD.border }}
        >
          Ningún resultado para la búsqueda.
        </p>
      ) : (
        groupDefs.map((g) => {
          const list = filtrados.filter((r) => g.match(r))
          if (hideEmptyGroups && list.length === 0) return null
          return (
            <BoardGroup
              key={g.id}
              label={g.label}
              color={g.color}
              count={list.length}
              summary={
                <div
                  className="flex items-center gap-3 border-t px-3 py-2 text-[11px]"
                  style={{
                    backgroundColor: BOARD.bg,
                    borderColor: BOARD.borderSoft,
                    color: BOARD.muted,
                  }}
                >
                  <span>
                    {list.length} ítem{list.length === 1 ? '' : 's'}
                  </span>
                  <div className="w-28">
                    <BoardDistBar
                      items={[{ key: g.label, count: list.length, color: g.color }]}
                    />
                  </div>
                </div>
              }
            >
              <BoardTable minWidth={minWidth}>
                <thead>
                  <tr className="border-b" style={{ borderColor: BOARD.borderSoft }}>
                    <BoardTh className="w-8" />
                    {columns.map((c) => (
                      <BoardTh
                        key={c.id}
                        className={cn(c.className, c.align === 'right' && 'text-right')}
                      >
                        {c.label}
                      </BoardTh>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((row) => (
                    <tr
                      key={row._id}
                      className={cn(
                        'border-b transition-colors hover:bg-[var(--blue-lt)]/70',
                        onRowClick && 'cursor-pointer',
                      )}
                      style={{ borderColor: BOARD.borderSoft }}
                      onClick={() => onRowClick?.(row)}
                    >
                      <td className="px-2 py-1.5">
                        <span
                          className="inline-block h-8 w-1 rounded-sm"
                          style={{ backgroundColor: g.color }}
                        />
                      </td>
                      {columns.map((c) => (
                        <td
                          key={c.id}
                          className={cn(
                            'px-2 py-1.5 align-middle',
                            c.align === 'right' && 'text-right',
                            c.className,
                          )}
                          style={{ color: BOARD.text }}
                          onClick={(e) => {
                            // allow buttons inside cells without row navigation conflict
                            if ((e.target as HTMLElement).closest('button, a, input, select')) {
                              e.stopPropagation()
                            }
                          }}
                        >
                          {c.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </BoardTable>
            </BoardGroup>
          )
        })
      )}
    </BoardShell>
  )
}

/** Botón primario del tablero (lime RCJ sobre navy). */
export function BoardPrimaryButton({
  children,
  onClick,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <Button
      type="button"
      size="sm"
      className={cn(
        'gap-1 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export { BOARD, BoardPill, BoardAvatar } from '@/components/board/BoardPrimitives'
