import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Building2, Printer } from 'lucide-react'

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
import { fetchReporteStatusProyectos } from '@/lib/api/proyectos'
import { formatDateDMY } from '@/lib/format'
import { cn } from '@/lib/utils'
import { estadoColor, type ProyectoEstado } from '@/types/proyecto'
import type { ReporteStatusProyectos } from '@/types/reporteProyectos'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function prioridadClass(p: string) {
  if (p === 'Alta') return 'border-red-300 bg-red-50 text-red-800'
  if (p === 'Baja') return 'border-slate-300 bg-slate-50 text-slate-700'
  return 'border-blue-300 bg-blue-50 text-blue-800'
}

type Props = {
  embedded?: boolean
}

export function ReporteStatusProyectosPage({ embedded = false }: Props) {
  const [alcance, setAlcance] = useState<'todos' | 'departamento'>('todos')
  const [departamentoId, setDepartamentoId] = useState('')
  const [data, setData] = useState<ReporteStatusProyectos | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const departamentos = useMemo(
    () => data?.departamentos_disponibles ?? [],
    [data?.departamentos_disponibles],
  )

  const cargar = useCallback(async () => {
    if (alcance === 'departamento' && !departamentoId) {
      setErr('Selecciona un departamento para este reporte.')
      setData(null)
      return
    }
    setLoading(true)
    setErr(null)
    try {
      const r = await fetchReporteStatusProyectos({
        alcance,
        departamento_id: alcance === 'departamento' ? departamentoId : undefined,
      })
      setData(r)
      if (alcance === 'departamento' && !departamentoId && r.departamentos_disponibles.length === 1) {
        setDepartamentoId(r.departamentos_disponibles[0]!._id)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al cargar reporte')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [alcance, departamentoId])

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

  const tituloAlcance = useMemo(() => {
    if (alcance === 'departamento') {
      const d = departamentos.find((x) => x._id === departamentoId)
      return d ? `Departamento: ${d.nombre}` : 'Departamento seleccionado'
    }
    return 'Todos los departamentos'
  }, [alcance, departamentoId, departamentos])

  return (
    <div className="reporte-status-page mx-auto max-w-6xl space-y-6">
      {!embedded && (
        <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-[var(--navy)]">
              <BarChart3 className="size-7" />
              Project Status Report
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Estado general del portafolio de proyectos agrupado por departamento.
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

      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros del reporte</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="status-alcance">
              Alcance
            </label>
            <select
              id="status-alcance"
              className={selectClass}
              value={alcance}
              onChange={(e) => setAlcance(e.target.value as typeof alcance)}
            >
              <option value="todos">Todos los departamentos</option>
              <option value="departamento">Por departamento</option>
            </select>
          </div>
          {alcance === 'departamento' && (
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="status-depto">
                Departamento
              </label>
              <select
                id="status-depto"
                className={selectClass}
                value={departamentoId}
                onChange={(e) => setDepartamentoId(e.target.value)}
              >
                <option value="">— Seleccionar —</option>
                {departamentos.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-muted-foreground">Generando reporte…</p>}
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
                  Project Status Report
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{tituloAlcance}</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                Generado: {formatDateDMY(data.generado_en)}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'Proyectos', value: data.resumen.total_proyectos },
              { label: 'Departamentos', value: data.resumen.total_departamentos },
              { label: 'Activos', value: data.resumen.activos },
              { label: 'Completados', value: data.resumen.completados },
              { label: 'Avance prom.', value: `${data.resumen.avance_promedio}%` },
            ].map((c) => (
              <Card key={c.label}>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-semibold text-[var(--navy)]">{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {data.departamentos.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No hay proyectos para los filtros seleccionados.
              </CardContent>
            </Card>
          ) : (
            data.departamentos.map((dept) => (
              <Card key={dept.departamento_id ?? 'sin-depto'} className="break-inside-avoid">
                <CardHeader className="border-b border-border bg-[var(--gray-lt)]/60 pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2 className="size-4 text-[var(--navy)]" />
                      {dept.departamento_nombre}
                      {dept.departamento_codigo && (
                        <span className="text-xs font-normal text-muted-foreground">
                          ({dept.departamento_codigo})
                        </span>
                      )}
                    </CardTitle>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{dept.resumen.total_proyectos} proyectos</span>
                      <span>Activos: {dept.resumen.activos}</span>
                      <span>Completados: {dept.resumen.completados}</span>
                      <span>Avance: <strong>{dept.resumen.avance_promedio}%</strong></span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proyecto</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fase</TableHead>
                        <TableHead>Prioridad</TableHead>
                        <TableHead className="text-right">Avance</TableHead>
                        <TableHead>Responsable</TableHead>
                        <TableHead>Fin</TableHead>
                        <TableHead className="hidden lg:table-cell">Tareas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dept.proyectos.map((p) => (
                        <TableRow key={p.proyecto_id}>
                          <TableCell>
                            <div className="font-medium">{p.nombre}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.proyecto_id}
                              {p.eje ? ` · ${p.eje}` : ''}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn('text-xs', estadoColor(p.estado as ProyectoEstado))}
                            >
                              {p.estado}
                            </Badge>
                          </TableCell>
                          <TableCell>{p.fase != null ? `Fase ${p.fase}` : '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-xs', prioridadClass(p.prioridad))}>
                              {p.prioridad}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-muted sm:block">
                                <div
                                  className="h-full rounded-full bg-[var(--lime)]"
                                  style={{ width: `${Math.min(100, p.porcentaje_avance)}%` }}
                                />
                              </div>
                              <span className="tabular-nums">{p.porcentaje_avance}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{p.responsable ?? p.propietario ?? '—'}</TableCell>
                          <TableCell>{formatDateDMY(p.fecha_fin)}</TableCell>
                          <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                            {p.tareas_total > 0 ? (
                              <>
                                {p.tareas_completadas}/{p.tareas_total} done
                                {p.tareas_bloqueadas > 0 && (
                                  <span className="ml-1 text-red-600">
                                    · {p.tareas_bloqueadas} bloq.
                                  </span>
                                )}
                              </>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </>
      )}
    </div>
  )
}
