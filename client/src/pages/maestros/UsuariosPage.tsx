import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Edit2, Key, Plus, Search, Trash2, User as UserIcon, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { fetchDepartamentos } from '@/lib/api/departamentos'
import { fetchEmpleados } from '@/lib/api/empleados'
import { fetchRoles } from '@/lib/api/roles'
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
  createUsuario, deleteUsuario, fetchUsuarios, resetPasswordUsuario, updateUsuario,
} from '@/lib/api/usuarios'
import { formatDateDMY } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DepartamentoDoc } from '@/types/departamento'
import type { EmpleadoDoc } from '@/types/empleado'
import type { RolDoc } from '@/types/rol'
import type { UsuarioDoc } from '@/types/usuario'
import {
  deptFromUsuario, empleadoFromUsuario, empleadoIdFromUsuario,
  empleadoIdsFromUsuario, empleadosFromUsuario, rolFromUsuario,
} from '@/types/usuario'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

type FormState = {
  nombre: string
  email: string
  password: string
  rol_id: string
  empleado_id: string
  departamento_id: string
  empleados_ids: string[]
  activo: boolean
}

function emptyForm(): FormState {
  return {
    nombre: '', email: '', password: '', rol_id: '',
    empleado_id: '', departamento_id: '', empleados_ids: [], activo: true,
  }
}

function fromDoc(u: UsuarioDoc): FormState {
  const rol = rolFromUsuario(u)
  const dept = deptFromUsuario(u)
  return {
    nombre: u.nombre,
    email: u.email,
    password: '',
    rol_id: rol?._id ?? (typeof u.rol_id === 'string' ? u.rol_id : ''),
    empleado_id: empleadoIdFromUsuario(u) ?? '',
    departamento_id: dept?._id ?? (typeof u.departamento_id === 'string' ? u.departamento_id : ''),
    empleados_ids: empleadoIdsFromUsuario(u),
    activo: u.activo ?? true,
  }
}

// ─── Selector único de empleado (identidad del usuario) ────────────────────
function EmpleadoSingleSelect({
  empleados,
  value,
  onChange,
  takenByOther,
}: {
  empleados: EmpleadoDoc[]
  value: string
  onChange: (next: string) => void
  /** Map empleado_id → nombre del usuario que ya lo tiene amarrado (excepto el actual). */
  takenByOther?: Map<string, string>
}) {
  const [busqueda, setBusqueda] = useState('')
  const empleadosMap = useMemo(() => new Map(empleados.map((e) => [e._id, e])), [empleados])
  const seleccionado = value ? empleadosMap.get(value) : null

  const filtrados = useMemo(() => {
    const activos = empleados.filter((e) => e.activo !== false)
    if (!busqueda) return activos.slice(0, 50)
    const q = busqueda.toLowerCase()
    return activos.filter((e) =>
      e.nombre.toLowerCase().includes(q) ||
      e.codigo.toLowerCase().includes(q) ||
      (e.puesto ?? '').toLowerCase().includes(q),
    )
  }, [empleados, busqueda])

  if (seleccionado) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-[var(--blue-lt)]/40 p-2.5">
        <BadgeCheck className="size-4 shrink-0 text-[var(--navy)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{seleccionado.nombre}</p>
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-mono">{seleccionado.codigo}</span>
            {seleccionado.puesto && <> · {seleccionado.puesto}</>}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => onChange('')}>
          <X className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 pl-8"
          placeholder="Buscar empleado por nombre, código o puesto…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>
      <div className="max-h-[240px] overflow-y-auto rounded-md border bg-card">
        {filtrados.length === 0 ? (
          <p className="p-3 text-center text-xs text-muted-foreground">Sin coincidencias</p>
        ) : (
          <ul className="divide-y">
            {filtrados.map((e) => {
              const taken = takenByOther?.get(e._id)
              return (
                <li key={e._id}>
                  <button
                    type="button"
                    disabled={Boolean(taken)}
                    onClick={() => { onChange(e._id); setBusqueda('') }}
                    className={cn(
                      'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition hover:bg-muted/50',
                      taken && 'cursor-not-allowed opacity-50 hover:bg-transparent',
                    )}
                  >
                    <UserIcon className="mt-0.5 size-3.5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{e.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        <span className="font-mono">{e.codigo}</span>
                        {e.puesto && <> · {e.puesto}</>}
                      </p>
                    </div>
                    {taken && (
                      <span className="shrink-0 self-center rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        Ya: {taken}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Multi-select de empleados (con búsqueda + solo activos) ─────────────────
function EmpleadosMultiSelect({
  empleados,
  selected,
  onChange,
}: {
  empleados: EmpleadoDoc[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const activos = useMemo(() => empleados.filter((e) => e.activo !== false), [empleados])

  const filtrados = useMemo(() => {
    if (!busqueda) return activos
    const q = busqueda.toLowerCase()
    return activos.filter((e) =>
      e.nombre.toLowerCase().includes(q) ||
      e.codigo.toLowerCase().includes(q) ||
      (e.puesto ?? '').toLowerCase().includes(q),
    )
  }, [activos, busqueda])

  const empleadosMap = useMemo(
    () => new Map(empleados.map((e) => [e._id, e])),
    [empleados],
  )

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  return (
    <div className="space-y-2">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-md border bg-muted/30 p-2">
          {selected.map((id) => {
            const e = empleadosMap.get(id)
            if (!e) return null
            return (
              <span key={id} className="inline-flex items-center gap-1 rounded bg-[var(--blue-lt)] px-2 py-0.5 text-xs font-medium text-[var(--navy)]">
                {e.nombre}
                <button type="button" onClick={() => toggle(id)} className="hover:text-destructive">
                  <X className="size-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 pl-8"
          placeholder="Buscar empleado activo…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="max-h-[240px] overflow-y-auto rounded-md border bg-card">
        {filtrados.length === 0 ? (
          <p className="p-3 text-center text-xs text-muted-foreground">Sin coincidencias</p>
        ) : (
          <ul className="divide-y">
            {filtrados.map((e) => {
              const checked = selected.includes(e._id)
              return (
                <li key={e._id}>
                  <button
                    type="button"
                    onClick={() => toggle(e._id)}
                    className={cn(
                      'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition hover:bg-muted/50',
                      checked && 'bg-[var(--blue-lt)]/40',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      readOnly
                      className="mt-0.5 size-4 accent-[var(--lime)]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{e.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        <span className="font-mono">{e.codigo}</span>
                        {e.puesto && <> · {e.puesto}</>}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {selected.length} empleado(s) asignado(s) · {activos.length} activos disponibles
      </p>
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────

function compareUsuarios(a: UsuarioDoc, b: UsuarioDoc, sortKey: string, dir: MaestroSortDir): number {
  const rolA = rolFromUsuario(a)?.nombre ?? ''
  const rolB = rolFromUsuario(b)?.nombre ?? ''
  const deptA = deptFromUsuario(a)?.nombre ?? ''
  const deptB = deptFromUsuario(b)?.nombre ?? ''
  switch (sortKey) {
    case 'email':
      return compareStrings(a.email, b.email, dir)
    case 'rol':
      return compareStrings(rolA, rolB, dir)
    case 'departamento':
      return compareStrings(deptA, deptB, dir)
    case 'nombre':
    default:
      return compareStrings(a.nombre, b.nombre, dir)
  }
}

export function UsuariosPage() {
  const [list, setList] = useState<UsuarioDoc[]>([])
  const [roles, setRoles] = useState<RolDoc[]>([])
  const [depts, setDepts] = useState<DepartamentoDoc[]>([])
  const [empleados, setEmpleados] = useState<EmpleadoDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<UsuarioDoc | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UsuarioDoc | null>(null)
  const [resetTarget, setResetTarget] = useState<UsuarioDoc | null>(null)
  const [newPwd, setNewPwd] = useState('')

  const reload = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const [u, r, d, e] = await Promise.all([
        fetchUsuarios(),
        fetchRoles(),
        fetchDepartamentos(),
        fetchEmpleados({ activo: true }),
      ])
      setList(u); setRoles(r); setDepts(d); setEmpleados(e)
    } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const maestro = useMaestroList({
    items: list,
    defaultSortKey: 'nombre',
    getActivo: (u) => u.activo,
    searchTexts: (u) => {
      const rol = rolFromUsuario(u)
      const dept = deptFromUsuario(u)
      const emp = empleadoFromUsuario(u)
      return [u.nombre, u.email, rol?.nombre, dept?.nombre, emp?.codigo, emp?.nombre]
    },
    compare: compareUsuarios,
  })
  const { rows, busqueda, setBusqueda, filterActivo, setFilterActivo, sortKey, sortDir, onSort, count, total } = maestro

  const pagination = usePagination(rows.length, {
    resetKey: `${busqueda}|${filterActivo}|${sortKey}|${sortDir}|${total}`,
  })
  const pageRows = pagination.slice(rows)

  const visibleIds = useMemo(() => pageRows.map((u) => u._id), [pageRows])
  const bulk = useMaestroBulkDelete({
    recurso: 'usuarios',
    visibleIds,
    etiqueta: 'usuario(s)',
    confirmar: (n) => `¿Eliminar ${n} usuario(s)? Esta acción es irreversible.`,
    onAfterDelete: reload,
  })

  function openNew() { setEditing(null); setForm(emptyForm()); setOpen(true) }
  function openEdit(d: UsuarioDoc) { setEditing(d); setForm(fromDoc(d)); setOpen(true) }
  function setF<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const payload = {
        nombre: form.nombre,
        email: form.email,
        rol_id: form.rol_id,
        empleado_id: form.empleado_id || null,
        departamento_id: form.departamento_id || null,
        empleados_ids: form.empleados_ids,
        activo: form.activo,
      }
      if (editing) {
        await updateUsuario(editing._id, payload)
      } else {
        if (form.password.length < 6) throw new Error('Contraseña debe tener al menos 6 caracteres')
        await createUsuario({ ...payload, password: form.password })
      }
      setOpen(false)
      await reload()
    } catch (ex) { window.alert(ex instanceof Error ? ex.message : 'Error') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteUsuario(deleteTarget._id)
      setDeleteTarget(null)
      await reload()
    } catch (ex) { window.alert(ex instanceof Error ? ex.message : 'Error') }
  }

  const empleadosTakenByOther = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of list) {
      if (editing && u._id === editing._id) continue
      const empId = empleadoIdFromUsuario(u)
      if (empId) map.set(empId, u.nombre)
    }
    return map
  }, [list, editing])

  async function handleResetPwd() {
    if (!resetTarget) return
    if (newPwd.length < 6) { window.alert('La contraseña debe tener al menos 6 caracteres'); return }
    try {
      await resetPasswordUsuario(resetTarget._id, newPwd)
      setResetTarget(null); setNewPwd('')
      window.alert('Contraseña actualizada correctamente')
    } catch (ex) { window.alert(ex instanceof Error ? ex.message : 'Error') }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Usuarios del Sistema</h2>
          <p className="text-sm text-muted-foreground">
            Cada usuario se <strong>amarra a un número de empleado</strong> (su identidad). El sistema descubre
            automáticamente sus reportes directos y la estructura bajo su cargo.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90">
          <Plus className="size-4" /> Nuevo usuario
        </Button>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {!loading && list.length > 0 && (
        <MaestroListToolbar
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          busquedaPlaceholder="Nombre, email, rol, empleado…"
          filterActivo={filterActivo}
          onFilterActivoChange={setFilterActivo}
          count={count}
          total={total}
          countLabel="usuario(s)"
        />
      )}

      {!loading && bulk.showBar && (
        <MaestroBulkDeleteBar
          seleccionCount={bulk.seleccionCount}
          bulkDeleting={bulk.bulkDeleting}
          onEliminar={() => void bulk.handleEliminarSeleccionados()}
          etiqueta="usuarios"
        />
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
          ) : list.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Sin usuarios registrados.</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Ningún usuario coincide con los filtros.</p>
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
                  <MaestroSortableHead column="email" label="Email" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <MaestroSortableHead column="rol" label="Rol" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <TableHead>Empleado</TableHead>
                  <MaestroSortableHead column="departamento" label="Departamento" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <TableHead>Adicionales</TableHead>
                  <TableHead>Último acceso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((u) => {
                  const rol = rolFromUsuario(u)
                  const dept = deptFromUsuario(u)
                  const empSelf = empleadoFromUsuario(u)
                  const emps = empleadosFromUsuario(u)
                  return (
                    <TableRow key={u._id}>
                      <MaestroSelectCell
                        id={u._id}
                        label={u.nombre}
                        selected={bulk.selectedIds.has(u._id)}
                        onToggle={bulk.toggle}
                      />
                      <TableCell><UserIcon className="size-4 text-muted-foreground" /></TableCell>
                      <TableCell className="font-medium">{u.nombre}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell>{rol ? <Badge variant="secondary">{rol.nombre}</Badge> : '—'}</TableCell>
                      <TableCell>
                        {empSelf ? (
                          <div className="flex items-center gap-1.5">
                            <BadgeCheck className="size-3.5 text-[var(--navy)]" />
                            <div className="min-w-0">
                              <span className="text-sm font-medium">{empSelf.nombre}</span>
                              <span className="ml-1 font-mono text-[10px] text-muted-foreground">{empSelf.codigo}</span>
                            </div>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">— Sin amarrar —</span>}
                      </TableCell>
                      <TableCell>
                        {dept ? (
                          <div className="flex items-center gap-1.5">
                            <div className="size-2.5 rounded-full" style={{ background: dept.color ?? '#002060' }} />
                            <span className="text-sm">{dept.nombre}</span>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {emps.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {emps.slice(0, 2).map((e) => (
                              <Badge key={e._id} variant="outline" className="text-[10px]">
                                {e.nombre.split(' ')[0]}
                              </Badge>
                            ))}
                            {emps.length > 2 && (
                              <Badge variant="outline" className="text-[10px]">+{emps.length - 2}</Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.ultimo_acceso ? formatDateDMY(u.ultimo_acceso) : 'Nunca'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={u.activo ? 'bg-[var(--lime-lt)] text-[var(--navy)]' : ''}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Resetear contraseña" onClick={() => setResetTarget(u)}>
                            <Key className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                            <Edit2 className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(u)}>
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

      {/* Create/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label>Nombre completo <span className="text-destructive">*</span></Label>
                <Input required value={form.nombre} onChange={(e) => setF('nombre', e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Email <span className="text-destructive">*</span></Label>
                <Input required type="email" value={form.email} onChange={(e) => setF('email', e.target.value)} disabled={Boolean(editing)} />
              </div>
              {!editing && (
                <div className="grid gap-2">
                  <Label>Contraseña inicial <span className="text-destructive">*</span></Label>
                  <Input required type="password" minLength={6} value={form.password} onChange={(e) => setF('password', e.target.value)} placeholder="Mínimo 6 caracteres" />
                </div>
              )}
              <div className="grid gap-2">
                <Label>Rol <span className="text-destructive">*</span></Label>
                <select required className={selectClass} value={form.rol_id} onChange={(e) => setF('rol_id', e.target.value)}>
                  <option value="">— Selecciona un rol —</option>
                  {roles.filter((r) => r.activo).map((r) => <option key={r._id} value={r._id}>{r.nombre}</option>)}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Departamento</Label>
                <select className={selectClass} value={form.departamento_id} onChange={(e) => setF('departamento_id', e.target.value)}>
                  <option value="">— Sin departamento —</option>
                  {depts.filter((d) => d.activo).map((d) => (
                    <option key={d._id} value={d._id}>{d.nombre} ({d.codigo})</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input type="checkbox" id="us-activo" className="size-4 accent-[var(--lime)]" checked={form.activo} onChange={(e) => setF('activo', e.target.checked)} />
                <Label htmlFor="us-activo">Usuario activo</Label>
              </div>
            </div>

            <div className="grid gap-2 rounded-md border border-[var(--navy)]/20 bg-[var(--blue-lt)]/20 p-4">
              <div className="flex items-center gap-2">
                <BadgeCheck className="size-4 text-[var(--navy)]" />
                <Label className="text-xs font-semibold uppercase tracking-wide text-[var(--navy)]">
                  Empleado vinculado (identidad / número de empleado)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Selecciona <strong>el empleado que es este usuario</strong>. El sistema lo reconocerá como su identidad
                en el organigrama y descubrirá automáticamente sus reportes directos (cualquier empleado cuyo jefe
                inmediato sea este). Cada empleado puede estar amarrado a un solo usuario.
              </p>
              <EmpleadoSingleSelect
                empleados={empleados}
                value={form.empleado_id}
                onChange={(v) => setF('empleado_id', v)}
                takenByOther={empleadosTakenByOther}
              />
            </div>

            <div className="grid gap-2 border-t pt-4">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Empleados adicionales asignados (opcional)
              </Label>
              <p className="text-xs text-muted-foreground">
                Solo si necesitas ampliar el alcance del usuario más allá de su estructura natural — por ejemplo,
                darle visibilidad de personas que no le reportan directamente.
              </p>
              <EmpleadosMultiSelect
                empleados={empleados}
                selected={form.empleados_ids}
                onChange={(next) => setF('empleados_ids', next)}
              />
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

      <Dialog open={Boolean(resetTarget)} onOpenChange={(o) => { if (!o) { setResetTarget(null); setNewPwd('') } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Resetear contraseña</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Asigna una nueva contraseña para <strong>{resetTarget?.nombre}</strong>.
          </p>
          <div className="grid gap-2">
            <Label>Nueva contraseña</Label>
            <Input type="password" minLength={6} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setResetTarget(null); setNewPwd('') }}>Cancelar</Button>
            <Button className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90" onClick={() => void handleResetPwd()}>
              Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar usuario</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar al usuario <strong>{deleteTarget?.nombre}</strong>? Esta acción es irreversible.
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
