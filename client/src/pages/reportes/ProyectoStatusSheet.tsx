import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, FileUp, ImageIcon, Send, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  addProyectoRiesgo,
  deleteProyectoRiesgo,
  deleteProyectoRiesgoAdjunto,
  fetchProyecto,
  fetchProyectoRiesgos,
  uploadProyectoRiesgoAdjunto,
  urlAdjuntoProyectoRiesgo,
} from '@/lib/api/proyectos'
import { formatDateDMY } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  estadoColor,
  proyectoPuedeEditar,
  type ProyectoEstado,
  type ProyectoRiesgoNivel,
  type ProyectoRiesgoRegistro,
} from '@/types/proyecto'
import type { ReporteStatusProyectoItem } from '@/types/reporteProyectos'
import { ReporteTareasDetalleList } from '@/components/reportes/ReporteTareasDetalleList'

const selectClass =
  'flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function riesgoNivelClass(n: ProyectoRiesgoNivel) {
  if (n === 'Alto') return 'border-red-300 bg-red-50 text-red-800'
  if (n === 'Bajo') return 'border-green-300 bg-green-50 text-green-800'
  return 'border-amber-300 bg-amber-50 text-amber-800'
}

function isImageMime(mime?: string) {
  return !!mime && mime.startsWith('image/')
}

type Props = {
  proyecto: ReporteStatusProyectoItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged?: () => void
}

export function ProyectoStatusSheet({ proyecto, open, onOpenChange, onChanged }: Props) {
  const [riesgos, setRiesgos] = useState<ProyectoRiesgoRegistro[]>([])
  const [puedeEditar, setPuedeEditar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [texto, setTexto] = useState('')
  const [nivel, setNivel] = useState<ProyectoRiesgoNivel>('Medio')
  const [enviando, setEnviando] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const cargar = useCallback(async () => {
    if (!proyecto) return
    setLoading(true)
    try {
      const [r, p] = await Promise.all([
        fetchProyectoRiesgos(proyecto.proyecto_id),
        fetchProyecto(proyecto.proyecto_id),
      ])
      setRiesgos(r)
      setPuedeEditar(proyectoPuedeEditar(p))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error al cargar riesgos')
    } finally {
      setLoading(false)
    }
  }, [proyecto])

  useEffect(() => {
    if (!open || !proyecto) return
    void cargar()
  }, [open, proyecto, cargar])

  async function handleAgregarRiesgo() {
    if (!proyecto || !texto.trim()) return
    setEnviando(true)
    try {
      await addProyectoRiesgo(proyecto.proyecto_id, { texto: texto.trim(), nivel })
      setTexto('')
      await cargar()
      onChanged?.()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error al registrar riesgo')
    } finally {
      setEnviando(false)
    }
  }

  async function handleUpload(riesgoId: string, file: File | undefined) {
    if (!proyecto || !file) return
    setUploadingId(riesgoId)
    try {
      await uploadProyectoRiesgoAdjunto(proyecto.proyecto_id, riesgoId, file)
      await cargar()
      onChanged?.()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error al subir archivo')
    } finally {
      setUploadingId(null)
    }
  }

  async function handleDeleteRiesgo(riesgoId: string) {
    if (!proyecto || !window.confirm('¿Eliminar este riesgo y sus evidencias?')) return
    try {
      await deleteProyectoRiesgo(proyecto.proyecto_id, riesgoId)
      await cargar()
      onChanged?.()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  async function handleDeleteAdjunto(riesgoId: string, adjuntoId: string) {
    if (!proyecto || !window.confirm('¿Eliminar este adjunto?')) return
    try {
      await deleteProyectoRiesgoAdjunto(proyecto.proyecto_id, riesgoId, adjuntoId)
      await cargar()
      onChanged?.()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error al eliminar adjunto')
    }
  }

  if (!proyecto) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="pr-8 text-left leading-snug">{proyecto.nombre}</SheetTitle>
          <p className="text-left text-xs text-muted-foreground">{proyecto.proyecto_id}</p>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn('text-xs', estadoColor(proyecto.estado as ProyectoEstado))}>
              {proyecto.estado}
            </Badge>
            <Badge
              variant="outline"
              className="text-xs"
              style={{
                borderColor: proyecto.riesgo_auto.color,
                color: proyecto.riesgo_auto.color,
                backgroundColor: `${proyecto.riesgo_auto.color}15`,
              }}
            >
              Riesgo auto: {proyecto.riesgo_auto.nivel}
            </Badge>
            <span className="text-muted-foreground">{proyecto.porcentaje_avance}% avance</span>
          </div>

          <p className="text-xs text-muted-foreground">{proyecto.riesgo_auto.motivo}</p>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Responsable</dt>
            <dd>{proyecto.responsable ?? proyecto.propietario ?? '—'}</dd>
            <dt className="text-muted-foreground">Fin</dt>
            <dd>{formatDateDMY(proyecto.fecha_fin)}</dd>
            <dt className="text-muted-foreground">Tareas</dt>
            <dd>
              {proyecto.tareas_completadas}/{proyecto.tareas_total} completadas · Avance {proyecto.avance_tareas_promedio}%
              {proyecto.tareas_bloqueadas > 0 && (
                <span className="text-red-600"> · {proyecto.tareas_bloqueadas} bloq.</span>
              )}
            </dd>
          </dl>

          {proyecto.tareas.length > 0 && (
            <div className="rounded-lg border border-border bg-[var(--gray-lt)]/40 p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Detalle de tareas
              </h3>
              <ReporteTareasDetalleList tareas={proyecto.tareas} />
            </div>
          )}

          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to={`/proyectos/${encodeURIComponent(proyecto.proyecto_id)}`}>
              <ExternalLink className="size-3.5" />
              Abrir proyecto completo
            </Link>
          </Button>

          <div className="border-t border-border pt-4">
            <h3 className="mb-2 font-semibold text-[var(--navy)]">Riesgos registrados</h3>
            {loading ? (
              <p className="text-xs text-muted-foreground">Cargando…</p>
            ) : riesgos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin riesgos documentados aún.</p>
            ) : (
              <ul className="space-y-3">
                {riesgos.map((r) => (
                  <li key={r._id} className="rounded-lg border border-border bg-[var(--gray-lt)]/40 p-3">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="outline" className={cn('text-[10px]', riesgoNivelClass(r.nivel))}>
                        {r.nivel}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {r.autor ? `${r.autor} · ` : ''}
                        {formatDateDMY(r.createdAt)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{r.texto}</p>

                    {(r.adjuntos?.length ?? 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {r.adjuntos!.map((a) => {
                          const url = urlAdjuntoProyectoRiesgo(a.archivo)
                          const img = isImageMime(a.mime_type)
                          return (
                            <div key={a._id} className="relative">
                              {img ? (
                                <a href={url} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={url}
                                    alt={a.nombre_original}
                                    className="h-16 w-16 rounded border border-border object-cover"
                                  />
                                </a>
                              ) : (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 rounded border border-border bg-white px-2 py-1 text-[10px] text-[var(--navy)] underline-offset-2 hover:underline"
                                >
                                  <ImageIcon className="size-3" />
                                  {a.nombre_original}
                                </a>
                              )}
                              {puedeEditar && (
                                <button
                                  type="button"
                                  className="absolute -right-1 -top-1 rounded-full bg-red-600 p-0.5 text-white"
                                  onClick={() => void handleDeleteAdjunto(r._id, a._id)}
                                  aria-label="Eliminar adjunto"
                                >
                                  <Trash2 className="size-2.5" />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {puedeEditar && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <input
                          ref={(el) => { fileRefs.current[r._id] = el }}
                          type="file"
                          accept="image/*,.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xlsx"
                          className="hidden"
                          onChange={(e) => {
                            void handleUpload(r._id, e.target.files?.[0])
                            e.target.value = ''
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          disabled={uploadingId === r._id}
                          onClick={() => fileRefs.current[r._id]?.click()}
                        >
                          <FileUp className="size-3" />
                          {uploadingId === r._id ? 'Subiendo…' : 'Adjuntar evidencia'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-destructive"
                          onClick={() => void handleDeleteRiesgo(r._id)}
                        >
                          <Trash2 className="size-3" />
                          Eliminar
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {puedeEditar && (
            <div className="rounded-lg border border-dashed border-border bg-white p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Registrar nuevo riesgo</p>
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Describe el riesgo, situación o bloqueo…"
                rows={3}
                className="text-sm"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  className={selectClass}
                  value={nivel}
                  onChange={(e) => setNivel(e.target.value as ProyectoRiesgoNivel)}
                  aria-label="Nivel de riesgo"
                >
                  <option value="Alto">Alto</option>
                  <option value="Medio">Medio</option>
                  <option value="Bajo">Bajo</option>
                </select>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
                  disabled={enviando || !texto.trim()}
                  onClick={() => void handleAgregarRiesgo()}
                >
                  <Send className="size-3.5" />
                  {enviando ? 'Guardando…' : 'Agregar riesgo'}
                </Button>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Después de guardar puedes adjuntar capturas o documentos como evidencia.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
