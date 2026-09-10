import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Award,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  PlayCircle,
  Upload,
} from 'lucide-react'

import { BOARD, BoardPill, EntityBoard } from '@/components/board/EntityBoard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchMiColaborador } from '@/lib/api/colaboradores'
import {
  fetchCapacitaciones,
  updateAsignacionColaborador,
  uploadCertificadoColaborador,
} from '@/lib/api/capacitaciones'
import { formatDateDMY } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Colaborador } from '@/types/colaborador'
import type { AsignadoCap, CapacitacionDoc, EstadoCap } from '@/types/capacitacion'
import {
  certificadoPublicUrl,
  colaboradorIdFromAsignado,
  proveedorNombreFromCap,
} from '@/types/capacitacion'

type FilaCap = {
  _id: string
  capacitacion: CapacitacionDoc
  asignado: AsignadoCap
  estado: EstadoCap
}

function estadoColor(estado: EstadoCap): string {
  if (estado === 'Completado') return BOARD.green
  if (estado === 'En progreso') return BOARD.orange
  return BOARD.gray
}

export function MisCapacitacionesPage() {
  const [colab, setColab] = useState<Colaborador | null>(null)
  const [caps, setCaps] = useState<CapacitacionDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<EstadoCap | 'Todas'>('Todas')
  const uploadRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const reload = useCallback(async (colaboradorId: string) => {
    const list = await fetchCapacitaciones({ colaborador_id: colaboradorId })
    setCaps(list)
  }, [])

  useEffect(() => {
    let cancel = false
    void (async () => {
      setLoading(true)
      setErr(null)
      try {
        const me = await fetchMiColaborador()
        if (cancel) return
        setColab(me)
        await reload(me._id)
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : 'Error')
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [reload])

  const filas: FilaCap[] = useMemo(() => {
    if (!colab) return []
    const out: FilaCap[] = []
    for (const c of caps) {
      const mine = c.asignados.find((a) => colaboradorIdFromAsignado(a) === colab._id)
      if (mine) {
        out.push({
          _id: c._id,
          capacitacion: c,
          asignado: mine,
          estado: mine.estado ?? 'Pendiente',
        })
      }
    }
    return out.sort((a, b) => {
      const fa = a.capacitacion.fecha_inicio ?? a.capacitacion.fecha_fin ?? ''
      const fb = b.capacitacion.fecha_inicio ?? b.capacitacion.fecha_fin ?? ''
      return fb.localeCompare(fa)
    })
  }, [caps, colab])

  const stats = useMemo(() => {
    return {
      total: filas.length,
      pendientes: filas.filter((f) => f.estado === 'Pendiente').length,
      enProgreso: filas.filter((f) => f.estado === 'En progreso').length,
      completadas: filas.filter((f) => f.estado === 'Completado').length,
    }
  }, [filas])

  const filtradas = useMemo(() => {
    if (filtro === 'Todas') return filas
    return filas.filter((f) => f.estado === filtro)
  }, [filas, filtro])

  async function cambiarEstado(capacitacionId: string, nuevoEstado: EstadoCap) {
    if (!colab) return
    setBusyId(capacitacionId)
    try {
      const body: Parameters<typeof updateAsignacionColaborador>[1] = {
        colaborador_id: colab._id,
        estado: nuevoEstado,
      }
      if (nuevoEstado === 'Completado') {
        body.fecha_completado = new Date().toISOString().slice(0, 10)
      } else {
        body.fecha_completado = null
      }
      await updateAsignacionColaborador(capacitacionId, body)
      await reload(colab._id)
    } catch (ex) {
      window.alert(ex instanceof Error ? ex.message : 'Error al actualizar')
    } finally {
      setBusyId(null)
    }
  }

  async function subirCertificado(capacitacionId: string, file: File) {
    if (!colab) return
    setBusyId(capacitacionId)
    try {
      await uploadCertificadoColaborador(capacitacionId, colab._id, file)
      await reload(colab._id)
    } catch (ex) {
      window.alert(ex instanceof Error ? ex.message : 'Error al subir el certificado')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando mis capacitaciones…</p>
  }

  if (err || !colab) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="size-5 text-[var(--navy)]" />
              Mis capacitaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {err ?? 'No pudimos cargar tu información.'}
            </p>
            <p className="text-xs text-muted-foreground">
              Si recién te dieron acceso, pide al administrador que vincule tu usuario a tu
              registro de empleado.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <GraduationCap className="size-6 text-[var(--navy)]" />
            Mis capacitaciones
          </h1>
          <p className="text-sm text-muted-foreground">
            Hola <strong>{colab.nombre}</strong> — Aquí está tu plan de capacitación. Puedes
            actualizar tu avance y subir el diploma/certificado al completar cada curso.
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Asignadas" value={stats.total} color="bg-muted" />
        <StatCard label="Pendientes" value={stats.pendientes} color="bg-amber-100" />
        <StatCard label="En progreso" value={stats.enProgreso} color="bg-blue-100" />
        <StatCard label="Completadas" value={stats.completadas} color="bg-[var(--lime-lt)]" />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['Todas', 'Pendiente', 'En progreso', 'Completado'] as const).map((opt) => (
          <Button
            key={opt}
            type="button"
            size="sm"
            variant={filtro === opt ? 'default' : 'outline'}
            className={cn(
              filtro === opt && 'text-white hover:opacity-90',
            )}
            style={filtro === opt ? { backgroundColor: BOARD.primary } : undefined}
            onClick={() => setFiltro(opt)}
          >
            {opt}
            <span className="ml-1.5 rounded bg-white/20 px-1.5 py-0.5 text-[10px]">
              {opt === 'Todas'
                ? stats.total
                : opt === 'Pendiente'
                  ? stats.pendientes
                  : opt === 'En progreso'
                    ? stats.enProgreso
                    : stats.completadas}
            </span>
          </Button>
        ))}
      </div>

      <EntityBoard
        rows={filtradas}
        countLabel="capacitación"
        emptyMessage={
          filas.length === 0
            ? 'No tienes capacitaciones asignadas todavía.'
            : 'No hay capacitaciones que coincidan con el filtro.'
        }
        hideEmptyGroups={filtro !== 'Todas'}
        groups={[
          {
            id: 'pendiente',
            label: 'Pendientes',
            color: BOARD.gray,
            match: (f) => f.estado === 'Pendiente',
          },
          {
            id: 'progreso',
            label: 'En progreso',
            color: BOARD.orange,
            match: (f) => f.estado === 'En progreso',
          },
          {
            id: 'completado',
            label: 'Completadas',
            color: BOARD.green,
            match: (f) => f.estado === 'Completado',
          },
        ]}
        searchTexts={(f) => [
          f.capacitacion.nombre,
          proveedorNombreFromCap(f.capacitacion),
          f.capacitacion.modalidad,
          f.estado,
        ]}
        minWidth="920px"
        columns={[
          {
            id: 'nombre',
            label: 'Capacitación',
            className: 'min-w-[200px]',
            render: (f) => {
              const c = f.capacitacion
              return (
                <div>
                  <p className="text-[13px] font-medium leading-snug">{c.nombre}</p>
                  <p className="text-[11px]" style={{ color: BOARD.muted }}>
                    {proveedorNombreFromCap(c) || 'Sin proveedor'}
                    {c.duracion_horas ? ` · ${c.duracion_horas} h` : ''}
                  </p>
                </div>
              )
            },
          },
          {
            id: 'modalidad',
            label: 'Modalidad',
            render: (f) =>
              f.capacitacion.modalidad ? (
                <BoardPill label={f.capacitacion.modalidad} bg={BOARD.blue} />
              ) : (
                <span style={{ color: BOARD.muted }}>—</span>
              ),
          },
          {
            id: 'fechas',
            label: 'Fechas',
            render: (f) => {
              const c = f.capacitacion
              if (!c.fecha_inicio) return <span style={{ color: BOARD.muted }}>—</span>
              return (
                <span className="text-xs" style={{ color: BOARD.muted }}>
                  {formatDateDMY(c.fecha_inicio)}
                  {c.fecha_fin ? ` → ${formatDateDMY(c.fecha_fin)}` : ''}
                </span>
              )
            },
          },
          {
            id: 'estado',
            label: 'Mi estado',
            render: (f) => {
              const a = f.asignado
              return (
                <div className="flex flex-col gap-1">
                  <BoardPill label={f.estado} bg={estadoColor(f.estado)} />
                  {a.fecha_completado && (
                    <span className="text-[11px]" style={{ color: BOARD.muted }}>
                      {formatDateDMY(a.fecha_completado)}
                    </span>
                  )}
                  {typeof a.calificacion === 'number' && (
                    <span className="text-[11px]" style={{ color: BOARD.muted }}>
                      Calif. {a.calificacion}
                    </span>
                  )}
                </div>
              )
            },
          },
          {
            id: 'cert',
            label: 'Certificado',
            render: (f) => {
              const a = f.asignado
              const certUrl = certificadoPublicUrl(a.certificado)
              if (!certUrl) {
                return <span className="text-xs" style={{ color: BOARD.muted }}>Sin diploma</span>
              }
              return (
                <a
                  href={certUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                  style={{ color: BOARD.primary }}
                >
                  <Award className="size-3.5" />
                  {a.certificado_nombre || 'Ver diploma'}
                  <ExternalLink className="size-3" />
                </a>
              )
            },
          },
          {
            id: 'acciones',
            label: 'Acciones',
            align: 'right',
            render: (f) => {
              const c = f.capacitacion
              const a = f.asignado
              const estado = f.estado
              const busy = busyId === c._id
              return (
                <div className="flex flex-col items-end gap-1.5">
                  {estado === 'Pendiente' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void cambiarEstado(c._id, 'En progreso')}
                      className="gap-1.5"
                    >
                      <PlayCircle className="size-3.5" />
                      Empezar
                    </Button>
                  )}
                  {estado === 'En progreso' && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => void cambiarEstado(c._id, 'Completado')}
                      className="gap-1.5 text-white hover:opacity-90"
                      style={{ backgroundColor: BOARD.green }}
                    >
                      <CheckCircle2 className="size-3.5" />
                      Completar
                    </Button>
                  )}
                  {(estado === 'Completado' || estado === 'En progreso') && (
                    <>
                      <input
                        ref={(el) => {
                          uploadRefs.current[c._id] = el
                        }}
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void subirCertificado(c._id, file)
                          e.target.value = ''
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        className="gap-1.5"
                        onClick={() => uploadRefs.current[c._id]?.click()}
                      >
                        <Upload className="size-3.5" />
                        {a.certificado ? 'Cambiar diploma' : 'Subir diploma'}
                      </Button>
                    </>
                  )}
                  {estado === 'Completado' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      className="h-7 gap-1 text-xs"
                      onClick={() => void cambiarEstado(c._id, 'En progreso')}
                    >
                      <Clock className="size-3" />
                      Reabrir
                    </Button>
                  )}
                </div>
              )
            },
          },
        ]}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className={cn('rounded-lg border border-border px-4 py-3', color)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}
