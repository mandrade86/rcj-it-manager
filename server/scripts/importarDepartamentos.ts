/**
 * Importa departamentos desde JSON exportado (misma copia que el entorno local).
 *
 *   npm run departamentos:importar
 *   npx tsx server/scripts/importarDepartamentos.ts --file data/departamentos-export.json
 *
 * Docker:
 *   docker compose -f docker-compose.prod.yml --env-file .env.production exec -T app \
 *     npx tsx server/scripts/importarDepartamentos.ts --file /app/data/departamentos-export.json
 */
import 'dotenv/config'

import { connectDb, disconnectDb } from '../db/connection.js'
import '../db/models/index.js'
import { Departamento } from '../db/models/Departamento.js'
import {
  defaultExportPath,
  importDepartamentosFromFile,
} from '../utils/departamentosExportImport.js'

function parseFileArg(): string {
  const i = process.argv.indexOf('--file')
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return defaultExportPath()
}

async function main() {
  const filePath = parseFileArg()
  await connectDb()
  try {
    const result = await importDepartamentosFromFile(filePath)
    const totalBd = await Departamento.countDocuments({})
    console.log(
      JSON.stringify(
        {
          ok: true,
          archivo: filePath,
          ...result,
          departamentos_en_bd: totalBd,
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
