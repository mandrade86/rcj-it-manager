import { MessageSquare } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { formatDateDMY } from '@/lib/format'
import { estadoTareaColor } from '@/lib/tareaDependencias'
import { cn } from '@/lib/utils'
import type { TareaEstado } from '@/types/tarea'

type TareaLike = {
  nombre: string
  estado: string
  porcentaje: number
  responsable?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  descripcion?: string | null
  ultimo_comentario?: string | null
  comentarios_count?: number
}

export function ReporteTareasDetalleList({ tareas, compact = false }: { tareas: TareaLike[]; compact?: boolean }) {
  if (tareas.length === 0) {
    return <p className="text-xs text-muted-foreground">Sin tareas registradas.</p>
  }

  return (
    <div className={cn('space-y-2', compact && 'max-h-48 overflow-y-auto')}>
      {tareas.map((t, i) => (
        <div
          key={`${t.nombre}-${i}`}
          className="rounded-lg border border-border/70 bg-[var(--gray-lt)]/30 px-3 py-2"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--navy)]">{t.nombre}</p>
              {!compact && t.descripcion && (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{t.descripcion}</p>
              )}
            </div>
            <Badge variant="outline" className={cn('text-[10px]', estadoTareaColor(t.estado as TareaEstado))}>
              {t.estado}
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span>{t.responsable ?? 'Sin responsable'}</span>
            <span>{formatDateDMY(t.fecha_inicio)} → {formatDateDMY(t.fecha_fin)}</span>
            {(t.comentarios_count ?? 0) > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <MessageSquare className="size-2.5" />
                {t.comentarios_count}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[var(--lime)]"
                style={{ width: `${Math.min(100, t.porcentaje)}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-[var(--navy)]">{t.porcentaje}%</span>
          </div>
          {!compact && t.ultimo_comentario && (
            <p className="mt-1.5 line-clamp-2 text-[10px] italic text-muted-foreground">«{t.ultimo_comentario}»</p>
          )}
        </div>
      ))}
    </div>
  )
}
