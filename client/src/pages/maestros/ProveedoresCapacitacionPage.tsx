import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit2, ExternalLink, GraduationCap, Lock, Plus, Trash2 } from 'lucide-react'

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
import { MaestroSelectAllHeader, MaestroSelectCell } from '@/components/maestros/MaestroTableSelection'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { useMaestroBulkDelete } from '@/hooks/useMaestroBulkDelete'
import { usePagination } from '@/hooks/usePagination'
import { useMaestroList } from '@/hooks/useMaestroList'
import { compareStrings, type MaestroSortDir } from '@/lib/maestroList'
import {
  createProveedorCapacitacion, deleteProveedorCapacitacion,
  fetchProveedoresCapacitacion, updateProveedorCapacitacion,
} from '@/lib/api/proveedoresCapacitacion'
import { useAuthStore } from '@/store/authStore'
import type { ProveedorCapacitacionDoc } from '@/types/capacitacion'

type FormState = {
  nombre: string
  descripcion: string
  sitio_web: string
  contacto: string
  activo: boolean
}

function emptyForm(): FormState {
  return { nombre: '', descripcion: '', sitio_web: '', contacto: '', activo: true }
}
function compareProveedores(
  a: ProveedorCapacitacionDoc,
  b: ProveedorCapacitacionDoc,
  sortKey: string,
  dir: MaestroSortDir,
): number {
  switch (sortKey) {
    case 'contacto':
      return compareStrings(a.contacto ?? '', b.contacto ?? '', dir)
    case 'nombre':
    default:
      return compareStrings(a.nombre, b.nombre, dir)
  }
}

function fromDoc(d: ProveedorCapacitacionDoc): FormState {
  return {
    nombre: d.nombre,
    descripcion: d.descripcion ?? '',
    sitio_web: d.sitio_web ?? '',
    contacto: d.contacto ?? '',
    activo: d.activo ?? true,
  }
}

export function ProveedoresCapacitacionPage() {
  const hasPermiso = useAuthStore((s) => s.hasPermiso)
  const puedeEditar = hasPermiso('maestros:editar')

  const [list, setList] = useState<ProveedorCapacitacionDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ProveedorCapacitacionDoc | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProveedorCapacitacionDoc | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setErr(null)
    try { setList(await fetchProveedoresCapacitacion()) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const maestro = useMaestroList({
    items: list,
    defaultSortKey: 'nombre',
    getActivo: (d) => d.activo,
    searchTexts: (d) => [d.nombre, d.descripcion, d.contacto, d.sitio_web],
    compare: compareProveedores,
  })
  const { rows, busqueda, setBusqueda, filterActivo, setFilterActivo, sortKey, sortDir, onSort, count, total } = maestro

  const pagination = usePagination(rows.length, {
    resetKey: `${busqueda}|${filterActivo}|${sortKey}|${sortDir}|${total}`,
  })
  const pageRows = pagination.slice(rows)

  const visibleIds = useMemo(() => pageRows.map((d) => d._id), [pageRows])
  const bulk = useMaestroBulkDelete({
    recurso: 'proveedores-capacitacion',
    visibleIds,
    etiqueta: 'proveedor(es)',
    onAfterDelete: reload,
  })

  function openNew() {
    if (!puedeEditar) return
    setEditing(null); setForm(emptyForm()); setOpen(true)
  }
  function openEdit(d: ProveedorCapacitacionDoc) {
    if (!puedeEditar) return
    setEditing(d); setForm(fromDoc(d)); setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!puedeEditar) return
    setSaving(true)
    try {
      const payload = { ...form }
      if (editing) await updateProveedorCapacitacion(editing._id, payload)
      else await createProveedorCapacitacion(payload)
      setOpen(false)
      await reload()
    } catch (ex) {
      window.alert(ex instanceof Error ? ex.message : 'Error')
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget || !puedeEditar) return
    try {
      await deleteProveedorCapacitacion(deleteTarget._id)
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
          <h2 className="text-base font-semibold">Proveedores de capacitación</h2>
          <p className="text-sm text-muted-foreground">
            Catálogo de proveedores (Udemy, SAP, RRHH, instituciones externas…) disponibles al crear capacitaciones.
          </p>
        </div>
        {puedeEditar ? (
          <Button onClick={openNew} className="gap-2 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90">
            <Plus className="size-4" /> Nuevo proveedor
          </Button>
        ) : (
          <Badge variant="outline" className="gap-1.5 border-amber-300 bg-amber-50 text-amber-900">
            <Lock className="size-3" /> Solo lectura
          </Badge>
        )}
      </div>

      {!puedeEditar && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Tu rol no tiene el permiso <code className="rounded bg-amber-100 px-1">maestros:editar</code>.
          Puedes consultar el catálogo pero no agregar, modificar ni eliminar proveedores.
        </div>
      )}

      {err && <p className="text-sm text-destructive">{err}</p>}

      {!loading && list.length > 0 && (
        <MaestroListToolbar
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          busquedaPlaceholder="Nombre, contacto, sitio…"
          filterActivo={filterActivo}
          onFilterActivoChange={setFilterActivo}
          count={count}
          total={total}
          countLabel="proveedor(es)"
        />
      )}

      {puedeEditar && !loading && bulk.showBar && (
        <MaestroBulkDeleteBar
          seleccionCount={bulk.seleccionCount}
          bulkDeleting={bulk.bulkDeleting}
          onEliminar={() => void bulk.handleEliminarSeleccionados()}
          etiqueta="proveedores"
        />
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
          ) : list.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <GraduationCap className="mx-auto mb-2 size-8 text-muted-foreground/50" />
              Aún no hay proveedores registrados.
              {puedeEditar && (
                <p className="mt-2 text-xs">
                  Crea el primero con <strong>«Nuevo proveedor»</strong>.
                </p>
              )}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Ningún proveedor coincide con los filtros.</p>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  {puedeEditar && (
                    <MaestroSelectAllHeader
                      allSelected={bulk.allSelected}
                      someSelected={bulk.someSelected}
                      onToggleAll={bulk.toggleAll}
                    />
                  )}
                  <MaestroSortableHead column="nombre" label="Proveedor" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <TableHead>Descripción</TableHead>
                  <TableHead>Sitio web</TableHead>
                  <MaestroSortableHead column="contacto" label="Contacto" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((d) => (
                  <TableRow key={d._id}>
                    {puedeEditar && (
                      <MaestroSelectCell
                        id={d._id}
                        label={d.nombre}
                        selected={bulk.selectedIds.has(d._id)}
                        onToggle={bulk.toggle}
                      />
                    )}
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="size-4 text-muted-foreground" />
                        {d.nombre}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {d.descripcion || '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.sitio_web ? (
                        <a
                          href={d.sitio_web}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--navy)] hover:underline"
                        >
                          <ExternalLink className="size-3" />
                          {d.sitio_web.replace(/^https?:\/\//, '').slice(0, 30)}
                        </a>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.contacto || '—'}
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
                          disabled={!puedeEditar}
                          onClick={() => openEdit(d)}
                          title={puedeEditar ? 'Editar' : 'Requiere permiso maestros:editar'}
                        >
                          <Edit2 className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={!puedeEditar}
                          className="text-destructive hover:text-destructive disabled:opacity-50"
                          onClick={() => setDeleteTarget(d)}
                          title={puedeEditar ? 'Eliminar' : 'Requiere permiso maestros:editar'}
                        >
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar proveedor' : 'Nuevo proveedor de capacitación'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            <div className="grid gap-2">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input
                required
                value={form.nombre}
                onChange={(e) => set('nombre', e.target.value)}
                placeholder="Udemy, Coursera, SAP, ICAP, RRHH interno…"
              />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Textarea
                rows={2}
                value={form.descripcion}
                onChange={(e) => set('descripcion', e.target.value)}
                placeholder="Tipo de cursos que ofrece, áreas, etc."
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Sitio web</Label>
                <Input
                  type="url"
                  value={form.sitio_web}
                  onChange={(e) => set('sitio_web', e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="grid gap-2">
                <Label>Contacto</Label>
                <Input
                  value={form.contacto}
                  onChange={(e) => set('contacto', e.target.value)}
                  placeholder="Nombre / correo / teléfono"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="prov-activo"
                className="size-4 accent-[var(--lime)]"
                checked={form.activo}
                onChange={(e) => set('activo', e.target.checked)}
              />
              <Label htmlFor="prov-activo">Activo (visible al crear capacitaciones)</Label>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar proveedor</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar <strong>{deleteTarget?.nombre}</strong>? No se podrá eliminar si existen
            capacitaciones vinculadas a este proveedor.
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
