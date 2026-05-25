/**
 * Vacía colecciones de capacitaciones y proveedores en MongoDB local.
 * Uso: npm run clear:capacitaciones
 */
import { connectDb, disconnectDb } from './connection.js'
import { Capacitacion } from './models/Capacitacion.js'
import { ProveedorCapacitacion } from './models/ProveedorCapacitacion.js'

async function main() {
  await connectDb()
  const [caps, provs] = await Promise.all([
    Capacitacion.deleteMany({}),
    ProveedorCapacitacion.deleteMany({}),
  ])
  console.log(
    `Capacitaciones eliminadas: ${caps.deletedCount ?? 0}. Proveedores eliminados: ${provs.deletedCount ?? 0}.`,
  )
  await disconnectDb()
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
