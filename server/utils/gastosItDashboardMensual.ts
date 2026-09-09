import { querySapBiGeneric } from './sapBiGenericQuery.js'
import { rowHash, debeUsarCategoriaSap, aplicarCategoriaOrigen } from './costosItCategorize.js'
import { resolveCostosItConnection, getCostosItFields, setUltimoSyncCostosIt } from './sapCostosItConfig.js'
import type { CostosItFieldMap } from './sapCostosItFields.js'
import { MONEDA_COSTOS_IT } from './sapCostosItBi.js'
import { loadGastosItCategorias, findCategoriaNombre, findSubcategoriaNombre } from './gastosItCategorias.js'
import {
  clasificarPorReglasAvanzadas,
  clasificarPorCategoriaSap,
  clasificarSoporteControlPresupuestoAvanzado,
  loadClasificacionesAvanzadasMap,
  OTROS,
  saveClasificacionAvanzada,
  type TipoGasto,
} from './gastosItClasificacionAvanzada.js'
import {
  calcularSemafaro,
  enriquecerNombres,
  generarResumenMes,
  inferirTiposGasto,
  mesKey,
  pctVar,
  type AnalisisReglas,
  type GastoItEnriquecido,
  type SemafaroEstado,
} from './gastosItAnalisis.js'
import { GastosItPresupuesto } from '../db/models/GastosItPresupuesto.js'
import { GastosItAnalisisReglas } from '../db/models/GastosItAnalisisReglas.js'
import type { GastosItCategoria } from '../db/models/GastosItCategoriaConfig.js'
import { categoriaCompositeKey, labelCategoriaSubcategoria, normalizarCategoriaPresupuestoKey, parseCategoriaCompositeKey } from './gastosItCategoriaKey.js'
import { normalizeCuentaKey } from './gastosItPresupuestoCuentas.js'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function toNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function toDateIso(v: unknown): string | null {
  if (v == null || v === '') return null
  const d = v instanceof Date ? v : new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function str(v: unknown): string {
  return String(v ?? '').trim()
}

function anioFromFecha(fecha: string | null): number | null {
  if (!fecha) return null
  const y = Number(fecha.slice(0, 4))
  return Number.isFinite(y) ? y : null
}

function ultimoDiaMes(anio: number, mes: number): string {
  return new Date(anio, mes, 0).toISOString().slice(0, 10)
}

function addMonths(anio: number, mes: number, delta: number): { anio: number; mes: number } {
  const d = new Date(anio, mes - 1 + delta, 1)
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 }
}

export type GastosDashboardResponse = {
  moneda: typeof MONEDA_COSTOS_IT
  filtros: {
    anio: number
    mes: number
    mes_label: string
    desde: string
    hasta: string
    empresa: string | null
    categoria_id: string | null
    categoria: string | null
    comparar_mes_anterior: boolean
    comparar_presupuesto: boolean
  }
  kpis: {
    total_mes: number
    presupuesto_mes: number | null
    variacion_presupuesto_usd: number | null
    variacion_presupuesto_pct: number | null
    total_mes_anterior: number | null
    variacion_mes_anterior_usd: number | null
    variacion_mes_anterior_pct: number | null
    promedio_mensual: number | null
    transacciones: number
    semaforo: SemafaroEstado
  }
  por_categoria: Array<{ categoria_id: string; categoria: string; monto: number; pct: number; transacciones: number }>
  evolucion_12_meses: Array<{ mes: string; mes_label: string; monto: number }>
  top_proveedores: Array<{ proveedor: string; monto: number; pct: number; transacciones: number }>
  por_tipo: Array<{ tipo: TipoGasto | 'por_determinar'; monto: number; pct: number; transacciones: number }>
  concentracion: { top: Array<{ categoria: string; pct: number; monto: number }>; explicacion: string }
  anomalias: Array<{ tipo: string; titulo: string; detalle: string; severidad: 'relevante' | 'critico' }>
  recurrentes: Array<{ proveedor: string; concepto: string; promedio_mensual: number; ultimo_gasto: number; frecuencia_meses: number }>
  oportunidades: Array<{ problema: string; impacto: string; monto: number; recomendacion: string }>
  presupuesto_vs_real: {
    disponible: boolean
    total_presupuesto: number
    total_real: number
    diferencia: number
    ejecucion_pct: number
    filas: Array<{
      cuenta: string
      cuenta_nombre: string
      presupuesto: number
      real: number
      variacion: number
      variacion_pct: number
    }>
  }
  resumen_mes: string
  filas: GastoItEnriquecido[]
  empresas: string[]
  categorias: GastosItCategoria[]
  reglas: AnalisisReglas
  vista: string
  ultimo_sync: string | null
  aviso?: string | null
}

async function loadReglas(): Promise<AnalisisReglas> {
  const doc = await GastosItAnalisisReglas.findOne({ clave: 'gastos_it_analisis' }).lean()
  return {
    variacion_relevante_pct: doc?.variacion_relevante_pct ?? 20,
    variacion_critica_pct: doc?.variacion_critica_pct ?? 40,
    meses_promedio_anomalia: doc?.meses_promedio_anomalia ?? 6,
    meses_min_recurrente: doc?.meses_min_recurrente ?? 3,
    top_proveedores: doc?.top_proveedores ?? 10,
    top_concentracion: doc?.top_concentracion ?? 5,
  }
}

async function fetchRawFilas(
  desde: string,
  hasta: string,
  fields: CostosItFieldMap,
  viewName: string,
  sapCfg: Parameters<typeof querySapBiGeneric>[0],
) {
  const raw = await querySapBiGeneric(sapCfg, viewName, fields, { desde, hasta })
  return raw
    .map((row) => {
      const fecha = toDateIso(row.fecha)
      const monto = Math.abs(toNumber(row.monto ?? row.total_linea))
      const descripcion = str(row.descripcion)
      const proveedor = str(row.proveedor)
      return {
        row_hash: rowHash([fecha, monto, descripcion, proveedor, str(row.documento), str(row.cuenta)]),
        fecha,
        anio: anioFromFecha(fecha),
        monto,
        descripcion,
        proveedor,
        documento: str(row.documento),
        cuenta: str(row.cuenta),
        empresa: str(row.empresa),
        categoria_origen: str(row.categoria_origen),
        departamento: str(row.departamento),
      }
    })
    .filter((f) => f.monto !== 0)
}

async function clasificarFilasAvanzadas(
  base: Awaited<ReturnType<typeof fetchRawFilas>>,
): Promise<GastoItEnriquecido[]> {
  const hashes = base.map((f) => f.row_hash)
  const cache = await loadClasificacionesAvanzadasMap(hashes)
  const out: GastoItEnriquecido[] = []

  for (const f of base) {
    const mes = mesKey(f.fecha)
    const cached = cache.get(f.row_hash)

    if (cached?.fuente === 'manual') {
      out.push({
        ...f,
        mes,
        categoria_id: cached.categoria_id,
        subcategoria_id: cached.subcategoria_id,
        categoria: '',
        subcategoria: '',
        tipo_gasto: cached.tipo_gasto || 'por_determinar',
        fuente_clasificacion: 'manual',
        confianza: cached.confianza,
      })
      continue
    }

    if (debeUsarCategoriaSap(f)) {
      const desdeSap = clasificarSoporteControlPresupuestoAvanzado(f.categoria_origen)
      await saveClasificacionAvanzada({
        row_hash: f.row_hash,
        categoria_id: desdeSap.categoria_id,
        subcategoria_id: desdeSap.subcategoria_id,
        fuente: 'vista',
        confianza: desdeSap.confianza,
      })
      out.push({
        ...f,
        mes,
        categoria_id: desdeSap.categoria_id,
        subcategoria_id: desdeSap.subcategoria_id,
        categoria: '',
        subcategoria: '',
        tipo_gasto: 'por_determinar',
        fuente_clasificacion: 'vista',
        confianza: desdeSap.confianza,
      })
      continue
    }

    const regla = clasificarPorReglasAvanzadas({
      descripcion: f.descripcion,
      proveedor: f.proveedor,
      cuenta: f.cuenta,
      categoria_origen: f.categoria_origen ?? '',
      tipo: '',
    })

    const cls = regla ?? OTROS
    if (regla) {
      await saveClasificacionAvanzada({
        row_hash: f.row_hash,
        categoria_id: cls.categoria_id,
        subcategoria_id: cls.subcategoria_id,
        fuente: 'regla',
        confianza: cls.confianza,
      })
    }

    out.push({
      ...f,
      mes,
      categoria_id: cls.categoria_id,
      subcategoria_id: cls.subcategoria_id,
      categoria: '',
      subcategoria: '',
      tipo_gasto: 'por_determinar',
      fuente_clasificacion: regla ? 'regla' : 'pendiente',
      confianza: cls.confianza,
    })
  }

  return out
}

function parseCategoriaFiltro(raw: string | null | undefined): {
  categoria_id: string | null
  subcategoria_id: string | null
  composite: string | null
} {
  const trimmed = raw?.trim()
  if (!trimmed) return { categoria_id: null, subcategoria_id: null, composite: null }
  if (trimmed.includes('|')) {
    const [categoria_id, subcategoria_id] = trimmed.split('|', 2)
    return {
      categoria_id: categoria_id || null,
      subcategoria_id: subcategoria_id || null,
      composite: trimmed,
    }
  }
  return { categoria_id: trimmed, subcategoria_id: null, composite: trimmed }
}

export async function buildGastosDashboard(opts: {
  anio?: number
  mes?: number
  desde?: string
  hasta?: string
  empresa?: string
  categoria_id?: string
  comparar_mes_anterior?: boolean
  comparar_presupuesto?: boolean
}): Promise<GastosDashboardResponse> {
  const now = new Date()
  const anio = opts.anio ?? now.getFullYear()
  const mes = opts.mes ?? now.getMonth() + 1
  const desde = opts.desde ?? `${anio}-${String(mes).padStart(2, '0')}-01`
  const hasta = opts.hasta ?? ultimoDiaMes(anio, mes)

  const hist = addMonths(anio, mes, -12)
  const desdeHist = `${hist.anio}-${String(hist.mes).padStart(2, '0')}-01`

  const { sapCfg, itCfg } = await resolveCostosItConnection()
  const fields = await getCostosItFields(sapCfg, itCfg)
  const categorias = await loadGastosItCategorias()
  const reglas = await loadReglas()

  const base = await fetchRawFilas(desdeHist, hasta, fields, itCfg.viewName, sapCfg)
  let filas = await clasificarFilasAvanzadas(base)

  const empresas = [...new Set(filas.map((f) => f.empresa).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
  if (opts.empresa?.trim()) {
    filas = filas.filter((f) => f.empresa === opts.empresa!.trim())
  }

  const categoriaFiltro = parseCategoriaFiltro(opts.categoria_id)
  const categoriaFiltroId = categoriaFiltro.categoria_id
  const subcategoriaFiltroId = categoriaFiltro.subcategoria_id
  const categoriaFiltroNombre = categoriaFiltroId
    ? subcategoriaFiltroId
      ? `${findCategoriaNombre(categorias, categoriaFiltroId)} → ${findSubcategoriaNombre(categorias, categoriaFiltroId, subcategoriaFiltroId)}`
      : findCategoriaNombre(categorias, categoriaFiltroId)
    : null
  if (categoriaFiltroId) {
    filas = filas.filter((f) => {
      if (f.categoria_id !== categoriaFiltroId) return false
      if (subcategoriaFiltroId && f.subcategoria_id !== subcategoriaFiltroId) return false
      return true
    })
  }

  const mesFoco = `${anio}-${String(mes).padStart(2, '0')}`
  filas = inferirTiposGasto(filas, mesFoco, reglas)
  filas = enriquecerNombres(filas, categorias)

  const filasMes = filas.filter((f) => f.mes === mesFoco)
  const totalMes = filasMes.reduce((s, f) => s + f.monto, 0)

  const prev = addMonths(anio, mes, -1)
  const mesAnterior = `${prev.anio}-${String(prev.mes).padStart(2, '0')}`
  const filasMesAnt = filas.filter((f) => f.mes === mesAnterior)
  const totalMesAnt = filasMesAnt.length ? filasMesAnt.reduce((s, f) => s + f.monto, 0) : null

  const mesesUnicos = [...new Set(filas.map((f) => f.mes))].filter((m) => m <= mesFoco).sort()
  const promediosPorMes = mesesUnicos.map((m) => filas.filter((f) => f.mes === m).reduce((s, f) => s + f.monto, 0))
  const promedioMensual = promediosPorMes.length
    ? promediosPorMes.reduce((a, b) => a + b, 0) / promediosPorMes.length
    : null

  const presupuestoQuery: Record<string, unknown> = {
    anio,
    mes,
    cuenta: { $exists: true, $ne: '' },
  }
  // Presupuesto siempre por empresa (no hay global). Si no hay empresa, no comparar.
  if (opts.empresa?.trim()) {
    presupuestoQuery.empresa = opts.empresa.trim()
  } else {
    presupuestoQuery.empresa = { $exists: true, $ne: '' }
  }
  const presupuestosRaw = await GastosItPresupuesto.find(presupuestoQuery).lean()
  // Sin filtro de empresa no mezclar presupuestos de distintas monedas → no disponible
  const presupuestos = opts.empresa?.trim() ? presupuestosRaw : []
  const cuentasEnMes = new Set(
    filasMes.map((f) => normalizeCuentaKey(f.cuenta)).filter(Boolean),
  )
  const presupuestosFiltrados = categoriaFiltroId
    ? presupuestos.filter((p) => cuentasEnMes.has(normalizeCuentaKey(p.cuenta)))
    : presupuestos
  const presupuestoMes = presupuestosFiltrados.length
    ? presupuestosFiltrados.reduce((s, p) => s + (p.monto ?? p.monto_usd ?? 0), 0)
    : null

  const variacionPresupuestoUsd = presupuestoMes != null ? totalMes - presupuestoMes : null
  const variacionPresupuestoPct = presupuestoMes != null ? pctVar(totalMes, presupuestoMes) : null
  const variacionMesAntUsd = totalMesAnt != null ? totalMes - totalMesAnt : null
  const variacionMesAntPct = totalMesAnt != null ? pctVar(totalMes, totalMesAnt) : null

  const extraordinarios = filasMes.filter((f) => f.tipo_gasto === 'extraordinario').length
  const semaforo = calcularSemafaro({
    variacionPresupuestoPct: opts.comparar_presupuesto !== false ? variacionPresupuestoPct : null,
    variacionMesAnteriorPct: variacionMesAntPct ?? 0,
    tieneExtraordinarios: extraordinarios > 0,
    reglas,
  })

  const catMap = new Map<string, { monto: number; n: number; categoria_id: string; subcategoria_id: string }>()
  for (const f of filasMes) {
    const norm = normalizarCategoriaPresupuestoKey(f.categoria_id, f.subcategoria_id)
    const { categoria_id, subcategoria_id } = parseCategoriaCompositeKey(norm)
    const key = norm
    const c = catMap.get(key) ?? { monto: 0, n: 0, categoria_id, subcategoria_id }
    c.monto += f.monto
    c.n += 1
    catMap.set(key, c)
  }
  const por_categoria = [...catMap.values()]
    .map((v) => ({
      categoria_id: categoriaCompositeKey(v.categoria_id, v.subcategoria_id),
      categoria: labelCategoriaSubcategoria(categorias, v.categoria_id, v.subcategoria_id).etiqueta,
      monto: v.monto,
      pct: totalMes > 0 ? (v.monto / totalMes) * 100 : 0,
      transacciones: v.n,
    }))
    .sort((a, b) => b.monto - a.monto)

  const evolucion_12_meses: GastosDashboardResponse['evolucion_12_meses'] = []
  for (let i = 11; i >= 0; i--) {
    const p = addMonths(anio, mes, -i)
    const mk = `${p.anio}-${String(p.mes).padStart(2, '0')}`
    evolucion_12_meses.push({
      mes: mk,
      mes_label: `${MESES[p.mes - 1]?.slice(0, 3) ?? mk} ${p.anio}`,
      monto: filas.filter((f) => f.mes === mk).reduce((s, f) => s + f.monto, 0),
    })
  }

  const provMap = new Map<string, { monto: number; n: number }>()
  for (const f of filasMes) {
    const p = f.proveedor || 'Sin proveedor'
    const c = provMap.get(p) ?? { monto: 0, n: 0 }
    c.monto += f.monto
    c.n += 1
    provMap.set(p, c)
  }
  const top_proveedores = [...provMap.entries()]
    .map(([proveedor, v]) => ({
      proveedor,
      monto: v.monto,
      pct: totalMes > 0 ? (v.monto / totalMes) * 100 : 0,
      transacciones: v.n,
    }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, reglas.top_proveedores)

  const tipoMap = new Map<string, { monto: number; n: number }>()
  for (const f of filasMes) {
    const c = tipoMap.get(f.tipo_gasto) ?? { monto: 0, n: 0 }
    c.monto += f.monto
    c.n += 1
    tipoMap.set(f.tipo_gasto, c)
  }
  const por_tipo = [...tipoMap.entries()]
    .map(([tipo, v]) => ({
      tipo: tipo as TipoGasto | 'por_determinar',
      monto: v.monto,
      pct: totalMes > 0 ? (v.monto / totalMes) * 100 : 0,
      transacciones: v.n,
    }))
    .sort((a, b) => b.monto - a.monto)

  const topConc = por_categoria.slice(0, reglas.top_concentracion)
  const pctTop3 = por_categoria.slice(0, 3).reduce((s, c) => s + c.pct, 0)
  const nombresTop3 = por_categoria.slice(0, 3).map((c) => c.categoria).join(', ')
  const explicacion =
    por_categoria.length >= 3
      ? `El ${pctTop3.toFixed(0)}% del gasto mensual está concentrado en 3 categorías: ${nombresTop3}.`
      : 'Información insuficiente para calcular concentración de gastos.'

  const anomalias: GastosDashboardResponse['anomalias'] = []
  for (const cat of por_categoria) {
    const mesesCat = mesesUnicos.filter((m) => m < mesFoco)
    if (mesesCat.length < 2) continue
    const montos = mesesCat.map((m) =>
      filas
        .filter(
          (f) =>
            f.mes === m &&
            normalizarCategoriaPresupuestoKey(f.categoria_id, f.subcategoria_id) === cat.categoria_id,
        )
        .reduce((s, f) => s + f.monto, 0),
    )
    const prom = montos.reduce((a, b) => a + b, 0) / montos.length
    if (prom === 0) continue
    const varPct = pctVar(cat.monto, prom)
    if (varPct > reglas.variacion_critica_pct) {
      anomalias.push({ tipo: 'categoria', titulo: cat.categoria, detalle: `El gasto de ${cat.categoria} aumentó ${varPct.toFixed(0)}% respecto al promedio de los últimos ${mesesCat.length} meses.`, severidad: 'critico' })
    } else if (varPct > reglas.variacion_relevante_pct) {
      anomalias.push({ tipo: 'categoria', titulo: cat.categoria, detalle: `El gasto de ${cat.categoria} aumentó ${varPct.toFixed(0)}% respecto al promedio histórico reciente.`, severidad: 'relevante' })
    }
  }

  for (const prov of top_proveedores.slice(0, 5)) {
    const ant = filasMesAnt.filter((f) => (f.proveedor || 'Sin proveedor') === prov.proveedor).reduce((s, f) => s + f.monto, 0)
    if (ant === 0) continue
    const varPct = pctVar(prov.monto, ant)
    if (varPct > reglas.variacion_relevante_pct) {
      anomalias.push({
        tipo: 'proveedor',
        titulo: prov.proveedor,
        detalle: `El proveedor ${prov.proveedor} representa un incremento de ${varPct.toFixed(0)}% respecto al mes anterior.`,
        severidad: varPct > reglas.variacion_critica_pct ? 'critico' : 'relevante',
      })
    }
  }

  if (extraordinarios > 0) {
    anomalias.push({ tipo: 'extraordinario', titulo: 'Gastos extraordinarios', detalle: `${extraordinarios} gasto(s) identificado(s) como extraordinario(s) este mes.`, severidad: 'relevante' })
  }

  const recMap = new Map<string, { montos: number[]; concepto: string; meses: Set<string> }>()
  for (const f of filas) {
    if (f.tipo_gasto !== 'recurrente') continue
    const key = f.proveedor || f.descripcion.slice(0, 50)
    const r = recMap.get(key) ?? { montos: [], concepto: f.descripcion, meses: new Set() }
    r.montos.push(f.monto)
    r.meses.add(f.mes)
    recMap.set(key, r)
  }
  const recurrentes = [...recMap.entries()]
    .map(([proveedor, v]) => ({
      proveedor,
      concepto: v.concepto,
      promedio_mensual: v.montos.reduce((a, b) => a + b, 0) / v.montos.length,
      ultimo_gasto: filasMes.filter((f) => (f.proveedor || f.descripcion.slice(0, 50)) === proveedor).reduce((s, f) => s + f.monto, 0),
      frecuencia_meses: v.meses.size,
    }))
    .filter((r) => r.frecuencia_meses >= reglas.meses_min_recurrente - 1)
    .sort((a, b) => b.promedio_mensual - a.promedio_mensual)
    .slice(0, 15)

  const oportunidades: GastosDashboardResponse['oportunidades'] = []
  const topCat = por_categoria[0]
  if (topCat && topCat.pct > 25) {
    oportunidades.push({
      problema: `${topCat.categoria} concentra ${topCat.pct.toFixed(0)}% del gasto mensual`,
      impacto: 'Alta concentración presupuestaria',
      monto: topCat.monto,
      recomendacion: `Se recomienda revisar contratos, licencias y consumo en ${topCat.categoria} para identificar posibles optimizaciones.`,
    })
  }
  if (presupuestoMes == null && totalMes > 0) {
    oportunidades.push({
      problema: 'Gastos sin presupuesto asignado',
      impacto: 'Sin control presupuestario',
      monto: totalMes,
      recomendacion: 'Configure presupuestos mensuales por cuenta contable para habilitar comparación presupuesto vs real.',
    })
  }

  const cuentaNombreMap = new Map<string, string>()
  for (const p of presupuestos) {
    const key = normalizeCuentaKey(p.cuenta)
    if (key && p.cuenta_nombre) cuentaNombreMap.set(key, p.cuenta_nombre)
  }

  const cuentaRealMap = new Map<string, { monto: number; n: number }>()
  for (const f of filasMes) {
    const key = normalizeCuentaKey(f.cuenta)
    if (!key) continue
    const c = cuentaRealMap.get(key) ?? { monto: 0, n: 0 }
    c.monto += f.monto
    c.n += 1
    cuentaRealMap.set(key, c)
  }

  const presMap = new Map<string, number>()
  for (const p of presupuestos) {
    const key = normalizeCuentaKey(p.cuenta)
    if (!key) continue
    presMap.set(key, (presMap.get(key) ?? 0) + (p.monto ?? p.monto_usd ?? 0))
    if (p.cuenta_nombre) cuentaNombreMap.set(key, p.cuenta_nombre)
  }

  const presFilas = [...new Set([...presMap.keys(), ...cuentaRealMap.keys()])]
    .map((cuenta) => {
      const pres = presMap.get(cuenta) ?? 0
      const real = cuentaRealMap.get(cuenta)?.monto ?? 0
      return {
        cuenta,
        cuenta_nombre: cuentaNombreMap.get(cuenta) ?? cuenta,
        presupuesto: pres,
        real,
        variacion: real - pres,
        variacion_pct: pres > 0 ? pctVar(real, pres) : real > 0 ? 100 : 0,
      }
    })
    .sort((a, b) => b.real - a.real || b.presupuesto - a.presupuesto)

  const totalPres = presupuestoMes ?? 0
  const mesLabel = `${MESES[mes - 1] ?? mes} ${anio}`
  const sync = new Date().toISOString()
  await setUltimoSyncCostosIt(sync)
  const schema = sapCfg.schema?.trim() || sapCfg.database?.trim() || ''

  return {
    moneda: MONEDA_COSTOS_IT,
    filtros: {
      anio,
      mes,
      mes_label: mesLabel,
      desde,
      hasta,
      empresa: opts.empresa?.trim() || null,
      categoria_id: categoriaFiltro.composite,
      categoria: categoriaFiltroNombre,
      comparar_mes_anterior: opts.comparar_mes_anterior !== false,
      comparar_presupuesto: opts.comparar_presupuesto !== false,
    },
    kpis: {
      total_mes: totalMes,
      presupuesto_mes: presupuestoMes,
      variacion_presupuesto_usd: variacionPresupuestoUsd,
      variacion_presupuesto_pct: variacionPresupuestoPct,
      total_mes_anterior: totalMesAnt,
      variacion_mes_anterior_usd: variacionMesAntUsd,
      variacion_mes_anterior_pct: variacionMesAntPct,
      promedio_mensual: promedioMensual,
      transacciones: filasMes.length,
      semaforo,
    },
    por_categoria,
    evolucion_12_meses,
    top_proveedores,
    por_tipo,
    concentracion: { top: topConc.map((c) => ({ categoria: c.categoria, pct: c.pct, monto: c.monto })), explicacion },
    anomalias,
    recurrentes,
    oportunidades,
    presupuesto_vs_real: {
      disponible: presupuestosFiltrados.length > 0,
      total_presupuesto: totalPres,
      total_real: totalMes,
      diferencia: totalMes - totalPres,
      ejecucion_pct: totalPres > 0 ? (totalMes / totalPres) * 100 : 0,
      filas: presFilas,
    },
    resumen_mes: generarResumenMes({
      mesLabel,
      total: totalMes,
      moneda: 'USD',
      variacionMesAnteriorPct: variacionMesAntPct,
      variacionPresupuestoPct: opts.comparar_presupuesto !== false ? variacionPresupuestoPct : null,
      topCategorias: por_categoria,
      anomalias: anomalias.map((a) => a.detalle),
      oportunidades: oportunidades.length,
      extraordinarios,
    }),
    filas: filasMes.slice(0, 500),
    empresas,
    categorias,
    reglas,
    vista: schema ? `${schema}.${itCfg.viewName}` : itCfg.viewName,
    ultimo_sync: sync,
    aviso: filasMes.length > 500 ? `Mostrando 500 de ${filasMes.length} transacciones del mes.` : null,
  }
}

export async function ensureGastosItAnalisisDefaults(): Promise<void> {
  await GastosItAnalisisReglas.findOneAndUpdate({ clave: 'gastos_it_analisis' }, { $setOnInsert: {} }, { upsert: true })
}
