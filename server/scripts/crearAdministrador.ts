/**
 * Crea o actualiza un usuario con rol Administrador (permiso *).
 *
 * Uso local:
 *   npx tsx server/scripts/crearAdministrador.ts --email marcela.hernandez@grupoc.com --password "TuClaveSegura" --nombre "Marcela Hernández"
 *
 * Variables de entorno (alternativa):
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NOMBRE
 *
 * En servidor Docker (producción):
 *   docker compose -f docker-compose.prod.yml --env-file .env.production exec -T app \
 *     npx tsx server/scripts/crearAdministrador.ts \
 *     --email marcela.hernandez@grupoc.com --password "TuClaveSegura" --nombre "Marcela Hernández"
 */
import 'dotenv/config'
import bcrypt from 'bcrypt'

import { connectDb, disconnectDb } from '../db/connection.js'
import '../db/models/index.js'
import { Departamento } from '../db/models/Departamento.js'
import { Rol } from '../db/models/Rol.js'
import { Usuario } from '../db/models/Usuario.js'

const BCRYPT_ROUNDS = 10

const ROLES_INICIALES = [
  {
    nombre: 'Administrador',
    descripcion: 'Acceso completo a todas las funciones del sistema',
    permisos: ['*'],
  },
  {
    nombre: 'Jefe IT',
    descripcion: 'Acceso completo a módulos operativos y administración de usuarios.',
    permisos: [
      'dashboard:ver',
      'proyectos:ver',
      'proyectos:editar',
      'equipo:ver',
      'equipo:editar',
      'capacitaciones:ver',
      'capacitaciones:editar',
      'gastos:ver',
      'kpis:ver',
      'kpis:editar',
      'capacitaciones:ver-todos',
      'maestros:ver',
      'maestros:editar',
      'empleados:ver',
      'empleados:editar',
      'usuarios:ver',
      'usuarios:editar',
      'roles:ver',
      'roles:editar',
      'it:arquitectura:ver',
      'it:arquitectura:editar',
    ],
  },
  {
    nombre: 'Coordinador',
    descripcion: 'Edición de proyectos, equipo y capacitaciones.',
    permisos: [
      'dashboard:ver',
      'proyectos:ver',
      'proyectos:editar',
      'equipo:ver',
      'equipo:editar',
      'capacitaciones:ver',
      'capacitaciones:editar',
      'kpis:ver',
      'empleados:ver',
      'it:arquitectura:ver',
      'it:arquitectura:editar',
    ],
  },
  {
    nombre: 'Consulta',
    descripcion: 'Solo lectura en todos los módulos',
    permisos: [
      'dashboard:ver',
      'proyectos:ver',
      'equipo:ver',
      'capacitaciones:ver',
      'gastos:ver',
      'kpis:ver',
      'maestros:ver',
      'empleados:ver',
      'it:arquitectura:ver',
    ],
  },
] as const

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--email' || a === '-e') out.email = argv[++i] ?? ''
    else if (a === '--password' || a === '-p') out.password = argv[++i] ?? ''
    else if (a === '--nombre' || a === '-n') out.nombre = argv[++i] ?? ''
    else if (a === '--help' || a === '-h') out.help = '1'
  }
  return out
}

async function ensureRoles(): Promise<void> {
  for (const r of ROLES_INICIALES) {
    await Rol.findOneAndUpdate({ nombre: r.nombre }, { $setOnInsert: { ...r } }, { upsert: true })
    if (r.nombre === 'Jefe IT' || r.nombre === 'Administrador') {
      await Rol.updateOne(
        { nombre: r.nombre },
        { $set: { permisos: [...r.permisos], descripcion: r.descripcion } },
      )
    }
  }
}

async function resolveDepartamentoIt() {
  return (
    (await Departamento.findOne({ codigo: 'DEP-8' }).select('_id codigo nombre').lean()) ??
    (await Departamento.findOne({ ehr_departamento_id: 8 }).select('_id codigo nombre').lean()) ??
    (await Departamento.findOne({ codigo: 'IT' }).select('_id codigo nombre').lean())
  )
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(`
Crea usuario Administrador en MongoDB.

  npx tsx server/scripts/crearAdministrador.ts \\
    --email usuario@grupoc.com \\
    --password "clave-min-6" \\
    --nombre "Nombre Apellido"

O con variables: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NOMBRE
`)
    return
  }

  const email = (args.email || process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const password = (args.password || process.env.ADMIN_PASSWORD || '').trim()
  const nombre = (args.nombre || process.env.ADMIN_NOMBRE || email.split('@')[0] || 'Administrador').trim()

  if (!email || !email.includes('@')) {
    console.error('Error: indica --email o ADMIN_EMAIL (correo válido).')
    process.exit(1)
  }
  if (password.length < 6) {
    console.error('Error: la contraseña debe tener al menos 6 caracteres.')
    process.exit(1)
  }

  await connectDb()
  try {
    await ensureRoles()
    const rol = await Rol.findOne({ nombre: 'Administrador' })
    if (!rol) {
      console.error('Error: no se encontró el rol Administrador.')
      process.exit(1)
    }

    const dept = await resolveDepartamentoIt()
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    const existing = await Usuario.findOne({ email })
    if (existing) {
      existing.nombre = nombre
      existing.password = hash
      existing.rol_id = rol._id
      existing.activo = true
      if (dept) existing.departamento_id = dept._id
      await existing.save()
      console.log(
        JSON.stringify(
          {
            ok: true,
            accion: 'actualizado',
            email,
            nombre,
            rol: 'Administrador',
            departamento: dept ? { codigo: dept.codigo, nombre: dept.nombre } : null,
            login: 'Usa correo + contraseña local (AUTH_LOCAL_FALLBACK=true)',
          },
          null,
          2,
        ),
      )
      return
    }

    const doc = await Usuario.create({
      nombre,
      email,
      password: hash,
      rol_id: rol._id,
      departamento_id: dept?._id ?? null,
      activo: true,
    })

    console.log(
      JSON.stringify(
        {
          ok: true,
          accion: 'creado',
          _id: String(doc._id),
          email: doc.email,
          nombre: doc.nombre,
          rol: 'Administrador',
          departamento: dept ? { codigo: dept.codigo, nombre: dept.nombre } : null,
          login: 'Usa correo + contraseña local en el portal',
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
