import { useCallback, useEffect, useMemo, useState } from 'react'
import { Briefcase, Crown, Edit2, Plus, Shield, Trash2 } from 'lucide-react'

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
import { DepartamentosMultiSelect } from '@/components/maestros/DepartamentosMultiSelect'
import { fetchDepartamentos } from '@/lib/api/departamentos'
import { fetchPerfilesPuesto } from '@/lib/api/perfilesPuesto'
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
  createRol, deleteRol, fetchPermisosDisponibles, fetchRoles, updateRol,
} from '@/lib/api/roles'
import type { DepartamentoDoc } from '@/types/departamento'
import type { PerfilPuestoDoc } from '@/types/perfilPuesto'
import { deptFromPerfil } from '@/types/perfilPuesto'
import type { RolDoc } from '@/types/rol'
import {
  departamentoIdsFromRol, departamentosFromRol, perfilFromRol, perfilIdFromRol,
} from '@/types/rol'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

type FormState = {
  nombre: string
  descripcion: string
  departamentos_ids: string[]
  perfil_puesto_id: string
  permisos: string[]
  activo: boolean
}

function emptyForm(): FormState {
  return {
    nombre: '', descripcion: '', departamentos_ids: [],
    perfil_puesto_id: '', permisos: [], activo: true,
  }
}
function compareRoles(a: RolDoc, b: RolDoc, sortKey: string, dir: MaestroSortDir): number {
  const deptA = departamentosFromRol(a).map((d) => d.nombre).join(', ')
  const deptB = departamentosFromRol(b).map((d) => d.nombre).join(', ')
  switch (sortKey) {
    case 'departamento':
      return compareStrings(deptA, deptB, dir)
    case 'permisos':
      return compareNumbers(a.permisos?.length ?? 0, b.permisos?.length ?? 0, dir)
    case 'nombre':
    default:
      return compareStrings(a.nombre, b.nombre, dir)
  }
}

function fromDoc(d: RolDoc): FormState {
  return {
    nombre: d.nombre,
    descripcion: d.descripcion ?? '',
    departamentos_ids: departamentoIdsFromRol(d),
    perfil_puesto_id: perfilIdFromRol(d) ?? '',
    permisos: d.permisos ?? [],
    activo: d.activo ?? true,
  }
}

export function RolesPage() {
  const [list, setList] = useState<RolDoc[]>([])
  const [depts, setDepts] = useState<DepartamentoDoc[]>([])
  const [perfiles, setPerfiles] = useState<PerfilPuestoDoc[]>([])
  const [permisos, setPermisos] = useState<{ clave: string; descripcion: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RolDoc | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RolDoc | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const [r, p, d, pf] = await Promise.all([
        fetchRoles(), fetchPermisosDisponibles(), fetchDepartamentos(), fetchPerfilesPuesto(),
      ])
      setList(r); setPermisos(p); setDepts(d); setPerfiles(pf)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }, [])

  // Perfiles filtrados por el departamento seleccionado (si hay)
  const perfilesFiltrados = useMemo(() => {
    if (form.departamentos_ids.length === 0) return perfiles
    const set = new Set(form.departamentos_ids)
    return perfiles.filter((p) => {
      const d = deptFromPerfil(p)
      return d?._id != null && set.has(d._id)
    })
  }, [perfiles, form.departamentos_ids])

  const perfilSeleccionado = useMemo(
    () => perfiles.find((p) => p._id === form.perfil_puesto_id) ?? null,
    [perfiles, form.perfil_puesto_id],
  )

  useEffect(() => { void reload() }, [reload])

  const maestro = useMaestroList({
    items: list,
    defaultSortKey: 'nombre',
    getActivo: (r) => r.activo,
    searchTexts: (r) => {
      const deptos = departamentosFromRol(r)
      const perfil = perfilFromRol(r)
      return [r.nombre, r.descripcion, ...deptos.map((d) => d.nombre), perfil?.titulo]
    },
    compare: compareRoles,
  })
  const { rows, busqueda, setBusqueda, filterActivo, setFilterActivo, sortKey, sortDir, onSort, count, total } = maestro

  const pagination = usePagination(rows.length, {
    resetKey: `${busqueda}|${filterActivo}|${sortKey}|${sortDir}|${total}`,
  })
  const pageRows = pagination.slice(rows)

  const visibleIds = useMemo(() => pageRows.map((r) => r._id), [pageRows])
  const bulk = useMaestroBulkDelete({
    recurso: 'roles',
    visibleIds,
    etiqueta: 'rol(es)',
    onAfterDelete: reload,
  })

  function openNew() { setEditing(null); setForm(emptyForm()); setOpen(true) }
  function openEdit(d: RolDoc) { setEditing(d); setForm(fromDoc(d)); setOpen(true) }

  function setF<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }
  function togglePermiso(clave: string) {
    setForm((f) => {
      const has = f.permisos.includes(clave)
      const next = has ? f.permisos.filter((p) => p !== clave) : [...f.permisos, clave]
      return { ...f, permisos: next }
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const payload = {
        ...form,
        departamento_id: form.departamentos_ids[0] ?? null,
        departamentos_ids: form.departamentos_ids,
      }
      if (editing) await updateRol(editing._id, payload)
      else await createRol(payload)
      setOpen(false)
      await reload()
    } catch (ex) { window.alert(ex instanceof Error ? ex.message : 'Error') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteRol(deleteTarget._id)
      setDeleteTarget(null)
      await reload()
    } catch (ex) { window.alert(ex instanceof Error ? ex.message : 'No se pudo eliminar') }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Roles y Permisos</h2>
          <p className="text-sm text-muted-foreground">
            Define los roles del sistema y los permisos asociados a cada uno.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90">
          <Plus className="size-4" /> Nuevo rol
        </Button>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {!loading && list.length > 0 && (
        <MaestroListToolbar
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          busquedaPlaceholder="Nombre, departamento, perfil…"
          filterActivo={filterActivo}
          onFilterActivoChange={setFilterActivo}
          count={count}
          total={total}
          countLabel="rol(es)"
        />
      )}

      {!loading && bulk.showBar && (
        <MaestroBulkDeleteBar
          seleccionCount={bulk.seleccionCount}
          bulkDeleting={bulk.bulkDeleting}
          onEliminar={() => void bulk.handleEliminarSeleccionados()}
          etiqueta="roles"
        />
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
          ) : list.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Sin roles registrados.</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Ningún rol coincide con los filtros.</p>
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
                  <MaestroSortableHead column="nombre" label="Nombre" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <MaestroSortableHead column="departamento" label="Departamentos" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <TableHead>Perfil de puesto</TableHead>
                  <MaestroSortableHead column="permisos" label="Permisos" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => {
                  const deptos = departamentosFromRol(r)
                  const perfil = perfilFromRol(r)
                  return (
                  <TableRow key={r._id}>
                    <MaestroSelectCell
                      id={r._id}
                      label={r.nombre}
                      selected={bulk.selectedIds.has(r._id)}
                      onToggle={bulk.toggle}
                    />
                    <TableCell><Shield className="size-4 text-muted-foreground" /></TableCell>
                    <TableCell>
                      <div className="font-medium">{r.nombre}</div>
                      {r.descripcion && (
                        <div className="text-xs text-muted-foreground">{r.descripcion}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {deptos.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {deptos.map((d) => (
                            <Badge key={d._id} variant="outline" className="gap-1 font-normal">
                              <span
                                className="size-2 rounded-full"
                                style={{ background: d.color ?? '#002060' }}
                              />
                              {d.nombre}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {perfil ? (
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Briefcase className="size-3.5 text-muted-foreground" />
                            <span className="truncate text-sm font-medium">{perfil.titulo}</span>
                            {perfil.tiene_personal_a_cargo && (
                              <Badge variant="secondary" className="gap-1 bg-[var(--navy)] py-0 text-[10px] text-white">
                                <Crown className="size-2.5" />
                              </Badge>
                            )}
                          </div>
                          <code className="text-[10px] text-muted-foreground">{perfil.codigo}</code>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.permisos.includes('*') ? (
                          <Badge variant="secondary" className="bg-red-50 text-red-700">Acceso total</Badge>
                        ) : (
                          <>
                            {r.permisos.slice(0, 3).map((p) => (
                              <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                            ))}
                            {r.permisos.length > 3 && (
                              <Badge variant="outline" className="text-[10px]">+{r.permisos.length - 3}</Badge>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={r.activo ? 'bg-[var(--lime-lt)] text-[var(--navy)]' : ''}>
                        {r.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                          <Edit2 className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(r)}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar rol' : 'Nuevo rol'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Nombre <span className="text-destructive">*</span></Label>
                <Input required value={form.nombre} onChange={(e) => setF('nombre', e.target.value)} />
              </div>
              <div className="flex items-end gap-2">
                <input id="rol-activo" type="checkbox" className="size-4 accent-[var(--lime)]" checked={form.activo} onChange={(e) => setF('activo', e.target.checked)} />
                <Label htmlFor="rol-activo">Activo</Label>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Textarea rows={2} value={form.descripcion} onChange={(e) => setF('descripcion', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Departamentos</Label>
              <DepartamentosMultiSelect
                departamentos={depts.filter((d) => d.activo)}
                value={form.departamentos_ids}
                hint="Marca uno o más departamentos a los que aplica este rol. Los usuarios con este rol verán en Mi Equipo la dotación de esos departamentos (además de su jerarquía)."
                onChange={(ids) => {
                  setF('departamentos_ids', ids)
                  if (perfilSeleccionado) {
                    const d = deptFromPerfil(perfilSeleccionado)
                    if (d?._id && ids.length > 0 && !ids.includes(d._id)) {
                      setF('perfil_puesto_id', '')
                    }
                  }
                }}
              />
            </div>

            <div className="grid gap-2 rounded-md border border-[var(--navy)]/20 bg-[var(--blue-lt)]/20 p-4">
              <div className="flex items-center gap-2">
                <Briefcase className="size-4 text-[var(--navy)]" />
                <Label className="text-xs font-semibold uppercase tracking-wide text-[var(--navy)]">
                  Perfil de puesto vinculado
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Asocia este rol a un perfil de puesto del catálogo (opcional). Ayuda a alinear los permisos del
                sistema con la estructura organizacional definida en los descriptores RH-F-04.
                {form.departamentos_ids.length > 0 && ' Solo se muestran perfiles de los departamentos seleccionados.'}
              </p>
              <select
                className={selectClass}
                value={form.perfil_puesto_id}
                onChange={(e) => setF('perfil_puesto_id', e.target.value)}
              >
                <option value="">— Sin perfil amarrado —</option>
                {perfilesFiltrados.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.codigo} · {p.titulo}
                    {p.tiene_personal_a_cargo ? ' (con personal a cargo)' : ''}
                  </option>
                ))}
              </select>
              {perfilSeleccionado && (
                <div className="mt-1 rounded bg-white/60 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{perfilSeleccionado.titulo}</span>
                    {perfilSeleccionado.tiene_personal_a_cargo && (
                      <Badge variant="secondary" className="gap-1 bg-[var(--navy)] py-0 text-[10px] text-white">
                        <Crown className="size-2.5" /> Tiene personal a cargo
                      </Badge>
                    )}
                  </div>
                  {perfilSeleccionado.nivel && (
                    <p className="text-muted-foreground">Nivel: {perfilSeleccionado.nivel}</p>
                  )}
                  {perfilSeleccionado.reporta_a && (
                    <p className="text-muted-foreground">Reporta a: {perfilSeleccionado.reporta_a}</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Permisos ({form.permisos.length} seleccionado{form.permisos.length === 1 ? '' : 's'})
              </Label>
              <div className="max-h-[300px] space-y-1 overflow-y-auto rounded-md border bg-muted/20 p-2">
                {permisos.map((p) => {
                  const checked = form.permisos.includes(p.clave)
                  const isAdmin = p.clave === '*'
                  return (
                    <label
                      key={p.clave}
                      className={`flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-white ${
                        checked ? 'bg-[var(--blue-lt)]' : ''
                      } ${isAdmin ? 'border-l-2 border-red-400' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePermiso(p.clave)}
                        className="mt-0.5 size-4 accent-[var(--lime)]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`font-medium ${isAdmin ? 'text-red-700' : ''}`}>{p.descripcion}</p>
                        <code className="text-[10px] text-muted-foreground">{p.clave}</code>
                      </div>
                    </label>
                  )
                })}
              </div>
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

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar rol</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar el rol <strong>{deleteTarget?.nombre}</strong>? Esta acción es irreversible.
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
