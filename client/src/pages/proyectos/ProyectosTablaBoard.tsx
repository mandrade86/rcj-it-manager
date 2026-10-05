import { useState } from 'react'
import { AlertCircle, CheckCircle2, Clock, GripVertical, Lock } from 'lucide-react'

import {
  BOARD,
  BoardAvatar,
  BoardGroup,
  BoardPill,
  BoardShell,
  BoardTable,
  BoardTh,
  PRIORIDAD_TONE,
  formatBoardDateShort,
} from '@/components/board/BoardPrimitives'
import { transicionarProyecto } from '@/lib/api/proyectos'
import { cn } from '@/lib/utils'
import { useProyectosStore } from '@/store/proyectosStore'
import type { Proyecto, ProyectoEstado } from '@/types/proyecto'
import { PROYECTO_ESTADOS, proyectoOwnerName, proyectoPuedeEditar } from '@/types/proyecto'

type Props = {
  rows: Proyecto[]
  onRowClick: (p: Proyecto) => void
  emptyMessage?: string
}

const ESTADO_BOARD: Record<ProyectoEstado, { label: string; bg: string; text: string; color: string }> = {
  Idea: { label: 'Idea', bg: BOARD.gray, text: '#fff', color: BOARD.gray },
  Planificado: { label: 'Planificado', bg: BOARD.blue, text: '#fff', color: BOARD.blue },
  'En revisión': { label: 'Revisión', bg: BOARD.orange, text: '#fff', color: BOARD.orange },
  Aprobado: { label: 'Aprobado', bg: BOARD.indigo, text: '#fff', color: BOARD.indigo },
  'En progreso': { label: 'En curso', bg: BOARD.orange, text: '#fff', color: BOARD.orange },
  Bloqueado: { label: 'Detenido', bg: BOARD.red, text: '#fff', color: BOARD.red },
  'En pausa': { label: 'Pausa', bg: '#7f6000', text: '#fff', color: '#7f6000' },
  Completado: { label: 'Listo', bg: BOARD.green, text: '#fff', color: BOARD.green },
  Cancelado: { label: 'Cancelado', bg: BOARD.text, text: '#fff', color: BOARD.text },
}

const PRIORIDAD_BOARD = PRIORIDAD_TONE

export function ProyectosTablaBoard({
  rows,
  onRowClick,
  emptyMessage = 'No hay proyectos con los filtros seleccionados.',
}: Props) {
  const load = useProyectosStore((s) => s.load)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropEstado, setDropEstado] = useState<ProyectoEstado | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)

  async function dropEnEstado(estado: ProyectoEstado, proyectoId: string) {
    const p = rows.find((x) => x._id === proyectoId)
    if (!p || p.estado === estado) {
      setDraggingId(null)
      setDropEstado(null)
      return
    }
    if (!proyectoPuedeEditar(p)) {
      window.alert('Solo lectura: no puedes cambiar el estado de este proyecto.')
      setDraggingId(null)
      setDropEstado(null)
      return
    }
    setMovingId(proyectoId)
    try {
      await transicionarProyecto(proyectoId, estado)
      await load()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo mover el proyecto')
    } finally {
      setMovingId(null)
      setDraggingId(null)
      setDropEstado(null)
    }
  }

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
    <BoardShell className="p-2">
      <p className="mb-2 px-1 text-xs" style={{ color: BOARD.muted }}>
        Arrastra el ícono de líneas a otro grupo para cambiar el estado.
      </p>
      {PROYECTO_ESTADOS.map((estado) => {
        const list = rows.filter((p) => p.estado === estado)
        if (list.length === 0 && !draggingId) return null
        const meta = ESTADO_BOARD[estado]
        return (
          <div
            key={estado}
            className={cn(dropEstado === estado && 'rounded-md ring-2 ring-[var(--lime)] ring-offset-1')}
            onDragOver={(e) => {
              if (!draggingId) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setDropEstado(estado)
            }}
            onDragLeave={() => setDropEstado((c) => (c === estado ? null : c))}
            onDrop={(e) => {
              e.preventDefault()
              const id = e.dataTransfer.getData('text/proyecto-id') || e.dataTransfer.getData('text/plain')
              if (id) void dropEnEstado(estado, id)
            }}
          >
            <BoardGroup label={meta.label} color={meta.color} count={list.length} defaultOpen={estado !== 'Cancelado'}>
              <BoardTable minWidth="720px">
                <thead>
                  <tr className="border-b" style={{ borderColor: BOARD.borderSoft }}>
                    <BoardTh className="w-8" />
                    <BoardTh className="min-w-[220px]">Proyecto</BoardTh>
                    <BoardTh className="min-w-[100px]">Estado</BoardTh>
                    <BoardTh className="min-w-[80px]">Prioridad</BoardTh>
                    <BoardTh className="min-w-[90px]">Vence</BoardTh>
                    <BoardTh className="min-w-[90px]">Avance</BoardTh>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-[11px]" style={{ color: BOARD.muted }}>
                        Suelta aquí para pasar a «{meta.label}»
                      </td>
                    </tr>
                  ) : (
                    list.map((p) => (
                      <ProyectoRow
                        key={p._id}
                        proyecto={p}
                        grupoColor={meta.color}
                        dragging={draggingId === p._id}
                        moving={movingId === p._id}
                        onOpen={() => onRowClick(p)}
                        onDragStart={() => setDraggingId(p._id)}
                        onDragEnd={() => {
                          setDraggingId(null)
                          setDropEstado(null)
                        }}
                      />
                    ))
                  )}
                </tbody>
              </BoardTable>
            </BoardGroup>
          </div>
        )
      })}
    </BoardShell>
  )
}

function ProyectoRow({
  proyecto,
  grupoColor,
  dragging,
  moving,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  proyecto: Proyecto
  grupoColor: string
  dragging: boolean
  moving: boolean
  onOpen: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const puede = proyectoPuedeEditar(proyecto)
  const owner = proyectoOwnerName(proyecto)
  const est = ESTADO_BOARD[proyecto.estado]
  const pri = PRIORIDAD_BOARD[proyecto.prioridad]
  const fin = formatBoardDateShort(proyecto.fecha_fin)
  const avance = Math.min(100, Math.max(0, proyecto.porcentaje_avance ?? 0))
  const atrasado =
    Boolean(proyecto.fecha_fin)
    && proyecto.estado !== 'Completado'
    && proyecto.estado !== 'Cancelado'
    && proyecto.fecha_fin != null
    && new Date(proyecto.fecha_fin).getTime() < Date.now()

  return (
    <tr
      className={cn(
        'border-b transition-colors hover:bg-[#f0f3ff]/80',
        (dragging || moving) && 'opacity-50',
      )}
      style={{ borderColor: BOARD.borderSoft }}
    >
      <td className="px-2 py-2">
        <span className="inline-flex items-center gap-1">
          {puede ? (
            <span
              draggable={!moving}
              className="cursor-grab active:cursor-grabbing"
              title="Arrastrar a otro grupo"
              onDragStart={(e) => {
                e.dataTransfer.setData('text/proyecto-id', proyecto._id)
                e.dataTransfer.setData('text/plain', proyecto._id)
                e.dataTransfer.effectAllowed = 'move'
                onDragStart()
              }}
              onDragEnd={onDragEnd}
            >
              <GripVertical className="size-3.5 text-muted-foreground" aria-hidden />
            </span>
          ) : (
            <Lock className="size-3 text-muted-foreground" aria-hidden />
          )}
          <span className="inline-block h-7 w-1 rounded-sm" style={{ backgroundColor: grupoColor }} />
        </span>
      </td>
      <td className="px-2 py-2">
        <button type="button" className="min-w-0 text-left" onClick={onOpen}>
          <p className="truncate text-[13px] font-medium" style={{ color: BOARD.text }}>
            {proyecto.nombre}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px]" style={{ color: BOARD.muted }}>
            <BoardAvatar name={owner || '?'} className="size-4 text-[9px]" />
            <span className="truncate">
              {owner || 'Sin dueño'}
              {proyecto.fase != null ? ` · F${proyecto.fase}` : ''}
            </span>
          </p>
        </button>
      </td>
      <td className="px-2 py-2">
        <BoardPill label={est.label} bg={est.bg} text={est.text} />
      </td>
      <td className="px-2 py-2">
        <BoardPill label={proyecto.prioridad} bg={pri.bg} text={pri.text} />
      </td>
      <td className="px-2 py-2">
        <span
          className="inline-flex items-center gap-1 text-[12px]"
          style={{ color: atrasado ? BOARD.red : BOARD.text }}
        >
          {atrasado ? (
            <AlertCircle className="size-3.5 shrink-0" />
          ) : proyecto.estado === 'Completado' ? (
            <CheckCircle2 className="size-3.5 shrink-0" style={{ color: BOARD.green }} />
          ) : (
            <Clock className="size-3.5 shrink-0" style={{ color: BOARD.gray }} />
          )}
          {fin || '—'}
        </span>
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-14 overflow-hidden rounded-full" style={{ backgroundColor: BOARD.borderSoft }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${avance}%`,
                backgroundColor: avance >= 100 ? BOARD.green : BOARD.primary,
              }}
            />
          </div>
          <span className="tabular-nums text-[12px]" style={{ color: BOARD.muted }}>
            {avance}%
          </span>
        </div>
      </td>
    </tr>
  )
}
