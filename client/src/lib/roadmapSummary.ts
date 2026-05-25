import { buildRoadmapTree, type RoadmapHierarchyMode, type RoadmapTreeNode } from '@/lib/roadmapHierarchy'
import type { Proyecto } from '@/types/proyecto'
import { proyectoDeptDoc } from '@/types/proyecto'

const ACTIVOS = new Set(['En progreso', 'Aprobado', 'En revisión', 'Planificado'])

export type RoadmapResumenStats = {
  total: number
  activos: number
  completados: number
  bloqueados: number
  avancePromedio: number
  porFase: { fase: number | null; label: string; count: number; avance: number }[]
}

export function computeRoadmapResumen(proyectos: Proyecto[]): RoadmapResumenStats {
  const total = proyectos.length
  let sumAvance = 0
  let activos = 0
  let completados = 0
  let bloqueados = 0

  for (const p of proyectos) {
    sumAvance += p.porcentaje_avance ?? 0
    if (p.estado === 'Completado') completados++
    else if (p.estado === 'Bloqueado') bloqueados++
    else if (ACTIVOS.has(p.estado)) activos++
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
    return { fase, label, count, avance }
  })

  return {
    total,
    activos,
    completados,
    bloqueados,
    avancePromedio: total > 0 ? Math.round(sumAvance / total) : 0,
    porFase,
  }
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
