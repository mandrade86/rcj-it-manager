import { buildRoadmapTree, type RoadmapHierarchyMode, type RoadmapTreeNode } from '@/lib/roadmapHierarchy'
import type { Proyecto } from '@/types/proyecto'
import { proyectoDeptDoc } from '@/types/proyecto'

const ACTIVOS = new Set(['En progreso', 'Aprobado', 'En revisión', 'Planificado'])
const CERRADOS = new Set(['Completado', 'Cancelado'])
const EJE_ORDER = ['Infraestructura', 'Seguridad', 'Red', 'Software', 'Gobierno IT', 'Talento']
const PRI_ORDER = ['Alta', 'Media', 'Baja']
const DAY_MS = 24 * 60 * 60 * 1000

export function startOfLocalDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function proyectoCerrado(p: Proyecto): boolean {
  return CERRADOS.has(p.estado)
}

export function proyectoAtrasado(p: Proyecto, hoy = startOfLocalDay()): boolean {
  if (proyectoCerrado(p) || !p.fecha_fin) return false
  const fin = new Date(p.fecha_fin)
  if (Number.isNaN(fin.getTime())) return false
  return fin.getTime() < hoy.getTime()
}

export function proyectoPorVencer(p: Proyecto, dias: number, hoy = startOfLocalDay()): boolean {
  if (proyectoCerrado(p) || proyectoAtrasado(p, hoy) || !p.fecha_fin) return false
  const fin = new Date(p.fecha_fin)
  if (Number.isNaN(fin.getTime())) return false
  const t = fin.getTime()
  return t >= hoy.getTime() && t <= hoy.getTime() + dias * DAY_MS
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/** % de calendario transcurrido (0–100). Null si faltan fechas. */
export function avanceEsperadoCalendario(p: Proyecto, hoy = startOfLocalDay()): number | null {
  if (!p.fecha_inicio || !p.fecha_fin) return null
  const a = new Date(p.fecha_inicio).getTime()
  const b = new Date(p.fecha_fin).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null
  return Math.round(clamp(((hoy.getTime() - a) / (b - a)) * 100, 0, 100))
}

export type RoadmapResumenStats = {
  total: number
  activos: number
  completados: number
  bloqueados: number
  avancePromedio: number
  avanceEsperado: number | null
  gapCalendario: number | null
  atrasados: number
  enRiesgoAlto: number
  porVencer30: number
  enTiempo: number
  sinFechaFin: number
  porFase: { fase: number | null; label: string; count: number; avance: number; atrasados: number }[]
  porEje: { eje: string; count: number; avance: number }[]
  salud: { alto: number; medio: number; bajo: number; sinFecha: number }
}

export function computeRoadmapResumen(proyectos: Proyecto[]): RoadmapResumenStats {
  const hoy = startOfLocalDay()
  const total = proyectos.length
  let sumAvance = 0
  let sumEsperado = 0
  let nEsperado = 0
  let activos = 0
  let completados = 0
  let bloqueados = 0
  let atrasados = 0
  let enRiesgoAlto = 0
  let porVencer30 = 0
  let enTiempo = 0
  let sinFechaFin = 0
  const salud = { alto: 0, medio: 0, bajo: 0, sinFecha: 0 }

  for (const p of proyectos) {
    sumAvance += p.porcentaje_avance ?? 0
    if (p.estado === 'Completado') completados++
    else if (p.estado === 'Bloqueado') bloqueados++
    else if (ACTIVOS.has(p.estado)) activos++

    if (!proyectoCerrado(p)) {
      const esp = avanceEsperadoCalendario(p, hoy)
      if (esp != null) {
        sumEsperado += esp
        nEsperado++
      }
      if (!p.fecha_fin) sinFechaFin++
      if (proyectoAtrasado(p, hoy)) atrasados++
      else if (proyectoPorVencer(p, 30, hoy)) porVencer30++
      if (p.estado === 'Bloqueado' || p.riesgo?.nivel === 'Alto') enRiesgoAlto++
      if (
        p.estado !== 'Bloqueado'
        && !proyectoAtrasado(p, hoy)
        && p.riesgo?.nivel !== 'Alto'
        && p.fecha_fin
      ) {
        enTiempo++
      }
    }

    const nivel = p.riesgo?.nivel
    if (nivel === 'Alto') salud.alto++
    else if (nivel === 'Medio') salud.medio++
    else if (nivel === 'Sin fecha') salud.sinFecha++
    else salud.bajo++
  }

  const porFaseDefs: { fase: number | null; label: string }[] = [
    { fase: 1, label: 'Fase 1' },
    { fase: 2, label: 'Fase 2' },
    { fase: 3, label: 'Fase 3' },
    { fase: null, label: 'Sin fase' },
  ]

  const porFase = porFaseDefs.map(({ fase, label }) => {
    const items = proyectos.filter((p) =>
      fase === null ? p.fase !== 1 && p.fase !== 2 && p.fase !== 3 : p.fase === fase,
    )
    const count = items.length
    const avance =
      count > 0
        ? Math.round(items.reduce((s, p) => s + (p.porcentaje_avance ?? 0), 0) / count)
        : 0
    const atrasadosFase = items.filter((p) => proyectoAtrasado(p, hoy)).length
    return { fase, label, count, avance, atrasados: atrasadosFase }
  })

  const ejeMap = new Map<string, { sum: number; count: number }>()
  for (const p of proyectos) {
    const eje = p.eje?.trim() || 'Sin categoría'
    const cur = ejeMap.get(eje) ?? { sum: 0, count: 0 }
    cur.sum += p.porcentaje_avance ?? 0
    cur.count++
    ejeMap.set(eje, cur)
  }
  const porEje = [...ejeMap.entries()]
    .map(([eje, v]) => ({
      eje,
      count: v.count,
      avance: v.count > 0 ? Math.round(v.sum / v.count) : 0,
    }))
    .sort((a, b) => {
      const ia = EJE_ORDER.indexOf(a.eje)
      const ib = EJE_ORDER.indexOf(b.eje)
      const ra = ia === -1 ? 99 : ia
      const rb = ib === -1 ? 99 : ib
      if (ra !== rb) return ra - rb
      return a.eje.localeCompare(b.eje, 'es')
    })

  const avancePromedio = total > 0 ? Math.round(sumAvance / total) : 0
  const avanceEsperado = nEsperado > 0 ? Math.round(sumEsperado / nEsperado) : null
  const gapCalendario = avanceEsperado != null ? avancePromedio - avanceEsperado : null

  return {
    total,
    activos,
    completados,
    bloqueados,
    avancePromedio,
    avanceEsperado,
    gapCalendario,
    atrasados,
    enRiesgoAlto,
    porVencer30,
    enTiempo,
    sinFechaFin,
    porFase,
    porEje,
    salud,
  }
}

export function insightsRoadmap(r: RoadmapResumenStats): string[] {
  const out: string[] = []
  if (r.gapCalendario != null) {
    if (r.gapCalendario <= -10) {
      out.push(`El avance medio (${r.avancePromedio}%) va ${Math.abs(r.gapCalendario)} pts detrás del calendario.`)
    } else if (r.gapCalendario >= 10) {
      out.push(`El portafolio va ${r.gapCalendario} pts por delante del tiempo transcurrido.`)
    } else {
      out.push(`Avance ${r.avancePromedio}% alineado con el calendario (${r.avanceEsperado}% esperado).`)
    }
  } else {
    out.push(`Avance medio del portafolio: ${r.avancePromedio}%. Faltan fechas para estimar el ritmo.`)
  }
  const alertas: string[] = []
  if (r.atrasados) alertas.push(`${r.atrasados} atrasado${r.atrasados === 1 ? '' : 's'}`)
  if (r.bloqueados) alertas.push(`${r.bloqueados} bloqueado${r.bloqueados === 1 ? '' : 's'}`)
  if (r.enRiesgoAlto) alertas.push(`${r.enRiesgoAlto} en riesgo alto`)
  if (alertas.length) out.push(`Atención inmediata: ${alertas.join(' · ')}.`)
  else out.push('No hay atrasos ni bloqueos en el alcance actual.')
  if (r.porVencer30) {
    out.push(`${r.porVencer30} proyecto${r.porVencer30 === 1 ? '' : 's'} cierra${r.porVencer30 === 1 ? '' : 'n'} en los próximos 30 días.`)
  }
  if (r.sinFechaFin) {
    out.push(`${r.sinFechaFin} sin fecha de fin: no se puede comprometer un cierre.`)
  }
  return out
}

export type RoadmapAtencionItem = {
  proyecto: Proyecto
  motivo: string
  nivel: 'critico' | 'alerta' | 'proxima'
}

export function atencionEjecutiva(proyectos: Proyecto[], limit = 8): RoadmapAtencionItem[] {
  const hoy = startOfLocalDay()
  const scored: Array<RoadmapAtencionItem & { rank: number }> = []

  for (const p of proyectos) {
    if (proyectoCerrado(p)) continue
    if (p.estado === 'Bloqueado') {
      scored.push({ proyecto: p, motivo: 'Bloqueado', nivel: 'critico', rank: 0 })
      continue
    }
    if (proyectoAtrasado(p, hoy)) {
      scored.push({ proyecto: p, motivo: p.riesgo?.motivo || 'Fecha de fin vencida', nivel: 'critico', rank: 1 })
      continue
    }
    if (p.riesgo?.nivel === 'Alto') {
      scored.push({ proyecto: p, motivo: p.riesgo.motivo || 'Riesgo alto', nivel: 'critico', rank: 2 })
      continue
    }
    if (p.prioridad === 'Alta' && (p.porcentaje_avance ?? 0) < 50) {
      scored.push({ proyecto: p, motivo: `Prioridad alta · ${p.porcentaje_avance ?? 0}%`, nivel: 'alerta', rank: 3 })
      continue
    }
    if (proyectoPorVencer(p, 14, hoy)) {
      scored.push({ proyecto: p, motivo: p.riesgo?.motivo || 'Cierra en menos de 14 días', nivel: 'proxima', rank: 4 })
      continue
    }
    if (p.riesgo?.nivel === 'Medio') {
      scored.push({ proyecto: p, motivo: p.riesgo.motivo || 'Riesgo medio', nivel: 'alerta', rank: 5 })
    }
  }

  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    const fa = a.proyecto.fecha_fin ? new Date(a.proyecto.fecha_fin).getTime() : Infinity
    const fb = b.proyecto.fecha_fin ? new Date(b.proyecto.fecha_fin).getTime() : Infinity
    return fa - fb
  })
  return scored.slice(0, limit)
}

export type RoadmapLaneMode = 'fase' | 'eje' | 'prioridad'

export const ROADMAP_LANE_OPTIONS: { id: RoadmapLaneMode; label: string }[] = [
  { id: 'fase', label: 'Por fase' },
  { id: 'prioridad', label: 'Por prioridad' },
]

export type RoadmapLane = {
  id: string
  label: string
  items: Proyecto[]
}

function sortByStart(a: Proyecto, b: Proyecto): number {
  const ta = a.fecha_inicio ? new Date(a.fecha_inicio).getTime() : Number.POSITIVE_INFINITY
  const tb = b.fecha_inicio ? new Date(b.fecha_inicio).getTime() : Number.POSITIVE_INFINITY
  if (ta !== tb) return ta - tb
  return a.nombre.localeCompare(b.nombre, 'es')
}

function laneDateSpan(items: Proyecto[]): { fi: string | null; ff: string | null } {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const p of items) {
    for (const raw of [p.fecha_inicio, p.fecha_fin]) {
      if (!raw) continue
      const t = new Date(raw).getTime()
      if (!Number.isNaN(t)) {
        min = Math.min(min, t)
        max = Math.max(max, t)
      }
    }
  }
  if (!Number.isFinite(min)) return { fi: null, ff: null }
  return { fi: new Date(min).toISOString(), ff: new Date(max).toISOString() }
}

export function laneSpan(items: Proyecto[]): { fi: string | null; ff: string | null } {
  return laneDateSpan(items)
}

export function buildRoadmapLanes(proyectos: Proyecto[], mode: RoadmapLaneMode): RoadmapLane[] {
  const map = new Map<string, Proyecto[]>()

  function push(id: string, label: string, p: Proyecto) {
    const key = `${id}::${label}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(p)
  }

  if (mode === 'fase') {
    const buckets: Record<string, Proyecto[]> = { '1': [], '2': [], '3': [], x: [] }
    for (const p of proyectos) {
      if (p.fase === 1 || p.fase === 2 || p.fase === 3) buckets[String(p.fase)]!.push(p)
      else buckets.x!.push(p)
    }
    return (['1', '2', '3', 'x'] as const)
      .filter((k) => (buckets[k]?.length ?? 0) > 0)
      .map((k) => ({
        id: `fase-${k}`,
        label: k === 'x' ? 'Sin fase' : `Fase ${k}`,
        items: [...(buckets[k] ?? [])].sort(sortByStart),
      }))
  }

  if (mode === 'prioridad') {
    for (const p of proyectos) {
      const pri = PRI_ORDER.includes(p.prioridad) ? p.prioridad : 'Media'
      push(pri, pri, p)
    }
    return PRI_ORDER.filter((id) => map.has(`${id}::${id}`)).map((id) => ({
      id: `pri-${id}`,
      label: `Prioridad ${id}`,
      items: [...(map.get(`${id}::${id}`) ?? [])].sort(sortByStart),
    }))
  }

  for (const p of proyectos) {
    const eje = p.eje?.trim() || 'Sin categoría'
    push(eje, eje, p)
  }
  const keys = [...map.keys()].sort((a, b) => {
    const la = a.split('::')[1] ?? a
    const lb = b.split('::')[1] ?? b
    const ia = EJE_ORDER.indexOf(la)
    const ib = EJE_ORDER.indexOf(lb)
    const ra = ia === -1 ? 99 : ia
    const rb = ib === -1 ? 99 : ib
    if (ra !== rb) return ra - rb
    return la.localeCompare(lb, 'es')
  })
  return keys.map((key) => {
    const label = key.split('::')[1] ?? key
    return {
      id: `eje-${label}`,
      label,
      items: [...(map.get(key) ?? [])].sort(sortByStart),
    }
  })
}

export type RoadmapGrupoResumen = {
  id: string
  label: string
  count: number
  avance: number
  proyectos: Proyecto[]
}

/** Primer nivel de la jerarquía como tarjetas de resumen. */
export function roadmapGruposResumen(
  proyectos: Proyecto[],
  mode: RoadmapHierarchyMode,
): RoadmapGrupoResumen[] {
  const tree = buildRoadmapTree(proyectos, mode)
  return tree.map((g) => ({
    id: g.id,
    label: g.label,
    count: g.projectCount,
    avance: g.avgAvance,
    proyectos: collectProjects(g),
  }))
}

function collectProjects(node: RoadmapTreeNode): Proyecto[] {
  const out: Proyecto[] = []
  function walk(n: RoadmapTreeNode) {
    if (n.kind === 'project' && n.project) out.push(n.project)
    n.children.forEach(walk)
  }
  walk(node)
  return out
}

export function deptLabelShort(p: Proyecto): string {
  const doc = proyectoDeptDoc(p)
  return doc ? doc.codigo : '—'
}
