import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, RefreshCw, Tags, Trash2 } from 'lucide-react'

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
import { compareNumbers, compareStrings, type MaestroSortDir } from '@/lib/maestroList'
import {
  createEjeProyecto, deleteEjeProyecto, fetchEjesProyecto, updateEjeProyecto,
} from '@/lib/api/ejesProyecto'
import type { EjeProyectoDoc } from '@/types/ejeProyecto'

const COLORS = [
  '#1F4E79', '#C00000', '#375623', '#7F6000', '#4527A0', '#0F6E56',
  '#002060', '#70AD47', '#6B7280',
]

type FormState = {
  codigo: string
  nombre: string
  descripcion: string
  color: string
  orden: number
  activo: boolean
}

function emptyForm(): FormState {
  return { codigo: '', nombre: '', descripcion: '', color: '#1F4E79', orden: 0, activo: true }
}

function compareEjes(
  a: EjeProyectoDoc,
  b: EjeProyectoDoc,
  sortKey: string,
  dir: MaestroSortDir,
): number {
  switch (sortKey) {
    case 'nombre':
      return compareStrings(a.nombre, b.nombre, dir)
    case 'orden':
      return compareNumbers(a.orden ?? 0, b.orden ?? 0, dir)
    case 'codigo':
    default:
      return compareStrings(a.codigo, b.codigo, dir)
  }
}

function fromDoc(e: EjeProyectoDoc): FormState {
  return {
    codigo: e.codigo,
    nombre: e.nombre,
    descripcion: e.descripcion ?? '',
    color: e.color ?? '#1F4E79',
    orden: typeof e.orden === 'number' ? e.orden : 0,
    activo: e.activo !== false,
  }
}

export function EjesProyectoPage() {
  const [rows, setRows] = useState<EjeProyectoDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<EjeProyectoDoc | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<EjeProyectoDoc | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      setRows(await fetchEjesProyecto())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  function openNew() {
    setEditing(null)
    setForm(emptyForm())
    setOpen(true)
  }

  function openEdit(e: EjeProyectoDoc) {
    setEditing(e)
    setForm(fromDoc(e))
    setOpen(true)
  }

  async function handleSave() {
    if (!form.codigo.trim() || !form.nombre.trim()) return
    setSaving(true)
    try {
      const body = {
        codigo: form.codigo.trim().toUpperCase(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        color: form.color.trim() || '#1F4E79',
        orden: Number.isFinite(form.orden) ? form.orden : 0,
        activo: form.activo,
      }
      if (editing) await updateEjeProyecto(editing._id, body)
      else await createEjeProyecto(body)
      setOpen(false)
      await reload()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteEjeProyecto(deleteTarget._id)
      setDeleteTarget(null)
      await reload()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  const maestro = useMaestroList({
    items: rows,
    defaultSortKey: 'orden',
    getActivo: (e) => e.activo !== false,
    searchTexts: (e) => [e.codigo, e.nombre, e.descripcion],
    compare: compareEjes,
  })
  const { rows: filtered, busqueda, setBusqueda, filterActivo, setFilterActivo, sortKey, sortDir, onSort, count, total } =
    maestro

  const pagination = usePagination(filtered.length, {
    resetKey: `${busqueda}|${filterActivo}|${sortKey}|${sortDir}|${total}`,
  })
  const pageRows = pagination.slice(filtered)

  const visibleIds = useMemo(() => pageRows.map((e) => e._id), [pageRows])
  const bulk = useMaestroBulkDelete({
    recurso: 'ejes-proyecto',
    visibleIds,
    etiqueta: 'eje(s)',
    onAfterDelete: reload,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Ejes de proyecto</h2>
          <p className="text-sm text-muted-foreground">
            Catálogo global de categorías (mismo criterio que las fases 1–3: valores fijos para clasificar proyectos).
            El nombre es el que se guarda en proyecto y en departamento.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void reload()}>
            <RefreshCw className="size-3.5" /> Actualizar
          </Button>
          <Button
            type="button"
            onClick={openNew}
            className="gap-2 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
          >
            <Plus className="size-4" /> Nuevo eje
          </Button>
        </div>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {!loading && bulk.showBar && (
        <MaestroBulkDeleteBar
          seleccionCount={bulk.seleccionCount}
          bulkDeleting={bulk.bulkDeleting}
          onEliminar={() => void bulk.handleEliminarSeleccionados()}
          etiqueta="ejes"
        />
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Sin ejes en catálogo.</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Ningún eje coincide con los filtros.</p>
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
                  <TableHead className="w-8" />
                  <MaestroSortableHead column="codigo" label="Código" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <MaestroSortableHead column="nombre" label="Nombre" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <MaestroSortableHead column="orden" label="Orden" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((e) => (
                  <TableRow key={e._id}>
                    <MaestroSelectCell
                      id={e._id}
                      label={e.nombre}
                      selected={bulk.selectedIds.has(e._id)}
                      onToggle={bulk.toggle}
                    />
                    <TableCell>
                      <div className="size-4 rounded-full" style={{ background: e.color ?? '#1F4E79' }} />
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold">{e.codigo}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        <Tags className="size-4 text-muted-foreground" />
                        {e.nombre}
                      </div>
                      {e.descripcion ? (
                        <p className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">{e.descripcion}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{e.orden ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={e.activo !== false ? 'bg-[var(--lime-lt)] text-[var(--navy)]' : ''}>
                        {e.activo !== false ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(e)}
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
            <DialogTitle>{editing ? 'Editar eje' : 'Nuevo eje'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Código <span className="text-destructive">*</span></Label>
              <Input
                value={form.codigo}
                onChange={(ev) => setForm((s) => ({ ...s, codigo: ev.target.value.toUpperCase() }))}
                placeholder="INFRA"
                disabled={Boolean(editing)}
                className="font-mono uppercase"
              />
            </div>
            <div className="grid gap-2">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input
                value={form.nombre}
                onChange={(ev) => setForm((s) => ({ ...s, nombre: ev.target.value }))}
                placeholder="Infraestructura"
              />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Textarea rows={2} value={form.descripcion} onChange={(ev) => setForm((s) => ({ ...s, descripcion: ev.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Orden</Label>
              <Input
                type="number"
                value={form.orden}
                onChange={(ev) => setForm((s) => ({ ...s, orden: Number(ev.target.value) || 0 }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex flex-wrap items-center gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((s) => ({ ...s, color: c }))}
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
                  onChange={(ev) => setForm((s) => ({ ...s, color: ev.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="eje-activo"
                className="size-4 accent-[var(--lime)]"
                checked={form.activo}
                onChange={(ev) => setForm((s) => ({ ...s, activo: ev.target.checked }))}
              />
              <Label htmlFor="eje-activo">Activo</Label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar eje</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar <strong>{deleteTarget?.nombre}</strong>? Los proyectos que ya usen este nombre conservan el texto; sólo deja de aparecer en listas nuevas si estaba sólo en el catálogo.
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
