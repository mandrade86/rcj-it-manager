import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Cable, Factory, Pencil, Plus, RefreshCw, Save, Settings2, Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { MaestroBulkDeleteBar } from '@/components/maestros/MaestroBulkDeleteBar'
import { MaestroListToolbar } from '@/components/maestros/MaestroListToolbar'
import { MaestroSortableHead } from '@/components/maestros/MaestroSortableHead'
import { MaestroSelectAllHeader } from '@/components/maestros/MaestroTableSelection'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { useMaestroBulkDelete } from '@/hooks/useMaestroBulkDelete'
import { usePagination } from '@/hooks/usePagination'
import { useMaestroList } from '@/hooks/useMaestroList'
import { MAESTRO_SELECT_CLASS, compareNumbers, compareStrings, type MaestroSortDir } from '@/lib/maestroList'
import {
  createEmpresa, deleteEmpresa, fetchEmpresas, fetchEmpresasListUrl,
  saveEmpresasListUrl, syncEmpresas, updateEmpresa,
} from '@/lib/api/empresas'
import type { EmpresaDoc } from '@/types/empresa'

const DEFAULT_EHR_COMPANY_LIST_URL = 'https://ehr.rcjcorp.hn:8095/api/Company/list'

const COLORS = [
  '#002060', '#70AD47', '#C00000', '#4527A0', '#0F6E56',
  '#7F6000', '#1F4E79', '#375623', '#6B7280',
]

type FormState = { codigo: string; nombre: string; descripcion: string; color: string; activo: boolean }

function emptyForm(): FormState {
  return { codigo: '', nombre: '', descripcion: '', color: '#002060', activo: true }
}

function compareEmpresas(
  a: EmpresaDoc,
  b: EmpresaDoc,
  sortKey: string,
  dir: MaestroSortDir,
): number {
  switch (sortKey) {
    case 'origen':
      return compareStrings(a.origen ?? 'manual', b.origen ?? 'manual', dir)
    case 'ehr_id':
      return compareNumbers(a.ehr_empresa_id ?? 0, b.ehr_empresa_id ?? 0, dir)
    case 'nombre':
      return compareStrings(a.nombre, b.nombre, dir)
    case 'codigo':
    default:
      return compareStrings(a.codigo, b.codigo, dir)
  }
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

  const maestro = useMaestroList({
    items: rows,
    defaultSortKey: 'nombre',
    getActivo: (e) => e.activo !== false,
    searchTexts: (e) => [e.codigo, e.nombre, e.descripcion, String(e.ehr_empresa_id ?? '')],
    compare: compareEmpresas,
  })
  const { rows: filtered, busqueda, setBusqueda, filterActivo, setFilterActivo, sortKey, sortDir, onSort, total } =
    maestro

  const displayed = useMemo(() => {
    if (filterOrigen === 'all') return filtered
    return filtered.filter((e) => (e.origen === 'ehr' ? 'ehr' : 'manual') === filterOrigen)
  }, [filtered, filterOrigen])

  const pagination = usePagination(displayed.length, {
    resetKey: `${busqueda}|${filterActivo}|${sortKey}|${sortDir}|${filterOrigen}|${total}`,
  })
  const pageRows = pagination.slice(displayed)

  const eliminablesIds = useMemo(
    () => pageRows.filter((e) => e.origen !== 'ehr').map((e) => e._id),
    [pageRows],
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
          <Button
            type="button"
            className="gap-1.5 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
            onClick={openNew}
          >
            <Plus className="size-4" />
            Nueva empresa
          </Button>
        </div>
      </div>

      {err && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {err}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <MaestroListToolbar
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          busquedaPlaceholder="Código, nombre, ID EHR…"
          filterActivo={filterActivo}
          onFilterActivoChange={setFilterActivo}
          count={displayed.length}
          total={total}
          countLabel="empresa(s)"
        >
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Origen</label>
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
        </MaestroListToolbar>
      )}

      {!loading && bulk.showBar && (
        <MaestroBulkDeleteBar
          seleccionCount={bulk.seleccionCount}
          bulkDeleting={bulk.bulkDeleting}
          onEliminar={() => void bulk.handleEliminarSeleccionados()}
          etiqueta="empresas"
        />
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Sin empresas en base de datos. Abre «Listado EHR» y pulsa «Sincronizar ahora» para importar desde el
              endpoint Company/list, o crea una empresa manual.
            </p>
          ) : displayed.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Ninguna empresa coincide con los filtros.</p>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <MaestroSelectAllHeader
                    allSelected={bulk.allSelected}
                    someSelected={bulk.someSelected}
                    onToggleAll={bulk.toggleAll}
                  />
                  <MaestroSortableHead column="codigo" label="Código" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[100px]" />
                  <MaestroSortableHead column="nombre" label="Nombre" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                  <MaestroSortableHead column="origen" label="Origen" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[88px]" />
                  <MaestroSortableHead column="ehr_id" label="ID EHR" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-[72px] text-right" />
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((e) => (
                  <TableRow key={e._id}>
                    <TableCell className="w-10 pr-0">
                      {e.origen !== 'ehr' ? (
                        <input
                          type="checkbox"
                          className="size-3.5 accent-[var(--lime)]"
                          checked={bulk.selectedIds.has(e._id)}
                          onChange={() => bulk.toggle(e._id)}
                          aria-label={`Seleccionar ${e.nombre}`}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium">{e.codigo}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ background: e.color ?? '#002060' }}
                        />
                        <Factory className="size-3.5 text-muted-foreground" />
                        {e.nombre}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={e.origen === 'ehr' ? 'default' : 'outline'}
                        className={`text-[10px] ${e.origen === 'ehr' ? 'bg-[var(--navy)] text-white' : ''}`}
                      >
                        {e.origen === 'ehr' ? 'EHR' : 'Manual'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {e.ehr_empresa_id != null ? e.ehr_empresa_id : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.activo !== false ? 'secondary' : 'outline'} className="text-[10px]">
                        {e.activo !== false ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                ))}
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
          )}
        </CardContent>
      </Card>

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
