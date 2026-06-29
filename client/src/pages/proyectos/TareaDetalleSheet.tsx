import { useState } from 'react'
import { GitBranch, Lock, MessageSquare, Pencil, Paperclip, Send } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatDateDMY } from '@/lib/format'
import {
  dependeDeIds,
  estadoTareaColor,
  etiquetaSaludTarea,
  evaluarSaludTarea,
  mapaTareas,
  sucesorasDirectas,
  tareaBloqueadaPorDependencias,
} from '@/lib/tareaDependencias'
import { cn } from '@/lib/utils'
import type { Tarea } from '@/types/tarea'

type Props = {
  tarea: Tarea | null
  tareas: Tarea[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (t: Tarea) => void
  onAdjuntos: (t: Tarea) => void
  onAddComentario?: (tareaId: string, texto: string) => Promise<void>
}

export function TareaDetalleSheet({
  tarea,
  tareas,
  open,
  onOpenChange,
  onEdit,
  onAdjuntos,
  onAddComentario,
}: Props) {
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [enviandoComentario, setEnviandoComentario] = useState(false)

  if (!tarea) return null

  const tareaId = tarea._id
  const mapa = mapaTareas(tareas)
  const succs = sucesorasDirectas(tareaId, tareas)
  const bloqueada = tareaBloqueadaPorDependencias(tarea, mapa)
  const depIds = dependeDeIds(tarea)
  const salud = evaluarSaludTarea(tarea, mapa)
  const etiquetaSalud = etiquetaSaludTarea(salud)
  const comentarios = [...(tarea.comentarios ?? [])].sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
  )

  async function handleEnviarComentario() {
    const texto = nuevoComentario.trim()
    if (!texto || !onAddComentario) return
    setEnviandoComentario(true)
    try {
      await onAddComentario(tareaId, texto)
      setNuevoComentario('')
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error al guardar comentario')
    } finally {
      setEnviandoComentario(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="pr-8 text-left leading-snug">{tarea.nombre}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn('text-xs', estadoTareaColor(tarea.estado))}>
              {tarea.estado}
            </Badge>
            <span className="text-muted-foreground">{tarea.porcentaje}% avance</span>
            {etiquetaSalud && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs font-semibold',
                  salud === 'atrasada'
                    ? 'border-red-600 bg-red-600 text-white'
                    : 'border-red-500 bg-red-500 text-white',
                )}
              >
                {etiquetaSalud}
              </Badge>
            )}
          </div>

          {salud !== 'ok' && (
            <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
              {salud === 'atrasada'
                ? 'La fecha de fin ya pasó y la tarea no está completada.'
                : 'La fecha de fin está próxima o hay dependencias que retrasan el avance.'}
            </p>
          )}

          {bloqueada && (
            <p className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <Lock className="size-4 shrink-0" />
              Hay predecesoras sin completar; conviene terminarlas antes de avanzar.
            </p>
          )}

          {tarea.descripcion && (
            <section>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Descripción</p>
              <p className="mt-1 whitespace-pre-wrap">{tarea.descripcion}</p>
            </section>
          )}

          <section className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Responsable</p>
              <p className="font-medium">{tarea.responsable ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inicio</p>
              <p className="font-medium">{formatDateDMY(tarea.fecha_inicio)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fin</p>
              <p className="font-medium">{formatDateDMY(tarea.fecha_fin)}</p>
            </div>
          </section>

          <section>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
              <GitBranch className="size-3.5" />
              Dependencias
            </p>
            {depIds.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin tareas predecesoras.</p>
            ) : (
              <ul className="space-y-1.5">
                {depIds.map((id) => {
                  const p = mapa.get(id)
                  return (
                    <li
                      key={id}
                      className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-2 py-1.5 text-xs"
                    >
                      <span>{p?.nombre ?? id}</span>
                      {p && (
                        <Badge variant="outline" className={cn('text-[10px]', estadoTareaColor(p.estado))}>
                          {p.estado}
                        </Badge>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {succs.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Tareas que dependen de esta
              </p>
              <ul className="space-y-1">
                {succs.map((s) => (
                  <li key={s._id} className="rounded-md border border-border bg-muted/10 px-2 py-1.5 text-xs">
                    {s.nombre}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(tarea.adjuntos?.length ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground">
              {tarea.adjuntos!.length} archivo{tarea.adjuntos!.length === 1 ? '' : 's'} adjunto
              {tarea.adjuntos!.length === 1 ? '' : 's'}
            </p>
          )}

          <section>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
              <MessageSquare className="size-3.5" />
              Comentarios
            </p>
            {comentarios.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin comentarios aún.</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {comentarios.map((c) => (
                  <li
                    key={c._id}
                    className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs"
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{c.texto}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {c.autor || 'Usuario'}
                      {c.createdAt ? ` · ${formatDateDMY(c.createdAt)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {onAddComentario && (
              <div className="mt-3 space-y-2">
                <Textarea
                  rows={2}
                  placeholder="Agregar comentario de seguimiento…"
                  value={nuevoComentario}
                  onChange={(e) => setNuevoComentario(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  className="gap-1 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
                  disabled={enviandoComentario || !nuevoComentario.trim()}
                  onClick={() => void handleEnviarComentario()}
                >
                  <Send className="size-3.5" />
                  {enviandoComentario ? 'Guardando…' : 'Comentar'}
                </Button>
              </div>
            )}
          </section>
        </div>

        <SheetFooter className="flex-row gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => onAdjuntos(tarea)}
          >
            <Paperclip className="size-4" />
            Adjuntos
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
            onClick={() => onEdit(tarea)}
          >
            <Pencil className="size-4" />
            Editar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
