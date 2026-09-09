import { resolveCostosItConnection, setUltimoSyncCostosIt } from './sapCostosItConfig.js'
import { listViewColumns, querySapViewRaw, type SapViewRawFilter } from './sapBiQuery.js'
import {
  loadEmpresasMonedaMap,
  monedaDeEmpresa,
  type MonedaEmpresa,
} from './gastosItEmpresaMoneda.js'

export const VISTA_BUDGET_IT = 'TS_VW_BUDGET_IT'

export type BudgetItSapDashboardEmpresa = {
  empresa: string
  moneda: MonedaEmpresa
  planificado: number
  ejecutado: number
  variacion: number
  ejecucion_pct: number | null
  filas_sobre_presupuesto: number
}

export type BudgetItSapDashboardMes = {
  mes: number
  mes_label: string
  planificado: number
  ejecutado: number
  variacion: number
}

export type BudgetItSapDashboardEmpresaMes = {
  empresa: string
  mes: number
  mes_label: string
  planificado: number
  ejecutado: number
}

export type BudgetItSapDashboardSobre = {
  label: string
  empresa: string | null
  planificado: number
  ejecutado: number
  variacion: number
}

export type BudgetItSapDashboardCuenta = {
  cuenta: string
  cuenta_nombre: string
  empresa: string
  moneda: MonedaEmpresa
  planificado: number
  ejecutado: number
  variacion: number
  ejecucion_pct: number | null
  transacciones: number
}

export type BudgetItSapResponse = {
  /** Moneda de la empresa seleccionada; null si no hay empresa (no hay presupuesto global). */
  moneda: MonedaEmpresa | null
  vista: string
  columnas: string[]
  filas: Record<string, unknown>[]
  total_filas: number
  empresas: string[]
  monedas_empresa: Record<string, MonedaEmpresa>
  requiere_empresa: boolean
  filtros: {
    anio: number | null
    mes: number | null
    busqueda: string | null
    empresa: string | null
  }
  resumen: {
    total_presupuesto: number | null
    columna_monto: string | null
    columna_empresa: string | null
    columna_planificado: string | null
    columna_ejecutado: string | null
    columna_cuenta: string | null
    columna_cuenta_nombre: string | null
    pares_mensuales: Array<{
      mes: number
      mes_label: string
      col_planificado: string
      col_ejecutado: string
    }>
    total_planificado: number | null
    total_ejecutado: number | null
    variacion: number | null
    ejecucion_pct: number | null
    filas_sobre_presupuesto: number
  }
  dashboard: {
    por_empresa: BudgetItSapDashboardEmpresa[]
    por_mes: BudgetItSapDashboardMes[]
    por_empresa_mes: BudgetItSapDashboardEmpresaMes[]
    por_cuenta: BudgetItSapDashboardCuenta[]
    top_sobre_presupuesto: BudgetItSapDashboardSobre[]
  }
  ultimo_sync: string
  aviso?: string | null
}

const MESES_LABEL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const MES_NOMBRE_A_NUM: Record<string, number> = {
  ene: 1, enero: 1,
  feb: 2, febrero: 2,
  mar: 3, marzo: 3,
  abr: 4, abril: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6,
  jul: 7, julio: 7,
  ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9, setiembre: 9,
  oct: 10, octubre: 10,
  nov: 11, noviembre: 11,
  dic: 12, diciembre: 12,
}

function parseMesValue(value: unknown): number | null {
  const n = toNumber(value)
  if (n != null && n >= 1 && n <= 12) return Math.trunc(n)
  const raw = normalizeCellString(value).toLowerCase()
  if (!raw) return null
  if (MES_NOMBRE_A_NUM[raw] != null) return MES_NOMBRE_A_NUM[raw]
  const m = raw.match(/^(\d{1,2})/)
  if (m) {
    const num = Number(m[1])
    if (num >= 1 && num <= 12) return num
  }
  return null
}

function findColumn(columnas: string[], patterns: RegExp[]): string | null {
  for (const col of columnas) {
    if (patterns.some((p) => p.test(col))) return col
  }
  return null
}

function findEmpresaColumn(columnas: string[]): string | null {
  return findColumn(columnas, [
    /^empresa$/i,
    /^company$/i,
    /^companyname$/i,
    /^nombre.?empresa$/i,
    /^filial$/i,
    /^compania$/i,
    /^compañía$/i,
    /^sociedad$/i,
    /^org$/i,
    /^organization$/i,
    /bplname/i,
    /^bplid$/i,
    /empresa/i,
    /company/i,
  ])
}

function findPlanificadoColumn(columnas: string[]): string | null {
  // Preferir columna total; si solo hay mensuales (Planificado Enero…), no devolver una sola
  const exact = findColumn(columnas, [
    /^planificado$/i,
    /^presupuesto$/i,
    /^budget$/i,
    /^monto_plan/i,
    /^plan_usd$/i,
    /^importe_plan/i,
  ])
  if (exact) return exact
  const mensuales = columnas.filter((c) => /^planificado\s/i.test(c) || /^presupuesto\s/i.test(c))
  return mensuales.length === 1 ? mensuales[0]! : null
}

function findEjecutadoColumn(columnas: string[], colPlanificado: string | null): string | null {
  const exact = findColumn(columnas, [
    /^ejecutado$/i,
    /^real$/i,
    /^actual$/i,
    /^gasto$/i,
    /^consumido$/i,
    /^monto_real/i,
    /^importe_real/i,
  ])
  if (exact && exact !== colPlanificado) return exact
  const mensuales = columnas.filter((c) => /^ejecutado\s/i.test(c) || /^real\s/i.test(c))
  if (mensuales.length === 1 && mensuales[0] !== colPlanificado) return mensuales[0]!
  return null
}

/** Pares Planificado/Ejecutado por mes (vista pivot TS_VW_BUDGET_IT). */
export function findPlanEjecMensualPairs(columnas: string[]): Array<{
  mes: number
  mes_label: string
  col_planificado: string
  col_ejecutado: string
}> {
  const meses: Array<{ n: number; aliases: string[] }> = [
    { n: 1, aliases: ['enero', 'ene', 'jan', 'january'] },
    { n: 2, aliases: ['febrero', 'feb', 'february'] },
    { n: 3, aliases: ['marzo', 'mar', 'march'] },
    { n: 4, aliases: ['abril', 'abr', 'apr', 'april'] },
    { n: 5, aliases: ['mayo', 'may'] },
    { n: 6, aliases: ['junio', 'jun', 'june'] },
    { n: 7, aliases: ['julio', 'jul', 'july'] },
    { n: 8, aliases: ['agosto', 'ago', 'aug', 'august'] },
    { n: 9, aliases: ['septiembre', 'setiembre', 'sep', 'sept', 'september'] },
    { n: 10, aliases: ['octubre', 'oct', 'october'] },
    { n: 11, aliases: ['noviembre', 'nov', 'november'] },
    { n: 12, aliases: ['diciembre', 'dic', 'dec', 'december'] },
  ]
  const pairs: Array<{
    mes: number
    mes_label: string
    col_planificado: string
    col_ejecutado: string
  }> = []

  for (const m of meses) {
    const plan = columnas.find((c) => {
      const low = c.toLowerCase()
      return (
        (low.startsWith('planificado') || low.startsWith('presupuesto') || low.startsWith('budget'))
        && m.aliases.some((a) => low.includes(a))
      )
    })
    const ejec = columnas.find((c) => {
      const low = c.toLowerCase()
      return (
        (low.startsWith('ejecutado') || low.startsWith('real') || low.startsWith('actual'))
        && m.aliases.some((a) => low.includes(a))
      )
    })
    if (plan && ejec) {
      pairs.push({
        mes: m.n,
        mes_label: MESES_LABEL[m.n - 1]!,
        col_planificado: plan,
        col_ejecutado: ejec,
      })
    }
  }
  return pairs
}

function findCuentaColumn(columnas: string[]): string | null {
  return findColumn(columnas, [
    /^numero.?de.?cuenta$/i,
    /^n[uú]mero.?cuenta$/i,
    /^num.?cuenta$/i,
    /^cuenta$/i,
    /^acctcode$/i,
    /^account.?code$/i,
    /^account$/i,
    /^codigo_cuenta$/i,
    /^cuenta_contable$/i,
    /acct.?code/i,
    /numero.?cuenta/i,
  ])
}

function findCuentaNombreColumn(columnas: string[]): string | null {
  return findColumn(columnas, [
    /^nombre.?de.?cuenta$/i,
    /^nombre.?cuenta$/i,
    /^cuenta_nombre$/i,
    /^nombrecuenta$/i,
    /^acctname$/i,
    /^account.?name$/i,
    /acct.?name/i,
    /nombre.?cuenta/i,
  ])
}

function findMontoColumn(columnas: string[], colPlanificado: string | null, colEjecutado: string | null): string | null {
  return colPlanificado ?? colEjecutado ?? findColumn(columnas, [
    /^monto(_usd)?$/i,
    /^importe$/i,
    /^amount$/i,
  ])
}

function normalizeCellString(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function sumPlanEjecFromRow(
  row: Record<string, unknown>,
  colPlanificado: string | null,
  colEjecutado: string | null,
  pairs: Array<{ col_planificado: string; col_ejecutado: string }>,
): { planificado: number; ejecutado: number } {
  if (pairs.length) {
    let planificado = 0
    let ejecutado = 0
    for (const p of pairs) {
      planificado += toNumber(row[p.col_planificado]) ?? 0
      ejecutado += toNumber(row[p.col_ejecutado]) ?? 0
    }
    return { planificado, ejecutado }
  }
  return {
    planificado: colPlanificado ? (toNumber(row[colPlanificado]) ?? 0) : 0,
    ejecutado: colEjecutado ? (toNumber(row[colEjecutado]) ?? 0) : 0,
  }
}

function filtrarFilasLocales(
  filas: Record<string, unknown>[],
  busqueda: string | undefined,
): Record<string, unknown>[] {
  const q = busqueda?.trim().toLowerCase()
  if (!q) return filas
  return filas.filter((f) =>
    Object.values(f).some((v) => normalizeCellString(v).toLowerCase().includes(q)),
  )
}

function filtrarPorEmpresa(
  filas: Record<string, unknown>[],
  colEmpresa: string | null,
  empresa: string | undefined,
): Record<string, unknown>[] {
  const emp = empresa?.trim()
  if (!emp || emp === 'todas' || !colEmpresa) return filas
  return filas.filter((f) => normalizeCellString(f[colEmpresa]) === emp)
}

function sumColumn(filas: Record<string, unknown>[], col: string | null): number | null {
  if (!col || !filas.length) return null
  return filas.reduce((s, f) => s + (toNumber(f[col]) ?? 0), 0)
}

function countSobrePresupuesto(
  filas: Record<string, unknown>[],
  colPlanificado: string | null,
  colEjecutado: string | null,
  pairs: Array<{ col_planificado: string; col_ejecutado: string }> = [],
): number {
  return filas.filter((f) => {
    const { planificado, ejecutado } = sumPlanEjecFromRow(f, colPlanificado, colEjecutado, pairs)
    return ejecutado > planificado
  }).length
}

function buildDashboard(
  filas: Record<string, unknown>[],
  cols: {
    colEmpresa: string | null
    colPlanificado: string | null
    colEjecutado: string | null
    colCuenta: string | null
    colCuentaNombre: string | null
    colMes: string | null
    colFecha: string | null
    paresMensuales: Array<{
      mes: number
      mes_label: string
      col_planificado: string
      col_ejecutado: string
    }>
  },
  opts?: {
    mesFiltro?: number | null
    monedas?: Map<string, MonedaEmpresa>
    empresaSeleccionada?: string | null
  },
): BudgetItSapResponse['dashboard'] {
  const {
    colEmpresa,
    colPlanificado,
    colEjecutado,
    colCuenta,
    colCuentaNombre,
    colMes,
    colFecha,
    paresMensuales,
  } = cols
  const monedas = opts?.monedas ?? new Map<string, MonedaEmpresa>()
  const pairs =
    opts?.mesFiltro != null
      ? paresMensuales.filter((p) => p.mes === opts.mesFiltro)
      : paresMensuales

  const porEmpMap = new Map<string, { planificado: number; ejecutado: number; sobre: number }>()
  const porMesMap = new Map<number, { planificado: number; ejecutado: number }>()
  const porEmpMesMap = new Map<string, { planificado: number; ejecutado: number }>()
  const porCuentaMap = new Map<string, {
    cuenta: string
    cuenta_nombre: string
    empresa: string
    planificado: number
    ejecutado: number
    n: number
  }>()

  for (const f of filas) {
    const emp = colEmpresa ? normalizeCellString(f[colEmpresa]) || 'Sin empresa' : 'Sin empresa'
    const { planificado: plan, ejecutado: ejec } = sumPlanEjecFromRow(
      f,
      colPlanificado,
      colEjecutado,
      pairs,
    )

    const curEmp = porEmpMap.get(emp) ?? { planificado: 0, ejecutado: 0, sobre: 0 }
    curEmp.planificado += plan
    curEmp.ejecutado += ejec
    if (ejec > plan) curEmp.sobre += 1
    porEmpMap.set(emp, curEmp)

    if (colCuenta) {
      const cuenta = normalizeCellString(f[colCuenta]) || 'Sin cuenta'
      const nombre = colCuentaNombre ? normalizeCellString(f[colCuentaNombre]) : ''
      const keyCta = `${emp}|${cuenta}`
      const curCta = porCuentaMap.get(keyCta) ?? {
        cuenta,
        cuenta_nombre: nombre,
        empresa: emp,
        planificado: 0,
        ejecutado: 0,
        n: 0,
      }
      if (nombre && (!curCta.cuenta_nombre || curCta.cuenta_nombre === cuenta)) {
        curCta.cuenta_nombre = nombre
      }
      curCta.planificado += plan
      curCta.ejecutado += ejec
      curCta.n += 1
      porCuentaMap.set(keyCta, curCta)
    }

    if (pairs.length) {
      for (const p of pairs) {
        const planM = toNumber(f[p.col_planificado]) ?? 0
        const ejecM = toNumber(f[p.col_ejecutado]) ?? 0
        const curMes = porMesMap.get(p.mes) ?? { planificado: 0, ejecutado: 0 }
        curMes.planificado += planM
        curMes.ejecutado += ejecM
        porMesMap.set(p.mes, curMes)

        const key = `${emp}|${p.mes}`
        const curEmpMes = porEmpMesMap.get(key) ?? { planificado: 0, ejecutado: 0 }
        curEmpMes.planificado += planM
        curEmpMes.ejecutado += ejecM
        porEmpMesMap.set(key, curEmpMes)
      }
    } else {
      let mes = colMes ? parseMesValue(f[colMes]) : null
      if (mes == null && colFecha) {
        const fecha = normalizeCellString(f[colFecha])
        const m = fecha.match(/^\d{4}-(\d{2})/)
        if (m) mes = Number(m[1])
      }
      if (mes != null && mes >= 1 && mes <= 12) {
        const curMes = porMesMap.get(mes) ?? { planificado: 0, ejecutado: 0 }
        curMes.planificado += plan
        curMes.ejecutado += ejec
        porMesMap.set(mes, curMes)

        const key = `${emp}|${mes}`
        const curEmpMes = porEmpMesMap.get(key) ?? { planificado: 0, ejecutado: 0 }
        curEmpMes.planificado += plan
        curEmpMes.ejecutado += ejec
        porEmpMesMap.set(key, curEmpMes)
      }
    }
  }

  const por_empresa = [...porEmpMap.entries()]
    .map(([empresa, v]) => ({
      empresa,
      moneda: monedaDeEmpresa(monedas, empresa),
      planificado: v.planificado,
      ejecutado: v.ejecutado,
      variacion: v.ejecutado - v.planificado,
      ejecucion_pct: v.planificado > 0 ? (v.ejecutado / v.planificado) * 100 : null,
      filas_sobre_presupuesto: v.sobre,
    }))
    .sort((a, b) => b.ejecutado - a.ejecutado)

  const mesesParaSerie =
    opts?.mesFiltro != null && opts.mesFiltro >= 1 && opts.mesFiltro <= 12
      ? [opts.mesFiltro]
      : Array.from({ length: 12 }, (_, i) => i + 1)

  const por_mes = mesesParaSerie.map((mes) => {
    const v = porMesMap.get(mes) ?? { planificado: 0, ejecutado: 0 }
    return {
      mes,
      mes_label: MESES_LABEL[mes - 1] ?? `Mes ${mes}`,
      planificado: v.planificado,
      ejecutado: v.ejecutado,
      variacion: v.ejecutado - v.planificado,
    }
  })

  const por_empresa_mes: BudgetItSapDashboardEmpresaMes[] = []
  for (const [key, v] of porEmpMesMap.entries()) {
    const [empresa, mesStr] = key.split('|')
    const mes = Number(mesStr)
    if (!empresa || !Number.isFinite(mes)) continue
    por_empresa_mes.push({
      empresa,
      mes,
      mes_label: MESES_LABEL[mes - 1] ?? `Mes ${mes}`,
      planificado: v.planificado,
      ejecutado: v.ejecutado,
    })
  }
  por_empresa_mes.sort((a, b) => a.empresa.localeCompare(b.empresa, 'es') || a.mes - b.mes)

  const por_cuenta: BudgetItSapDashboardCuenta[] = [...porCuentaMap.values()]
    .map((c) => ({
      cuenta: c.cuenta,
      cuenta_nombre: c.cuenta_nombre || c.cuenta,
      empresa: c.empresa,
      moneda: monedaDeEmpresa(monedas, c.empresa),
      planificado: c.planificado,
      ejecutado: c.ejecutado,
      variacion: c.ejecutado - c.planificado,
      ejecucion_pct: c.planificado > 0 ? (c.ejecutado / c.planificado) * 100 : null,
      transacciones: c.n,
    }))
    .sort((a, b) => b.ejecutado - a.ejecutado || a.cuenta.localeCompare(b.cuenta, 'es'))

  const top_sobre_presupuesto: BudgetItSapDashboardSobre[] = []
  if (colPlanificado && colEjecutado) {
    for (const f of filas) {
      const plan = toNumber(f[colPlanificado]) ?? 0
      const ejec = toNumber(f[colEjecutado]) ?? 0
      if (ejec <= plan) continue
      const cuenta = colCuenta ? normalizeCellString(f[colCuenta]) : ''
      const empresa = colEmpresa ? normalizeCellString(f[colEmpresa]) : ''
      const label = [cuenta, empresa].filter(Boolean).join(' · ') || 'Sin identificador'
      top_sobre_presupuesto.push({
        label,
        empresa: empresa || null,
        planificado: plan,
        ejecutado: ejec,
        variacion: ejec - plan,
      })
    }
    top_sobre_presupuesto.sort((a, b) => b.variacion - a.variacion)
    top_sobre_presupuesto.splice(15)
  }

  return { por_empresa, por_mes, por_empresa_mes, por_cuenta, top_sobre_presupuesto }
}

export async function fetchBudgetItSap(opts?: {
  anio?: number
  mes?: number
  busqueda?: string
  empresa?: string
  limit?: number
}): Promise<BudgetItSapResponse> {
  const { sapCfg, itCfg } = await resolveCostosItConnection()
  const schema =
    process.env.SAP_BUDGET_IT_SCHEMA?.trim()
    || itCfg.schema?.trim()
    || sapCfg.schema?.trim()
    || sapCfg.database?.trim()
    || ''
  const viewName = process.env.SAP_BUDGET_IT_VIEW?.trim() || VISTA_BUDGET_IT
  const viewCfg = { ...sapCfg, schema }

  const columnas = await listViewColumns(viewCfg, viewName)
  const colAnio = findColumn(columnas, [
    /^anio$/i,
    /^año$/i,
    /^year$/i,
    /^ejercicio$/i,
    /fiscal.?year/i,
    /budget.?year/i,
  ])
  const colMes = findColumn(columnas, [/^mes$/i, /^month$/i, /periodo.?mes/i, /^period$/i, /^mes_num/i])
  const colFecha = findColumn(columnas, [
    /^fecha$/i,
    /^date$/i,
    /docdate/i,
    /postingdate/i,
    /fecha_/i,
  ])
  const colEmpresaDetected = findEmpresaColumn(columnas)
  const paresMensuales = findPlanEjecMensualPairs(columnas)
  const colPlanificado = findPlanificadoColumn(columnas)
  const colEjecutado = findEjecutadoColumn(columnas, colPlanificado)
  const colCuenta = findCuentaColumn(columnas)
  const colCuentaNombre = findCuentaNombreColumn(columnas)
  const colMonto = findMontoColumn(columnas, colPlanificado, colEjecutado)
  const monedasMap = await loadEmpresasMonedaMap()
  const monedas_empresa: Record<string, MonedaEmpresa> = Object.fromEntries(monedasMap)

  const sapFilters: SapViewRawFilter[] = []
  const anio = opts?.anio
  if (anio != null && Number.isFinite(anio)) {
    if (colAnio) {
      sapFilters.push({ column: colAnio, op: '=', value: anio })
    } else if (colFecha) {
      sapFilters.push({ column: colFecha, op: '>=', value: `${anio}-01-01` })
      sapFilters.push({ column: colFecha, op: '<=', value: `${anio}-12-31` })
    }
  }
  if (opts?.mes != null && Number.isFinite(opts.mes) && colMes) {
    sapFilters.push({ column: colMes, op: '=', value: opts.mes })
  }

  const limit = opts?.mes == null ? (opts?.limit ?? 20000) : (opts?.limit ?? 8000)

  const { filas: rawFilas } = await querySapViewRaw(viewCfg, viewName, {
    schema,
    filters: sapFilters.length ? sapFilters : undefined,
    limit,
  })

  let filas = filtrarFilasLocales(rawFilas, opts?.busqueda)

  // Detectar columna empresa desde metadatos o desde las claves reales de las filas
  const colEmpresa =
    colEmpresaDetected
    ?? (filas[0] ? findEmpresaColumn(Object.keys(filas[0])) : null)

  if (anio != null && Number.isFinite(anio) && !sapFilters.length && filas.length) {
    const keyAnio = colAnio ?? findColumn(Object.keys(filas[0] ?? {}), [/^anio$/i, /^año$/i, /^year$/i])
    if (keyAnio) {
      filas = filas.filter((f) => Number(f[keyAnio]) === anio || String(f[keyAnio]).startsWith(String(anio)))
    } else if (colFecha) {
      filas = filas.filter((f) => {
        const d = normalizeCellString(f[colFecha]).slice(0, 4)
        return d === String(anio)
      })
    }
  }

  const empresasFromRows = colEmpresa
    ? [...new Set(filas.map((f) => normalizeCellString(f[colEmpresa])).filter(Boolean))]
    : []
  const empresasFromMonedas = [...monedasMap.keys()]
  const empresas = [...new Set([...empresasFromRows, ...empresasFromMonedas])].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )

  const empresaSeleccionada = opts?.empresa?.trim() || null
  const requiere_empresa = !empresaSeleccionada

  // Si hay filtro de empresa pero la columna no se detectó, filtrar por cualquier clave que parezca empresa
  if (empresaSeleccionada && !colEmpresa && filas.length) {
    const keys = Object.keys(filas[0] ?? {})
    const keyEmp = findEmpresaColumn(keys)
    if (keyEmp) {
      filas = filas.filter((f) => normalizeCellString(f[keyEmp]) === empresaSeleccionada)
    }
  } else {
    filas = filtrarPorEmpresa(filas, colEmpresa, opts?.empresa)
  }

  // Sin empresa no hay presupuesto global: no sumar montos de distintas monedas.
  const pairsForTotals =
    opts?.mes != null ? paresMensuales.filter((p) => p.mes === opts.mes) : paresMensuales
  let totalPlanificado: number | null = null
  let totalEjecutado: number | null = null
  if (!requiere_empresa) {
    if (pairsForTotals.length) {
      totalPlanificado = filas.reduce(
        (s, f) => s + sumPlanEjecFromRow(f, null, null, pairsForTotals).planificado,
        0,
      )
      totalEjecutado = filas.reduce(
        (s, f) => s + sumPlanEjecFromRow(f, null, null, pairsForTotals).ejecutado,
        0,
      )
    } else {
      totalPlanificado = sumColumn(filas, colPlanificado)
      totalEjecutado = sumColumn(filas, colEjecutado)
    }
  }
  const variacion =
    totalPlanificado != null && totalEjecutado != null ? totalEjecutado - totalPlanificado : null
  const ejecucionPct =
    totalPlanificado != null && totalPlanificado > 0 && totalEjecutado != null
      ? (totalEjecutado / totalPlanificado) * 100
      : null

  let totalPresupuesto: number | null = totalPlanificado
  if (!requiere_empresa && totalPresupuesto == null && colMonto) {
    totalPresupuesto = sumColumn(filas, colMonto)
  }

  const dashboard = buildDashboard(filas, {
    colEmpresa: colEmpresa ?? (filas[0] ? findEmpresaColumn(Object.keys(filas[0])) : null),
    colPlanificado,
    colEjecutado,
    colCuenta,
    colCuentaNombre,
    colMes,
    colFecha,
    paresMensuales,
  }, {
    mesFiltro: opts?.mes ?? null,
    monedas: monedasMap,
    empresaSeleccionada,
  })

  // Incluir empresas detectadas en el dashboard aunque no estuvieran en el filtro inicial
  for (const e of dashboard.por_empresa) {
    if (e.empresa && e.empresa !== 'Sin empresa' && !empresas.includes(e.empresa)) {
      empresas.push(e.empresa)
    }
  }
  empresas.sort((a, b) => a.localeCompare(b, 'es'))

  const sync = new Date().toISOString()
  await setUltimoSyncCostosIt(sync)

  const vista = schema ? `${schema}.${viewName}` : viewName
  const avisos: string[] = []
  if (requiere_empresa) {
    avisos.push('Seleccione una empresa para ver presupuesto y totales. No existe presupuesto global (cada empresa tiene su moneda).')
  }
  if (rawFilas.length >= limit) {
    avisos.push(`Mostrando hasta ${limit.toLocaleString('es-HN')} filas de la vista SAP.`)
  }

  const monedaEmpresa = empresaSeleccionada
    ? monedaDeEmpresa(monedasMap, empresaSeleccionada)
    : null

  return {
    moneda: monedaEmpresa,
    vista,
    columnas,
    filas: requiere_empresa ? [] : filas,
    total_filas: requiere_empresa ? 0 : filas.length,
    empresas,
    monedas_empresa,
    requiere_empresa,
    filtros: {
      anio: opts?.anio ?? null,
      mes: opts?.mes ?? null,
      busqueda: opts?.busqueda?.trim() || null,
      empresa: empresaSeleccionada,
    },
    resumen: {
      total_presupuesto: totalPresupuesto,
      columna_monto: colMonto,
      columna_empresa: colEmpresa,
      columna_planificado: colPlanificado,
      columna_ejecutado: colEjecutado,
      columna_cuenta: colCuenta,
      columna_cuenta_nombre: colCuentaNombre,
      pares_mensuales: paresMensuales,
      total_planificado: totalPlanificado,
      total_ejecutado: totalEjecutado,
      variacion,
      ejecucion_pct: ejecucionPct,
      filas_sobre_presupuesto: requiere_empresa
        ? 0
        : countSobrePresupuesto(filas, colPlanificado, colEjecutado, pairsForTotals),
    },
    dashboard: requiere_empresa
      ? {
          por_empresa: dashboard.por_empresa,
          por_mes: [],
          por_empresa_mes: [],
          por_cuenta: [],
          top_sobre_presupuesto: [],
        }
      : dashboard,
    ultimo_sync: sync,
    aviso: avisos.length ? avisos.join(' ') : null,
  }
}
