import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, RefreshCw, Target, Trash2 } from 'lucide-react'

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
import { MaestroListToolbar } from '@/components/maestros/MaestroListToolbar'
import { MaestroSortableHead } from '@/components/maestros/MaestroSortableHead'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { usePagination } from '@/hooks/usePagination'
import { fetchDepartamentos } from '@/lib/api/departamentos'
import {
  createMeta,
  deleteMeta,
  deleteMetasLote,
  fetchMetas,
  metaRowKey,
  updateMeta,
} from '@/lib/api/metas'
import {
  META_TIPO_CALCULO_LABELS,
  META_TIPOS_CALCULO,
  type MetaTipoCalculo,
} from '@/lib/kpiCalculoTipos'
import { useAuthStore } from '@/store/authStore'
import type { DepartamentoDoc } from '@/types/departamento'
import type { MetaDoc } from '@/types/meta'
import {
  MAESTRO_SELECT_CLASS,
  compareNumbers,
  compareStrings,
  matchMaestroSearch,
  type MaestroSortDir,
} from '@/lib/maestroList'

const selectClass = MAESTRO_SELECT_CLASS

type FormState = {
  departamento_id: string
  id: string
  titulo: string
  objetivo: string
  valor_objetivo: string
  tipo_calculo: MetaTipoCalculo
  activa: boolean
}

function emptyForm(deptId = ''): FormState {
  return {
    departamento_id: deptId,
    id: '',
    titulo: '',
    objetivo: '',
    valor_objetivo: '',
    tipo_calculo: 'promedio_kpis',
    activa: true,
  }
}

function fromDoc(m: MetaDoc): FormState {
  return {
    departamento_id: m.departamento_id,
    id: m.id,
    titulo: m.titulo,
    objetivo: m.objetivo ?? '',
    valor_objetivo: m.valor_objetivo ?? '',
    tipo_calculo: (m.tipo_calculo as MetaTipoCalculo) ?? 'promedio_kpis',
    activa: m.activa !== false,
  }
}

export function MetasPage() {
  const puedeEditar = useAuthStore(
    (s) => s.hasPermiso('*') || s.hasPermiso('kpis:editar') || s.hasPermiso('maestros:editar'),
  )

  const [depts, setDepts] = useState<DepartamentoDoc[]>([])
  const [rows, setRows] = useState<MetaDoc[]>([])
  const [filterDept, setFilterDept] = useState('')
  const [filterActiva, setFilterActiva] = useState<'all' | 'true' | 'false'>('all')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MetaDoc | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MetaDoc | null>(null)

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [sortKey, setSortKey] = useState('titulo')
  const [sortDir, setSortDir] = useState<MaestroSortDir>('asc')

  const onSort = useCallback((key: string, dir: MaestroSortDir) => {
    setSortKey(key)
    setSortDir(dir)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const [d, m] = await Promise.all([
        fetchDepartamentos(),
        fetchMetas({
          departamento_id: filterDept || undefined,
          activa: filterActiva === 'all' ? undefined : filterActiva,
        }),
      ])
      setDepts(d)
      setRows(m)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [filterDept, filterActiva])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    setSelectedKeys(new Set())
  }, [filterDept, filterActiva, busqueda, sortKey, sortDir])

  const displayed = useMemo(() => {
    let out = rows
    if (busqueda.trim()) {
      out = out.filter((m) =>
        matchMaestroSearch(busqueda, [
          m.titulo,
          m.id,
          m.departamento_nombre,
          m.departamento_codigo,
          m.objetivo,
          m.valor_objetivo,
        ]),
      )
    }
    return [...out].sort((a, b) => {
      switch (sortKey) {
        case 'departamento':
          return compareStrings(a.departamento_nombre, b.departamento_nombre, sortDir)
        case 'kpi_count':
          return compareNumbers(a.kpi_count, b.kpi_count, sortDir)
        case 'id':
          return compareStrings(a.id, b.id, sortDir)
        case 'titulo':
        default:
          return compareStrings(a.titulo, b.titulo, sortDir)
      }
    })
  }, [rows, busqueda, sortKey, sortDir])

  const pagination = usePagination(displayed.length, {
    resetKey: `${filterDept}|${filterActiva}|${busqueda}|${sortKey}|${sortDir}|${rows.length}`,
  })
  const pageRows = pagination.slice(displayed)

  const visibleKeys = useMemo(() => pageRows.map(metaRowKey), [pageRows])
  const allSelected = visibleKeys.length > 0 && visibleKeys.every((k) => selectedKeys.has(k))
  const someSelected = visibleKeys.some((k) => selectedKeys.has(k))

  function toggleRow(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAll() {
    setSelectedKeys((prev) => {
      if (visibleKeys.length > 0 && visibleKeys.every((k) => prev.has(k))) return new Set()
      return new Set(visibleKeys)
    })
  }

  function openNew() {
    setEditing(null)
    setForm(emptyForm(filterDept))
    setOpen(true)
  }

  function openEdit(m: MetaDoc) {
    setEditing(m)
    setForm(fromDoc(m))
    setOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.departamento_id || !form.titulo.trim()) {
      window.alert('Departamento y título son obligatorios.')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateMeta(editing.departamento_id, editing.id, {
          titulo: form.titulo.trim(),
          objetivo: form.objetivo.trim(),
          valor_objetivo: form.valor_objetivo.trim(),
          tipo_calculo: form.tipo_calculo,
          activa: form.activa,
        })
      } else {
        await createMeta({
          departamento_id: form.departamento_id,
          id: form.id.trim() || undefined,
          titulo: form.titulo.trim(),
          objetivo: form.objetivo.trim(),
          valor_objetivo: form.valor_objetivo.trim(),
          tipo_calculo: form.tipo_calculo,
          activa: form.activa,
        })
      }
      setOpen(false)
      await reload()
    } catch (ex) {
      window.alert(ex instanceof Error ? ex.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteMeta(deleteTarget.departamento_id, deleteTarget.id)
      setDeleteTarget(null)
      await reload()
    } catch (ex) {
      window.alert(ex instanceof Error ? ex.message : 'No se pudo eliminar')
    }
  }

  async function handleBulkDelete() {
    const items = rows
      .filter((m) => selectedKeys.has(metaRowKey(m)))
      .map((m) => ({ departamento_id: m.departamento_id, meta_id: m.id }))
    if (items.length === 0) return
    if (
      !window.confirm(
        `¿Eliminar ${items.length} meta(s)? Solo se borran las que no tengan KPIs vinculados.`,
      )
    ) {
      return
    }
    setBulkDeleting(true)
    try {
      const r = await deleteMetasLote(items)
      let msg = `Eliminadas: ${r.eliminados}.`
      if (r.errores.length > 0) {
        msg += `\n\nNo eliminadas:\n${r.errores.map((e) => `${e.key}: ${e.error}`).join('\n')}`
      }
      window.alert(msg)
      setSelectedKeys(new Set())
      await reload()
    } catch (ex) {
      window.alert(ex instanceof Error ? ex.message : 'Error')
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--navy)]">Metas estratégicas</h2>
          <p className="text-sm text-muted-foreground">
            CRUD de metas anuales por departamento. Los KPIs se vinculan a una meta del mismo
            departamento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void reload()}>
            <RefreshCw className="size-3.5" /> Actualizar
          </Button>
          {puedeEditar && (
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
              onClick={openNew}
            >
              <Plus className="size-4" /> Nueva meta
            </Button>
          )}
        </div>
      </div>

      {!loading && (
        <MaestroListToolbar
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          busquedaPlaceholder="Título, ID, departamento…"
          showActivoFilter={false}
          count={displayed.length}
          total={rows.length}
          countLabel="meta(s)"
        >
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Departamento</label>
            <select
              className={selectClass + ' max-w-xs'}
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
            >
              <option value="">Todos</option>
              {depts.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.codigo} — {d.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Estado</label>
            <select
              className={selectClass + ' max-w-[140px]'}
              value={filterActiva}
              onChange={(e) => setFilterActiva(e.target.value as typeof filterActiva)}
            >
              <option value="all">Todas</option>
              <option value="true">Activas</option>
              <option value="false">Inactivas</option>
            </select>
          </div>
        </MaestroListToolbar>
      )}

      {err && <p className="text-sm text-destructive">{err}</p>}

      {puedeEditar && selectedKeys.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          <span>{selectedKeys.size} seleccionada(s)</span>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={bulkDeleting}
            onClick={() => void handleBulkDelete()}
          >
            <Trash2 className="size-3.5" /> {bulkDeleting ? 'Eliminando…' : 'Eliminar seleccionadas'}
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  {puedeEditar && (
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--lime)]"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = !allSelected && someSelected
                        }}
                        onChange={toggleAll}
                      />
                    </TableHead>
                  )}
                  <MaestroSortableHead column="departamento" label="Depto" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <MaestroSortableHead column="id" label="ID" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <MaestroSortableHead column="titulo" label="Título" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <TableHead>Valor objetivo</TableHead>
                  <TableHead>Cálculo</TableHead>
                  <MaestroSortableHead column="kpi_count" label="KPIs" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <TableHead>Estado</TableHead>
                  {puedeEditar && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={puedeEditar ? 9 : 7}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No hay metas. Crea la primera o inicializa desde KPIs → Registrar metas.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((m) => {
                    const key = metaRowKey(m)
                    return (
                      <TableRow key={key}>
                        {puedeEditar && (
                          <TableCell>
                            <input
                              type="checkbox"
                              className="size-3.5 accent-[var(--lime)]"
                              checked={selectedKeys.has(key)}
                              onChange={() => toggleRow(key)}
                            />
                          </TableCell>
                        )}
                        <TableCell className="text-xs">
                          <span className="font-mono">{m.departamento_codigo}</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{m.id}</TableCell>
                        <TableCell>
                          <p className="font-medium">{m.titulo}</p>
                          {m.objetivo && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{m.objetivo}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{m.valor_objetivo || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {META_TIPO_CALCULO_LABELS[(m.tipo_calculo as MetaTipoCalculo) ?? 'promedio_kpis'] ??
                            m.tipo_calculo}
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">{m.kpi_count}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={m.activa !== false ? 'bg-[var(--lime-lt)] text-[var(--navy)]' : ''}
                          >
                            {m.activa !== false ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </TableCell>
                        {puedeEditar && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => setDeleteTarget(m)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                )}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="size-5" />
              {editing ? 'Editar meta' : 'Nueva meta'}
            </DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={(e) => void handleSave(e)}>
            <div className="grid gap-2">
              <Label>Departamento *</Label>
              <select
                className={selectClass}
                required
                disabled={Boolean(editing)}
                value={form.departamento_id}
                onChange={(e) => setForm((f) => ({ ...f, departamento_id: e.target.value }))}
              >
                <option value="">— Selecciona —</option>
                {depts.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.codigo} — {d.nombre}
                  </option>
                ))}
              </select>
            </div>
            {!editing && (
              <div className="grid gap-2">
                <Label>ID (opcional)</Label>
                <Input
                  value={form.id}
                  onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                  placeholder="continuidad (se genera del título si va vacío)"
                />
              </div>
            )}
            {editing && (
              <div className="grid gap-2">
                <Label>ID</Label>
                <Input value={form.id} disabled className="font-mono text-sm" />
              </div>
            )}
            <div className="grid gap-2">
              <Label>Título *</Label>
              <Input
                required
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Objetivo</Label>
              <Textarea
                rows={2}
                value={form.objetivo}
                onChange={(e) => setForm((f) => ({ ...f, objetivo: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Valor objetivo</Label>
              <Input
                value={form.valor_objetivo}
                onChange={(e) => setForm((f) => ({ ...f, valor_objetivo: e.target.value }))}
                placeholder="≥ 99.7%"
              />
            </div>
            <div className="grid gap-2">
              <Label>Cálculo del avance</Label>
              <select
                className={selectClass}
                value={form.tipo_calculo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tipo_calculo: e.target.value as MetaTipoCalculo }))
                }
              >
                {META_TIPOS_CALCULO.map((t) => (
                  <option key={t} value={t}>
                    {META_TIPO_CALCULO_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--lime)]"
                checked={form.activa}
                onChange={(e) => setForm((f) => ({ ...f, activa: e.target.checked }))}
              />
              Meta activa
            </label>
            <DialogFooter>
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
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar meta</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar <strong>{deleteTarget?.titulo}</strong> ({deleteTarget?.departamento_codigo} /{' '}
            {deleteTarget?.id})?
            {deleteTarget && deleteTarget.kpi_count > 0 && (
              <span className="mt-2 block text-destructive">
                Tiene {deleteTarget.kpi_count} KPI(s) vinculado(s); no se podrá eliminar hasta reasignarlos.
              </span>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
