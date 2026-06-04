/**
 * Exporta todos los departamentos de MongoDB a JSON (copia fiel del entorno local).
 *
 *   npm run departamentos:exportar
 *   npx tsx server/scripts/exportarDepartamentos.ts --out data/departamentos-export.json
 */
import 'dotenv/config'

import { connectDb, disconnectDb } from '../db/connection.js'
import '../db/models/index.js'
import {
  defaultExportPath,
  exportDepartamentosToFile,
} from '../utils/departamentosExportImport.js'

function parseOutArg(): string {
  const i = process.argv.indexOf('--out')
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return defaultExportPath()
}

async function main() {
  const outPath = parseOutArg()
  await connectDb()
  try {
    const payload = await exportDepartamentosToFile(outPath)
    console.log(
      JSON.stringify(
        {
          ok: true,
          archivo: outPath,
          count: payload.count,
          exportedAt: payload.exportedAt,
          nota: 'Copia este archivo al servidor y ejecuta departamentos:importar',
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
