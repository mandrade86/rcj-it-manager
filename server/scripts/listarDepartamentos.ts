/**
 * Lista conteos y departamentos en MongoDB (diagnóstico).
 *   npx tsx server/scripts/listarDepartamentos.ts
 */
import 'dotenv/config'

import { connectDb, disconnectDb } from '../db/connection.js'
import '../db/models/index.js'
import { Departamento } from '../db/models/Departamento.js'
import { DEPARTAMENTOS_EHR_SEED } from '../db/data/departamentosEhrCatalog.js'

async function main() {
  await connectDb()
  try {
    const total = await Departamento.countDocuments({})
    const activos = await Departamento.countDocuments({ activo: { $ne: false } })
    const sinEhr = await Departamento.countDocuments({
      $or: [{ ehr_departamento_id: null }, { ehr_departamento_id: { $exists: false } }],
    })
    const all = await Departamento.find({})
      .select('codigo nombre ehr_departamento_id ehr_empresa_id activo')
      .sort({ ehr_departamento_id: 1, codigo: 1 })
      .lean()

    const seedIds = new Set(DEPARTAMENTOS_EHR_SEED.map((d) => d.ehr_departamento_id))
    const enBdSinSeed = all.filter(
      (d) => d.ehr_departamento_id != null && !seedIds.has(d.ehr_departamento_id),
    )
    const enSeedNoBd = [...seedIds].filter(
      (id) => !all.some((d) => d.ehr_departamento_id === id),
    )

    console.log(
      JSON.stringify(
        {
          catalogo_seed: DEPARTAMENTOS_EHR_SEED.length,
          total_bd: total,
          activos_bd: activos,
          sin_ehr_id: sinEhr,
          en_bd_no_en_seed: enBdSinSeed,
          en_seed_no_en_bd: enSeedNoBd,
          sin_ehr_id_docs: all.filter((d) => d.ehr_departamento_id == null),
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
