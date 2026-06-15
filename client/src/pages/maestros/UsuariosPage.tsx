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
import { isApiRequestError } from '@/lib/api/errors'
import { fetchAuthLoginConfig } from '@/lib/api/auth'
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
  empleadoIdsFromUsuario, empleadosFromUsuario, loginDisplayFromUsuario, rolFromUsuario,
} from '@/types/usuario'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

type FormState = {
  nombre: string
  email: string
  login_dominio: string
  es_usuario_dominio: boolean
  password: string
  rol_id: string
  empleado_id: string
  departamento_id: string
  empleados_ids: string[]
  activo: boolean
}

function emptyForm(): FormState {
  return {
    nombre: '', email: '', login_dominio: '', es_usuario_dominio: false, password: '', rol_id: '',
    empleado_id: '', departamento_id: '', empleados_ids: [], activo: true,
  }
}

function fromDoc(u: UsuarioDoc): FormState {
  const rol = rolFromUsuario(u)
  const dept = deptFromUsuario(u)
  const esDominio = Boolean(u.es_usuario_dominio)
  return {
    nombre: u.nombre,
    email: u.email,
    login_dominio: esDominio ? (u.login_dominio || u.email.split('@')[0] || '') : '',
    es_usuario_dominio: esDominio,
    password: '',
    rol_id: rol?._id ?? (typeof u.rol_id === 'string' ? u.rol_id : ''),
    empleado_id: empleadoIdFromUsuario(u) ?? '',
    departamento_id: dept?._id ?? (typeof u.departamento_id === 'string' ? u.departamento_id : ''),
    empleados_ids: empleadoIdsFromUsuario(u),
    activo: u.activo ?? true,
  }
}

type FormField = 'nombre' | 'email' | 'login_dominio' | 'password' | 'rol_id' | 'empleado_id' | '_form'
type FormErrors = Partial<Record<FormField, string>>

function normalizeDomainInput(raw: string): string {
  return raw.trim().replace(/^(?:RCJ\\|rcj\\)/i, '').split('@')[0]?.trim() ?? ''
}

function validateUsuarioForm(
  form: FormState,
  editing: boolean,
  empleadosTaken?: Map<string, string>,
  platformLogin = true,
): FormErrors {
  const errors: FormErrors = {}
  if (!form.nombre.trim()) errors.nombre = 'Indica el nombre completo del usuario.'
  if (!form.rol_id) errors.rol_id = 'Selecciona un rol para el usuario.'

  if (!editing) {
    const email = form.email.trim().toLowerCase()
    if (!email) errors.email = 'Indica el correo electrónico corporativo.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Formato inválido (ej. nombre.apellido@rcjcorp.com).'
    }
    if (form.es_usuario_dominio) {
      const login = normalizeDomainInput(form.login_dominio).toLowerCase()
      if (!login) {
        errors.login_dominio = 'Escribe el usuario de dominio (ej. nombre.apellido).'
      } else if (login.includes('@')) {
        errors.login_dominio = 'Quita el @ y el dominio; solo el nombre de usuario.'
      } else if (!/^[a-z0-9._-]+$/.test(login)) {
        errors.login_dominio = 'Solo letras, números, punto, guion o guion bajo.'
      }
    }
    const pwd = form.password.trim()
    if (platformLogin && !form.es_usuario_dominio && pwd.length < 8) {
      errors.password = 'La contraseña es obligatoria (mínimo 8 caracteres).'
    } else if (pwd.length > 0 && pwd.length < 8) {
      errors.password = 'La contraseña debe tener al menos 8 caracteres.'
    }
  }

  if (form.empleado_id && empleadosTaken?.has(form.empleado_id)) {
    errors.empleado_id = `Ese empleado ya está vinculado al usuario «${empleadosTaken.get(form.empleado_id)}».`
  }

  return errors
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive">{message}</p>
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
      return compareStrings(loginDisplayFromUsuario(a), loginDisplayFromUsuario(b), dir)
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
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [deleteTarget, setDeleteTarget] = useState<UsuarioDoc | null>(null)
  const [resetTarget, setResetTarget] = useState<UsuarioDoc | null>(null)
  const [newPwd, setNewPwd] = useState('')
  const [platformLogin, setPlatformLogin] = useState(true)
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

  useEffect(() => {
    void fetchAuthLoginConfig()
      .then((c) => setPlatformLogin(c.platformLogin !== false && c.activeDirectory !== true))
      .catch(() => setPlatformLogin(true))
  }, [])

  const maestro = useMaestroList({
    items: list,
    defaultSortKey: 'nombre',
    getActivo: (u) => u.activo,
    searchTexts: (u) => {
      const rol = rolFromUsuario(u)
      const dept = deptFromUsuario(u)
      const emp = empleadoFromUsuario(u)
      return [u.nombre, u.email, u.login_dominio, loginDisplayFromUsuario(u), rol?.nombre, dept?.nombre, emp?.codigo, emp?.nombre]
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

  function openNew() { setEditing(null); setForm(emptyForm()); setFormErrors({}); setOpen(true) }
  function openEdit(d: UsuarioDoc) { setEditing(d); setForm(fromDoc(d)); setFormErrors({}); setOpen(true) }
  function setF<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
    setFormErrors((errs) => {
      const field = k as FormField
      if (!errs[field] && !errs._form) return errs
      const next = { ...errs }
      delete next[field]
      delete next._form
      return next
    })
  }

  useEffect(() => {
    if (editing || !form.empleado_id) return
    const emp = empleados.find((e) => e._id === form.empleado_id)
    const mail = emp?.email?.trim().toLowerCase()
    if (!mail) return
    const userDom = mail.split('@')[0] ?? ''
    setForm((f) => {
      const next = { ...f, email: mail }
      if (f.es_usuario_dominio && userDom) next.login_dominio = userDom
      if (f.email === mail && (!f.es_usuario_dominio || f.login_dominio === userDom)) return f
      return next
    })
  }, [form.empleado_id, empleados, editing, form.es_usuario_dominio])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const localErrors = validateUsuarioForm(form, Boolean(editing), empleadosTakenByOther, platformLogin)
    if (Object.keys(localErrors).length > 0) {
      setFormErrors(localErrors)
      return
    }
    setFormErrors({})
    setSaving(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        rol_id: form.rol_id,
        empleado_id: form.empleado_id || null,
        departamento_id: form.departamento_id || null,
        empleados_ids: form.empleados_ids,
        activo: form.activo,
      }
      if (editing) {
        await updateUsuario(editing._id, payload)
      } else {
        const pwd = form.password.trim()
        const email = form.email.trim().toLowerCase()
        if (form.es_usuario_dominio) {
          const login = normalizeDomainInput(form.login_dominio).toLowerCase()
          await createUsuario({
            ...payload,
            email,
            es_usuario_dominio: true,
            login_dominio: login,
            ...(pwd ? { password: pwd } : {}),
          })
        } else {
          await createUsuario({
            ...payload,
            email,
            ...(pwd ? { password: pwd } : {}),
          })
        }
      }
      setOpen(false)
      await reload()
    } catch (ex) {
      if (isApiRequestError(ex)) {
        if (ex.field && ex.field in { nombre: 1, email: 1, login_dominio: 1, password: 1, rol_id: 1, empleado_id: 1 }) {
          setFormErrors({ [ex.field as FormField]: ex.message })
        } else {
          setFormErrors({ _form: ex.message })
        }
      } else {
        const msg = ex instanceof Error ? ex.message : 'No se pudo guardar el usuario.'
        if (msg.includes('502') || msg.includes('Failed to fetch') || msg.includes('ECONNREFUSED')) {
          setFormErrors({
            _form: 'No se pudo contactar al servidor. Espera unos segundos (reinicio del API) e intenta de nuevo.',
          })
        } else {
          setFormErrors({ _form: msg })
        }
      }
    }
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
    if (newPwd.length < 8) { window.alert('La contraseña debe tener al menos 8 caracteres'); return }
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
                  <MaestroSortableHead column="email" label="Login / Email" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
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
                      <TableCell className="text-sm text-muted-foreground">
                        <span>{u.email}</span>
                        {u.es_usuario_dominio && u.login_dominio && (
                          <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground/80">
                            AD: {u.login_dominio}
                          </span>
                        )}
                        {u.es_usuario_dominio && (
                          <Badge variant="outline" className="ml-1.5 text-[10px]">Dominio</Badge>
                        )}
                      </TableCell>
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
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className={u.activo ? 'bg-[var(--lime-lt)] text-[var(--navy)]' : ''}>
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
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
          <form
            onSubmit={(e) => void handleSave(e)}
            className="space-y-4"
            noValidate
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
          >
            {formErrors._form && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formErrors._form}
              </div>
            )}
            {!editing && (
              <div className="rounded-md border border-[var(--lime)]/50 bg-[var(--lime-lt)] p-4 text-xs text-muted-foreground">
                {platformLogin ? (
                  <>
                    El <strong>correo</strong> y la <strong>contraseña</strong> (mín. 8 caracteres) son
                    obligatorios para el acceso al portal IT Manager.
                  </>
                ) : (
                  <>
                    El <strong>correo</strong> siempre es obligatorio. Marca <strong>Usuario de dominio</strong> si el
                    login de AD es distinto. La contraseña local es opcional si usan Active Directory.
                  </>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label>Nombre completo <span className="text-destructive">*</span></Label>
                <Input
                  value={form.nombre}
                  onChange={(e) => setF('nombre', e.target.value)}
                  className={cn(formErrors.nombre && 'border-destructive')}
                  aria-invalid={Boolean(formErrors.nombre)}
                />
                <FieldError message={formErrors.nombre} />
              </div>
              {!editing && !platformLogin && (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <input
                    type="checkbox"
                    id="us-dominio"
                    className="size-4 accent-[var(--lime)]"
                    checked={form.es_usuario_dominio}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setF('es_usuario_dominio', checked)
                      if (checked && !form.login_dominio.trim() && form.email.includes('@')) {
                        setF('login_dominio', form.email.split('@')[0] ?? '')
                      }
                    }}
                  />
                  <Label htmlFor="us-dominio">Usuario de dominio (login AD sin @)</Label>
                </div>
              )}
              <div className="grid gap-2 sm:col-span-2">
                <Label>Correo electrónico <span className="text-destructive">*</span></Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setF('email', e.target.value)}
                  disabled={Boolean(editing)}
                  placeholder="nombre.apellido@grupoc.com"
                  className={cn(formErrors.email && 'border-destructive')}
                  aria-invalid={Boolean(formErrors.email)}
                />
                <FieldError message={formErrors.email} />
                {!editing && (
                  <p className="text-xs text-muted-foreground">
                    Correo con el que el usuario iniciará sesión en IT Manager.
                  </p>
                )}
              </div>
              {form.es_usuario_dominio && (
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Usuario de dominio <span className="text-destructive">*</span></Label>
                  <Input
                    type="text"
                    value={form.login_dominio}
                    onChange={(e) => setF('login_dominio', e.target.value)}
                    disabled={Boolean(editing)}
                    placeholder="nombre.apellido"
                    className={cn('font-mono', formErrors.login_dominio && 'border-destructive')}
                    autoComplete="off"
                    aria-invalid={Boolean(formErrors.login_dominio)}
                  />
                  <FieldError message={formErrors.login_dominio} />
                  <p className="text-xs text-muted-foreground">
                    {editing
                      ? 'El login de dominio no se puede cambiar después de crear el usuario.'
                      : <>Solo el nombre de usuario, sin <code>@rcjcorp.com</code>. También acepta <code>RCJ\usuario</code>.</>}
                  </p>
                </div>
              )}
              {!editing && (
                <div className="grid gap-2 sm:col-span-2">
                  <Label>
                    Contraseña
                    {platformLogin && !form.es_usuario_dominio && (
                      <span className="text-destructive"> *</span>
                    )}
                  </Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setF('password', e.target.value)}
                    placeholder={platformLogin ? 'Mínimo 8 caracteres' : 'Opcional si usa Active Directory'}
                    autoComplete="new-password"
                    className={cn(formErrors.password && 'border-destructive')}
                    aria-invalid={Boolean(formErrors.password)}
                  />
                  <FieldError message={formErrors.password} />
                </div>
              )}
              <div className="grid gap-2">
                <Label>Rol <span className="text-destructive">*</span></Label>
                <select
                  className={cn(selectClass, formErrors.rol_id && 'border-destructive')}
                  value={form.rol_id}
                  onChange={(e) => setF('rol_id', e.target.value)}
                  aria-invalid={Boolean(formErrors.rol_id)}
                >
                  <option value="">— Selecciona un rol —</option>
                  {roles.filter((r) => r.activo).map((r) => <option key={r._id} value={r._id}>{r.nombre}</option>)}
                </select>
                <FieldError message={formErrors.rol_id} />
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
              <FieldError message={formErrors.empleado_id} />
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
            <Input type="password" minLength={8} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Mínimo 8 caracteres" />
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
