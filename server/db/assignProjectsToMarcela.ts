/**
 * Assigns every existing project to Marcela Hernandez.
 *
 * Usage:
 *   npm run proyectos:asignar-marcela
 *
 * Optional overrides:
 *   PROJECT_OWNER_NAME="Marcela Hernandez" npm run proyectos:asignar-marcela
 *   PROJECT_OWNER_EMAIL="marcela.hernandez@rcjcorp.hn" npm run proyectos:asignar-marcela
 *   SET_PROJECT_DEPARTMENT=false npm run proyectos:asignar-marcela
 */
import { connectDb, disconnectDb } from './connection.js'
import { Proyecto } from './models/Proyecto.js'
import { Usuario } from './models/Usuario.js'

type UsuarioAsignable = {
  _id: unknown
  nombre: string
  email: string
  departamento_id?: unknown
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

async function resolveUsuario(): Promise<UsuarioAsignable> {
  const targetName = process.env.PROJECT_OWNER_NAME ?? 'Marcela Hernandez'
  const targetEmail = process.env.PROJECT_OWNER_EMAIL

  if (targetEmail) {
    const byEmail = await Usuario.findOne({ email: targetEmail.toLowerCase().trim(), activo: true })
      .select('_id nombre email departamento_id')
      .lean<UsuarioAsignable>()
    if (byEmail) return byEmail
    throw new Error(`No existe un usuario activo con email ${targetEmail}`)
  }

  const usuarios = await Usuario.find({ activo: true })
    .select('_id nombre email departamento_id')
    .lean<UsuarioAsignable[]>()

  const target = normalize(targetName)
  const exact = usuarios.filter((u) => normalize(u.nombre) === target)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) {
    throw new Error(
      `Hay ${exact.length} usuarios activos con nombre "${targetName}". Usa PROJECT_OWNER_EMAIL para elegir uno.`,
    )
  }

  const tokens = target.split(' ').filter(Boolean)
  const byTokens = usuarios.filter((u) => {
    const haystack = normalize(`${u.nombre} ${u.email}`)
    return tokens.every((token) => haystack.includes(token))
  })
  if (byTokens.length === 1) return byTokens[0]

  const candidates = byTokens.length > 0 ? byTokens : usuarios.filter((u) => normalize(u.nombre).includes('marcela'))
  const suffix = candidates.length
    ? ` Candidatos: ${candidates.map((u) => `${u.nombre} <${u.email}>`).join(', ')}`
    : ''
  throw new Error(`No pude identificar un único usuario activo para "${targetName}".${suffix}`)
}

async function main() {
  await connectDb()

  const usuario = await resolveUsuario()
  const total = await Proyecto.countDocuments()
  const patch: Record<string, unknown> = {
    usuario_id: usuario._id,
    responsable: usuario.nombre,
  }

  if (process.env.SET_PROJECT_DEPARTMENT !== 'false' && usuario.departamento_id) {
    patch.departamento_id = usuario.departamento_id
  }

  const result = await Proyecto.updateMany({}, { $set: patch })

  console.log('Asignación de proyectos completada')
  console.log(`Usuario destino: ${usuario.nombre} <${usuario.email}>`)
  console.log(`Proyectos existentes: ${total}`)
  console.log(`Proyectos modificados: ${result.modifiedCount}`)
}

main()
  .catch((err) => {
    console.error('Error asignando proyectos:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDb()
  })
