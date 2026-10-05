import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, GripVertical, Inbox, Plus } from 'lucide-react'

import { BOARD, BoardPill, prioridadTone } from '@/components/board/BoardPrimitives'
import { Button } from '@/components/ui/button'
import { fetchMiDia, type MiDiaAprobacion, type MiDiaTarea } from '@/lib/api/dashboard'
import { fetchEmpleados } from '@/lib/api/empleados'
import { deleteTarea, fetchTareasMias, updateTarea, type TareaMia } from '@/lib/api/tareas'
import { cn } from '@/lib/utils'
import { DashboardPersonalTodos } from '@/pages/dashboard/DashboardPersonalTodos'
import { TareaRapidaDialog } from '@/pages/inicio/TareaRapidaDialog'
import { MiDiaReuniones } from '@/pages/inicio/MiDiaReuniones'
import { useAuthStore } from '@/store/authStore'
import type { EmpleadoDoc } from '@/types/empleado'

type SeccionId = 'vencidas' | 'hoy' | 'proximas' | 'completadas'

const SECCIONES: Array<{
  id: SeccionId
  label: string
  hint: string
  color: string
}> = [
  { id: 'vencidas', label: 'Urgente', hint: 'Vencidas', color: BOARD.red },
  { id: 'hoy', label: 'Hoy', hint: 'Para hoy', color: BOARD.orange },
  { id: 'proximas', label: 'Próximas', hint: 'Después de hoy o sin fecha', color: BOARD.blue },
  { id: 'completadas', label: 'Completadas', hint: 'Últimos 14 días', color: BOARD.green },
]

function saludoHora(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function prioridadUi(p: string | null): { bg: string; text: string } {
  if (!p) return { bg: BOARD.borderSoft, text: BOARD.muted }
  return prioridadTone(p)
}

function ordenKey(userId: string, seccion: string) {
  return `rcj_mi_dia_orden_${userId}_${seccion}`
}

function loadOrden(userId: string, seccion: string): string[] {
  try {
    const raw = localStorage.getItem(ordenKey(userId, seccion))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function saveOrden(userId: string, seccion: string, ids: string[]) {
  try {
    localStorage.setItem(ordenKey(userId, seccion), JSON.stringify(ids))
  } catch {
    /* noop */
  }
}

function applyOrden(rows: MiDiaTarea[], orden: string[]): MiDiaTarea[] {
  if (orden.length === 0) return rows
  const rank = new Map(orden.map((id, i) => [id, i]))
  return [...rows].sort((a, b) => (rank.get(a._id) ?? 10000) - (rank.get(b._id) ?? 10000))
}

function mover(rows: MiDiaTarea[], dragId: string, dropId: string): MiDiaTarea[] {
  const from = rows.findIndex((r) => r._id === dragId)
  const to = rows.findIndex((r) => r._id === dropId)
  if (from < 0 || to < 0 || from === to) return rows
  const next = [...rows]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

function fechaLarga(): string {
  const s = new Date().toLocaleDateString('es-HN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function fraseEjecutiva(d: {
  vencidas: MiDiaTarea[]
  hoy: MiDiaTarea[]
  proximas: MiDiaTarea[]
  aprobaciones: MiDiaAprobacion[]
}): string {
  const partes: string[] = []
  if (d.vencidas.length === 1) partes.push('1 tema requiere atención')
  else if (d.vencidas.length > 1) partes.push(`${d.vencidas.length} temas requieren atención`)
  if (d.hoy.length === 1) partes.push('1 compromiso para hoy')
  else if (d.hoy.length > 1) partes.push(`${d.hoy.length} compromisos para hoy`)
  if (d.aprobaciones.length === 1) partes.push('1 aprobación por firmar')
  else if (d.aprobaciones.length > 1) partes.push(`${d.aprobaciones.length} aprobaciones por firmar`)
  if (partes.length === 0) {
    if (d.proximas.length === 0) return 'El día está al día. No hay temas abiertos en la bandeja.'
    return d.proximas.length === 1
      ? 'El día está al día. Queda 1 tarea para más adelante.'
      : `El día está al día. Quedan ${d.proximas.length} tareas para más adelante.`
  }
  return `${partes.join('. ')}.`
}

function TareaRow({
  t,
  busy,
  empleados,
  dragging,
  presentacion = false,
  onToggle,
  onPrioridad,
  onFecha,
  onResponsable,
  onOpen,
  onDragStart,
  onDrop,
}: {
  t: MiDiaTarea
  busy: boolean
  empleados: EmpleadoDoc[]
  dragging: boolean
  presentacion?: boolean
  onToggle: () => void
  onPrioridad: (v: string) => void
  onFecha: (v: string) => void
  onResponsable: (id: string, nombre: string) => void
  onOpen: () => void
  onDragStart?: () => void
  onDrop?: () => void
}) {
  const done = t.estado === 'Completado'
  const canDrag = Boolean(onDragStart && onDrop)
  const tone = prioridadUi(t.prioridad)
  if (presentacion) {
    return (
      <div
        className={cn(
          'group flex items-center gap-3 border-b px-4 py-3 last:border-b-0',
          busy && 'opacity-60',
          dragging && 'bg-[var(--lime-lt)]',
        )}
        style={{ borderColor: BOARD.borderSoft }}
        onDragOver={(e) => { if (canDrag) e.preventDefault() }}
        onDrop={(e) => {
          if (!canDrag || !onDrop) return
          e.preventDefault()
          onDrop()
        }}
      >
        {canDrag && (
          <span
            draggable
            onDragStart={onDragStart}
            className="cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 active:cursor-grabbing"
            title="Arrastrar para ordenar"
          >
            <GripVertical className="size-4" />
          </span>
        )}
        <button
          type="button"
          className="flex size-5 shrink-0 items-center justify-center rounded-full border"
          style={{
            borderColor: done ? BOARD.green : BOARD.border,
            backgroundColor: done ? BOARD.green : '#fff',
            color: '#fff',
          }}
          onClick={onToggle}
          aria-label={done ? 'Marcar pendiente' : 'Completar'}
        >
          {done ? <CheckCircle2 className="size-3.5" /> : null}
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <p className={cn('truncate text-[15px] font-medium', done && 'line-through opacity-60')} style={{ color: BOARD.text }}>
            {t.nombre}
          </p>
          <p className="truncate text-xs" style={{ color: BOARD.muted }}>
            {t.proyecto_nombre || 'Personal'}
            {' · '}
            {t.porcentaje}% de avance
          </p>
        </button>
        <select
          aria-label="Responsable"
          className="hidden h-7 max-w-[150px] truncate border-0 bg-transparent px-1 text-xs md:block"
          style={{ color: BOARD.muted }}
          value={t.responsable_id || ''}
          disabled={busy}
          onChange={(e) => {
            const id = e.target.value
            const emp = empleados.find((x) => x._id === id)
            onResponsable(id, emp?.nombre ?? '')
          }}
        >
          <option value="">{t.responsable || 'Sin responsable'}</option>
          {empleados.map((emp) => (
            <option key={emp._id} value={emp._id}>{emp.nombre}</option>
          ))}
        </select>
        <select
          aria-label="Prioridad"
          className="h-7 rounded-full border-0 px-2.5 text-[11px] font-semibold"
          style={{ backgroundColor: tone.bg, color: tone.text }}
          value={t.prioridad ?? ''}
          disabled={busy}
          onChange={(e) => onPrioridad(e.target.value)}
        >
          <option value="">Prioridad</option>
          <option value="Alta">Alta</option>
          <option value="Media">Media</option>
          <option value="Baja">Baja</option>
        </select>
        <input
          type="date"
          aria-label="Fecha de vencimiento"
          className="h-7 w-[132px] rounded-md border bg-white px-2 text-xs"
          style={{ borderColor: BOARD.border, color: BOARD.text }}
          value={t.fecha_fin ? t.fecha_fin.slice(0, 10) : ''}
          disabled={busy}
          onChange={(e) => onFecha(e.target.value)}
        />
      </div>
    )
  }
  return (
    <div
      className={cn(
        'grid items-center gap-2 border-b px-2 py-2 text-sm',
        canDrag
          ? 'md:grid-cols-[auto_auto_minmax(0,1.4fr)_minmax(0,1fr)_90px_110px_90px_70px]'
          : 'md:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_90px_110px_90px_70px]',
        busy && 'opacity-60',
        dragging && 'bg-[var(--lime-lt)]',
      )}
      style={{ borderColor: BOARD.borderSoft }}
      onDragOver={(e) => { if (canDrag) e.preventDefault() }}
      onDrop={(e) => {
        if (!canDrag || !onDrop) return
        e.preventDefault()
        onDrop()
      }}
    >
      {canDrag && (
      <span
        draggable
        onDragStart={onDragStart}
        className="cursor-grab text-muted-foreground active:cursor-grabbing"
        title="Arrastrar para ordenar"
      >
        <GripVertical className="size-4" />
      </span>
      )}
      <button
        type="button"
        className="flex size-5 items-center justify-center rounded-sm border"
        style={{
          borderColor: done ? BOARD.green : BOARD.border,
          backgroundColor: done ? BOARD.green : '#fff',
          color: '#fff',
        }}
        onClick={onToggle}
        aria-label={done ? 'Marcar pendiente' : 'Completar'}
      >
        {done ? <CheckCircle2 className="size-3.5" /> : null}
      </button>
      <button
        type="button"
        className="min-w-0 text-left"
        onClick={onOpen}
      >
        <p className={cn('truncate font-medium', done && 'line-through opacity-60')} style={{ color: BOARD.text }}>
          {t.nombre}
        </p>
        <p className="truncate text-[11px]" style={{ color: BOARD.muted }}>
          {t.proyecto_nombre || 'Personal'}
        </p>
      </button>
      <select
        className="hidden h-7 max-w-full truncate rounded-sm border bg-white px-1 text-[11px] md:block"
        style={{ borderColor: BOARD.border, color: BOARD.text }}
        value={t.responsable_id || ''}
        disabled={busy}
        onChange={(e) => {
          const id = e.target.value
          const emp = empleados.find((x) => x._id === id)
          onResponsable(id, emp?.nombre ?? '')
        }}
      >
        <option value="">{t.responsable || 'Sin responsable'}</option>
        {empleados.map((emp) => (
          <option key={emp._id} value={emp._id}>{emp.nombre}</option>
        ))}
      </select>
      <select
        className="h-7 rounded-sm border-0 px-1 text-[11px] font-semibold"
        style={{
          backgroundColor: prioridadUi(t.prioridad).bg,
          color: prioridadUi(t.prioridad).text,
        }}
        value={t.prioridad ?? ''}
        disabled={busy}
        onChange={(e) => onPrioridad(e.target.value)}
      >
        <option value="">—</option>
        <option value="Alta">Alta</option>
        <option value="Media">Media</option>
        <option value="Baja">Baja</option>
      </select>
      <input
        type="date"
        className="h-7 rounded-sm border bg-white px-1 text-[11px]"
        style={{ borderColor: BOARD.border, color: BOARD.text }}
        value={t.fecha_fin ? t.fecha_fin.slice(0, 10) : ''}
        disabled={busy}
        onChange={(e) => onFecha(e.target.value)}
      />
      <BoardPill
        label={t.estado}
        bg={t.estado === 'Bloqueado' ? BOARD.red : t.estado === 'En progreso' ? BOARD.orange : BOARD.gray}
        text={t.estado === 'Pendiente' ? BOARD.text : '#fff'}
      />
      <span className="text-right text-[11px] tabular-nums" style={{ color: BOARD.muted }}>
        {t.porcentaje}%
      </span>
    </div>
  )
}

type Props = {
  soloPendientes?: boolean
}

export function MiDiaPage({ soloPendientes = false }: Props) {
  if (soloPendientes) return <MisTareasView />
  return <MiDiaView />
}

function MisTareasView() {
  const navigate = useNavigate()
  const [asignadas, setAsignadas] = useState<TareaMia[]>([])
  const [creadas, setCreadas] = useState<TareaMia[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'mias' | 'asigne'>('mias')
  const [soloAbiertas, setSoloAbiertas] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TareaMia | null>(null)
  const [empleados, setEmpleados] = useState<EmpleadoDoc[]>([])

  const reload = useCallback(async () => {
    try {
      setErr(null)
      const data = await fetchTareasMias()
      setAsignadas(data.asignadas)
      setCreadas(data.creadas)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudieron cargar las tareas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    void fetchEmpleados({ activo: true }).then(setEmpleados).catch(() => setEmpleados([]))
  }, [reload])

  const rows = useMemo(() => {
    const src = tab === 'mias' ? asignadas : creadas
    if (!soloAbiertas) return src
    return src.filter((t) => t.estado !== 'Completado')
  }, [tab, asignadas, creadas, soloAbiertas])

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id)
    try {
      await updateTarea(id, body)
      await reload()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo actualizar')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(t: TareaMia): Promise<boolean> {
    if (!window.confirm(`¿Eliminar «${t.nombre}»?`)) return false
    setBusyId(t._id)
    try {
      await deleteTarea(t._id)
      await reload()
      return true
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo eliminar')
      return false
    } finally {
      setBusyId(null)
    }
  }

  const abiertasMias = asignadas.filter((t) => t.estado !== 'Completado').length

  return (
    <div className="w-full space-y-4 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--navy)]">Mis tareas</h1>
          <p className="text-sm text-muted-foreground">
            {loading
              ? 'Cargando…'
              : `${abiertasMias} asignada${abiertasMias === 1 ? '' : 's'} abierta${abiertasMias === 1 ? '' : 's'} · puedes crear tareas sin proyecto`}
          </p>
        </div>
        <Button
          type="button"
          className="gap-1.5 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus className="size-4" />
          Nueva tarea
        </Button>
      </header>

      {err && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {err}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
          <button
            type="button"
            className={cn(
              'rounded-md px-3 py-1.5 font-medium',
              tab === 'mias' ? 'bg-white text-[var(--navy)] shadow-sm' : 'text-muted-foreground',
            )}
            onClick={() => setTab('mias')}
          >
            Para mí ({asignadas.length})
          </button>
          <button
            type="button"
            className={cn(
              'rounded-md px-3 py-1.5 font-medium',
              tab === 'asigne' ? 'bg-white text-[var(--navy)] shadow-sm' : 'text-muted-foreground',
            )}
            onClick={() => setTab('asigne')}
          >
            Que asigné ({creadas.length})
          </button>
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="accent-[var(--lime)]"
            checked={soloAbiertas}
            onChange={(e) => setSoloAbiertas(e.target.checked)}
          />
          Solo abiertas
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando tareas…</p>
      ) : rows.length === 0 ? (
        <div
          className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center"
          style={{ borderColor: BOARD.border, color: BOARD.muted }}
        >
          <Inbox className="size-8" />
          <p className="text-sm">
            {tab === 'mias'
              ? 'No tienes tareas asignadas.'
              : 'Aún no has asignado tareas a otras personas.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Crear una tarea
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white" style={{ borderColor: BOARD.border }}>
          <div
            className="hidden grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1fr)_90px_110px_90px_70px] gap-2 border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wide md:grid"
            style={{ borderColor: BOARD.borderSoft, color: BOARD.muted }}
          >
            <span />
            <span>Tarea</span>
            <span>Responsable</span>
            <span>Prioridad</span>
            <span>Vence</span>
            <span>Estado</span>
            <span />
          </div>
          {rows.map((t) => {
            const asMiDia: MiDiaTarea = {
              _id: t._id,
              nombre: t.nombre,
              proyecto_id: t.proyecto_id,
              proyecto_nombre: t.proyecto_nombre || 'Personal',
              responsable: t.responsable || 'Sin asignar',
              responsable_id: t.responsable_id,
              fecha_fin: t.fecha_fin,
              estado: t.estado,
              prioridad: t.prioridad,
              porcentaje: t.porcentaje,
            }
            return (
                <TareaRow
                  key={t._id}
                  t={asMiDia}
                  busy={busyId === t._id}
                  empleados={empleados}
                  dragging={false}
                  onToggle={() =>
                    void patch(t._id, {
                      estado: t.estado === 'Completado' ? 'Pendiente' : 'Completado',
                      porcentaje: t.estado === 'Completado' ? Math.min(t.porcentaje, 90) : 100,
                    })
                  }
                  onPrioridad={(v) => void patch(t._id, { prioridad: v || null })}
                  onFecha={(v) => void patch(t._id, { fecha_fin: v || null })}
                  onResponsable={(id, nombre) => void patch(t._id, { responsable_id: id || null, responsable: nombre })}
                  onOpen={() => {
                    if (t.proyecto_id) {
                      navigate(`/proyectos/${encodeURIComponent(t.proyecto_id)}`)
                      return
                    }
                    setEditing(t)
                    setFormOpen(true)
                  }}
                />
            )
          })}
        </div>
      )}

      <TareaRapidaDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o)
          if (!o) setEditing(null)
        }}
        editing={editing}
        onSaved={() => void reload()}
        onDeleted={
          editing && !editing.proyecto_id
            ? () => {
                void (async () => {
                  const ok = await remove(editing)
                  if (ok) {
                    setFormOpen(false)
                    setEditing(null)
                  }
                })()
              }
            : undefined
        }
      />
    </div>
  )
}

function MiDiaView() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [data, setData] = useState<{
    vencidas: MiDiaTarea[]
    hoy: MiDiaTarea[]
    proximas: MiDiaTarea[]
    completadas: MiDiaTarea[]
    aprobaciones: MiDiaAprobacion[]
  } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [empleados, setEmpleados] = useState<EmpleadoDoc[]>([])
  const [drag, setDrag] = useState<{ seccion: SeccionId; id: string } | null>(null)
  const [ordenTick, setOrdenTick] = useState(0)
  const [detalle, setDetalle] = useState<TareaMia | null>(null)

  const reload = useCallback(async () => {
    try {
      setErr(null)
      const res = await fetchMiDia()
      setData({
        vencidas: res.vencidas,
        hoy: res.hoy,
        proximas: res.proximas,
        completadas: res.completadas,
        aprobaciones: res.aprobaciones ?? [],
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo cargar Mi día')
    }
  }, [])

  useEffect(() => {
    void reload()
    void fetchEmpleados({ activo: true }).then(setEmpleados).catch(() => setEmpleados([]))
  }, [reload])

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id)
    try {
      await updateTarea(id, body)
      await reload()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo actualizar')
    } finally {
      setBusyId(null)
    }
  }

  const firstName = (user?.nombre ?? 'allí').split(/\s+/)[0]
  const totalPendiente = useMemo(() => {
    if (!data) return 0
    return data.vencidas.length + data.hoy.length + data.proximas.length
  }, [data])

  function filasDe(id: SeccionId): MiDiaTarea[] {
    if (!data) return []
    return applyOrden(data[id], user ? loadOrden(user._id, id) : [])
  }

  function renderSeccion(id: SeccionId) {
    const sec = SECCIONES.find((s) => s.id === id)!
    const rows = filasDe(id)
    void ordenTick
    if (rows.length === 0 && (id === 'completadas' || id === 'proximas' || id === 'vencidas')) return null
    return (
      <section
        key={id}
        className="overflow-hidden rounded-xl border bg-white shadow-sm"
        style={{ borderColor: BOARD.border }}
      >
        <div
          className="flex items-center justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: BOARD.borderSoft }}
        >
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ backgroundColor: sec.color }} />
            <h2 className="text-sm font-semibold text-[var(--navy)]">{sec.label}</h2>
            <span className="text-xs" style={{ color: BOARD.muted }}>{sec.hint}</span>
          </div>
          <span className="text-sm font-semibold tabular-nums text-[var(--navy)]">{rows.length}</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-sm" style={{ color: BOARD.muted }}>
            Nada vence hoy.
          </p>
        ) : (
          rows.map((t) => (
            <TareaRow
              key={t._id}
              presentacion
              t={t}
              busy={busyId === t._id}
              empleados={empleados}
              dragging={drag?.id === t._id}
              onToggle={() =>
                void patch(t._id, {
                  estado: t.estado === 'Completado' ? 'Pendiente' : 'Completado',
                  porcentaje: t.estado === 'Completado' ? Math.min(t.porcentaje, 90) : 100,
                })
              }
              onPrioridad={(v) => void patch(t._id, { prioridad: v || null })}
              onFecha={(v) => void patch(t._id, { fecha_fin: v || null })}
              onResponsable={(id, nombre) => void patch(t._id, { responsable_id: id || null, responsable: nombre })}
              onOpen={() => {
                if (t.proyecto_id) {
                  navigate(`/proyectos/${encodeURIComponent(t.proyecto_id)}`)
                  return
                }
                setDetalle({
                  _id: t._id,
                  nombre: t.nombre,
                  proyecto_id: '',
                  proyecto_nombre: 'Personal',
                  responsable: t.responsable,
                  responsable_id: t.responsable_id,
                  fecha_fin: t.fecha_fin,
                  estado: t.estado,
                  prioridad: t.prioridad,
                  porcentaje: t.porcentaje,
                })
              }}
              onDragStart={() => setDrag({ seccion: id, id: t._id })}
              onDrop={() => {
                if (!drag || drag.seccion !== id || !user) return
                const next = mover(rows, drag.id, t._id)
                saveOrden(user._id, id, next.map((x) => x._id))
                setDrag(null)
                setOrdenTick((n) => n + 1)
              }}
            />
          ))
        )}
      </section>
    )
  }

  const kpis = data
    ? [
        { label: 'Atención', value: data.vencidas.length, note: 'Vencidas', color: data.vencidas.length > 0 ? BOARD.red : BOARD.text },
        { label: 'Hoy', value: data.hoy.length, note: 'Para cerrar hoy', color: BOARD.text },
        { label: 'Próximas', value: data.proximas.length, note: 'Después de hoy o sin fecha', color: BOARD.text },
        { label: 'Cerradas', value: data.completadas.length, note: 'Últimos 14 días', color: BOARD.green },
      ]
    : []

  return (
    <div className="w-full space-y-5 pb-10">
      <header className="overflow-hidden rounded-xl bg-[var(--navy)] text-white shadow-sm">
        <div className="px-5 py-5 sm:px-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/55">
            Resumen del día
          </p>
          <h1 className="mt-2 text-[1.7rem] font-semibold tracking-tight">
            {saludoHora()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-white/70">{fechaLarga()}</p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/90">
            {data ? fraseEjecutiva(data) : 'Cargando el resumen…'}
          </p>
        </div>
      </header>

      {err && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {err}
        </p>
      )}

      {data && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-xl border bg-white px-4 py-3 shadow-sm"
              style={{ borderColor: BOARD.border }}
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: BOARD.muted }}>
                {k.label}
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums leading-none" style={{ color: k.color }}>
                {k.value}
              </p>
              <p className="mt-2 text-xs" style={{ color: BOARD.muted }}>{k.note}</p>
            </div>
          ))}
        </div>
      )}

      {!data ? (
        <p className="text-sm text-muted-foreground">Cargando tareas…</p>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
          <div className="space-y-4">
            {renderSeccion('vencidas')}
            {renderSeccion('hoy')}
            {renderSeccion('proximas')}
            {renderSeccion('completadas')}
            {totalPendiente === 0 && data.completadas.length === 0 && (
              <div
                className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-white px-6 py-14 text-center"
                style={{ borderColor: BOARD.border, color: BOARD.muted }}
              >
                <Inbox className="size-8" />
                <p className="text-sm">No tienes tareas asignadas todavía.</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/proyectos')}>
                  Ir a proyectos
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-4">
            {data.aprobaciones.length > 0 && (
              <section className="overflow-hidden rounded-xl border bg-white shadow-sm" style={{ borderColor: BOARD.border }}>
                <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: BOARD.borderSoft }}>
                  <h2 className="text-sm font-semibold text-[var(--navy)]">Por firmar</h2>
                  <span className="text-sm font-semibold tabular-nums text-[var(--navy)]">{data.aprobaciones.length}</span>
                </div>
                {data.aprobaciones.map((a) => (
                  <button
                    key={a._id}
                    type="button"
                    className="flex w-full flex-col items-start border-b px-4 py-3 text-left last:border-b-0 hover:bg-[var(--blue-lt)]/50"
                    style={{ borderColor: BOARD.borderSoft }}
                    onClick={() => navigate(a.href)}
                  >
                    <span className="text-sm font-medium text-[var(--navy)]">{a.titulo}</span>
                    <span className="text-xs text-muted-foreground">{a.detalle}</span>
                  </button>
                ))}
              </section>
            )}
            {user && <MiDiaReuniones userId={user._id} />}
            {user && <DashboardPersonalTodos userId={user._id} compact />}
          </div>
        </div>
      )}

      <TareaRapidaDialog
        open={detalle != null}
        editing={detalle}
        onOpenChange={(open) => { if (!open) setDetalle(null) }}
        onSaved={() => { setDetalle(null); void reload() }}
      />
    </div>
  )
}
