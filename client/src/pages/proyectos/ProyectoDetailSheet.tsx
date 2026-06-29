import { useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Building2, Download, Factory, FileUp, GanttChartSquare, GitBranch, History,
  LayoutGrid, List, Lock, Paperclip, Pencil, Plus, Trash2, User, Users,
} from 'lucide-react'

import { MaestroBulkDeleteBar } from '@/components/maestros/MaestroBulkDeleteBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  fetchProyecto, transicionarProyecto,
} from '@/lib/api/proyectos'
import {
  createTarea,
  deleteAdjuntoTarea,
  deleteTarea,
  deleteTareasLote,
  descargarPlantillaTareas,
  fetchAdjuntosTarea,
  fetchTareas,
  importTareasExcel,
  addComentarioTarea,
  updateTarea,
  uploadAdjuntoTarea,
  urlAdjuntoTarea,
} from '@/lib/api/tareas'
import { formatDateDMY } from '@/lib/format'
import {
  dependeDeIds,
  etiquetaSaludTarea,
  evaluarSaludTarea,
  mapaTareas,
  nombresPredecesoras,
  tareaBloqueadaPorDependencias,
} from '@/lib/tareaDependencias'
import { cn } from '@/lib/utils'
import { useMaestroSeleccion } from '@/hooks/useMaestroSeleccion'
import { TareaDetalleSheet } from '@/pages/proyectos/TareaDetalleSheet'
import { TareaFormDialog } from '@/pages/proyectos/TareaFormDialog'
import { ProyectoParticipantesPanel } from '@/pages/proyectos/ProyectoParticipantesPanel'
import { TareasPanel } from '@/pages/proyectos/TareasPanel'
import { TareasMiniGantt } from '@/pages/proyectos/TareasMiniGantt'
import { useAuthStore } from '@/store/authStore'
import { useProyectosStore } from '@/store/proyectosStore'
import type { Proyecto, ProyectoEstado } from '@/types/proyecto'
import {
  estadoColor, proyectoDeptDoc, proyectoEmpresasDocs, proyectoKpiDoc, proyectoOwnerName,
  proyectoPuedeEditar, PROYECTO_ESTADOS, TRANSICIONES_SUGERIDAS,
} from '@/types/proyecto'
import type { Tarea, TareaAdjunto } from '@/types/tarea'

type Props = {
  proyectoId: string | null
  onBack: () => void
  onProyectoUpdated: () => void
}

export function ProyectoDetailView({
  proyectoId,
  onBack,
  onProyectoUpdated,
}: Props) {
  const navigate = useNavigate()
  const [proyecto, setProyecto] = useState<Proyecto | null>(null)
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [busyTareaId, setBusyTareaId] = useState<string | null>(null)
  const [tareaFormOpen, setTareaFormOpen] = useState(false)
  const [tareaEditing, setTareaEditing] = useState<Tarea | null>(null)
  const [importingTareas, setImportingTareas] = useState(false)
  const tareasFileRef = useRef<HTMLInputElement | null>(null)
  const [adjuntosTareaId, setAdjuntosTareaId] = useState<string | null>(null)
  const [deletingProyecto, setDeletingProyecto] = useState(false)
  const [bulkDeletingTareas, setBulkDeletingTareas] = useState(false)
  const [tareaDetalle, setTareaDetalle] = useState<Tarea | null>(null)
  const [seccion, setSeccion] = useState<'resumen' | 'participantes' | 'tareas'>('resumen')

  const tareaIds = useMemo(() => tareas.map((t) => t._id), [tareas])
  const mapaTareasProyecto = useMemo(() => mapaTareas(tareas), [tareas])
  const seleccionTareas = useMaestroSeleccion(tareaIds)

  const puedeEliminarProyecto = useAuthStore((s) => s.hasPermiso('proyectos:editar'))
  const puedeEditarProyecto = proyecto ? proyectoPuedeEditar(proyecto) : false

  const reload = useCallback(async () => {
    if (!proyectoId) return
    const [p, ts] = await Promise.all([
      fetchProyecto(proyectoId),
      fetchTareas(proyectoId),
    ])
    setProyecto(p)
    setTareas(ts)
    onProyectoUpdated()
  }, [proyectoId, onProyectoUpdated])

  useEffect(() => {
    if (!proyectoId) return
    let cancel = false
    void (async () => {
      try {
        const [p, ts] = await Promise.all([
          fetchProyecto(proyectoId),
          fetchTareas(proyectoId),
        ])
        if (!cancel) {
          setProyecto(p)
          setTareas(ts)
          setLoadErr(null)
        }
      } catch (e) {
        if (!cancel) {
          setLoadErr(e instanceof Error ? e.message : 'Error al cargar')
          setProyecto(null)
          setTareas([])
        }
      }
    })()
    return () => {
      cancel = true
    }
  }, [proyectoId])

  async function handleDeleteProyecto() {
    if (!proyecto) return
    if (
      !window.confirm(
        `¿Eliminar permanentemente el proyecto «${proyecto.nombre}» (${proyecto._id})?\n\n`
        + 'Se eliminarán también todas sus tareas y los archivos adjuntos de esas tareas. '
        + 'Esta acción no se puede deshacer.',
      )
    ) {
      return
    }
    setDeletingProyecto(true)
    try {
      await useProyectosStore.getState().remove(proyecto._id)
      onProyectoUpdated()
      onBack()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error al eliminar el proyecto')
    } finally {
      setDeletingProyecto(false)
    }
  }

  async function handleToggleTarea(t: Tarea, completado: boolean) {
    setBusyTareaId(t._id)
    try {
      await updateTarea(t._id, {
        estado: completado ? 'Completado' : 'Pendiente',
        porcentaje: completado ? 100 : 0,
      })
      await reload()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusyTareaId(null)
    }
  }

  async function handleDeleteTarea(t: Tarea) {
    if (!window.confirm(`¿Eliminar la tarea «${t.nombre}»?`)) return
    try {
      await deleteTarea(t._id)
      await reload()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error')
    }
  }

  async function handleEliminarTareasSeleccionadas() {
    if (!proyecto) return
    const ids = [...seleccionTareas.selectedIds]
    if (ids.length === 0) return
    if (
      !window.confirm(
        `¿Eliminar ${ids.length} tarea(s)? También se borrarán sus archivos adjuntos. Esta acción no se puede deshacer.`,
      )
    ) {
      return
    }
    setBulkDeletingTareas(true)
    try {
      const r = await deleteTareasLote(ids, proyecto._id)
      let msg = `Se eliminaron ${r.eliminados} tarea(s).`
      if (r.omitidos.length > 0) {
        msg += `\n\nNo encontradas (${r.omitidos.length}): ${r.omitidos.slice(0, 8).join(', ')}${r.omitidos.length > 8 ? '…' : ''}.`
      }
      window.alert(msg)
      seleccionTareas.clear()
      await reload()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo eliminar el lote')
    } finally {
      setBulkDeletingTareas(false)
    }
  }

  async function handleImportTareas(file: File | null | undefined) {
    if (!file || !proyecto) return
    setImportingTareas(true)
    try {
      const r = await importTareasExcel(proyecto._id, file)
      await reload()
      const errores = r.errores.length
        ? `\n\nPrimeros errores:\n${r.errores.map((e) => `Fila ${e.fila}: ${e.error}`).join('\n')}`
        : ''
      window.alert(
        `Importación finalizada desde la hoja "${r.hoja}".\n` +
        `Creadas: ${r.creadas}\n` +
        `Actualizadas: ${r.actualizadas}\n` +
        `Omitidas: ${r.omitidas}${errores}`,
      )
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error al importar tareas')
    } finally {
      setImportingTareas(false)
      if (tareasFileRef.current) tareasFileRef.current.value = ''
    }
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-5xl flex-col pb-10">
        <header className="sticky top-0 z-10 -mx-6 mb-6 border-b border-border bg-[var(--gray-bg)] px-6 py-4 lg:top-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onBack}>
              <ArrowLeft className="size-4" />
              Volver a proyectos
            </Button>
          </div>
          {!proyectoId || loadErr ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {loadErr ?? 'No se pudo cargar el proyecto.'}
            </div>
          ) : !proyecto ? (
            <p className="text-sm text-muted-foreground">Cargando proyecto…</p>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <h1 className="text-xl font-semibold leading-tight text-[var(--navy)]">{proyecto.nombre}</h1>
                <p className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
                  <span>{proyecto._id}</span>
                  {proyecto.fase != null && <span>· Fase {proyecto.fase}</span>}
                  {proyecto.eje && <span>· {proyecto.eje}</span>}
                  <Badge variant="outline" className="text-[10px] font-sans">
                    {proyecto.tipo === 'departamental' ? 'Departamental' : 'Individual'}
                  </Badge>
                  <Badge variant="outline" className={cn('text-[10px] font-sans', estadoColor(proyecto.estado))}>
                    {proyecto.estado}
                  </Badge>
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {proyecto.acceso?.rol_participante === 'lectura' && (
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <Lock className="size-3" />
                    Participante · solo lectura
                  </Badge>
                )}
                {puedeEditarProyecto && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/proyectos/${encodeURIComponent(proyecto._id)}/editar`)}
                  >
                    Editar proyecto
                  </Button>
                )}
                {puedeEliminarProyecto && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    disabled={deletingProyecto}
                    onClick={() => void handleDeleteProyecto()}
                  >
                    {deletingProyecto ? 'Eliminando…' : 'Eliminar proyecto'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </header>

        {proyecto && (
          <div className="space-y-6">
            <Tabs value={seccion} onValueChange={(v) => setSeccion(v as typeof seccion)} className="w-full">
              <TabsList className="mb-2">
                <TabsTrigger value="resumen">Resumen</TabsTrigger>
                <TabsTrigger value="participantes" className="gap-1.5">
                  <Users className="size-3.5" />
                  Participantes
                  {(proyecto.participantes?.length ?? 0) > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                      {proyecto.participantes!.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="tareas">Tareas</TabsTrigger>
              </TabsList>

              <TabsContent value="resumen" className="mt-0 space-y-6">
                  <section className="grid gap-2 rounded-md border border-border bg-muted/20 p-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Propietario</p>
                      <p className="font-medium inline-flex items-center gap-1">
                        <User className="size-3.5 text-muted-foreground" />
                        {proyectoOwnerName(proyecto) || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Departamento</p>
                      <p className="font-medium inline-flex items-center gap-1">
                        {(() => {
                          const d = proyectoDeptDoc(proyecto)
                          if (!d) return <span>—</span>
                          return (
                            <>
                              <span
                                className="size-2.5 rounded-full"
                                style={{ background: d.color ?? '#002060' }}
                              />
                              <Building2 className="size-3.5 text-muted-foreground" />
                              {d.nombre}
                            </>
                          )
                        })()}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground">Empresas del grupo</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {proyectoEmpresasDocs(proyecto).length === 0 ? (
                          <span className="font-medium text-muted-foreground">—</span>
                        ) : (
                          proyectoEmpresasDocs(proyecto).map((e) => (
                            <Badge
                              key={e._id}
                              variant="outline"
                              className="gap-1 text-[10px]"
                            >
                              <Factory className="size-3 text-muted-foreground" />
                              {e.nombre}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Responsable (texto)</p>
                      <p className="font-medium">{proyecto.responsable ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Prioridad</p>
                      <p className="font-medium">{proyecto.prioridad}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Inicio</p>
                      <p className="font-medium">{formatDateDMY(proyecto.fecha_inicio)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fin</p>
                      <p className="font-medium">{formatDateDMY(proyecto.fecha_fin)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avance (tareas)</p>
                      <p className="font-medium">{proyecto.porcentaje_avance}%</p>
                    </div>
                  </section>

                  {/* Workflow del proyecto */}
                  <section className="rounded-md border border-[var(--lime)]/30 bg-[var(--lime-lt)]/30 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <ArrowRight className="size-4 text-[var(--navy)]" />
                      <h3 className="text-sm font-semibold text-[var(--navy)]">Flujo del proyecto</h3>
                    </div>
                    <FlujoEstado
                      estadoActual={proyecto.estado}
                      soloLectura={!puedeEditarProyecto}
                      onTransicionar={async (a, comentario) => {
                        try {
                          const doc = await transicionarProyecto(proyecto._id, a, comentario)
                          setProyecto(doc)
                          onProyectoUpdated()
                        } catch (err) {
                          window.alert(err instanceof Error ? err.message : 'Error en transición')
                        }
                      }}
                    />
                  </section>

                  {proyecto.descripcion && (
                    <section>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        Descripción
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{proyecto.descripcion}</p>
                    </section>
                  )}

                  <section>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      KPI / Meta
                    </p>
                    {(() => {
                      const k = proyectoKpiDoc(proyecto)
                      if (k) {
                        return (
                          <div className="mt-2 space-y-1.5 text-sm">
                            <p>
                              <span className="text-muted-foreground">KPI: </span>
                              <span className="font-medium">{k.nombre}</span>
                            </p>
                            <p>
                              <span className="text-muted-foreground">Eje: </span>
                              {k.eje}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Meta (departamento): </span>
                              {k.meta ?? '—'}
                              {k.unidad ? ` (${k.unidad})` : ''}
                            </p>
                            {proyecto.meta_kpi && proyecto.meta_kpi !== k.meta && (
                              <p className="text-xs text-muted-foreground">
                                Texto en proyecto: {proyecto.meta_kpi}
                              </p>
                            )}
                          </div>
                        )
                      }
                      return (
                        <p className="mt-1 text-sm">{proyecto.meta_kpi ?? '—'}</p>
                      )
                    })()}
                    {proyecto.notas && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {proyecto.notas}
                      </p>
                    )}
                  </section>

                  <section>
                    <div className="mb-2 flex items-center gap-2">
                      <History className="size-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Historial de estado</h3>
                    </div>
                    <ul className="space-y-2">
                      {(proyecto.historial ?? []).slice().reverse().map((h, idx) => (
                        <li key={idx} className="rounded-md border border-border bg-muted/10 p-2 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="inline-flex items-center gap-1.5">
                              {h.de ? (
                                <>
                                  <Badge variant="outline" className={cn('text-[10px]', estadoColor(h.de as ProyectoEstado))}>{h.de}</Badge>
                                  <ArrowRight className="size-3 text-muted-foreground" />
                                </>
                              ) : <Badge variant="outline" className="text-[10px]">Creación</Badge>}
                              <Badge variant="outline" className={cn('text-[10px]', estadoColor(h.a as ProyectoEstado))}>{h.a}</Badge>
                            </div>
                            <span className="text-muted-foreground">
                              {formatDateDMY(h.fecha)}
                            </span>
                          </div>
                          {h.usuario_nombre && (
                            <p className="mt-1 text-muted-foreground">
                              por <strong>{h.usuario_nombre}</strong>
                            </p>
                          )}
                          {h.comentario && (
                            <p className="mt-1 italic text-muted-foreground">«{h.comentario}»</p>
                          )}
                        </li>
                      ))}
                      {(!proyecto.historial || proyecto.historial.length === 0) && (
                        <li className="text-xs text-muted-foreground">Sin historial registrado.</li>
                      )}
                    </ul>
                  </section>

              </TabsContent>

              <TabsContent value="participantes" className="mt-0">
                <ProyectoParticipantesPanel
                  proyecto={proyecto}
                  onUpdated={(doc) => {
                    setProyecto(doc)
                    onProyectoUpdated()
                  }}
                />
              </TabsContent>

              <TabsContent value="tareas" className="mt-0 space-y-6">
                  <section>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">Tareas</h3>
                      {puedeEditarProyecto && (
                      <div className="flex flex-wrap gap-2">
                        <input
                          ref={tareasFileRef}
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          onChange={(e) => void handleImportTareas(e.target.files?.[0])}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={async () => {
                            try {
                              await descargarPlantillaTareas(proyecto._id)
                            } catch (e) {
                              window.alert(e instanceof Error ? e.message : 'Error al descargar plantilla')
                            }
                          }}
                        >
                          <Download className="size-4" />
                          Plantilla Excel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={importingTareas}
                          onClick={() => tareasFileRef.current?.click()}
                        >
                          <FileUp className="size-4" />
                          {importingTareas ? 'Importando…' : 'Subir Excel'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
                          onClick={() => {
                            setTareaEditing(null)
                            setTareaFormOpen(true)
                          }}
                        >
                          <Plus className="size-4" />
                          Agregar tarea
                        </Button>
                      </div>
                      )}
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      El <strong>KPI / meta</strong> del proyecto está arriba en «KPI / Meta»; no se repite por tarea.
                      En <strong>Canvas</strong> usa el tablero To Do / In Progress / Done (arrastrar solo dueño o responsable). Al editar puedes indicar
                      de cuáles depende (deben completarse antes). Usa <strong>Adjuntos</strong> para evidencias.
                    </p>

                    <Tabs defaultValue="lista" className="w-full">
                      <TabsList className="mb-3">
                        <TabsTrigger value="lista" className="gap-1.5">
                          <List className="size-3.5" />
                          Lista
                        </TabsTrigger>
                        <TabsTrigger value="panel" className="gap-1.5">
                          <LayoutGrid className="size-3.5" />
                          Canvas
                        </TabsTrigger>
                        <TabsTrigger value="gantt" className="gap-1.5">
                          <GanttChartSquare className="size-3.5" />
                          Gantt
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="lista" className="mt-0">
                    {tareas.length > 0 && puedeEditarProyecto && (
                      <MaestroBulkDeleteBar
                        seleccionCount={seleccionTareas.seleccionCount}
                        bulkDeleting={bulkDeletingTareas}
                        etiqueta="tareas en la lista"
                        onEliminar={() => void handleEliminarTareasSeleccionadas()}
                      />
                    )}
                    {tareas.length > 0 && puedeEditarProyecto && (
                      <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          className="size-3.5 accent-[var(--navy)]"
                          checked={seleccionTareas.allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = seleccionTareas.someSelected && !seleccionTareas.allSelected
                          }}
                          onChange={() => seleccionTareas.toggleAll()}
                          aria-label="Seleccionar todas las tareas"
                        />
                        Seleccionar todas para eliminar en lote
                      </label>
                    )}
                    <ul className="space-y-3">
                      {tareas.map((t) => {
                        const preds = nombresPredecesoras(t, mapaTareasProyecto)
                        const bloqueada = tareaBloqueadaPorDependencias(t, mapaTareasProyecto)
                        const depN = dependeDeIds(t).length
                        const salud = evaluarSaludTarea(t, mapaTareasProyecto)
                        const etiquetaSalud = etiquetaSaludTarea(salud)
                        return (
                        <li
                          key={t._id}
                          className={cn(
                            'flex flex-wrap items-start gap-3 rounded-md border bg-muted/20 p-3',
                            seleccionTareas.selectedIds.has(t._id) && 'ring-1 ring-[var(--navy)]/30',
                            salud === 'atrasada' && 'border-red-500 bg-red-50/90',
                            salud === 'en_riesgo' && 'border-red-400 bg-red-50/50',
                            salud === 'ok' && 'border-border',
                            bloqueada && salud === 'ok' && 'border-amber-200/80',
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 size-4 accent-[var(--navy)]"
                            checked={seleccionTareas.selectedIds.has(t._id)}
                            onChange={() => seleccionTareas.toggle(t._id)}
                            aria-label={`Seleccionar para eliminar: ${t.nombre}`}
                          />
                          <input
                            type="checkbox"
                            className="mt-1 size-4 accent-[var(--lime)]"
                            checked={t.estado === 'Completado'}
                            disabled={busyTareaId === t._id}
                            onChange={(e) => void handleToggleTarea(t, e.target.checked)}
                            aria-label={`Marcar completada: ${t.nombre}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className={cn('font-medium leading-snug', salud !== 'ok' && 'text-red-900')}>
                              {t.nombre}
                              {etiquetaSalud && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'ml-2 align-middle text-[9px]',
                                    salud === 'atrasada'
                                      ? 'border-red-600 bg-red-600 text-white'
                                      : 'border-red-500 bg-red-500 text-white',
                                  )}
                                >
                                  {etiquetaSalud}
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t.responsable ?? 'Sin responsable'} · Fin{' '}
                              {formatDateDMY(t.fecha_fin)} · {t.porcentaje}%
                              {(t.adjuntos?.length ?? 0) > 0 && (
                                <span className="ml-1 text-[var(--navy)]">
                                  · {t.adjuntos!.length} adjunto{t.adjuntos!.length === 1 ? '' : 's'}
                                </span>
                              )}
                            </p>
                            {depN > 0 && (
                              <p className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                                <GitBranch className="size-3 shrink-0" />
                                Depende de: {preds.join(', ')}
                              </p>
                            )}
                            {bloqueada && (
                              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-800">
                                <Lock className="size-3" />
                                Predecesoras pendientes
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="hidden text-xs text-[var(--navy)] sm:inline-flex"
                              onClick={() => setTareaDetalle(t)}
                            >
                              Ver
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground"
                              onClick={() => setAdjuntosTareaId(t._id)}
                              aria-label="Adjuntos de la tarea"
                              title="Adjuntos"
                            >
                              <Paperclip className="size-4" />
                            </Button>
                            {puedeEditarProyecto && (
                            <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground"
                              onClick={() => {
                                setTareaEditing(t)
                                setTareaFormOpen(true)
                              }}
                              aria-label="Editar tarea"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => void handleDeleteTarea(t)}
                              aria-label="Eliminar tarea"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                            </>
                            )}
                          </div>
                        </li>
                        )
                      })}
                    </ul>
                    {tareas.length === 0 && (
                      <p className="text-sm text-muted-foreground">No hay tareas registradas.</p>
                    )}
                      </TabsContent>

                      <TabsContent value="panel" className="mt-0">
                        <TareasPanel
                          tareas={tareas}
                          proyecto={proyecto}
                          selectedId={tareaDetalle?._id}
                          onSelect={(t) => setTareaDetalle(t)}
                          onTareaMoved={reload}
                        />
                      </TabsContent>

                      <TabsContent value="gantt" className="mt-0">
                        <TareasMiniGantt
                          proyecto={proyecto}
                          tareas={tareas}
                          onSelect={(t) => setTareaDetalle(t)}
                        />
                      </TabsContent>
                    </Tabs>
                  </section>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {proyecto && (
        <TareaFormDialog
          key={`${tareaFormOpen}-${tareaEditing?._id ?? 'n'}`}
          open={tareaFormOpen}
          onOpenChange={(o) => {
            setTareaFormOpen(o)
            if (!o) setTareaEditing(null)
          }}
          proyectoId={proyecto._id}
          proyectoEje={proyecto.eje ?? ''}
          editing={tareaEditing}
          tareasProyecto={tareas}
          onSave={async (payload) => {
            if (tareaEditing) {
              await updateTarea(tareaEditing._id, payload)
            } else {
              await createTarea(payload)
            }
            await reload()
          }}
        />
      )}

      {proyecto && (
        <TareaDetalleSheet
          tarea={tareaDetalle}
          tareas={tareas}
          open={tareaDetalle != null}
          onOpenChange={(o) => {
            if (!o) setTareaDetalle(null)
          }}
          onEdit={(t) => {
            setTareaDetalle(null)
            setTareaEditing(t)
            setTareaFormOpen(true)
          }}
          onAdjuntos={(t) => {
            setTareaDetalle(null)
            setAdjuntosTareaId(t._id)
          }}
          onAddComentario={async (tareaId, texto) => {
            await addComentarioTarea(tareaId, texto)
            const ts = await fetchTareas(proyecto._id)
            setTareas(ts)
            const updated = ts.find((x) => x._id === tareaId) ?? null
            setTareaDetalle(updated)
          }}
        />
      )}

      {proyecto && adjuntosTareaId && (
        <TareaAdjuntosDialog
          open
          onOpenChange={(o) => {
            if (!o) setAdjuntosTareaId(null)
          }}
          tareaId={adjuntosTareaId}
          tareaNombre={tareas.find((x) => x._id === adjuntosTareaId)?.nombre ?? 'Tarea'}
          onChanged={() => void reload()}
        />
      )}
    </>
  )
}

function TareaAdjuntosDialog({
  open,
  onOpenChange,
  tareaId,
  tareaNombre,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tareaId: string
  tareaNombre: string
  onChanged: () => void
}) {
  const [items, setItems] = useState<TareaAdjunto[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchAdjuntosTarea(tareaId)
      setItems(list)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error al cargar adjuntos')
    } finally {
      setLoading(false)
    }
  }, [tareaId])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  async function handleUpload(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      await uploadAdjuntoTarea(tareaId, file)
      await load()
      onChanged()
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error al subir archivo')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(adj: TareaAdjunto) {
    if (!window.confirm(`¿Eliminar «${adj.nombre_original}»?`)) return
    try {
      await deleteAdjuntoTarea(tareaId, adj._id)
      await load()
      onChanged()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjuntos de la tarea</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <strong>{tareaNombre}</strong>
        </p>
        <div className="flex flex-wrap gap-2 py-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files?.[0])}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            className="gap-1"
            onClick={() => fileRef.current?.click()}
          >
            <FileUp className="size-4" />
            {uploading ? 'Subiendo…' : 'Subir archivo'}
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay archivos adjuntos.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((a) => (
              <li
                key={a._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm"
              >
                <a
                  href={urlAdjuntoTarea(a.archivo)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate font-medium text-[var(--navy)] underline-offset-2 hover:underline"
                >
                  {a.nombre_original}
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-destructive hover:text-destructive"
                  onClick={() => void handleDelete(a)}
                  aria-label="Eliminar adjunto"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Botones de transición de flujo: muestra las transiciones sugeridas con un
 * dropdown opcional para forzar a cualquier estado del catálogo. Pide
 * comentario opcional.
 */
function FlujoEstado({
  estadoActual, onTransicionar, soloLectura = false,
}: {
  estadoActual: ProyectoEstado
  onTransicionar: (a: ProyectoEstado, comentario?: string) => Promise<void>
  soloLectura?: boolean
}) {
  const [comentario, setComentario] = useState('')
  const [pendiente, setPendiente] = useState<ProyectoEstado | null>(null)
  const sugeridas = TRANSICIONES_SUGERIDAS[estadoActual] ?? []

  async function ejecutar(a: ProyectoEstado) {
    setPendiente(a)
    try {
      await onTransicionar(a, comentario.trim() || undefined)
      setComentario('')
    } finally {
      setPendiente(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Estado actual:</span>
        <Badge variant="outline" className={cn('text-[10px]', estadoColor(estadoActual))}>
          {estadoActual}
        </Badge>
      </div>
      {soloLectura ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" />
          Solo lectura: no puedes cambiar el estado de este proyecto.
        </p>
      ) : sugeridas.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Este es un estado terminal del flujo. Usa el selector de abajo para forzar otro estado si es necesario.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {sugeridas.map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant="outline"
              disabled={pendiente === s}
              onClick={() => void ejecutar(s)}
              className="gap-1.5 text-xs"
            >
              <ArrowRight className="size-3.5" />
              {pendiente === s ? 'Aplicando…' : s}
            </Button>
          ))}
        </div>
      )}
      {!soloLectura && (
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid flex-1 min-w-[180px] gap-1">
          <label className="text-[10px] text-muted-foreground">Forzar a otro estado</label>
          <select
            className="h-8 rounded-md border border-input bg-white px-2 text-xs"
            value=""
            onChange={(e) => {
              const v = e.target.value
              if (!v) return
              if (v === estadoActual) return
              if (window.confirm(`¿Cambiar el estado a «${v}»?`)) {
                void ejecutar(v as ProyectoEstado)
              }
            }}
          >
            <option value="">— Saltar a estado…</option>
            {PROYECTO_ESTADOS.filter((s) => s !== estadoActual).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="grid flex-[2] min-w-[200px] gap-1">
          <label className="text-[10px] text-muted-foreground">Comentario (opcional)</label>
          <input
            type="text"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Razón del cambio, contexto…"
            className="h-8 rounded-md border border-input bg-white px-2 text-xs"
          />
        </div>
      </div>
      )}
    </div>
  )
}

