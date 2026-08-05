import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarRange, FileText, FolderKanban, Printer } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TareaTagsList } from '@/components/proyectos/TareaTagsList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchDepartamentos } from '@/lib/api/departamentos'
import { fetchProyectos } from '@/lib/api/proyectos'
import { fetchReporteSemanalTareas } from '@/lib/api/tareas'
import { formatDateDMY } from '@/lib/format'
import { estadoTareaColor } from '@/lib/tareaDependencias'
import { cn } from '@/lib/utils'
import type { DepartamentoDoc } from '@/types/departamento'
import type { Proyecto } from '@/types/proyecto'
import type { ReporteSemanalTareas, TareaEstado } from '@/types/tarea'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function isoWeekNow(): string {
  const d = new Date()
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day + 3)
  const firstThursday = new Date(d.getFullYear(), 0, 4)
  const week =
    1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function estadoBadgeClass(estado: TareaEstado) {
  return cn('text-xs', estadoTareaColor(estado))
}

export function ReporteSemanalTareasPage({ embedded = false }: { embedded?: boolean }) {
  const [semana, setSemana] = useState(isoWeekNow)
  const [alcance, setAlcance] = useState<'todos' | 'proyecto' | 'departamento'>('todos')
  const [proyectoId, setProyectoId] = useState('')
  const [departamentoId, setDepartamentoId] = useState('')
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [departamentos, setDepartamentos] = useState<DepartamentoDoc[]>([])
  const [data, setData] = useState<ReporteSemanalTareas | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([fetchProyectos(), fetchDepartamentos()])
      .then(([ps, ds]) => {
        setProyectos(ps.filter((p) => p.estado !== 'Cancelado'))
        setDepartamentos(ds.filter((d) => d.activo !== false))
      })
      .catch(() => {
        setProyectos([])
        setDepartamentos([])
      })
  }, [])

  const cargar = useCallback(async () => {
    if (!semana) return
    if (alcance === 'proyecto' && !proyectoId) {
      setErr('Selecciona un proyecto para este reporte.')
      setData(null)
      return
    }
    if (alcance === 'departamento' && !departamentoId) {
      setErr('Selecciona un departamento para este reporte.')
      setData(null)
      return
    }
    setLoading(true)
    setErr(null)
    try {
      const r = await fetchReporteSemanalTareas({
        semana,
        alcance,
        proyecto_id: alcance === 'proyecto' ? proyectoId : undefined,
        departamento_id: alcance === 'departamento' ? departamentoId : undefined,
      })
      setData(r)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al cargar reporte')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [semana, alcance, proyectoId, departamentoId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    const onBefore = () => document.body.classList.add('reporte-semanal-print-active')
    const onAfter = () => document.body.classList.remove('reporte-semanal-print-active')
    window.addEventListener('beforeprint', onBefore)
    window.addEventListener('afterprint', onAfter)
    return () => {
      window.removeEventListener('beforeprint', onBefore)
      window.removeEventListener('afterprint', onAfter)
      document.body.classList.remove('reporte-semanal-print-active')
    }
  }, [])

  const tituloAlcance = useMemo(() => {
    if (alcance === 'proyecto') {
      const p = proyectos.find((x) => x._id === proyectoId)
      return p ? `Proyecto: ${p.nombre}` : 'Proyecto seleccionado'
    }
    if (alcance === 'departamento') {
      const d = departamentos.find((x) => x._id === departamentoId)
      return d ? `Departamento: ${d.nombre}` : 'Departamento seleccionado'
    }
    return 'Todos los proyectos activos'
  }, [alcance, proyectoId, departamentoId, proyectos, departamentos])

  return (
    <div className={cn('reporte-semanal-page space-y-6', !embedded && 'mx-auto max-w-6xl')}>
      {!embedded && (
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-[var(--navy)]">
            <FileText className="size-7" />
            Reporte semanal de tareas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumen ejecutivo del avance por proyecto para presentar a gerencia.
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
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="rep-semana">
              Semana
            </label>
            <input
              id="rep-semana"
              type="week"
              className={selectClass}
              value={semana}
              onChange={(e) => setSemana(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="rep-alcance">
              Reporte
            </label>
            <select
              id="rep-alcance"
              className={selectClass}
              value={alcance}
              onChange={(e) => setAlcance(e.target.value as typeof alcance)}
            >
              <option value="todos">Todos los proyectos</option>
              <option value="proyecto">Por proyecto</option>
              <option value="departamento">Por departamento</option>
            </select>
          </div>
          {alcance === 'proyecto' && (
            <div className="grid gap-2 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="rep-proy">
                Proyecto
              </label>
              <select
                id="rep-proy"
                className={selectClass}
                value={proyectoId}
                onChange={(e) => setProyectoId(e.target.value)}
              >
                <option value="">— Seleccionar —</option>
                {proyectos.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p._id} — {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          {alcance === 'departamento' && (
            <div className="grid gap-2 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="rep-depto">
                Departamento
              </label>
              <select
                id="rep-depto"
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

      {loading && (
        <p className="text-sm text-muted-foreground">Generando reporte…</p>
      )}
      {err && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {err}
        </p>
      )}

      {data && !loading && (
        <>
          <div className="reporte-semanal-header rounded-lg border border-border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  RCJ Corporación — IT Manager
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--navy)]">
                  Reporte semanal de avance
                </h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarRange className="size-4" />
                  {data.semana.etiqueta}
                </p>
                <p className="text-sm text-muted-foreground">{tituloAlcance}</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                Generado: {formatDateDMY(new Date().toISOString())}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'Proyectos', value: data.resumen.total_proyectos },
              { label: 'Tareas', value: data.resumen.total_tareas },
              { label: 'En progreso', value: data.resumen.en_progreso },
              { label: 'Completadas', value: data.resumen.completadas },
              { label: 'Bloqueadas', value: data.resumen.bloqueadas },
            ].map((c) => (
              <Card key={c.label}>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-semibold text-[var(--navy)]">{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {data.proyectos.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No hay tareas activas para la semana y filtros seleccionados.
              </CardContent>
            </Card>
          ) : (
            data.proyectos.map((proy) => (
              <Card key={proy.proyecto_id} className="break-inside-avoid">
                <CardHeader className="border-b border-border bg-[var(--gray-lt)]/60 pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FolderKanban className="size-4 text-[var(--navy)]" />
                      {proy.proyecto_nombre}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({proy.proyecto_id})
                      </span>
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm">
                      {proy.eje && (
                        <Badge variant="outline" className="text-xs">
                          {proy.eje}
                        </Badge>
                      )}
                      <span className="text-muted-foreground">
                        Avance proyecto: <strong>{proy.avance_proyecto}%</strong>
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tarea</TableHead>
                        <TableHead>Responsable</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">%</TableHead>
                        <TableHead>Fin</TableHead>
                        <TableHead className="hidden md:table-cell">Tags</TableHead>
                        <TableHead className="hidden lg:table-cell">Último comentario</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {proy.tareas.map((t) => (
                        <TableRow key={t._id}>
                          <TableCell className="font-medium">{t.nombre}</TableCell>
                          <TableCell>{t.responsable ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={estadoBadgeClass(t.estado)}>
                              {t.estado}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-muted sm:block">
                                <div
                                  className="h-full rounded-full bg-[var(--lime)]"
                                  style={{ width: `${Math.min(100, t.porcentaje)}%` }}
                                />
                              </div>
                              <span className="tabular-nums">{t.porcentaje}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{formatDateDMY(t.fecha_fin)}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            <TareaTagsList tags={t.tags} />
                          </TableCell>
                          <TableCell className="hidden max-w-xs truncate text-xs text-muted-foreground lg:table-cell">
                            {t.ultimo_comentario ?? '—'}
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
