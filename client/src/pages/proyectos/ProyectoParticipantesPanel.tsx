import { useEffect, useMemo, useState } from 'react'
import { Eye, Pencil, Trash2, UserPlus, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchUsuarios } from '@/lib/api/usuarios'
import { updateProyectoParticipantes } from '@/lib/api/proyectos'
import { cn } from '@/lib/utils'
import type { Proyecto, ProyectoParticipanteRol } from '@/types/proyecto'
import {
  participanteUsuarioId,
  participanteUsuarioNombre,
  proyectoOwnerId,
  proyectoOwnerName,
  proyectoPuedeGestionarParticipantes,
  rolParticipanteLabel,
} from '@/types/proyecto'
import type { UsuarioDoc } from '@/types/usuario'

type ParticipanteDraft = {
  key: string
  usuario_id: string
  rol: ProyectoParticipanteRol
}

type Props = {
  proyecto: Proyecto
  onUpdated: (p: Proyecto) => void
}

function participantesToDraft(proyecto: Proyecto): ParticipanteDraft[] {
  return (proyecto.participantes ?? []).map((p, i) => ({
    key: p._id ?? `p-${i}`,
    usuario_id: participanteUsuarioId(p) ?? '',
    rol: p.rol === 'editor' ? 'editor' : 'lectura',
  })).filter((p) => p.usuario_id)
}

export function ProyectoParticipantesPanel({ proyecto, onUpdated }: Props) {
  const puedeGestionar = proyectoPuedeGestionarParticipantes(proyecto)
  const [usuarios, setUsuarios] = useState<UsuarioDoc[]>([])
  const [draft, setDraft] = useState<ParticipanteDraft[]>(() => participantesToDraft(proyecto))
  const [nuevoUsuarioId, setNuevoUsuarioId] = useState('')
  const [nuevoRol, setNuevoRol] = useState<ProyectoParticipanteRol>('lectura')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const ownerId = proyectoOwnerId(proyecto)

  useEffect(() => {
    setDraft(participantesToDraft(proyecto))
    setDirty(false)
    setError(null)
  }, [proyecto._id, proyecto.participantes])

  useEffect(() => {
    let cancel = false
    void fetchUsuarios()
      .then((rows) => { if (!cancel) setUsuarios(rows.filter((u) => u.activo !== false)) })
      .catch(() => { if (!cancel) setUsuarios([]) })
    return () => { cancel = true }
  }, [])

  const usuariosDisponibles = useMemo(() => {
    const usados = new Set(draft.map((d) => d.usuario_id))
    if (ownerId) usados.add(ownerId)
    return usuarios.filter((u) => !usados.has(u._id))
  }, [usuarios, draft, ownerId])

  function agregarParticipante() {
    if (!nuevoUsuarioId) return
    setDraft((prev) => [
      ...prev,
      { key: `new-${Date.now()}`, usuario_id: nuevoUsuarioId, rol: nuevoRol },
    ])
    setNuevoUsuarioId('')
    setNuevoRol('lectura')
    setDirty(true)
  }

  function quitarParticipante(key: string) {
    setDraft((prev) => prev.filter((p) => p.key !== key))
    setDirty(true)
  }

  function cambiarRol(key: string, rol: ProyectoParticipanteRol) {
    setDraft((prev) => prev.map((p) => (p.key === key ? { ...p, rol } : p)))
    setDirty(true)
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const payload = draft.map((p) => ({ usuario_id: p.usuario_id, rol: p.rol }))
      const doc = await updateProyectoParticipantes(proyecto._id, payload)
      onUpdated(doc)
      setDirty(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  function nombreUsuario(id: string): string {
    const enDraft = usuarios.find((u) => u._id === id)
    if (enDraft) return enDraft.nombre
    const enProyecto = (proyecto.participantes ?? []).find((p) => participanteUsuarioId(p) === id)
    if (enProyecto) return participanteUsuarioNombre(enProyecto) || id
    return id
  }

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--navy)]">
            <Users className="size-4" />
            Participantes del proyecto
          </h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Incluya colaboradores con acceso de solo lectura o como editores. Útil en proyectos de
            categoría <strong>General</strong> que involucran a varias áreas.
          </p>
        </div>
        {puedeGestionar && dirty && (
          <Button
            type="button"
            size="sm"
            className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
            disabled={guardando}
            onClick={() => void guardar()}
          >
            {guardando ? 'Guardando…' : 'Guardar participantes'}
          </Button>
        )}
      </div>

      <div className="mb-4 rounded-md border border-dashed border-border bg-muted/20 p-3">
        <p className="text-xs font-medium text-muted-foreground">Propietario</p>
        <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium">
          {proyectoOwnerName(proyecto) || '—'}
          <Badge variant="outline" className="text-[10px]">Propietario</Badge>
        </p>
      </div>

      {error && (
        <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {draft.length === 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Aún no hay participantes adicionales. Agregue usuarios con rol de solo lectura o editor.
        </p>
      ) : (
        <ul className="mb-4 space-y-2">
          {draft.map((p) => (
            <li
              key={p.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{nombreUsuario(p.usuario_id)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {usuarios.find((u) => u._id === p.usuario_id)?.email ?? ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {puedeGestionar ? (
                  <Select
                    value={p.rol}
                    onValueChange={(v) => cambiarRol(p.key, v as ProyectoParticipanteRol)}
                  >
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lectura">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="size-3" /> Solo lectura
                        </span>
                      </SelectItem>
                      <SelectItem value="editor">
                        <span className="inline-flex items-center gap-1">
                          <Pencil className="size-3" /> Editor
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge
                    variant="outline"
                    className={cn(
                      'gap-1 text-[10px]',
                      p.rol === 'lectura' && 'border-slate-300 text-slate-600',
                    )}
                  >
                    {p.rol === 'lectura' ? <Eye className="size-3" /> : <Pencil className="size-3" />}
                    {rolParticipanteLabel(p.rol)}
                  </Badge>
                )}
                {puedeGestionar && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 text-destructive hover:bg-destructive/10"
                    onClick={() => quitarParticipante(p.key)}
                    aria-label="Quitar participante"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {puedeGestionar ? (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/10 p-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Agregar usuario</label>
            <Select value={nuevoUsuarioId} onValueChange={setNuevoUsuarioId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Seleccionar usuario…" />
              </SelectTrigger>
              <SelectContent>
                {usuariosDisponibles.map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.nombre} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[150px]">
            <label className="mb-1 block text-xs text-muted-foreground">Rol</label>
            <Select value={nuevoRol} onValueChange={(v) => setNuevoRol(v as ProyectoParticipanteRol)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lectura">Solo lectura</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            disabled={!nuevoUsuarioId}
            onClick={agregarParticipante}
          >
            <UserPlus className="size-4" />
            Agregar
          </Button>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Eye className="size-3.5" />
          Solo lectura: no puedes modificar la lista de participantes.
        </p>
      )}
    </section>
  )
}
