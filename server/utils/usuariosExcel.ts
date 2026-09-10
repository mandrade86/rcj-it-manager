import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import xlsx from 'xlsx'

import { Departamento } from '../db/models/Departamento.js'
import { Empleado } from '../db/models/Empleado.js'
import { Rol } from '../db/models/Rol.js'
import { Usuario } from '../db/models/Usuario.js'
import { normalizeDomainLogin } from './directoryAuth.js'
import { isAdLoginEnabled } from './ehrAuth.js'
import { duplicateUsuarioMessage } from './usuarioErrors.js'

export const USUARIO_EXCEL_COLS = [
  'nombre',
  'email',
  'rol',
  'password',
  'es_usuario_dominio',
  'login_dominio',
  'codigo_empleado',
  'departamento',
  'activo',
] as const

const BCRYPT_ROUNDS = 10

function cellStr(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v == null) continue
    const s = String(v).trim()
    if (s) return s
  }
  // Case-insensitive fallback
  const lowerMap = new Map(Object.keys(row).map((k) => [k.toLowerCase().trim(), k]))
  for (const k of keys) {
    const real = lowerMap.get(k.toLowerCase())
    if (!real) continue
    const s = String(row[real] ?? '').trim()
    if (s) return s
  }
  return ''
}

function parseBool(raw: string, defaultValue = true): boolean {
  const s = raw.trim().toLowerCase()
  if (!s) return defaultValue
  if (['si', 'sí', 's', 'yes', 'y', 'true', '1', 'activo'].includes(s)) return true
  if (['no', 'n', 'false', '0', 'inactivo'].includes(s)) return false
  return defaultValue
}

export type UsuarioExcelResolved = {
  nombre: string
  email: string
  login_dominio: string
  es_usuario_dominio: boolean
  passwordHash: string
  rol_id: mongoose.Types.ObjectId
  empleado_id: mongoose.Types.ObjectId | null
  departamento_id: mongoose.Types.ObjectId | null
  activo: boolean
}

export type UsuarioExcelCaches = {
  rolesByName: Map<string, mongoose.Types.ObjectId>
  deptsByCodigo: Map<string, mongoose.Types.ObjectId>
  deptsByNombre: Map<string, mongoose.Types.ObjectId>
  empleadosByCodigo: Map<string, mongoose.Types.ObjectId>
  emailsTaken: Set<string>
  loginsTaken: Set<string>
  empleadosTaken: Set<string>
}

export async function buildUsuarioExcelCaches(): Promise<UsuarioExcelCaches> {
  const [roles, depts, empleados, usuarios] = await Promise.all([
    Rol.find({ activo: { $ne: false } }).select('_id nombre').lean(),
    Departamento.find().select('_id codigo nombre').lean(),
    Empleado.find().select('_id codigo').lean(),
    Usuario.find().select('email login_dominio empleado_id').lean(),
  ])

  const rolesByName = new Map<string, mongoose.Types.ObjectId>()
  for (const r of roles) {
    rolesByName.set(String(r.nombre).trim().toLowerCase(), r._id as mongoose.Types.ObjectId)
  }

  const deptsByCodigo = new Map<string, mongoose.Types.ObjectId>()
  const deptsByNombre = new Map<string, mongoose.Types.ObjectId>()
  for (const d of depts) {
    deptsByCodigo.set(String(d.codigo).trim().toLowerCase(), d._id as mongoose.Types.ObjectId)
    deptsByNombre.set(String(d.nombre).trim().toLowerCase(), d._id as mongoose.Types.ObjectId)
  }

  const empleadosByCodigo = new Map<string, mongoose.Types.ObjectId>()
  for (const e of empleados) {
    empleadosByCodigo.set(String(e.codigo).trim().toLowerCase(), e._id as mongoose.Types.ObjectId)
  }

  const emailsTaken = new Set<string>()
  const loginsTaken = new Set<string>()
  const empleadosTaken = new Set<string>()
  for (const u of usuarios) {
    if (u.email) emailsTaken.add(String(u.email).trim().toLowerCase())
    if (u.login_dominio) loginsTaken.add(String(u.login_dominio).trim().toLowerCase())
    if (u.empleado_id) empleadosTaken.add(String(u.empleado_id))
  }

  return {
    rolesByName,
    deptsByCodigo,
    deptsByNombre,
    empleadosByCodigo,
    emailsTaken,
    loginsTaken,
    empleadosTaken,
  }
}

export async function resolveUsuarioExcelRow(
  row: Record<string, unknown>,
  cache: UsuarioExcelCaches,
): Promise<{ ok: true; data: UsuarioExcelResolved } | { ok: false; error: string }> {
  const nombre = cellStr(row, 'nombre', 'Nombre', 'name')
  const emailRaw = cellStr(row, 'email', 'Email', 'correo', 'Correo')
  const rolNombre = cellStr(row, 'rol', 'Rol', 'rol_nombre')
  const password = cellStr(row, 'password', 'Password', 'contraseña', 'Contraseña')
  const esDominioRaw = cellStr(row, 'es_usuario_dominio', 'usuario_dominio', 'dominio')
  const loginRaw = cellStr(row, 'login_dominio', 'usuario_dominio_login', 'login')
  const codigoEmp = cellStr(row, 'codigo_empleado', 'empleado', 'codigo')
  const deptRaw = cellStr(row, 'departamento', 'Departamento', 'departamento_codigo')
  const activoRaw = cellStr(row, 'activo', 'Activo')

  if (!nombre) return { ok: false, error: 'Falta el nombre' }
  if (!emailRaw) return { ok: false, error: 'Falta el correo electrónico' }
  const email = emailRaw.toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Correo inválido' }
  }
  if (cache.emailsTaken.has(email)) {
    return { ok: false, error: 'Ya existe un usuario con ese correo' }
  }
  if (!rolNombre) return { ok: false, error: 'Falta el rol (usar el nombre exacto del rol)' }
  const rol_id = cache.rolesByName.get(rolNombre.toLowerCase())
  if (!rol_id) {
    return { ok: false, error: `Rol «${rolNombre}» no encontrado` }
  }

  const es_usuario_dominio = parseBool(esDominioRaw, false)
  let login_dominio = ''
  if (es_usuario_dominio) {
    login_dominio = normalizeDomainLogin(loginRaw || email.split('@')[0] || '')
    if (!login_dominio) {
      return { ok: false, error: 'Usuario de dominio vacío' }
    }
    if (!/^[a-z0-9._-]+$/.test(login_dominio)) {
      return { ok: false, error: 'Login de dominio inválido' }
    }
    if (cache.loginsTaken.has(login_dominio)) {
      return { ok: false, error: 'Ya existe un usuario con ese login de dominio' }
    }
  }

  const pwd = password.trim()
  if (!isAdLoginEnabled() && !es_usuario_dominio) {
    if (pwd.length < 8) {
      return { ok: false, error: 'Contraseña obligatoria (mínimo 8 caracteres)' }
    }
  } else if (pwd.length > 0 && pwd.length < 8) {
    return { ok: false, error: 'Contraseña local debe tener al menos 8 caracteres' }
  }
  const passwordHash = pwd.length >= 8 ? await bcrypt.hash(pwd, BCRYPT_ROUNDS) : ''

  let empleado_id: mongoose.Types.ObjectId | null = null
  if (codigoEmp) {
    const eid = cache.empleadosByCodigo.get(codigoEmp.toLowerCase())
    if (!eid) return { ok: false, error: `Empleado con código «${codigoEmp}» no encontrado` }
    if (cache.empleadosTaken.has(String(eid))) {
      return { ok: false, error: `El empleado «${codigoEmp}» ya está vinculado a otro usuario` }
    }
    empleado_id = eid
  }

  let departamento_id: mongoose.Types.ObjectId | null = null
  if (deptRaw) {
    departamento_id =
      cache.deptsByCodigo.get(deptRaw.toLowerCase())
      ?? cache.deptsByNombre.get(deptRaw.toLowerCase())
      ?? null
    if (!departamento_id) {
      return { ok: false, error: `Departamento «${deptRaw}» no encontrado (use código o nombre)` }
    }
  }

  return {
    ok: true,
    data: {
      nombre,
      email,
      login_dominio: es_usuario_dominio ? login_dominio : '',
      es_usuario_dominio,
      passwordHash,
      rol_id,
      empleado_id,
      departamento_id,
      activo: parseBool(activoRaw, true),
    },
  }
}

export async function createUsuarioFromExcel(
  data: UsuarioExcelResolved,
  cache: UsuarioExcelCaches,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await Usuario.create({
      nombre: data.nombre,
      email: data.email,
      login_dominio: data.login_dominio,
      es_usuario_dominio: data.es_usuario_dominio,
      password: data.passwordHash,
      rol_id: data.rol_id,
      empleado_id: data.empleado_id,
      empleados_ids: [],
      departamento_id: data.departamento_id,
      activo: data.activo,
    })
    cache.emailsTaken.add(data.email)
    if (data.login_dominio) cache.loginsTaken.add(data.login_dominio)
    if (data.empleado_id) cache.empleadosTaken.add(String(data.empleado_id))
    return { ok: true }
  } catch (err) {
    const code = (err as { code?: number }).code
    if (code === 11000) {
      const dup = duplicateUsuarioMessage((err as { keyPattern?: Record<string, unknown> }).keyPattern)
      return { ok: false, error: dup.error }
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Error al crear usuario' }
  }
}

export async function buildUsuariosPlantillaWorkbook(): Promise<Buffer> {
  const [roles, depts] = await Promise.all([
    Rol.find({ activo: { $ne: false } }).select('nombre').sort({ nombre: 1 }).lean(),
    Departamento.find().select('codigo nombre').sort({ codigo: 1 }).lean(),
  ])

  const ejemplo = [
    {
      nombre: 'Juan Pérez',
      email: 'juan.perez@rcjcorp.com',
      rol: roles[0]?.nombre ?? 'Usuario',
      password: 'Cambiar123',
      es_usuario_dominio: 'no',
      login_dominio: '',
      codigo_empleado: '',
      departamento: depts[0]?.codigo ?? 'IT',
      activo: 'si',
    },
  ]

  const wb = xlsx.utils.book_new()
  const ws = xlsx.utils.json_to_sheet(ejemplo, { header: [...USUARIO_EXCEL_COLS] })
  ws['!cols'] = USUARIO_EXCEL_COLS.map((c) => ({ wch: Math.max(16, c.length + 4) }))
  xlsx.utils.book_append_sheet(wb, ws, 'Usuarios')

  const instrucciones = [
    ['Columna', 'Obligatorio', 'Descripción'],
    ['nombre', 'Sí', 'Nombre completo del usuario'],
    ['email', 'Sí', 'Correo corporativo único'],
    ['rol', 'Sí', 'Nombre exacto del rol (ver hoja Roles)'],
    ['password', 'Sí*', 'Mínimo 8 caracteres. *No obligatorio si es_usuario_dominio=si'],
    ['es_usuario_dominio', 'No', 'si / no (default no). Si es si, login con Active Directory'],
    ['login_dominio', 'Condicional', 'Usuario AD sin @dominio. Si vacío, se toma la parte antes del @ del email'],
    ['codigo_empleado', 'No', 'Código del empleado en maestros (vínculo 1:1)'],
    ['departamento', 'No', 'Código o nombre del departamento (ver hoja Departamentos)'],
    ['activo', 'No', 'si / no (default si)'],
    [],
    ['Notas'],
    ['- Solo se crean usuarios nuevos. Si el correo ya existe, la fila se omite.'],
    ['- Elimine la fila de ejemplo antes de importar datos reales.'],
    ['- Guarde el archivo como .xlsx'],
  ]
  const wsInfo = xlsx.utils.aoa_to_sheet(instrucciones)
  wsInfo['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 70 }]
  xlsx.utils.book_append_sheet(wb, wsInfo, 'Instrucciones')

  const wsRoles = xlsx.utils.aoa_to_sheet([
    ['rol'],
    ...roles.map((r) => [r.nombre]),
  ])
  xlsx.utils.book_append_sheet(wb, wsRoles, 'Roles')

  const wsDepts = xlsx.utils.aoa_to_sheet([
    ['codigo', 'nombre'],
    ...depts.map((d) => [d.codigo, d.nombre]),
  ])
  xlsx.utils.book_append_sheet(wb, wsDepts, 'Departamentos')

  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export function readUsuariosExcelRows(buffer: Buffer): {
  rows: Record<string, unknown>[]
  hoja: string
} {
  const wb = xlsx.read(buffer, { type: 'buffer', cellDates: true, raw: false })
  const preferred = wb.SheetNames.find((n) => n.toLowerCase() === 'usuarios') ?? wb.SheetNames[0]
  if (!preferred) throw new Error('El Excel no contiene hojas')
  const sheet = wb.Sheets[preferred]
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })
  return { rows, hoja: preferred }
}
