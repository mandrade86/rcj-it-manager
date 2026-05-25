import mongoose from 'mongoose'

import { isMetaTipoCalculo } from '../db/data/kpiCalculoTipos.js'
import { Departamento } from '../db/models/Departamento.js'
import { KPI } from '../db/models/KPI.js'
import type { MetaDeptoDoc } from './metasDepartamento.js'

export type MetaListItem = MetaDeptoDoc & {
  departamento_id: string
  departamento_codigo: string
  departamento_nombre: string
  kpi_count: number
}

const META_ID_RE = /^[a-z][a-z0-9_-]{0,47}$/

export function normalizeMetaId(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
}

export function isValidMetaId(id: string): boolean {
  return META_ID_RE.test(id)
}

export async function listMetas(filter: {
  departamento_id?: string
  activa?: 'true' | 'false'
}): Promise<MetaListItem[]> {
  const deptFilter: Record<string, unknown> = {}
  if (filter.departamento_id && mongoose.isValidObjectId(filter.departamento_id)) {
    deptFilter._id = new mongoose.Types.ObjectId(filter.departamento_id)
  }

  const depts = await Departamento.find(deptFilter)
    .select('_id codigo nombre metas_estrategicas')
    .sort({ codigo: 1 })
    .lean()

  const kpiCounts = await KPI.aggregate<{ _id: { d: mongoose.Types.ObjectId; m: string }; n: number }>([
    { $match: { departamento_id: { $ne: null }, meta_id: { $nin: [null, ''] } } },
    { $group: { _id: { d: '$departamento_id', m: '$meta_id' }, n: { $sum: 1 } } },
  ])
  const countMap = new Map(
    kpiCounts.map((r) => [`${String(r._id.d)}::${r._id.m}`, r.n]),
  )

  const out: MetaListItem[] = []
  for (const d of depts) {
    const deptId = String(d._id)
    for (const m of (d.metas_estrategicas ?? []) as MetaDeptoDoc[]) {
      if (filter.activa === 'true' && m.activa === false) continue
      if (filter.activa === 'false' && m.activa !== false) continue
      out.push({
        ...m,
        departamento_id: deptId,
        departamento_codigo: d.codigo ?? '',
        departamento_nombre: d.nombre ?? '',
        kpi_count: countMap.get(`${deptId}::${m.id}`) ?? 0,
      })
    }
  }
  return out
}

export async function getMeta(
  departamentoId: string,
  metaId: string,
): Promise<MetaListItem | null> {
  const rows = await listMetas({ departamento_id: departamentoId })
  return rows.find((m) => m.id === metaId) ?? null
}

async function loadDeptMetas(deptId: string): Promise<{
  dept: { _id: mongoose.Types.ObjectId; codigo: string; nombre: string }
  metas: MetaDeptoDoc[]
} | null> {
  const dept = await Departamento.findById(deptId)
    .select('_id codigo nombre metas_estrategicas')
    .lean()
  if (!dept) return null
  return {
    dept: {
      _id: dept._id as mongoose.Types.ObjectId,
      codigo: dept.codigo ?? '',
      nombre: dept.nombre ?? '',
    },
    metas: [...((dept.metas_estrategicas ?? []) as MetaDeptoDoc[])],
  }
}

export async function createMeta(input: {
  departamento_id: string
  id?: string
  titulo: string
  objetivo?: string
  valor_objetivo?: string
  tipo_calculo?: string
  activa?: boolean
}): Promise<MetaListItem> {
  const loaded = await loadDeptMetas(input.departamento_id)
  if (!loaded) throw new Error('Departamento no encontrado')

  const titulo = input.titulo.trim()
  if (!titulo) throw new Error('El título es obligatorio')

  let id = input.id?.trim() ? normalizeMetaId(input.id) : normalizeMetaId(titulo)
  if (!id) id = `meta_${Date.now()}`
  if (!isValidMetaId(id)) {
    throw new Error('ID inválido. Usa letras minúsculas, números, guiones (ej. continuidad, equipo_it).')
  }
  if (loaded.metas.some((m) => m.id === id)) {
    throw new Error(`Ya existe una meta con id "${id}" en este departamento.`)
  }

  const tipoCalculo =
    input.tipo_calculo && isMetaTipoCalculo(input.tipo_calculo)
      ? input.tipo_calculo
      : 'promedio_kpis'

  const nueva: MetaDeptoDoc = {
    id,
    titulo,
    objetivo: input.objetivo?.trim() ?? '',
    valor_objetivo: input.valor_objetivo?.trim() ?? '',
    tipo_calculo: tipoCalculo,
    activa: input.activa !== false,
  }

  loaded.metas.push(nueva)
  await Departamento.findByIdAndUpdate(loaded.dept._id, {
    $set: { metas_estrategicas: loaded.metas },
  })

  return {
    ...nueva,
    departamento_id: String(loaded.dept._id),
    departamento_codigo: loaded.dept.codigo,
    departamento_nombre: loaded.dept.nombre,
    kpi_count: 0,
  }
}

export async function updateMeta(
  departamentoId: string,
  metaId: string,
  patch: Partial<{
    titulo: string
    objetivo: string
    valor_objetivo: string
    tipo_calculo: string
    activa: boolean
  }>,
): Promise<MetaListItem> {
  const loaded = await loadDeptMetas(departamentoId)
  if (!loaded) throw new Error('Departamento no encontrado')

  const idx = loaded.metas.findIndex((m) => m.id === metaId)
  if (idx < 0) throw new Error('Meta no encontrada')

  const cur = loaded.metas[idx]!
  if (patch.titulo !== undefined) cur.titulo = patch.titulo.trim()
  if (patch.objetivo !== undefined) cur.objetivo = patch.objetivo.trim()
  if (patch.valor_objetivo !== undefined) cur.valor_objetivo = patch.valor_objetivo.trim()
  if (patch.tipo_calculo !== undefined) {
    if (!isMetaTipoCalculo(patch.tipo_calculo)) throw new Error('tipo_calculo inválido')
    cur.tipo_calculo = patch.tipo_calculo
  }
  if (patch.activa !== undefined) cur.activa = patch.activa

  if (!cur.titulo.trim()) throw new Error('El título es obligatorio')

  loaded.metas[idx] = cur
  await Departamento.findByIdAndUpdate(loaded.dept._id, {
    $set: { metas_estrategicas: loaded.metas },
  })

  const kpi_count = await KPI.countDocuments({
    departamento_id: loaded.dept._id,
    meta_id: metaId,
  })

  return {
    ...cur,
    departamento_id: String(loaded.dept._id),
    departamento_codigo: loaded.dept.codigo,
    departamento_nombre: loaded.dept.nombre,
    kpi_count,
  }
}

export async function deleteMeta(departamentoId: string, metaId: string): Promise<void> {
  const loaded = await loadDeptMetas(departamentoId)
  if (!loaded) throw new Error('Departamento no encontrado')

  const kpi_count = await KPI.countDocuments({
    departamento_id: loaded.dept._id,
    meta_id: metaId,
  })
  if (kpi_count > 0) {
    throw new Error(
      `No se puede eliminar: ${kpi_count} KPI(s) vinculado(s). Reasígnalos o elimínalos primero.`,
    )
  }

  const next = loaded.metas.filter((m) => m.id !== metaId)
  if (next.length === loaded.metas.length) throw new Error('Meta no encontrada')

  await Departamento.findByIdAndUpdate(loaded.dept._id, {
    $set: { metas_estrategicas: next },
  })
}

export async function deleteMetasLote(
  items: Array<{ departamento_id: string; meta_id: string }>,
): Promise<{ eliminados: number; errores: Array<{ key: string; error: string }> }> {
  let eliminados = 0
  const errores: Array<{ key: string; error: string }> = []
  for (const it of items) {
    const key = `${it.departamento_id}/${it.meta_id}`
    try {
      await deleteMeta(it.departamento_id, it.meta_id)
      eliminados++
    } catch (e) {
      errores.push({ key, error: e instanceof Error ? e.message : 'Error' })
    }
  }
  return { eliminados, errores }
}
