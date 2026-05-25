import mongoose from 'mongoose'

import { KPI } from '../db/models/KPI.js'
import { Proyecto } from '../db/models/Proyecto.js'

export function normalizeKpiTipo(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeProyectoIds(raw: unknown): string[] {
  if (raw == null) return []
  const arr = Array.isArray(raw) ? raw : [raw]
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of arr) {
    let s = ''
    if (typeof item === 'string') s = item.trim()
    else if (item && typeof item === 'object' && '_id' in item) {
      s = String((item as { _id: unknown })._id).trim()
    }
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

export type SyncKpiProyectosResult = {
  vinculados: number
  proyecto_ids: string[]
}

/**
 * Vincula un KPI a proyectos:
 * - Si `proyecto_ids` viene en el body, usa esa lista (validada contra el departamento).
 * - Si no, enlaza todos los proyectos del departamento cuyo `eje` coincide con tipo/eje del KPI.
 * Actualiza `kpi_id` y `meta_kpi` en Proyecto y persiste `proyecto_ids` en el KPI.
 */
export async function syncKpiProyectoVinculos(
  kpiId: mongoose.Types.ObjectId | string,
  opts: {
    departamento_id?: unknown
    eje?: string | null
    tipo?: string | null
    meta?: string | null
    proyecto_ids?: unknown
  },
): Promise<SyncKpiProyectosResult> {
  const kid = new mongoose.Types.ObjectId(String(kpiId))
  const tipoNorm = normalizeKpiTipo(opts.tipo || opts.eje)
  const deptStr =
    opts.departamento_id && mongoose.isValidObjectId(String(opts.departamento_id))
      ? String(opts.departamento_id)
      : null
  const deptOid = deptStr ? new mongoose.Types.ObjectId(deptStr) : null

  let targetIds = normalizeProyectoIds(opts.proyecto_ids)

  if (targetIds.length === 0 && deptOid && tipoNorm) {
    const candidatos = await Proyecto.find({ departamento_id: deptOid })
      .select('_id eje')
      .lean()
    targetIds = candidatos
      .filter((p) => normalizeKpiTipo(p.eje) === tipoNorm)
      .map((p) => String(p._id))
  }

  if (deptOid && targetIds.length > 0) {
    const valid = await Proyecto.find({
      _id: { $in: targetIds },
      departamento_id: deptOid,
    })
      .select('_id')
      .lean()
    targetIds = valid.map((p) => String(p._id))
  }

  if (deptOid && targetIds.length > 0 && tipoNorm) {
    const conEje = await Proyecto.find({
      _id: { $in: targetIds },
      departamento_id: deptOid,
    })
      .select('_id eje')
      .lean()
    targetIds = conEje
      .filter((p) => normalizeKpiTipo(p.eje) === tipoNorm)
      .map((p) => String(p._id))
  }

  const meta = opts.meta != null ? String(opts.meta) : ''

  await Proyecto.updateMany(
    { kpi_id: kid, _id: { $nin: targetIds } },
    { $set: { kpi_id: null, meta_kpi: '' } },
  )

  if (targetIds.length > 0) {
    await Proyecto.updateMany(
      { _id: { $in: targetIds } },
      { $set: { kpi_id: kid, meta_kpi: meta } },
    )
  }

  await KPI.findByIdAndUpdate(kid, {
    proyecto_ids: targetIds,
    tipo: opts.tipo?.trim() || opts.eje?.trim() || '',
  })

  return { vinculados: targetIds.length, proyecto_ids: targetIds }
}

/** Quita referencias al KPI en proyectos al eliminarlo. */
export async function clearKpiFromProyectos(kpiId: string): Promise<void> {
  if (!mongoose.isValidObjectId(kpiId)) return
  const kid = new mongoose.Types.ObjectId(kpiId)
  await Proyecto.updateMany(
    { kpi_id: kid },
    { $set: { kpi_id: null, meta_kpi: '' } },
  )
}
