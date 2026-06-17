/**
 * Exporta perfiles de puesto, plantillas de carrera y planes de carrera (local → JSON).
 *
 * Local:
 *   npm run talento:exportar
 *   npx tsx server/scripts/exportarTalento.ts --out data/talento-export.json
 */
import 'dotenv/config'

import { connectDb, disconnectDb } from '../db/connection.js'
import '../db/models/index.js'
import { defaultTalentoExportPath, exportTalentoToFile } from '../utils/talentoExportImport.js'

function parseOutArg(): string {
  const i = process.argv.indexOf('--out')
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return defaultTalentoExportPath()
}

async function main() {
  const outPath = parseOutArg()
  await connectDb()
  try {
    const payload = await exportTalentoToFile(outPath)
    console.log(
      JSON.stringify(
        {
          ok: true,
          archivo: outPath,
          exportedAt: payload.exportedAt,
          perfiles_puesto: payload.perfiles_puesto.length,
          plantillas_carrera: payload.plantillas_carrera.length,
          planes_carrera: payload.planes_carrera.length,
          colaboradores_perfil: payload.colaboradores_perfil.length,
          nota: 'Copia data/talento-export.json al servidor y ejecuta talento:importar',
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
