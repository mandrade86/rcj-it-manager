import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Edit2, Factory, Plus, Target, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'

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
import { MaestroBulkDeleteBar } from '@/components/maestros/MaestroBulkDeleteBar'
import { MaestroListToolbar } from '@/components/maestros/MaestroListToolbar'
import { MaestroSortableHead } from '@/components/maestros/MaestroSortableHead'
import { MetasDepartamentoDialog } from '@/components/kpis/MetasDepartamentoDialog'
import {
  createDepartamento, deleteDepartamento, fetchDepartamentos, updateDepartamento,
} from '@/lib/api/departamentos'
import { useAuthStore } from '@/store/authStore'
import { getMetasDepartamento } from '@/lib/metasDepartamento'
import { MaestroSelectAllHeader, MaestroSelectCell } from '@/components/maestros/MaestroTableSelection'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { useMaestroBulkDelete } from '@/hooks/useMaestroBulkDelete'
import { useMaestroList } from '@/hooks/useMaestroList'
import { usePagination } from '@/hooks/usePagination'
import { MAESTRO_SELECT_CLASS, compareNumbers, compareStrings, type MaestroSortDir } from '@/lib/maestroList'
import { fetchEjesProyecto } from '@/lib/api/ejesProyecto'
import { fetchEmpresas } from '@/lib/api/empresas'
import type { DepartamentoDoc } from '@/types/departamento'
import type { EmpresaDoc } from '@/types/empresa'
import type { EjeProyectoDoc } from '@/types/ejeProyecto'

const COLORS_PRESET = [
  '#002060', '#70AD47', '#C00000', '#4527A0', '#0F6E56',
  '#7F6000', '#1F4E79', '#375623', '#FF6B35', '#2C3E50',
]

type FormState = {
  codigo: string
  nombre: string
  descripcion: string
  color: string
  ejes_proyecto: string[]
  lleva_gastos: boolean
  archivo_gastos: string
  activo: boolean
}

function defaultArchivoGastos(codigo: string): string {
  const safe = codigo.trim().replace(/[^A-Za-z0-9_-]+/g, '').toLowerCase()
  return safe ? `data/gastos-${safe}.xlsx` : 'data/gastos.xlsx'
}

function emptyForm(): FormState {
  return {
    codigo: '',
    nombre: '',
    descripcion: '',
    color: '#002060',
    ejes_proyecto: [],
    lleva_gastos: false,
    archivo_gastos: '',
    activo: true,
  }
}
function empresaLabel(d: DepartamentoDoc): string {
  if (typeof d.empresa_id === 'object' && d.empresa_id != null && 'nombre' in d.empresa_id) {
    return d.empresa_id.nombre
  }
  if (d.ehr_empresa_id != null) return `EHR ${d.ehr_empresa_id}`
  return ''
}

function empresaMongoIdFromDepartamento(d: DepartamentoDoc): string | null {
  const e = d.empresa_id
  if (e && typeof e === 'object' && '_id' in e) return String((e as { _id: string })._id)
  if (typeof e === 'string' && e.trim()) return e.trim()
  return null
}

function departamentoMatchesEmpresa(
  d: DepartamentoDoc,
  filterEmpresaId: string,
  empresas: EmpresaDoc[],
): boolean {
  if (!filterEmpresaId) return true
  if (empresaMongoIdFromDepartamento(d) === filterEmpresaId) return true
  const emp = empresas.find((x) => x._id === filterEmpresaId)
  if (emp?.ehr_empresa_id != null && d.ehr_empresa_id === emp.ehr_empresa_id) return true
  return false
}

function compareDepartamentos(
  a: DepartamentoDoc,
  b: DepartamentoDoc,
  sortKey: string,
  dir: MaestroSortDir,
): number {
  switch (sortKey) {
    case 'nombre':
      return compareStrings(a.nombre, b.nombre, dir)
    case 'empresa':
      return compareStrings(empresaLabel(a), empresaLabel(b), dir)
    case 'ehr_id':
      return compareNumbers(a.ehr_departamento_id ?? 0, b.ehr_departamento_id ?? 0, dir)
    case 'metas':
      return compareNumbers(
        getMetasDepartamento(a).filter((m) => m.activa !== false).length,
        getMetasDepartamento(b).filter((m) => m.activa !== false).length,
        dir,
      )
    case 'codigo':
    default:
      return compareStrings(a.codigo, b.codigo, dir)
  }
}

function fromDoc(d: DepartamentoDoc): FormState {
  return {
    codigo: d.codigo,
    nombre: d.nombre,
    descripcion: d.descripcion ?? '',
    color: d.color ?? '#002060',
    ejes_proyecto: d.ejes_proyecto ?? [],
    lleva_gastos: Boolean(d.lleva_gastos),
    archivo_gastos: d.archivo_gastos ?? '',
    activo: d.activo ?? true,
  }
}

const selectClass = MAESTRO_SELECT_CLASS

export function DepartamentosPage() {
  const [list, setList] = useState<DepartamentoDoc[]>([])
  const [empresasCatalog, setEmpresasCatalog] = useState<EmpresaDoc[]>([])
  const [filterEmpresa, setFilterEmpresa] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DepartamentoDoc | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DepartamentoDoc | null>(null)
  const [ejesCatalogo, setEjesCatalogo] = useState<EjeProyectoDoc[]>([])
  const [metasDept, setMetasDept] = useState<DepartamentoDoc | null>(null)
  const [metasOpen, setMetasOpen] = useState(false)

  const puedeEditarMetas = useAuthStore(
    (s) => s.hasPermiso('*') || s.hasPermiso('kpis:editar') || s.hasPermiso('maestros:editar'),
  )

  const maestro = useMaestroList({
    items: list,
    defaultSortKey: 'codigo',
    getActivo: (d) => d.activo,
    searchTexts: (d) => [d.codigo, d.nombre, d.descripcion, empresaLabel(d)],
    compare: compareDepartamentos,
  })
  const { rows, busqueda, setBusqueda, filterActivo, setFilterActivo, sortKey, sortDir, onSort, total } =
    maestro

  const filteredByEmpresa = useMemo(
    () => rows.filter((d) => departamentoMatchesEmpresa(d, filterEmpresa, empresasCatalog)),
    [rows, filterEmpresa, empresasCatalog],
  )

  const pagination = usePagination(filteredByEmpresa.length, {
    resetKey: `${busqueda}|${filterActivo}|${filterEmpresa}|${sortKey}|${sortDir}|${total}`,
  })
  const pageRows = pagination.slice(filteredByEmpresa)

  const visibleIds = useMemo(() => pageRows.map((d) => d._id), [pageRows])

  const maestroNombres = useMemo(
    () => new Set(ejesCatalogo.map((e) => e.nombre)),
    [ejesCatalogo],
  )
  const ejesMaestroSorted = useMemo(
    () =>
      [...ejesCatalogo].sort(
        (a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre),
      ),
    [ejesCatalogo],
  )

  const reload = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const [deps, emps] = await Promise.all([
        fetchDepartamentos(),
        fetchEmpresas({ activo: true }).catch(() => [] as EmpresaDoc[]),
      ])
      setList(deps)
      setEmpresasCatalog(emps)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const {
    selectedIds,
    seleccionCount,
    allSelected,
    someSelected,
    toggle,
    toggleAll,
    bulkDeleting,
    showBar,
    handleEliminarSeleccionados,
  } = useMaestroBulkDelete({
    recurso: 'departamentos',
    visibleIds,
    etiqueta: 'departamento(s)',
    confirmar: (n) =>
      `¿Eliminar ${n} departamento(s)? Los registros vinculados perderán la referencia.`,
    onAfterDelete: reload,
  })

  useEffect(() => {
    void fetchEjesProyecto({ activo: true })
      .then(setEjesCatalogo)
      .catch(() => setEjesCatalogo([]))
  }, [])

  function openNew() { setEditing(null); setForm(emptyForm()); setOpen(true) }
  function openEdit(d: DepartamentoDoc) { setEditing(d); setForm(fromDoc(d)); setOpen(true) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        ejes_proyecto: form.ejes_proyecto.map((e) => e.trim()).filter(Boolean),
      }
      if (editing) await updateDepartamento(editing._id, payload)
      else await createDepartamento(payload)
      setOpen(false)
      await reload()
    } catch (ex) {
      window.alert(ex instanceof Error ? ex.message : 'Error')
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteDepartamento(deleteTarget._id)
      setDeleteTarget(null)
      await reload()
    } catch (ex) {
      window.alert(ex instanceof Error ? ex.message : 'No se pudo eliminar')
    }
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Departamentos / Áreas</h2>
          <p className="text-sm text-muted-foreground">
            Catálogo de departamentos u áreas de la organización. Se usan en colaboradores, perfiles y planes de carrera.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90">
          <Plus className="size-4" /> Nuevo departamento
        </Button>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {!loading && list.length > 0 && (
        <MaestroListToolbar
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          busquedaPlaceholder="Código, nombre, empresa…"
          filterActivo={filterActivo}
          onFilterActivoChange={setFilterActivo}
          count={filteredByEmpresa.length}
          total={total}
          countLabel="departamento(s)"
        >
          {empresasCatalog.length > 0 && (
            <div className="grid gap-1">
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <Factory className="size-3" /> Empresa
              </label>
              <select
                className={selectClass + ' min-w-[200px]'}
                value={filterEmpresa}
                onChange={(e) => setFilterEmpresa(e.target.value)}
              >
                <option value="">Todas</option>
                {empresasCatalog.map((em) => (
                  <option key={em._id} value={em._id}>
                    {em.codigo} — {em.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </MaestroListToolbar>
      )}

      {!loading && showBar && (
        <MaestroBulkDeleteBar
          seleccionCount={seleccionCount}
          bulkDeleting={bulkDeleting}
          onEliminar={() => void handleEliminarSeleccionados()}
          etiqueta="departamentos"
        />
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
          ) : list.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Sin departamentos registrados.</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Ningún departamento coincide con los filtros.</p>
          ) : filteredByEmpresa.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Ningún departamento pertenece a la empresa seleccionada. Prueba con «Todas» u otra empresa.
            </p>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <MaestroSelectAllHeader
                    allSelected={allSelected}
                    someSelected={someSelected}
                    onToggleAll={toggleAll}
                  />
                  <TableHead className="w-8" />
                  <MaestroSortableHead column="codigo" label="Código" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <MaestroSortableHead column="empresa" label="Empresa" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <MaestroSortableHead column="ehr_id" label="Depto #" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <MaestroSortableHead column="nombre" label="Nombre" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <TableHead>Descripción</TableHead>
                  <TableHead>Ejes de proyecto</TableHead>
                  <TableHead>Gastos</TableHead>
                  <MaestroSortableHead column="metas" label="Metas" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((d) => (
                  <TableRow key={d._id}>
                    <MaestroSelectCell
                      id={d._id}
                      label={d.nombre}
                      selected={selectedIds.has(d._id)}
                      onToggle={toggle}
                    />
                    <TableCell>
                      <div
                        className="size-4 rounded-full"
                        style={{ background: d.color ?? '#002060' }}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm font-semibold">{d.codigo}</TableCell>
                    <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                      {typeof d.empresa_id === 'object' && d.empresa_id != null && 'nombre' in d.empresa_id
                        ? d.empresa_id.nombre
                        : d.ehr_empresa_id != null
                          ? `EHR ${d.ehr_empresa_id}`
                          : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {d.ehr_departamento_id ?? '—'}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 text-muted-foreground" />
                        {d.nombre}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {d.descripcion || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-sm flex-wrap gap-1">
                        {(d.ejes_proyecto ?? []).length > 0 ? (
                          (d.ejes_proyecto ?? []).slice(0, 4).map((eje) => (
                            <Badge key={eje} variant="outline" className="py-0 text-[10px]">
                              {eje}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin ejes</span>
                        )}
                        {(d.ejes_proyecto ?? []).length > 4 && (
                          <Badge variant="secondary" className="py-0 text-[10px]">
                            +{(d.ejes_proyecto ?? []).length - 4}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {d.lleva_gastos ? (
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="outline" className="border-[var(--lime)] py-0 text-[10px] text-[var(--lime)]">
                            Sí maneja
                          </Badge>
                          <code className="text-[10px] text-muted-foreground">
                            {(d.archivo_gastos || defaultArchivoGastos(d.codigo))}
                          </code>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {getMetasDepartamento(d).filter((m) => m.activa !== false).length} activas
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={d.activo ? 'bg-[var(--lime-lt)] text-[var(--navy)]' : ''}>
                        {d.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={puedeEditarMetas ? 'Registrar metas anuales' : 'Ver metas anuales'}
                          onClick={() => {
                            setMetasDept(d)
                            setMetasOpen(true)
                          }}
                        >
                          <Target className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                          <Edit2 className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(d)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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

      {/* Create/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar departamento' : 'Nuevo departamento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            <div className="grid gap-2">
              <Label>Código <span className="text-destructive">*</span></Label>
              <Input required value={form.codigo} onChange={(e) => set('codigo', e.target.value)}
                placeholder="IT, RRHH, FIN…" disabled={Boolean(editing)} />
            </div>
            <div className="grid gap-2">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input required value={form.nombre} onChange={(e) => set('nombre', e.target.value)}
                placeholder="Tecnología de la Información" />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Textarea rows={2} value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Ejes de proyecto</Label>
              {ejesMaestroSorted.length > 0 ? (
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                  {ejesMaestroSorted
                    .filter((m) => m.activo !== false)
                    .map((m) => (
                      <label key={m._id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--lime)]"
                          checked={form.ejes_proyecto.includes(m.nombre)}
                          onChange={(ev) => {
                            const checked = ev.target.checked
                            setForm((f) => {
                              const extras = f.ejes_proyecto.filter((x) => !maestroNombres.has(x))
                              const picked = f.ejes_proyecto.filter((x) => maestroNombres.has(x))
                              const nextPicked = checked
                                ? [...new Set([...picked, m.nombre])]
                                : picked.filter((x) => x !== m.nombre)
                              return { ...f, ejes_proyecto: [...nextPicked, ...extras] }
                            })
                          }}
                        />
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: m.color ?? '#1F4E79' }}
                        />
                        <span>{m.nombre}</span>
                      </label>
                    ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No hay ejes activos en catálogo.{' '}
                  <Link to="/maestros/ejes-proyecto" className="text-[var(--navy)] underline">
                    Maestro · Ejes de proyecto
                  </Link>
                </p>
              )}
              <Label className="text-muted-foreground">Otros ejes (opcional, uno por línea)</Label>
              <Textarea
                rows={4}
                value={form.ejes_proyecto.filter((e) => !maestroNombres.has(e)).join('\n')}
                onChange={(e) => {
                  const lines = e.target.value.split('\n').map((v) => v.trim()).filter(Boolean)
                  setForm((f) => {
                    const fromCatalog = f.ejes_proyecto.filter((x) => maestroNombres.has(x))
                    return { ...f, ejes_proyecto: [...new Set([...fromCatalog, ...lines])] }
                  })
                }}
                placeholder="Ejes sólo de este departamento que no estén en el catálogo global"
              />
              <p className="text-xs text-muted-foreground">
                El catálogo global se administra en{' '}
                <Link to="/maestros/ejes-proyecto" className="text-[var(--navy)] underline">
                  Maestro · Ejes de proyecto
                </Link>
                . Aquí eliges cuáles aplican a este departamento y puedes añadir líneas extra.
              </p>
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-3 space-y-3">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="lleva-gastos-check"
                  className="mt-0.5 size-4 accent-[var(--lime)]"
                  checked={form.lleva_gastos}
                  onChange={(e) => set('lleva_gastos', e.target.checked)}
                />
                <div className="flex-1">
                  <Label htmlFor="lleva-gastos-check" className="cursor-pointer">
                    Este departamento maneja presupuesto / gastos
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Al activarlo se habilita el módulo <strong>Gastos</strong> sólo para los usuarios
                    asignados a este departamento.
                  </p>
                </div>
              </div>

              {form.lleva_gastos && (
                <div className="grid gap-2">
                  <Label>Archivo Excel de gastos</Label>
                  <Input
                    value={form.archivo_gastos}
                    onChange={(e) => set('archivo_gastos', e.target.value)}
                    placeholder={defaultArchivoGastos(form.codigo || 'codigo')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ruta relativa al proyecto. Si lo dejas vacío se usa{' '}
                    <code className="rounded bg-muted px-1">
                      {defaultArchivoGastos(form.codigo || 'codigo')}
                    </code>{' '}
                    con fallback a <code className="rounded bg-muted px-1">data/gastos.xlsx</code>.
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Color identificador</Label>
              <div className="flex flex-wrap items-center gap-2">
                {COLORS_PRESET.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set('color', c)}
                    className="size-6 rounded-full ring-2 ring-transparent transition hover:scale-110"
                    style={{
                      background: c,
                      outline: form.color === c ? `2px solid ${c}` : '2px solid transparent',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
                <Input
                  type="color"
                  className="h-7 w-12 cursor-pointer rounded border px-1"
                  value={form.color}
                  onChange={(e) => set('color', e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="activo-check"
                className="size-4 accent-[var(--lime)]"
                checked={form.activo}
                onChange={(e) => set('activo', e.target.checked)}
              />
              <Label htmlFor="activo-check">Activo</Label>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90">
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <MetasDepartamentoDialog
        departamento={metasDept}
        open={metasOpen}
        onOpenChange={(o) => {
          setMetasOpen(o)
          if (!o) setMetasDept(null)
        }}
        readOnly={!puedeEditarMetas}
        onSaved={(updated) => {
          setList((prev) => prev.map((d) => (d._id === updated._id ? updated : d)))
        }}
      />

      {/* Confirm delete */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar departamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar <strong>{deleteTarget?.nombre}</strong>? Los colaboradores, perfiles y plantillas vinculadas perderán la referencia a este departamento.
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
