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

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { usePagination } from '@/hooks/usePagination'
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

function estadoBadge(estado?: EstadoCap | null) {
  if (!estado) return null
  const cls =
    estado === 'Completado'
      ? 'bg-[var(--lime-lt)] text-[var(--navy)] border-[var(--lime)]/50'
      : estado === 'En progreso'
        ? 'bg-amber-500/10 text-amber-900 border-amber-500/40'
        : 'bg-muted text-muted-foreground border-border'
  return (
    <Badge variant="outline" className={cn('border gap-1', cls)}>
      {estado === 'Completado' && <CheckCircle2 className="size-3" />}
      {estado === 'En progreso' && <PlayCircle className="size-3" />}
      {estado === 'Pendiente' && <Clock className="size-3" />}
      {estado}
    </Badge>
  )
}

type FilaCap = {
  capacitacion: CapacitacionDoc
  asignado: AsignadoCap
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
      if (mine) out.push({ capacitacion: c, asignado: mine })
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
      pendientes: filas.filter((f) => (f.asignado.estado ?? 'Pendiente') === 'Pendiente').length,
      enProgreso: filas.filter((f) => f.asignado.estado === 'En progreso').length,
      completadas: filas.filter((f) => f.asignado.estado === 'Completado').length,
      conCertificado: filas.filter((f) => f.asignado.certificado).length,
    }
  }, [filas])

  const filtradas = useMemo(() => {
    if (filtro === 'Todas') return filas
    return filas.filter((f) => (f.asignado.estado ?? 'Pendiente') === filtro)
  }, [filas, filtro])

  const pagination = usePagination(filtradas.length, {
    resetKey: `${filtro}|${filtradas.length}`,
  })
  const pageFiltradas = pagination.slice(filtradas)

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

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Asignadas" value={stats.total} color="bg-muted" />
        <StatCard label="Pendientes" value={stats.pendientes} color="bg-amber-100" />
        <StatCard label="En progreso" value={stats.enProgreso} color="bg-blue-100" />
        <StatCard label="Completadas" value={stats.completadas} color="bg-[var(--lime-lt)]" />
      </div>

      {/* Filtro */}
      <div className="flex flex-wrap gap-2">
        {(['Todas', 'Pendiente', 'En progreso', 'Completado'] as const).map((opt) => (
          <Button
            key={opt}
            type="button"
            size="sm"
            variant={filtro === opt ? 'default' : 'outline'}
            className={cn(
              filtro === opt && 'bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90',
            )}
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

      <Card>
        <CardContent className="p-0">
          <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Capacitación</TableHead>
                <TableHead>Modalidad</TableHead>
                <TableHead>Fechas</TableHead>
                <TableHead>Mi estado</TableHead>
                <TableHead>Certificado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    {filas.length === 0
                      ? 'No tienes capacitaciones asignadas todavía.'
                      : 'No hay capacitaciones que coincidan con el filtro.'}
                  </TableCell>
                </TableRow>
              )}
              {pageFiltradas.map(({ capacitacion: c, asignado: a }) => {
                const estado = a.estado ?? 'Pendiente'
                const busy = busyId === c._id
                const certUrl = certificadoPublicUrl(a.certificado)
                const tieneCert = Boolean(certUrl)
                return (
                  <TableRow key={c._id} className="align-top">
                    <TableCell className="max-w-xs">
                      <p className="text-sm font-medium leading-snug">{c.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {proveedorNombreFromCap(c) || 'Sin proveedor'}
                        {c.duracion_horas ? ` · ${c.duracion_horas} h` : ''}
                      </p>
                    </TableCell>
                    <TableCell>
                      {c.modalidad ? (
                        <Badge variant="secondary" className="text-xs">
                          {c.modalidad}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.fecha_inicio ? (
                        <>
                          {formatDateDMY(c.fecha_inicio)}
                          {c.fecha_fin && (
                            <>
                              <span className="mx-1">→</span>
                              {formatDateDMY(c.fecha_fin)}
                            </>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {estadoBadge(estado)}
                        {a.fecha_completado && (
                          <span className="text-[11px] text-muted-foreground">
                            {formatDateDMY(a.fecha_completado)}
                          </span>
                        )}
                        {typeof a.calificacion === 'number' && (
                          <span className="text-[11px] text-muted-foreground">
                            Calif. {a.calificacion}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {tieneCert ? (
                        <a
                          href={certUrl ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-[var(--navy)] hover:underline"
                        >
                          <Award className="size-3.5" />
                          {a.certificado_nombre || 'Ver diploma'}
                          <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin diploma</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
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
                            className="gap-1.5 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
                          >
                            <CheckCircle2 className="size-3.5" />
                            Marcar como completada
                          </Button>
                        )}
                        {estado === 'Completado' && !tieneCert && (
                          <>
                            <input
                              ref={(el) => {
                                uploadRefs.current[c._id] = el
                              }}
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) void subirCertificado(c._id, f)
                                e.target.value = ''
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => uploadRefs.current[c._id]?.click()}
                              className="gap-1.5"
                            >
                              <Upload className="size-3.5" />
                              Subir diploma
                            </Button>
                          </>
                        )}
                        {estado === 'Completado' && tieneCert && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void cambiarEstado(c._id, 'En progreso')}
                            className="text-xs"
                          >
                            Reabrir
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <PaginationBar
            page={pagination.page}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            fromItem={pagination.fromItem}
            toItem={pagination.toItem}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
          </>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-md text-base font-semibold text-[var(--navy)]',
            color,
          )}
        >
          {value}
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
