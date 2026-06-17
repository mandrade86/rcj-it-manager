/**
 * Cuenta perfiles, plantillas, planes y prerequisitos en la BD actual.
 *
 *   npm run talento:diagnostico
 *
 * Docker prod:
 *   docker compose -f docker-compose.prod.yml --env-file .env.production exec -T app \
 *     npx tsx server/scripts/diagnosticarTalento.ts
 */
import 'dotenv/config'

import fs from 'node:fs'

import { connectDb, disconnectDb } from '../db/connection.js'
import '../db/models/index.js'
import { Colaborador } from '../db/models/Colaborador.js'
import { Departamento } from '../db/models/Departamento.js'
import { Empleado } from '../db/models/Empleado.js'
import { PerfilPuesto } from '../db/models/PerfilPuesto.js'
import { PlanCarrera } from '../db/models/PlanCarrera.js'
import { PlantillaCarrera } from '../db/models/PlantillaCarrera.js'
import { defaultTalentoExportPath, resolveTalentoFilePath } from '../utils/talentoExportImport.js'

function parseFileArg(): string | null {
  const i = process.argv.indexOf('--file')
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  const p = defaultTalentoExportPath()
  return fs.existsSync(p) ? p : null
}

async function main() {
  const mongoUri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/rcj_it_manager'
  await connectDb()
  try {
    const [perfiles, plantillas, planes, colabs, empleados, deptos] = await Promise.all([
      PerfilPuesto.countDocuments({}),
      PlantillaCarrera.countDocuments({}),
      PlanCarrera.countDocuments({}),
      Colaborador.countDocuments({}),
      Empleado.countDocuments({}),
      Departamento.countDocuments({}),
    ])

    const depIt = await Departamento.findOne({
      $or: [{ codigo: 'DEP-8' }, { codigo: 'IT' }, { ehr_departamento_id: 8 }],
    })
      .select('codigo nombre')
      .lean()

    const out: Record<string, unknown> = {
      ok: true,
      mongodb: mongoUri.replace(/\/\/[^@]+@/, '//***@'),
      en_bd: {
        perfiles_puesto: perfiles,
        plantillas_carrera: plantillas,
        planes_carrera: planes,
        colaboradores: colabs,
        empleados,
        departamentos: deptos,
        departamento_it: depIt ? `${depIt.codigo} — ${depIt.nombre}` : null,
      },
    }

    const fileArg = parseFileArg()
    if (fileArg) {
      const resolved = resolveTalentoFilePath(fileArg)
      out.archivo_import = resolved
      out.archivo_existe = fs.existsSync(resolved)
    }

    console.log(JSON.stringify(out, null, 2))
  } finally {
    await disconnectDb()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
