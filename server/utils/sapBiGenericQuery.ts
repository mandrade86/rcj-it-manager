import sql from 'mssql'
import hana from '@sap/hana-client'

import type { SapBiCosteoConfig, SapBiDriver } from './sapBiCosteoConfig.js'
import {
  qualifiedViewName,
  quoteAlias,
  quoteColumn,
} from './sapBiCosteoConfig.js'

export type SapBiFieldMap = Record<string, string>

export type SapBiGenericFilters = {
  cliente?: string
  codigo_cliente?: string
  receta?: string
  /** Si true, filtra receta por igualdad exacta (dropdown). */
  recetaExact?: boolean
  desde?: string
  hasta?: string
}

function effectiveSchema(cfg: SapBiCosteoConfig): string {
  return cfg.schema?.trim() || cfg.database?.trim() || ''
}

function normalizeHanaRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    out[k.toLowerCase()] = v
  }
  return out
}

function buildSelect(fields: SapBiFieldMap, driver: SapBiDriver): string[] {
  const cols: string[] = []
  for (const [alias, colName] of Object.entries(fields)) {
    if (!colName?.trim()) continue
    const ref = quoteColumn(colName, alias, driver)
    cols.push(`${ref} AS ${quoteAlias(alias, driver)}`)
  }
  if (cols.length === 0) throw new Error('Sin columnas para consultar')
  return cols
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

function mapRows(
  rows: Record<string, unknown>[],
  driver: SapBiDriver,
): Record<string, unknown>[] {
  return rows.map((row) => (driver === 'hana' ? normalizeHanaRow(row) : row))
}

function applyFilters(
  fields: SapBiFieldMap,
  filters: SapBiGenericFilters,
  driver: SapBiDriver,
): { where: string[]; params: unknown[] } {
  const where: string[] = []
  const params: unknown[] = []

  const colCliente = fields.cliente ? quoteColumn(fields.cliente, 'cliente', driver) : null
  const colCodigoCliente = fields.codigo_cliente
    ? quoteColumn(fields.codigo_cliente, 'codigo_cliente', driver)
    : null
  const colReceta = fields.receta_code ? quoteColumn(fields.receta_code, 'receta', driver) : null
  const colFecha = fields.fecha ? quoteColumn(fields.fecha, 'fecha', driver) : null

  if (filters.codigo_cliente?.trim() && colCodigoCliente) {
    where.push(`${colCodigoCliente} = ?`)
    params.push(filters.codigo_cliente.trim())
  } else if (filters.cliente?.trim() && colCliente) {
    where.push(`${colCliente} LIKE ?`)
    params.push(`%${filters.cliente.trim()}%`)
  }
  if (filters.receta?.trim() && colReceta) {
    if (filters.recetaExact) {
      where.push(`${colReceta} = ?`)
      params.push(filters.receta.trim())
    } else {
      where.push(`${colReceta} LIKE ?`)
      params.push(`%${filters.receta.trim()}%`)
    }
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

  return { where, params }
}

async function queryMssqlGeneric(
  cfg: SapBiCosteoConfig,
  viewName: string,
  fields: SapBiFieldMap,
  filters: SapBiGenericFilters,
): Promise<Record<string, unknown>[]> {
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
    const schema = effectiveSchema(cfg) || 'dbo'
    const view = qualifiedViewName(schema, viewName, driver)
    const selectCols = buildSelect(fields, driver).join(', ')
    const where: string[] = []
    const request = pool.request()

    const colCliente = fields.cliente ? quoteColumn(fields.cliente, 'cliente', driver) : null
    const colCodigoCliente = fields.codigo_cliente
      ? quoteColumn(fields.codigo_cliente, 'codigo_cliente', driver)
      : null
    const colReceta = fields.receta_code ? quoteColumn(fields.receta_code, 'receta', driver) : null
    const colFecha = fields.fecha ? quoteColumn(fields.fecha, 'fecha', driver) : null

    if (filters.codigo_cliente?.trim() && colCodigoCliente) {
      where.push(`${colCodigoCliente} = @codigo_cliente`)
      request.input('codigo_cliente', sql.NVarChar, filters.codigo_cliente.trim())
    } else if (filters.cliente?.trim() && colCliente) {
      where.push(`${colCliente} LIKE @cliente`)
      request.input('cliente', sql.NVarChar, `%${filters.cliente.trim()}%`)
    }
    if (filters.receta?.trim() && colReceta) {
      if (filters.recetaExact) {
        where.push(`${colReceta} = @receta`)
        request.input('receta', sql.NVarChar, filters.receta.trim())
      } else {
        where.push(`${colReceta} LIKE @receta`)
        request.input('receta', sql.NVarChar, `%${filters.receta.trim()}%`)
      }
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
    return mapRows((result.recordset ?? []) as Record<string, unknown>[], driver)
  } finally {
    await pool.close()
  }
}

async function queryHanaGeneric(
  cfg: SapBiCosteoConfig,
  viewName: string,
  fields: SapBiFieldMap,
  filters: SapBiGenericFilters,
): Promise<Record<string, unknown>[]> {
  const driver: SapBiDriver = 'hana'
  const conn = await hanaConnect(cfg)
  try {
    const schema = effectiveSchema(cfg)
    const view = qualifiedViewName(schema, viewName, driver)
    const selectCols = buildSelect(fields, driver).join(', ')
    const { where, params } = applyFilters(fields, filters, driver)
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : ''
    const query = `SELECT ${selectCols} FROM ${view}${whereSql}`
    const rows = await hanaExec(conn, query, params)
    return mapRows(rows, driver)
  } finally {
    await hanaDisconnect(conn)
  }
}

export async function querySapBiGeneric(
  cfg: SapBiCosteoConfig,
  viewName: string,
  fields: SapBiFieldMap,
  filters: SapBiGenericFilters = {},
): Promise<Record<string, unknown>[]> {
  if (!cfg.password?.trim()) throw new Error('Contraseña SAP no configurada')

  if (cfg.driver === 'hana') {
    return queryHanaGeneric(cfg, viewName, fields, filters)
  }
  return queryMssqlGeneric(cfg, viewName, fields, filters)
}
