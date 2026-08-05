import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Building2,
  ChevronRight,
  FolderKanban,
  Printer,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchReporteStatusProyectos } from '@/lib/api/proyectos'
import { formatDateDMY } from '@/lib/format'
import { cn } from '@/lib/utils'
import { estadoColor, type ProyectoEstado } from '@/types/proyecto'
import type { ReporteStatusProyectoItem, ReporteStatusProyectos } from '@/types/reporteProyectos'

import { ProyectoStatusSheet } from './ProyectoStatusSheet'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

type Props = {
  embedded?: boolean
}

export function ReporteStatusProyectosPage({ embedded = false }: Props) {
  const [data, setData] = useState<ReporteStatusProyectos | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [filtroDepto, setFiltroDepto] = useState<string | null>(null)
  const [filtroProyecto, setFiltroProyecto] = useState('')
  const [proyectoSheet, setProyectoSheet] = useState<ReporteStatusProyectoItem | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetchReporteStatusProyectos({
        alcance: filtroDepto ? 'departamento' : 'todos',
        departamento_id: filtroDepto ?? undefined,
        proyecto_id: filtroProyecto || undefined,
      })
      setData(r)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al cargar reporte')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [filtroDepto, filtroProyecto])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    const onBefore = () => document.body.classList.add('reporte-status-print-active')
    const onAfter = () => document.body.classList.remove('reporte-status-print-active')
    window.addEventListener('beforeprint', onBefore)
    window.addEventListener('afterprint', onAfter)
    return () => {
      window.removeEventListener('beforeprint', onBefore)
      window.removeEventListener('afterprint', onAfter)
      document.body.classList.remove('reporte-status-print-active')
    }
  }, [])

  const todosProyectos = useMemo(() => {
    if (!data) return [] as ReporteStatusProyectoItem[]
    return data.departamentos.flatMap((d) => d.proyectos)
  }, [data])

  const proyectosVisibles = useMemo(() => {
    let list = todosProyectos
    if (filtroDepto) {
      list = list.filter((p) => p.departamento_id === filtroDepto)
    }
    if (filtroProyecto) {
      list = list.filter((p) => p.proyecto_id === filtroProyecto)
    }
    return list
  }, [todosProyectos, filtroDepto, filtroProyecto])

  const deptosEnVista = useMemo(() => {
    if (!data) return []
    if (filtroDepto) {
      return data.departamentos.filter((d) => d.departamento_id === filtroDepto)
    }
    return data.departamentos
  }, [data, filtroDepto])

  const opcionesProyecto = useMemo(() => {
    const base = filtroDepto
      ? todosProyectos.filter((p) => p.departamento_id === filtroDepto)
      : todosProyectos
    return [...base].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [todosProyectos, filtroDepto])

  function limpiarFiltros() {
    setFiltroDepto(null)
    setFiltroProyecto('')
  }

  return (
    <div className={cn('reporte-status-page space-y-6', !embedded && 'mx-auto max-w-7xl')}>
      {!embedded && (
        <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-[var(--navy)]">
              <BarChart3 className="size-7" />
              Project Status Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Vista ejecutiva del portafolio: filtra por departamento o proyecto y documenta riesgos con evidencias.
            </p>
          </div>
          <Button type="button" variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="size-4" />
            Imprimir / PDF
          </Button>
        </div>
      )}

      {embedded && (
        <div className="flex justify-end print:hidden">
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
            <Printer className="size-4" />
            Imprimir / PDF
          </Button>
        </div>
      )}

      {/* Filtros interactivos */}
      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Departamentos</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setFiltroDepto(null)
                  setFiltroProyecto('')
                }}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  filtroDepto === null
                    ? 'border-[var(--navy)] bg-[var(--navy)] text-white'
                    : 'border-border bg-white text-muted-foreground hover:border-[var(--navy)]/40',
                )}
              >
                Todos
              </button>
              {(data?.departamentos_disponibles ?? []).map((d) => (
                <button
                  key={d._id}
                  type="button"
                  onClick={() => {
                    setFiltroDepto(d._id)
                    setFiltroProyecto('')
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    filtroDepto === d._id
                      ? 'border-[var(--navy)] bg-[var(--navy)] text-white'
                      : 'border-border bg-white text-muted-foreground hover:border-[var(--navy)]/40',
                  )}
                >
                  {d.nombre}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="filtro-proyecto">
                Proyecto
              </label>
              <select
                id="filtro-proyecto"
                className={selectClass}
                value={filtroProyecto}
                onChange={(e) => setFiltroProyecto(e.target.value)}
              >
                <option value="">— Todos los proyectos —</option>
                {opcionesProyecto.map((p) => (
                  <option key={p.proyecto_id} value={p.proyecto_id}>
                    {p.nombre} ({p.proyecto_id})
                  </option>
                ))}
              </select>
            </div>
            {(filtroDepto || filtroProyecto) && (
              <div className="flex items-end">
                <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={limpiarFiltros}>
                  <X className="size-3.5" />
                  Limpiar filtros
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-muted-foreground">Cargando dashboard…</p>}
      {err && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {err}
        </p>
      )}

      {data && !loading && (
        <>
          <div className="reporte-status-header rounded-lg border border-border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  RCJ Corporación — IT Manager
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--navy)]">
                  Project Status Dashboard
                </h2>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                Generado: {formatDateDMY(data.generado_en)}
              </div>
            </div>
          </div>

          {/* KPIs — clicables para filtrar departamentos con riesgos altos */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {[
              { label: 'Proyectos', value: data.resumen.total_proyectos, onClick: undefined },
              { label: 'Departamentos', value: data.resumen.total_departamentos, onClick: undefined },
              { label: 'Activos', value: data.resumen.activos, onClick: undefined },
              { label: 'Completados', value: data.resumen.completados, onClick: undefined },
              { label: 'Avance prom.', value: `${data.resumen.avance_promedio}%`, onClick: undefined },
              {
                label: 'Riesgos doc.',
                value: data.resumen.riesgos_registrados,
                sub: data.resumen.riesgos_alto > 0 ? `${data.resumen.riesgos_alto} alto` : undefined,
                onClick: undefined,
                alert: data.resumen.riesgos_alto > 0,
              },
            ].map((c) => (
              <Card
                key={c.label}
                className={cn(c.onClick && 'cursor-pointer transition-shadow hover:shadow-md')}
                onClick={c.onClick}
              >
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className={cn('text-2xl font-semibold', c.alert ? 'text-red-600' : 'text-[var(--navy)]')}>
                    {c.value}
                  </p>
                  {'sub' in c && c.sub && (
                    <p className="text-[10px] text-red-600">{c.sub}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tarjetas de departamento — clicables */}
          {!filtroProyecto && deptosEnVista.length > 1 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:hidden">
              {deptosEnVista.map((dept) => (
                <button
                  key={dept.departamento_id ?? 'sin-depto'}
                  type="button"
                  onClick={() => setFiltroDepto(dept.departamento_id)}
                  className="rounded-lg border border-border bg-white p-4 text-left shadow-sm transition-all hover:border-[var(--navy)]/30 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold text-[var(--navy)]">
                      <Building2 className="size-4" />
                      {dept.departamento_nombre}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {dept.resumen.total_proyectos} proyectos · Avance {dept.resumen.avance_promedio}%
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Grid de proyectos — clicables */}
          {proyectosVisibles.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No hay proyectos para los filtros seleccionados.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {proyectosVisibles.map((p) => {
                const deptNombre = data.departamentos.find(
                  (d) => d.departamento_id === p.departamento_id,
                )?.departamento_nombre ?? '—'
                return (
                  <button
                    key={p.proyecto_id}
                    type="button"
                    onClick={() => setProyectoSheet(p)}
                    className="group rounded-lg border border-border bg-white p-4 text-left shadow-sm transition-all hover:border-[var(--lime)] hover:shadow-md print:break-inside-avoid"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[var(--navy)] group-hover:text-[var(--navy)]">
                          {p.nombre}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {p.proyecto_id} · {deptNombre}
                        </p>
                      </div>
                      <FolderKanban className="size-4 shrink-0 text-muted-foreground group-hover:text-[var(--lime)]" />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn('text-[10px]', estadoColor(p.estado as ProyectoEstado))}
                      >
                        {p.estado}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        style={{
                          borderColor: p.riesgo_auto.color,
                          color: p.riesgo_auto.color,
                        }}
                      >
                        {p.riesgo_auto.nivel}
                      </Badge>
                      {p.riesgos_registrados > 0 && (
                        <Badge variant="outline" className="gap-0.5 border-red-200 bg-red-50 text-[10px] text-red-700">
                          <AlertTriangle className="size-2.5" />
                          {p.riesgos_registrados}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                        <span>Avance</span>
                        <span className="tabular-nums">{p.porcentaje_avance}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-[var(--lime)]"
                          style={{ width: `${Math.min(100, p.porcentaje_avance)}%` }}
                        />
                      </div>
                    </div>

                    <p className="mt-2 line-clamp-1 text-[10px] text-muted-foreground">
                      {p.riesgo_auto.motivo}
                    </p>

                    <p className="mt-2 text-[10px] font-medium text-[var(--navy)] opacity-0 transition-opacity group-hover:opacity-100 print:hidden">
                      Clic para ver detalle y riesgos →
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      <ProyectoStatusSheet
        proyecto={proyectoSheet}
        open={proyectoSheet != null}
        onOpenChange={(o) => {
          if (!o) setProyectoSheet(null)
        }}
        onChanged={() => void cargar()}
      />
    </div>
  )
}
