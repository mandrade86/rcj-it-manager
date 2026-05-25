import { useMemo, useState } from 'react'
import { AlertTriangle, Clock, GripVertical, Lock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { formatDateDMY } from '@/lib/format'
import { moverTareaKanban } from '@/lib/api/tareas'
import {
  agruparTareasKanban,
  esDuenoProyecto,
  KANBAN_COLUMNAS,
  puedeMoverTareaKanban,
  type KanbanColumna,
} from '@/lib/tareaKanban'
import {
  dependeDeIds,
  etiquetaSaludTarea,
  evaluarSaludTarea,
  mapaTareas,
  saludTareaCardClass,
  tareaBloqueadaPorDependencias,
} from '@/lib/tareaDependencias'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import type { Proyecto } from '@/types/proyecto'
import type { Tarea } from '@/types/tarea'

type Props = {
  tareas: Tarea[]
  proyecto: Proyecto
  onSelect: (t: Tarea) => void
  onTareaMoved: () => void | Promise<void>
  selectedId?: string | null
}

export function TareasPanel({
  tareas,
  proyecto,
  onSelect,
  onTareaMoved,
  selectedId,
}: Props) {
  const user = useAuthStore((s) => s.user)
  const mapa = useMemo(() => mapaTareas(tareas), [tareas])
  const grupos = useMemo(() => agruparTareasKanban(tareas), [tareas])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<KanbanColumna | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)

  const esDueno = useMemo(() => esDuenoProyecto(proyecto, user), [proyecto, user])

  const resumenSalud = useMemo(() => {
    let atrasadas = 0
    let enRiesgo = 0
    for (const t of tareas) {
      const s = evaluarSaludTarea(t, mapa)
      if (s === 'atrasada') atrasadas++
      else if (s === 'en_riesgo') enRiesgo++
    }
    return { atrasadas, enRiesgo }
  }, [tareas, mapa])

  async function handleDrop(columna: KanbanColumna, tareaId: string) {
    const tarea = mapa.get(tareaId)
    if (!tarea || !user) return
    if (!puedeMoverTareaKanban(tarea, proyecto, user)) {
      window.alert('Solo el dueño del proyecto o el responsable pueden mover esta tarea.')
      return
    }
    setMovingId(tareaId)
    try {
      await moverTareaKanban(tareaId, columna)
      await onTareaMoved()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo mover la tarea')
    } finally {
      setMovingId(null)
      setDraggingId(null)
      setDropTarget(null)
    }
  }

  if (tareas.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
        No hay tareas. Agrega la primera para organizarlas en el tablero.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Tablero Kanban — arrastra las tarjetas entre columnas.
          {!esDueno && user && (
            <span className="ml-1 text-[var(--navy)]">
              Solo puedes mover tareas donde eres responsable.
            </span>
          )}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-red-600">
            <span className="size-2.5 rounded-sm border border-red-400 bg-red-50" />
            En riesgo
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-red-700">
            <span className="size-2.5 rounded-sm border border-red-600 bg-red-100" />
            Atrasada
          </span>
          {(resumenSalud.atrasadas > 0 || resumenSalud.enRiesgo > 0) && (
            <span className="rounded-md bg-red-50 px-2 py-0.5 font-medium text-red-700">
              {resumenSalud.atrasadas > 0 && `${resumenSalud.atrasadas} atrasada(s)`}
              {resumenSalud.atrasadas > 0 && resumenSalud.enRiesgo > 0 && ' · '}
              {resumenSalud.enRiesgo > 0 && `${resumenSalud.enRiesgo} en riesgo`}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {KANBAN_COLUMNAS.map((col) => (
          <KanbanColumn
            key={col.id}
            col={col}
            tareas={grupos[col.id]}
            mapa={mapa}
            proyecto={proyecto}
            user={user}
            selectedId={selectedId}
            draggingId={draggingId}
            movingId={movingId}
            isDropTarget={dropTarget === col.id}
            onSelect={onSelect}
            onDragStart={(id) => setDraggingId(id)}
            onDragEnd={() => {
              setDraggingId(null)
              setDropTarget(null)
            }}
            onDragOver={() => setDropTarget(col.id)}
            onDragLeave={() => setDropTarget((c) => (c === col.id ? null : c))}
            onDrop={(tareaId) => void handleDrop(col.id, tareaId)}
          />
        ))}
      </div>
    </div>
  )
}

function KanbanColumn({
  col,
  tareas: colTareas,
  mapa,
  proyecto,
  user,
  selectedId,
  draggingId,
  movingId,
  isDropTarget,
  onSelect,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  col: (typeof KANBAN_COLUMNAS)[number]
  tareas: Tarea[]
  mapa: Map<string, Tarea>
  proyecto: Proyecto
  user: ReturnType<typeof useAuthStore.getState>['user']
  selectedId?: string | null
  draggingId: string | null
  movingId: string | null
  isDropTarget: boolean
  onSelect: (t: Tarea) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDragOver: () => void
  onDragLeave: () => void
  onDrop: (tareaId: string) => void
}) {
  const headerBg =
    col.id === 'todo'
      ? 'bg-slate-100'
      : col.id === 'in_progress'
        ? 'bg-[var(--blue-lt)]'
        : 'bg-[var(--lime-lt)]'

  return (
    <div
      className={cn(
        'flex min-h-[280px] flex-col rounded-lg border border-border bg-[#f4f6f8]/80',
        isDropTarget && 'ring-2 ring-[var(--lime)] ring-offset-1',
      )}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver()
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault()
        const id = e.dataTransfer.getData('text/tarea-id')
        if (id) onDrop(id)
      }}
    >
      <div className={cn('rounded-t-lg border-b border-border px-3 py-2.5', headerBg)}>
        <p className="text-sm font-semibold text-[var(--navy)]">{col.titulo}</p>
        <p className="text-[10px] text-muted-foreground">
          {col.subtitulo} · {colTareas.length}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2 max-h-[min(60vh,520px)]">
        {colTareas.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground">Sin tareas</p>
        ) : (
          colTareas.map((t) => (
            <KanbanCard
              key={t._id}
              tarea={t}
              mapa={mapa}
              proyecto={proyecto}
              user={user}
              selected={selectedId === t._id}
              dragging={draggingId === t._id}
              moving={movingId === t._id}
              onSelect={() => onSelect(t)}
              onDragStart={() => onDragStart(t._id)}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>
    </div>
  )
}

function KanbanCard({
  tarea,
  mapa,
  proyecto,
  user,
  selected,
  dragging,
  moving,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  tarea: Tarea
  mapa: Map<string, Tarea>
  proyecto: Proyecto
  user: ReturnType<typeof useAuthStore.getState>['user']
  selected: boolean
  dragging: boolean
  moving: boolean
  onSelect: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const puedeMover = puedeMoverTareaKanban(tarea, proyecto, user)
  const bloqueada = tareaBloqueadaPorDependencias(tarea, mapa)
  const salud = evaluarSaludTarea(tarea, mapa)
  const etiquetaSalud = etiquetaSaludTarea(salud)
  const depCount = dependeDeIds(tarea).length

  return (
    <div
      draggable={puedeMover && !moving}
      onDragStart={(e) => {
        if (!puedeMover) {
          e.preventDefault()
          return
        }
        e.dataTransfer.setData('text/tarea-id', tarea._id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'rounded-lg border p-2.5 text-left shadow-sm transition-opacity',
        saludTareaCardClass(salud),
        selected && 'ring-2 ring-[var(--lime)] ring-offset-1',
        bloqueada && salud === 'ok' && 'border-amber-300/70',
        dragging && 'opacity-50',
        moving && 'opacity-60',
        puedeMover ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
      )}
    >
      <div className="mb-1 flex items-start gap-1">
        {puedeMover ? (
          <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <span className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={onSelect}
        >
          <p
            className={cn(
              'line-clamp-2 text-xs font-semibold leading-tight',
              salud !== 'ok' ? 'text-red-900' : 'text-[var(--navy)]',
            )}
          >
            {tarea.nombre}
          </p>
        </button>
        {etiquetaSalud && (
          <Badge
            variant="outline"
            className={cn(
              'shrink-0 gap-0.5 px-1 py-0 text-[9px] font-semibold',
              salud === 'atrasada'
                ? 'border-red-600 bg-red-600 text-white'
                : 'border-red-500 bg-red-500 text-white',
            )}
          >
            {salud === 'atrasada' ? (
              <Clock className="size-2.5" />
            ) : (
              <AlertTriangle className="size-2.5" />
            )}
            {etiquetaSalud}
          </Badge>
        )}
      </div>

      <button type="button" className="w-full text-left" onClick={onSelect}>
        <p className="mb-1 truncate text-[10px] text-muted-foreground">
          {tarea.responsable ?? 'Sin responsable'}
        </p>
        <p className={cn('text-[10px]', salud !== 'ok' ? 'text-red-800/90' : 'text-muted-foreground')}>
          {tarea.fecha_fin ? `Fin ${formatDateDMY(tarea.fecha_fin)}` : 'Sin fecha fin'}
          {' · '}{tarea.porcentaje}%
          {depCount > 0 && ` · ${depCount} dep.`}
        </p>
        {tarea.estado === 'Bloqueado' && (
          <Badge variant="outline" className="mt-1 text-[9px]">
            Bloqueado
          </Badge>
        )}
        {bloqueada && (
          <p className="mt-1 flex items-center gap-0.5 text-[9px] text-amber-800">
            <Lock className="size-2.5" />
            Predecesoras pendientes
          </p>
        )}
        {!puedeMover && (
          <p className="mt-1 text-[9px] italic text-muted-foreground">
            Solo lectura
          </p>
        )}
      </button>
    </div>
  )
}
