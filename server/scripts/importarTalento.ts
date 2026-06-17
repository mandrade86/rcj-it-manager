/**
 * Importa perfiles, plantillas y planes de carrera desde JSON exportado en local.
 *
 * Local (contra Mongo local):
 *   npm run talento:importar
 *   npx tsx server/scripts/importarTalento.ts --file data/talento-export.json
 *
 * Producción (Docker):
 *   docker compose -f docker-compose.prod.yml --env-file .env.production exec -T app \
 *     npx tsx server/scripts/importarTalento.ts --file /app/data/talento-export.json
 */
import 'dotenv/config'

import fs from 'node:fs'

import { connectDb, disconnectDb } from '../db/connection.js'
import '../db/models/index.js'
import { defaultTalentoExportPath, importTalentoFromFile, resolveTalentoFilePath } from '../utils/talentoExportImport.js'
import { PerfilPuesto } from '../db/models/PerfilPuesto.js'
import { PlantillaCarrera } from '../db/models/PlantillaCarrera.js'
import { PlanCarrera } from '../db/models/PlanCarrera.js'

function parseFileArg(): string {
  const i = process.argv.indexOf('--file')
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return defaultTalentoExportPath()
}

async function main() {
  const filePath = parseFileArg()
  const resolved = resolveTalentoFilePath(filePath)
  if (!fs.existsSync(resolved)) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: `Archivo no encontrado: ${resolved}`,
          hint: 'En el servidor use SSH y docker exec. En local use data/talento-export.json',
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  const mongoUri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/rcj_it_manager'
  await connectDb()
  try {
    const result = await importTalentoFromFile(resolved)
    const [perfilesBd, plantillasBd, planesBd] = await Promise.all([
      PerfilPuesto.countDocuments({}),
      PlantillaCarrera.countDocuments({}),
      PlanCarrera.countDocuments({}),
    ])
    console.log(
      JSON.stringify(
        {
          ok: true,
          archivo: resolved,
          mongodb: mongoUri.replace(/\/\/[^@]+@/, '//***@'),
          ...result,
          en_bd: {
            perfiles_puesto: perfilesBd,
            plantillas_carrera: plantillasBd,
            planes_carrera: planesBd,
          },
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
