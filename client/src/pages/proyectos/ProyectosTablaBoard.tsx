import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  BOARD,
  BoardAddLink,
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
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Proyecto, ProyectoEstado, ProyectoPrioridad } from '@/types/proyecto'
import {
  PROYECTO_ESTADOS,
  proyectoOwnerName,
  proyectoPresupuestoConsumoPct,
  proyectoTienePresupuesto,
} from '@/types/proyecto'

type Props = {
  rows: Proyecto[]
  onRowClick: (p: Proyecto) => void
  onAdd?: () => void
  puedeEditar?: boolean
  emptyMessage?: string
}

const ESTADO_BOARD: Record<ProyectoEstado, { label: string; bg: string; text: string }> = {
  Idea: { label: 'Idea', bg: BOARD.gray, text: '#fff' },
  Planificado: { label: 'Planificado', bg: BOARD.blue, text: '#fff' },
  'En revisión': { label: 'En revisión', bg: BOARD.orange, text: '#fff' },
  Aprobado: { label: 'Aprobado', bg: BOARD.indigo, text: '#fff' },
  'En progreso': { label: 'En curso', bg: BOARD.orange, text: '#fff' },
  Bloqueado: { label: 'Detenido', bg: BOARD.red, text: '#fff' },
  'En pausa': { label: 'En pausa', bg: '#7f6000', text: '#fff' },
  Completado: { label: 'Listo', bg: BOARD.green, text: '#fff' },
  Cancelado: { label: 'Cancelado', bg: BOARD.text, text: '#fff' },
}

const PRIORIDAD_BOARD: Record<ProyectoPrioridad, { bg: string; text: string }> = {
  Baja: { bg: BOARD.blue, text: '#fff' },
  Media: { bg: BOARD.indigo, text: '#fff' },
  Alta: { bg: BOARD.purple, text: '#fff' },
}

const GRUPOS: Array<{
  id: string
  label: string
  color: string
  estados: ProyectoEstado[]
}> = [
  {
    id: 'activos',
    label: 'En curso / activos',
    color: BOARD.orange,
    estados: ['Idea', 'Planificado', 'En revisión', 'Aprobado', 'En progreso', 'Bloqueado', 'En pausa'],
  },
  {
    id: 'cerrados',
    label: 'Completados / cerrados',
    color: BOARD.green,
    estados: ['Completado', 'Cancelado'],
  },
]

export function ProyectosTablaBoard({
  rows,
  onRowClick,
  onAdd,
  puedeEditar = false,
  emptyMessage = 'No hay proyectos con los filtros seleccionados.',
}: Props) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((p) => {
      const owner = proyectoOwnerName(p)
      return (
        p.nombre.toLowerCase().includes(q)
        || p._id.toLowerCase().includes(q)
        || (p.eje ?? '').toLowerCase().includes(q)
        || owner.toLowerCase().includes(q)
        || p.estado.toLowerCase().includes(q)
      )
    })
  }, [rows, busqueda])

  const porGrupo = useMemo(() => {
    const map = new Map<string, Proyecto[]>()
    for (const g of GRUPOS) {
      map.set(
        g.id,
        filtrados.filter((p) => g.estados.includes(p.estado)),
      )
    }
    return map
  }, [filtrados])

  if (rows.length === 0) {
    return (
      <BoardShell>
        <p className="rounded-md border border-dashed bg-white px-4 py-10 text-center text-sm" style={{ color: BOARD.muted, borderColor: BOARD.border }}>
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
        left={
          puedeEditar && onAdd ? (
            <Button
              type="button"
              size="sm"
              className="gap-1 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
              onClick={onAdd}
            >
              <Plus className="size-3.5" />
              Agregar proyecto
            </Button>
          ) : undefined
        }
        filterSlot={<span />}
        right={
          <span className="text-xs" style={{ color: BOARD.muted }}>
            {filtrados.length} proyecto{filtrados.length === 1 ? '' : 's'}
          </span>
        }
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed bg-white px-4 py-8 text-center text-sm" style={{ color: BOARD.muted, borderColor: BOARD.border }}>
          Ningún proyecto coincide con la búsqueda.
        </p>
      ) : (
        GRUPOS.map((grupo) => {
          const list = porGrupo.get(grupo.id) ?? []
          if (list.length === 0 && filtrados.length > 0) {
            // still show empty closed group lightly? skip empty
            return null
          }
          const estadoCounts = PROYECTO_ESTADOS.filter((e) => grupo.estados.includes(e)).map((e) => ({
            key: e,
            count: list.filter((p) => p.estado === e).length,
            color: ESTADO_BOARD[e].bg,
          }))
          const prioCounts = (['Alta', 'Media', 'Baja'] as ProyectoPrioridad[]).map((p) => ({
            key: p,
            count: list.filter((x) => x.prioridad === p).length,
            color: PRIORIDAD_BOARD[p].bg,
          }))

          return (
            <BoardGroup
              key={grupo.id}
              label={grupo.label}
              color={grupo.color}
              count={list.length}
              summary={
                <div
                  className="grid grid-cols-[1fr_140px_120px] gap-3 border-t px-3 py-2 text-[11px]"
                  style={{ backgroundColor: BOARD.bg, borderColor: BOARD.borderSoft, color: BOARD.muted }}
                >
                  <span>{list.length} ítem{list.length === 1 ? '' : 's'}</span>
                  <BoardDistBar items={estadoCounts} />
                  <BoardDistBar items={prioCounts} />
                </div>
              }
            >
              <BoardTable minWidth="1020px">
                <thead>
                  <tr className="border-b" style={{ borderColor: BOARD.borderSoft }}>
                    <BoardTh className="w-8" />
                    <BoardTh className="min-w-[200px]">Proyecto</BoardTh>
                    <BoardTh className="min-w-[110px]">Propietario</BoardTh>
                    <BoardTh className="min-w-[100px]">Estado</BoardTh>
                    <BoardTh className="min-w-[90px]">Prioridad</BoardTh>
                    <BoardTh className="min-w-[90px]">Fase</BoardTh>
                    <BoardTh className="min-w-[100px]">Vencimiento</BoardTh>
                    <BoardTh className="min-w-[100px]">Avance</BoardTh>
                    <BoardTh className="min-w-[110px]">Presupuesto</BoardTh>
                    <BoardTh className="min-w-[120px]">Cronograma</BoardTh>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => {
                    const owner = proyectoOwnerName(p)
                    const est = ESTADO_BOARD[p.estado]
                    const pri = PRIORIDAD_BOARD[p.prioridad]
                    const fin = formatBoardDateShort(p.fecha_fin)
                    const ini = formatBoardDateShort(p.fecha_inicio)
                    const crono = ini && fin ? `${ini} – ${fin}` : fin || ini || '—'
                    const avance = Math.min(100, Math.max(0, p.porcentaje_avance ?? 0))
                    const atrasado =
                      p.fecha_fin
                      && p.estado !== 'Completado'
                      && p.estado !== 'Cancelado'
                      && new Date(p.fecha_fin).getTime() < Date.now()

                    return (
                      <tr
                        key={p._id}
                        className="cursor-pointer border-b transition-colors hover:bg-[#f0f3ff]/80"
                        style={{ borderColor: BOARD.borderSoft }}
                        onClick={() => onRowClick(p)}
                      >
                        <td className="px-2 py-1.5">
                          <span
                            className="inline-block h-8 w-1 rounded-sm"
                            style={{ backgroundColor: grupo.color }}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium" style={{ color: BOARD.text }}>
                              {p.nombre}
                            </p>
                            <p className="truncate text-[10px]" style={{ color: BOARD.muted }}>
                              {p._id}
                              {p.eje ? ` · ${p.eje}` : ''}
                            </p>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <BoardAvatar name={owner || '?'} />
                            <span className="max-w-[90px] truncate" style={{ color: BOARD.text }}>
                              {owner || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <BoardPill label={est.label} bg={est.bg} text={est.text} />
                        </td>
                        <td className="px-2 py-1.5">
                          <BoardPill label={p.prioridad} bg={pri.bg} text={pri.text} />
                        </td>
                        <td className="px-2 py-1.5" style={{ color: BOARD.text }}>
                          {p.fase != null ? `Fase ${p.fase}` : '—'}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="inline-flex items-center gap-1" style={{ color: BOARD.text }}>
                            {atrasado ? (
                              <AlertCircle className="size-3.5" style={{ color: BOARD.red }} />
                            ) : p.estado === 'Completado' ? (
                              <CheckCircle2 className="size-3.5" style={{ color: BOARD.green }} />
                            ) : (
                              <Clock className="size-3.5" style={{ color: BOARD.gray }} />
                            )}
                            {fin || '—'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="h-1.5 w-16 overflow-hidden rounded-full"
                              style={{ backgroundColor: BOARD.borderSoft }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${avance}%`,
                                  backgroundColor: avance >= 100 ? BOARD.green : BOARD.primary,
                                }}
                              />
                            </div>
                            <span className="tabular-nums" style={{ color: BOARD.muted }}>
                              {avance}%
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          {proyectoTienePresupuesto(p) ? (
                            <div className="space-y-0.5">
                              <p className="text-[11px] font-medium tabular-nums" style={{ color: BOARD.text }}>
                                {formatMoney(p.presupuesto_planificado, p.moneda_presupuesto ?? 'HNL')}
                              </p>
                              {(() => {
                                const c = proyectoPresupuestoConsumoPct(p)
                                if (c == null) return null
                                return (
                                  <p
                                    className="text-[10px] font-semibold tabular-nums"
                                    style={{ color: c > 100 ? BOARD.red : BOARD.muted }}
                                  >
                                    {c.toLocaleString('es-HN', { maximumFractionDigits: 0 })}% cons.
                                  </p>
                                )
                              })()}
                            </div>
                          ) : (
                            <span style={{ color: BOARD.muted }}>—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <span
                            className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium')}
                            style={{
                              backgroundColor: atrasado
                                ? BOARD.red
                                : p.estado === 'Completado'
                                  ? BOARD.green
                                  : BOARD.gray,
                              color: atrasado || p.estado === 'Completado' ? '#fff' : BOARD.text,
                            }}
                          >
                            {crono}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {puedeEditar && onAdd && (
                    <tr>
                      <td colSpan={9}>
                        <BoardAddLink onClick={onAdd} label="Agregar proyecto" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </BoardTable>
            </BoardGroup>
          )
        })
      )}
    </BoardShell>
  )
}
