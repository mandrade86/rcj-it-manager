import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  BOARD,
  BoardAvatar,
  BoardDistBar,
  BoardGroup,
  BoardPill,
  BoardShell,
  BoardTable,
  BoardTh,
  BoardToolbar,
  formatBoardDateShort,
} from '@/components/board/BoardPrimitives'
import { formatLps } from '@/lib/format'
import type { CapacitacionDoc, EstadoCap } from '@/types/capacitacion'
import { proveedorNombreFromCap } from '@/types/capacitacion'

type Props = {
  caps: CapacitacionDoc[]
  puedeEditar?: boolean
  onEdit: (c: CapacitacionDoc) => void
  onAdd?: () => void
  onDelete?: (c: CapacitacionDoc) => void
}

const ESTADO_UI: Record<EstadoCap, { label: string; bg: string }> = {
  Pendiente: { label: 'Pendiente', bg: BOARD.gray },
  'En progreso': { label: 'En curso', bg: BOARD.orange },
  Completado: { label: 'Listo', bg: BOARD.green },
}

const GRUPOS: Array<{ id: string; label: string; color: string; estados: EstadoCap[] }> = [
  { id: 'abiertas', label: 'Pendientes / en curso', color: BOARD.orange, estados: ['Pendiente', 'En progreso'] },
  { id: 'listas', label: 'Completadas', color: BOARD.green, estados: ['Completado'] },
]

export function CapacitacionesTablaBoard({
  caps,
  puedeEditar,
  onEdit,
  onAdd,
  onDelete,
}: Props) {
  const [busqueda, setBusqueda] = useState('')

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return caps
    return caps.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q)
        || proveedorNombreFromCap(c).toLowerCase().includes(q)
        || c.estado.toLowerCase().includes(q),
    )
  }, [caps, busqueda])

  return (
    <BoardShell>
      <BoardToolbar
        search={busqueda}
        onSearchChange={setBusqueda}
        left={
          puedeEditar && onAdd ? (
            <Button
              type="button"
              size="sm"
              className="gap-1 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
              onClick={onAdd}
            >
              <Plus className="size-3.5" />
              Nueva capacitación
            </Button>
          ) : undefined
        }
        filterSlot={<span />}
        right={
          <span className="text-xs" style={{ color: BOARD.muted }}>
            {filtradas.length} capacitación{filtradas.length === 1 ? '' : 'es'}
          </span>
        }
      />

      {filtradas.length === 0 ? (
        <p className="rounded-md border border-dashed bg-white px-4 py-8 text-center text-sm" style={{ color: BOARD.muted, borderColor: BOARD.border }}>
          No hay capacitaciones para mostrar.
        </p>
      ) : (
        GRUPOS.map((g) => {
          const list = filtradas.filter((c) => g.estados.includes(c.estado))
          if (list.length === 0) return null
          const estadoCounts = (Object.keys(ESTADO_UI) as EstadoCap[])
            .filter((e) => g.estados.includes(e))
            .map((e) => ({
              key: e,
              count: list.filter((c) => c.estado === e).length,
              color: ESTADO_UI[e].bg,
            }))

          return (
            <BoardGroup
              key={g.id}
              label={g.label}
              color={g.color}
              count={list.length}
              summary={
                <div
                  className="flex items-center gap-4 border-t px-3 py-2 text-[11px]"
                  style={{ backgroundColor: BOARD.bg, borderColor: BOARD.borderSoft, color: BOARD.muted }}
                >
                  <span>{list.length} ítem{list.length === 1 ? '' : 's'}</span>
                  <div className="w-40">
                    <BoardDistBar items={estadoCounts} />
                  </div>
                </div>
              }
            >
              <BoardTable minWidth="860px">
                <thead>
                  <tr className="border-b" style={{ borderColor: BOARD.borderSoft }}>
                    <BoardTh className="w-8" />
                    <BoardTh className="min-w-[180px]">Capacitación</BoardTh>
                    <BoardTh>Proveedor</BoardTh>
                    <BoardTh>Modalidad</BoardTh>
                    <BoardTh>Estado</BoardTh>
                    <BoardTh>Asignados</BoardTh>
                    <BoardTh>Cronograma</BoardTh>
                    <BoardTh className="text-right">Costo</BoardTh>
                    <BoardTh className="text-right">Acciones</BoardTh>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => {
                    const est = ESTADO_UI[c.estado]
                    const ini = formatBoardDateShort(c.fecha_inicio)
                    const fin = formatBoardDateShort(c.fecha_fin)
                    const crono = ini && fin ? `${ini} – ${fin}` : fin || ini || '—'
                    const firstAsig = c.asignados[0]
                    const colab =
                      firstAsig && typeof firstAsig.colaborador_id !== 'string'
                        ? firstAsig.colaborador_id.nombre
                        : null
                    return (
                      <tr
                        key={c._id}
                        className="border-b hover:bg-[#f0f3ff]/80"
                        style={{ borderColor: BOARD.borderSoft }}
                      >
                        <td className="px-2 py-1.5">
                          <span className="inline-block h-8 w-1 rounded-sm" style={{ backgroundColor: g.color }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            className="max-w-[220px] truncate text-left text-[13px] font-medium hover:underline"
                            style={{ color: BOARD.text }}
                            onClick={() => onEdit(c)}
                          >
                            {c.nombre}
                          </button>
                        </td>
                        <td className="px-2 py-1.5" style={{ color: BOARD.text }}>
                          {proveedorNombreFromCap(c) || '—'}
                        </td>
                        <td className="px-2 py-1.5" style={{ color: BOARD.muted }}>
                          {c.modalidad ?? '—'}
                        </td>
                        <td className="px-2 py-1.5">
                          <BoardPill
                            label={est.label}
                            bg={est.bg}
                            text={c.estado === 'Pendiente' ? BOARD.text : '#fff'}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            {colab && <BoardAvatar name={colab} />}
                            <span style={{ color: BOARD.muted }}>{c.asignados.length}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <span
                            className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{
                              backgroundColor: c.estado === 'Completado' ? BOARD.green : BOARD.gray,
                              color: c.estado === 'Completado' ? '#fff' : BOARD.text,
                            }}
                          >
                            {crono}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: BOARD.text }}>
                          {formatLps(c.costo ?? null)}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <div className="flex justify-end gap-1">
                            <Button type="button" variant="outline" size="sm" onClick={() => onEdit(c)}>
                              Editar
                            </Button>
                            {puedeEditar && onDelete && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-destructive"
                                onClick={() => onDelete(c)}
                              >
                                Eliminar
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </BoardTable>
            </BoardGroup>
          )
        })
      )}
    </BoardShell>
  )
}
