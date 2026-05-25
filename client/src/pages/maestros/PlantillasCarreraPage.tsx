import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Edit2, Plus, Trash2, Save, X, PlusCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { PaginationBar } from '@/components/ui/PaginationBar'
import { useMaestroBulkDelete } from '@/hooks/useMaestroBulkDelete'
import { usePagination } from '@/hooks/usePagination'
import { useMaestroList } from '@/hooks/useMaestroList'
import { compareStrings, type MaestroSortDir } from '@/lib/maestroList'
import {
  createPlantillaCarrera, deletePlantillaCarrera, fetchPlantillaCarrera,
  fetchPlantillasCarrera, updateItemsPlantilla, updatePlantillaCarrera,
} from '@/lib/api/plantillasCarrera'
import { fetchDepartamentos } from '@/lib/api/departamentos'
import type { DepartamentoDoc } from '@/types/departamento'
import type { PlantillaCarreraDoc, PlantillaItem } from '@/types/plantillaCarrera'
import { deptFromPlantilla } from '@/types/plantillaCarrera'
import { cn } from '@/lib/utils'

import { MAESTRO_SELECT_CLASS } from '@/lib/maestroList'

const selectClass = MAESTRO_SELECT_CLASS

function comparePlantillas(
  a: PlantillaCarreraDoc,
  b: PlantillaCarreraDoc,
  sortKey: string,
  dir: MaestroSortDir,
): number {
  const deptA = deptFromPlantilla(a)?.nombre ?? ''
  const deptB = deptFromPlantilla(b)?.nombre ?? ''
  switch (sortKey) {
    case 'departamento':
      return compareStrings(deptA, deptB, dir)
    case 'items':
      return compareStrings(String(a.items.length), String(b.items.length), dir)
    case 'nombre':
    default:
      return compareStrings(a.nombre, b.nombre, dir)
  }
}

const SECCIONES_SUGERIDAS = [
  'A. Formación académica y técnica',
  'B. Conocimiento del negocio',
  'C. Liderazgo y gestión de equipos',
  'D. Infraestructura y operaciones',
  'E. Seguridad y cumplimiento',
  'F. Comunicación con stakeholders',
]

type FormState = {
  nombre: string
  descripcion: string
  departamento_id: string
  tipo_ruta: string
  activo: boolean
}

function emptyForm(): FormState {
  return { nombre: '', descripcion: '', departamento_id: '', tipo_ruta: '', activo: true }
}
function fromDoc(d: PlantillaCarreraDoc): FormState {
  const dept = deptFromPlantilla(d)
  return {
    nombre: d.nombre,
    descripcion: d.descripcion ?? '',
    departamento_id: dept?._id ?? '',
    tipo_ruta: d.tipo_ruta,
    activo: d.activo ?? true,
  }
}

// ─── Items editor ─────────────────────────────────────────────────────────────
function ItemsEditor({
  plantilla,
  onUpdated,
  onClose,
}: {
  plantilla: PlantillaCarreraDoc
  onUpdated: (p: PlantillaCarreraDoc) => void
  onClose: () => void
}) {
  const [items, setItems] = useState<PlantillaItem[]>(plantilla.items.map((it) => ({ ...it })))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const grouped = (() => {
    const map = new Map<string, number[]>()
    items.forEach((it, i) => {
      const k = it.seccion ?? 'Sin sección'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(i)
    })
    return [...map.entries()]
  })()

  function setItem(i: number, patch: Partial<PlantillaItem>) {
    setItems((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }
  function addItem(seccion?: string) {
    setItems((prev) => [...prev, { codigo: '', seccion: seccion ?? '', requisito: '', tipo_requisito: 'Indispensable', plazo_estimado: '', recurso: '' }])
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, j) => j !== i))
  }

  async function handleSave() {
    const valid = items.filter((it) => it.requisito.trim())
    if (valid.length === 0) { setErr('Agrega al menos un ítem'); return }
    setSaving(true); setErr(null)
    try {
      const updated = await updateItemsPlantilla(plantilla._id, valid)
      onUpdated(updated)
      onClose()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Error')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{plantilla.nombre}</h3>
          <p className="text-sm text-muted-foreground">{items.length} ítems · Edita el contenido de la plantilla</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}><X className="mr-1 size-4" />Cancelar</Button>
          <Button type="button" size="sm" disabled={saving} onClick={() => void handleSave()}
            className="gap-2 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90">
            <Save className="size-4" />{saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      {err && <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

      <div className="space-y-6">
        {grouped.map(([seccion, indices]) => (
          <Card key={seccion} className="overflow-hidden">
            <CardHeader className="border-b bg-[var(--blue-lt)]/40 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[var(--navy)]">{seccion}</span>
                <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                  onClick={() => addItem(seccion)}>
                  <PlusCircle className="size-3.5" /> Agregar ítem
                </Button>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20 hover:bg-muted/20 text-xs">
                    <TableHead className="w-14 px-3">Código</TableHead>
                    <TableHead className="min-w-[250px] px-3">Requisito</TableHead>
                    <TableHead className="w-32 px-3">Tipo</TableHead>
                    <TableHead className="w-28 px-3">Plazo</TableHead>
                    <TableHead className="w-36 px-3">Recurso</TableHead>
                    <TableHead className="w-10 px-3" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indices.map((i) => {
                    const item = items[i]
                    return (
                      <TableRow key={i} className="align-top">
                        <TableCell className="px-3 pt-2">
                          <Input className="h-7 text-xs font-mono" value={item.codigo ?? ''} onChange={(e) => setItem(i, { codigo: e.target.value })} placeholder="A1" />
                        </TableCell>
                        <TableCell className="px-3 pt-2">
                          <Textarea rows={2} className="text-sm" value={item.requisito} onChange={(e) => setItem(i, { requisito: e.target.value })} placeholder="Descripción del requisito…" />
                        </TableCell>
                        <TableCell className="px-3 pt-2">
                          <select className={cn(selectClass, 'h-7 text-xs')} value={item.tipo_requisito ?? 'Indispensable'} onChange={(e) => setItem(i, { tipo_requisito: e.target.value as 'Indispensable' | 'Recomendado' })}>
                            <option value="Indispensable">Indispensable</option>
                            <option value="Recomendado">Recomendado</option>
                          </select>
                        </TableCell>
                        <TableCell className="px-3 pt-2">
                          <Input className="h-7 text-xs" value={item.plazo_estimado ?? ''} onChange={(e) => setItem(i, { plazo_estimado: e.target.value })} placeholder="6–12 meses" />
                        </TableCell>
                        <TableCell className="px-3 pt-2">
                          <Input className="h-7 text-xs" value={item.recurso ?? ''} onChange={(e) => setItem(i, { recurso: e.target.value })} placeholder="Jefe IT / Udemy…" />
                        </TableCell>
                        <TableCell className="px-3 pt-2">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeItem(i)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        ))}
      </div>

      {/* Add new section */}
      <Card className="border-dashed">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center">Agregar sección:</span>
            {SECCIONES_SUGERIDAS.map((s) => {
              const exists = grouped.some(([k]) => k === s)
              return (
                <button key={s} type="button" disabled={exists}
                  onClick={() => addItem(s)}
                  className="rounded border border-dashed px-2 py-0.5 text-xs disabled:opacity-40 enabled:hover:border-[var(--lime)] enabled:hover:text-[var(--navy)]">
                  {s}
                </button>
              )
            })}
            <button type="button" onClick={() => addItem('Nueva sección')}
              className="rounded border border-dashed px-2 py-0.5 text-xs hover:border-[var(--lime)] hover:text-[var(--navy)]">
              + Sección libre
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function PlantillasCarreraPage() {
  const [list, setList] = useState<PlantillaCarreraDoc[]>([])
  const [depts, setDepts] = useState<DepartamentoDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [selected, setSelected] = useState<PlantillaCarreraDoc | null>(null)
  const [editingItems, setEditingItems] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<PlantillaCarreraDoc | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PlantillaCarreraDoc | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const [pl, dp] = await Promise.all([fetchPlantillasCarrera(), fetchDepartamentos()])
      setList(pl); setDepts(dp)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const maestro = useMaestroList({
    items: list,
    defaultSortKey: 'nombre',
    getActivo: (p) => p.activo,
    searchTexts: (p) => {
      const d = deptFromPlantilla(p)
      return [p.nombre, p.descripcion, p.tipo_ruta, d?.nombre, d?.codigo]
    },
    compare: comparePlantillas,
  })
  const { rows, busqueda, setBusqueda, filterActivo, setFilterActivo, sortKey, sortDir, count, total } = maestro

  const pagination = usePagination(rows.length, {
    resetKey: `${busqueda}|${filterActivo}|${sortKey}|${sortDir}|${total}`,
  })
  const pageRows = pagination.slice(rows)

  const visibleIds = useMemo(() => pageRows.map((pl) => pl._id), [pageRows])
  const bulk = useMaestroBulkDelete({
    recurso: 'plantillas-carrera',
    visibleIds,
    etiqueta: 'plantilla(s)',
    confirmar: (n) =>
      `¿Eliminar ${n} plantilla(s)? Los planes de carrera ya asignados no se verán afectados.`,
    onAfterDelete: async () => {
      setSelected(null)
      await reload()
    },
  })

  async function openDetail(pl: PlantillaCarreraDoc) {
    try {
      const full = await fetchPlantillaCarrera(pl._id)
      setSelected(full)
      setEditingItems(false)
    } catch { setSelected(pl) }
  }

  function openNew() { setEditingDoc(null); setForm(emptyForm()); setFormOpen(true) }
  function openEditForm(p: PlantillaCarreraDoc) { setEditingDoc(p); setForm(fromDoc(p)); setFormOpen(true) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const payload = { ...form, departamento_id: form.departamento_id || undefined }
      if (editingDoc) await updatePlantillaCarrera(editingDoc._id, payload)
      else await createPlantillaCarrera(payload)
      setFormOpen(false)
      await reload()
    } catch (ex) { window.alert(ex instanceof Error ? ex.message : 'Error') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deletePlantillaCarrera(deleteTarget._id)
      setDeleteTarget(null)
      if (selected?._id === deleteTarget._id) setSelected(null)
      await reload()
    } catch (ex) { window.alert(ex instanceof Error ? ex.message : 'No se pudo eliminar') }
  }

  function setF<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  return (
    <div className="space-y-6">
      {!editingItems && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Plantillas de Planes de Carrera</h2>
              <p className="text-sm text-muted-foreground">
                Define las rutas de desarrollo para cualquier departamento. Desde aquí asignas planes a colaboradores.
              </p>
            </div>
            <Button onClick={openNew} className="gap-2 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90">
              <Plus className="size-4" /> Nueva plantilla
            </Button>
          </div>

          {err && <p className="text-sm text-destructive">{err}</p>}

          {!loading && list.length > 0 && (
            <MaestroListToolbar
              busqueda={busqueda}
              onBusquedaChange={setBusqueda}
              busquedaPlaceholder="Nombre, ruta, departamento…"
              filterActivo={filterActivo}
              onFilterActivoChange={setFilterActivo}
              count={count}
              total={total}
              countLabel="plantilla(s)"
            />
          )}

          {!loading && bulk.showBar && (
            <MaestroBulkDeleteBar
              seleccionCount={bulk.seleccionCount}
              bulkDeleting={bulk.bulkDeleting}
              onEliminar={() => void bulk.handleEliminarSeleccionados()}
              etiqueta="plantillas"
            />
          )}

          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            {/* List */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm">Plantillas ({rows.length})</CardTitle>
                {list.length > 0 && (
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="size-3.5 accent-[var(--lime)]"
                      checked={bulk.allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !bulk.allSelected && bulk.someSelected
                      }}
                      onChange={bulk.toggleAll}
                    />
                    Todas
                  </label>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <p className="p-3 text-sm text-muted-foreground">Cargando…</p>
                ) : list.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Sin plantillas. Crea la primera.</p>
                ) : rows.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Ninguna plantilla coincide con los filtros.</p>
                ) : (
                  <>
                  <ul className="divide-y divide-border">
                    {pageRows.map((pl) => {
                      const dept = deptFromPlantilla(pl)
                      const isActive = selected?._id === pl._id
                      return (
                        <li key={pl._id} className="flex items-stretch">
                          <div
                            className="flex items-center px-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className="size-3.5 accent-[var(--lime)]"
                              checked={bulk.selectedIds.has(pl._id)}
                              onChange={() => bulk.toggle(pl._id)}
                              aria-label={`Seleccionar ${pl.nombre}`}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => void openDetail(pl)}
                            className={cn(
                              'flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40',
                              isActive && 'bg-[var(--blue-lt)] font-medium',
                            )}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm">{pl.nombre}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {dept && (
                                  <span
                                    className="inline-block h-2 w-2 rounded-full"
                                    style={{ background: dept.color ?? '#002060' }}
                                  />
                                )}
                                <span className="text-xs text-muted-foreground">{dept?.nombre ?? 'Sin dpto'} · {pl.items.length} ítems</span>
                              </div>
                            </div>
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
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

            {/* Detail */}
            {selected ? (
              <Card>
                <CardHeader className="border-b pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{selected.nombre}</CardTitle>
                      <p className="mt-0.5 text-sm text-muted-foreground">{selected.descripcion}</p>
                      <div className="mt-1 flex gap-2">
                        <Badge variant="outline" className="text-xs">{selected.tipo_ruta}</Badge>
                        <Badge variant="secondary" className={selected.activo ? 'bg-[var(--lime-lt)] text-[var(--navy)]' : ''}>
                          {selected.activo ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEditForm(selected)}>
                        <Edit2 className="size-3.5" /> Editar info
                      </Button>
                      <Button size="sm" className="gap-1.5 bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90"
                        onClick={() => setEditingItems(true)}>
                        <Edit2 className="size-3.5" /> Editar checklist
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(selected)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {selected.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin ítems. Haz clic en "Editar checklist" para agregarlos.</p>
                  ) : (
                    <div className="space-y-4">
                      {(() => {
                        const map = new Map<string, PlantillaItem[]>()
                        for (const it of selected.items) {
                          const k = it.seccion ?? 'Sin sección'
                          if (!map.has(k)) map.set(k, [])
                          map.get(k)!.push(it)
                        }
                        return [...map.entries()].map(([sec, its]) => (
                          <div key={sec}>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--navy)]">{sec}</p>
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/20 hover:bg-muted/20">
                                  <TableHead className="w-12 text-xs">Cód.</TableHead>
                                  <TableHead className="text-xs">Requisito</TableHead>
                                  <TableHead className="w-28 text-xs">Tipo</TableHead>
                                  <TableHead className="w-24 text-xs">Plazo</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {its.map((it, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="font-mono text-xs text-muted-foreground">{it.codigo}</TableCell>
                                    <TableCell className="text-sm">{it.requisito}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className={cn('text-xs',
                                        it.tipo_requisito === 'Indispensable'
                                          ? 'border-red-300 bg-red-50 text-red-800'
                                          : 'border-blue-300 bg-blue-50 text-blue-800')}>
                                        {it.tipo_requisito}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{it.plazo_estimado}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ))
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-muted-foreground">
                Selecciona una plantilla para ver su detalle
              </div>
            )}
          </div>
        </>
      )}

      {editingItems && selected && (
        <ItemsEditor
          plantilla={selected}
          onUpdated={(updated) => { setSelected(updated); setList((l) => l.map((p) => p._id === updated._id ? updated : p)) }}
          onClose={() => setEditingItems(false)}
        />
      )}

      {/* Create/Edit form dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingDoc ? 'Editar plantilla' : 'Nueva plantilla'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            <div className="grid gap-2">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input required value={form.nombre} onChange={(e) => setF('nombre', e.target.value)} placeholder="Ej. N2 → Coordinador de Infraestructura" />
            </div>
            <div className="grid gap-2">
              <Label>Descripción / Duración estimada</Label>
              <Textarea rows={2} value={form.descripcion} onChange={(e) => setF('descripcion', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Tipo de ruta <span className="text-destructive">*</span></Label>
              <Input required value={form.tipo_ruta} onChange={(e) => setF('tipo_ruta', e.target.value)} placeholder="N2_a_Coord, Jr_a_Mid, Custom_Finance…" />
            </div>
            <div className="grid gap-2">
              <Label>Departamento</Label>
              <select className={selectClass} value={form.departamento_id} onChange={(e) => setF('departamento_id', e.target.value)}>
                <option value="">— Sin departamento —</option>
                {depts.map((d) => <option key={d._id} value={d._id}>{d.nombre} ({d.codigo})</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="pl-activo" className="size-4 accent-[var(--lime)]" checked={form.activo} onChange={(e) => setF('activo', e.target.checked)} />
              <Label htmlFor="pl-activo">Activa</Label>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90">
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar plantilla</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">¿Eliminar <strong>{deleteTarget?.nombre}</strong>? Los planes de carrera ya asignados desde esta plantilla no se verán afectados.</p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
