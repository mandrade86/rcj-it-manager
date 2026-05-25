import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Cable, Edit2, Factory, LayoutGrid, List, Plus, RefreshCw, Save, Settings2, Trash2,
} from 'lucide-react'

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
import { fetchEmpresas } from '@/lib/api/empresas'
import {
  fetchEhrAuth,
  loginEhrApi,
  logoutEhrApi,
  saveEhrAuth,
  type EhrAuthStatus,
} from '@/lib/api/ehrAuth'
import {
  createEmpleado, deleteEmpleado, fetchConfigServicio, fetchEmpleados,
  saveConfigServicio, syncEmpleados, updateEmpleado,
} from '@/lib/api/empleados'
import {
  buildDeptToEmpresaIdMap,
  empleadoEmpresaId,
  empresaNombrePorId,
} from '@/lib/deptoEmpresaFilter'
import type { DepartamentoDoc } from '@/types/departamento'
import type { EmpleadoDoc } from '@/types/empleado'
import type { EmpresaDoc } from '@/types/empresa'
import { MaestroBulkDeleteBar } from '@/components/maestros/MaestroBulkDeleteBar'
import { MaestroListToolbar } from '@/components/maestros/MaestroListToolbar'
import { MaestroSortableHead } from '@/components/maestros/MaestroSortableHead'
import { MaestroSelectAllHeader, MaestroSelectCell } from '@/components/maestros/MaestroTableSelection'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { useMaestroBulkDelete } from '@/hooks/useMaestroBulkDelete'
import { usePagination } from '@/hooks/usePagination'
import { MAESTRO_SELECT_CLASS, compareStrings, type MaestroSortDir } from '@/lib/maestroList'
import { DepartamentosMultiSelect } from '@/components/maestros/DepartamentosMultiSelect'
import { OrgChart, OrgDetailPanel } from './OrgChart'
import { departamentoIdsFromRefs } from '@/types/empleado'

const selectClass = MAESTRO_SELECT_CLASS

type Vista = 'tabla' | 'orgchart'

type FormState = {
  codigo: string
  nombre: string
  puesto: string
  departamento_id: string
  departamento: string
  email: string
  telefono: string
  jefe_id: string
  foto_url: string
  activo: boolean
  departamentos_a_cargo: string[]
}

function emptyForm(): FormState {
  return {
    codigo: '', nombre: '', puesto: '', departamento_id: '', departamento: '',
    email: '', telefono: '', jefe_id: '', foto_url: '', activo: true,
    departamentos_a_cargo: [],
  }
}

function fromDoc(d: EmpleadoDoc): FormState {
  const dept = d.departamento_id && typeof d.departamento_id !== 'string' ? d.departamento_id : null
  const jefe = d.jefe_id && typeof d.jefe_id !== 'string' ? d.jefe_id : null
  return {
    codigo: d.codigo,
    nombre: d.nombre,
    puesto: d.puesto ?? '',
    departamento_id: dept?._id ?? (typeof d.departamento_id === 'string' ? d.departamento_id : ''),
    departamento: d.departamento ?? '',
    email: d.email ?? '',
    telefono: d.telefono ?? '',
    jefe_id: jefe?._id ?? (typeof d.jefe_id === 'string' ? d.jefe_id : ''),
    foto_url: d.foto_url ?? '',
    activo: d.activo ?? true,
    departamentos_a_cargo: departamentoIdsFromRefs(d.departamentos_a_cargo),
  }
}

export function EmpleadosPage() {
  const [list, setList] = useState<EmpleadoDoc[]>([])
  const [depts, setDepts] = useState<DepartamentoDoc[]>([])
  const [empresasCatalog, setEmpresasCatalog] = useState<EmpresaDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [vista, setVista] = useState<Vista>('tabla')
  const [filterDept, setFilterDept] = useState('')
  const [filterEmpresa, setFilterEmpresa] = useState('')
  const [filterEstado, setFilterEstado] = useState<'activos' | 'inactivos' | 'todos'>('activos')
  const [busqueda, setBusqueda] = useState('')
  const [sortKey, setSortKey] = useState('nombre')
  const [sortDir, setSortDir] = useState<MaestroSortDir>('asc')

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<EmpleadoDoc | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<EmpleadoDoc | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [cfgOpen, setCfgOpen] = useState(false)
  const [serviceUrl, setServiceUrl] = useState('')
  const [loginUrl, setLoginUrl] = useState('')
  const [ehrUser, setEhrUser] = useState('')
  const [ehrPassword, setEhrPassword] = useState('')
  const [ehrAuth, setEhrAuth] = useState<EhrAuthStatus | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const [e, d, emp] = await Promise.all([
        fetchEmpleados(),
        fetchDepartamentos(),
        fetchEmpresas({ activo: true }),
      ])
      setList(e); setDepts(d); setEmpresasCatalog(emp)
    } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void reload() }, [reload])

  function openNew() { setEditing(null); setForm(emptyForm()); setOpen(true) }
  function openEdit(d: EmpleadoDoc) { setEditing(d); setForm(fromDoc(d)); setOpen(true) }
  function setF<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const payload = {
        ...form,
        departamento_id: form.departamento_id || null,
        jefe_id: form.jefe_id || null,
        departamentos_a_cargo: form.departamentos_a_cargo,
      }
      if (editing) await updateEmpleado(editing._id, payload)
      else await createEmpleado(payload)
      setOpen(false)
      await reload()
    } catch (ex) { window.alert(ex instanceof Error ? ex.message : 'Error') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try { await deleteEmpleado(deleteTarget._id); setDeleteTarget(null); await reload() }
    catch (ex) { window.alert(ex instanceof Error ? ex.message : 'Error') }
  }

  async function openCfg() {
    setCfgOpen(true)
    setSyncResult(null)
    setEhrPassword('')
    try {
      const [{ url }, auth] = await Promise.all([fetchConfigServicio(), fetchEhrAuth()])
      setServiceUrl(url)
      setLoginUrl(auth.loginUrl)
      setEhrUser(auth.username)
      setEhrAuth(auth)
    } catch {
      /* ignore */
    }
  }

  async function handleSaveCfg() {
    try {
      await Promise.all([
        saveConfigServicio(serviceUrl),
        saveEhrAuth({
          loginUrl,
          username: ehrUser,
          ...(ehrPassword ? { password: ehrPassword } : {}),
        }),
      ])
      const auth = await fetchEhrAuth()
      setEhrAuth(auth)
      setEhrPassword('')
      window.alert('Configuración guardada')
    } catch (ex) {
      window.alert(ex instanceof Error ? ex.message : 'Error')
    }
  }

  async function handleEhrLogin() {
    setLoginLoading(true)
    setSyncResult(null)
    try {
      const r = await loginEhrApi({
        loginUrl,
        username: ehrUser,
        ...(ehrPassword ? { password: ehrPassword } : {}),
      })
      setEhrAuth(r)
      setEhrPassword('')
      setSyncResult(r.message ?? 'Sesión EHR iniciada.')
    } catch (ex) {
      setSyncResult(`Error: ${ex instanceof Error ? ex.message : 'Login fallido'}`)
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleEhrLogout() {
    try {
      await logoutEhrApi()
      const auth = await fetchEhrAuth()
      setEhrAuth(auth)
      setSyncResult('Token EHR eliminado.')
    } catch (ex) {
      setSyncResult(`Error: ${ex instanceof Error ? ex.message : 'desconocido'}`)
    }
  }

  async function handleSync() {
    setSyncing(true); setSyncResult(null)
    try {
      const r = await syncEmpleados()
      setSyncResult(`Sincronización completa — ${r.insertados} nuevos, ${r.actualizados} actualizados, ${r.errores} errores (total ${r.total}).`)
      await reload()
    } catch (ex) {
      setSyncResult(`Error: ${ex instanceof Error ? ex.message : 'desconocido'}`)
    } finally { setSyncing(false) }
  }

  const deptToEmpresaId = useMemo(() => buildDeptToEmpresaIdMap(depts), [depts])

  const empresasOpcionesFiltro = useMemo(() => {
    const ids = new Set<string>()
    for (const e of list) {
      const eid = empleadoEmpresaId(e, deptToEmpresaId)
      if (eid) ids.add(eid)
    }
    return empresasCatalog
      .filter((em) => ids.has(em._id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [list, deptToEmpresaId, empresasCatalog])

  const filtered = useMemo(() => {
    return list.filter((e) => {
      if (filterEstado === 'activos' && e.activo === false) return false
      if (filterEstado === 'inactivos' && e.activo !== false) return false
      if (filterDept) {
        const dept = e.departamento_id && typeof e.departamento_id !== 'string' ? e.departamento_id : null
        if (dept?._id !== filterDept) return false
      }
      if (filterEmpresa) {
        const eid = empleadoEmpresaId(e, deptToEmpresaId)
        if (eid !== filterEmpresa) return false
      }
      if (busqueda) {
        const q = busqueda.toLowerCase()
        return (
          e.nombre.toLowerCase().includes(q) ||
          (e.puesto ?? '').toLowerCase().includes(q) ||
          e.codigo.toLowerCase().includes(q) ||
          (e.email ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [list, filterDept, filterEmpresa, filterEstado, busqueda, deptToEmpresaId])

  const displayed = useMemo(() => {
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'codigo':
          return compareStrings(a.codigo, b.codigo, sortDir)
        case 'puesto':
          return compareStrings(a.puesto ?? '', b.puesto ?? '', sortDir)
        case 'nombre':
        default:
          return compareStrings(a.nombre, b.nombre, sortDir)
      }
    })
  }, [filtered, sortKey, sortDir])

  const pagination = usePagination(displayed.length, {
    resetKey: `${filterDept}|${filterEmpresa}|${filterEstado}|${busqueda}|${sortKey}|${sortDir}|${list.length}`,
  })
  const pageRows = pagination.slice(displayed)

  const onSort = useCallback((key: string, dir: MaestroSortDir) => {
    setSortKey(key)
    setSortDir(dir)
  }, [])

  const selected = useMemo(
    () => displayed.find((e) => e._id === selectedId) ?? null,
    [displayed, selectedId],
  )

  const visibleIds = useMemo(() => pageRows.map((e) => e._id), [pageRows])
  const bulk = useMaestroBulkDelete({
    recurso: 'empleados',
    visibleIds,
    etiqueta: 'empleado(s)',
    confirmar: (n) =>
      `¿Eliminar ${n} empleado(s)? Si tienen subordinados, quedarán sin jefe asignado.`,
    onAfterDelete: reload,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Empleados de la Organización</h2>
          <p className="text-sm text-muted-foreground">
            Maestro de empleados con organigrama jerárquico. Los datos pueden venir de un servicio externo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => void openCfg()}>
            <Cable className="size-4" /> Servicio externo
          </Button>
          <Button onClick={openNew} className="gap-2 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90">
            <Plus className="size-4" /> Nuevo empleado
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <MaestroListToolbar
            busqueda={busqueda}
            onBusquedaChange={setBusqueda}
            busquedaPlaceholder="Nombre, puesto, código, email…"
            showActivoFilter={false}
            count={displayed.length}
            total={list.length}
            countLabel="empleado(s)"
          >
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Departamento</label>
            <select
              className={selectClass + ' min-w-[200px]'}
              value={filterDept}
              onChange={(e) => {
                setFilterDept(e.target.value)
                setFilterEmpresa('')
              }}
            >
              <option value="">Todos</option>
              {depts.map((d) => <option key={d._id} value={d._id}>{d.nombre} ({d.codigo})</option>)}
            </select>
          </div>
          {empresasOpcionesFiltro.length > 0 && (
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
                {empresasOpcionesFiltro.map((em) => (
                  <option key={em._id} value={em._id}>{em.codigo} — {em.nombre}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Estado</label>
            <select
              className={selectClass + ' min-w-[140px]'}
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value as 'activos' | 'inactivos' | 'todos')}
            >
              <option value="activos">Solo activos</option>
              <option value="inactivos">Solo inactivos</option>
              <option value="todos">Todos</option>
            </select>
          </div>
          </MaestroListToolbar>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-md border bg-background p-1">
          <Button
            type="button"
            variant={vista === 'tabla' ? 'default' : 'ghost'}
            size="sm"
            className={vista === 'tabla' ? 'bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90 gap-1.5' : 'gap-1.5'}
            onClick={() => setVista('tabla')}
          >
            <List className="size-4" /> Tabla
          </Button>
          <Button
            type="button"
            variant={vista === 'orgchart' ? 'default' : 'ghost'}
            size="sm"
            className={vista === 'orgchart' ? 'bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90 gap-1.5' : 'gap-1.5'}
            onClick={() => setVista('orgchart')}
          >
            <LayoutGrid className="size-4" /> Organigrama
          </Button>
        </div>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {vista === 'tabla' ? (
        <>
          {!loading && bulk.showBar && (
            <MaestroBulkDeleteBar
              seleccionCount={bulk.seleccionCount}
              bulkDeleting={bulk.bulkDeleting}
              onEliminar={() => void bulk.handleEliminarSeleccionados()}
              etiqueta="empleados"
            />
          )}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
            ) : displayed.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {list.length === 0 ? 'Sin empleados.' : 'Ningún empleado coincide con los filtros.'}
              </p>
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
                    <MaestroSortableHead column="nombre" label="Nombre" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                    <MaestroSortableHead column="puesto" label="Puesto" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                    <TableHead>Departamento</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Reporta a</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((e) => {
                    const dept = e.departamento_id && typeof e.departamento_id !== 'string' ? e.departamento_id : null
                    const jefe = e.jefe_id && typeof e.jefe_id !== 'string' ? e.jefe_id : null
                    const deptosCargo = (e.departamentos_a_cargo ?? []).filter(
                      (d): d is { _id: string; codigo: string; nombre: string; color?: string } =>
                        typeof d !== 'string',
                    )
                    return (
                      <TableRow key={e._id}>
                        <MaestroSelectCell
                          id={e._id}
                          label={e.nombre}
                          selected={bulk.selectedIds.has(e._id)}
                          onToggle={bulk.toggle}
                        />
                        <TableCell className="font-mono text-sm">{e.codigo}</TableCell>
                        <TableCell className="font-medium">{e.nombre}</TableCell>
                        <TableCell className="text-sm">{e.puesto || '—'}</TableCell>
                        <TableCell>
                          <div className="grid gap-1">
                            {dept ? (
                              <div className="flex items-center gap-1.5">
                                <div className="size-2.5 rounded-full" style={{ background: dept.color ?? '#002060' }} />
                                <span className="text-sm">{dept.nombre}</span>
                              </div>
                            ) : (
                              <span className="text-sm">{e.departamento || '—'}</span>
                            )}
                            {deptosCargo.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {deptosCargo.map((d) => (
                                  <Badge
                                    key={d._id}
                                    variant="outline"
                                    className="text-[10px] font-normal"
                                    title="Departamento a cargo"
                                  >
                                    {d.codigo}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {empresaNombrePorId(empleadoEmpresaId(e, deptToEmpresaId), empresasCatalog)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{jefe?.nombre ?? '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{e.email || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={e.activo ? 'bg-[var(--lime-lt)] text-[var(--navy)]' : ''}>
                            {e.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                              <Edit2 className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(e)}>
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
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardContent className="p-0">
              <OrgChart empleados={displayed} selectedId={selectedId} onSelect={setSelectedId} />
            </CardContent>
          </Card>
          <OrgDetailPanel empleado={selected} />
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Código <span className="text-destructive">*</span></Label>
                <Input required disabled={Boolean(editing)} value={form.codigo} onChange={(e) => setF('codigo', e.target.value)} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Nombre completo <span className="text-destructive">*</span></Label>
                <Input required value={form.nombre} onChange={(e) => setF('nombre', e.target.value)} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Puesto</Label>
                <Input value={form.puesto} onChange={(e) => setF('puesto', e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Departamento</Label>
                <select className={selectClass} value={form.departamento_id} onChange={(e) => {
                  const id = e.target.value
                  setF('departamento_id', id)
                  const d = depts.find((x) => x._id === id)
                  if (d) setF('departamento', d.nombre)
                }}>
                  <option value="">— Sin departamento —</option>
                  {depts.map((d) => <option key={d._id} value={d._id}>{d.nombre}</option>)}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Reporta a (jefe)</Label>
                <select className={selectClass} value={form.jefe_id} onChange={(e) => setF('jefe_id', e.target.value)}>
                  <option value="">— Sin jefe —</option>
                  {list.filter((e) => !editing || e._id !== editing._id).map((e) => (
                    <option key={e._id} value={e._id}>{e.nombre} ({e.codigo})</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setF('email', e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input value={form.telefono} onChange={(e) => setF('telefono', e.target.value)} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>URL de foto (opcional)</Label>
                <Input value={form.foto_url} onChange={(e) => setF('foto_url', e.target.value)} placeholder="https://…" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="emp-activo" className="size-4 accent-[var(--lime)]" checked={form.activo} onChange={(e) => setF('activo', e.target.checked)} />
                <Label htmlFor="emp-activo">Activo</Label>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Departamentos a cargo</Label>
                <DepartamentosMultiSelect
                  departamentos={depts}
                  value={form.departamentos_a_cargo}
                  onChange={(v) => setF('departamentos_a_cargo', v)}
                />
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

      {/* External service config */}
      <Dialog open={cfgOpen} onOpenChange={setCfgOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Servicio externo de empleados</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Configura la URL de un servicio que devuelva la lista de empleados en formato JSON.
              Para RCJ se soporta el endpoint EHR con respuesta <code>data[]</code>.
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-xs">
{`{
  "data": [
  {
    "empleadoId": 1,
    "codigo": "1091",
    "nombre": "Keeydy Gissel",
    "apellido": "Betanco Izaguirre",
    "jefeInmediato": 257,
    "correo": "keeydy.betanco@rcjcorp.hn",
    "telefono": "9999-0000",
    "posicion": { "descripcion": "Jefe IT" },
    "activo": true
  }
  ]
}`}
            </pre>
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
              <p className="text-sm font-medium text-[var(--navy)]">Autenticación EHR</p>
              <p className="text-xs text-muted-foreground">
                El API del EHR requiere token Bearer. Inicia sesión una vez; el token se guarda en
                la base local y se reutiliza en empleados y empresas.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label>URL de login</Label>
                  <Input
                    value={loginUrl}
                    onChange={(e) => setLoginUrl(e.target.value)}
                    placeholder="https://ehr.rcjcorp.hn:8095/api/Login"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    RCJ EHR: <code className="rounded bg-muted px-1">/api/Login</code> con usuario y
                    contraseña del portal.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label>Usuario EHR</Label>
                  <Input
                    value={ehrUser}
                    onChange={(e) => setEhrUser(e.target.value)}
                    autoComplete="username"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Contraseña EHR</Label>
                  <Input
                    type="password"
                    value={ehrPassword}
                    onChange={(e) => setEhrPassword(e.target.value)}
                    placeholder={ehrAuth?.hasPassword ? '•••••• (guardada)' : ''}
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loginLoading || !ehrUser}
                  onClick={() => void handleEhrLogin()}
                >
                  {loginLoading ? 'Conectando…' : 'Iniciar sesión EHR'}
                </Button>
                {ehrAuth?.hasToken && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => void handleEhrLogout()}>
                    Cerrar sesión EHR
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">
                  {ehrAuth?.hasToken
                    ? `Token activo${ehrAuth.tokenExpiresAt ? ` hasta ${new Date(ehrAuth.tokenExpiresAt).toLocaleString('es-HN')}` : ''}`
                    : 'Sin token — recibirás 401 al sincronizar'}
                </span>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>URL del servicio (empleados)</Label>
              <Input value={serviceUrl} onChange={(e) => setServiceUrl(e.target.value)} placeholder="https://ehr.rcjcorp.hn:8095/api/Employee" />
            </div>
            {syncResult && (
              <p className={`rounded-md px-3 py-2 text-sm ${syncResult.startsWith('Error') ? 'bg-destructive/10 text-destructive' : 'bg-[var(--lime-lt)] text-[var(--navy)]'}`}>
                {syncResult}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Button variant="outline" className="gap-2" onClick={() => void handleSaveCfg()}>
                <Save className="size-4" /> Guardar configuración
              </Button>
              <Button
                disabled={syncing || !serviceUrl}
                className="gap-2 bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90"
                onClick={() => void handleSync()}
              >
                <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
              </Button>
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Settings2 className="size-3.5" /> Local
              </span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCfgOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar empleado</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar a <strong>{deleteTarget?.nombre}</strong>? Si tiene subordinados, quedarán sin jefe asignado.
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
