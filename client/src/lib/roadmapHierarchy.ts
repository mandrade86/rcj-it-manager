import { METAS_ESTRATEGICAS, metaEstrategicaDeKpi } from '@/types/kpi'
import type { Proyecto } from '@/types/proyecto'
import { proyectoDeptDoc, proyectoKpiDoc, proyectoDeptId } from '@/types/proyecto'

export type RoadmapHierarchyMode =
  | 'depto-fase-eje'
  | 'depto-meta-eje'
  | 'fase-eje'
  | 'depto-eje'

export const ROADMAP_HIERARCHY_OPTIONS: { id: RoadmapHierarchyMode; label: string }[] = [
  { id: 'depto-fase-eje', label: 'Departamento → Fase → Categoría' },
  { id: 'depto-meta-eje', label: 'Departamento → Meta → Categoría' },
  { id: 'fase-eje', label: 'Fase → Categoría' },
  { id: 'depto-eje', label: 'Departamento → Categoría' },
]

export type RoadmapNodeKind = 'group' | 'project'

export type RoadmapTreeNode = {
  id: string
  kind: RoadmapNodeKind
  label: string
  sublabel?: string
  level: number
  project?: Proyecto
  children: RoadmapTreeNode[]
  projectCount: number
  avgAvance: number
  fecha_inicio?: string | null
  fecha_fin?: string | null
}

function metaLabelForProject(p: Proyecto): string {
  const kpi = proyectoKpiDoc(p)
  if (kpi) {
    const metaId = metaEstrategicaDeKpi(kpi)
    if (metaId === 'sin_meta') return 'Sin meta vinculada'
    const found = METAS_ESTRATEGICAS.find((m) => m.id === metaId)
    if (found) return found.titulo
    return metaId
  }
  return 'Sin meta vinculada'
}

function deptLabel(p: Proyecto): string {
  const doc = proyectoDeptDoc(p)
  if (doc) return `${doc.codigo} — ${doc.nombre}`
  const id = proyectoDeptId(p)
  return id ? `Departamento ${id.slice(-6)}` : 'Sin departamento'
}

function faseLabel(fase: number | null | undefined): string {
  if (fase === 1 || fase === 2 || fase === 3) return `Fase ${fase}`
  return 'Sin fase'
}

function ejeLabel(eje: string | null | undefined): string {
  const t = eje?.trim()
  return t || 'Sin categoría'
}

function aggregate(nodes: RoadmapTreeNode[]): {
  projectCount: number
  avgAvance: number
  fecha_inicio: string | null
  fecha_fin: string | null
} {
  const projects: Proyecto[] = []
  function walk(n: RoadmapTreeNode) {
    if (n.kind === 'project' && n.project) projects.push(n.project)
    n.children.forEach(walk)
  }
  nodes.forEach(walk)

  const count = projects.length
  const avg =
    count > 0
      ? Math.round(projects.reduce((s, p) => s + (p.porcentaje_avance ?? 0), 0) / count)
      : 0

  let minT = Number.POSITIVE_INFINITY
  let maxT = Number.NEGATIVE_INFINITY
  for (const p of projects) {
    for (const raw of [p.fecha_inicio, p.fecha_fin]) {
      if (!raw) continue
      const t = new Date(raw).getTime()
      if (!Number.isNaN(t)) {
        minT = Math.min(minT, t)
        maxT = Math.max(maxT, t)
      }
    }
  }

  return {
    projectCount: count,
    avgAvance: avg,
    fecha_inicio: Number.isFinite(minT) ? new Date(minT).toISOString() : null,
    fecha_fin: Number.isFinite(maxT) ? new Date(maxT).toISOString() : null,
  }
}

function makeGroup(
  id: string,
  label: string,
  level: number,
  children: RoadmapTreeNode[],
  sublabel?: string,
): RoadmapTreeNode {
  const agg = aggregate(children)
  return {
    id,
    kind: 'group',
    label,
    sublabel,
    level,
    children,
    projectCount: agg.projectCount,
    avgAvance: agg.avgAvance,
    fecha_inicio: agg.fecha_inicio,
    fecha_fin: agg.fecha_fin,
  }
}

function makeProjectNode(p: Proyecto, level: number): RoadmapTreeNode {
  return {
    id: `proj-${p._id}`,
    kind: 'project',
    label: p.nombre,
    sublabel: p._id,
    level,
    project: p,
    children: [],
    projectCount: 1,
    avgAvance: Math.round(p.porcentaje_avance ?? 0),
    fecha_inicio: p.fecha_inicio,
    fecha_fin: p.fecha_fin,
  }
}

function groupBy<T extends string>(
  items: Proyecto[],
  keyFn: (p: Proyecto) => T,
  level: number,
  childBuilder: (items: Proyecto[], level: number) => RoadmapTreeNode[],
): RoadmapTreeNode[] {
  const map = new Map<T, Proyecto[]>()
  for (const p of items) {
    const k = keyFn(p)
    const arr = map.get(k) ?? []
    arr.push(p)
    map.set(k, arr)
  }

  const keys = [...map.keys()].sort((a, b) => {
    const fa = a.match(/^Fase (\d)$/)
    const fb = b.match(/^Fase (\d)$/)
    if (fa && fb) return Number(fa[1]) - Number(fb[1])
    return a.localeCompare(b, 'es')
  })

  return keys.map((key) => {
    const groupItems = map.get(key) ?? []
    const children = childBuilder(groupItems, level + 1)
    const safeId = key.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()
    return makeGroup(`grp-${level}-${safeId}`, key, level, children)
  })
}

function buildLeaves(proyectos: Proyecto[], level: number): RoadmapTreeNode[] {
  return proyectos
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .map((p) => makeProjectNode(p, level))
}

function buildEjeThenProjects(items: Proyecto[], level: number): RoadmapTreeNode[] {
  return groupBy(items, (p) => ejeLabel(p.eje), level, (list, lv) => buildLeaves(list, lv))
}

function buildFaseEje(items: Proyecto[], level: number): RoadmapTreeNode[] {
  return groupBy(items, (p) => faseLabel(p.fase), level, (list, lv) => buildEjeThenProjects(list, lv))
}

function buildMetaEje(items: Proyecto[], level: number): RoadmapTreeNode[] {
  return groupBy(items, metaLabelForProject, level, (list, lv) => buildEjeThenProjects(list, lv))
}

function buildDeptFaseEje(items: Proyecto[], level: number): RoadmapTreeNode[] {
  return groupBy(items, deptLabel, level, (list, lv) => buildFaseEje(list, lv))
}

function buildDeptMetaEje(items: Proyecto[], level: number): RoadmapTreeNode[] {
  return groupBy(items, deptLabel, level, (list, lv) => buildMetaEje(list, lv))
}

function buildDeptEje(items: Proyecto[], level: number): RoadmapTreeNode[] {
  return groupBy(items, deptLabel, level, (list, lv) => buildEjeThenProjects(list, lv))
}

export function buildRoadmapTree(
  proyectos: Proyecto[],
  mode: RoadmapHierarchyMode,
): RoadmapTreeNode[] {
  if (!proyectos.length) return []

  switch (mode) {
    case 'depto-fase-eje':
      return buildDeptFaseEje(proyectos, 0)
    case 'depto-meta-eje':
      return buildDeptMetaEje(proyectos, 0)
    case 'fase-eje':
      return buildFaseEje(proyectos, 0)
    case 'depto-eje':
      return buildDeptEje(proyectos, 0)
    default:
      return buildDeptFaseEje(proyectos, 0)
  }
}

export type RoadmapFlatRow = {
  node: RoadmapTreeNode
}

/** Aplana el árbol respetando grupos colapsados. */
export function flattenRoadmapTree(
  nodes: RoadmapTreeNode[],
  collapsed: Set<string>,
): RoadmapFlatRow[] {
  const out: RoadmapFlatRow[] = []

  function walk(list: RoadmapTreeNode[]) {
    for (const node of list) {
      out.push({ node })
      if (node.kind === 'group' && !collapsed.has(node.id) && node.children.length) {
        walk(node.children)
      }
    }
  }

  walk(nodes)
  return out
}

export function collectGroupIds(nodes: RoadmapTreeNode[]): string[] {
  const ids: string[] = []
  function walk(list: RoadmapTreeNode[]) {
    for (const n of list) {
      if (n.kind === 'group') {
        ids.push(n.id)
        walk(n.children)
      }
    }
  }
  walk(nodes)
  return ids
}
