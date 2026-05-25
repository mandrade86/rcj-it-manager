import { useCallback, useEffect, useMemo, useState } from 'react'
import { Award, Plus, Upload } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CapacitacionesAlcanceBar } from '@/components/capacitaciones/CapacitacionesAlcanceBar'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { usePagination } from '@/hooks/usePagination'
import {
  asignarCapacitacion,
  createCapacitacion,
  fetchCapacitaciones,
  fetchCapacitacionesAlcance,
  updateAsignacionColaborador,
  updateCapacitacion,
  uploadCertificadoColaborador,
} from '@/lib/api/capacitaciones'
import { fetchColaboradores } from '@/lib/api/colaboradores'
import { fetchDepartamentos } from '@/lib/api/departamentos'
import {
  createProveedorCapacitacion,
  fetchProveedoresCapacitacion,
} from '@/lib/api/proveedoresCapacitacion'
import { formatDateDMY, formatLps } from '@/lib/format'
import { useAuthStore } from '@/store/authStore'
import type { Colaborador } from '@/types/colaborador'
import type {
  CapacitacionDoc,
  CapacitacionesAlcance,
  EstadoCap,
  ProveedorCapacitacionDoc,
} from '@/types/capacitacion'
import {
  certificadoPublicUrl,
  departamentoIdsFromCap,
  departamentosFromCap,
  proveedorNombreFromCap,
} from '@/types/capacitacion'
import type { DepartamentoDoc } from '@/types/departamento'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

const MODALIDADES = ['Online', 'Presencial', 'Mixto'] as const
const ESTADOS: EstadoCap[] = ['Pendiente', 'En progreso', 'Completado']

const NUEVO_PROVEEDOR_SENTINEL = '__nuevo__'

function mergeCap(list: CapacitacionDoc[], updated: CapacitacionDoc): CapacitacionDoc[] {
  return list.map((c) => (c._id === updated._id ? updated : c))
}

function colaboradorIdFromAsignado(a: { colaborador_id: unknown }): string {
  const c = a.colaborador_id
  if (c && typeof c === 'object' && '_id' in c) return String((c as { _id: string })._id)
  return String(c)
}

function nombreColaboradorAsignado(a: { colaborador_id: unknown }): string {
  const c = a.colaborador_id
  if (c && typeof c === 'object' && 'nombre' in c) return (c as { nombre: string }).nombre
  return '—'
}

function colDepartamentoId(c: { departamento_id?: unknown }): string | null {
  const d = c.departamento_id
  if (!d) return null
  if (typeof d === 'string') return d
  if (typeof d === 'object' && '_id' in d) return String((d as { _id: string })._id)
  return null
}

export function CapacitacionesPage() {
  const [caps, setCaps] = useState<CapacitacionDoc[]>([])
  const [cols, setCols] = useState<Colaborador[]>([])
  const [proveedores, setProveedores] = useState<ProveedorCapacitacionDoc[]>([])
  const [departamentos, setDepartamentos] = useState<DepartamentoDoc[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [filtroLista, setFiltroLista] = useState<EstadoCap | ''>('')
  const [filtroResumen, setFiltroResumen] = useState<EstadoCap | ''>('')
  const [editCap, setEditCap] = useState<CapacitacionDoc | null>(null)
  const [assignCapId, setAssignCapId] = useState('')
  const [assignPick, setAssignPick] = useState<Record<string, boolean>>({})
  const [assignBusy, setAssignBusy] = useState(false)
  const [alcance, setAlcance] = useState<CapacitacionesAlcance | null>(null)

  const reload = useCallback(async () => {
    setLoadErr(null)
    try {
      const [cList, colList, provList, depList, alc] = await Promise.all([
        fetchCapacitaciones(),
        fetchColaboradores(),
        fetchProveedoresCapacitacion(),
        fetchDepartamentos(),
        fetchCapacitacionesAlcance(),
      ])
      setCaps(cList)
      setCols(colList)
      setProveedores(provList)
      setDepartamentos(depList)
      setAlcance(alc)
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Error')
    }
  }, [])



  useEffect(() => {
    void reload()
  }, [reload])

  const capsTabla = useMemo(() => {
    if (!filtroLista) return caps
    return caps.filter((c) => c.estado === filtroLista)
  }, [caps, filtroLista])

  const asignacionesPorCol = useMemo(() => {
    const map = new Map<string, { total: number; done: number; rows: { estado: EstadoCap }[] }>()
    for (const cap of caps) {
      for (const a of cap.asignados) {
        const cid = colaboradorIdFromAsignado(a)
        if (!map.has(cid)) map.set(cid, { total: 0, done: 0, rows: [] })
        const m = map.get(cid)!
        m.total += 1
        const st = (a.estado ?? 'Pendiente') as EstadoCap
        m.rows.push({ estado: st })
        if (st === 'Completado') m.done += 1
      }
    }
    return map
  }, [caps])

  const colaboradoresResumen = useMemo(() => {
    return cols.filter((c) => {
      const m = asignacionesPorCol.get(c._id)
      if (!m || m.total === 0) return false
      if (!filtroResumen) return true
      return m.rows.some((r) => r.estado === filtroResumen)
    })
  }, [cols, asignacionesPorCol, filtroResumen])

  const reporteRows = useMemo(() => {
    const rows: {
      capId: string
      capNombre: string
      colaborador_id: string
      nombre: string
      estado: EstadoCap
      fecha_completado?: string | null
      calificacion?: number | null
      certificado?: string | null
      certificado_nombre?: string | null
    }[] = []
    for (const cap of caps) {
      for (const a of cap.asignados) {
        rows.push({
          capId: cap._id,
          capNombre: cap.nombre,
          colaborador_id: colaboradorIdFromAsignado(a),
          nombre: nombreColaboradorAsignado(a),
          estado: (a.estado ?? 'Pendiente') as EstadoCap,
          fecha_completado: a.fecha_completado,
          calificacion: a.calificacion ?? undefined,
          certificado: a.certificado ?? null,
          certificado_nombre: a.certificado_nombre ?? null,
        })
      }
    }
    return rows.sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))
  }, [caps])

  const pagResumen = usePagination(colaboradoresResumen.length, {
    resetKey: `${filtroResumen}|${colaboradoresResumen.length}`,
  })
  const pageResumenCols = pagResumen.slice(colaboradoresResumen)

  const pagLista = usePagination(capsTabla.length, {
    resetKey: `${filtroLista}|${capsTabla.length}`,
  })
  const pageCapsTabla = pagLista.slice(capsTabla)

  const pagReporte = usePagination(reporteRows.length, {
    resetKey: `${reporteRows.length}|${caps.length}`,
  })
  const pageReporteRows = pagReporte.slice(reporteRows)

  async function patchAsignacion(
    capId: string,
    colaborador_id: string,
    patch: Omit<Parameters<typeof updateAsignacionColaborador>[1], 'colaborador_id'>,
  ) {
    try {
      const doc = await updateAsignacionColaborador(capId, { colaborador_id, ...patch })
      setCaps((list) => mergeCap(list, doc))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error')
    }
  }

  async function uploadDiploma(capId: string, colaborador_id: string, file: File) {
    try {
      const doc = await uploadCertificadoColaborador(capId, colaborador_id, file)
      setCaps((list) => mergeCap(list, doc))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error subiendo diploma')
    }
  }

  /**
   * Devuelve los colaboradores elegibles para una capacitación, según los
   * departamentos permitidos. Si la capacitación no tiene departamentos
   * configurados, es abierta para todos.
   */
  function colaboradoresElegibles(cap: CapacitacionDoc | null): Colaborador[] {
    if (!cap) return cols
    const allowed = new Set(departamentoIdsFromCap(cap))
    if (allowed.size === 0) return cols
    return cols.filter((c) => {
      const did = colDepartamentoId(c)
      return did != null && allowed.has(did)
    })
  }

  if (loadErr && caps.length === 0 && cols.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
        <p className="text-sm text-destructive">{loadErr}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => void reload()}>
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--navy)]">Capacitaciones</h2>
          <p className="text-sm text-muted-foreground">
            Plan por colaborador, catálogo, asignación masiva y reporte de avance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NuevaCapacitacionDialog
            proveedores={proveedores}
            departamentos={departamentos}
            alcance={alcance}
            onProveedorCreated={(p) => setProveedores((l) => [...l, p].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))}
            onCreated={(doc) => {
              setCaps((l) => [...l, doc])
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void reload()}
          >
            Actualizar
          </Button>
        </div>
      </div>

      {loadErr && (
        <p className="text-sm text-amber-800">
          Aviso: {loadErr} (mostrando última carga válida si existe)
        </p>
      )}

      {alcance ? <CapacitacionesAlcanceBar alcance={alcance} /> : null}

      <Tabs defaultValue="resumen">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="resumen">Resumen por colaborador</TabsTrigger>
          <TabsTrigger value="lista">Catálogo</TabsTrigger>
          <TabsTrigger value="asignar">Asignación masiva</TabsTrigger>
          <TabsTrigger value="reporte">Reporte de avance</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label className="text-xs">Filtrar por estado de asignación</Label>
              <select
                className={selectClass + ' w-[220px]'}
                value={filtroResumen}
                onChange={(e) =>
                  setFiltroResumen((e.target.value || '') as EstadoCap | '')
                }
              >
                <option value="">Todos (con asignaciones)</option>
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pageResumenCols.map((c) => {
              const m = asignacionesPorCol.get(c._id)!
              const pct = Math.round((m.done / m.total) * 100)
              return (
                <Card key={c._id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base leading-tight">{c.nombre}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {c.puesto} · {c.codigo}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Avance del plan</span>
                      <span className="font-medium">{pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[var(--lime)] transition-[width]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {m.done} de {m.total} capacitaciones completadas
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          <PaginationBar
            page={pagResumen.page}
            totalPages={pagResumen.totalPages}
            pageSize={pagResumen.pageSize}
            totalItems={pagResumen.totalItems}
            fromItem={pagResumen.fromItem}
            toItem={pagResumen.toItem}
            onPageChange={pagResumen.setPage}
            onPageSizeChange={pagResumen.setPageSize}
          />
          {colaboradoresResumen.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay colaboradores con asignaciones
              {filtroResumen ? ` en estado «${filtroResumen}»` : ''}.
            </p>
          )}
        </TabsContent>

        <TabsContent value="lista" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="grid gap-2">
              <Label className="text-xs">Estado del curso</Label>
              <select
                className={selectClass + ' w-[200px]'}
                value={filtroLista}
                onChange={(e) => setFiltroLista((e.target.value || '') as EstadoCap | '')}
              >
                <option value="">Todos</option>
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Departamentos elegibles</TableHead>
                    <TableHead>Modalidad</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead>Fechas</TableHead>
                    <TableHead>Asignados</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageCapsTabla.map((cap) => {
                    const depts = departamentosFromCap(cap)
                    return (
                      <TableRow key={cap._id}>
                        <TableCell className="max-w-[200px] font-medium">{cap.nombre}</TableCell>
                        <TableCell className="text-sm">{proveedorNombreFromCap(cap) || '—'}</TableCell>
                        <TableCell>
                          {depts.length === 0 ? (
                            <Badge variant="secondary" className="bg-[var(--lime-lt)] py-0 text-[10px] text-[var(--navy)]">
                              Abierta a todos
                            </Badge>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {depts.slice(0, 3).map((d) => (
                                <Badge key={d._id} variant="outline" className="gap-1 py-0 text-[10px]">
                                  <span
                                    className="size-2 rounded-full"
                                    style={{ background: d.color ?? '#002060' }}
                                  />
                                  {d.codigo}
                                </Badge>
                              ))}
                              {depts.length > 3 && (
                                <Badge variant="outline" className="py-0 text-[10px]">+{depts.length - 3}</Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{cap.modalidad ?? '—'}</TableCell>
                        <TableCell className="text-right">{cap.duracion_horas ?? '—'}</TableCell>
                        <TableCell className="text-right">{formatLps(cap.costo ?? null)}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDateDMY(cap.fecha_inicio)} — {formatDateDMY(cap.fecha_fin)}
                        </TableCell>
                        <TableCell className="text-xs">{cap.asignados.length}</TableCell>
                        <TableCell>{cap.estado}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditCap(cap)}
                          >
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <PaginationBar
                page={pagLista.page}
                totalPages={pagLista.totalPages}
                pageSize={pagLista.pageSize}
                totalItems={pagLista.totalItems}
                fromItem={pagLista.fromItem}
                toItem={pagLista.toItem}
                onPageChange={pagLista.setPage}
                onPageSizeChange={pagLista.setPageSize}
              />
              </>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="asignar" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Asignar colaboradores a una capacitación</CardTitle>
              <p className="text-sm text-muted-foreground">
                Selecciona el curso y marca a quiénes aplica. No duplica asignaciones existentes.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 max-w-md">
                <Label>Capacitación</Label>
                <select
                  className={selectClass}
                  value={assignCapId}
                  onChange={(e) => { setAssignCapId(e.target.value); setAssignPick({}) }}
                >
                  <option value="">Seleccione…</option>
                  {caps.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              {(() => {
                const cap = caps.find((c) => c._id === assignCapId) ?? null
                const elegibles = colaboradoresElegibles(cap)
                if (!cap) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      Selecciona una capacitación para ver los colaboradores elegibles según sus departamentos.
                    </p>
                  )
                }
                const depts = departamentosFromCap(cap)
                return (
                  <>
                    <div className="rounded-md border bg-[var(--blue-lt)]/20 p-3 text-xs">
                      {depts.length === 0 ? (
                        <span>Esta capacitación está abierta a todos los departamentos ({elegibles.length} colaboradores elegibles).</span>
                      ) : (
                        <span>
                          Elegibles: <strong>{elegibles.length}</strong> colaboradores de
                          {' '}{depts.map((d) => d.nombre).join(', ')}.
                        </span>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {elegibles.map((c) => (
                        <label
                          key={c._id}
                          className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--lime)]"
                            checked={!!assignPick[c._id]}
                            onChange={(e) =>
                              setAssignPick((p) => ({ ...p, [c._id]: e.target.checked }))
                            }
                          />
                          <span className="min-w-0 truncate">
                            {c.nombre}
                            <span className="block text-xs text-muted-foreground">{c.codigo}</span>
                          </span>
                        </label>
                      ))}
                      {elegibles.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Ningún colaborador pertenece a los departamentos permitidos.
                        </p>
                      )}
                    </div>
                  </>
                )
              })()}
              <Button
                type="button"
                disabled={assignBusy || !assignCapId}
                className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
                onClick={async () => {
                  const ids = Object.entries(assignPick)
                    .filter(([, v]) => v)
                    .map(([k]) => k)
                  if (!assignCapId || ids.length === 0) {
                    window.alert('Selecciona capacitación y al menos un colaborador.')
                    return
                  }
                  setAssignBusy(true)
                  try {
                    const doc = await asignarCapacitacion(assignCapId, ids)
                    setCaps((list) => mergeCap(list, doc))
                    setAssignPick({})
                    window.alert('Asignación guardada.')
                  } catch (e) {
                    window.alert(e instanceof Error ? e.message : 'Error')
                  } finally {
                    setAssignBusy(false)
                  }
                }}
              >
                {assignBusy ? 'Guardando…' : 'Asignar seleccionados'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reporte" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalle por persona y curso</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Capacitación</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha completado</TableHead>
                    <TableHead className="text-right">Calificación</TableHead>
                    <TableHead>Diploma (opcional)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageReporteRows.map((r) => (
                    <TableRow key={`${r.capId}-${r.colaborador_id}`}>
                      <TableCell>{r.nombre}</TableCell>
                      <TableCell className="max-w-[220px] text-sm">{r.capNombre}</TableCell>
                      <TableCell>
                        <select
                          className={selectClass + ' min-w-[140px]'}
                          value={r.estado}
                          onChange={(e) => {
                            const v = e.target.value as EstadoCap
                            void patchAsignacion(r.capId, r.colaborador_id, { estado: v })
                          }}
                        >
                          {ESTADOS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          className="h-8 w-[140px]"
                          defaultValue={
                            r.fecha_completado
                              ? r.fecha_completado.slice(0, 10)
                              : ''
                          }
                          onBlur={(e) => {
                            const v = e.target.value
                            const iso = v ? `${v}T12:00:00.000Z` : null
                            const prev = r.fecha_completado
                              ? r.fecha_completado.slice(0, 10)
                              : ''
                            if (v === prev) return
                            void patchAsignacion(r.capId, r.colaborador_id, {
                              fecha_completado: iso,
                            })
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          className="ml-auto h-8 w-20 text-right"
                          key={`cal-${r.capId}-${r.colaborador_id}-${r.calificacion ?? ''}`}
                          defaultValue={r.calificacion ?? ''}
                          onBlur={(e) => {
                            const raw = e.target.value
                            const n = raw === '' ? null : Number(raw)
                            if (raw !== '' && Number.isNaN(n)) return
                            const prev =
                              r.calificacion === undefined || r.calificacion === null
                                ? ''
                                : String(r.calificacion)
                            if (raw === prev) return
                            void patchAsignacion(r.capId, r.colaborador_id, {
                              calificacion: n,
                            })
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <DiplomaCelda
                          capId={r.capId}
                          colaboradorId={r.colaborador_id}
                          estado={r.estado}
                          certificado={r.certificado}
                          certificadoNombre={r.certificado_nombre}
                          onUpload={(file) => void uploadDiploma(r.capId, r.colaborador_id, file)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar
                page={pagReporte.page}
                totalPages={pagReporte.totalPages}
                pageSize={pagReporte.pageSize}
                totalItems={pagReporte.totalItems}
                fromItem={pagReporte.fromItem}
                toItem={pagReporte.toItem}
                onPageChange={pagReporte.setPage}
                onPageSizeChange={pagReporte.setPageSize}
              />
              </>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editCap && (
        <EditarCapacitacionDialog
          cap={editCap}
          proveedores={proveedores}
          departamentos={departamentos}
          onProveedorCreated={(p) => setProveedores((l) => [...l, p].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))}
          open={!!editCap}
          onOpenChange={(o) => !o && setEditCap(null)}
          onSaved={(doc) => {
            setCaps((list) => mergeCap(list, doc))
            setEditCap(null)
          }}
        />
      )}
    </div>
  )
}

type CapacitacionFormState = {
  nombre: string
  proveedor_id: string
  modalidad: string
  duracion_horas: string
  costo: string
  fecha_inicio: string
  fecha_fin: string
  estado: EstadoCap
  departamentos_ids: string[]
}

function emptyForm(departamentosIds: string[] = []): CapacitacionFormState {
  return {
    nombre: '',
    proveedor_id: '',
    modalidad: '',
    duracion_horas: '',
    costo: '',
    fecha_inicio: '',
    fecha_fin: '',
    estado: 'Pendiente',
    departamentos_ids: [...departamentosIds],
  }
}

function formFromCap(cap: CapacitacionDoc): CapacitacionFormState {
  const provId =
    cap.proveedor_id && typeof cap.proveedor_id === 'object'
      ? (cap.proveedor_id as ProveedorCapacitacionDoc)._id
      : (cap.proveedor_id as string | null | undefined) ?? ''
  return {
    nombre: cap.nombre,
    proveedor_id: provId ?? '',
    modalidad: cap.modalidad ?? '',
    duracion_horas: cap.duracion_horas != null ? String(cap.duracion_horas) : '',
    costo: cap.costo != null ? String(cap.costo) : '',
    fecha_inicio: cap.fecha_inicio ? cap.fecha_inicio.slice(0, 10) : '',
    fecha_fin: cap.fecha_fin ? cap.fecha_fin.slice(0, 10) : '',
    estado: cap.estado,
    departamentos_ids: departamentoIdsFromCap(cap),
  }
}

function formToBody(form: CapacitacionFormState, includeEstado: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    nombre: form.nombre.trim(),
    proveedor_id: form.proveedor_id || null,
    modalidad: form.modalidad || undefined,
    duracion_horas: form.duracion_horas ? Number(form.duracion_horas) : undefined,
    costo: form.costo ? Number(form.costo) : undefined,
    fecha_inicio: form.fecha_inicio || undefined,
    fecha_fin: form.fecha_fin || undefined,
    departamentos_ids: form.departamentos_ids,
  }
  if (includeEstado) body.estado = form.estado
  return body
}

function ProveedorSelector({
  proveedores, value, onChange, onProveedorCreated,
}: {
  proveedores: ProveedorCapacitacionDoc[]
  value: string
  onChange: (v: string) => void
  onProveedorCreated: (p: ProveedorCapacitacionDoc) => void
}) {
  const puedeCrearProveedor = useAuthStore((s) => s.hasPermiso('maestros:editar'))
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [savingProv, setSavingProv] = useState(false)

  async function handleCreate() {
    const nombre = newName.trim()
    if (!nombre) return
    setSavingProv(true)
    try {
      const doc = await createProveedorCapacitacion({ nombre })
      onProveedorCreated(doc)
      onChange(doc._id)
      setCreating(false)
      setNewName('')
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error creando proveedor')
    } finally {
      setSavingProv(false)
    }
  }

  if (creating) {
    return (
      <div className="grid gap-2">
        <div className="flex gap-2">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del nuevo proveedor"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleCreate() } }}
          />
          <Button
            type="button"
            size="sm"
            disabled={savingProv || !newName.trim()}
            onClick={() => void handleCreate()}
            className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
          >
            {savingProv ? '...' : 'Crear'}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => { setCreating(false); setNewName('') }}>
            Cancelar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Se guardará en el maestro de proveedores y quedará disponible para otras capacitaciones.
        </p>
      </div>
    )
  }

  return (
    <select
      className={selectClass}
      value={value}
      onChange={(e) => {
        const v = e.target.value
        if (v === NUEVO_PROVEEDOR_SENTINEL) { setCreating(true); return }
        onChange(v)
      }}
    >
      <option value="">— Sin proveedor —</option>
      {proveedores.map((p) => (
        <option key={p._id} value={p._id}>{p.nombre}{p.activo === false ? ' (inactivo)' : ''}</option>
      ))}
      {puedeCrearProveedor && (
        <option value={NUEVO_PROVEEDOR_SENTINEL}>＋ Crear nuevo proveedor…</option>
      )}
    </select>
  )
}

function DepartamentosMultiSelect({
  departamentos, value, onChange,
}: {
  departamentos: DepartamentoDoc[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  const set = new Set(value)
  return (
    <div className="grid gap-2 max-h-48 overflow-y-auto rounded-md border border-border p-2">
      <p className="text-xs text-muted-foreground">
        Si no marcas ningún departamento, la capacitación queda <strong>abierta para todos</strong>.
      </p>
      <div className="grid gap-1 sm:grid-cols-2">
        {departamentos.map((d) => (
          <label key={d._id} className="flex cursor-pointer items-center gap-2 rounded p-1 text-xs hover:bg-muted">
            <input
              type="checkbox"
              checked={set.has(d._id)}
              className="size-4 accent-[var(--lime)]"
              onChange={(e) => {
                const next = new Set(value)
                if (e.target.checked) next.add(d._id); else next.delete(d._id)
                onChange(Array.from(next))
              }}
            />
            <span
              className="size-2.5 rounded-full"
              style={{ background: d.color ?? '#002060' }}
            />
            <span className="truncate">{d.nombre} <span className="text-muted-foreground">({d.codigo})</span></span>
          </label>
        ))}
      </div>
    </div>
  )
}

function NuevaCapacitacionDialog({
  proveedores,
  departamentos,
  alcance,
  onProveedorCreated,
  onCreated,
}: {
  proveedores: ProveedorCapacitacionDoc[]
  departamentos: DepartamentoDoc[]
  alcance: CapacitacionesAlcance | null
  onProveedorCreated: (p: ProveedorCapacitacionDoc) => void
  onCreated: (doc: CapacitacionDoc) => void
}) {
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const deptDefault = useMemo(
    () => (alcance?.requiereDepartamentos ? alcance.departamentos.map((d) => d._id) : []),
    [alcance],
  )
  const [form, setForm] = useState<CapacitacionFormState>(() => emptyForm(deptDefault))

  useEffect(() => {
    if (open) setForm(emptyForm(deptDefault))
    else setForm(emptyForm())
  }, [open, deptDefault])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="gap-1.5 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
        >
          <Plus className="size-4" /> Nueva capacitación
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!form.nombre.trim()) return
            setBusy(true)
            try {
              const doc = await createCapacitacion(formToBody(form, false))
              onCreated(doc)
              setOpen(false)
            } catch (err) {
              window.alert(err instanceof Error ? err.message : 'Error')
            } finally {
              setBusy(false)
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Nueva capacitación</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nc-nombre">Nombre</Label>
              <Input
                id="nc-nombre"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Título del curso"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Proveedor</Label>
                <ProveedorSelector
                  proveedores={proveedores}
                  value={form.proveedor_id}
                  onChange={(v) => setForm({ ...form, proveedor_id: v })}
                  onProveedorCreated={onProveedorCreated}
                />
              </div>
              <div className="grid gap-2">
                <Label>Modalidad</Label>
                <select
                  className={selectClass}
                  value={form.modalidad}
                  onChange={(e) => setForm({ ...form, modalidad: e.target.value })}
                >
                  <option value="">—</option>
                  {MODALIDADES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="nc-horas">Duración (horas)</Label>
                <Input
                  id="nc-horas" type="number" min={0} step={1}
                  value={form.duracion_horas}
                  onChange={(e) => setForm({ ...form, duracion_horas: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nc-costo">Costo (Lps)</Label>
                <Input
                  id="nc-costo" type="number" min={0} step={1}
                  value={form.costo}
                  onChange={(e) => setForm({ ...form, costo: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="nc-fi">Inicio</Label>
                <Input
                  id="nc-fi" type="date"
                  value={form.fecha_inicio}
                  onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nc-ff">Fin</Label>
                <Input
                  id="nc-ff" type="date"
                  value={form.fecha_fin}
                  onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Departamentos elegibles</Label>
              <DepartamentosMultiSelect
                departamentos={departamentos}
                value={form.departamentos_ids}
                onChange={(v) => setForm({ ...form, departamentos_ids: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              type="submit"
              disabled={busy}
              className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
            >
              {busy ? 'Guardando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditarCapacitacionDialog({
  cap, proveedores, departamentos,
  onProveedorCreated,
  open, onOpenChange, onSaved,
}: {
  cap: CapacitacionDoc
  proveedores: ProveedorCapacitacionDoc[]
  departamentos: DepartamentoDoc[]
  onProveedorCreated: (p: ProveedorCapacitacionDoc) => void
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved: (doc: CapacitacionDoc) => void
}) {
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<CapacitacionFormState>(() => formFromCap(cap))

  useEffect(() => { setForm(formFromCap(cap)) }, [cap])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!form.nombre.trim()) return
            setBusy(true)
            try {
              const doc = await updateCapacitacion(cap._id, formToBody(form, true))
              onSaved(doc)
            } catch (err) {
              window.alert(err instanceof Error ? err.message : 'Error')
            } finally {
              setBusy(false)
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Editar capacitación</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ec-nombre">Nombre</Label>
              <Input
                id="ec-nombre" required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Proveedor</Label>
                <ProveedorSelector
                  proveedores={proveedores}
                  value={form.proveedor_id}
                  onChange={(v) => setForm({ ...form, proveedor_id: v })}
                  onProveedorCreated={onProveedorCreated}
                />
              </div>
              <div className="grid gap-2">
                <Label>Modalidad</Label>
                <select
                  className={selectClass}
                  value={form.modalidad}
                  onChange={(e) => setForm({ ...form, modalidad: e.target.value })}
                >
                  <option value="">—</option>
                  {MODALIDADES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="ec-horas">Duración (horas)</Label>
                <Input
                  id="ec-horas" type="number" min={0}
                  value={form.duracion_horas}
                  onChange={(e) => setForm({ ...form, duracion_horas: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ec-costo">Costo (Lps)</Label>
                <Input
                  id="ec-costo" type="number" min={0}
                  value={form.costo}
                  onChange={(e) => setForm({ ...form, costo: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="ec-fi">Inicio</Label>
                <Input
                  id="ec-fi" type="date"
                  value={form.fecha_inicio}
                  onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ec-ff">Fin</Label>
                <Input
                  id="ec-ff" type="date"
                  value={form.fecha_fin}
                  onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Estado del curso</Label>
              <select
                className={selectClass}
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoCap })}
              >
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Departamentos elegibles</Label>
              <DepartamentosMultiSelect
                departamentos={departamentos}
                value={form.departamentos_ids}
                onChange={(v) => setForm({ ...form, departamentos_ids: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
            >
              {busy ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DiplomaCelda({
  capId, colaboradorId, estado, certificado, certificadoNombre, onUpload,
}: {
  capId: string
  colaboradorId: string
  estado: EstadoCap
  certificado?: string | null
  certificadoNombre?: string | null
  onUpload: (file: File) => void
}) {
  const inputId = `dip-${capId}-${colaboradorId}`
  const certUrl = certificadoPublicUrl(certificado)
  const hayDiploma = !!certUrl
  const habilitado = estado === 'Completado' || hayDiploma

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hayDiploma && certUrl && (
        <a
          href={certUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-[var(--lime)]/40 bg-[var(--lime-lt)] px-2 py-1 text-xs text-[var(--navy)] hover:bg-[var(--lime-lt)]/70"
        >
          <Award className="size-3.5" />
          <span className="max-w-[120px] truncate">{certificadoNombre ?? 'Ver diploma'}</span>
        </a>
      )}
      <label
        htmlFor={inputId}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
          habilitado
            ? 'cursor-pointer border-border hover:bg-muted'
            : 'cursor-not-allowed border-border/50 text-muted-foreground'
        }`}
        title={
          habilitado
            ? 'Subir archivo de diploma o certificado (opcional)'
            : 'Cambia el estado a "Completado" para habilitar'
        }
      >
        <Upload className="size-3.5" />
        {hayDiploma ? 'Reemplazar' : 'Subir'}
      </label>
      <input
        id={inputId}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        disabled={!habilitado}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onUpload(f)
          e.currentTarget.value = ''
        }}
      />
    </div>
  )
}
