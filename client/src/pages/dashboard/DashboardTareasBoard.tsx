import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import {
  BOARD,
  BoardAvatar,
  BoardPill,
  EntityBoard,
} from '@/components/board/EntityBoard'
import { formatDateDMY } from '@/lib/format'

export type TareaProximaBoard = {
  _id: string
  nombre: string
  proyecto_id: string
  proyecto_nombre: string
  responsable?: string | null
  fecha_fin?: string | null
  estado: string
}

const ESTADO_COLORS: Record<string, string> = {
  Pendiente: BOARD.gray,
  'En progreso': BOARD.orange,
  Completado: BOARD.green,
  Bloqueado: BOARD.red,
}

export function DashboardTareasBoard({ tareas }: { tareas: TareaProximaBoard[] }) {
  const rows = useMemo(
    () =>
      tareas.map((t) => ({
        ...t,
        activo: t.estado !== 'Completado',
      })),
    [tareas],
  )

  return (
    <EntityBoard
      rows={rows}
      countLabel="tarea"
      emptyMessage="No hay tareas pendientes en esta ventana."
      hideEmptyGroups={false}
      groups={[
        {
          id: 'abiertas',
          label: 'Pendientes / en curso',
          color: BOARD.orange,
          match: (t) => t.estado !== 'Completado',
        },
        {
          id: 'listas',
          label: 'Completadas',
          color: BOARD.green,
          match: (t) => t.estado === 'Completado',
        },
      ]}
      searchTexts={(t) => [t.nombre, t.proyecto_nombre, t.responsable, t.estado]}
      columns={[
        {
          id: 'tarea',
          label: 'Tarea',
          className: 'min-w-[180px]',
          render: (t) => <span className="font-medium text-[13px]">{t.nombre}</span>,
        },
        {
          id: 'proyecto',
          label: 'Proyecto',
          render: (t) => (
            <Link
              to={`/proyectos/${encodeURIComponent(t.proyecto_id)}`}
              className="text-xs font-medium hover:underline"
              style={{ color: BOARD.primary }}
            >
              {t.proyecto_nombre}
            </Link>
          ),
        },
        {
          id: 'responsable',
          label: 'Responsable',
          render: (t) => (
            <div className="flex items-center gap-2">
              <BoardAvatar name={t.responsable} />
              <span className="text-xs">{t.responsable || '—'}</span>
            </div>
          ),
        },
        {
          id: 'fin',
          label: 'Fin',
          render: (t) => (
            <span className="text-xs tabular-nums" style={{ color: BOARD.muted }}>
              {formatDateDMY(t.fecha_fin)}
            </span>
          ),
        },
        {
          id: 'estado',
          label: 'Estado',
          render: (t) => (
            <BoardPill
              label={t.estado}
              bg={ESTADO_COLORS[t.estado] ?? BOARD.gray}
            />
          ),
        },
      ]}
    />
  )
}
