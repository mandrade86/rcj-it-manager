import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, RefreshCw, Target, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { BOARD, BoardPill, BoardPrimaryButton, EntityBoard } from '@/components/board/EntityBoard'
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
import { MAESTRO_SELECT_CLASS } from '@/lib/maestroList'

const selectClass = MAESTRO_SELECT_CLASS

type MetaBoardRow = MetaDoc & { _id: string; activo: boolean }

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
  }, [filterDept, filterActiva])

  const boardRows: MetaBoardRow[] = useMemo(
    () =>
      rows.map((m) => ({
        ...m,
        _id: metaRowKey(m),
        activo: m.activa !== false,
      })),
    [rows],
  )

  const visibleKeys = useMemo(() => boardRows.map((m) => m._id), [boardRows])
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
            <BoardPrimaryButton onClick={openNew}>
              <Plus className="size-4" /> Nueva meta
            </BoardPrimaryButton>
          )}
        </div>
      </div>

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

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <EntityBoard
          rows={boardRows}
          countLabel="meta"
          emptyMessage="No hay metas. Crea la primera o inicializa desde KPIs → Registrar metas."
          searchTexts={(m) => [
            m.titulo, m.id, m.departamento_nombre, m.departamento_codigo, m.objetivo, m.valor_objetivo,
          ]}
          groups={
            filterActiva === 'all'
              ? [
                  { id: 'activas', label: 'Activas', color: BOARD.green, match: (r) => r.activo },
                  { id: 'inactivas', label: 'Inactivas', color: BOARD.gray, match: (r) => !r.activo },
                ]
              : [{
                  id: 'filtradas',
                  label: filterActiva === 'true' ? 'Activas' : 'Inactivas',
                  color: filterActiva === 'true' ? BOARD.green : BOARD.gray,
                  match: () => true,
                }]
          }
          toolbarLeft={
            <div className="flex flex-wrap gap-3">
              <div className="grid gap-1">
                <label className="text-xs" style={{ color: BOARD.muted }}>Departamento</label>
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
                <label className="text-xs" style={{ color: BOARD.muted }}>Estado</label>
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
              {puedeEditar && boardRows.length > 0 && (
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-1.5 text-xs" style={{ color: BOARD.muted }}>
                    <input
                      type="checkbox"
                      className="size-3.5 accent-[var(--navy)]"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allSelected && someSelected
                      }}
                      onChange={toggleAll}
                    />
                    Seleccionar visibles
                  </label>
                </div>
              )}
            </div>
          }
          columns={[
            ...(puedeEditar
              ? [{
                  id: 'sel',
                  label: '',
                  className: 'w-8',
                  render: (m: MetaBoardRow) => (
                    <input
                      type="checkbox"
                      className="size-3.5 accent-[var(--navy)]"
                      checked={selectedKeys.has(m._id)}
                      onChange={() => toggleRow(m._id)}
                    />
                  ),
                }]
              : []),
            {
              id: 'depto',
              label: 'Depto',
              render: (m) => <span className="font-mono text-xs">{m.departamento_codigo}</span>,
            },
            {
              id: 'id',
              label: 'ID',
              render: (m) => <span className="font-mono text-xs">{m.id}</span>,
            },
            {
              id: 'titulo',
              label: 'Título',
              render: (m) => (
                <div>
                  <p className="font-medium">{m.titulo}</p>
                  {m.objetivo && (
                    <p className="line-clamp-1 text-xs" style={{ color: BOARD.muted }}>{m.objetivo}</p>
                  )}
                </div>
              ),
            },
            {
              id: 'valor',
              label: 'Valor objetivo',
              render: (m) => <span className="text-sm">{m.valor_objetivo || '—'}</span>,
            },
            {
              id: 'calculo',
              label: 'Cálculo',
              render: (m) => (
                <span className="text-xs" style={{ color: BOARD.muted }}>
                  {META_TIPO_CALCULO_LABELS[(m.tipo_calculo as MetaTipoCalculo) ?? 'promedio_kpis'] ??
                    m.tipo_calculo}
                </span>
              ),
            },
            {
              id: 'kpis',
              label: 'KPIs',
              render: (m) => <span className="tabular-nums text-sm">{m.kpi_count}</span>,
            },
            {
              id: 'estado',
              label: 'Estado',
              render: (m) => (
                <BoardPill
                  label={m.activo ? 'Activa' : 'Inactiva'}
                  bg={m.activo ? BOARD.green : BOARD.gray}
                  text={m.activo ? '#fff' : BOARD.text}
                />
              ),
            },
            ...(puedeEditar
              ? [{
                  id: 'acciones',
                  label: 'Acciones',
                  align: 'right' as const,
                  render: (m: MetaBoardRow) => (
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
                  ),
                }]
              : []),
          ]}
        />
      )}

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
