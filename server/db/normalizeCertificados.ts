/**
 * Normaliza `asignados[].certificado` a solo nombre de archivo (sin /api/certificados/).
 * Uso: npm run normalize:certificados
 */
import { connectDb, disconnectDb } from './connection.js'
import { Capacitacion } from './models/Capacitacion.js'
import { normalizeCertificadoStored } from '../utils/certificadoStored.js'

async function main() {
  await connectDb()

  const caps = await Capacitacion.find({
    asignados: {
      $elemMatch: {
        certificado: { $exists: true, $nin: [null, ''] },
      },
    },
  })

  let docsUpdated = 0
  let asignacionesUpdated = 0

  for (const cap of caps) {
    let dirty = false
    for (const row of cap.asignados) {
      const raw = row.certificado
      if (!raw) continue
      const norm = normalizeCertificadoStored(raw)
      if (norm !== raw) {
        row.certificado = norm
        dirty = true
        asignacionesUpdated++
        console.log(`  ${cap.nombre} → ${raw} → ${norm}`)
      }
    }
    if (dirty) {
      await cap.save()
      docsUpdated++
    }
  }

  console.log(
    `Listo. Capacitaciones revisadas: ${caps.length}. Documentos actualizados: ${docsUpdated}. Asignaciones corregidas: ${asignacionesUpdated}.`,
  )
  await disconnectDb()
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
