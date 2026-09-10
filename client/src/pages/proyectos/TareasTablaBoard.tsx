import { useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Paperclip,
  Plus,
  UserRound,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  BOARD,
  BoardAvatar,
  BoardDistBar,
  BoardGroup,
  BoardPill,
  BoardQuickAdd,
  BoardShell,
  BoardTable,
  BoardTh,
  BoardToolbar,
  formatBoardDateShort,
} from '@/components/board/BoardPrimitives'
import { createTarea, updateTarea } from '@/lib/api/tareas'
import { formatDateDMY, formatMoney } from '@/lib/format'
import { evaluarSaludTarea, mapaTareas } from '@/lib/tareaDependencias'
import { cn } from '@/lib/utils'
import type { Proyecto } from '@/types/proyecto'
import type { Tarea, TareaEstado, TareaPrioridad } from '@/types/tarea'
import { tareaMontoEjecutadoEstimado } from '@/types/tarea'

type Props = {
  tareas: Tarea[]
  proyecto: Proyecto
  puedeEditar?: boolean
  selectedId?: string | null
  onSelect: (t: Tarea) => void
  /** Abre el formulario completo (opcional). El alta rápida es en línea. */
  onAddAdvanced?: () => void
  onChanged: () => void | Promise<void>
}

type BoardGrupoId = 'por_hacer' | 'en_curso' | 'detenido' | 'listo'

const GRUPOS: Array<{
  id: BoardGrupoId
  label: string
  color: string
  estados: TareaEstado[]
}> = [
  { id: 'por_hacer', label: 'Por hacer', color: BOARD.gray, estados: ['Pendiente'] },
  { id: 'en_curso', label: 'En curso', color: BOARD.orange, estados: ['En progreso'] },
  { id: 'detenido', label: 'Detenido', color: BOARD.red, estados: ['Bloqueado'] },
  { id: 'listo', label: 'Listo', color: BOARD.green, estados: ['Completado'] },
]

const ESTADO_UI: Record<TareaEstado, { label: string; bg: string; text: string }> = {
  Pendiente: { label: 'Pendiente', bg: BOARD.gray, text: BOARD.text },
  'En progreso': { label: 'En curso', bg: BOARD.orange, text: '#ffffff' },
  Completado: { label: 'Listo', bg: BOARD.green, text: '#ffffff' },
  Bloqueado: { label: 'Detenido', bg: BOARD.red, text: '#ffffff' },
}

const PRIORIDAD_UI: Record<TareaPrioridad, { bg: string; text: string }> = {
  Baja: { bg: BOARD.blue, text: '#ffffff' },
  Media: { bg: BOARD.indigo, text: '#ffffff' },
  Alta: { bg: BOARD.purple, text: '#ffffff' },
}

function relativeUpdate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs} h`
  const days = Math.floor(hrs / 24)
  if (days < 14) return `hace ${days} d`
  return formatDateDMY(iso)
}

function estadoDefaultGrupo(grupoId: BoardGrupoId): TareaEstado {
  const g = GRUPOS.find((x) => x.id === grupoId)
  return g?.estados[0] ?? 'Pendiente'
}

export function TareasTablaBoard({
  tareas,
  proyecto,
  puedeEditar = false,
  selectedId,
  onSelect,
  onAddAdvanced,
  onChanged,
}: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroPersona, setFiltroPersona] = useState('todas')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [addingGrupo, setAddingGrupo] = useState<BoardGrupoId | null>(null)
  const [draftNombre, setDraftNombre] = useState('')
  const [creating, setCreating] = useState(false)

  const mapa = useMemo(() => mapaTareas(tareas), [tareas])

  const personas = useMemo(() => {
    const set = new Set<string>()
    for (const t of tareas) {
      if (t.responsable?.trim()) set.add(t.responsable.trim())
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [tareas])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return tareas.filter((t) => {
      if (filtroPersona !== 'todas' && (t.responsable ?? '').trim() !== filtroPersona) {
        return false
      }
      if (!q) return true
      return (
        t.nombre.toLowerCase().includes(q)
        || (t.descripcion ?? '').toLowerCase().includes(q)
        || (t.responsable ?? '').toLowerCase().includes(q)
        || (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
      )
    })
  }, [tareas, busqueda, filtroPersona])

  const porGrupo = useMemo(() => {
    const out: Record<BoardGrupoId, Tarea[]> = {
      por_hacer: [],
      en_curso: [],
      detenido: [],
      listo: [],
    }
    for (const g of GRUPOS) {
      out[g.id] = filtradas.filter((t) => g.estados.includes(t.estado))
    }
    return out
  }, [filtradas])

  const hayFiltros = Boolean(busqueda.trim()) || filtroPersona !== 'todas'

  async function patchTarea(id: string, patch: Record<string, unknown>) {
    setBusyId(id)
    try {
      await updateTarea(id, patch)
      await onChanged()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo actualizar')
    } finally {
      setBusyId(null)
    }
  }

  function startQuickAdd(grupoId: BoardGrupoId) {
    setAddingGrupo(grupoId)
    setDraftNombre('')
  }

  function cancelQuickAdd() {
    if (creating) return
    setAddingGrupo(null)
    setDraftNombre('')
  }

  async function submitQuickAdd() {
    if (!addingGrupo || !puedeEditar) return
    const nombre = draftNombre.trim()
    if (!nombre) return
    const estado = estadoDefaultGrupo(addingGrupo)
    setCreating(true)
    try {
      await createTarea({
        proyecto_id: proyecto._id,
        nombre,
        estado,
        porcentaje: estado === 'Completado' ? 100 : 0,
        eje: proyecto.eje,
      })
      setDraftNombre('')
      await onChanged()
      // Mantener el input abierto para seguir agregando (flujo Monday)
      setAddingGrupo(addingGrupo)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo crear la tarea')
    } finally {
      setCreating(false)
    }
  }

  return (
    <BoardShell className="border-0 bg-transparent p-0 shadow-none">
      <BoardToolbar
        search={busqueda}
        onSearchChange={setBusqueda}
        searchPlaceholder="Buscar en este tablero"
        left={
          puedeEditar ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 border-[var(--lime)]/50 bg-[var(--lime-lt)] text-[var(--navy)] hover:bg-[var(--lime-lt)]"
              onClick={() => startQuickAdd('por_hacer')}
            >
              <Plus className="size-3.5" />
              Nueva tarea
            </Button>
          ) : undefined
        }
        filterSlot={
          personas.length > 0 ? (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: BOARD.text }}>
              <UserRound className="size-3.5" style={{ color: BOARD.muted }} />
              <select
                className="h-8 rounded-md border bg-transparent px-2 text-xs outline-none"
                style={{ borderColor: BOARD.border }}
                value={filtroPersona}
                onChange={(e) => setFiltroPersona(e.target.value)}
              >
                <option value="todas">Persona</option>
                {personas.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          ) : undefined
        }
        right={
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: BOARD.muted }}>
              {filtradas.length} tarea{filtradas.length === 1 ? '' : 's'}
            </span>
            {puedeEditar && onAddAdvanced && (
              <button
                type="button"
                className="text-xs hover:underline"
                style={{ color: BOARD.muted }}
                onClick={onAddAdvanced}
              >
                Formulario
              </button>
            )}
          </div>
        }
      />

      {filtradas.length === 0 && hayFiltros ? (
        <p className="px-2 py-12 text-center text-sm" style={{ color: BOARD.muted }}>
          No hay tareas con estos filtros.
        </p>
      ) : (
        GRUPOS.map((grupo) => {
          const rows = porGrupo[grupo.id]
          if (rows.length === 0 && grupo.id === 'detenido' && addingGrupo !== 'detenido') {
            return null
          }

          const estadoCounts = (Object.keys(ESTADO_UI) as TareaEstado[]).map((e) => ({
            key: ESTADO_UI[e].label,
            count: rows.filter((t) => t.estado === e).length,
            color: ESTADO_UI[e].bg,
          }))
          const prioCounts = (['Alta', 'Media', 'Baja'] as TareaPrioridad[]).map((p) => ({
            key: p,
            count: rows.filter((t) => t.prioridad === p).length,
            color: PRIORIDAD_UI[p].bg,
          }))
          const archivos = rows.reduce((s, t) => s + (t.adjuntos?.length ?? 0), 0)
          const avanceAvg =
            rows.length === 0
              ? 0
              : Math.round(rows.reduce((s, t) => s + (t.porcentaje ?? 0), 0) / rows.length)

          return (
            <BoardGroup
              key={grupo.id}
              label={grupo.label}
              color={grupo.color}
              count={rows.length}
              defaultOpen={grupo.id !== 'listo'}
              summary={
                rows.length > 0 ? (
                  <div
                    className="grid grid-cols-[8px_minmax(200px,1.4fr)_repeat(8,minmax(70px,1fr))] items-center gap-0 border-t px-2 py-2 text-[11px]"
                    style={{
                      backgroundColor: BOARD.bg,
                      borderColor: BOARD.borderSoft,
                      color: BOARD.muted,
                      minWidth: '1080px',
                    }}
                  >
                    <span />
                    <span className="px-2 font-medium">
                      {rows.length} ítem{rows.length === 1 ? '' : 's'} · {avanceAvg}% promedio
                    </span>
                    <span />
                    <span className="px-1">
                      <BoardDistBar items={estadoCounts} />
                    </span>
                    <span />
                    <span className="px-1">
                      <BoardDistBar items={prioCounts} />
                    </span>
                    <span />
                    <span className="px-2">
                      {archivos > 0 ? `${archivos} archivo${archivos === 1 ? '' : 's'}` : '—'}
                    </span>
                    <span />
                    <span />
                  </div>
                ) : undefined
              }
            >
              <BoardTable minWidth="1180px">
                <thead>
                  <tr className="border-b" style={{ borderColor: BOARD.borderSoft }}>
                    <BoardTh className="w-8" />
                    <BoardTh className="min-w-[220px]">Tarea</BoardTh>
                    <BoardTh className="min-w-[130px]">Persona</BoardTh>
                    <BoardTh className="min-w-[110px]">Estado</BoardTh>
                    <BoardTh className="min-w-[100px]">Fecha</BoardTh>
                    <BoardTh className="min-w-[90px]">Prioridad</BoardTh>
                    <BoardTh className="min-w-[70px]">Avance</BoardTh>
                    <BoardTh className="min-w-[100px]">Monto</BoardTh>
                    <BoardTh className="min-w-[70px]">Archivos</BoardTh>
                    <BoardTh className="min-w-[130px]">Cronograma</BoardTh>
                    <BoardTh className="min-w-[100px]">Actualizado</BoardTh>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const est = ESTADO_UI[t.estado]
                    const salud = evaluarSaludTarea(t, mapa)
                    const finLabel = formatBoardDateShort(t.fecha_fin)
                    const iniLabel = formatBoardDateShort(t.fecha_inicio)
                    const crono =
                      iniLabel && finLabel
                        ? `${iniLabel} – ${finLabel}`
                        : finLabel || iniLabel || '—'
                    const selected = selectedId === t._id
                    return (
                      <tr
                        key={t._id}
                        className={cn(
                          'border-b transition-colors hover:bg-[var(--blue-lt)]/70',
                          selected && 'bg-[var(--lime-lt)]/80',
                          busyId === t._id && 'opacity-60',
                        )}
                        style={{ borderColor: BOARD.borderSoft }}
                      >
                        <td className="px-2 py-1.5 align-middle">
                          <span
                            className="inline-block h-8 w-1 rounded-sm"
                            style={{ backgroundColor: grupo.color }}
                          />
                        </td>
                        <td className="px-2 py-1.5 align-middle">
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
                            <p
                              className="mt-0.5 line-clamp-1 max-w-[300px] text-[11px]"
                              style={{ color: BOARD.muted }}
                            >
                              {t.descripcion}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5 align-middle">
                          <div className="flex items-center gap-1.5">
                            <BoardAvatar name={t.responsable} />
                            <span
                              className="max-w-[90px] truncate text-xs"
                              style={{ color: BOARD.text }}
                            >
                              {t.responsable || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 align-middle">
                          {puedeEditar ? (
                            <select
                              className="cursor-pointer rounded-sm border-0 px-2 py-1 text-[11px] font-semibold outline-none"
                              style={{ backgroundColor: est.bg, color: est.text }}
                              value={t.estado}
                              disabled={busyId === t._id}
                              onChange={(e) =>
                                void patchTarea(t._id, {
                                  estado: e.target.value,
                                  porcentaje:
                                    e.target.value === 'Completado'
                                      ? 100
                                      : t.estado === 'Completado'
                                        ? Math.min(t.porcentaje, 90)
                                        : t.porcentaje,
                                })
                              }
                            >
                              {(Object.keys(ESTADO_UI) as TareaEstado[]).map((e) => (
                                <option key={e} value={e}>
                                  {ESTADO_UI[e].label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <BoardPill label={est.label} bg={est.bg} text={est.text} />
                          )}
                        </td>
                        <td className="px-2 py-1.5 align-middle">
                          <span
                            className="inline-flex items-center gap-1 text-xs"
                            style={{ color: BOARD.text }}
                          >
                            {salud === 'atrasada' ? (
                              <AlertCircle className="size-3.5" style={{ color: BOARD.red }} />
                            ) : t.estado === 'Completado' ? (
                              <CheckCircle2 className="size-3.5" style={{ color: BOARD.green }} />
                            ) : (
                              <Clock className="size-3.5" style={{ color: BOARD.gray }} />
                            )}
                            {finLabel || '—'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 align-middle">
                          {puedeEditar ? (
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
                              disabled={busyId === t._id}
                              onChange={(e) =>
                                void patchTarea(t._id, {
                                  prioridad: e.target.value || null,
                                })
                              }
                            >
                              <option value="">—</option>
                              <option value="Baja">Baja</option>
                              <option value="Media">Media</option>
                              <option value="Alta">Alta</option>
                            </select>
                          ) : t.prioridad ? (
                            <BoardPill
                              label={t.prioridad}
                              bg={PRIORIDAD_UI[t.prioridad].bg}
                              text={PRIORIDAD_UI[t.prioridad].text}
                            />
                          ) : (
                            <span style={{ color: BOARD.gray }}>—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 align-middle">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="h-1.5 w-12 overflow-hidden rounded-full"
                              style={{ backgroundColor: BOARD.borderSoft }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, Math.max(0, t.porcentaje ?? 0))}%`,
                                  backgroundColor: BOARD.accent,
                                }}
                              />
                            </div>
                            <span
                              className="text-[11px] tabular-nums"
                              style={{ color: BOARD.muted }}
                            >
                              {t.porcentaje ?? 0}%
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 align-middle">
                          {t.monto_asignado != null && Number.isFinite(t.monto_asignado) ? (
                            <div className="space-y-0.5">
                              <p
                                className="text-[12px] font-semibold tabular-nums"
                                style={{ color: BOARD.text }}
                              >
                                {formatMoney(
                                  t.monto_asignado,
                                  proyecto.moneda_presupuesto ?? 'HNL',
                                )}
                              </p>
                              <p
                                className="text-[10px] tabular-nums"
                                style={{ color: BOARD.muted }}
                              >
                                ej.{' '}
                                {formatMoney(
                                  tareaMontoEjecutadoEstimado(t),
                                  proyecto.moneda_presupuesto ?? 'HNL',
                                )}
                              </p>
                            </div>
                          ) : (
                            <span style={{ color: BOARD.muted }}>—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 align-middle">
                          {(t.adjuntos?.length ?? 0) > 0 ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs"
                              style={{ color: BOARD.primary }}
                            >
                              <Paperclip className="size-3.5" />
                              {t.adjuntos!.length}
                            </span>
                          ) : (
                            <FileText className="size-3.5" style={{ color: BOARD.gray }} />
                          )}
                        </td>
                        <td className="px-2 py-1.5 align-middle">
                          <span
                            className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{
                              backgroundColor:
                                salud === 'atrasada'
                                  ? BOARD.red
                                  : t.estado === 'Completado'
                                    ? BOARD.green
                                    : BOARD.gray,
                              color:
                                salud === 'atrasada' || t.estado === 'Completado'
                                  ? '#fff'
                                  : BOARD.text,
                            }}
                          >
                            {crono}
                          </span>
                        </td>
                        <td
                          className="px-2 py-1.5 align-middle text-xs"
                          style={{ color: BOARD.muted }}
                        >
                          {relativeUpdate(t.updatedAt)}
                        </td>
                      </tr>
                    )
                  })}
                  {puedeEditar && (
                    <tr className="border-b" style={{ borderColor: BOARD.borderSoft }}>
                      <td colSpan={11} className="px-3 py-1.5">
                        <BoardQuickAdd
                          active={addingGrupo === grupo.id}
                          value={draftNombre}
                          onChange={setDraftNombre}
                          onActivate={() => startQuickAdd(grupo.id)}
                          onCancel={cancelQuickAdd}
                          onSubmit={submitQuickAdd}
                          busy={creating}
                          color={grupo.color}
                          label="Agregar tarea"
                          placeholder={`Nueva tarea en ${grupo.label}…`}
                        />
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
