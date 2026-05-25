import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BadgeCheck, Building2, CalendarDays, Crown, Edit2, Factory, FileText, Globe2, LayoutGrid, List, Network,
  Plus, RefreshCw, Search, Trash2, UserCircle, Users,
} from 'lucide-react'

import { DepartamentosMultiSelect } from '@/components/maestros/DepartamentosMultiSelect'

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
import { PaginationBar } from '@/components/ui/PaginationBar'
import { usePagination } from '@/hooks/usePagination'
import { fetchColaboradorPorEmpleado } from '@/lib/api/colaboradores'
import { fetchDepartamentos } from '@/lib/api/departamentos'
import { fetchEmpresas } from '@/lib/api/empresas'
import {
  createEmpleado, deleteEmpleado, fetchEmpleados, fetchMiEquipo, updateEmpleado,
  type MiEquipoResponse,
} from '@/lib/api/empleados'
import { fetchVacacionesResumen } from '@/lib/api/vacaciones'
import {
  buildDeptToEmpresaIdMap,
  empleadoEmpresaId,
  empresaNombrePorId,
} from '@/lib/deptoEmpresaFilter'
import { OrgChart, OrgDetailPanel, Avatar } from '@/pages/maestros/OrgChart'
import { useAuthStore } from '@/store/authStore'
import type { DepartamentoDoc } from '@/types/departamento'
import type { EmpleadoDoc } from '@/types/empleado'
import { departamentoIdsFromRefs } from '@/types/empleado'
import type { EmpresaDoc } from '@/types/empresa'
import type { VacacionesResumenItem } from '@/types/vacacion'
import { VacacionesDialog } from './VacacionesDialog'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

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
  fecha_ingreso: string
  departamentos_a_cargo: string[]
}

function emptyForm(): FormState {
  return {
    codigo: '', nombre: '', puesto: '', departamento_id: '', departamento: '',
    email: '', telefono: '', jefe_id: '', foto_url: '', activo: true, fecha_ingreso: '',
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
    fecha_ingreso: d.fecha_ingreso ? d.fecha_ingreso.slice(0, 10) : '',
    departamentos_a_cargo: departamentoIdsFromRefs(d.departamentos_a_cargo),
  }
}

export function EquipoPage() {
  const navigate = useNavigate()
  const hasPermiso = useAuthStore((s) => s.hasPermiso)
  const puedeEditar = hasPermiso('empleados:editar')
  const [openingPerfil, setOpeningPerfil] = useState<string | null>(null)

  const [data, setData] = useState<MiEquipoResponse | null>(null)
  const [todosEmpleados, setTodosEmpleados] = useState<EmpleadoDoc[]>([])
  const [depts, setDepts] = useState<DepartamentoDoc[]>([])
  const [empresasCatalog, setEmpresasCatalog] = useState<EmpresaDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [vista, setVista] = useState<Vista>('orgchart')
  const [busqueda, setBusqueda] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterEmpresa, setFilterEmpresa] = useState('')
  const [filterEstado, setFilterEstado] = useState<'activos' | 'inactivos' | 'todos'>('activos')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EmpleadoDoc | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<EmpleadoDoc | null>(null)

  const [vacResumen, setVacResumen] = useState<Record<string, VacacionesResumenItem>>({})
  const [vacEmpleadoId, setVacEmpleadoId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      if (puedeEditar) {
        const [me, dep, emp, todos] = await Promise.all([
          fetchMiEquipo(),
          fetchDepartamentos(),
          fetchEmpresas({ activo: true }),
          fetchEmpleados(),
        ])
        setData(me)
        setDepts(dep)
        setEmpresasCatalog(emp)
        setTodosEmpleados(todos)
      } else {
        const [me, dep, emp] = await Promise.all([
          fetchMiEquipo(),
          fetchDepartamentos(),
          fetchEmpresas({ activo: true }),
        ])
        setData(me)
        setDepts(dep)
        setEmpresasCatalog(emp)
        setTodosEmpleados(me.empleados)
      }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }, [puedeEditar])

  useEffect(() => { void reload() }, [reload])

  const recargarVacaciones = useCallback(async (empleadosList: EmpleadoDoc[]) => {
    if (empleadosList.length === 0) return
    try {
      const r = await fetchVacacionesResumen(empleadosList.map((e) => e._id))
      const map: Record<string, VacacionesResumenItem> = {}
      for (const item of r) map[item.empleado_id] = item
      setVacResumen(map)
    } catch {
      // Silencioso: si falla, simplemente no mostramos la columna
    }
  }, [])

  useEffect(() => {
    if (data?.empleados && data.empleados.length > 0) {
      void recargarVacaciones(data.empleados)
    }
  }, [data?.empleados, recargarVacaciones])

  const empleados = useMemo<EmpleadoDoc[]>(() => data?.empleados ?? [], [data])

  // Solo departamentos presentes en el scope
  const departamentosScope = useMemo(() => {
    const set = new Map<string, { _id: string; nombre: string; color?: string }>()
    for (const e of empleados) {
      const d = e.departamento_id && typeof e.departamento_id !== 'string' ? e.departamento_id : null
      if (d && !set.has(d._id)) set.set(d._id, d)
    }
    return [...set.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [empleados])

  const deptToEmpresaId = useMemo(() => buildDeptToEmpresaIdMap(depts), [depts])

  const empresasOpcionesFiltro = useMemo(() => {
    const ids = new Set<string>()
    for (const e of empleados) {
      const eid = empleadoEmpresaId(e, deptToEmpresaId)
      if (eid) ids.add(eid)
    }
    return empresasCatalog
      .filter((em) => ids.has(em._id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [empleados, deptToEmpresaId, empresasCatalog])

  const filtrados = useMemo(() => {
    return empleados.filter((e) => {
      if (filterEstado === 'activos' && e.activo === false) return false
      if (filterEstado === 'inactivos' && e.activo !== false) return false
      if (filterDept) {
        const d = e.departamento_id && typeof e.departamento_id !== 'string' ? e.departamento_id : null
        if (d?._id !== filterDept) return false
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
  }, [empleados, filterDept, filterEmpresa, filterEstado, busqueda, deptToEmpresaId])

  const pagination = usePagination(filtrados.length, {
    resetKey: `${filterDept}|${filterEmpresa}|${filterEstado}|${busqueda}|${empleados.length}`,
  })
  const pageFiltrados = pagination.slice(filtrados)

  const selected = useMemo(
    () => filtrados.find((e) => e._id === selectedId) ?? null,
    [filtrados, selectedId],
  )

  const scopeAll = data?.scope === 'all'
  const rootIdSet = useMemo(() => new Set(data?.rootIds ?? []), [data?.rootIds])
  const myEmpleado = useMemo(() => {
    if (!data?.myEmpleadoId) return null
    return empleados.find((e) => e._id === data.myEmpleadoId) ?? null
  }, [data?.myEmpleadoId, empleados])

  function openNew() {
    if (!puedeEditar) return
    setEditing(null); setForm(emptyForm()); setFormOpen(true)
  }
  function openEdit(d: EmpleadoDoc) {
    if (!puedeEditar) return
    setEditing(d); setForm(fromDoc(d)); setFormOpen(true)
  }
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
        fecha_ingreso: form.fecha_ingreso || null,
        departamentos_a_cargo: form.departamentos_a_cargo,
      }
      if (editing) await updateEmpleado(editing._id, payload)
      else await createEmpleado(payload)
      setFormOpen(false)
      await reload()
    } catch (ex) { window.alert(ex instanceof Error ? ex.message : 'Error') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try { await deleteEmpleado(deleteTarget._id); setDeleteTarget(null); await reload() }
    catch (ex) { window.alert(ex instanceof Error ? ex.message : 'Error') }
  }

  /**
   * Abre el perfil completo del empleado (con sus pestañas de descriptor de
   * puesto, evaluaciones, plan de carrera y capacitaciones). El backend
   * encuentra/auto-crea un Colaborador vinculado al empleado.
   */
  async function abrirPerfilCompleto(empleadoId: string) {
    setOpeningPerfil(empleadoId)
    try {
      const colab = await fetchColaboradorPorEmpleado(empleadoId)
      navigate(`/equipo/${colab._id}`)
    } catch (ex) {
      window.alert(ex instanceof Error ? ex.message : 'No se pudo abrir el perfil')
    } finally {
      setOpeningPerfil(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Mi Equipo</h2>
            {data && (
              <Badge
                variant="secondary"
                className={scopeAll
                  ? 'gap-1.5 bg-red-50 text-red-700'
                  : 'gap-1.5 bg-[var(--blue-lt)] text-[var(--navy)]'}
              >
                {scopeAll ? <Globe2 className="size-3" /> : <Users className="size-3" />}
                {scopeAll ? 'Vista completa' : 'Solo mi alcance'}
                <span className="ml-1 rounded bg-white/60 px-1.5 py-0 text-xs font-semibold">
                  {data.total}
                </span>
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {scopeAll
              ? 'Vista administradora — organigrama completo de la empresa, basado en el maestro de empleados.'
              : 'Tus reportes directos, las subjefaturas dentro de tu departamento y toda la estructura bajo tu cargo.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void reload()}>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </Button>
          {puedeEditar && (
            <Button onClick={openNew} className="gap-2 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90">
              <Plus className="size-4" /> Nuevo empleado
            </Button>
          )}
        </div>
      </div>

      {/* Banner de identidad */}
      {data && !scopeAll && (
        myEmpleado ? (
          <div className="flex items-center gap-3 rounded-lg border border-[var(--lime)]/40 bg-[var(--lime-lt)]/40 p-3">
            <BadgeCheck className="size-5 text-[var(--navy)]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                Estás identificado como <strong>{myEmpleado.nombre}</strong>
                <span className="ml-1 font-mono text-xs text-muted-foreground">({myEmpleado.codigo})</span>
                {myEmpleado.puesto && (
                  <span className="ml-1 text-muted-foreground">· {myEmpleado.puesto}</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                El sistema descubrió automáticamente tu equipo a partir de la jerarquía de jefes inmediatos.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <UserCircle className="size-5 text-amber-700" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-amber-900">
                Tu usuario no está amarrado a un empleado.
              </p>
              <p className="text-xs text-amber-800">
                Pide a un administrador que vincule tu número de empleado en
                <code className="mx-1 rounded bg-white px-1">Administración → Usuarios</code>
                para que el organigrama te reconozca como nodo "Tú" y descubra tu equipo automáticamente.
              </p>
            </div>
          </div>
        )
      )}

      {/* Desglose del alcance — solo cuando no es vista completa */}
      {data && !scopeAll && data.total > 0 && (
        <div className={`grid gap-3 ${data.porDepartamentoCount > 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <Crown className="size-3.5 text-[var(--navy)]" /> Tus directos
            </div>
            <p className="mt-1 text-2xl font-semibold text-[var(--navy)]">{data.directosCount}</p>
            <p className="text-xs text-muted-foreground">Personas que te reportan directamente o que asignaste en tu usuario.</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <Network className="size-3.5 text-[var(--navy)]" /> Subordinados
            </div>
            <p className="mt-1 text-2xl font-semibold text-[var(--navy)]">{data.subordinadosCount}</p>
            <p className="text-xs text-muted-foreground">Equipos de tus subjefaturas (todos los niveles bajo tu rama).</p>
          </div>
          {data.porDepartamentoCount > 0 && (
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <Building2 className="size-3.5 text-[var(--navy)]" /> Por departamento
              </div>
              <p className="mt-1 text-2xl font-semibold text-[var(--navy)]">{data.porDepartamentoCount}</p>
              <p className="text-xs text-muted-foreground">
                Activos en los departamentos que tienes marcados como a cargo en tu ficha de empleado.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Buscar</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 w-[240px] pl-8"
                placeholder="Nombre, puesto, código…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>
          {departamentosScope.length > 0 && (
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
                {departamentosScope.map((d) => <option key={d._id} value={d._id}>{d.nombre}</option>)}
              </select>
            </div>
          )}
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
          <span className="self-end pb-2 text-sm text-muted-foreground">
            {filtrados.length} empleado(s)
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-md border bg-background p-1">
          <Button
            type="button"
            variant={vista === 'tabla' ? 'default' : 'ghost'}
            size="sm"
            className={vista === 'tabla' ? 'gap-1.5 bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90' : 'gap-1.5'}
            onClick={() => setVista('tabla')}
          >
            <List className="size-4" /> Tabla
          </Button>
          <Button
            type="button"
            variant={vista === 'orgchart' ? 'default' : 'ghost'}
            size="sm"
            className={vista === 'orgchart' ? 'gap-1.5 bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90' : 'gap-1.5'}
            onClick={() => setVista('orgchart')}
          >
            <LayoutGrid className="size-4" /> Organigrama
          </Button>
        </div>
      </div>

      {err && <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

      {!loading && empleados.length === 0 && !err && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Building2 className="size-10 text-muted-foreground" />
            <p className="font-medium">No tienes empleados asignados</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Pídele a un administrador que vincule empleados a tu cuenta desde
              <code className="mx-1 rounded bg-muted px-1">Administración → Usuarios</code>
              para poder visualizar y dar mantenimiento a tu equipo.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && filtrados.length > 0 && vista === 'tabla' && (
        <Card>
          <CardContent className="p-0">
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Puesto</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Reporta a</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-[150px]">Vacaciones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageFiltrados.map((e) => {
                  const dept = e.departamento_id && typeof e.departamento_id !== 'string' ? e.departamento_id : null
                  const jefe = e.jefe_id && typeof e.jefe_id !== 'string' ? e.jefe_id : null
                  return (
                    <TableRow key={e._id}>
                      <TableCell>
                        <Avatar nombre={e.nombre} fotoUrl={e.foto_url} bg={dept?.color} size="sm" />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{e.codigo}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          <span>{e.nombre}</span>
                          {data?.myEmpleadoId === e._id ? (
                            <Badge variant="secondary" className="gap-1 bg-[var(--lime)] py-0 text-[10px] text-[var(--navy)]">
                              <BadgeCheck className="size-2.5" /> Tú
                            </Badge>
                          ) : rootIdSet.has(e._id) && (
                            <Badge variant="secondary" className="gap-1 bg-[var(--navy)] py-0 text-[10px] text-white">
                              <Crown className="size-2.5" /> Directo
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{e.puesto || '—'}</TableCell>
                        <TableCell>
                          {dept ? (
                            <div className="flex items-center gap-1.5">
                              <div className="size-2.5 rounded-full" style={{ background: dept.color ?? '#002060' }} />
                              <span className="text-sm">{dept.nombre}</span>
                            </div>
                          ) : (e.departamento || '—')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {empresaNombrePorId(empleadoEmpresaId(e, deptToEmpresaId), empresasCatalog)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{jefe?.nombre ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.email || '—'}</TableCell>
                      <TableCell>
                        {(() => {
                          const v = vacResumen[e._id]
                          if (!e.fecha_ingreso) {
                            return (
                              <span className="text-xs text-amber-700">
                                Sin fecha de ingreso
                              </span>
                            )
                          }
                          if (!v) return <span className="text-xs text-muted-foreground">—</span>
                          const disponibles = v.diasDisponibles
                          const baja = disponibles <= 0
                          const alta = disponibles >= 10
                          return (
                            <button
                              type="button"
                              className="flex flex-col items-start text-left transition hover:bg-muted/50 rounded px-1.5 py-0.5"
                              onClick={() => setVacEmpleadoId(e._id)}
                              title="Ver detalle de vacaciones"
                            >
                              <span
                                className={
                                  'text-sm font-semibold tabular-nums ' +
                                  (baja
                                    ? 'text-red-700'
                                    : alta
                                      ? 'text-[var(--lime)]'
                                      : 'text-[var(--navy)]')
                                }
                              >
                                {disponibles} {disponibles === 1 ? 'día' : 'días'}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {v.aniosServicio} año(s) · gozados {v.diasGozados}
                              </span>
                            </button>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={e.activo ? 'bg-[var(--lime-lt)] text-[var(--navy)]' : ''}>
                          {e.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            disabled={openingPerfil === e._id}
                            onClick={() => void abrirPerfilCompleto(e._id)}
                            title="Ver perfil completo (descriptor, evaluaciones, plan de carrera, capacitaciones)"
                          >
                            <FileText className="size-3.5" />
                            {openingPerfil === e._id ? 'Abriendo…' : 'Perfil'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setVacEmpleadoId(e._id)}
                            title="Vacaciones (Honduras)"
                          >
                            <CalendarDays className="size-4 text-[var(--navy)]" />
                          </Button>
                          {puedeEditar && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(e)} title="Editar empleado">
                                <Edit2 className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                                title="Eliminar empleado"
                                onClick={() => setDeleteTarget(e)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
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
          </CardContent>
        </Card>
      )}

      {!loading && filtrados.length > 0 && vista === 'orgchart' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardContent className="p-0">
              <OrgChart
                empleados={filtrados}
                selectedId={selectedId}
                onSelect={setSelectedId}
                forcedRootIds={data?.rootIds}
                myEmpleadoId={data?.myEmpleadoId}
              />
            </CardContent>
          </Card>
          <div className="space-y-2">
            <OrgDetailPanel empleado={selected} />
            {selected && (
              <Button
                size="sm"
                className="w-full gap-1.5 bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90"
                disabled={openingPerfil === selected._id}
                onClick={() => void abrirPerfilCompleto(selected._id)}
              >
                <FileText className="size-3.5" />
                {openingPerfil === selected._id ? 'Abriendo…' : 'Ver perfil completo'}
              </Button>
            )}
            {selected && puedeEditar && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => openEdit(selected)}>
                  <Edit2 className="size-3.5" /> Editar
                </Button>
                <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(selected)}>
                  <Trash2 className="size-3.5" /> Eliminar
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
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
                  {todosEmpleados
                    .filter((e) => !editing || e._id !== editing._id)
                    .map((e) => <option key={e._id} value={e._id}>{e.nombre} ({e.codigo})</option>)}
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
                <Label>Fecha de ingreso</Label>
                <Input
                  type="date"
                  value={form.fecha_ingreso}
                  onChange={(e) => setF('fecha_ingreso', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Necesaria para calcular vacaciones según la Ley HN (Art. 346).
                </p>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>URL de foto (opcional)</Label>
                <Input value={form.foto_url} onChange={(e) => setF('foto_url', e.target.value)} placeholder="https://…" />
                <p className="text-xs text-muted-foreground">
                  Si no hay foto disponible, en el organigrama se mostrarán las iniciales del nombre.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="eq-activo" className="size-4 accent-[var(--lime)]" checked={form.activo} onChange={(e) => setF('activo', e.target.checked)} />
                <Label htmlFor="eq-activo">Activo</Label>
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
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90">
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
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

      <VacacionesDialog
        open={Boolean(vacEmpleadoId)}
        empleadoId={vacEmpleadoId}
        onClose={() => setVacEmpleadoId(null)}
        onChanged={() => {
          if (data?.empleados) void recargarVacaciones(data.empleados)
        }}
      />
    </div>
  )
}
