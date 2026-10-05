import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Columns3, GripVertical, Plus, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  BOARD,
  BoardDistBar,
  BoardAddLink,
  BoardGroup,
  BoardShell,
  BoardTable,
  BoardTh,
  BoardToolbar,
  PRIORIDAD_TONE,
  formatBoardDateShort,
} from '@/components/board/BoardPrimitives'
import { fetchEmpleados } from '@/lib/api/empleados'
import { createTarea, updateTarea } from '@/lib/api/tareas'
import { diasEntre, finDesdeDuracion, hoyIso, isoDia } from '@/lib/fechasTarea'
import {
  COLUMNAS_TAREA,
  ESTADOS_BASE,
  fetchTareaEstados,
  loadColLayout,
  saveColLayout,
  type ColId,
  type ColLayout,
  type TareaEstadoDef,
} from '@/lib/tareaBoardPrefs'
import { formatDateDMY } from '@/lib/format'
import { evaluarSaludTarea, mapaTareas } from '@/lib/tareaDependencias'
import { cn } from '@/lib/utils'
import type { EmpleadoDoc } from '@/types/empleado'
import { useAuthStore } from '@/store/authStore'
import { TareaBoardCelda } from '@/pages/proyectos/TareaBoardCeldas'
import type { Proyecto } from '@/types/proyecto'
import { empleadoIdsDelEquipo } from '@/types/proyecto'
import type { Tarea, TareaEstado, TareaPrioridad } from '@/types/tarea'

type Props = {
  tareas: Tarea[]
  proyecto: Proyecto
  puedeEditar?: boolean
  selectedId?: string | null
  onSelect: (t: Tarea) => void
  /** Abre el formulario completo (opcional). El alta rápida es en línea. */
  onAddAdvanced?: () => void
  onChanged: () => void | Promise<void>
  columnasNonce?: number
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

const PRIORIDAD_UI = PRIORIDAD_TONE

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
  columnasNonce = 0,
}: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroPersona, setFiltroPersona] = useState('todas')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [addingGrupo, setAddingGrupo] = useState<BoardGrupoId | null>(null)
  const [draftNombre, setDraftNombre] = useState('')
  const [draftEstado, setDraftEstado] = useState('Pendiente')
  const [draftResponsableId, setDraftResponsableId] = useState('')
  const [draftPrioridad, setDraftPrioridad] = useState<TareaPrioridad | ''>('Media')
  const [draftDuracion, setDraftDuracion] = useState('5')
  const [draftError, setDraftError] = useState<string | null>(null)
  const [empleados, setEmpleados] = useState<EmpleadoDoc[]>([])
  const [creating, setCreating] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropGrupo, setDropGrupo] = useState<BoardGrupoId | null>(null)
  const userId = useAuthStore((s) => s.user?._id ?? 'local')
  const [catalog, setCatalog] = useState<TareaEstadoDef[]>(ESTADOS_BASE)
  const [layout, setLayout] = useState<ColLayout>(() => loadColLayout(userId))
  const [colsOpen, setColsOpen] = useState(false)

  useEffect(() => {
    void fetchTareaEstados().then(setCatalog).catch(() => setCatalog(ESTADOS_BASE))
    setLayout(loadColLayout(userId))
  }, [userId, columnasNonce])

  function persistLayout(next: ColLayout) {
    setLayout(next)
    saveColLayout(userId, next)
  }

  function esListo(clave: string) {
    return catalog.find((e) => e.clave === clave)?.grupo === 'listo'
  }

  function uiDe(clave: string) {
    const c = catalog.find((e) => e.clave === clave)
    if (!c) return { label: clave, bg: BOARD.gray, text: BOARD.text }
    return {
      label: c.etiqueta,
      bg: c.color,
      text: c.grupo === 'por_hacer' ? BOARD.text : '#fff',
    }
  }

  const visibles = layout.order.filter((id) => !layout.hidden.includes(id))

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
    for (const t of filtradas) {
      const g = catalog.find((e) => e.clave === t.estado)?.grupo ?? 'por_hacer'
      out[g].push(t)
    }
    return out
  }, [filtradas, catalog])

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

  async function dropEnGrupo(grupoId: BoardGrupoId, tareaId: string) {
    const t = tareas.find((x) => x._id === tareaId)
    const estado = catalog.find((e) => e.grupo === grupoId)?.clave ?? estadoDefaultGrupo(grupoId)
    if (!t || t.estado === estado || !puedeEditar) {
      setDraggingId(null)
      setDropGrupo(null)
      return
    }
    const destinoListo = catalog.find((e) => e.clave === estado)?.grupo === 'listo'
    const origenListo = esListo(t.estado)
    await patchTarea(tareaId, {
      estado,
      porcentaje: destinoListo ? 100 : origenListo ? Math.min(t.porcentaje, 90) : t.porcentaje,
    })
    setDraggingId(null)
    setDropGrupo(null)
  }

  useEffect(() => {
    if (!puedeEditar) return
    void fetchEmpleados({ activo: true }).then(setEmpleados).catch(() => setEmpleados([]))
  }, [puedeEditar])

  const empleadosEquipo = useMemo(() => {
    const ids = new Set(empleadoIdsDelEquipo(proyecto))
    return empleados.filter((e) => ids.has(String(e._id)))
  }, [empleados, proyecto])

  function startQuickAdd(grupoId: BoardGrupoId) {
    setAddingGrupo(grupoId)
    setDraftNombre('')
    setDraftEstado(catalog.find((e) => e.grupo === grupoId)?.clave ?? estadoDefaultGrupo(grupoId))
    setDraftResponsableId('')
    setDraftPrioridad('Media')
    setDraftDuracion('5')
    setDraftError(null)
  }

  function cancelQuickAdd() {
    if (creating) return
    setAddingGrupo(null)
    setDraftNombre('')
    setDraftError(null)
  }

  async function submitQuickAdd() {
    if (!addingGrupo || !puedeEditar) return
    const nombre = draftNombre.trim()
    const responsable = empleados.find((e) => e._id === draftResponsableId)
    const dias = Math.floor(Number(draftDuracion))
    if (!nombre || !responsable || !draftEstado || !draftPrioridad || !Number.isFinite(dias) || dias < 1) {
      setDraftError('Indica nombre, asignado, estado, prioridad y duración.')
      return
    }
    const inicio = isoDia(proyecto.fecha_inicio) || hoyIso()
    const fin = finDesdeDuracion(inicio, dias)
    setDraftError(null)
    setCreating(true)
    try {
      await createTarea({
        proyecto_id: proyecto._id,
        nombre,
        estado: draftEstado,
        prioridad: draftPrioridad,
        fecha_inicio: new Date(`${inicio}T12:00:00`),
        fecha_fin: new Date(`${fin}T12:00:00`),
        duracion_dias: dias,
        responsable: responsable.nombre,
        responsable_id: responsable._id,
        porcentaje: esListo(draftEstado) ? 100 : 0,
        eje: proyecto.eje,
      })
      setDraftNombre('')
      setDraftDuracion('5')
      await onChanged()
      setAddingGrupo(addingGrupo)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo crear la tarea')
    } finally {
      setCreating(false)
    }
  }

  function startResize(id: ColId, event: ReactMouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startW = layout.widths[id] ?? 100
    function move(ev: MouseEvent) {
      const w = Math.max(70, Math.min(420, startW + ev.clientX - startX))
      setLayout((prev) => ({ ...prev, widths: { ...prev.widths, [id]: w } }))
    }
    function up() {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      setLayout((prev) => {
        saveColLayout(userId, prev)
        return prev
      })
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
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
              {puedeEditar ? ' · arrastra entre grupos' : ''}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs hover:underline"
              style={{ color: BOARD.muted }}
              onClick={() => setColsOpen((v) => !v)}
            >
              <Columns3 className="size-3.5" />
              Columnas
            </button>
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

      {colsOpen && (
        <div
          className="mb-2 grid gap-1 rounded-md border bg-white p-2 text-xs"
          style={{ borderColor: BOARD.border }}
        >
          {layout.order.map((id, index) => {
            const meta = COLUMNAS_TAREA.find((c) => c.id === id)
            if (!meta) return null
            const hidden = layout.hidden.includes(id)
            return (
              <div key={id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!hidden}
                  disabled={id === 'tarea'}
                  aria-label={`Mostrar ${meta.label}`}
                  onChange={() => {
                    const hiddenNext = hidden
                      ? layout.hidden.filter((x) => x !== id)
                      : [...layout.hidden, id]
                    persistLayout({ ...layout, hidden: hiddenNext })
                  }}
                />
                <span className="w-24">{meta.label}</span>
                <button
                  type="button"
                  className="rounded border px-1.5 disabled:opacity-30"
                  disabled={index === 0}
                  onClick={() => {
                    const order = [...layout.order]
                    const [item] = order.splice(index, 1)
                    order.splice(index - 1, 0, item)
                    persistLayout({ ...layout, order })
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="rounded border px-1.5 disabled:opacity-30"
                  disabled={index === layout.order.length - 1}
                  onClick={() => {
                    const order = [...layout.order]
                    const [item] = order.splice(index, 1)
                    order.splice(index + 1, 0, item)
                    persistLayout({ ...layout, order })
                  }}
                >
                  ↓
                </button>
                <input
                  type="range"
                  min={70}
                  max={360}
                  aria-label={`Ancho de ${meta.label}`}
                  value={layout.widths[id] ?? meta.width}
                  onChange={(e) =>
                    persistLayout({
                      ...layout,
                      widths: { ...layout.widths, [id]: Number(e.target.value) },
                    })
                  }
                />
              </div>
            )
          })}
        </div>
      )}

      {filtradas.length === 0 && hayFiltros ? (
        <p className="px-2 py-12 text-center text-sm" style={{ color: BOARD.muted }}>
          No hay tareas con estos filtros.
        </p>
      ) : (
        GRUPOS.map((grupo) => {
          const rows = porGrupo[grupo.id]
          if (
            rows.length === 0
            && grupo.id === 'detenido'
            && addingGrupo !== 'detenido'
            && !draggingId
          ) {
            return null
          }

          const estadoCounts = catalog
            .filter((e) => e.grupo === grupo.id)
            .map((e) => ({
              key: e.etiqueta,
              count: rows.filter((t) => t.estado === e.clave).length,
              color: e.color,
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
            <div
              key={grupo.id}
              className={cn(dropGrupo === grupo.id && 'rounded-md ring-2 ring-[var(--lime)] ring-offset-1')}
              onDragOver={(e) => {
                if (!puedeEditar || !draggingId) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDropGrupo(grupo.id)
              }}
              onDragLeave={() => setDropGrupo((g) => (g === grupo.id ? null : g))}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/tarea-id') || e.dataTransfer.getData('text/plain')
                if (id) void dropEnGrupo(grupo.id, id)
              }}
            >
            <BoardGroup
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
                    {visibles.map((id) => {
                      const meta = COLUMNAS_TAREA.find((c) => c.id === id)
                      const w = layout.widths[id] ?? meta?.width ?? 100
                      return (
                        <th
                          key={id}
                          draggable
                          className="px-2 py-2 text-left text-[11px] font-medium uppercase tracking-wide"
                          style={{ color: BOARD.muted, backgroundColor: BOARD.bg, width: w, minWidth: w }}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/col-id', id)
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragOver={(e) => {
                            if ([...e.dataTransfer.types].includes('text/col-id')) e.preventDefault()
                          }}
                          onDrop={(e) => {
                            const from = e.dataTransfer.getData('text/col-id') as ColId
                            if (!from || from === id) return
                            e.preventDefault()
                            e.stopPropagation()
                            const order = [...layout.order]
                            const a = order.indexOf(from)
                            const b = order.indexOf(id)
                            if (a < 0 || b < 0) return
                            order.splice(a, 1)
                            order.splice(b, 0, from)
                            persistLayout({ ...layout, order })
                          }}
                        >
                          <span className="inline-flex w-full items-center justify-between gap-1">
                            {meta?.label}
                            <span
                              className="inline-block h-4 w-1 cursor-col-resize rounded-sm bg-current opacity-30"
                              onMouseDown={(e) => startResize(id, e)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </span>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const est = uiDe(t.estado)
                    const listo = esListo(t.estado)
                    const salud = evaluarSaludTarea(t, mapa)
                    const finLabel = formatBoardDateShort(t.fecha_fin)
                    const iniLabel = formatBoardDateShort(t.fecha_inicio)
                    const rango =
                      iniLabel && finLabel
                        ? `${iniLabel} – ${finLabel}`
                        : finLabel || iniLabel || ''
                    const dias = t.duracion_dias && t.duracion_dias >= 1
                      ? t.duracion_dias
                      : (t.fecha_inicio && t.fecha_fin
                        ? diasEntre(t.fecha_inicio.slice(0, 10), t.fecha_fin.slice(0, 10))
                        : 0)
                    const crono = rango
                      ? (dias >= 1 ? `${rango} · ${dias} d` : rango)
                      : '—'
                    const selected = selectedId === t._id
                    return (
                      <tr
                        key={t._id}
                        className={cn(
                          'border-b transition-colors hover:bg-[var(--blue-lt)]/70',
                          selected && 'bg-[var(--lime-lt)]/80',
                          (busyId === t._id || draggingId === t._id) && 'opacity-60',
                        )}
                        style={{ borderColor: BOARD.borderSoft }}
                      >
                        <td className="px-2 py-1.5 align-middle">
                          <span className="inline-flex items-center gap-1">
                            {puedeEditar ? (
                              <span
                                draggable={busyId !== t._id}
                                className="cursor-grab active:cursor-grabbing"
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/tarea-id', t._id)
                                  e.dataTransfer.setData('text/plain', t._id)
                                  e.dataTransfer.effectAllowed = 'move'
                                  setDraggingId(t._id)
                                }}
                                onDragEnd={() => {
                                  setDraggingId(null)
                                  setDropGrupo(null)
                                }}
                                title="Arrastrar a otro grupo"
                              >
                                <GripVertical className="size-3.5 text-muted-foreground" aria-hidden />
                              </span>
                            ) : null}
                            <span
                              className="inline-block h-8 w-1 rounded-sm"
                              style={{ backgroundColor: grupo.color }}
                            />
                          </span>
                        </td>
                        {visibles.map((col) => (
                          <td
                            key={col}
                            className="px-2 py-1.5 align-middle"
                            style={{
                              width: layout.widths[col],
                              minWidth: layout.widths[col],
                            }}
                          >
                            <TareaBoardCelda
                              col={col}
                              t={t}
                              proyecto={proyecto}
                              puedeEditar={puedeEditar}
                              busy={busyId === t._id}
                              est={est}
                              listo={listo}
                              salud={salud}
                              finLabel={finLabel || ''}
                              crono={crono}
                              actualizado={relativeUpdate(t.updatedAt)}
                              catalog={catalog}
                              equipo={empleadosEquipo.map((e) => ({ _id: String(e._id), nombre: e.nombre }))}
                              onSelect={onSelect}
                              onPatch={(id, patch) => void patchTarea(id, patch)}
                            />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                  {puedeEditar && (
                    <tr className="border-b" style={{ borderColor: BOARD.borderSoft }}>
                      <td colSpan={visibles.length + 1} className="px-3 py-1.5">
                        {addingGrupo === grupo.id ? (
                          <form
                            className="flex flex-wrap items-center gap-2 py-0.5"
                            onSubmit={(e) => {
                              e.preventDefault()
                              void submitQuickAdd()
                            }}
                          >
                            <span
                              className="inline-block h-7 w-1 shrink-0 rounded-sm"
                              style={{ backgroundColor: grupo.color }}
                            />
                            <input
                              autoFocus
                              required
                              value={draftNombre}
                              disabled={creating}
                              placeholder="Nombre de la tarea"
                              className="h-8 min-w-[180px] flex-1 rounded-md border bg-white px-2 text-[13px] outline-none focus-visible:border-[var(--navy)]"
                              style={{ borderColor: BOARD.border, color: BOARD.text }}
                              onChange={(e) => setDraftNombre(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  e.preventDefault()
                                  cancelQuickAdd()
                                }
                              }}
                            />
                            <select
                              aria-label="Asignado"
                              required
                              value={draftResponsableId}
                              disabled={creating}
                              className="h-8 max-w-[180px] rounded-md border bg-white px-2 text-xs"
                              style={{ borderColor: BOARD.border, color: BOARD.text }}
                              onChange={(e) => setDraftResponsableId(e.target.value)}
                            >
                              <option value="">Asignado</option>
                              {empleadosEquipo.length === 0 ? (
                                <option value="" disabled>Sin personas en el equipo</option>
                              ) : empleadosEquipo.map((emp) => (
                                <option key={emp._id} value={emp._id}>{emp.nombre}</option>
                              ))}
                            </select>
                            <select
                              aria-label="Estado"
                              value={draftEstado}
                              disabled={creating}
                              className="h-8 rounded-md border bg-white px-2 text-xs"
                              style={{ borderColor: BOARD.border, color: BOARD.text }}
                              onChange={(e) => setDraftEstado(e.target.value)}
                            >
                              {catalog.map((estado) => (
                                <option key={estado.clave} value={estado.clave}>{estado.etiqueta}</option>
                              ))}
                            </select>
                            <input
                              aria-label="Duración en días"
                              type="number"
                              min={1}
                              step={1}
                              required
                              value={draftDuracion}
                              disabled={creating}
                              title="Días de duración. El inicio es la fecha de arranque del proyecto."
                              className="h-8 w-16 rounded-md border bg-white px-2 text-xs"
                              style={{ borderColor: BOARD.border, color: BOARD.text }}
                              onChange={(e) => setDraftDuracion(e.target.value)}
                            />
                            <span className="whitespace-nowrap text-[11px]" style={{ color: BOARD.muted }}>
                              {(() => {
                                const dias = Math.max(1, Math.floor(Number(draftDuracion) || 1))
                                const inicio = isoDia(proyecto.fecha_inicio) || hoyIso()
                                const fin = finDesdeDuracion(inicio, dias)
                                return `${formatBoardDateShort(`${inicio}T12:00:00`)} – ${formatBoardDateShort(`${fin}T12:00:00`)}`
                              })()}
                            </span>
                            <select
                              aria-label="Prioridad"
                              required
                              value={draftPrioridad}
                              disabled={creating}
                              className="h-8 rounded-md border bg-white px-2 text-xs"
                              style={{ borderColor: BOARD.border, color: BOARD.text }}
                              onChange={(e) => setDraftPrioridad(e.target.value as TareaPrioridad | '')}
                            >
                              <option value="">Prioridad</option>
                              <option value="Alta">Alta</option>
                              <option value="Media">Media</option>
                              <option value="Baja">Baja</option>
                            </select>
                            <button
                              type="submit"
                              disabled={creating}
                              className="h-8 shrink-0 rounded-md px-3 text-xs font-semibold text-white disabled:opacity-40"
                              style={{ backgroundColor: BOARD.primary }}
                            >
                              {creating ? '…' : 'Agregar'}
                            </button>
                            <button
                              type="button"
                              className="h-8 px-2 text-xs"
                              style={{ color: BOARD.muted }}
                              onClick={cancelQuickAdd}
                            >
                              Cancelar
                            </button>
                            {draftError && (
                              <p className="basis-full text-[11px] text-destructive">{draftError}</p>
                            )}
                          </form>
                        ) : (
                          <BoardAddLink onClick={() => startQuickAdd(grupo.id)} label="Agregar tarea" />
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </BoardTable>
            </BoardGroup>
            </div>
          )
        })
      )}
    </BoardShell>
  )
}
