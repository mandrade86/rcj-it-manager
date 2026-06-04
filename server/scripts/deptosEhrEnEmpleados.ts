/**
 * Depto # referenciados en empleados (EHR) que no están en catálogo ni en BD.
 *   npx tsx server/scripts/deptosEhrEnEmpleados.ts
 */
import 'dotenv/config'

import { connectDb, disconnectDb } from '../db/connection.js'
import '../db/models/index.js'
import { Departamento } from '../db/models/Departamento.js'
import { Empleado } from '../db/models/Empleado.js'
import { DEPARTAMENTOS_EHR_SEED } from '../db/data/departamentosEhrCatalog.js'

function parseDeptoNum(ext: Record<string, unknown> | null | undefined): number | null {
  if (!ext || typeof ext !== 'object') return null
  const raw =
    ext.deptoId ??
    ext.depto_id ??
    ext.idDepartamento ??
    ext.departmentId ??
    ext.Depto ??
    ext['Depto #']
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (raw == null || raw === '') return null
  const p = Number(String(raw).trim())
  return Number.isFinite(p) ? p : null
}

async function main() {
  await connectDb()
  try {
    const seedIds = new Set(DEPARTAMENTOS_EHR_SEED.map((d) => d.ehr_departamento_id))
    const bdIds = new Set(
      (await Departamento.find({ ehr_departamento_id: { $ne: null } })
        .select('ehr_departamento_id')
        .lean())
        .map((d) => d.ehr_departamento_id as number),
    )

    const used = new Map<number, number>()
    const cursor = Empleado.find({ activo: { $ne: false } })
      .select('datos_externos departamento')
      .cursor()
    for await (const e of cursor) {
      const ext = e.datos_externos as Record<string, unknown> | undefined
      let n = parseDeptoNum(ext)
      if (n == null && typeof e.departamento === 'string') {
        const m = e.departamento.match(/^depto\s*#?\s*(\d+)\s*$/i)
        if (m) n = Number(m[1])
      }
      if (n == null) continue
      used.set(n, (used.get(n) ?? 0) + 1)
    }

    const faltanSeed: Array<{ depto: number; empleados: number }> = []
    const faltanBd: Array<{ depto: number; empleados: number }> = []
    for (const [depto, empleados] of [...used.entries()].sort((a, b) => a[0] - b[0])) {
      if (!seedIds.has(depto)) faltanSeed.push({ depto, empleados })
      if (!bdIds.has(depto)) faltanBd.push({ depto, empleados })
    }

    console.log(
      JSON.stringify(
        {
          empleados_con_depto_num: used.size,
          deptos_usados_en_empleados: used.size,
          faltan_en_catalogo_seed: faltanSeed,
          faltan_en_bd: faltanBd,
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
