import type { SapBiCosteoConfig } from './sapBiCosteoConfig.js'
import { sanitizeSqlIdentifier } from './sapBiCosteoConfig.js'
import { execSapBiRead } from './sapBiGenericQuery.js'

/** Agrupación que entiende dirección: un nombre por tipo de muestra, sin códigos de laboratorio. */
const TIPO_EJECUTIVO: Record<string, string> = {
  APMB: 'Aguas',
  ARMB: 'Aguas',
  ARPFQ: 'Aguas',
  ARPSF: 'Aguas',
  AP: 'Aguas',
  PAFQ: 'Aguas',
  ALMB: 'Alimentos',
  PAMB: 'Alimentos',
  MPFQ: 'Alimentos',
  MSFQ: 'Alimentos',
  HMB: 'Higiene (manos y superficies)',
  AMB: 'Ambiente y planta',
  VMB: 'Ambiente y planta',
  SUSF: 'Suelos y campo',
  MSSF: 'Suelos y campo',
  AOSF: 'Suelos y campo',
  FOSF: 'Suelos y campo',
  LDSF: 'Suelos y campo',
  MISF: 'Suelos y campo',
  SDFQ: 'Análisis especiales',
  SDMB: 'Análisis especiales',
  SDSF: 'Análisis especiales',
  HGSF: 'Análisis especiales',
  GHSF: 'Análisis especiales',
}

/** Familia del código de receta (texto antes del guion) → nombre de matriz de laboratorio. */
const MATRIZ_NOMBRE: Record<string, string> = {
  ALMB: 'Alimentos',
  AMB: 'Ambiente',
  AOSF: 'Abono orgánico',
  AP: 'Agua procesada',
  APMB: 'Aguas potables',
  ARMB: 'Aguas residuales',
  ARPFQ: 'Aguas (fisicoquímico)',
  ARPSF: 'Aguas (parámetros)',
  CONS: 'Consumibles',
  FOSF: 'Foliar',
  GHSF: 'Metales',
  HGSF: 'Metales',
  HMB: 'Hisopado (manos y superficies)',
  LDSF: 'Lodos',
  MISF: 'Enmiendas',
  MPFQ: 'Sal y salmuera',
  MSFQ: 'Bromatológicos',
  MSSF: 'Suelos',
  PAFQ: 'Planta de procesos',
  PAMB: 'Alimentos',
  REFQ: 'Fisicoquímico',
  REMB: 'Reactivos',
  RESF: 'Reactivos',
  SDFQ: 'Residuos y plaguicidas',
  SDMB: 'Especiales',
  SDSF: 'Plaguicidas y PCB',
  SUSF: 'Suelos',
  VMB: 'Monitoreo en planta',
}

export type MuestraPorMatrizRow = {
  codigo: string
  matriz: string
  tipo: string
  area: string
  ordenes: number
  cantidad: number
  pct: number
}

export type MuestraTipoResumen = {
  tipo: string
  cantidad: number
  pct: number
}

export type MuestrasPorMatrizPayload = {
  desde: string
  hasta: string
  total_muestras: number
  total_ordenes: number
  total_matrices: number
  /** Lectura para gerencia: pocos tipos, sin códigos. */
  resumen: MuestraTipoResumen[]
  filas: MuestraPorMatrizRow[]
  vista: string
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function areaDeGrupo(grupo: string): string {
  const g = grupo.toUpperCase()
  if (g.includes('MICR')) return 'Microbiología'
  if (g.includes('FQ')) return 'Fisicoquímico'
  return 'Laboratorio'
}

function nombreMatriz(codigo: string): string {
  return MATRIZ_NOMBRE[codigo] ?? 'Otras muestras'
}

function tipoEjecutivo(codigo: string): string {
  return TIPO_EJECUTIVO[codigo] ?? 'Otras muestras'
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function assertIsoDate(value: string, label: string): string {
  const v = value.trim()
  if (!ISO_DATE.test(v)) throw new Error(`${label} debe tener formato YYYY-MM-DD`)
  return v
}

export async function queryMuestrasPorMatriz(
  cfg: SapBiCosteoConfig,
  desde: string,
  hasta: string,
): Promise<MuestrasPorMatrizPayload> {
  const schema = sanitizeSqlIdentifier(cfg.schema?.trim() || cfg.database, 'esquema')
  const sql = `
    SELECT
      CASE
        WHEN LOCATE(P."RecetaCode", '-') > 1
          THEN SUBSTRING(P."RecetaCode", 1, LOCATE(P."RecetaCode", '-') - 1)
        ELSE IFNULL(NULLIF(P."RecetaCode", ''), 'SIN_CODIGO')
      END AS "codigo",
      MAX(A."GrupoArticulo") AS "grupo",
      COUNT(*) AS "ordenes",
      SUM(
        CASE
          WHEN IFNULL(P."CantPlanificada", 0) > 0 AND P."CantPlanificada" <= 50
            THEN P."CantPlanificada"
          ELSE 1
        END
      ) AS "cantidad"
    FROM "${schema}"."VW_BI_PRODUCCION" P
    INNER JOIN "${schema}"."VW_BI_ARTICULOS" A
      ON A."ItemCode" = P."RecetaCode"
    WHERE A."GrupoArticulo" LIKE 'P.Terminado LAB%'
      AND P."Fecha" >= ?
      AND P."Fecha" <= ?
    GROUP BY
      CASE
        WHEN LOCATE(P."RecetaCode", '-') > 1
          THEN SUBSTRING(P."RecetaCode", 1, LOCATE(P."RecetaCode", '-') - 1)
        ELSE IFNULL(NULLIF(P."RecetaCode", ''), 'SIN_CODIGO')
      END
    ORDER BY "cantidad" DESC
  `

  const raw = await execSapBiRead(cfg, sql, [desde, hasta])
  const base = raw.map((r) => {
    const codigo = String(r.codigo ?? '').trim() || 'SIN_CODIGO'
    const grupo = String(r.grupo ?? '').trim()
    return {
      codigo,
      matriz: nombreMatriz(codigo),
      tipo: tipoEjecutivo(codigo),
      area: areaDeGrupo(grupo),
      ordenes: Math.round(num(r.ordenes)),
      cantidad: Math.round(num(r.cantidad) * 100) / 100,
    }
  })

  const totalMuestras = base.reduce((s, r) => s + r.cantidad, 0)
  const totalOrdenes = base.reduce((s, r) => s + r.ordenes, 0)
  const pctOf = (cantidad: number) =>
    totalMuestras > 0 ? Math.round((cantidad / totalMuestras) * 1000) / 10 : 0

  const filas: MuestraPorMatrizRow[] = base.map((r) => ({
    ...r,
    pct: pctOf(r.cantidad),
  }))

  const porTipo = new Map<string, number>()
  for (const r of filas) porTipo.set(r.tipo, (porTipo.get(r.tipo) ?? 0) + r.cantidad)
  const resumen: MuestraTipoResumen[] = [...porTipo.entries()]
    .map(([tipo, cantidad]) => ({
      tipo,
      cantidad: Math.round(cantidad * 100) / 100,
      pct: pctOf(cantidad),
    }))
    .sort((a, b) => b.cantidad - a.cantidad)

  return {
    desde,
    hasta,
    total_muestras: Math.round(totalMuestras * 100) / 100,
    total_ordenes: totalOrdenes,
    total_matrices: filas.length,
    resumen,
    filas,
    vista: `${schema}.VW_BI_PRODUCCION`,
  }
}
