import { Config } from '../db/models/Config.js'
import { Empresa } from '../db/models/Empresa.js'
import { fetchEhrJson } from './ehrAuth.js'

export const DEFAULT_EHR_COMPANY_LIST_URL = 'https://ehr.rcjcorp.hn:8095/api/Company/list'

export const CONFIG_CLAVE_EHR_COMPANY_LIST = 'ehr_company_list_url'

export async function getEhrCompanyListUrl(): Promise<string> {
  const cfg = await Config.findOne({ clave: CONFIG_CLAVE_EHR_COMPANY_LIST }).lean<{ valor?: string | null } | null>()
  const u = cfg?.valor?.trim()
  return u || DEFAULT_EHR_COMPANY_LIST_URL
}

type EhrCompanyRow = { empresaId?: unknown; nombre?: unknown }

function normalizeRows(json: unknown): EhrCompanyRow[] {
  if (!json || typeof json !== 'object') return []
  const data = (json as { data?: unknown }).data
  if (!Array.isArray(data)) return []
  return data.filter((x) => x && typeof x === 'object') as EhrCompanyRow[]
}

export type SyncEmpresasEhrResult = {
  ok: boolean
  insertados: number
  actualizados: number
  errores: number
  total: number
  advertencia?: string
}

/**
 * Descarga el listado de empresas del EHR y hace upsert en MongoDB
 * (misma colección que usa `empresa_ids` en proyectos).
 */
export async function syncEmpresasFromEhr(url?: string): Promise<SyncEmpresasEhrResult> {
  const listUrl = url?.trim() || (await getEhrCompanyListUrl())
  let rows: EhrCompanyRow[]
  try {
    rows = normalizeRows(await fetchEhrJson(listUrl))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      insertados: 0,
      actualizados: 0,
      errores: 0,
      total: 0,
      advertencia: msg,
    }
  }

  let insertados = 0
  let actualizados = 0
  let errores = 0

  for (const row of rows) {
    const empresaId = Number(row.empresaId)
    const nombre = String(row.nombre ?? '').trim()
    if (!Number.isFinite(empresaId) || empresaId <= 0 || !nombre) {
      errores++
      continue
    }
    const codigo = `EHR-${empresaId}`
    try {
      const prev = await Empresa.findOne({ ehr_empresa_id: empresaId }).select('_id').lean()
      await Empresa.findOneAndUpdate(
        { ehr_empresa_id: empresaId },
        {
          $set: {
            nombre,
            codigo,
            origen: 'ehr',
          },
          $setOnInsert: {
            descripcion: '',
            color: '#002060',
            activo: true,
          },
        },
        { upsert: true },
      )
      if (prev) actualizados++
      else insertados++
    } catch {
      errores++
    }
  }

  return {
    ok: true,
    insertados,
    actualizados,
    errores,
    total: rows.length,
  }
}
