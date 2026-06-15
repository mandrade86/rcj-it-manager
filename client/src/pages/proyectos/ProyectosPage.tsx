import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, FolderKanban, Map, Plus, RotateCw, Trash2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchDepartamentos } from '@/lib/api/departamentos'
import { fetchEjesProyecto } from '@/lib/api/ejesProyecto'
import { fetchEmpresas } from '@/lib/api/empresas'
import {
  descargarPlantillaProyectos,
  importProyectosExcel,
} from '@/lib/api/proyectos'
import { fetchUsuarios } from '@/lib/api/usuarios'
import { applyMaestroList, type MaestroSortDir } from '@/lib/maestroList'
import {
  compareProyectos,
  PROYECTO_SORT_PRESETS,
  proyectoSearchTexts,
} from '@/lib/proyectosList'
import { ProyectosAlcanceBar } from '@/pages/proyectos/ProyectosAlcanceBar'
import { ProyectosFiltrosBar } from '@/pages/proyectos/ProyectosFiltrosBar'
import { ProyectosGantt } from '@/pages/proyectos/ProyectosGantt'
import { ProyectosRoadmap } from '@/pages/proyectos/ProyectosRoadmap'
import { ProyectosTabla } from '@/pages/proyectos/ProyectosTabla'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { usePagination } from '@/hooks/usePagination'
import { useAuthStore } from '@/store/authStore'
import { useProyectosStore } from '@/store/proyectosStore'
import type { DepartamentoDoc } from '@/types/departamento'
import type { EjeProyectoDoc } from '@/types/ejeProyecto'
import type { EmpresaDoc } from '@/types/empresa'
import type { Proyecto } from '@/types/proyecto'
import { participanteUsuarioId } from '@/types/proyecto'
import { deptFromUsuario } from '@/types/usuario'

export function ProyectosPage() {
  const navigate = useNavigate()
  const [searchParams, setSp] = useSearchParams()
  const detalle = searchParams.get('detalle')
  const {
    list, loading, error, filters, alcance,
    setFilters, setAlcance, setIdentidad,
    load, removeMany,
    miDepartamentoId,
  } = useProyectosStore()
  const user = useAuthStore((s) => s.user)
  const hasPermiso = useAuthStore((s) => s.hasPermiso)
  const puedeVerTodos = hasPermiso('proyectos:ver-todos')
  const puedeEliminar = hasPermiso('proyectos:editar')
  const puedeEditar = puedeEliminar

  const proyectosFileRef = useRef<HTMLInputElement>(null)
  const [importando, setImportando] = useState(false)

  const vistaFromUrl = searchParams.get('vista')
  const initialVista =
    vistaFromUrl === 'gantt' || vistaFromUrl === 'roadmap' ? vistaFromUrl : 'lista'
  const [vista, setVista] = useState<'lista' | 'gantt' | 'roadmap'>(initialVista)

  function setVistaConUrl(next: 'lista' | 'gantt' | 'roadmap') {
    setVista(next)
    setSp(
      (prev) => {
        const n = new URLSearchParams(prev)
        if (next === 'lista') n.delete('vista')
        else n.set('vista', next)
        return n
      },
      { replace: true },
    )
  }

  useEffect(() => {
    const v = searchParams.get('vista')
    if (v === 'gantt' || v === 'roadmap') setVista(v)
    else if (v === null || v === '') setVista('lista')
  }, [searchParams])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [departamentos, setDepartamentos] = useState<DepartamentoDoc[]>([])
  const [empresas, setEmpresas] = useState<EmpresaDoc[]>([])
  const [ejesMaestro, setEjesMaestro] = useState<EjeProyectoDoc[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [sortKey, setSortKey] = useState('nombre')
  const [sortDir, setSortDir] = useState<MaestroSortDir>('asc')

  /** Identidad + departamento: primero JWT (carga inmediata); luego maestro /usuarios si difiere. */
  useEffect(() => {
    if (!user) return
    if (puedeVerTodos) setAlcance('todos')
    const depJwt = user.departamento_id ?? null
    setIdentidad(user._id, depJwt)
    let cancel = false
    void (async () => {
      try {
        const [usrs, deps] = await Promise.all([
          fetchUsuarios().catch(() => []),
          fetchDepartamentos().catch(() => []),
        ])
        if (cancel) return
        setDepartamentos(deps)
        const me = usrs.find((u) => u._id === user._id)
        const depId = me ? deptFromUsuario(me)?._id ?? null : null
        const finalDep = depId ?? depJwt
        setIdentidad(user._id, finalDep)
      } catch {
        /* noop */
      }
    })()
    return () => { cancel = true }
  }, [user, puedeVerTodos, setIdentidad, setAlcance])

  useEffect(() => {
    if (!user) return
    let cancel = false
    void fetchEmpresas({ activo: true })
      .then((rows) => { if (!cancel) setEmpresas(rows) })
      .catch(() => { if (!cancel) setEmpresas([]) })
    return () => { cancel = true }
  }, [user])

  useEffect(() => {
    if (!user) return
    let cancel = false
    void fetchEjesProyecto({ activo: true })
      .then((rows) => { if (!cancel) setEjesMaestro(rows) })
      .catch(() => { if (!cancel) setEjesMaestro([]) })
    return () => { cancel = true }
  }, [user])

  useEffect(() => {
    void load()
  }, [
    load,
    alcance,
    miDepartamentoId,
    filters.fase,
    filters.eje,
    filters.estado,
    filters.prioridad,
    filters.tipo,
    filters.departamento_id,
    filters.empresa_id,
  ])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [
    alcance,
    filters.fase,
    filters.eje,
    filters.estado,
    filters.prioridad,
    filters.tipo,
    filters.departamento_id,
    filters.empresa_id,
  ])

  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(list.map((p) => p._id))
      const next = new Set([...prev].filter((id) => valid.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [list])

  useEffect(() => {
    if (!detalle) return
    navigate(`/proyectos/${encodeURIComponent(detalle)}`, { replace: true })
    setSp(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.delete('detalle')
        return n
      },
      { replace: true },
    )
  }, [detalle, navigate, setSp])

  function openDetail(p: Proyecto) {
    navigate(`/proyectos/${encodeURIComponent(p._id)}`)
  }

  function toggleSelectProject(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllVisible() {
    const ids = pageList.map((p) => p._id)
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((i) => prev.has(i))
      if (allSelected) return new Set()
      return new Set(ids)
    })
  }

  async function handleEliminarSeleccionados() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const ok = window.confirm(
      `¿Eliminar ${ids.length} proyecto(s)? Se borrarán también sus tareas y archivos adjuntos. Esta acción no se puede deshacer.`,
    )
    if (!ok) return
    setBulkDeleting(true)
    try {
      const r = await removeMany(ids)
      let msg = `Se eliminaron ${r.eliminados} proyecto(s).`
      if (r.omitidos.length > 0) {
        const slice = r.omitidos.slice(0, 12).join(', ')
        msg += `\n\nSin acceso o no encontrados (${r.omitidos.length}): ${slice}${r.omitidos.length > 12 ? '…' : ''}.`
      }
      window.alert(msg)
      setSelectedIds(new Set())
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo eliminar el lote')
    } finally {
      setBulkDeleting(false)
    }
  }

  const seleccionCount = selectedIds.size

  const departamentoNombre = useMemo(() => {
    if (!miDepartamentoId) return null
    return departamentos.find((d) => d._id === miDepartamentoId)?.nombre ?? null
  }, [miDepartamentoId, departamentos])

  const cuentas = useMemo(() => {
    const mias = list.filter((p) => {
      const u = p.usuario_id
      return typeof u === 'object' && u != null && u._id === user?._id
    }).length
    const depto = list.filter((p) => {
      const d = p.departamento_id
      return typeof d === 'object' && d != null && d._id === miDepartamentoId
    }).length
    const equipo = alcance === 'equipo' ? list.length : 0
    const participo = alcance === 'participo'
      ? list.length
      : list.filter((p) =>
        (p.participantes ?? []).some((part) => participanteUsuarioId(part) === user?._id),
      ).length
    return { mias, equipo, depto, participo, total: list.length }
  }, [list, user?._id, miDepartamentoId, alcance])

  const plantillaQuery = useMemo(() => {
    const q: Record<string, string | undefined> = {}
    if (alcance === 'equipo') q.scope = 'equipo'
    if (filters.fase) q.fase = filters.fase
    if (filters.eje) q.eje = filters.eje
    if (filters.estado) q.estado = filters.estado
    if (filters.prioridad) q.prioridad = filters.prioridad
    if (filters.tipo) q.tipo = filters.tipo
    if (filters.departamento_id) q.departamento_id = filters.departamento_id
    return q
  }, [alcance, filters])

  async function handleImportProyectos(file: File | undefined) {
    if (!file) return
    setImportando(true)
    try {
      const r = await importProyectosExcel(file)
      let msg = `Importación: ${r.creados} creados, ${r.actualizados} actualizados.`
      if (r.omitidos > 0) msg += ` ${r.omitidos} fila(s) omitida(s).`
      if (r.errores.length > 0) {
        msg += `\n\nErrores (máx. 30):\n${r.errores.map((e) => `Fila ${e.fila}: ${e.error}`).join('\n')}`
      }
      window.alert(msg)
      await load()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error al importar proyectos')
    } finally {
      setImportando(false)
      if (proyectosFileRef.current) proyectosFileRef.current.value = ''
    }
  }

  const ejesCatalogo = useMemo(() => {
    const fromMaestro = ejesMaestro
      .filter((e) => e.activo !== false)
      .map((e) => e.nombre.trim())
      .filter(Boolean)
    const fromDept = departamentos.flatMap((d) => d.ejes_proyecto ?? [])
    const fromProyectos = list.map((p) => p.eje?.trim()).filter(Boolean) as string[]
    return [...new Set([...fromMaestro, ...fromDept, ...fromProyectos])].sort((a, b) =>
      a.localeCompare(b),
    )
  }, [departamentos, ejesMaestro, list])

  const displayList = useMemo(
    () =>
      applyMaestroList({
        items: list,
        busqueda,
        searchTexts: proyectoSearchTexts,
        sortKey,
        sortDir,
        compare: compareProyectos,
      }),
    [list, busqueda, sortKey, sortDir],
  )

  const sortPresetId = useMemo(() => {
    const found = PROYECTO_SORT_PRESETS.find(
      (p) => p.sortKey === sortKey && p.sortDir === sortDir,
    )
    return found?.id ?? 'custom'
  }, [sortKey, sortDir])

  const onSort = useCallback((key: string, dir: MaestroSortDir) => {
    setSortKey(key)
    setSortDir(dir)
  }, [])

  const filtrosKey = `${alcance}|${filters.fase}|${filters.eje}|${filters.estado}|${filters.prioridad}|${filters.tipo}|${filters.departamento_id}|${filters.empresa_id}|${busqueda}|${sortKey}|${sortDir}`
  const pagination = usePagination(displayList.length, {
    resetKey: `${filtrosKey}|${displayList.length}`,
  })
  const pageList = pagination.slice(displayList)

  const emptyTablaMsg = busqueda.trim()
    ? 'Ningún proyecto coincide con la búsqueda.'
    : 'No hay proyectos con los filtros seleccionados.'

  const empresasOptions = useMemo(
    () =>
      empresas
        .slice()
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .map((e) => [e._id, `${e.codigo} — ${e.nombre}`] as [string, string]),
    [empresas],
  )

  const departamentosOptions = useMemo(
    () =>
      departamentos
        .slice()
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .map((d) => [d._id, `${d.codigo} — ${d.nombre}`] as [string, string]),
    [departamentos],
  )

  const alcanceContext = useMemo(() => {
    if (alcance === 'mis') {
      return (
        <>
          Proyectos donde <strong>{user?.nombre}</strong> es propietario.
        </>
      )
    }
    if (alcance === 'depto' && departamentoNombre) {
      return (
        <>
          Departamento <strong>{departamentoNombre}</strong>.
        </>
      )
    }
    if (alcance === 'equipo') {
      return <>Proyectos de tu equipo (subalternos directos e indirectos).</>
    }
    if (alcance === 'participo') {
      return <>Proyectos donde estás incluido como participante (lectura o editor).</>
    }
    if (alcance === 'depto' && !departamentoNombre) {
      return <>Sin departamento asignado en tu perfil.</>
    }
    if (alcance === 'todos' && puedeVerTodos) {
      return <>Vista global de la organización.</>
    }
    return <>Sin permiso para ver todos los proyectos.</>
  }, [alcance, user?.nombre, departamentoNombre, puedeVerTodos])

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Proyectos</h2>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Gestión del plan — use filtros solo cuando necesite acotar la lista.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={proyectosFileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => void handleImportProyectos(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            className="gap-1.5"
          >
            <RotateCw className="size-3.5" /> Actualizar
          </Button>
          {puedeEditar && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  void descargarPlantillaProyectos(plantillaQuery).catch((e) =>
                    window.alert(e instanceof Error ? e.message : 'Error al descargar'),
                  )
                }
              >
                <Download className="size-3.5" /> Plantilla Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={importando}
                onClick={() => proyectosFileRef.current?.click()}
              >
                <Upload className={`size-3.5 ${importando ? 'animate-pulse' : ''}`} />
                {importando ? 'Importando…' : 'Subir Excel'}
              </Button>
            </>
          )}
          <Button
            type="button"
            className="shrink-0 gap-1.5 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
            onClick={() => navigate('/proyectos/nuevo')}
          >
            <Plus className="size-4" />
            Nuevo proyecto
          </Button>
        </div>
      </div>

      <ProyectosAlcanceBar
        alcance={alcance}
        onAlcanceChange={(next) => {
          setAlcance(next)
          if (next !== 'todos') setFilters({ departamento_id: '' })
        }}
        cuentas={cuentas}
        puedeVerTodos={puedeVerTodos}
        miDepartamentoId={miDepartamentoId}
        contextLine={alcanceContext}
      />

      <ProyectosFiltrosBar
        filters={filters}
        setFilters={setFilters}
        busqueda={busqueda}
        setBusqueda={setBusqueda}
        sortPresetId={sortPresetId}
        onSortPreset={(id) => {
          const preset = PROYECTO_SORT_PRESETS.find((p) => p.id === id)
          if (preset) {
            setSortKey(preset.sortKey)
            setSortDir(preset.sortDir)
          }
        }}
        displayCount={displayList.length}
        totalCount={list.length}
        ejesCatalogo={ejesCatalogo}
        empresasOptions={empresasOptions}
        departamentosOptions={departamentosOptions}
        showDepartamentoFilter={puedeVerTodos && alcance === 'todos'}
      />

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs value={vista} onValueChange={(v) => setVistaConUrl(v as typeof vista)}>
        <TabsList className="inline-flex h-9 w-auto">
          <TabsTrigger value="lista" className="gap-1.5">
            <FolderKanban className="size-3.5" /> Lista
          </TabsTrigger>
          <TabsTrigger value="gantt">Gantt</TabsTrigger>
          <TabsTrigger value="roadmap" className="gap-1.5">
            <Map className="size-3.5" /> Roadmap
          </TabsTrigger>
        </TabsList>
        <TabsContent value="lista" className="mt-2">
          {puedeEliminar && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {seleccionCount === 0
                  ? 'Marca proyectos en la tabla para eliminarlos en lote.'
                  : `${seleccionCount} seleccionado(s).`}
              </span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-1.5"
                disabled={seleccionCount === 0 || bulkDeleting || loading}
                onClick={() => void handleEliminarSeleccionados()}
              >
                <Trash2 className="size-3.5" />
                {bulkDeleting ? 'Eliminando…' : 'Eliminar seleccionados'}
              </Button>
            </div>
          )}
          {loading && list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <>
            <ProyectosTabla
              rows={pageList}
              onRowClick={openDetail}
              miUsuarioId={user?._id}
              selectable={puedeEliminar}
              selectedIds={selectedIds}
              onToggleRow={toggleSelectProject}
              onToggleAll={toggleSelectAllVisible}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              emptyMessage={emptyTablaMsg}
            />
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
        </TabsContent>
        <TabsContent value="gantt" className="mt-2">
          {loading && list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <ProyectosGantt proyectos={displayList} onSelect={openDetail} />
          )}
        </TabsContent>
        <TabsContent value="roadmap" className="mt-2">
          {loading && list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <ProyectosRoadmap proyectos={displayList} onSelect={openDetail} />
          )}
        </TabsContent>
      </Tabs>

    </div>
  )
}
