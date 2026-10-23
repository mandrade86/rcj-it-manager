import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Eye, Pencil, Search, Trash2, UserPlus, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
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

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
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
          onAgregar={(usuarioIds, rol) => {
            const stamp = Date.now()
            onChange([
              ...draft,
              ...usuarioIds.map((usuario_id, i) => ({
                key: `new-${stamp}-${i}`,
                usuario_id,
                rol,
              })),
            ])
          }}
        />
      )}
    </div>
  )
}

export function ParticipanteAgregar({
  disponibles,
  onAgregar,
}: {
  disponibles: UsuarioDoc[]
  onAgregar: (usuarioIds: string[], rol: ProyectoParticipanteRol) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [rol, setRol] = useState<ProyectoParticipanteRol>('lectura')
  const wrapRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const filtrados = useMemo(() => {
    const q = norm(query.trim())
    const list = [...disponibles].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    if (!q) return list
    return list.filter((u) => norm(`${u.nombre} ${u.email}`).includes(q))
  }, [disponibles, query])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 0)
    } else {
      setQuery('')
    }
  }, [open])

  useEffect(() => {
    const ids = new Set(disponibles.map((u) => u._id))
    setSeleccionados((prev) => prev.filter((id) => ids.has(id)))
  }, [disponibles])

  function toggle(id: string) {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function quitarChip(id: string) {
    setSeleccionados((prev) => prev.filter((x) => x !== id))
  }

  const etiquetas = seleccionados
    .map((id) => disponibles.find((u) => u._id === id))
    .filter((u): u is UsuarioDoc => Boolean(u))

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
      <div className="min-w-[220px] flex-1" ref={wrapRef}>
        <label className="mb-1 block text-xs text-muted-foreground">Agregar usuarios</label>
        <div className="relative">
          <button
            type="button"
            className={cn(
              'flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs outline-none',
              'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            )}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="listbox"
          >
            <span className="min-w-0 flex-1 text-left">
              {seleccionados.length === 0 ? (
                <span className="text-muted-foreground">Buscar y seleccionar…</span>
              ) : (
                <span className="flex flex-wrap gap-1">
                  {etiquetas.slice(0, 3).map((u) => (
                    <span
                      key={u._id}
                      className="inline-flex max-w-[140px] items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs"
                    >
                      <span className="truncate">{u.nombre}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        className="rounded p-0.5 hover:bg-background"
                        onClick={(e) => {
                          e.stopPropagation()
                          quitarChip(u._id)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            e.stopPropagation()
                            quitarChip(u._id)
                          }
                        }}
                        aria-label={`Quitar ${u.nombre}`}
                      >
                        <X className="size-3" />
                      </span>
                    </span>
                  ))}
                  {seleccionados.length > 3 && (
                    <span className="text-xs text-muted-foreground">+{seleccionados.length - 3}</span>
                  )}
                </span>
              )}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>

          {open && (
            <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
              <div className="flex items-center gap-2 border-b px-2 py-1.5">
                <Search className="size-3.5 shrink-0 text-muted-foreground" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre o correo…"
                  className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <ul className="max-h-56 overflow-y-auto py-1" role="listbox" aria-multiselectable>
                {disponibles.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-muted-foreground">No hay más usuarios para agregar.</li>
                ) : filtrados.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-muted-foreground">Sin coincidencias.</li>
                ) : (
                  filtrados.map((u) => {
                    const checked = seleccionados.includes(u._id)
                    return (
                      <li key={u._id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={checked}
                          className={cn(
                            'flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted',
                            checked && 'bg-muted/60',
                          )}
                          onClick={() => toggle(u._id)}
                        >
                          <span
                            className={cn(
                              'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border',
                              checked
                                ? 'border-[var(--navy)] bg-[var(--navy)] text-white'
                                : 'border-input',
                            )}
                          >
                            {checked ? <Check className="size-3" /> : null}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium">{u.nombre}</span>
                            <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                          </span>
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
              {seleccionados.length > 0 && (
                <div className="flex items-center justify-between border-t px-3 py-1.5 text-xs text-muted-foreground">
                  <span>{seleccionados.length} seleccionado{seleccionados.length === 1 ? '' : 's'}</span>
                  <button
                    type="button"
                    className="text-[var(--navy)] underline-offset-2 hover:underline"
                    onClick={() => setSeleccionados([])}
                  >
                    Limpiar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
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
        disabled={seleccionados.length === 0}
        onClick={() => {
          if (seleccionados.length === 0) return
          onAgregar(seleccionados, rol)
          setSeleccionados([])
          setRol('lectura')
          setOpen(false)
          setQuery('')
        }}
      >
        <UserPlus className="size-4" />
        Agregar{seleccionados.length > 1 ? ` (${seleccionados.length})` : ''}
      </Button>
    </div>
  )
}
