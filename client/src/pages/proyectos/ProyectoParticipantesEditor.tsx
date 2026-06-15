import { useState } from 'react'
import { Eye, Pencil, Trash2, UserPlus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProyectoParticipanteRol } from '@/types/proyecto'
import { rolParticipanteLabel } from '@/types/proyecto'
import type { UsuarioDoc } from '@/types/usuario'

export type ParticipanteDraft = {
  key: string
  usuario_id: string
  rol: ProyectoParticipanteRol
}

type Props = {
  ownerId: string | null
  draft: ParticipanteDraft[]
  onChange: (next: ParticipanteDraft[]) => void
  usuarios: UsuarioDoc[]
  puedeGestionar?: boolean
}

export function ProyectoParticipantesEditor({
  ownerId,
  draft,
  onChange,
  usuarios,
  puedeGestionar = true,
}: Props) {
  const usados = new Set(draft.map((d) => d.usuario_id))
  if (ownerId) usados.add(ownerId)
  const disponibles = usuarios.filter((u) => u.activo !== false && !usados.has(u._id))

  function nombreUsuario(id: string): string {
    return usuarios.find((u) => u._id === id)?.nombre ?? id
  }

  return (
    <div className="grid gap-3 rounded-md border border-border bg-muted/20 p-3">
      <div>
        <p className="text-sm font-medium">Participantes</p>
        <p className="text-xs text-muted-foreground">
          Opcional. Agregue colaboradores con rol de solo lectura o editor (recomendado en proyectos
          de categoría <strong>General</strong>).
        </p>
      </div>

      {draft.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin participantes adicionales.</p>
      ) : (
        <ul className="space-y-2">
          {draft.map((p) => (
            <li
              key={p.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
            >
              <span className="truncate text-sm font-medium">{nombreUsuario(p.usuario_id)}</span>
              <div className="flex items-center gap-2">
                {puedeGestionar ? (
                  <Select
                    value={p.rol}
                    onValueChange={(v) =>
                      onChange(
                        draft.map((row) =>
                          row.key === p.key ? { ...row, rol: v as ProyectoParticipanteRol } : row,
                        ),
                      )
                    }
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
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    {rolParticipanteLabel(p.rol)}
                  </Badge>
                )}
                {puedeGestionar && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 text-destructive hover:bg-destructive/10"
                    onClick={() => onChange(draft.filter((row) => row.key !== p.key))}
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

      {puedeGestionar && (
        <ParticipanteAgregar
          disponibles={disponibles}
          onAgregar={(usuario_id, rol) => {
            onChange([
              ...draft,
              { key: `new-${Date.now()}`, usuario_id, rol },
            ])
          }}
        />
      )}
    </div>
  )
}

function ParticipanteAgregar({
  disponibles,
  onAgregar,
}: {
  disponibles: UsuarioDoc[]
  onAgregar: (usuarioId: string, rol: ProyectoParticipanteRol) => void
}) {
  const [usuarioId, setUsuarioId] = useState('')
  const [rol, setRol] = useState<ProyectoParticipanteRol>('lectura')

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
      <div className="min-w-[200px] flex-1">
        <label className="mb-1 block text-xs text-muted-foreground">Agregar usuario</label>
        <Select value={usuarioId} onValueChange={setUsuarioId}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Seleccionar usuario…" />
          </SelectTrigger>
          <SelectContent>
            {disponibles.map((u) => (
              <SelectItem key={u._id} value={u._id}>
                {u.nombre} ({u.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-[150px]">
        <label className="mb-1 block text-xs text-muted-foreground">Rol</label>
        <Select value={rol} onValueChange={(v) => setRol(v as ProyectoParticipanteRol)}>
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
        disabled={!usuarioId}
        onClick={() => {
          if (!usuarioId) return
          onAgregar(usuarioId, rol)
          setUsuarioId('')
          setRol('lectura')
        }}
      >
        <UserPlus className="size-4" />
        Agregar
      </Button>
    </div>
  )
}
