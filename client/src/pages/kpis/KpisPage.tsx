import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Lightbulb, Pencil, Plus, Target, Trash2 } from 'lucide-react'

import { GaugeRing } from '@/components/kpis/GaugeRing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { Textarea } from '@/components/ui/textarea'
import { MetasDepartamentoDialog } from '@/components/kpis/MetasDepartamentoDialog'
import { usePagination } from '@/hooks/usePagination'
import { fetchDepartamentos, updateDepartamentoMetas } from '@/lib/api/departamentos'
import {
  getMetasDepartamento,
  metasEditorFromDepartamento,
  tituloMeta,
} from '@/lib/metasDepartamento'
import { fetchEjesProyecto } from '@/lib/api/ejesProyecto'
import { fetchProyectos } from '@/lib/api/proyectos'
import { normalizeKpiTipo } from '@/lib/kpiProyectoVinculo'
import {
  aplicarKpiSugerencias,
  createKpi,
  deleteKpi,
  deleteKpisLote,
  fetchKpiRegistros,
  fetchKpiSugerencias,
  fetchKpis,
  postKpiRegistro,
  updateKpi,
} from '@/lib/api/kpis'
import { formatDateDMY } from '@/lib/format'
import { useAuthStore } from '@/store/authStore'
import {
  KPI_TIPO_CALCULO_LABELS,
  META_TIPO_CALCULO_LABELS,
  KPI_TIPOS_CALCULO,
  META_TIPOS_CALCULO,
  type KpiTipoCalculo,
  type MetaTipoCalculo,
} from '@/lib/kpiCalculoTipos'
import {
  labelTipoCalculoKpi,
  pctCumplimientoKpi,
  pctMetaFromKpiList,
  ultimoRegistro,
} from '@/lib/kpiAvance'
import type { DepartamentoDoc } from '@/types/departamento'
import {
  kpiDepartamentoId,
  kpiDepartamentoRef,
  kpiProyectoIdList,
  metaEstrategicaDeKpi,
  type KpiDoc,
  type KpiRegistro,
  type KpiSugerenciaItem,
} from '@/types/kpi'
import type { MetaEstrategicaDepto } from '@/types/departamento'
import type { Proyecto } from '@/types/proyecto'
import { mergeKpiInList, normalizeKpiFromApi, notifyKpiDataChanged } from '@/lib/kpiSync'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function fmtValor(v: number | null | undefined, unidad?: string | null): string {
  if (v == null || Number.isNaN(Number(v))) return '—'
  const u = (unidad ?? '').toLowerCase()
  if (u.includes('%')) return `${Number(v).toLocaleString('es-HN', { maximumFractionDigits: 2 })} %`
  if (u.includes('hora')) return `${Number(v).toLocaleString('es-HN', { maximumFractionDigits: 2 })} h`
  if (u.includes('persona')) return String(v)
  return Number(v).toLocaleString('es-HN', { maximumFractionDigits: 2 })
}

const FRECUENCIAS = ['Mensual', 'Trimestral', 'Anual', 'Único'] as const

type EditorForm = {
  departamento_id: string
  meta_id: string
  eje: string
  nombre: string
  descripcion: string
  meta: string
  unidad: string
  frecuencia: string
  responsable: string
  tipo_calculo: KpiTipoCalculo
  proyecto_ids: string[]
}

const emptyForm: EditorForm = {
  departamento_id: '',
  meta_id: '',
  eje: '',
  nombre: '',
  descripcion: '',
  meta: '',
  unidad: '',
  frecuencia: 'Mensual',
  responsable: '',
  tipo_calculo: 'auto_meta',
  proyecto_ids: [],
}

export function KpisPage() {
  const puedeEditarKpis = useAuthStore(
    (s) => s.hasPermiso('*') || s.hasPermiso('kpis:editar'),
  )
  const puedeEliminarKpis = puedeEditarKpis
  const [kpis, setKpis] = useState<KpiDoc[]>([])
  const [departamentos, setDepartamentos] = useState<DepartamentoDoc[]>([])
  const [filtroDepto, setFiltroDepto] = useState<string>('all')
  const [err, setErr] = useState<string | null>(null)

  // Modal registrar valor
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formKpiId, setFormKpiId] = useState('')
  const [formFecha, setFormFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [formValor, setFormValor] = useState('')
  const [formNotas, setFormNotas] = useState('')

  // Modal crear/editar KPI
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorKpi, setEditorKpi] = useState<KpiDoc | null>(null)
  const [editorForm, setEditorForm] = useState<EditorForm>(emptyForm)
  const [editorSaving, setEditorSaving] = useState(false)
  const [ejesMaestro, setEjesMaestro] = useState<string[]>([])
  const [proyectosCandidatos, setProyectosCandidatos] = useState<Proyecto[]>([])
  const [proyectosCargando, setProyectosCargando] = useState(false)

  // Modal sugerencias
  const [sugOpen, setSugOpen] = useState(false)
  const [sugDeptoId, setSugDeptoId] = useState('')
  const [sugCatalogoClave, setSugCatalogoClave] = useState<string | null>(null)
  const [sugItems, setSugItems] = useState<KpiSugerenciaItem[]>([])
  const [sugLoading, setSugLoading] = useState(false)
  const [sugSeleccion, setSugSeleccion] = useState<Set<string>>(new Set())
  const [sugSaving, setSugSaving] = useState(false)

  // Tendencia
  const [trendKpiId, setTrendKpiId] = useState('')
  const [trendRows, setTrendRows] = useState<{ fecha: string; valor: number }[]>([])
  const [trendLoading, setTrendLoading] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const [metasEditor, setMetasEditor] = useState<MetaEstrategicaDepto[]>([])
  const [metasDirty, setMetasDirty] = useState(false)
  const [metasSaving, setMetasSaving] = useState(false)
  const [metasDialogOpen, setMetasDialogOpen] = useState(false)

  const reload = useCallback(async () => {
    setErr(null)
    try {
      const [k, d, ejes] = await Promise.all([
        fetchKpis(
          filtroDepto === 'all'
            ? undefined
            : { departamento_id: filtroDepto === 'none' ? 'none' : filtroDepto },
        ),
        fetchDepartamentos(),
        fetchEjesProyecto({ activo: true }).catch(() => []),
      ])
      setKpis(k)
      setDepartamentos(d.filter((x) => x.activo !== false))
      setEjesMaestro(
        ejes
          .filter((e) => e.activo !== false)
          .map((e) => e.nombre.trim())
          .filter(Boolean),
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    }
  }, [filtroDepto])

  const applyKpiUpdate = useCallback(
    (updated: KpiDoc) => {
      setKpis((prev) => mergeKpiInList(prev, normalizeKpiFromApi(updated)))
      notifyKpiDataChanged()
    },
    [],
  )

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [filtroDepto])

  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(kpis.map((k) => k._id))
      const next = new Set([...prev].filter((id) => valid.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [kpis])

  const kpisOrdenados = useMemo(
    () =>
      [...kpis].sort(
        (a, b) =>
          a.eje.localeCompare(b.eje, 'es') || a.nombre.localeCompare(b.nombre, 'es'),
      ),
    [kpis],
  )

  const paginationKpis = usePagination(kpisOrdenados.length, {
    resetKey: `${filtroDepto}|${kpisOrdenados.length}`,
  })
  const kpisPagina = paginationKpis.slice(kpisOrdenados)

  const deptSeleccionado = useMemo(() => {
    if (filtroDepto === 'all' || filtroDepto === 'none') return null
    return departamentos.find((d) => d._id === filtroDepto) ?? null
  }, [departamentos, filtroDepto])

  const metasVisibles = useMemo(
    () => getMetasDepartamento(deptSeleccionado),
    [deptSeleccionado],
  )

  useEffect(() => {
    setMetasEditor(metasEditorFromDepartamento(deptSeleccionado))
    setMetasDirty(false)
  }, [deptSeleccionado?._id, deptSeleccionado?.metas_estrategicas])

  const porMeta = useMemo(() => {
    const m = new Map<string, KpiDoc[]>()
    for (const me of metasVisibles) m.set(me.id, [])
    for (const k of kpis) {
      const id = metaEstrategicaDeKpi(k)
      if (!m.has(id)) m.set(id, [])
      m.get(id)!.push(k)
    }
    return m
  }, [kpis, metasVisibles])

  useEffect(() => {
    if (!trendKpiId) {
      setTrendRows([])
      return
    }
    let cancel = false
    void (async () => {
      setTrendLoading(true)
      try {
        const d = await fetchKpiRegistros(trendKpiId)
        if (cancel) return
        const pts = d.registros
          .filter((r: KpiRegistro) => r.valor != null && !Number.isNaN(Number(r.valor)))
          .map((r: KpiRegistro) => ({
            fecha: formatDateDMY(r.fecha),
            valor: Number(r.valor),
            _sort: new Date(r.fecha).getTime(),
          }))
          .sort((a: { _sort: number }, b: { _sort: number }) => a._sort - b._sort)
          .map(({ fecha, valor }: { fecha: string; valor: number }) => ({ fecha, valor }))
        setTrendRows(pts)
      } catch {
        if (!cancel) setTrendRows([])
      } finally {
        if (!cancel) setTrendLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [trendKpiId])

  useEffect(() => {
    if (kpisOrdenados.length && !trendKpiId) {
      setTrendKpiId(kpisOrdenados[0]._id)
    }
  }, [kpisOrdenados, trendKpiId])

  function openCrearKpi() {
    setEditorKpi(null)
    const deptId =
      filtroDepto !== 'all' && filtroDepto !== 'none' ? filtroDepto : ''
    const primeraMeta = deptId
      ? getMetasDepartamento(departamentos.find((d) => d._id === deptId)).find(
          (m) => m.activa !== false,
        )?.id ?? ''
      : ''
    setEditorForm({
      ...emptyForm,
      departamento_id: deptId,
      meta_id: primeraMeta,
    })
    setEditorOpen(true)
  }

  function openEditarKpi(k: KpiDoc) {
    setEditorKpi(k)
    setEditorForm({
      departamento_id: kpiDepartamentoId(k) ?? '',
      meta_id: metaEstrategicaDeKpi(k),
      eje: k.eje ?? '',
      nombre: k.nombre ?? '',
      descripcion: k.descripcion ?? '',
      meta: k.meta ?? '',
      unidad: k.unidad ?? '',
      frecuencia: (k.frecuencia as string) ?? 'Mensual',
      responsable: k.responsable ?? '',
      tipo_calculo: (k.tipo_calculo as KpiTipoCalculo) ?? 'auto_meta',
      proyecto_ids: kpiProyectoIdList(k),
    })
    setEditorOpen(true)
  }

  const ejesTipoOpciones = useMemo(() => {
    const set = new Set<string>(ejesMaestro)
    for (const k of kpis) {
      if (k.eje?.trim()) set.add(k.eje.trim())
    }
    if (editorForm.eje.trim()) set.add(editorForm.eje.trim())
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [ejesMaestro, kpis, editorForm.eje])

  useEffect(() => {
    if (!editorOpen) return
    const dept = editorForm.departamento_id
    const tipo = normalizeKpiTipo(editorForm.eje)
    if (!dept) {
      setProyectosCandidatos([])
      return
    }
    let cancel = false
    void (async () => {
      setProyectosCargando(true)
      try {
        const rows = await fetchProyectos({ departamento_id: dept })
        if (cancel) return
        const filtrados = tipo
          ? rows.filter((p) => normalizeKpiTipo(p.eje) === tipo)
          : rows
        setProyectosCandidatos(filtrados)
        if (!editorKpi) {
          setEditorForm((f) => ({
            ...f,
            proyecto_ids: filtrados.map((p) => p._id),
          }))
        }
      } catch {
        if (!cancel) setProyectosCandidatos([])
      } finally {
        if (!cancel) setProyectosCargando(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [editorOpen, editorForm.departamento_id, editorForm.eje, editorKpi])

  async function submitEditor(e: React.FormEvent) {
    e.preventDefault()
    if (!editorForm.nombre.trim() || !editorForm.eje.trim()) {
      window.alert('Nombre y tipo (eje) son obligatorios.')
      return
    }
    if (!editorForm.departamento_id) {
      window.alert('Selecciona un departamento para vincular el KPI con proyectos.')
      return
    }
    if (!editorForm.meta_id) {
      window.alert('Selecciona la meta estratégica del departamento para este KPI.')
      return
    }
    setEditorSaving(true)
    try {
      const payload = {
        departamento_id: editorForm.departamento_id || null,
        meta_id: editorForm.meta_id,
        tipo: editorForm.eje.trim(),
        eje: editorForm.eje.trim(),
        nombre: editorForm.nombre.trim(),
        descripcion: editorForm.descripcion.trim() || null,
        meta: editorForm.meta.trim() || null,
        unidad: editorForm.unidad.trim() || null,
        frecuencia: editorForm.frecuencia || null,
        responsable: editorForm.responsable.trim() || null,
        tipo_calculo: editorForm.tipo_calculo,
        proyecto_ids: editorForm.proyecto_ids,
      }
      let saved: KpiDoc
      if (editorKpi) {
        saved = await updateKpi(editorKpi._id, payload)
      } else {
        saved = await createKpi(payload)
      }
      const n = saved.vinculacion?.vinculados ?? editorForm.proyecto_ids.length
      if (n > 0) {
        window.alert(
          `KPI guardado. Vinculado a ${n} proyecto(s) del mismo tipo (eje).`,
        )
      }
      setEditorOpen(false)
      applyKpiUpdate(saved)
      void reload()
    } catch (er) {
      window.alert(er instanceof Error ? er.message : 'Error al guardar KPI')
    } finally {
      setEditorSaving(false)
    }
  }

  async function handleDelete(k: KpiDoc) {
    if (
      !window.confirm(
        `¿Eliminar el KPI "${k.nombre}"? Se borrarán también sus registros históricos.`,
      )
    ) {
      return
    }
    try {
      await deleteKpi(k._id)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(k._id)
        return next
      })
      if (trendKpiId === k._id) setTrendKpiId('')
      notifyKpiDataChanged()
      await reload()
    } catch (er) {
      window.alert(er instanceof Error ? er.message : 'Error al eliminar')
    }
  }

  function toggleSelectKpi(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllKpis() {
    const ids = kpisPagina.map((k) => k._id)
    setSelectedIds((prev) => {
      const all = ids.length > 0 && ids.every((i) => prev.has(i))
      if (all) return new Set()
      return new Set(ids)
    })
  }

  async function handleEliminarSeleccionados() {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const ok = window.confirm(
      `¿Eliminar ${ids.length} KPI(s)? Se borrarán sus registros históricos y se desvincularán de los proyectos asociados.`,
    )
    if (!ok) return
    setBulkDeleting(true)
    try {
      const r = await deleteKpisLote(ids)
      let msg = `Se eliminaron ${r.eliminados} KPI(s).`
      if (r.omitidos.length > 0) {
        msg += `\n\nNo encontrados o inválidos (${r.omitidos.length}): ${r.omitidos.slice(0, 8).join(', ')}${r.omitidos.length > 8 ? '…' : ''}.`
      }
      window.alert(msg)
      if (r.ids.includes(trendKpiId)) setTrendKpiId('')
      setSelectedIds(new Set())
      notifyKpiDataChanged()
      await reload()
    } catch (er) {
      window.alert(er instanceof Error ? er.message : 'No se pudo eliminar el lote')
    } finally {
      setBulkDeleting(false)
    }
  }

  const seleccionCount = selectedIds.size
  const allKpisSelected =
    kpisPagina.length > 0 && kpisPagina.every((k) => selectedIds.has(k._id))
  const someKpisSelected = kpisPagina.some((k) => selectedIds.has(k._id))

  const metasParaCards = metasDirty ? metasEditor : metasVisibles

  const metasOpcionesEditor = useMemo(() => {
    const dept = departamentos.find((d) => d._id === editorForm.departamento_id)
    return getMetasDepartamento(dept ?? null).filter((m) => m.activa !== false)
  }, [departamentos, editorForm.departamento_id])

  async function guardarMetasDepartamento() {
    if (!deptSeleccionado) return
    setMetasSaving(true)
    try {
      const updated = await updateDepartamentoMetas(deptSeleccionado._id, metasEditor)
      setDepartamentos((prev) =>
        prev.map((d) => (d._id === updated._id ? { ...d, ...updated } : d)),
      )
      setMetasDirty(false)
      notifyKpiDataChanged()
      window.alert('Metas del departamento guardadas.')
    } catch (er) {
      window.alert(er instanceof Error ? er.message : 'No se pudieron guardar las metas')
    } finally {
      setMetasSaving(false)
    }
  }

  function patchMetaEditor(id: string, patch: Partial<MetaEstrategicaDepto>) {
    setMetasEditor((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    )
    setMetasDirty(true)
  }

  async function openSugerencias() {
    const deptInicial =
      filtroDepto !== 'all' && filtroDepto !== 'none'
        ? filtroDepto
        : departamentos[0]?._id ?? ''
    setSugDeptoId(deptInicial)
    setSugCatalogoClave(null)
    setSugSeleccion(new Set())
    setSugItems([])
    setSugOpen(true)
    if (deptInicial) await cargarSugerencias(deptInicial)
  }

  async function cargarSugerencias(deptId: string) {
    setSugLoading(true)
    try {
      const r = await fetchKpiSugerencias(deptId)
      setSugCatalogoClave(r.catalogo_clave ?? null)
      setSugItems(r.sugerencias)
      setSugSeleccion(
        new Set(r.sugerencias.filter((s) => !s.yaExiste).map((s) => s.nombre)),
      )
    } catch (er) {
      window.alert(er instanceof Error ? er.message : 'Error al cargar sugerencias')
      setSugCatalogoClave(null)
      setSugItems([])
    } finally {
      setSugLoading(false)
    }
  }

  async function aplicarSugerencias() {
    if (!sugDeptoId) return
    const nombres = Array.from(sugSeleccion)
    if (nombres.length === 0) {
      window.alert('Selecciona al menos un KPI sugerido.')
      return
    }
    setSugSaving(true)
    try {
      const r = await aplicarKpiSugerencias({ departamento_id: sugDeptoId, nombres })
      window.alert(
        `Sugerencias aplicadas: ${r.creados} creados, ${r.omitidos} ya existían.`,
      )
      setSugOpen(false)
      notifyKpiDataChanged()
      await reload()
    } catch (er) {
      window.alert(er instanceof Error ? er.message : 'Error al aplicar sugerencias')
    } finally {
      setSugSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--navy)]">KPIs / Metas</h2>
          <p className="text-sm text-muted-foreground">
            Indicadores y metas por departamento — todo se configura manualmente (KPIs, metas y vínculos).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => void openSugerencias()}
            title="Cargar KPIs sugeridos para un departamento"
          >
            <Lightbulb className="size-4" />
            Sugerencias
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={openCrearKpi}
          >
            <Plus className="size-4" />
            Nuevo KPI
          </Button>
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
              >
                Registrar valor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Registrar valor de KPI</DialogTitle>
              </DialogHeader>
              <form
                className="grid gap-3 py-2"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!formKpiId) {
                    window.alert('Selecciona un KPI.')
                    return
                  }
                  setSaving(true)
                  try {
                    const updated = await postKpiRegistro({
                      kpi_id: formKpiId,
                      fecha: `${formFecha}T12:00:00.000Z`,
                      valor: formValor === '' ? undefined : Number(formValor),
                      notas: formNotas.trim() || undefined,
                    })
                    applyKpiUpdate(updated)
                    if (formKpiId === trendKpiId) {
                      setTrendRows((prev) => {
                        if (formValor === '') return prev
                        const v = Number(formValor)
                        if (Number.isNaN(v)) return prev
                        return [
                          ...prev,
                          { fecha: formatDateDMY(`${formFecha}T12:00:00.000Z`), valor: v },
                        ]
                      })
                    }
                    void reload()
                    setModalOpen(false)
                    setFormNotas('')
                    setFormValor('')
                  } catch (er) {
                    window.alert(er instanceof Error ? er.message : 'Error')
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                <div className="grid gap-2">
                  <Label>KPI</Label>
                  <select
                    required
                    className={selectClass}
                    value={formKpiId}
                    onChange={(e) => setFormKpiId(e.target.value)}
                  >
                    <option value="">Seleccione…</option>
                    {kpisOrdenados.map((k) => {
                      const dRef = kpiDepartamentoRef(k)
                      return (
                        <option key={k._id} value={k._id}>
                          {dRef?.codigo ?? '—'} · {k.eje} · {k.nombre}
                        </option>
                      )
                    })}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kpi-fecha">Fecha</Label>
                  <Input
                    id="kpi-fecha"
                    type="date"
                    required
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kpi-valor">Valor numérico</Label>
                  <Input
                    id="kpi-valor"
                    type="number"
                    step="any"
                    value={formValor}
                    onChange={(e) => setFormValor(e.target.value)}
                    placeholder="Opcional para KPI cualitativo"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kpi-notas">Notas</Label>
                  <Textarea
                    id="kpi-notas"
                    rows={2}
                    value={formNotas}
                    onChange={(e) => setFormNotas(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
                  >
                    {saving ? 'Guardando…' : 'Guardar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Departamento
          </Label>
          <select
            className={selectClass + ' max-w-xs'}
            value={filtroDepto}
            onChange={(e) => setFiltroDepto(e.target.value)}
          >
            <option value="all">Todos los departamentos</option>
            <option value="none">Sin departamento</option>
            {departamentos.map((d) => (
              <option key={d._id} value={d._id}>
                {d.codigo} — {d.nombre}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            {kpis.length} KPI{kpis.length !== 1 ? 's' : ''} visibles
          </span>
          {puedeEditarKpis && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto gap-1.5"
              disabled={!deptSeleccionado}
              title={
                deptSeleccionado
                  ? 'Definir las 5 metas anuales del departamento'
                  : 'Elige un departamento en el filtro'
              }
              onClick={() => setMetasDialogOpen(true)}
            >
              <Target className="size-3.5" />
              Registrar metas
            </Button>
          )}
        </CardContent>
      </Card>

      <MetasDepartamentoDialog
        departamento={deptSeleccionado}
        open={metasDialogOpen}
        onOpenChange={setMetasDialogOpen}
        readOnly={!puedeEditarKpis}
        onSaved={(updated) => {
          setDepartamentos((prev) => prev.map((d) => (d._id === updated._id ? updated : d)))
          setMetasEditor(metasEditorFromDepartamento(updated))
          setMetasDirty(false)
        }}
      />

      {err && (
        <p className="text-sm text-destructive">
          {err}{' '}
          <Button type="button" variant="link" className="h-auto p-0" onClick={() => void reload()}>
            Reintentar
          </Button>
        </p>
      )}

      {deptSeleccionado && puedeEditarKpis && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Configurar metas — {deptSeleccionado.codigo} · {deptSeleccionado.nombre}
            </h3>
            <Button
              type="button"
              size="sm"
              disabled={!metasDirty || metasSaving || metasEditor.length === 0}
              onClick={() => void guardarMetasDepartamento()}
            >
              {metasSaving ? 'Guardando…' : 'Guardar metas del departamento'}
            </Button>
          </div>
          {metasEditor.length === 0 ? (
            <Card className="mb-6 border-dashed">
              <CardContent className="p-4 text-sm text-muted-foreground">
                Sin metas registradas para este departamento. Pulsa{' '}
                <strong className="text-foreground">Registrar metas</strong> arriba para definirlas
                (opcionalmente con la plantilla de 5 metas).
              </CardContent>
            </Card>
          ) : (
          <Card className="mb-6">
            <CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
              {metasEditor.map((me) => (
                <div
                  key={me.id}
                  className="space-y-2 rounded-md border border-border bg-muted/20 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      {me.id}
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--lime)]"
                        checked={me.activa !== false}
                        onChange={(e) => patchMetaEditor(me.id, { activa: e.target.checked })}
                      />
                      Activa
                    </label>
                  </div>
                  <Input
                    value={me.titulo}
                    onChange={(e) => patchMetaEditor(me.id, { titulo: e.target.value })}
                    placeholder="Título de la meta"
                  />
                  <Textarea
                    rows={2}
                    value={me.objetivo}
                    onChange={(e) => patchMetaEditor(me.id, { objetivo: e.target.value })}
                    placeholder="Objetivo / descripción"
                  />
                  <Input
                    value={me.valor_objetivo ?? ''}
                    onChange={(e) =>
                      patchMetaEditor(me.id, { valor_objetivo: e.target.value })
                    }
                    placeholder="Valor objetivo (ej. ≥ 99.7%)"
                  />
                  <div className="grid gap-1">
                    <Label className="text-xs">Cálculo del avance de la meta</Label>
                    <select
                      className={selectClass}
                      value={me.tipo_calculo ?? 'promedio_kpis'}
                      onChange={(e) =>
                        patchMetaEditor(me.id, {
                          tipo_calculo: e.target.value as MetaTipoCalculo,
                        })
                      }
                    >
                      {META_TIPOS_CALCULO.map((t) => (
                        <option key={t} value={t}>
                          {META_TIPO_CALCULO_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          )}
        </section>
      )}

      {filtroDepto === 'all' && (
        <p className="text-sm text-muted-foreground">
          Selecciona un departamento en el filtro superior y pulsa{' '}
          <strong>Registrar metas</strong>, o ve a{' '}
          <Link to="/maestros/departamentos" className="text-[var(--navy)] underline">
            Maestros → Departamentos
          </Link>{' '}
          (ícono de diana en cada fila).
        </p>
      )}

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Metas anuales
          {deptSeleccionado ? ` — ${deptSeleccionado.nombre}` : ' (vista global)'}
        </h3>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {metasParaCards.filter((m) => m.activa !== false).map((me) => {
            const list = porMeta.get(me.id) ?? []
            const pct = pctMetaFromKpiList(list, me)
            return (
              <Card key={me.id}>
                <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
                  <GaugeRing value={pct} size={100} className="shrink-0" />
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-base leading-tight">{me.titulo}</CardTitle>
                    <p className="text-xs text-muted-foreground">{me.objetivo}</p>
                    {me.valor_objetivo ? (
                      <p className="text-xs font-medium text-[var(--navy)]">
                        Meta: {me.valor_objetivo}
                      </p>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 border-t border-border pt-3 text-xs">
                  <p className="font-medium text-muted-foreground">KPIs y último registro</p>
                  <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                    {list.map((k) => {
                      const ur = ultimoRegistro(k)
                      const kpiPct = pctCumplimientoKpi(k)
                      return (
                        <li key={k._id} className="flex justify-between gap-2 text-muted-foreground">
                          <span className="min-w-0 truncate text-foreground">{k.nombre}</span>
                          <span className="shrink-0 text-right tabular-nums text-[11px]">
                            <span className="font-medium text-[var(--navy)]">{kpiPct}%</span>
                            {ur ? (
                              <span className="block text-muted-foreground">
                                {fmtValor(ur.valor ?? null, k.unidad)}
                              </span>
                            ) : (
                              <span className="block">Sin dato</span>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Catálogo de KPIs
        </h3>
        {puedeEliminarKpis && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              {seleccionCount === 0
                ? 'Marca KPIs en la tabla para eliminarlos en lote.'
                : `${seleccionCount} seleccionado(s).`}
            </span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-1.5"
              disabled={seleccionCount === 0 || bulkDeleting}
              onClick={() => void handleEliminarSeleccionados()}
            >
              <Trash2 className="size-3.5" />
              {bulkDeleting ? 'Eliminando…' : 'Eliminar seleccionados'}
            </Button>
          </div>
        )}
        <Card>
          <CardContent className="p-0">
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  {puedeEliminarKpis && (
                    <TableHead className="w-10 pr-0">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--lime)]"
                        checked={allKpisSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = !allKpisSelected && someKpisSelected
                        }}
                        onChange={toggleSelectAllKpis}
                        title="Seleccionar todos en la lista"
                      />
                    </TableHead>
                  )}
                  <TableHead className="w-[140px]">Departamento</TableHead>
                  <TableHead className="w-[140px]">Eje</TableHead>
                  <TableHead className="w-[130px]">Meta anual</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="w-[160px]">Objetivo</TableHead>
                  <TableHead className="w-[110px]">Frecuencia</TableHead>
                  <TableHead className="w-[120px]">Cálculo</TableHead>
                  <TableHead className="w-[140px]">Último valor</TableHead>
                  <TableHead className="w-[90px] text-center">Cumplim.</TableHead>
                  <TableHead className="w-[110px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpisOrdenados.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={puedeEliminarKpis ? 11 : 10}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      No hay KPIs para este filtro. Usa «Sugerencias» o «Nuevo KPI».
                    </TableCell>
                  </TableRow>
                )}
                {kpisPagina.map((k) => {
                  const dRef = kpiDepartamentoRef(k)
                  const ur = ultimoRegistro(k)
                  const pct = pctCumplimientoKpi(k)
                  return (
                    <TableRow key={k._id}>
                      {puedeEliminarKpis && (
                        <TableCell className="w-10 pr-0">
                          <input
                            type="checkbox"
                            className="size-3.5 accent-[var(--lime)]"
                            checked={selectedIds.has(k._id)}
                            onChange={() => toggleSelectKpi(k._id)}
                            aria-label={`Seleccionar ${k.nombre}`}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        {dRef ? (
                          <Badge
                            variant="outline"
                            className="border"
                            style={{ borderColor: dRef.color ?? '#002060', color: dRef.color ?? '#002060' }}
                          >
                            {dRef.codigo ?? '—'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin asignar</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs uppercase text-muted-foreground">
                        {k.eje}
                      </TableCell>
                      <TableCell className="text-xs">
                        {tituloMeta(metasVisibles, metaEstrategicaDeKpi(k))}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium leading-snug">{k.nombre}</p>
                        {k.descripcion && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{k.descripcion}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {k.meta ?? '—'}{' '}
                        {k.unidad && <span className="text-xs text-muted-foreground">({k.unidad})</span>}
                      </TableCell>
                      <TableCell className="text-sm">{k.frecuencia ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {labelTipoCalculoKpi(k)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {ur ? (
                          <>
                            <span className="font-medium tabular-nums">
                              {fmtValor(ur.valor ?? null, k.unidad)}
                            </span>
                            <div className="text-[11px] text-muted-foreground">
                              {formatDateDMY(ur.fecha)}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin dato</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center">
                          <GaugeRing value={pct} size={42} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => openEditarKpi(k)}
                            title="Editar"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          {puedeEliminarKpis && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-destructive hover:text-destructive"
                              onClick={() => void handleDelete(k)}
                              title="Eliminar"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <PaginationBar
              page={paginationKpis.page}
              totalPages={paginationKpis.totalPages}
              pageSize={paginationKpis.pageSize}
              totalItems={paginationKpis.totalItems}
              fromItem={paginationKpis.fromItem}
              toItem={paginationKpis.toItem}
              onPageChange={paginationKpis.setPage}
              onPageSizeChange={paginationKpis.setPageSize}
            />
            </>
          </CardContent>
        </Card>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Tendencia en el tiempo
        </h3>
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <CardTitle className="text-base">Evolución por KPI</CardTitle>
            <div className="grid gap-2 sm:w-80">
              <Label className="text-xs">KPI seleccionado</Label>
              <select
                className={selectClass}
                value={trendKpiId}
                onChange={(e) => setTrendKpiId(e.target.value)}
              >
                {kpisOrdenados.map((k) => (
                  <option key={k._id} value={k._id}>
                    {k.nombre}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="h-[min(360px,45vh)] min-h-[260px] w-full">
            {trendLoading && <p className="text-sm text-muted-foreground">Cargando serie…</p>}
            {!trendLoading && trendRows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay registros numéricos para graficar. Usa «Registrar valor».
              </p>
            )}
            {!trendLoading && trendRows.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendRows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [
                      typeof value === 'number'
                        ? value.toLocaleString('es-HN', { maximumFractionDigits: 2 })
                        : String(value),
                      'Valor',
                    ]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="valor"
                    name="Valor"
                    stroke="#002060"
                    strokeWidth={2}
                    dot={{ fill: '#70AD47', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Editor KPI */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editorKpi ? 'Editar KPI' : 'Nuevo KPI'}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3 py-2 sm:grid-cols-2" onSubmit={(e) => void submitEditor(e)}>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Departamento</Label>
              <select
                className={selectClass}
                value={editorForm.departamento_id}
                onChange={(e) => {
                  const deptId = e.target.value
                  const dept = departamentos.find((d) => d._id === deptId)
                  const primera = getMetasDepartamento(dept ?? null).find((m) => m.activa !== false)
                  setEditorForm((f) => ({
                    ...f,
                    departamento_id: deptId,
                    meta_id: primera?.id ?? '',
                    proyecto_ids: [],
                  }))
                }}
              >
                <option value="">— Sin departamento —</option>
                {departamentos.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.codigo} — {d.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="ed-meta-id">Meta estratégica del departamento *</Label>
              <select
                id="ed-meta-id"
                className={selectClass}
                required
                value={editorForm.meta_id}
                disabled={!editorForm.departamento_id || metasOpcionesEditor.length === 0}
                onChange={(e) =>
                  setEditorForm((f) => ({
                    ...f,
                    meta_id: e.target.value,
                  }))
                }
              >
                <option value="">— Selecciona meta —</option>
                {metasOpcionesEditor.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.titulo}
                    {m.valor_objetivo ? ` (${m.valor_objetivo})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Agrupa el KPI bajo una meta del departamento (Maestros → Metas).
              </p>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="ed-eje">Tipo de KPI (eje del proyecto) *</Label>
              <select
                id="ed-eje"
                className={selectClass}
                required
                value={editorForm.eje}
                onChange={(e) =>
                  setEditorForm((f) => ({
                    ...f,
                    eje: e.target.value,
                    proyecto_ids: [],
                  }))
                }
              >
                <option value="">— Selecciona tipo / eje —</option>
                {ejesTipoOpciones.map((eje) => (
                  <option key={eje} value={eje}>
                    {eje}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Al guardar, el KPI se vincula a los proyectos del departamento con este mismo eje
                (puedes ajustar la lista abajo).
              </p>
            </div>
            <div className="grid gap-2 sm:col-span-2 rounded-md border border-border bg-muted/20 p-3">
              <Label className="text-sm font-medium">Proyectos vinculados (mismo tipo / eje)</Label>
              {!editorForm.departamento_id ? (
                <p className="text-xs text-muted-foreground">Selecciona un departamento primero.</p>
              ) : !editorForm.eje.trim() ? (
                <p className="text-xs text-muted-foreground">Selecciona el tipo de KPI (eje).</p>
              ) : proyectosCargando ? (
                <p className="text-xs text-muted-foreground">Cargando proyectos…</p>
              ) : proyectosCandidatos.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No hay proyectos en este departamento con el eje «{editorForm.eje}».
                </p>
              ) : (
                <div className="max-h-36 space-y-2 overflow-y-auto">
                  {proyectosCandidatos.map((p) => (
                    <label
                      key={p._id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted/60"
                    >
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--lime)]"
                        checked={editorForm.proyecto_ids.includes(p._id)}
                        onChange={() => {
                          setEditorForm((f) => ({
                            ...f,
                            proyecto_ids: f.proyecto_ids.includes(p._id)
                              ? f.proyecto_ids.filter((id) => id !== p._id)
                              : [...f.proyecto_ids, p._id],
                          }))
                        }}
                      />
                      <span className="font-mono text-[10px] text-muted-foreground">{p._id}</span>
                      <span className="truncate">{p.nombre}</span>
                    </label>
                  ))}
                </div>
              )}
              {proyectosCandidatos.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {editorForm.proyecto_ids.length} de {proyectosCandidatos.length} proyecto(s)
                  seleccionado(s).
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ed-nombre">Nombre del KPI *</Label>
              <Input
                id="ed-nombre"
                required
                value={editorForm.nombre}
                onChange={(e) => setEditorForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="ed-desc">Descripción</Label>
              <Textarea
                id="ed-desc"
                rows={2}
                value={editorForm.descripcion}
                onChange={(e) => setEditorForm((f) => ({ ...f, descripcion: e.target.value }))}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="ed-tipo-calculo">Cálculo del cumplimiento</Label>
              <select
                id="ed-tipo-calculo"
                className={selectClass}
                value={editorForm.tipo_calculo}
                onChange={(e) =>
                  setEditorForm((f) => ({
                    ...f,
                    tipo_calculo: e.target.value as KpiTipoCalculo,
                  }))
                }
              >
                {KPI_TIPOS_CALCULO.map((t) => (
                  <option key={t} value={t}>
                    {KPI_TIPO_CALCULO_LABELS[t]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                «Proyectos vinculados» usa el % de avance de los proyectos asociados al KPI.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ed-meta">Meta</Label>
              <Input
                id="ed-meta"
                value={editorForm.meta}
                onChange={(e) => setEditorForm((f) => ({ ...f, meta: e.target.value }))}
                placeholder="≥ 95% / -15% / Firmado"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ed-unidad">Unidad</Label>
              <Input
                id="ed-unidad"
                value={editorForm.unidad}
                onChange={(e) => setEditorForm((f) => ({ ...f, unidad: e.target.value }))}
                placeholder="%, horas, Lps, días…"
              />
            </div>
            <div className="grid gap-2">
              <Label>Frecuencia</Label>
              <select
                className={selectClass}
                value={editorForm.frecuencia}
                onChange={(e) => setEditorForm((f) => ({ ...f, frecuencia: e.target.value }))}
              >
                {FRECUENCIAS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ed-resp">Responsable</Label>
              <Input
                id="ed-resp"
                value={editorForm.responsable}
                onChange={(e) => setEditorForm((f) => ({ ...f, responsable: e.target.value }))}
              />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={editorSaving}
                className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
              >
                {editorSaving ? 'Guardando…' : editorKpi ? 'Guardar cambios' : 'Crear KPI'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sugerencias por departamento */}
      <Dialog open={sugOpen} onOpenChange={setSugOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Sugerencias de KPIs por departamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Departamento</Label>
              <select
                className={selectClass}
                value={sugDeptoId}
                onChange={(e) => {
                  setSugDeptoId(e.target.value)
                  if (e.target.value) void cargarSugerencias(e.target.value)
                }}
              >
                <option value="">Seleccione…</option>
                {departamentos.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.codigo} — {d.nombre}
                  </option>
                ))}
              </select>
            </div>

            {sugLoading ? (
              <p className="text-sm text-muted-foreground">Cargando sugerencias…</p>
            ) : !sugDeptoId ? (
              <p className="text-sm text-muted-foreground">
                Selecciona un departamento para ver sus KPIs sugeridos.
              </p>
            ) : sugItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay plantilla de sugerencias para este departamento. Catálogo disponible para:
                IT (DEP-8), RRHH (DEP-10), FIN (DEP-9), OPS (DEP-13), COM (DEP-5) y LEG (DEP-68).
                Puede crear KPIs manualmente con <strong>Nuevo KPI</strong>.
              </p>
            ) : (
              <>
              {sugCatalogoClave && (
                <p className="text-xs text-muted-foreground">
                  Catálogo: <strong className="text-foreground">{sugCatalogoClave}</strong>
                  {departamentos.find((d) => d._id === sugDeptoId)?.codigo
                    ? ` · departamento ${departamentos.find((d) => d._id === sugDeptoId)?.codigo}`
                    : ''}
                </p>
              )}
              <div className="max-h-[55vh] overflow-y-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[42px] text-center">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--lime)]"
                          checked={
                            sugItems.filter((s) => !s.yaExiste).length > 0 &&
                            sugItems
                              .filter((s) => !s.yaExiste)
                              .every((s) => sugSeleccion.has(s.nombre))
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSugSeleccion(
                                new Set(
                                  sugItems.filter((s) => !s.yaExiste).map((s) => s.nombre),
                                ),
                              )
                            } else {
                              setSugSeleccion(new Set())
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Eje</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Meta</TableHead>
                      <TableHead>Frecuencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sugItems.map((s) => (
                      <TableRow key={s.nombre} className={s.yaExiste ? 'opacity-60' : ''}>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--lime)]"
                            disabled={s.yaExiste}
                            checked={sugSeleccion.has(s.nombre)}
                            onChange={(e) => {
                              setSugSeleccion((prev) => {
                                const n = new Set(prev)
                                if (e.target.checked) n.add(s.nombre)
                                else n.delete(s.nombre)
                                return n
                              })
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-xs uppercase text-muted-foreground">
                          {s.eje}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{s.nombre}</span>
                            {s.yaExiste && (
                              <Badge variant="secondary" className="text-[10px]">
                                Ya existe
                              </Badge>
                            )}
                          </div>
                          {s.descripcion && (
                            <p className="text-xs text-muted-foreground">{s.descripcion}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {s.meta}{' '}
                          {s.unidad && (
                            <span className="text-xs text-muted-foreground">({s.unidad})</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{s.frecuencia}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSugOpen(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              disabled={sugSaving || sugSeleccion.size === 0 || !sugDeptoId}
              onClick={() => void aplicarSugerencias()}
              className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
            >
              {sugSaving
                ? 'Aplicando…'
                : `Crear ${sugSeleccion.size} sugerencia(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
