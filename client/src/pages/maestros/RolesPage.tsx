import { useCallback, useEffect, useMemo, useState } from 'react'
import { Briefcase, Crown, Edit2, Plus, Shield, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { BOARD, BoardPill, BoardPrimaryButton, EntityBoard } from '@/components/board/EntityBoard'
import { DepartamentosMultiSelect } from '@/components/maestros/DepartamentosMultiSelect'
import { fetchDepartamentos } from '@/lib/api/departamentos'
import { fetchPerfilesPuesto } from '@/lib/api/perfilesPuesto'
import { MaestroBulkDeleteBar } from '@/components/maestros/MaestroBulkDeleteBar'
import { useMaestroBulkDelete } from '@/hooks/useMaestroBulkDelete'
import {
  createRol, deleteRol, fetchPermisosDisponibles, fetchRoles, updateRol,
} from '@/lib/api/roles'
import type { DepartamentoDoc } from '@/types/departamento'
import type { PerfilPuestoDoc } from '@/types/perfilPuesto'
import { deptFromPerfil } from '@/types/perfilPuesto'
import type { RolDoc } from '@/types/rol'
import {
  departamentoIdsFromRol, departamentosFromRol, perfilFromRol, perfilIdFromRol,
} from '@/types/rol'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

type FormState = {
  nombre: string
  descripcion: string
  departamentos_ids: string[]
  perfil_puesto_id: string
  permisos: string[]
  activo: boolean
}

function emptyForm(): FormState {
  return {
    nombre: '', descripcion: '', departamentos_ids: [],
    perfil_puesto_id: '', permisos: [], activo: true,
  }
}

function fromDoc(d: RolDoc): FormState {
  return {
    nombre: d.nombre,
    descripcion: d.descripcion ?? '',
    departamentos_ids: departamentoIdsFromRol(d),
    perfil_puesto_id: perfilIdFromRol(d) ?? '',
    permisos: d.permisos ?? [],
    activo: d.activo ?? true,
  }
}

export function RolesPage() {
  const [list, setList] = useState<RolDoc[]>([])
  const [depts, setDepts] = useState<DepartamentoDoc[]>([])
  const [perfiles, setPerfiles] = useState<PerfilPuestoDoc[]>([])
  const [permisos, setPermisos] = useState<{ clave: string; descripcion: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RolDoc | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RolDoc | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const [r, p, d, pf] = await Promise.all([
        fetchRoles(), fetchPermisosDisponibles(), fetchDepartamentos(), fetchPerfilesPuesto(),
      ])
      setList(r); setPermisos(p); setDepts(d); setPerfiles(pf)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }, [])

  // Perfiles filtrados por el departamento seleccionado (si hay)
  const perfilesFiltrados = useMemo(() => {
    if (form.departamentos_ids.length === 0) return perfiles
    const set = new Set(form.departamentos_ids)
    return perfiles.filter((p) => {
      const d = deptFromPerfil(p)
      return d?._id != null && set.has(d._id)
    })
  }, [perfiles, form.departamentos_ids])

  const perfilSeleccionado = useMemo(
    () => perfiles.find((p) => p._id === form.perfil_puesto_id) ?? null,
    [perfiles, form.perfil_puesto_id],
  )

  useEffect(() => { void reload() }, [reload])

  const visibleIds = useMemo(() => list.map((r) => r._id), [list])
  const bulk = useMaestroBulkDelete({
    recurso: 'roles',
    visibleIds,
    etiqueta: 'rol(es)',
    onAfterDelete: reload,
  })

  function openNew() { setEditing(null); setForm(emptyForm()); setOpen(true) }
  function openEdit(d: RolDoc) { setEditing(d); setForm(fromDoc(d)); setOpen(true) }

  function setF<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }
  function togglePermiso(clave: string) {
    setForm((f) => {
      const has = f.permisos.includes(clave)
      const next = has ? f.permisos.filter((p) => p !== clave) : [...f.permisos, clave]
      return { ...f, permisos: next }
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const payload = {
        ...form,
        departamento_id: form.departamentos_ids[0] ?? null,
        departamentos_ids: form.departamentos_ids,
      }
      if (editing) await updateRol(editing._id, payload)
      else await createRol(payload)
      setOpen(false)
      await reload()
    } catch (ex) { window.alert(ex instanceof Error ? ex.message : 'Error') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteRol(deleteTarget._id)
      setDeleteTarget(null)
      await reload()
    } catch (ex) { window.alert(ex instanceof Error ? ex.message : 'No se pudo eliminar') }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Roles y Permisos</h2>
          <p className="text-sm text-muted-foreground">
            Define los roles del sistema y los permisos asociados a cada uno.
          </p>
        </div>
        <BoardPrimaryButton onClick={openNew}>
          <Plus className="size-4" /> Nuevo rol
        </BoardPrimaryButton>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {!loading && bulk.showBar && (
        <MaestroBulkDeleteBar
          seleccionCount={bulk.seleccionCount}
          bulkDeleting={bulk.bulkDeleting}
          onEliminar={() => void bulk.handleEliminarSeleccionados()}
          etiqueta="roles"
        />
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <EntityBoard
          rows={list}
          countLabel="rol"
          emptyMessage="Sin roles registrados."
          searchTexts={(r) => {
            const deptos = departamentosFromRol(r)
            const perfil = perfilFromRol(r)
            return [r.nombre, r.descripcion, ...deptos.map((d) => d.nombre), perfil?.titulo]
          }}
          columns={[
            {
              id: 'sel',
              label: '',
              className: 'w-8',
              render: (r) => (
                <input
                  type="checkbox"
                  className="size-3.5 accent-[var(--navy)]"
                  checked={bulk.selectedIds.has(r._id)}
                  onChange={() => bulk.toggle(r._id)}
                  aria-label={`Seleccionar ${r.nombre}`}
                />
              ),
            },
            {
              id: 'nombre',
              label: 'Nombre',
              render: (r) => (
                <div className="flex items-start gap-2">
                  <Shield className="mt-0.5 size-4 shrink-0" style={{ color: BOARD.muted }} />
                  <div>
                    <div className="font-medium">{r.nombre}</div>
                    {r.descripcion && (
                      <div className="text-xs" style={{ color: BOARD.muted }}>{r.descripcion}</div>
                    )}
                  </div>
                </div>
              ),
            },
            {
              id: 'departamentos',
              label: 'Departamentos',
              render: (r) => {
                const deptos = departamentosFromRol(r)
                if (deptos.length === 0) return <span style={{ color: BOARD.muted }}>—</span>
                return (
                  <div className="flex flex-wrap gap-1">
                    {deptos.map((d) => (
                      <span key={d._id} className="inline-flex items-center gap-1 text-xs">
                        <span className="size-2 rounded-full" style={{ background: d.color ?? '#002060' }} />
                        {d.nombre}
                      </span>
                    ))}
                  </div>
                )
              },
            },
            {
              id: 'perfil',
              label: 'Perfil de puesto',
              render: (r) => {
                const perfil = perfilFromRol(r)
                if (!perfil) return <span className="text-xs" style={{ color: BOARD.muted }}>—</span>
                return (
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="size-3.5" style={{ color: BOARD.muted }} />
                      <span className="truncate text-sm font-medium">{perfil.titulo}</span>
                      {perfil.tiene_personal_a_cargo && (
                        <Crown className="size-3" style={{ color: BOARD.primary }} />
                      )}
                    </div>
                    <code className="text-[10px]" style={{ color: BOARD.muted }}>{perfil.codigo}</code>
                  </div>
                )
              },
            },
            {
              id: 'permisos',
              label: 'Permisos',
              render: (r) => (
                <div className="flex flex-wrap gap-1">
                  {r.permisos.includes('*') ? (
                    <BoardPill label="Acceso total" bg={BOARD.red} />
                  ) : (
                    <>
                      {r.permisos.slice(0, 3).map((p) => (
                        <BoardPill key={p} label={p} bg={BOARD.gray} text={BOARD.text} />
                      ))}
                      {r.permisos.length > 3 && (
                        <BoardPill label={`+${r.permisos.length - 3}`} bg={BOARD.gray} text={BOARD.text} />
                      )}
                    </>
                  )}
                </div>
              ),
            },
            {
              id: 'estado',
              label: 'Estado',
              render: (r) => (
                <BoardPill
                  label={r.activo ? 'Activo' : 'Inactivo'}
                  bg={r.activo ? BOARD.green : BOARD.gray}
                  text={r.activo ? '#fff' : BOARD.text}
                />
              ),
            },
            {
              id: 'acciones',
              label: 'Acciones',
              align: 'right',
              render: (r) => (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                    <Edit2 className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(r)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar rol' : 'Nuevo rol'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Nombre <span className="text-destructive">*</span></Label>
                <Input required value={form.nombre} onChange={(e) => setF('nombre', e.target.value)} />
              </div>
              <div className="flex items-end gap-2">
                <input id="rol-activo" type="checkbox" className="size-4 accent-[var(--lime)]" checked={form.activo} onChange={(e) => setF('activo', e.target.checked)} />
                <Label htmlFor="rol-activo">Activo</Label>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Textarea rows={2} value={form.descripcion} onChange={(e) => setF('descripcion', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Departamentos</Label>
              <DepartamentosMultiSelect
                departamentos={depts.filter((d) => d.activo)}
                value={form.departamentos_ids}
                hint="Marca uno o más departamentos a los que aplica este rol. Los usuarios con este rol verán en Mi Equipo la dotación de esos departamentos (además de su jerarquía)."
                onChange={(ids) => {
                  setF('departamentos_ids', ids)
                  if (perfilSeleccionado) {
                    const d = deptFromPerfil(perfilSeleccionado)
                    if (d?._id && ids.length > 0 && !ids.includes(d._id)) {
                      setF('perfil_puesto_id', '')
                    }
                  }
                }}
              />
            </div>

            <div className="grid gap-2 rounded-md border border-[var(--navy)]/20 bg-[var(--blue-lt)]/20 p-4">
              <div className="flex items-center gap-2">
                <Briefcase className="size-4 text-[var(--navy)]" />
                <Label className="text-xs font-semibold uppercase tracking-wide text-[var(--navy)]">
                  Perfil de puesto vinculado
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Asocia este rol a un perfil de puesto del catálogo (opcional). Ayuda a alinear los permisos del
                sistema con la estructura organizacional definida en los descriptores RH-F-04.
                {form.departamentos_ids.length > 0 && ' Solo se muestran perfiles de los departamentos seleccionados.'}
              </p>
              <select
                className={selectClass}
                value={form.perfil_puesto_id}
                onChange={(e) => setF('perfil_puesto_id', e.target.value)}
              >
                <option value="">— Sin perfil amarrado —</option>
                {perfilesFiltrados.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.codigo} · {p.titulo}
                    {p.tiene_personal_a_cargo ? ' (con personal a cargo)' : ''}
                  </option>
                ))}
              </select>
              {perfilSeleccionado && (
                <div className="mt-1 rounded bg-white/60 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{perfilSeleccionado.titulo}</span>
                    {perfilSeleccionado.tiene_personal_a_cargo && (
                      <Badge variant="secondary" className="gap-1 bg-[var(--navy)] py-0 text-[10px] text-white">
                        <Crown className="size-2.5" /> Tiene personal a cargo
                      </Badge>
                    )}
                  </div>
                  {perfilSeleccionado.nivel && (
                    <p className="text-muted-foreground">Nivel: {perfilSeleccionado.nivel}</p>
                  )}
                  {perfilSeleccionado.reporta_a && (
                    <p className="text-muted-foreground">Reporta a: {perfilSeleccionado.reporta_a}</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Permisos ({form.permisos.length} seleccionado{form.permisos.length === 1 ? '' : 's'})
              </Label>
              <div className="max-h-[300px] space-y-1 overflow-y-auto rounded-md border bg-muted/20 p-2">
                {permisos.map((p) => {
                  const checked = form.permisos.includes(p.clave)
                  const isAdmin = p.clave === '*'
                  return (
                    <label
                      key={p.clave}
                      className={`flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-white ${
                        checked ? 'bg-[var(--blue-lt)]' : ''
                      } ${isAdmin ? 'border-l-2 border-red-400' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePermiso(p.clave)}
                        className="mt-0.5 size-4 accent-[var(--lime)]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`font-medium ${isAdmin ? 'text-red-700' : ''}`}>{p.descripcion}</p>
                        <code className="text-[10px] text-muted-foreground">{p.clave}</code>
                      </div>
                    </label>
                  )
                })}
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

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar rol</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar el rol <strong>{deleteTarget?.nombre}</strong>? Esta acción es irreversible.
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
