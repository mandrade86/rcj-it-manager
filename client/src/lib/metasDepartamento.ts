import type { DepartamentoDoc, MetaEstrategicaDepto } from '@/types/departamento'
import {
  METAS_ESTRATEGICAS,
  type MetaEstrategicaId,
  isMetaEstrategicaId,
} from '@/types/kpi'

/** Metas guardadas en el departamento (sin plantilla automática). */
export function getMetasDepartamento(dept: DepartamentoDoc | null | undefined): MetaEstrategicaDepto[] {
  if (!dept?.metas_estrategicas?.length) return []
  return dept.metas_estrategicas.filter((m) => m.activa !== false)
}

/** Plantilla de las 5 metas RH — solo al pulsar «Usar plantilla» en el editor. */
export function plantillaMetasEstrategicas(): MetaEstrategicaDepto[] {
  return METAS_ESTRATEGICAS.map((m) => ({
    id: m.id,
    titulo: m.titulo,
    objetivo: m.objetivo,
    valor_objetivo: '',
    tipo_calculo: 'promedio_kpis',
    activa: true,
  }))
}

export function tituloMeta(
  metas: MetaEstrategicaDepto[],
  metaId: MetaEstrategicaId | string | null | undefined,
): string {
  if (!metaId) return '—'
  const hit = metas.find((m) => m.id === metaId)
  return hit?.titulo ?? String(metaId)
}

export function metaActivaIds(metas: MetaEstrategicaDepto[]): MetaEstrategicaId[] {
  return metas
    .filter((m) => m.activa !== false && isMetaEstrategicaId(m.id))
    .map((m) => m.id as MetaEstrategicaId)
}

export function metasEditorFromDepartamento(dept: DepartamentoDoc | null): MetaEstrategicaDepto[] {
  if (!dept?.metas_estrategicas?.length) return []
  return dept.metas_estrategicas.map((m) => ({ ...m }))
}
