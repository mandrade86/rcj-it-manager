import fs from 'node:fs/promises'
import path from 'node:path'

import mongoose from 'mongoose'

import { Departamento } from '../db/models/Departamento.js'
import { Empresa } from '../db/models/Empresa.js'
import { ensureDepartamentos } from '../db/initData.js'

export type DepartamentoExportRow = {
  codigo: string
  nombre: string
  descripcion?: string
  color?: string
  ehr_departamento_id?: number | null
  ehr_empresa_id?: number | null
  ejes_proyecto?: string[]
  lleva_gastos?: boolean
  archivo_gastos?: string
  activo?: boolean
  metas_estrategicas?: unknown[]
}

export type DepartamentosExportFile = {
  exportedAt: string
  source: string
  count: number
  departamentos: DepartamentoExportRow[]
}

const EXPORT_FIELDS =
  'codigo nombre descripcion color ehr_departamento_id ehr_empresa_id ejes_proyecto lleva_gastos archivo_gastos activo metas_estrategicas' as const

export async function exportDepartamentosToFile(outPath: string): Promise<DepartamentosExportFile> {
  const rows = await Departamento.find({})
    .select(EXPORT_FIELDS)
    .sort({ ehr_empresa_id: 1, ehr_departamento_id: 1, codigo: 1 })
    .lean()

  const payload: DepartamentosExportFile = {
    exportedAt: new Date().toISOString(),
    source: 'rcj-it-manager',
    count: rows.length,
    departamentos: rows.map((d) => ({
      codigo: d.codigo,
      nombre: d.nombre,
      descripcion: d.descripcion ?? '',
      color: d.color ?? '#002060',
      ehr_departamento_id: d.ehr_departamento_id ?? null,
      ehr_empresa_id: d.ehr_empresa_id ?? null,
      ejes_proyecto: d.ejes_proyecto ?? [],
      lleva_gastos: Boolean(d.lleva_gastos),
      archivo_gastos: d.archivo_gastos ?? '',
      activo: d.activo !== false,
      metas_estrategicas: d.metas_estrategicas ?? [],
    })),
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8')
  return payload
}

async function empresaOidByEhr(): Promise<Map<number, mongoose.Types.ObjectId>> {
  const empresas = await Empresa.find({ ehr_empresa_id: { $exists: true, $ne: null } })
    .select('_id ehr_empresa_id')
    .lean()
  return new Map(
    empresas.map((e) => [e.ehr_empresa_id as number, e._id as mongoose.Types.ObjectId]),
  )
}

export async function importDepartamentosFromFile(
  filePath: string,
  opts?: { ensureCatalogFirst?: boolean },
): Promise<{ insertados: number; actualizados: number; omitidos: number; total: number }> {
  const raw = await fs.readFile(filePath, 'utf8')
  const parsed = JSON.parse(raw) as DepartamentosExportFile | DepartamentoExportRow[]
  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.departamentos)
      ? parsed.departamentos
      : []

  if (opts?.ensureCatalogFirst !== false) {
    await ensureDepartamentos()
  }

  const empresaMap = await empresaOidByEhr()
  let insertados = 0
  let actualizados = 0
  let omitidos = 0

  for (const row of rows) {
    const codigo = String(row.codigo ?? '').trim()
    const nombre = String(row.nombre ?? '').trim()
    if (!codigo || !nombre) {
      omitidos++
      continue
    }

    const filter =
      row.ehr_departamento_id != null
        ? { ehr_departamento_id: row.ehr_departamento_id }
        : { codigo }

    const ehrEmpresaId = row.ehr_empresa_id ?? null
    const $set: Record<string, unknown> = {
      codigo,
      nombre,
      descripcion: row.descripcion ?? '',
      color: row.color ?? '#002060',
      ehr_departamento_id: row.ehr_departamento_id ?? null,
      ehr_empresa_id: ehrEmpresaId,
      empresa_id:
        ehrEmpresaId != null && empresaMap.has(ehrEmpresaId) ? empresaMap.get(ehrEmpresaId) : null,
      ejes_proyecto: row.ejes_proyecto ?? [],
      lleva_gastos: Boolean(row.lleva_gastos),
      archivo_gastos: row.archivo_gastos ?? '',
      activo: row.activo !== false,
    }
    if (Array.isArray(row.metas_estrategicas) && row.metas_estrategicas.length > 0) {
      $set.metas_estrategicas = row.metas_estrategicas
    }

    const prev = await Departamento.findOne(filter).select('_id').lean()
    await Departamento.findOneAndUpdate(filter, { $set }, { upsert: true })
    if (prev) actualizados++
    else insertados++
  }

  return { insertados, actualizados, omitidos, total: rows.length }
}

export function defaultExportPath(): string {
  return path.resolve(process.cwd(), 'data', 'departamentos-export.json')
}
