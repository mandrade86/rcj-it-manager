import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ClipboardList, Crown, Edit2, ListChecks, Plus, PlusCircle, Printer, Save, Sparkles, Target, Trash2, X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MaestroBulkDeleteBar } from '@/components/maestros/MaestroBulkDeleteBar'
import { MaestroListToolbar } from '@/components/maestros/MaestroListToolbar'
import { MaestroSortableHead } from '@/components/maestros/MaestroSortableHead'
import { MaestroSelectAllHeader, MaestroSelectCell } from '@/components/maestros/MaestroTableSelection'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { useMaestroBulkDelete } from '@/hooks/useMaestroBulkDelete'
import { usePagination } from '@/hooks/usePagination'
import { useMaestroList } from '@/hooks/useMaestroList'
import { MAESTRO_SELECT_CLASS, compareStrings, type MaestroSortDir } from '@/lib/maestroList'
import {
  createPerfilPuesto, deletePerfilPuesto, fetchPerfilesPuesto, fetchRubricaPerfil,
  updatePerfilPuesto, updateRubricaPerfil,
} from '@/lib/api/perfilesPuesto'
import { fetchDepartamentos } from '@/lib/api/departamentos'
import { KpisEvaluacionDialog } from '@/pages/maestros/KpisEvaluacionDialog'
import type { DepartamentoDoc } from '@/types/departamento'
import type { PerfilPuestoDoc, RubricaCriterio } from '@/types/perfilPuesto'
import { deptFromPerfil } from '@/types/perfilPuesto'
import { printDescriptorPuesto } from '@/lib/printDescriptorPuesto'

const selectClass = MAESTRO_SELECT_CLASS

function comparePerfiles(
  a: PerfilPuestoDoc,
  b: PerfilPuestoDoc,
  sortKey: string,
  dir: MaestroSortDir,
  _deptMap: Record<string, DepartamentoDoc>,
): number {
  const deptA = deptFromPerfil(a)
  const deptB = deptFromPerfil(b)
  switch (sortKey) {
    case 'departamento':
      return compareStrings(deptA?.nombre ?? '', deptB?.nombre ?? '', dir)
    case 'codigo':
      return compareStrings(a.codigo, b.codigo, dir)
    case 'titulo':
    default:
      return compareStrings(a.titulo, b.titulo, dir)
  }
}

type FormState = {
  codigo: string
  titulo: string
  departamento_id: string
  nivel: string
  reporta_a: string
  objetivo: string
  requisitos: string[]
  responsabilidades: string[]
  autoridad: string[]
  educacion: string
  experiencia: string
  competencias: string[]
  tiene_personal_a_cargo: boolean
  notas: string
}

function emptyForm(): FormState {
  return {
    codigo: '', titulo: '', departamento_id: '', nivel: '', reporta_a: '',
    objetivo: '', requisitos: [], responsabilidades: [], autoridad: [],
    educacion: '', experiencia: '', competencias: [],
    tiene_personal_a_cargo: false, notas: '',
  }
}

function fromDoc(d: PerfilPuestoDoc): FormState {
  const dept = deptFromPerfil(d)
  return {
    codigo: d.codigo,
    titulo: d.titulo,
    departamento_id: dept?._id ?? '',
    nivel: d.nivel ?? '',
    reporta_a: d.reporta_a ?? '',
    objetivo: d.objetivo ?? '',
    requisitos: d.requisitos ?? [],
    responsabilidades: d.responsabilidades ?? [],
    autoridad: d.autoridad ?? [],
    educacion: d.educacion ?? '',
    experiencia: d.experiencia ?? '',
    competencias: d.competencias ?? [],
    tiene_personal_a_cargo: d.tiene_personal_a_cargo ?? false,
    notas: d.notas ?? '',
  }
}

function ListaEditable({
  items,
  onChange,
  placeholder,
}: {
  items: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={item}
            onChange={(e) => { const n = [...items]; n[i] = e.target.value; onChange(n) }}
            placeholder={placeholder}
            className="text-sm"
          />
          <Button type="button" variant="ghost" size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="gap-2 text-xs"
        onClick={() => onChange([...items, ''])}>
        <PlusCircle className="size-3.5" /> Agregar
      </Button>
    </div>
  )
}

export function PerfilesPuestoPage() {
  const [list, setList] = useState<PerfilPuestoDoc[]>([])
  const [depts, setDepts] = useState<DepartamentoDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PerfilPuestoDoc | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [filterDept, setFilterDept] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<PerfilPuestoDoc | null>(null)
  const [rubricaTarget, setRubricaTarget] = useState<PerfilPuestoDoc | null>(null)
  const [kpisEvalTarget, setKpisEvalTarget] = useState<PerfilPuestoDoc | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const [pl, dp] = await Promise.all([fetchPerfilesPuesto(), fetchDepartamentos()])
      setList(pl); setDepts(dp)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void reload() }, [reload])

  function openNew() { setEditing(null); setForm(emptyForm()); setOpen(true) }
  function openEdit(d: PerfilPuestoDoc) { setEditing(d); setForm(fromDoc(d)); setOpen(true) }

  function setF<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const payload = {
        ...form,
        departamento_id: form.departamento_id || undefined,
        requisitos: form.requisitos.filter(Boolean),
        responsabilidades: form.responsabilidades.filter(Boolean),
        autoridad: form.autoridad.filter(Boolean),
        competencias: form.competencias.filter(Boolean),
      }
      if (editing) await updatePerfilPuesto(editing._id, payload)
      else await createPerfilPuesto(payload)
      setOpen(false)
      await reload()
    } catch (ex) { window.alert(ex instanceof Error ? ex.message : 'Error') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deletePerfilPuesto(deleteTarget._id)
      setDeleteTarget(null)
      await reload()
    } catch (ex) { window.alert(ex instanceof Error ? ex.message : 'Error') }
  }

  const deptMap = useMemo(() => Object.fromEntries(depts.map((d) => [d._id, d])), [depts])

  const maestro = useMaestroList({
    items: list,
    defaultSortKey: 'titulo',
    getActivo: () => true,
    searchTexts: (p) => {
      const d = deptFromPerfil(p)
      return [p.codigo, p.titulo, p.objetivo, d?.nombre, d?.codigo]
    },
    compare: (a, b, sortKey, sortDir) => comparePerfiles(a, b, sortKey, sortDir, deptMap),
  })
  const { rows: searched, busqueda, setBusqueda, filterActivo, setFilterActivo, sortKey, sortDir, onSort, total } =
    maestro

  const filtered = useMemo(() => {
    if (!filterDept) return searched
    return searched.filter((p) => {
      const d = deptFromPerfil(p)
      return d?._id === filterDept || d?.codigo === filterDept
    })
  }, [searched, filterDept])

  const pagination = usePagination(filtered.length, {
    resetKey: `${busqueda}|${filterActivo}|${sortKey}|${sortDir}|${filterDept}|${total}`,
  })
  const pageRows = pagination.slice(filtered)

  const visibleIds = useMemo(() => pageRows.map((p) => p._id), [pageRows])
  const bulk = useMaestroBulkDelete({
    recurso: 'perfiles-puesto',
    visibleIds,
    etiqueta: 'perfil(es)',
    onAfterDelete: reload,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Perfiles de Puesto</h2>
          <p className="text-sm text-muted-foreground">
            Catálogo de perfiles/puestos por departamento. Define objetivos, requisitos, responsabilidades y competencias.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90">
          <Plus className="size-4" /> Nuevo perfil
        </Button>
      </div>

      {!loading && list.length > 0 && (
        <MaestroListToolbar
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          busquedaPlaceholder="Código, título, departamento…"
          filterActivo={filterActivo}
          onFilterActivoChange={setFilterActivo}
          count={filtered.length}
          total={total}
          countLabel="perfil(es)"
        >
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Departamento</label>
            <select className={selectClass + ' min-w-[200px]'} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="">Todos</option>
              {depts.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.nombre} ({d.codigo})
                </option>
              ))}
            </select>
          </div>
        </MaestroListToolbar>
      )}

      {err && <p className="text-sm text-destructive">{err}</p>}

      {!loading && bulk.showBar && (
        <MaestroBulkDeleteBar
          seleccionCount={bulk.seleccionCount}
          bulkDeleting={bulk.bulkDeleting}
          onEliminar={() => void bulk.handleEliminarSeleccionados()}
          etiqueta="perfiles"
        />
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
          ) : list.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Sin perfiles registrados.</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Ningún perfil coincide con los filtros.</p>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <MaestroSelectAllHeader
                    allSelected={bulk.allSelected}
                    someSelected={bulk.someSelected}
                    onToggleAll={bulk.toggleAll}
                  />
                  <MaestroSortableHead column="codigo" label="Código" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <MaestroSortableHead column="titulo" label="Título del puesto" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <MaestroSortableHead column="departamento" label="Departamento" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <TableHead>Nivel</TableHead>
                  <TableHead>Jefatura</TableHead>
                  <TableHead>Evaluación</TableHead>
                  <TableHead>Reporta a</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((p) => {
                  const dept = deptFromPerfil(p)
                  const deptInfo = dept ? deptMap[dept._id] ?? dept : null
                  return (
                    <TableRow key={p._id}>
                      <MaestroSelectCell
                        id={p._id}
                        label={p.titulo}
                        selected={bulk.selectedIds.has(p._id)}
                        onToggle={bulk.toggle}
                      />
                      <TableCell className="font-mono text-sm font-semibold">{p.codigo}</TableCell>
                      <TableCell className="font-medium">{p.titulo}</TableCell>
                      <TableCell>
                        {deptInfo ? (
                          <div className="flex items-center gap-1.5">
                            <div className="size-2.5 rounded-full" style={{ background: deptInfo.color ?? '#002060' }} />
                            <span className="text-sm">{deptInfo.nombre}</span>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {p.nivel ? <Badge variant="secondary">{p.nivel}</Badge> : '—'}
                      </TableCell>
                      <TableCell>
                        {p.tiene_personal_a_cargo ? (
                          <Badge variant="secondary" className="gap-1 bg-[var(--navy)] py-0 text-[10px] text-white">
                            <Crown className="size-2.5" /> Con personal
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {p.rubrica_criterios && p.rubrica_criterios.length > 0 ? (
                            <Badge variant="secondary" className="gap-1 bg-[var(--lime-lt)] py-0 text-[10px] text-[var(--navy)]">
                              <ListChecks className="size-3" />
                              Rúbrica: {p.rubrica_criterios.length}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin rúbrica</span>
                          )}
                          {p.kpis_evaluacion && p.kpis_evaluacion.length > 0 ? (
                            <Badge variant="secondary" className="gap-1 bg-[var(--blue-lt)] py-0 text-[10px] text-[var(--navy)]">
                              <Target className="size-3" />
                              KPIs: {p.kpis_evaluacion.length}
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Sin KPIs</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.reporta_a || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar rúbrica de evaluación"
                            onClick={() => setRubricaTarget(p)}
                          >
                            <ClipboardList className="size-4 text-[var(--navy)]" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Evaluación por cumplimiento de KPI"
                            onClick={() => setKpisEvalTarget(p)}
                          >
                            <Target className="size-4 text-[var(--navy)]" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Imprimir descriptor (RH-F-04)"
                            onClick={() => printDescriptorPuesto({ perfil: p })}
                          >
                            <Printer className="size-4 text-[var(--navy)]" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                            <Edit2 className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(p)}>
                            <Trash2 className="size-4" />
                          </Button>
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
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar perfil de puesto' : 'Nuevo perfil de puesto'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            <Tabs defaultValue="basico">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basico">Básico</TabsTrigger>
                <TabsTrigger value="contenido">Contenido</TabsTrigger>
                <TabsTrigger value="competencias">Competencias</TabsTrigger>
              </TabsList>

              <TabsContent value="basico" className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Código <span className="text-destructive">*</span></Label>
                    <Input required value={form.codigo} onChange={(e) => setF('codigo', e.target.value)}
                      placeholder="IT-01, FIN-01…" disabled={Boolean(editing)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Título del puesto <span className="text-destructive">*</span></Label>
                    <Input required value={form.titulo} onChange={(e) => setF('titulo', e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Departamento</Label>
                    <select className={selectClass} value={form.departamento_id} onChange={(e) => setF('departamento_id', e.target.value)}>
                      <option value="">— Sin departamento —</option>
                      {depts.map((d) => <option key={d._id} value={d._id}>{d.nombre} ({d.codigo})</option>)}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Nivel</Label>
                    <Input value={form.nivel} onChange={(e) => setF('nivel', e.target.value)} placeholder="Junior, Senior, N1…" />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label>Reporta a</Label>
                    <Input value={form.reporta_a} onChange={(e) => setF('reporta_a', e.target.value)} placeholder="Jefe de Departamento" />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label>Objetivo del puesto</Label>
                    <Textarea rows={3} value={form.objetivo} onChange={(e) => setF('objetivo', e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Educación requerida</Label>
                    <Input value={form.educacion} onChange={(e) => setF('educacion', e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Experiencia requerida</Label>
                    <Input value={form.experiencia} onChange={(e) => setF('experiencia', e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--navy)]/20 bg-[var(--blue-lt)]/20 p-3 transition hover:border-[var(--navy)]/40">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-[var(--lime)]"
                        checked={form.tiene_personal_a_cargo}
                        onChange={(e) => setF('tiene_personal_a_cargo', e.target.checked)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Crown className="size-3.5 text-[var(--navy)]" />
                          <span className="text-sm font-medium">Este puesto tiene personal a cargo</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Marca esta casilla si el perfil corresponde a una posición de jefatura/coordinación.
                          Los usuarios amarrados a empleados con este perfil verán automáticamente a sus
                          subordinados en el organigrama.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="contenido" className="mt-4 space-y-5">
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requisitos</Label>
                  <ListaEditable items={form.requisitos} onChange={(v) => setF('requisitos', v)} placeholder="Requisito del puesto" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Responsabilidades</Label>
                  <ListaEditable items={form.responsabilidades} onChange={(v) => setF('responsabilidades', v)} placeholder="Responsabilidad" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Autoridad / Toma de decisiones</Label>
                  <ListaEditable items={form.autoridad} onChange={(v) => setF('autoridad', v)} placeholder="Facultad de decisión" />
                </div>
              </TabsContent>

              <TabsContent value="competencias" className="mt-4 space-y-4">
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Competencias clave</Label>
                  <ListaEditable items={form.competencias} onChange={(v) => setF('competencias', v)} placeholder="Competencia" />
                </div>
                <div className="grid gap-2">
                  <Label>Notas adicionales</Label>
                  <Textarea rows={3} value={form.notas} onChange={(e) => setF('notas', e.target.value)} />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2 sm:flex-wrap sm:justify-between">
              {editing ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 sm:mr-auto"
                  onClick={() =>
                    printDescriptorPuesto({
                      perfil: {
                        ...editing,
                        codigo: form.codigo,
                        titulo: form.titulo,
                        reporta_a: form.reporta_a,
                        objetivo: form.objetivo,
                        requisitos: form.requisitos,
                        responsabilidades: form.responsabilidades,
                        autoridad: form.autoridad,
                        educacion: form.educacion,
                        experiencia: form.experiencia,
                        competencias: form.competencias,
                        notas: form.notas,
                        nivel: form.nivel,
                        tiene_personal_a_cargo: form.tiene_personal_a_cargo,
                        departamento_id:
                          depts.find((d) => d._id === form.departamento_id) ?? editing.departamento_id,
                      },
                    })
                  }
                >
                  <Printer className="size-4" />
                  Vista previa / imprimir
                </Button>
              ) : null}
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rúbrica de evaluación */}
      <RubricaEditorDialog
        perfil={rubricaTarget}
        onClose={() => setRubricaTarget(null)}
        onSaved={() => { setRubricaTarget(null); void reload() }}
      />

      {/* Evaluación por cumplimiento de KPI (admin-only) */}
      <KpisEvaluacionDialog
        perfil={kpisEvalTarget}
        onClose={() => setKpisEvalTarget(null)}
        onSaved={() => { setKpisEvalTarget(null); void reload() }}
      />

      {/* Delete confirm */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar perfil de puesto</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar el perfil <strong>{deleteTarget?.titulo}</strong> ({deleteTarget?.codigo})?
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Rúbrica sugerida por código de puesto ────────────────────────────────────
// Estas sugerencias se replican del seed (initData.ts) para que el usuario
// pueda regenerarlas desde la UI con un clic.

const RUBRICA_GESTION: RubricaCriterio[] = [
  { categoria: 'Gestión Estratégica', criterio: 'Planificación y ejecución del portafolio alineado al negocio', descripcion: 'Define iniciativas con caso de negocio y prioriza según valor para la organización.' },
  { categoria: 'Gestión Estratégica', criterio: 'Gestión del presupuesto OPEX / CAPEX del área', descripcion: 'Controla el gasto, justifica desviaciones y optimiza costos sin afectar el servicio.' },
  { categoria: 'Gestión Estratégica', criterio: 'Cumplimiento de KPIs y metas anuales del área', descripcion: 'Hace seguimiento periódico de métricas y ajusta el plan para cumplir objetivos.' },
  { categoria: 'Gestión Estratégica', criterio: 'Gestión de riesgos y continuidad del negocio', descripcion: 'Identifica riesgos, define controles y ejecuta planes de continuidad / DR.' },
  { categoria: 'Liderazgo', criterio: 'Desarrollo de personas y mentoría del equipo a cargo', descripcion: 'Conduce evaluaciones, planes de carrera y mentorías estructuradas.' },
  { categoria: 'Liderazgo', criterio: 'Delegación efectiva y seguimiento a compromisos', descripcion: 'Asigna trabajo según fortalezas y da seguimiento sin micromanejo.' },
  { categoria: 'Liderazgo', criterio: 'Gestión del cambio y adopción de iniciativas', descripcion: 'Comunica el porqué del cambio, gestiona resistencia y asegura adopción.' },
  { categoria: 'Gestión Operativa', criterio: 'Respuesta y coordinación ante incidentes críticos', descripcion: 'Coordina respuesta, comunicación a stakeholders y postmortem accionable.' },
  { categoria: 'Gestión Operativa', criterio: 'Gestión de proveedores y contratos de servicio', descripcion: 'Negocia SLAs, supervisa entregables y maneja escalamientos.' },
  { categoria: 'Gestión Operativa', criterio: 'Adopción de estándares, políticas y buenas prácticas', descripcion: 'Mantiene normativas vigentes y promueve su uso en el equipo.' },
  { categoria: 'Competencias Directivas', criterio: 'Comunicación con stakeholders y reporte ejecutivo', descripcion: 'Presenta avances y riesgos con narrativa y datos a presidencia / gerencia.' },
  { categoria: 'Competencias Directivas', criterio: 'Toma de decisiones bajo presión e incertidumbre', descripcion: 'Decide con información parcial, asume responsabilidad y reevalúa.' },
  { categoria: 'Competencias Directivas', criterio: 'Visión técnica del frente bajo su responsabilidad', descripcion: 'Mantiene profundidad técnica suficiente para retar y validar al equipo.' },
]

const RUBRICA_COORDINACION: RubricaCriterio[] = [
  { categoria: 'Gestión del Equipo', criterio: 'Asignación y priorización efectiva de trabajo al equipo', descripcion: 'Reparte el trabajo según habilidades y urgencia.' },
  { categoria: 'Gestión del Equipo', criterio: 'Seguimiento al avance de tareas y compromisos', descripcion: 'Reuniones cortas, tablero al día, detección temprana de bloqueos.' },
  { categoria: 'Gestión del Equipo', criterio: 'Mentoría técnica y desarrollo de capacidades', descripcion: 'Apoya el crecimiento con retroalimentación y planes individuales.' },
  { categoria: 'Gestión del Equipo', criterio: 'Resolución de bloqueos y facilitación de entregas', descripcion: 'Quita obstáculos al equipo: dependencias, accesos, decisiones rápidas.' },
  { categoria: 'Gestión Técnica', criterio: 'Dominio técnico del frente bajo su coordinación', descripcion: 'Profundidad técnica suficiente para retar diseños y participar en revisiones.' },
  { categoria: 'Gestión Técnica', criterio: 'Definición y cumplimiento de estándares técnicos', descripcion: 'Mantiene guías, code style y arquitectura de referencia.' },
  { categoria: 'Gestión Técnica', criterio: 'Gestión de calidad y revisión de entregables', descripcion: 'Garantiza pruebas, revisiones de código y criterio de aceptación.' },
  { categoria: 'Gestión Operativa', criterio: 'Planificación de sprints / ciclos de trabajo', descripcion: 'Estima, prioriza y cumple compromisos del ciclo.' },
  { categoria: 'Gestión Operativa', criterio: 'Reporte de avance y comunicación al Jefe', descripcion: 'Reporta hechos, métricas y riesgos sin maquillar.' },
  { categoria: 'Gestión Operativa', criterio: 'Gestión de riesgos técnicos del frente', descripcion: 'Detecta riesgos y propone planes de mitigación con costo / beneficio.' },
  { categoria: 'Competencias', criterio: 'Comunicación efectiva con stakeholders internos', descripcion: 'Explica trade-offs y traduce términos técnicos a las áreas de negocio.' },
  { categoria: 'Competencias', criterio: 'Adaptabilidad y gestión del cambio', descripcion: 'Replanifica con calma cuando cambian prioridades.' },
  { categoria: 'Competencias', criterio: 'Orientación a resultados y cumplimiento de SLAs', descripcion: 'Mide cumplimiento de SLAs / OKRs y corrige proactivamente.' },
]

const RUBRICA_DESARROLLO: RubricaCriterio[] = [
  { categoria: 'Fundamentos', criterio: 'Comprensión de algoritmos y lógica de programación', descripcion: 'Resuelve problemas con lógica clara, justifica decisiones algorítmicas.' },
  { categoria: 'Fundamentos', criterio: 'Estructuras de datos y complejidad', descripcion: 'Elige estructuras adecuadas y entiende costos en tiempo / memoria.' },
  { categoria: 'Fundamentos', criterio: 'Fundamentos de redes y protocolos relevantes', descripcion: 'Conoce HTTP, TCP/IP, DNS y debugging de comunicación.' },
  { categoria: 'Desarrollo', criterio: 'Calidad de código, legibilidad y mantenibilidad', descripcion: 'Código autoexplicativo, nombres claros, funciones cortas y modulares.' },
  { categoria: 'Desarrollo', criterio: 'Pruebas (unitarias / integración) y evidencias', descripcion: 'Cubre rutas críticas con pruebas y mantiene la suite estable.' },
  { categoria: 'Desarrollo', criterio: 'Diseño OO / patrones y principios SOLID', descripcion: 'Aplica responsabilidad única, DI y patrones cuando aporta valor.' },
  { categoria: 'Desarrollo', criterio: 'Seguridad en desarrollo y manejo de secretos', descripcion: 'Maneja secretos fuera del repo, sanea entradas y conoce OWASP Top 10.' },
  { categoria: 'Herramientas', criterio: 'Control de versiones (Git) y flujo de ramas', descripcion: 'Domina rebase/merge, conflictos y PRs con revisiones.' },
  { categoria: 'Herramientas', criterio: 'IDE, depuración y productividad', descripcion: 'Depura con breakpoints y usa atajos productivos del IDE.' },
  { categoria: 'Herramientas', criterio: 'CI/CD y automatización de build / deploy', descripcion: 'Conoce / configura pipelines y automatiza pruebas y despliegues.' },
  { categoria: 'Herramientas', criterio: 'Bases de datos y consultas eficientes', descripcion: 'Diseña esquemas, lee planes de ejecución y evita N+1.' },
  { categoria: 'Competencias', criterio: 'Comunicación técnica y trabajo en equipo', descripcion: 'Explica decisiones, documenta y colabora en revisiones.' },
  { categoria: 'Competencias', criterio: 'Resolución de problemas y análisis de causa raíz', descripcion: 'Investiga el porqué, no parchea; propone soluciones permanentes.' },
  { categoria: 'Competencias', criterio: 'Autonomía, ownership y seguimiento a compromisos', descripcion: 'Toma responsabilidad de entregables, comunica riesgos y cumple plazos.' },
]

const RUBRICA_SOPORTE: RubricaCriterio[] = [
  { categoria: 'Soporte y Servicio', criterio: 'Registro y clasificación correcta de incidentes en ITSM', descripcion: 'Categoriza correctamente cada ticket para análisis fiables.' },
  { categoria: 'Soporte y Servicio', criterio: 'Cumplimiento de SLAs y tiempos de respuesta', descripcion: 'Cumple los tiempos pactados y alerta cuando hay riesgo.' },
  { categoria: 'Soporte y Servicio', criterio: 'Comunicación con usuarios finales', descripcion: 'Trato cordial, lenguaje no técnico cuando aplica.' },
  { categoria: 'Soporte y Servicio', criterio: 'Tasa de resolución en primer contacto (FCR)', descripcion: 'Resuelve la mayor parte de incidencias en la primera interacción.' },
  { categoria: 'Infraestructura', criterio: 'Diagnóstico de hardware, software y periféricos', descripcion: 'Diagnostica con método sistemático en equipos de usuario final.' },
  { categoria: 'Infraestructura', criterio: 'Administración básica de redes (LAN / WiFi / VPN)', descripcion: 'Identifica problemas de conectividad y enrutamiento básico.' },
  { categoria: 'Infraestructura', criterio: 'Gestión de Active Directory y cuentas de usuario', descripcion: 'Crea / edita usuarios, grupos y GPOs siguiendo políticas.' },
  { categoria: 'Infraestructura', criterio: 'Soporte a sistemas operativos Windows / Linux', descripcion: 'Instala, actualiza y diagnostica SO con comandos básicos.' },
  { categoria: 'Herramientas', criterio: 'Uso de sistema de ticketing (ITSM)', descripcion: 'Registra, categoriza y cierra tickets con calidad documental.' },
  { categoria: 'Herramientas', criterio: 'Conocimiento de monitoreo y alertas', descripcion: 'Interpreta alertas y escala correctamente.' },
  { categoria: 'Herramientas', criterio: 'Documentación de procedimientos y KB', descripcion: 'Documenta soluciones recurrentes; mantiene la KB al día.' },
  { categoria: 'Competencias', criterio: 'Escalamiento adecuado y trabajo colaborativo', descripcion: 'Reconoce sus límites y escala con contexto completo.' },
  { categoria: 'Competencias', criterio: 'Gestión del tiempo y priorización de incidentes', descripcion: 'Atiende según severidad sin bloquear al equipo.' },
  { categoria: 'Competencias', criterio: 'Iniciativa y propuesta de mejoras al proceso', descripcion: 'Identifica fricciones y propone mejoras (automatización, FAQs).' },
]

type Plantilla = { id: string; label: string; descripcion: string; criterios: RubricaCriterio[] }

const PLANTILLAS: Plantilla[] = [
  { id: 'gestion', label: 'Gestión / Jefatura', descripcion: 'Sugerida para Jefes de área (IT-01, etc.). 13 criterios.', criterios: RUBRICA_GESTION },
  { id: 'coordinacion', label: 'Coordinación', descripcion: 'Sugerida para Coordinadores (IT-02, IT-03). 13 criterios.', criterios: RUBRICA_COORDINACION },
  { id: 'desarrollo', label: 'Desarrollo / Programación', descripcion: 'Sugerida para Programadores (IT-04A/B/C). 14 criterios.', criterios: RUBRICA_DESARROLLO },
  { id: 'soporte', label: 'Soporte Técnico', descripcion: 'Sugerida para Soporte N1 / N2 (IT-06A, IT-06B). 14 criterios.', criterios: RUBRICA_SOPORTE },
]

/** Devuelve la plantilla sugerida según el código del perfil. */
function plantillaSugerida(codigo: string): Plantilla {
  const c = codigo.toUpperCase()
  if (c === 'IT-01') return PLANTILLAS[0]
  if (c === 'IT-02' || c === 'IT-03') return PLANTILLAS[1]
  if (c.startsWith('IT-04')) return PLANTILLAS[2]
  if (c.startsWith('IT-06')) return PLANTILLAS[3]
  // Heurística genérica por palabras clave del título también podría aplicarse
  return PLANTILLAS[2]
}

// ─── Editor de rúbrica ───────────────────────────────────────────────────────

function RubricaEditorDialog({
  perfil, onClose, onSaved,
}: {
  perfil: PerfilPuestoDoc | null
  onClose: () => void
  onSaved: () => void
}) {
  const [criterios, setCriterios] = useState<RubricaCriterio[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = Boolean(perfil)

  const sugerida = useMemo(
    () => (perfil ? plantillaSugerida(perfil.codigo) : null),
    [perfil],
  )

  useEffect(() => {
    if (!perfil) { setCriterios([]); return }
    let cancelled = false
    setLoading(true); setError(null)
    fetchRubricaPerfil(perfil._id)
      .then((r) => { if (!cancelled) setCriterios(r.criterios) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Error') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [perfil])

  function addCriterio(categoria = '', criterio = '', descripcion = '') {
    setCriterios((cs) => [...cs, { categoria, criterio, descripcion }])
  }

  function updateCriterio(i: number, patch: Partial<RubricaCriterio>) {
    setCriterios((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  }

  function removeCriterio(i: number) {
    setCriterios((cs) => cs.filter((_, idx) => idx !== i))
  }

  function loadPlantilla(p: Plantilla) {
    if (criterios.length > 0) {
      const ok = window.confirm(
        `Esto reemplazará los ${criterios.length} criterios actuales con la plantilla "${p.label}" (${p.criterios.length}). ¿Continuar?`,
      )
      if (!ok) return
    }
    setCriterios(p.criterios.map((c) => ({ ...c })))
  }

  function appendPlantilla(p: Plantilla) {
    setCriterios((cs) => [...cs, ...p.criterios.map((c) => ({ ...c }))])
  }

  async function handleSave() {
    if (!perfil) return
    const limpios = criterios.filter((c) => c.categoria.trim() && c.criterio.trim())
    if (limpios.length === 0) {
      setError('Agrega al menos un criterio con categoría y nombre.')
      return
    }
    setSaving(true); setError(null)
    try {
      await updateRubricaPerfil(perfil._id, limpios)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // Agrupar por categoría para visualización
  const porCategoria = useMemo(() => {
    const map = new Map<string, { index: number; criterio: RubricaCriterio }[]>()
    criterios.forEach((c, i) => {
      const key = c.categoria || '(Sin categoría)'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push({ index: i, criterio: c })
    })
    return Array.from(map.entries())
  }, [criterios])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="size-5 text-[var(--navy)]" />
            Rúbrica de evaluación
            {perfil && (
              <span className="text-sm font-normal text-muted-foreground">
                · {perfil.codigo} {perfil.titulo}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Sugerencias */}
        {sugerida && (
          <div className="rounded-lg border border-[var(--lime)]/40 bg-[var(--lime-lt)]/40 p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 size-4 text-[var(--lime)]" />
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--navy)]">
                    Sugerencia para este perfil
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Según el código <code className="rounded bg-white px-1">{perfil?.codigo}</code>, te
                    sugerimos la plantilla <strong>{sugerida.label}</strong> ({sugerida.criterios.length} criterios).
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => loadPlantilla(sugerida)}
                  >
                    <Sparkles className="size-3" /> Usar plantilla sugerida
                  </Button>
                  <details className="text-xs">
                    <summary className="cursor-pointer rounded border border-input bg-white px-2 py-1 hover:bg-muted">
                      Otras plantillas
                    </summary>
                    <div className="mt-2 grid gap-1">
                      {PLANTILLAS.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 rounded border border-border bg-white px-2 py-1">
                          <span className="flex-1">
                            <span className="font-medium">{p.label}</span>
                            <span className="ml-1 text-muted-foreground">— {p.descripcion}</span>
                          </span>
                          <Button type="button" size="sm" variant="ghost" onClick={() => loadPlantilla(p)}>
                            Reemplazar
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => appendPlantilla(p)}>
                            Agregar
                          </Button>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {loading ? 'Cargando rúbrica…' : `${criterios.length} criterio(s)`}
            </p>
            <Button type="button" size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => addCriterio()}>
              <PlusCircle className="size-3.5" /> Agregar criterio
            </Button>
          </div>

          {!loading && criterios.length === 0 && (
            <p className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Sin criterios. Usa una plantilla sugerida arriba o crea criterios manualmente.
            </p>
          )}

          {porCategoria.map(([categoria, rows]) => (
            <div key={categoria} className="overflow-hidden rounded-lg border border-border">
              <div className="bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--navy)]">
                {categoria} <span className="text-muted-foreground">· {rows.length}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="w-1/4">Categoría</TableHead>
                    <TableHead className="w-1/3">Criterio</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ index, criterio }) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={criterio.categoria}
                          onChange={(e) => updateCriterio(index, { categoria: e.target.value })}
                          className="text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={criterio.criterio}
                          onChange={(e) => updateCriterio(index, { criterio: e.target.value })}
                          className="text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Textarea
                          rows={2}
                          value={criterio.descripcion ?? ''}
                          onChange={(e) => updateCriterio(index, { descripcion: e.target.value })}
                          className="text-sm"
                          placeholder="Qué esperamos ver para considerar este criterio cumplido…"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeCriterio(index)}
                        >
                          <X className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={saving || loading}
            className="gap-2 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
            onClick={() => void handleSave()}
          >
            <Save className="size-4" />
            {saving ? 'Guardando…' : 'Guardar rúbrica'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
