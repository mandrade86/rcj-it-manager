import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, FolderKanban } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { formatDateDMY } from '@/lib/format'
import { cn } from '@/lib/utils'
import { estadoColor, type ProyectoEstado } from '@/types/proyecto'

const ESTADO_FILL: Record<string, string> = {
  Idea: '#94A3B8',
  Planificado: '#64748B',
  'En revisión': '#4527A0',
  Aprobado: '#3B82F6',
  'En progreso': '#002060',
  Bloqueado: '#C00000',
  'En pausa': '#F59E0B',
  Completado: '#70AD47',
  Cancelado: '#9CA3AF',
}

const SIN_EMPRESA = '__sin_empresa__'
const SIN_DEPTO = '__sin_depto__'

type Empresa = {
  _id: string
  nombre: string
  codigo: string
  color: string
  activo: boolean
}

type Departamento = {
  _id: string
  nombre: string
  codigo: string
  empresa_id: string | null
  activo: boolean
}

type Proyecto = {
  _id: string
  nombre: string
  estado: string
  prioridad: string
  porcentaje_avance: number
  encargado: string | null
  meta_kpi: string | null
  kpi: {
    nombre: string
    meta: string | null
    unidad: string | null
    cumplimiento_pct: number
    ultimo_valor: number | null
  } | null
  comentario: string
  eje: string
  fecha_fin: string | null
  departamento_id: string | null
  empresa_ids: string[]
}

type Payload = {
  empresas: Empresa[]
  departamentos: Departamento[]
  proyectos: Proyecto[]
}

type Stats = {
  total: number
  marcha: number
  completados: number
  bloqueados: number
  pausa: number
  avance: number
}

function statsDe(proyectos: Proyecto[]): Stats {
  let completados = 0
  let bloqueados = 0
  let pausa = 0
  let marcha = 0
  for (const p of proyectos) {
    if (p.estado === 'Completado') completados += 1
    else if (p.estado === 'Bloqueado') bloqueados += 1
    else if (p.estado === 'En pausa' || p.estado === 'Cancelado') pausa += 1
    else marcha += 1
  }
  const total = proyectos.length
  const avance = total
    ? Math.round(proyectos.reduce((sum, p) => sum + (p.porcentaje_avance || 0), 0) / total)
    : 0
  return { total, marcha, completados, bloqueados, pausa, avance }
}

function nombreCorto(nombre: string): string {
  const limpio = nombre
    .replace(/\s+S\.?\s*A\.?\s*(de\s+C\.?\s*V\.?)?\.?/gi, '')
    .replace(/\s+S\.?\s*R\.?\s*L\.?\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  return limpio.length > 26 ? `${limpio.slice(0, 25)}…` : limpio
}

function kpiPromedio(proyectos: Proyecto[]): number | null {
  const vals = proyectos
    .map((p) => p.kpi?.cumplimiento_pct)
    .filter((n): n is number => typeof n === 'number')
  if (!vals.length) return null
  return Math.round(vals.reduce((sum, n) => sum + n, 0) / vals.length)
}

function encargadosDe(proyectos: Proyecto[]): string[] {
  return [...new Set(proyectos.map((p) => p.encargado).filter((n): n is string => Boolean(n)))]
}

function textoKpi(p: Proyecto): string {
  if (p.kpi) {
    const meta = p.kpi.meta ? ` · meta ${p.kpi.meta}` : ''
    const unidad = p.kpi.unidad ? ` ${p.kpi.unidad}` : ''
    const valor = p.kpi.ultimo_valor == null ? '' : ` · último ${p.kpi.ultimo_valor}${unidad}`
    return `${p.kpi.nombre}${meta}${valor}`
  }
  return p.meta_kpi || 'Sin KPI'
}

function analisisProyecto(p: Proyecto): string {
  const frases: string[] = []
  if (p.estado === 'Bloqueado') frases.push('Está bloqueado y necesita una decisión para seguir.')
  else if (p.estado === 'Completado') frases.push('Ya está cerrado.')
  else if (p.estado === 'Cancelado') frases.push('Quedó cancelado.')
  else if (p.porcentaje_avance >= 70) frases.push(`Va avanzado, en ${p.porcentaje_avance}%.`)
  else if (p.porcentaje_avance > 0) frases.push(`Va en ${p.porcentaje_avance}% y sigue abierto.`)
  else frases.push('Sigue abierto y todavía no registra avance.')

  if (p.kpi) {
    const meta = p.kpi.meta ? ` (meta ${p.kpi.meta})` : ''
    frases.push(`El KPI «${p.kpi.nombre}» está en ${p.kpi.cumplimiento_pct}%${meta}.`)
  } else if (p.meta_kpi) {
    frases.push(`La meta de manejo es: ${p.meta_kpi}.`)
  } else {
    frases.push('No tiene KPI de manejo definido.')
  }

  if (!p.encargado) frases.push('No tiene encargado asignado.')
  if (p.fecha_fin && p.estado !== 'Completado' && p.estado !== 'Cancelado') {
    const fin = new Date(p.fecha_fin)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    if (!Number.isNaN(fin.getTime()) && fin < hoy) {
      frases.push(`La fecha de fin (${formatDateDMY(p.fecha_fin)}) ya pasó.`)
    }
  }
  return frases.join(' ')
}

function analisisArea(area: string, lista: Proyecto[]): string {
  const stats = statsDe(lista)
  const kpi = kpiPromedio(lista)
  const bloqueo = stats.bloqueados
    ? ` ${stats.bloqueados} bloqueado${stats.bloqueados === 1 ? '' : 's'}.`
    : ''
  const kpiTxt = kpi == null ? '' : ` El KPI de manejo del área está en ${kpi}%.`
  return `${area} reúne ${stats.total} proyecto${stats.total === 1 ? '' : 's'}, con avance promedio de ${stats.avance}%.${kpiTxt}${bloqueo}`
}

function conteoEstados(proyectos: Proyecto[]) {
  const map = new Map<string, number>()
  for (const p of proyectos) map.set(p.estado, (map.get(p.estado) ?? 0) + 1)
  return [...map.entries()]
    .map(([name, value]) => ({ name, value, color: ESTADO_FILL[name] ?? '#6B7280' }))
    .sort((a, b) => b.value - a.value)
}

function proyectosDeEmpresa(proyectos: Proyecto[], empresaId: string): Proyecto[] {
  if (empresaId === SIN_EMPRESA) return proyectos.filter((p) => p.empresa_ids.length === 0)
  return proyectos.filter((p) => p.empresa_ids.includes(empresaId))
}

export function PresidenciaPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<Payload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [deptoId, setDeptoId] = useState<string | null>(null)
  const [comentarios, setComentarios] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState<string | null>(null)
  const [avisoComentario, setAvisoComentario] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancel = false
    void fetch('/api/dashboard/presidencia')
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo cargar el tablero de presidencia')
        return res.json() as Promise<Payload>
      })
      .then((json) => {
        if (!cancel) setData(json)
      })
      .catch((e) => {
        if (!cancel) setErr(e instanceof Error ? e.message : 'Error')
      })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (!data) return
    setComentarios((prev) => {
      const next = { ...prev }
      for (const p of data.proyectos) {
        if (next[p._id] == null) next[p._id] = p.comentario ?? ''
      }
      return next
    })
  }, [data])

  const empresas = data?.empresas ?? []
  const departamentos = data?.departamentos ?? []
  const proyectos = data?.proyectos ?? []

  const empresa = empresas.find((e) => e._id === empresaId) ?? null
  const depto = departamentos.find((d) => d._id === deptoId) ?? null

  const proyectosEmpresa = useMemo(
    () => (empresaId ? proyectosDeEmpresa(proyectos, empresaId) : proyectos),
    [empresaId, proyectos],
  )

  const deptosVisibles = useMemo(() => {
    if (!empresaId) return []
    const ids = new Set<string>()
    if (empresaId !== SIN_EMPRESA) {
      for (const d of departamentos) {
        if (d.empresa_id === empresaId) ids.add(d._id)
      }
    }
    for (const p of proyectosEmpresa) {
      if (p.departamento_id) ids.add(p.departamento_id)
    }
    const lista = departamentos
      .filter((d) => ids.has(d._id))
      .map((d) => ({
        ...d,
        proyectos: proyectosEmpresa.filter((p) => p.departamento_id === d._id),
      }))
      .filter((d) => d.proyectos.length > 0)
      .sort((a, b) => b.proyectos.length - a.proyectos.length || a.nombre.localeCompare(b.nombre, 'es'))

    const sinDepto = proyectosEmpresa.filter((p) => !p.departamento_id)
    if (sinDepto.length) {
      lista.push({
        _id: SIN_DEPTO,
        nombre: 'Sin departamento',
        codigo: '',
        empresa_id: empresaId === SIN_EMPRESA ? null : empresaId,
        activo: true,
        proyectos: sinDepto,
      })
    }
    return lista
  }, [departamentos, empresaId, proyectosEmpresa])

  const proyectosDepto = useMemo(() => {
    if (!deptoId) return []
    if (deptoId === SIN_DEPTO) return proyectosEmpresa.filter((p) => !p.departamento_id)
    return proyectosEmpresa.filter((p) => p.departamento_id === deptoId)
  }, [deptoId, proyectosEmpresa])

  const areas = useMemo(() => {
    const grupos = new Map<string, Proyecto[]>()
    for (const p of proyectosDepto) {
      const area = p.eje?.trim() || 'Sin área'
      const lista = grupos.get(area) ?? []
      lista.push(p)
      grupos.set(area, lista)
    }
    return [...grupos.entries()]
      .map(([area, lista]) => ({
        area,
        proyectos: [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      }))
      .sort((a, b) => b.proyectos.length - a.proyectos.length || a.area.localeCompare(b.area, 'es'))
  }, [proyectosDepto])

  async function guardarComentario(proyectoId: string) {
    setGuardando(proyectoId)
    setAvisoComentario((prev) => ({ ...prev, [proyectoId]: '' }))
    try {
      const res = await fetch('/api/dashboard/presidencia/comentario', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_id: proyectoId, comentario: comentarios[proyectoId] ?? '' }),
      })
      const body = await res.json().catch(() => ({})) as { error?: string; comentario?: string }
      if (!res.ok) throw new Error(body.error || 'No se pudo guardar el comentario')
      const texto = body.comentario ?? (comentarios[proyectoId] ?? '')
      setComentarios((prev) => ({ ...prev, [proyectoId]: texto }))
      setData((prev) => prev ? {
        ...prev,
        proyectos: prev.proyectos.map((p) => p._id === proyectoId ? { ...p, comentario: texto } : p),
      } : prev)
      setAvisoComentario((prev) => ({ ...prev, [proyectoId]: 'Comentario guardado' }))
    } catch (e) {
      setAvisoComentario((prev) => ({
        ...prev,
        [proyectoId]: e instanceof Error ? e.message : 'No se pudo guardar',
      }))
    } finally {
      setGuardando(null)
    }
  }

  const empresasTarjetas = useMemo(() => {
    const tarjetas = empresas.map((e) => ({
      ...e,
      proyectos: proyectosDeEmpresa(proyectos, e._id),
    }))
    const huerfanos = proyectos.filter((p) => p.empresa_ids.length === 0)
    if (huerfanos.length) {
      tarjetas.push({
        _id: SIN_EMPRESA,
        nombre: 'Sin empresa',
        codigo: '',
        color: '#6B7280',
        activo: true,
        proyectos: huerfanos,
      })
    }
    return tarjetas
      .filter((e) => e.proyectos.length > 0)
      .sort((a, b) => b.proyectos.length - a.proyectos.length || a.nombre.localeCompare(b.nombre, 'es'))
  }, [empresas, proyectos])

  const nivel: 'empresas' | 'departamentos' | 'proyectos' = deptoId
    ? 'proyectos'
    : empresaId
      ? 'departamentos'
      : 'empresas'

  const statsActuales = statsDe(
    nivel === 'proyectos' ? proyectosDepto : nivel === 'departamentos' ? proyectosEmpresa : proyectos,
  )

  function elegirEmpresa(id: string) {
    setEmpresaId(id)
    setDeptoId(null)
  }

  function volverGrupo() {
    setEmpresaId(null)
    setDeptoId(null)
  }

  function volverEmpresa() {
    setDeptoId(null)
  }

  if (err) return <p className="text-sm text-destructive">{err}</p>
  if (!data) return <p className="text-sm text-muted-foreground">Cargando tablero de presidencia…</p>

  const tituloEmpresa = empresa?.nombre ?? (empresaId === SIN_EMPRESA ? 'Sin empresa' : '')
  const tituloDepto = depto?.nombre ?? (deptoId === SIN_DEPTO ? 'Sin departamento' : '')
  const proyectosNivel = nivel === 'proyectos' ? proyectosDepto : nivel === 'departamentos' ? proyectosEmpresa : proyectos
  const estados = conteoEstados(proyectosNivel)
  const barrasNivel = (nivel === 'departamentos' ? deptosVisibles : empresasTarjetas).map((item) => ({
    id: item._id,
    nombre: item.nombre,
    total: item.proyectos.length,
    avance: statsDe(item.proyectos).avance,
    color: 'color' in item ? item.color : (empresa?.color ?? '#002060'),
  }))

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl bg-[var(--navy)] text-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/60">Presidencia</p>
            <h1 className="mt-1 text-2xl font-semibold">Portafolio del grupo</h1>
            <p className="mt-1 max-w-xl text-sm text-white/75">
              {nivel === 'empresas' && 'Elija una empresa para ver sus departamentos.'}
              {nivel === 'departamentos' && `Departamentos de ${tituloEmpresa}. Elija uno para ver sus proyectos.`}
              {nivel === 'proyectos' && `Proyectos de ${tituloDepto} en ${tituloEmpresa}.`}
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Recorrido">
            <button
              type="button"
              onClick={volverGrupo}
              className={cn(
                'rounded-md px-2 py-1',
                nivel === 'empresas' ? 'bg-white/15 font-medium' : 'text-white/80 hover:bg-white/10',
              )}
            >
              Grupo
            </button>
            {empresaId && (
              <>
                <ChevronRight className="size-4 text-white/50" aria-hidden />
                <button
                  type="button"
                  onClick={volverEmpresa}
                  className={cn(
                    'rounded-md px-2 py-1',
                    nivel === 'departamentos' ? 'bg-white/15 font-medium' : 'text-white/80 hover:bg-white/10',
                  )}
                >
                  {tituloEmpresa}
                </button>
              </>
            )}
            {deptoId && (
              <>
                <ChevronRight className="size-4 text-white/50" aria-hidden />
                <span className="rounded-md bg-white/15 px-2 py-1 font-medium">{tituloDepto}</span>
              </>
            )}
          </nav>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-5">
        <GraficoEstados estados={estados} avance={statsActuales.avance} total={statsActuales.total} />
        {nivel === 'proyectos' ? (
          <GraficoAvance
            proyectos={proyectosDepto}
            onAbrir={(id) => navigate(`/proyectos/${id}`)}
          />
        ) : (
          <GraficoComparativo
            titulo={nivel === 'empresas' ? 'Proyectos por empresa' : 'Proyectos por departamento'}
            subtitulo="Clic en una barra para filtrar"
            filas={barrasNivel}
            onElegir={nivel === 'empresas' ? elegirEmpresa : setDeptoId}
          />
        )}
      </section>

      {nivel === 'empresas' && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {empresasTarjetas.map((e) => (
            <TarjetaFiltro
              key={e._id}
              titulo={e.nombre}
              subtitulo={e.codigo || 'Proyectos sin empresa asignada'}
              color={e.color}
              inactivo={!e.activo}
              stats={statsDe(e.proyectos)}
              encargados={encargadosDe(e.proyectos)}
              kpiPct={kpiPromedio(e.proyectos)}
              onClick={() => elegirEmpresa(e._id)}
            />
          ))}
          {empresasTarjetas.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay empresas activas en el maestro.</p>
          )}
        </section>
      )}

      {nivel === 'departamentos' && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {deptosVisibles.map((d) => (
            <TarjetaFiltro
              key={d._id}
              titulo={d.nombre}
              subtitulo={d.codigo || 'Proyectos sin departamento'}
              color={empresa?.color ?? '#002060'}
              inactivo={!d.activo}
              stats={statsDe(d.proyectos)}
              encargados={encargadosDe(d.proyectos)}
              kpiPct={kpiPromedio(d.proyectos)}
              onClick={() => setDeptoId(d._id)}
            />
          ))}
          {deptosVisibles.length === 0 && (
            <p className="text-sm text-muted-foreground">Esta empresa no tiene departamentos ni proyectos.</p>
          )}
        </section>
      )}

      {nivel === 'proyectos' && (
        <section className="space-y-4">
          {proyectosDepto.length === 0 ? (
            <p className="rounded-xl border border-[var(--border)] bg-white p-5 text-sm text-muted-foreground">Este departamento no tiene proyectos.</p>
          ) : (
            areas.map((grupo) => (
              <article key={grupo.area} className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
                <header className="border-b border-[var(--border)] bg-[var(--blue-lt)] px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--navy)]">Área</p>
                  <h2 className="text-base font-semibold text-[var(--navy)]">{grupo.area}</h2>
                  <p className="mt-1 text-sm text-[var(--text)]">{analisisArea(grupo.area, grupo.proyectos)}</p>
                </header>
                <ul className="divide-y divide-[var(--border)]">
                  {grupo.proyectos.map((p) => (
                    <li key={p._id} className="space-y-3 px-4 py-4">
                      <div className="flex flex-wrap items-start gap-3">
                        <FolderKanban className="mt-1 size-4 shrink-0 text-[var(--navy)]" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <Link to={`/proyectos/${p._id}`} className="font-medium text-[var(--text)] hover:underline">
                            {p.nombre}
                          </Link>
                          <p className="mt-0.5 text-xs text-[var(--navy)]">
                            Encargado: {p.encargado || 'Sin asignar'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            KPI: {textoKpi(p)}
                            {p.fecha_fin ? ` · Fin ${formatDateDMY(p.fecha_fin)}` : ''}
                          </p>
                        </div>
                        <Badge variant="outline" className={estadoColor(p.estado as ProyectoEstado)}>
                          {p.estado}
                        </Badge>
                        <div className="grid w-full min-w-[160px] gap-2 sm:w-44">
                          <BarraMini
                            label="Avance"
                            valor={p.porcentaje_avance}
                            color={ESTADO_FILL[p.estado] ?? '#70AD47'}
                          />
                          {p.kpi && (
                            <BarraMini label="KPI" valor={p.kpi.cumplimiento_pct} color="#4527A0" />
                          )}
                        </div>
                      </div>
                      <p className="rounded-lg bg-[var(--gray-lt)] px-3 py-2 text-sm text-[var(--text)]">
                        {analisisProyecto(p)}
                      </p>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground" htmlFor={`comentario-${p._id}`}>
                          Comentario
                        </label>
                        <Textarea
                          id={`comentario-${p._id}`}
                          value={comentarios[p._id] ?? ''}
                          placeholder="Nota para presidencia sobre este proyecto"
                          rows={2}
                          onChange={(e) => setComentarios((prev) => ({ ...prev, [p._id]: e.target.value }))}
                        />
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            size="sm"
                            disabled={guardando === p._id}
                            onClick={() => void guardarComentario(p._id)}
                          >
                            {guardando === p._id ? 'Guardando…' : 'Guardar comentario'}
                          </Button>
                          {avisoComentario[p._id] && (
                            <span className="text-xs text-muted-foreground">{avisoComentario[p._id]}</span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </section>
      )}
    </div>
  )
}

function GraficoEstados({
  estados,
  avance,
  total,
}: {
  estados: Array<{ name: string; value: number; color: string }>
  avance: number
  total: number
}) {
  return (
    <Card className="shadow-sm lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[var(--navy)]">Estado del portafolio</CardTitle>
        <p className="text-xs text-muted-foreground">{total} proyecto{total === 1 ? '' : 's'} en este nivel</p>
      </CardHeader>
      <CardContent>
        {estados.length === 0 ? (
          <p className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Sin proyectos</p>
        ) : (
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <div className="relative h-[200px] w-full max-w-[220px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie data={estados} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none">
                    {estados.map((e) => (
                      <Cell key={e.name} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      const item = payload?.[0]
                      if (!active || !item) return null
                      return (
                        <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-lg">
                          <p className="font-medium text-[var(--navy)]">{String(item.name)}</p>
                          <p>{Number(item.value)} proyecto{Number(item.value) === 1 ? '' : 's'}</p>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold text-[var(--navy)]">{avance}%</span>
                <span className="text-[10px] text-muted-foreground">avance</span>
              </div>
            </div>
            <ul className="w-full space-y-1.5 text-xs">
              {estados.map((e) => (
                <li key={e.name} className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{e.name}</span>
                  <span className="font-semibold tabular-nums text-[var(--navy)]">{e.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function GraficoComparativo({
  titulo,
  subtitulo,
  filas,
  onElegir,
}: {
  titulo: string
  subtitulo: string
  filas: Array<{ id: string; nombre: string; total: number; avance: number; color: string }>
  onElegir: (id: string) => void
}) {
  const data = filas.map((f) => ({ ...f, etiqueta: nombreCorto(f.nombre) }))
  const alto = Math.max(220, data.length * 56)
  return (
    <Card className="shadow-sm lg:col-span-3">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[var(--navy)]">{titulo}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitulo}</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Nada para comparar</p>
        ) : (
          <div style={{ height: alto }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={data}
                layout="vertical"
                margin={{ left: 4, right: 28, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="etiqueta" width={128} tick={{ fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(0,32,96,0.04)' }}
                  content={({ active, payload }) => {
                    const row = payload?.[0]?.payload as (typeof data)[number] | undefined
                    if (!active || !row) return null
                    return (
                      <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-lg">
                        <p className="mb-1 font-semibold text-[var(--navy)]">{row.nombre}</p>
                        <p>{row.total} proyecto{row.total === 1 ? '' : 's'}</p>
                        <p>Avance promedio {row.avance}%</p>
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey="total"
                  name="Proyectos"
                  radius={[0, 6, 6, 0]}
                  barSize={16}
                  cursor="pointer"
                  onClick={(item) => {
                    const id = item?.payload?.id as string | undefined
                    if (id) onElegir(id)
                  }}
                >
                  {data.map((d) => (
                    <Cell key={d.id} fill={d.color || '#002060'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function GraficoAvance({
  proyectos,
  onAbrir,
}: {
  proyectos: Proyecto[]
  onAbrir: (id: string) => void
}) {
  const data = [...proyectos]
    .sort((a, b) => b.porcentaje_avance - a.porcentaje_avance)
    .map((p) => ({
      id: p._id,
      nombre: p.nombre,
      etiqueta: nombreCorto(p.nombre),
      avance: p.porcentaje_avance || 0,
      estado: p.estado,
      color: ESTADO_FILL[p.estado] ?? '#002060',
      encargado: p.encargado,
      kpi: p.kpi ? `${p.kpi.nombre} ${p.kpi.cumplimiento_pct}%` : (p.meta_kpi || 'Sin KPI'),
    }))
  const alto = Math.max(220, data.length * 36)
  return (
    <Card className="shadow-sm lg:col-span-3">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[var(--navy)]">Avance de cada proyecto</CardTitle>
        <p className="text-xs text-muted-foreground">Clic en una barra para abrir el proyecto</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Sin proyectos</p>
        ) : (
          <div style={{ height: alto }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={data}
                layout="vertical"
                margin={{ left: 4, right: 28, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <YAxis type="category" dataKey="etiqueta" width={128} tick={{ fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(0,32,96,0.04)' }}
                  content={({ active, payload }) => {
                    const row = payload?.[0]?.payload as (typeof data)[number] | undefined
                    if (!active || !row) return null
                    return (
                      <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-lg">
                        <p className="mb-1 font-semibold text-[var(--navy)]">{row.nombre}</p>
                        <p>Encargado: {row.encargado || 'Sin asignar'}</p>
                        <p>KPI: {row.kpi}</p>
                        <p>{row.estado} · avance {row.avance}%</p>
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey="avance"
                  name="Avance"
                  radius={[0, 6, 6, 0]}
                  barSize={12}
                  cursor="pointer"
                  onClick={(item) => {
                    const id = item?.payload?.id as string | undefined
                    if (id) onAbrir(id)
                  }}
                >
                  {data.map((d) => (
                    <Cell key={d.id} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function BarraMini({ label, valor, color }: { label: string; valor: number; color: string }) {
  const v = Math.min(100, Math.max(0, valor))
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-medium text-[var(--navy)]">{Math.round(v)}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--gray-lt)]">
        <div className="h-full rounded-full" style={{ width: `${v}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function TiraEstados({ stats }: { stats: Stats }) {
  const partes = [
    { n: stats.completados, color: '#70AD47' },
    { n: stats.marcha, color: '#002060' },
    { n: stats.bloqueados, color: '#C00000' },
    { n: stats.pausa, color: '#F59E0B' },
  ].filter((p) => p.n > 0)
  if (!stats.total) return null
  return (
    <span className="mt-3 flex h-2 overflow-hidden rounded-full bg-[var(--gray-lt)]">
      {partes.map((p) => (
        <span
          key={p.color}
          style={{ width: `${(p.n / stats.total) * 100}%`, backgroundColor: p.color }}
        />
      ))}
    </span>
  )
}

function TarjetaFiltro({
  titulo,
  subtitulo,
  color,
  inactivo,
  stats,
  encargados,
  kpiPct,
  onClick,
}: {
  titulo: string
  subtitulo: string
  color: string
  inactivo: boolean
  stats: Stats
  encargados: string[]
  kpiPct: number | null
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-xl border border-[var(--border)] bg-white text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <span className="h-1.5 w-full rounded-t-xl" style={{ backgroundColor: color }} />
      <span className="flex items-start gap-3 px-4 pb-4 pt-3">
        <span
          className="relative mt-0.5 flex size-[72px] shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: `conic-gradient(${color} ${Math.max(0, Math.min(100, stats.avance)) * 3.6}deg, #E5E7EB 0deg)` }}
        >
          <span className="flex size-12 flex-col items-center justify-center rounded-full bg-white text-[var(--navy)]">
            <span className="text-sm font-semibold leading-none">{stats.avance}%</span>
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold text-[var(--text)]">{titulo}</span>
            {inactivo && (
              <Badge variant="outline" className="text-[10px]">Inactivo</Badge>
            )}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitulo}</span>
          <span className="mt-1 block truncate text-xs text-[var(--navy)]">
            {encargados.length === 0
              ? 'Sin encargado'
              : encargados.length <= 2
                ? `Encargado: ${encargados.join(', ')}`
                : `${encargados.length} encargados`}
          </span>
          {kpiPct != null && (
            <span className="mt-0.5 block text-xs text-muted-foreground">KPI de manejo {kpiPct}%</span>
          )}
          <TiraEstados stats={stats} />
          <span className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <span><span className="block text-base font-semibold text-[var(--navy)]">{stats.total}</span>proyectos</span>
            <span><span className="block text-base font-semibold text-[var(--navy)]">{stats.marcha}</span>en marcha</span>
            <span><span className="block text-base font-semibold text-[var(--navy)]">{stats.completados}</span>cerrados</span>
          </span>
        </span>
        <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" aria-hidden />
      </span>
    </button>
  )
}
