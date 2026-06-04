/**
 * Depto # y nombres únicos en el listado de empleados del EHR (URL configurada).
 *   npx tsx server/scripts/deptosDesdeEhrApi.ts
 */
import 'dotenv/config'

import { connectDb, disconnectDb } from '../db/connection.js'
import '../db/models/index.js'
import { Config } from '../db/models/Config.js'
import { DEPARTAMENTOS_EHR_SEED } from '../db/data/departamentosEhrCatalog.js'
import { fetchEhrJson } from '../utils/ehrAuth.js'

function valueToString(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function nestedDescripcion(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const row = value as Record<string, unknown>
  return valueToString(row.descripcion ?? row.nombre ?? row.name)
}

function extractDeptoNum(row: Record<string, unknown>): number | null {
  const raw =
    row.deptoId ??
    row.depto_id ??
    row.idDepartamento ??
    row.departmentId ??
    row['Depto #'] ??
    row['depto #']
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function normalizeEmployeePayload(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>
  if (payload && typeof payload === 'object') {
    const row = payload as Record<string, unknown>
    if (Array.isArray(row.data)) return row.data as Array<Record<string, unknown>>
    if (Array.isArray(row.items)) return row.items as Array<Record<string, unknown>>
    if (Array.isArray(row.results)) return row.results as Array<Record<string, unknown>>
  }
  throw new Error('El servicio no devolvió un array ni un objeto con data[]')
}

async function main() {
  await connectDb()
  try {
    const cfg = await Config.findOne({ clave: 'empleados_service_url' }).lean()
    const url = cfg?.valor?.trim()
    if (!url) {
      console.log(JSON.stringify({ error: 'empleados_service_url no configurada en Config' }, null, 2))
      return
    }

    const data = normalizeEmployeePayload(await fetchEhrJson(url))
    const seedIds = new Set(DEPARTAMENTOS_EHR_SEED.map((d) => d.ehr_departamento_id))
    const byDepto = new Map<number, { nombre: string; empleados: number; empresaId?: number }>()

    for (const row of data) {
      const deptoNum = extractDeptoNum(row)
      if (deptoNum == null) continue
      const nombre =
        valueToString(row.departamento) ||
        nestedDescripcion(row.departamento) ||
        `Depto ${deptoNum}`
      const empresaId = Number(row.empresaId ?? row.empresa_id)
      const prev = byDepto.get(deptoNum)
      byDepto.set(deptoNum, {
        nombre: prev?.nombre && prev.nombre !== `Depto ${deptoNum}` ? prev.nombre : nombre,
        empleados: (prev?.empleados ?? 0) + 1,
        empresaId: Number.isFinite(empresaId) ? empresaId : prev?.empresaId,
      })
    }

    const faltanEnSeed = [...byDepto.entries()]
      .filter(([id]) => !seedIds.has(id))
      .map(([depto, v]) => ({ depto, ...v }))
      .sort((a, b) => a.depto - b.depto)

    console.log(
      JSON.stringify(
        {
          url,
          empleados_en_api: data.length,
          deptos_distintos_en_api: byDepto.size,
          catalogo_seed: seedIds.size,
          faltan_en_catalogo_seed: faltanEnSeed,
        },
        null,
        2,
      ),
    )
  } finally {
    await disconnectDb()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
