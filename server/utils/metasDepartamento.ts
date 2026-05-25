import mongoose from 'mongoose'

import { isMetaTipoCalculo } from '../db/data/kpiCalculoTipos.js'
import { Departamento } from '../db/models/Departamento.js'
import { isValidMetaId, normalizeMetaId } from './metasCrud.js'

export type MetaDeptoDoc = {
  id: string
  titulo: string
  objetivo: string
  valor_objetivo: string
  tipo_calculo: string
  activa: boolean
}

export function normalizarMetasBody(raw: unknown): MetaDeptoDoc[] | null {
  if (!Array.isArray(raw)) return null
  const out: MetaDeptoDoc[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const idRaw = typeof o.id === 'string' ? o.id : ''
    const id = normalizeMetaId(idRaw)
    if (!isValidMetaId(id) || seen.has(id)) continue
    seen.add(id)
    const tipoCalculo =
      typeof o.tipo_calculo === 'string' && isMetaTipoCalculo(o.tipo_calculo)
        ? o.tipo_calculo
        : 'promedio_kpis'
    out.push({
      id,
      titulo: typeof o.titulo === 'string' ? o.titulo.trim() : '',
      objetivo: typeof o.objetivo === 'string' ? o.objetivo.trim() : '',
      valor_objetivo: typeof o.valor_objetivo === 'string' ? o.valor_objetivo.trim() : '',
      tipo_calculo: tipoCalculo,
      activa: o.activa !== false,
    })
  }
  return out.length > 0 ? out : null
}

/**
 * Ya no rellena metas por defecto. Las metas se configuran manualmente en
 * KPIs → Registrar metas o en Maestros → Departamentos.
 */
export async function ensureMetasDepartamentos(): Promise<void> {
  /* sin auto-seed */
}

export async function metaIdPermitidoParaDepartamento(
  departamentoId: unknown,
  metaId: unknown,
): Promise<string | null> {
  const mid = typeof metaId === 'string' ? metaId.trim() : ''
  if (!mid) return 'meta_id inválido'
  if (!departamentoId || !mongoose.isValidObjectId(String(departamentoId))) {
    return null
  }
  const dept = await Departamento.findById(departamentoId).select('metas_estrategicas').lean()
  if (!dept) return 'Departamento no encontrado'
  const metas = (dept.metas_estrategicas ?? []) as MetaDeptoDoc[]
  if (metas.length === 0) return null
  const hit = metas.find((m) => m.id === mid)
  if (!hit) return 'La meta no está configurada para este departamento'
  if (hit.activa === false) return 'La meta seleccionada está inactiva en el departamento'
  return null
}

/** Solo usa meta_id explícito en el cuerpo (sin inferir por nombre del KPI). */
export function resolverMetaIdKpi(body: Record<string, unknown>): string | undefined {
  if (typeof body.meta_id === 'string' && body.meta_id.trim()) return body.meta_id.trim()
  return undefined
}
