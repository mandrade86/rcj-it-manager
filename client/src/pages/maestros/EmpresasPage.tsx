import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Cable, Factory, Pencil, Plus, RefreshCw, Save, Settings2, Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { BOARD, BoardPill, BoardPrimaryButton, EntityBoard } from '@/components/board/EntityBoard'
import { MaestroBulkDeleteBar } from '@/components/maestros/MaestroBulkDeleteBar'
import { useMaestroBulkDelete } from '@/hooks/useMaestroBulkDelete'
import { MAESTRO_SELECT_CLASS } from '@/lib/maestroList'
import {
  createEmpresa, deleteEmpresa, fetchEmpresas, fetchEmpresasListUrl,
  saveEmpresasListUrl, syncEmpresas, updateEmpresa,
} from '@/lib/api/empresas'
import type { EmpresaDoc } from '@/types/empresa'

const DEFAULT_EHR_COMPANY_LIST_URL = 'https://ehrapi.rcjcorp.hn/api/Company/list'

const COLORS = [
  '#002060', '#70AD47', '#C00000', '#4527A0', '#0F6E56',
  '#7F6000', '#1F4E79', '#375623', '#6B7280',
]

type FormState = { codigo: string; nombre: string; descripcion: string; color: string; activo: boolean }

function emptyForm(): FormState {
  return { codigo: '', nombre: '', descripcion: '', color: '#002060', activo: true }
}

function fromDoc(e: EmpresaDoc): FormState {
  return {
    codigo: e.codigo,
    nombre: e.nombre,
    descripcion: e.descripcion ?? '',
    color: e.color ?? '#002060',
    activo: e.activo !== false,
  }
}

export function EmpresasPage() {
  const [rows, setRows] = useState<EmpresaDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<EmpresaDoc | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)

  const [cfgOpen, setCfgOpen] = useState(false)
  const [listUrl, setListUrl] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const list = await fetchEmpresas()
      setRows(list)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const [filterOrigen, setFilterOrigen] = useState<'all' | 'ehr' | 'manual'>('all')

  const displayed = useMemo(() => {
    if (filterOrigen === 'all') return rows
    return rows.filter((e) => (e.origen === 'ehr' ? 'ehr' : 'manual') === filterOrigen)
  }, [rows, filterOrigen])

  const eliminablesIds = useMemo(
    () => displayed.filter((e) => e.origen !== 'ehr').map((e) => e._id),
    [displayed],
  )
  const bulk = useMaestroBulkDelete({
    recurso: 'empresas',
    visibleIds: eliminablesIds,
    etiqueta: 'empresa(s)',
    confirmar: (n) =>
      `¿Eliminar ${n} empresa(s) manuales? Las sincronizadas desde EHR no se incluyen.`,
    onAfterDelete: reload,
  })

  function openNew() {
    setEditing(null)
    setForm(emptyForm())
    setOpen(true)
  }

  function openEdit(e: EmpresaDoc) {
    setEditing(e)
    setForm(fromDoc(e))
    setOpen(true)
  }

  async function handleSave() {
    if (!form.codigo.trim() || !form.nombre.trim()) return
    setSaving(true)
    try {
      const body = {
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        color: form.color.trim() || '#002060',
        activo: form.activo,
      }
      if (editing) {
        if (editing.origen === 'ehr') {
          await updateEmpresa(editing._id, {
            descripcion: body.descripcion,
            color: body.color,
            activo: body.activo,
          })
        } else {
          await updateEmpresa(editing._id, body)
        }
      } else {
        await createEmpresa(body)
      }
      setOpen(false)
      await reload()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function openCfg() {
    setCfgOpen(true)
    setSyncResult(null)
    try {
      const { url } = await fetchEmpresasListUrl()
      setListUrl(url)
    } catch {
      /* ignore */
    }
  }

  async function handleSaveCfg() {
    try {
      await saveEmpresasListUrl(listUrl)
      window.alert('URL guardada')
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error')
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const r = await syncEmpresas()
      setSyncResult(
        `Sincronización completa — ${r.insertados} nuevas, ${r.actualizados} actualizadas, ${r.errores} omitidas (filas API: ${r.total}).`,
      )
      await reload()
    } catch (e) {
      setSyncResult(`Error: ${e instanceof Error ? e.message : 'desconocido'}`)
    } finally {
      setSyncing(false)
    }
  }

  async function handleDelete(e: EmpresaDoc) {
    if (e.origen === 'ehr') {
      window.alert(
        'Las empresas del EHR no se eliminan desde aquí. Desactívalas en el formulario de edición si no deben usarse.',
      )
      return
    }
    if (!window.confirm(`¿Eliminar la empresa «${e.nombre}»?`)) return
    try {
      await deleteEmpresa(e._id)
      await reload()
    } catch (ex) {
      window.alert(ex instanceof Error ? ex.message : 'Error al eliminar')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Empresas del grupo</h2>
          <p className="text-sm text-muted-foreground">
            Catálogo para proyectos. El listado principal se sincroniza desde el EHR RCJ (
            <code className="text-xs">Company/list</code>
            ); puedes agregar empresas manuales adicionales.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={() => void openCfg()}>
            <Cable className="size-4" />
            Listado EHR
          </Button>
          <BoardPrimaryButton onClick={openNew}>
            <Plus className="size-4" /> Nueva empresa
          </BoardPrimaryButton>
        </div>
      </div>

      {err && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {err}
        </div>
      )}

      {!loading && bulk.showBar && (
        <MaestroBulkDeleteBar
          seleccionCount={bulk.seleccionCount}
          bulkDeleting={bulk.bulkDeleting}
          onEliminar={() => void bulk.handleEliminarSeleccionados()}
          etiqueta="empresas"
        />
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <EntityBoard
          rows={displayed}
          countLabel="empresa"
          emptyMessage="Sin empresas en base de datos. Abre «Listado EHR» y pulsa «Sincronizar ahora», o crea una empresa manual."
          searchTexts={(e) => [e.codigo, e.nombre, e.descripcion, String(e.ehr_empresa_id ?? '')]}
          toolbarLeft={
            <div className="grid gap-1">
              <label className="text-xs" style={{ color: BOARD.muted }}>Origen</label>
              <select
                className={MAESTRO_SELECT_CLASS + ' min-w-[120px]'}
                value={filterOrigen}
                onChange={(e) => setFilterOrigen(e.target.value as typeof filterOrigen)}
              >
                <option value="all">Todos</option>
                <option value="ehr">EHR</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          }
          columns={[
            {
              id: 'sel',
              label: '',
              className: 'w-8',
              render: (e) =>
                e.origen !== 'ehr' ? (
                  <input
                    type="checkbox"
                    className="size-3.5 accent-[var(--navy)]"
                    checked={bulk.selectedIds.has(e._id)}
                    onChange={() => bulk.toggle(e._id)}
                    aria-label={`Seleccionar ${e.nombre}`}
                  />
                ) : null,
            },
            {
              id: 'codigo',
              label: 'Código',
              className: 'w-[100px]',
              render: (e) => <span className="font-mono text-xs font-medium">{e.codigo}</span>,
            },
            {
              id: 'nombre',
              label: 'Nombre',
              render: (e) => (
                <span className="inline-flex items-center gap-2 font-medium">
                  <span className="size-2.5 rounded-full" style={{ background: e.color ?? '#002060' }} />
                  <Factory className="size-3.5" style={{ color: BOARD.muted }} />
                  {e.nombre}
                </span>
              ),
            },
            {
              id: 'origen',
              label: 'Origen',
              render: (e) => (
                <BoardPill
                  label={e.origen === 'ehr' ? 'EHR' : 'Manual'}
                  bg={e.origen === 'ehr' ? BOARD.primary : BOARD.gray}
                  text={e.origen === 'ehr' ? '#fff' : BOARD.text}
                />
              ),
            },
            {
              id: 'ehr_id',
              label: 'ID EHR',
              align: 'right',
              render: (e) => (
                <span className="font-mono text-xs" style={{ color: BOARD.muted }}>
                  {e.ehr_empresa_id != null ? e.ehr_empresa_id : '—'}
                </span>
              ),
            },
            {
              id: 'estado',
              label: 'Estado',
              render: (e) => (
                <BoardPill
                  label={e.activo !== false ? 'Activa' : 'Inactiva'}
                  bg={e.activo !== false ? BOARD.green : BOARD.gray}
                  text={e.activo !== false ? '#fff' : BOARD.text}
                />
              ),
            },
            {
              id: 'acciones',
              label: 'Acciones',
              align: 'right',
              render: (e) => (
                <div className="flex justify-end gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => openEdit(e)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    disabled={e.origen === 'ehr'}
                    title={e.origen === 'ehr' ? 'No eliminable (EHR)' : 'Eliminar'}
                    onClick={() => void handleDelete(e)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? editing.origen === 'ehr'
                  ? 'Editar empresa (EHR)'
                  : 'Editar empresa'
                : 'Nueva empresa'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {editing?.origen === 'ehr' && (
              <p className="rounded-md border border-[var(--blue-lt)] bg-[var(--blue-lt)]/40 px-3 py-2 text-xs text-muted-foreground">
                Nombre y código los define el EHR; se actualizan al pulsar «Sincronizar ahora» en Listado EHR. Aquí solo
                ajustas color, descripción y si está activa en formularios.
              </p>
            )}
            <div className="grid gap-2">
              <Label htmlFor="e-cod">Código <span className="text-destructive">*</span></Label>
              <Input
                id="e-cod"
                value={form.codigo}
                disabled={Boolean(editing)}
                onChange={(ev) => setForm((s) => ({ ...s, codigo: ev.target.value }))}
                placeholder="TECNO, LOGISTICA…"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-nom">Nombre <span className="text-destructive">*</span></Label>
              <Input
                id="e-nom"
                value={form.nombre}
                disabled={editing?.origen === 'ehr'}
                onChange={(ev) => setForm((s) => ({ ...s, nombre: ev.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-desc">Descripción</Label>
              <Textarea
                id="e-desc"
                rows={2}
                value={form.descripcion}
                onChange={(ev) => setForm((s) => ({ ...s, descripcion: ev.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    className={`size-8 rounded-full border-2 ${form.color === c ? 'border-[var(--navy)]' : 'border-transparent'}`}
                    style={{ background: c }}
                    onClick={() => setForm((s) => ({ ...s, color: c }))}
                  />
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--lime)]"
                checked={form.activo}
                onChange={(ev) => setForm((s) => ({ ...s, activo: ev.target.checked }))}
              />
              Activa en catálogos y formularios
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              type="button"
              disabled={saving}
              className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
              onClick={() => void handleSave()}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cfgOpen} onOpenChange={setCfgOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Listado de empresas (EHR)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              URL del endpoint que devuelve sociedades en formato JSON. Si dejas la URL vacía y guardas, el servidor usa
              la URL por defecto del EHR RCJ.
            </p>
            <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              El API EHR requiere autenticación. Configura usuario, contraseña e inicia sesión en{' '}
              <strong className="text-[var(--navy)]">Maestros → Empleados → Servicio externo</strong>; el mismo token
              se usa aquí al sincronizar empresas.
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-xs">
{`{
  "data": [
    { "empresaId": 1, "nombre": "Tecno Supplier S.A De C.V." }
  ]
}`}
            </pre>
            <div className="grid gap-2">
              <Label>URL del listado</Label>
              <Input
                value={listUrl}
                onChange={(ev) => setListUrl(ev.target.value)}
                placeholder={DEFAULT_EHR_COMPANY_LIST_URL}
              />
            </div>
            {syncResult && (
              <p
                className={`rounded-md px-3 py-2 text-sm ${
                  syncResult.startsWith('Error')
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-[var(--lime-lt)] text-[var(--navy)]'
                }`}
              >
                {syncResult}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Button type="button" variant="outline" className="gap-2" onClick={() => void handleSaveCfg()}>
                <Save className="size-4" />
                Guardar URL
              </Button>
              <Button
                type="button"
                disabled={syncing}
                className="gap-2 bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90"
                onClick={() => void handleSync()}
              >
                <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
              </Button>
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Settings2 className="size-3.5" />
                Local
              </span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCfgOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
