import { AlertCircle, CheckCircle2, Clock, FileText, Paperclip } from 'lucide-react'

import { BOARD, BoardAvatar, BoardPill } from '@/components/board/BoardPrimitives'
import { formatMoney } from '@/lib/format'
import type { ColId, TareaEstadoDef } from '@/lib/tareaBoardPrefs'
import type { TareaSalud } from '@/lib/tareaDependencias'
import type { Proyecto } from '@/types/proyecto'
import type { Tarea, TareaPrioridad } from '@/types/tarea'
import { tareaMontoEjecutadoEstimado } from '@/types/tarea'

const PRIORIDAD_UI: Record<TareaPrioridad, { bg: string; text: string }> = {
  Baja: { bg: BOARD.blue, text: '#ffffff' },
  Media: { bg: BOARD.indigo, text: '#ffffff' },
  Alta: { bg: BOARD.purple, text: '#ffffff' },
}

export function TareaBoardCelda({
  col,
  t,
  proyecto,
  puedeEditar,
  busy,
  est,
  listo,
  salud,
  finLabel,
  crono,
  actualizado,
  catalog,
  onSelect,
  onPatch,
}: {
  col: ColId
  t: Tarea
  proyecto: Proyecto
  puedeEditar: boolean
  busy: boolean
  est: { label: string; bg: string; text: string }
  listo: boolean
  salud: TareaSalud
  finLabel: string
  crono: string
  actualizado: string
  catalog: TareaEstadoDef[]
  onSelect: (t: Tarea) => void
  onPatch: (id: string, patch: Record<string, unknown>) => void
}) {
  if (col === 'tarea') {
    return (
      <>
        <button
          type="button"
          className="max-w-[300px] truncate text-left text-[13px] font-medium hover:underline"
          style={{ color: BOARD.text }}
          onClick={() => onSelect(t)}
          title={t.nombre}
        >
          {t.nombre}
        </button>
        {t.descripcion?.trim() ? (
          <p className="mt-0.5 line-clamp-1 max-w-[300px] text-[11px]" style={{ color: BOARD.muted }}>
            {t.descripcion}
          </p>
        ) : null}
      </>
    )
  }
  if (col === 'persona') {
    return (
      <div className="flex items-center gap-1.5">
        <BoardAvatar name={t.responsable} />
        <span className="max-w-[90px] truncate text-xs" style={{ color: BOARD.text }}>
          {t.responsable || '—'}
        </span>
      </div>
    )
  }
  if (col === 'estado') {
    if (!puedeEditar) return <BoardPill label={est.label} bg={est.bg} text={est.text} />
    return (
      <select
        className="cursor-pointer rounded-sm border-0 px-2 py-1 text-[11px] font-semibold outline-none"
        style={{ backgroundColor: est.bg, color: est.text }}
        value={t.estado}
        disabled={busy}
        onChange={(e) => {
          const next = e.target.value
          const nextListo = catalog.find((x) => x.clave === next)?.grupo === 'listo'
          onPatch(t._id, {
            estado: next,
            porcentaje: nextListo ? 100 : listo ? Math.min(t.porcentaje, 90) : t.porcentaje,
          })
        }}
      >
        {catalog.map((e) => (
          <option key={e.clave} value={e.clave}>
            {e.etiqueta}
          </option>
        ))}
      </select>
    )
  }
  if (col === 'fecha') {
    return (
      <span className="inline-flex items-center gap-1 text-xs" style={{ color: BOARD.text }}>
        {salud === 'atrasada' ? (
          <AlertCircle className="size-3.5" style={{ color: BOARD.red }} />
        ) : listo ? (
          <CheckCircle2 className="size-3.5" style={{ color: BOARD.green }} />
        ) : (
          <Clock className="size-3.5" style={{ color: BOARD.gray }} />
        )}
        {finLabel || '—'}
      </span>
    )
  }
  if (col === 'prioridad') {
    if (puedeEditar) {
      return (
        <select
          className="cursor-pointer rounded-sm border px-2 py-1 text-[11px] font-semibold outline-none"
          style={
            t.prioridad
              ? {
                  backgroundColor: PRIORIDAD_UI[t.prioridad].bg,
                  color: PRIORIDAD_UI[t.prioridad].text,
                  borderColor: 'transparent',
                }
              : { borderColor: '#c5c7d0', backgroundColor: '#fff' }
          }
          value={t.prioridad ?? ''}
          disabled={busy}
          onChange={(e) => onPatch(t._id, { prioridad: e.target.value || null })}
        >
          <option value="">—</option>
          <option value="Baja">Baja</option>
          <option value="Media">Media</option>
          <option value="Alta">Alta</option>
        </select>
      )
    }
    if (t.prioridad) {
      return (
        <BoardPill
          label={t.prioridad}
          bg={PRIORIDAD_UI[t.prioridad].bg}
          text={PRIORIDAD_UI[t.prioridad].text}
        />
      )
    }
    return <span style={{ color: BOARD.gray }}>—</span>
  }
  if (col === 'avance') {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-12 overflow-hidden rounded-full" style={{ backgroundColor: BOARD.borderSoft }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, Math.max(0, t.porcentaje ?? 0))}%`,
              backgroundColor: BOARD.accent,
            }}
          />
        </div>
        <span className="text-[11px] tabular-nums" style={{ color: BOARD.muted }}>
          {t.porcentaje ?? 0}%
        </span>
      </div>
    )
  }
  if (col === 'monto') {
    if (t.monto_asignado == null || !Number.isFinite(t.monto_asignado)) {
      return <span style={{ color: BOARD.muted }}>—</span>
    }
    const moneda = proyecto.moneda_presupuesto ?? 'HNL'
    return (
      <div className="space-y-0.5">
        <p className="text-[12px] font-semibold tabular-nums" style={{ color: BOARD.text }}>
          {formatMoney(t.monto_asignado, moneda)}
        </p>
        <p className="text-[10px] tabular-nums" style={{ color: BOARD.muted }}>
          ej. {formatMoney(tareaMontoEjecutadoEstimado(t), moneda)}
        </p>
      </div>
    )
  }
  if (col === 'archivos') {
    if ((t.adjuntos?.length ?? 0) > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs" style={{ color: BOARD.primary }}>
          <Paperclip className="size-3.5" />
          {t.adjuntos!.length}
        </span>
      )
    }
    return <FileText className="size-3.5" style={{ color: BOARD.gray }} />
  }
  if (col === 'cronograma') {
    return (
      <span
        className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
        style={{
          backgroundColor: salud === 'atrasada' ? BOARD.red : listo ? BOARD.green : BOARD.gray,
          color: salud === 'atrasada' || listo ? '#fff' : BOARD.text,
        }}
      >
        {crono}
      </span>
    )
  }
  return <span className="text-xs" style={{ color: BOARD.muted }}>{actualizado}</span>
}
