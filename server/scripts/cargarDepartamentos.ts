/**
 * Carga el catálogo de empresas y departamentos EHR (mismo que entorno local / INIT_DATA).
 * Fuente: server/db/data/departamentosEhrCatalog.ts → ensureDepartamentos()
 *
 * Uso local:
 *   npx tsx server/scripts/cargarDepartamentos.ts
 *
 * Docker (producción) — tras git pull y rebuild, o con volumen:
 *   docker compose -f docker-compose.prod.yml --env-file .env.production exec -T app \
 *     npx tsx server/scripts/cargarDepartamentos.ts
 *
 *   docker compose -f docker-compose.prod.yml --env-file .env.production run --rm \
 *     -v "$(pwd)/server:/app/server:ro" app npx tsx server/scripts/cargarDepartamentos.ts
 */
import 'dotenv/config'

import { connectDb, disconnectDb } from '../db/connection.js'
import '../db/models/index.js'
import { Departamento } from '../db/models/Departamento.js'
import { Empresa } from '../db/models/Empresa.js'
import { DEPARTAMENTOS_EHR_SEED } from '../db/data/departamentosEhrCatalog.js'
import { ensureDepartamentos, ensureEjesProyecto } from '../db/initData.js'

async function main() {
  await connectDb()
  try {
    console.log('Cargando empresas y departamentos (catálogo EHR)…')
    await ensureDepartamentos()
    await ensureEjesProyecto()

    const [empresas, departamentos, it] = await Promise.all([
      Empresa.countDocuments({}),
      Departamento.countDocuments({ activo: { $ne: false } }),
      Departamento.findOne({ ehr_departamento_id: 8 }).select('codigo nombre').lean(),
    ])

    console.log(
      JSON.stringify(
        {
          ok: true,
          catalogo_departamentos_seed: DEPARTAMENTOS_EHR_SEED.length,
          empresas_en_bd: empresas,
          departamentos_activos_en_bd: departamentos,
          departamento_it: it
            ? { codigo: it.codigo, nombre: it.nombre, _id: String(it._id) }
            : null,
          nota: 'No borra metas ni KPIs existentes; actualiza codigo, nombre, empresa y ejes IT.',
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
