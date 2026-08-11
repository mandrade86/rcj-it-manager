import sql from 'mssql'
import hana from '@sap/hana-client'

import {
  formatInvalidColumnHint,
  suggestColumnMapping,
} from './sapBiColumnDetect.js'
import type { SapBiCosteoConfig, SapBiDriver } from './sapBiCosteoConfig.js'
import {
  qualifiedViewName,
  quoteAlias,
  quoteColumn,
} from './sapBiCosteoConfig.js'

export type CosteoMuestraRow = {
  cliente: string
  codigo_cliente: string
  muestra: string
  descripcion: string
  costo: number
  cantidad: number
  fecha: string | null
  moneda: string
}

function colRef(
  mappingValue: string | undefined,
  label: string,
  driver: SapBiDriver,
): string | null {
  if (!mappingValue?.trim()) return null
  return quoteColumn(mappingValue, label, driver)
}

function toNumber(value: unknown): number {
  if (value == null || value === '') return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function toDateIso(value: unknown): string | null {
  if (value == null || value === '') return null
  const d = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/** HANA devuelve claves en mayúsculas; normaliza a alias esperados. */
function normalizeHanaRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    out[k.toLowerCase()] = v
  }
  return out
}

function mapRow(
  record: Record<string, unknown>,
  cfg: SapBiCosteoConfig,
  driver: SapBiDriver,
): CosteoMuestraRow {
  const raw = driver === 'hana' ? normalizeHanaRow(record) : record
  const m = cfg.columnMapping
  const get = (alias: keyof typeof m) => raw[alias as string]

  return {
    cliente: String(get('cliente') ?? '').trim() || 'Sin cliente',
    codigo_cliente: String(get('codigo_cliente') ?? '').trim(),
    muestra: String(get('muestra') ?? '').trim(),
    descripcion: String(get('descripcion') ?? '').trim(),
    costo: toNumber(get('costo')),
    cantidad: toNumber(get('cantidad')),
    fecha: toDateIso(get('fecha')),
    moneda: String(get('moneda') ?? '').trim() || 'HNL',
  }
}

function buildSelectColumns(cfg: SapBiCosteoConfig, driver: SapBiDriver): string[] {
  const m = cfg.columnMapping
  const cols: string[] = []
  const add = (field: keyof typeof m, label: string) => {
    const ref = colRef(m[field], label, driver)
    if (ref) cols.push(`${ref} AS ${quoteAlias(field, driver)}`)
  }
  add('cliente', 'cliente')
  add('codigo_cliente', 'codigo_cliente')
  add('muestra', 'muestra')
  add('descripcion', 'descripcion')
  add('costo', 'costo')
  add('cantidad', 'cantidad')
  add('fecha', 'fecha')
  add('moneda', 'moneda')
  if (!m.costo?.trim()) throw new Error('La columna de costo es obligatoria en el mapeo')
  if (!m.cliente?.trim()) throw new Error('La columna de cliente es obligatoria en el mapeo')
  return cols
}

function effectiveSchema(cfg: SapBiCosteoConfig): string {
  return cfg.schema?.trim() || cfg.database?.trim() || ''
}

export type CosteoQueryFilters = {
  cliente?: string
  desde?: string
  hasta?: string
}

async function queryMssql(
  cfg: SapBiCosteoConfig,
  filters: CosteoQueryFilters,
): Promise<CosteoMuestraRow[]> {
  const driver: SapBiDriver = 'mssql'
  const pool = new sql.ConnectionPool({
    server: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.username,
    password: cfg.password ?? '',
    options: {
      encrypt: cfg.encrypt,
      trustServerCertificate: cfg.trustServerCertificate,
      enableArithAbort: true,
    },
    connectionTimeout: 20000,
    requestTimeout: 120000,
  })

  await pool.connect()

  try {
    const view = qualifiedViewName(effectiveSchema(cfg) || 'dbo', cfg.viewName, driver)
    const selectCols = buildSelectColumns(cfg, driver).join(', ')
    const where: string[] = []
    const request = pool.request()

    const colCliente = colRef(cfg.columnMapping.cliente, 'cliente', driver)
    const colFecha = colRef(cfg.columnMapping.fecha, 'fecha', driver)

    if (filters.cliente?.trim() && colCliente) {
      where.push(`${colCliente} LIKE @cliente`)
      request.input('cliente', sql.NVarChar, `%${filters.cliente.trim()}%`)
    }
    if (filters.desde?.trim() && colFecha) {
      const d = new Date(filters.desde)
      if (!Number.isNaN(d.getTime())) {
        where.push(`${colFecha} >= @desde`)
        request.input('desde', sql.DateTime, d)
      }
    }
    if (filters.hasta?.trim() && colFecha) {
      const d = new Date(filters.hasta)
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999)
        where.push(`${colFecha} <= @hasta`)
        request.input('hasta', sql.DateTime, d)
      }
    }

    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : ''
    const query = `SELECT ${selectCols} FROM ${view}${whereSql}`

    const result = await request.query(query)
    const rows = (result.recordset ?? []) as Record<string, unknown>[]
    return rows.map((r) => mapRow(r, cfg, driver))
  } finally {
    await pool.close()
  }
}

type HanaConnection = ReturnType<typeof hana.createConnection>

function hanaConnect(cfg: SapBiCosteoConfig): Promise<HanaConnection> {
  return new Promise((resolve, reject) => {
    const conn = hana.createConnection()
    const params: Record<string, string> = {
      serverNode: `${cfg.host}:${cfg.port}`,
      uid: cfg.username,
      pwd: cfg.password ?? '',
    }
    const schema = effectiveSchema(cfg)
    if (schema) params.currentSchema = schema

    conn.connect(params, (err: Error | null) => {
      if (err) reject(err)
      else resolve(conn)
    })
  })
}

function hanaExec(conn: HanaConnection, query: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    if (params.length === 0) {
      conn.exec(query, (err: Error | null, rows: Record<string, unknown>[]) => {
        if (err) reject(err)
        else resolve(rows ?? [])
      })
      return
    }
    conn.prepare(query, (err: Error | null, stmt: { exec: Function; drop: Function }) => {
      if (err) {
        reject(err)
        return
      }
      stmt.exec(params, (execErr: Error | null, rows: Record<string, unknown>[]) => {
        stmt.drop()
        if (execErr) reject(execErr)
        else resolve(rows ?? [])
      })
    })
  })
}

function hanaDisconnect(conn: HanaConnection): Promise<void> {
  return new Promise((resolve) => {
    conn.disconnect(() => resolve())
  })
}

async function queryHana(
  cfg: SapBiCosteoConfig,
  filters: CosteoQueryFilters,
): Promise<CosteoMuestraRow[]> {
  const driver: SapBiDriver = 'hana'
  const conn = await hanaConnect(cfg)

  try {
    const schema = effectiveSchema(cfg)
    const view = qualifiedViewName(schema, cfg.viewName, driver)
    const selectCols = buildSelectColumns(cfg, driver).join(', ')
    const where: string[] = []
    const params: unknown[] = []

    const colCliente = colRef(cfg.columnMapping.cliente, 'cliente', driver)
    const colFecha = colRef(cfg.columnMapping.fecha, 'fecha', driver)

    if (filters.cliente?.trim() && colCliente) {
      where.push(`${colCliente} LIKE ?`)
      params.push(`%${filters.cliente.trim()}%`)
    }
    if (filters.desde?.trim() && colFecha) {
      const d = new Date(filters.desde)
      if (!Number.isNaN(d.getTime())) {
        where.push(`${colFecha} >= ?`)
        params.push(d.toISOString().slice(0, 10))
      }
    }
    if (filters.hasta?.trim() && colFecha) {
      const d = new Date(filters.hasta)
      if (!Number.isNaN(d.getTime())) {
        where.push(`${colFecha} <= ?`)
        params.push(d.toISOString().slice(0, 10))
      }
    }

    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : ''
    const query = `SELECT ${selectCols} FROM ${view}${whereSql}`

    const rows = await hanaExec(conn, query, params)
    return rows.map((r) => mapRow(r, cfg, driver))
  } finally {
    await hanaDisconnect(conn)
  }
}

export async function testSapBiConnection(cfg: SapBiCosteoConfig): Promise<{
  ok: boolean
  message: string
  filasMuestra?: number
}> {
  if (!cfg.password?.trim()) {
    return { ok: false, message: 'Contraseña no configurada' }
  }
  try {
    const rows = await querySapBiView(cfg, {})
    return {
      ok: true,
      message: `Conexión ${cfg.driver.toUpperCase()} exitosa (${cfg.host}:${cfg.port}). ${rows.length} fila(s) en ${cfg.viewName}.`,
      filasMuestra: rows.length,
    }
  } catch (err) {
    const msg = (err as Error).message
    if (/invalid column name/i.test(msg)) {
      try {
        const { columnas } = await detectViewColumnMapping(cfg)
        return { ok: false, message: formatInvalidColumnHint(msg, columnas, cfg.columnMapping) }
      } catch {
        return {
          ok: false,
          message: `${msg}. Use «Detectar columnas» y corrija el mapeo (ItemCode no existe en VW_BI_VENTA_COSTO).`,
        }
      }
    }
    if (/ETIMEOUT|ECONNREFUSED|ENOTFOUND|ESOCKET|Failed to connect|connection failed|NIECONNREFUSED/i.test(msg)) {
      return {
        ok: false,
        message:
          `${msg}. Desde Ubuntu/Docker verifique: (1) el contenedor alcanza ${cfg.host}:${cfg.port}, `
          + '(2) firewall permite salida TCP, (3) esquema SAP B1 correcto.',
      }
    }
    return { ok: false, message: msg }
  }
}

export async function querySapBiView(
  cfg: SapBiCosteoConfig,
  filters: CosteoQueryFilters,
): Promise<CosteoMuestraRow[]> {
  if (cfg.driver === 'hana') {
    return queryHana(cfg, filters)
  }
  return queryMssql(cfg, filters)
}

export async function listViewColumns(
  cfg: SapBiCosteoConfig,
  viewNameOverride?: string,
): Promise<string[]> {
  if (!cfg.password?.trim()) {
    throw new Error('Contraseña SAP no configurada')
  }
  const viewName = viewNameOverride?.trim() || cfg.viewName
  const schema = effectiveSchema(cfg)
  if (cfg.driver === 'hana') {
    const conn = await hanaConnect(cfg)
    try {
      const meta = await hanaExec(
        conn,
        `SELECT COLUMN_NAME FROM SYS.VIEW_COLUMNS
         WHERE SCHEMA_NAME = ? AND VIEW_NAME = ?
         ORDER BY POSITION`,
        [schema.toUpperCase(), viewName.toUpperCase()],
      )
      const names = meta
        .map((r) => String(r.COLUMN_NAME ?? r.column_name ?? '').trim())
        .filter(Boolean)
      if (names.length) return names

      const view = qualifiedViewName(schema, viewName, 'hana')
      const sample = await hanaExec(conn, `SELECT * FROM ${view} LIMIT 1`)
      if (sample[0]) return Object.keys(sample[0])
      return []
    } finally {
      await hanaDisconnect(conn)
    }
  }

  const pool = new sql.ConnectionPool({
    server: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.username,
    password: cfg.password ?? '',
    options: {
      encrypt: cfg.encrypt,
      trustServerCertificate: cfg.trustServerCertificate,
      enableArithAbort: true,
    },
    connectionTimeout: 20000,
    requestTimeout: 60000,
  })
  await pool.connect()
  try {
    const s = schema || 'dbo'
    const result = await pool.request()
      .input('schema', sql.NVarChar, s)
      .input('view', sql.NVarChar, viewName)
      .query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @view
         ORDER BY ORDINAL_POSITION`,
      )
    const names = (result.recordset as { COLUMN_NAME: string }[])
      .map((r) => r.COLUMN_NAME)
      .filter(Boolean)
    if (names.length) return names
    const view = qualifiedViewName(s, viewName, 'mssql')
    const top = await pool.request().query(`SELECT TOP 1 * FROM ${view}`)
    const row = top.recordset?.[0] as Record<string, unknown> | undefined
    return row ? Object.keys(row) : []
  } finally {
    await pool.close()
  }
}

export async function detectViewColumnMapping(cfg: SapBiCosteoConfig): Promise<{
  columnas: string[]
  sugerido: ReturnType<typeof suggestColumnMapping>
}> {
  const columnas = await listViewColumns(cfg)
  return { columnas, sugerido: suggestColumnMapping(columnas) }
}
