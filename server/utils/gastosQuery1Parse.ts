/**
 * Parser financiero multi-dimensional — hoja Query1 / Consulta1.
 *
 * Lee lo que ya está en la hoja SIN modificarla.
 * Columnas mínimas requeridas: Categoría | Tipo (CAPEX/OPEX) | Monto
 * Columnas opcionales detectadas: Año | Mes | Fecha | Descripción
 */

import { parseMonto } from './gastosOpexParse.js'

// ─── Constantes ───────────────────────────────────────────────────────────────

const MES_NOMBRES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'] as const

const MES_ALIAS: Record<string, number> = {
  enero:1, ene:1, january:1, jan:1,
  febrero:2, feb:2, february:2,
  marzo:3, mar:3, march:3,
  abril:4, abr:4, april:4, apr:4,
  mayo:5, may:5,
  junio:6, jun:6, june:6,
  julio:7, jul:7, july:7,
  agosto:8, ago:8, august:8, aug:8,
  septiembre:9, sep:9, sept:9, september:9,
  octubre:10, oct:10, october:10,
  noviembre:11, nov:11, november:11,
  diciembre:12, dic:12, december:12, dec:12,
}

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type FilaFinanciera = {
  ano:         number | null
  mes:         number | null   // 1-12, null si no hay columna de mes
  categoria:   string
  tipo:        'CAPEX' | 'OPEX'
  descripcion: string
  monto:       number
}

export type ResumenDimension = {
  clave: string
  capex: number
  opex:  number
  total: number
}

export type MatrizAnoCategoria = {
  ano:       string
  categoria: string
  capex:     number
  opex:      number
  total:     number
}

export type DatoMensual = {
  mes:       number   // 1-12
  mesNombre: string   // 'Ene' … 'Dic'
  porAno:    { ano: string; capex: number; opex: number; total: number }[]
}

export type AhorroAnual = {
  anoActual:    string
  anoRef:       string        // año base (anterior)
  opexRef:      number
  opexActual:   number
  ahorro:       number        // opexRef - opexActual (positivo = se redujo)
  pctAhorro:    number        // %
  porCategoria: {
    categoria:  string
    opexRef:    number
    opexActual: number
    ahorro:     number
    pctAhorro:  number
  }[]
}

export type GastosFinancieroParse = {
  hoja: string
  columnasDetectadas: {
    ano:         string | null
    mes:         string | null
    categoria:   string
    tipo:        string
    descripcion: string | null
    monto:       string
  }
  tieneMes:        boolean
  anos:            string[]
  categorias:      string[]
  totalCapex:      number
  totalOpex:       number
  porCategoria:    ResumenDimension[]
  porAno:          ResumenDimension[]
  porTipoCategoria: ResumenDimension[]
  matriz:          MatrizAnoCategoria[]
  mensual:         DatoMensual[]        // tendencia mes × año
  ahorroAnual:     AhorroAnual[]        // comparativas YoY
  filas:           FilaFinanciera[]
  advertencia?:    string
}

// ─── Normalización ────────────────────────────────────────────────────────────

function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    // Tratamos `_`, `-`, `.`, `/` y otros separadores como espacio para que
    // `Nombre_Cuenta` o `Codigo-Cuenta` matcheen las mismas reglas que el
    // formato "humano" con espacios.
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Parseo de celdas ─────────────────────────────────────────────────────────

function parseTipo(raw: unknown): 'CAPEX' | 'OPEX' | null {
  const x = norm(raw)
  if (!x) return null
  if (/capex|inversion|inversi[oó]n fija|bien de capital/.test(x)) return 'CAPEX'
  if (/opex|operativ|operaci[oó]n|gasto corriente|gastos fijos/.test(x)) return 'OPEX'
  return null
}

function parseAno(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.getFullYear()
  const s = String(raw).trim()
  const direct = s.match(/^(20\d{2})$/)
  if (direct) return Number(direct[1])
  const fromDate = s.match(/(?:^|\D)(20\d{2})(?:\D|$)/)
  if (fromDate) return Number(fromDate[1])
  const n = Number(raw)
  if (!Number.isNaN(n) && n >= 2000 && n <= 2100) return n
  return null
}

function parseMes(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.getMonth() + 1
  const s = String(raw).trim()

  // Número directo "3" o "03"
  const num = Number(s)
  if (!Number.isNaN(num) && num >= 1 && num <= 12) return num

  // Nombre o abrev
  const key = norm(s)
  if (MES_ALIAS[key] != null) return MES_ALIAS[key]!

  // De fecha "2025-03-01" o "01/03/2025"
  const isoMatch = s.match(/^\d{4}-(\d{2})-\d{2}/)
  if (isoMatch) { const m = parseInt(isoMatch[1]!, 10); if (m >= 1 && m <= 12) return m }
  const latMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/\d{4}/)
  if (latMatch) {
    // dd/mm/yyyy → segundo grupo
    const m = parseInt(latMatch[2]!, 10)
    if (m >= 1 && m <= 12) return m
  }
  return null
}

// ─── Detección de columnas ────────────────────────────────────────────────────

type ColIndices = {
  ano:         number | null
  mes:         number | null
  categoria:   number
  tipo:        number | null  // si null → se asume todo OPEX
  descripcion: number | null
  monto:       number
}

/**
 * Reglas de matching por columna. Cada regex se evalúa contra el header
 * normalizado (lowercase, sin acentos, separadores como espacio). Esto cubre
 * variantes humanas (`Categoría`), de Power Query/SAP (`Nombre_Cuenta`,
 * `Codigo_Cuenta`, `Monto_Local`) y abreviaturas (`MontoHNL`, `Imp_HNL`).
 */
const ALIAS: Record<string, RegExp> = {
  ano:         /^(a[nñ]o|year|periodo|fecha|date|ano contable|year ?contable)$/,
  mes:         /^(mes|month|periodo mensual|m[eé]s|mes ?contable)$/,
  categoria:   /^(categor[ií]a|category|rubro|partida|cuenta|nombre cuenta|cuenta contable|codigo cuenta|clasificacion|clase|grupo|grupo cuenta|area|eje|tipo gasto|tipo de gasto|centro de costos|ceco|centro costos|centro)$/,
  // OJO: `Tipo_Doc` / `Tipo de documento` son tipos de asiento SAP (FA, FE, …),
  // no CAPEX/OPEX, así que NO se incluyen aquí. Si después de detectar la
  // columna Tipo no encontramos valores CAPEX/OPEX en las primeras filas, la
  // descartamos automáticamente y asumimos OPEX (ver detectCols).
  tipo:        /^(tipo|type|capex opex|opex capex|clase gasto|clase de gasto|naturaleza|tipo movimiento|tipo gasto|tipo de gasto)$/,
  descripcion: /^(descripci[oó]n|descripcion|concepto|detalle|detalle asiento|doc origen|item|denominacion|glosa|nombre|nombre proveedor)$/,
  monto:       /^(monto|monto local|monto hnl|monto lps|monto usd|importe|importe local|imp hnl|valor|total|amount|presupuesto|gasto|costo|saldo|lps|hnl|lempiras)$/,
}

/** Heurística secundaria: cuando no hay match exacto, busca palabras clave. */
const CONTAINS: Record<string, RegExp> = {
  monto: /(monto|importe|saldo|amount|total|costo|gasto|valor|hnl|lps|usd)/,
  categoria: /(categor|cuenta|rubro|partida|grupo|centro|ceco)/,
  descripcion: /(descrip|concepto|detalle|glosa|denominaci)/,
}

function detectCols(headers: string[]): ColIndices | null {
  const norms = headers.map(norm)
  const find = (key: keyof typeof ALIAS) =>
    norms.findIndex((n) => n && ALIAS[key].test(n))
  const findLoose = (key: keyof typeof CONTAINS) =>
    norms.findIndex((n) => n && CONTAINS[key].test(n))

  let catIdx   = find('categoria')
  let montoIdx = find('monto')
  const tipoIdx  = find('tipo')

  // Fallback: si los nombres no calzan exactamente, intentamos por inclusión
  // de palabra clave. Esto cubre encabezados tipo `Importe_Total_HNL`.
  if (catIdx < 0) catIdx = findLoose('categoria')
  if (montoIdx < 0) montoIdx = findLoose('monto')

  // El parser ahora tolera la ausencia de columna Tipo: si hay Categoría y
  // Monto, se asume todo como OPEX (gasto operativo). Para mantener la
  // confiabilidad de la detección de encabezado exigimos al menos esas dos.
  if (catIdx < 0 || montoIdx < 0) return null

  return {
    ano:         find('ano'),
    mes:         find('mes'),
    categoria:   catIdx,
    tipo:        tipoIdx >= 0 ? tipoIdx : null,
    descripcion: find('descripcion'),
    monto:       montoIdx,
  }
}

function findHeaderRow(rows: unknown[][]): { idx: number; cols: ColIndices; raw: string[] } | null {
  // Buscamos hasta 80 filas para tolerar archivos con título / fila vacía al inicio.
  for (let r = 0; r < Math.min(rows.length, 80); r++) {
    const cells = (rows[r] ?? []).map((c) => String(c ?? '').trim())
    // Una fila válida de encabezado tiene al menos 2 celdas con contenido.
    if (cells.filter(Boolean).length < 2) continue
    const cols = detectCols(cells)
    if (cols) {
      // Auto-descarte de la columna Tipo: si en una muestra de hasta 50 filas
      // no aparece ningún valor CAPEX/OPEX, la "columna Tipo" detectada en
      // realidad no clasifica gasto (por ejemplo es `Tipo_Movimiento` o un
      // tipo de documento). En ese caso la ignoramos y asumimos OPEX.
      if (cols.tipo != null) {
        let hits = 0
        const limit = Math.min(rows.length, r + 1 + 50)
        for (let i = r + 1; i < limit; i++) {
          const v = (rows[i] as unknown[] | undefined)?.[cols.tipo]
          if (parseTipo(v)) { hits++; if (hits >= 1) break }
        }
        if (hits === 0) cols.tipo = null
      }
      return { idx: r, cols, raw: cells }
    }
  }
  return null
}

// ─── Extracción de filas ──────────────────────────────────────────────────────

function extractFilas(rows: unknown[][], headerIdx: number, cols: ColIndices): FilaFinanciera[] {
  const out: FilaFinanciera[] = []
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row  = rows[r] as unknown[]
    // Si hay columna Tipo, requerimos CAPEX/OPEX; si no, asumimos OPEX.
    let tipo: 'CAPEX' | 'OPEX' | null = null
    if (cols.tipo != null) {
      tipo = parseTipo(row[cols.tipo])
      if (!tipo) continue
    } else {
      tipo = 'OPEX'
    }

    const monto = parseMonto(row[cols.monto])
    if (monto === 0) continue

    const categoria = String(row[cols.categoria] ?? '').trim()
    if (!categoria || /^(total|subtotal|suma|grand total)/i.test(categoria)) continue

    // Año: primero intenta de columna dedicada; si hay Fecha intenta también
    let ano: number | null = null
    if (cols.ano != null) {
      ano = parseAno(row[cols.ano])
    }

    // Mes: de columna dedicada, si no de la columna Fecha/Año
    let mes: number | null = null
    if (cols.mes != null) {
      mes = parseMes(row[cols.mes])
    } else if (cols.ano != null && ano == null) {
      // Puede que la columna "Fecha" contenga una fecha completa
      mes = parseMes(row[cols.ano])
      ano = parseAno(row[cols.ano])
    }

    const desc = cols.descripcion != null ? String(row[cols.descripcion] ?? '').trim() : ''
    out.push({ ano, mes, categoria, tipo, descripcion: desc, monto })
  }
  return out
}

// ─── Agregaciones ────────────────────────────────────────────────────────────

function r2(n: number) { return Math.round(n * 100) / 100 }

function agrupar<K extends string>(
  filas:  FilaFinanciera[],
  getKey: (f: FilaFinanciera) => K,
  sort:   'total_desc' | 'key_asc' = 'total_desc',
): ResumenDimension[] {
  const m = new Map<K, { capex: number; opex: number }>()
  for (const f of filas) {
    const k = getKey(f)
    if (!m.has(k)) m.set(k, { capex: 0, opex: 0 })
    const e = m.get(k)!
    if (f.tipo === 'CAPEX') e.capex += f.monto; else e.opex += f.monto
  }
  const arr = [...m.entries()].map(([clave, { capex, opex }]) => ({
    clave: String(clave), capex: r2(capex), opex: r2(opex), total: r2(capex + opex),
  }))
  return sort === 'total_desc'
    ? arr.sort((a, b) => b.total - a.total)
    : arr.sort((a, b) => a.clave.localeCompare(b.clave, 'es'))
}

function construirMatriz(filas: FilaFinanciera[], anos: string[], categorias: string[]): MatrizAnoCategoria[] {
  const m = new Map<string, { capex: number; opex: number }>()
  for (const f of filas) {
    const ano = f.ano != null ? String(f.ano) : 'Sin año'
    const key = `${ano}||${f.categoria}`
    if (!m.has(key)) m.set(key, { capex: 0, opex: 0 })
    const e = m.get(key)!
    if (f.tipo === 'CAPEX') e.capex += f.monto; else e.opex += f.monto
  }
  return anos.flatMap((ano) =>
    categorias.map((cat) => {
      const e = m.get(`${ano}||${cat}`) ?? { capex: 0, opex: 0 }
      return { ano, categoria: cat, capex: r2(e.capex), opex: r2(e.opex), total: r2(e.capex + e.opex) }
    }),
  )
}

/** Tendencia mensual: para cada mes (1-12), montos por año. */
function construirMensual(filas: FilaFinanciera[], anos: string[]): DatoMensual[] {
  // Solo tiene sentido si al menos una fila tiene mes
  const meses = new Set(filas.map((f) => f.mes).filter((m): m is number => m != null))
  if (!meses.size) return []

  const m = new Map<string, { capex: number; opex: number }>()
  for (const f of filas) {
    if (f.mes == null) continue
    const ano = f.ano != null ? String(f.ano) : 'Sin año'
    const key = `${ano}||${f.mes}`
    if (!m.has(key)) m.set(key, { capex: 0, opex: 0 })
    const e = m.get(key)!
    if (f.tipo === 'CAPEX') e.capex += f.monto; else e.opex += f.monto
  }

  const allMeses = Array.from({ length: 12 }, (_, i) => i + 1)
  const anosConMes = anos.length ? anos : ['Sin año']

  return allMeses.map((mes) => ({
    mes,
    mesNombre: MES_NOMBRES[mes - 1]!,
    porAno: anosConMes.map((ano) => {
      const e = m.get(`${ano}||${mes}`) ?? { capex: 0, opex: 0 }
      return { ano, capex: r2(e.capex), opex: r2(e.opex), total: r2(e.capex + e.opex) }
    }),
  }))
}

/**
 * Cálculo de ahorro OPEX año actual vs año anterior.
 * Fórmula: Ahorro = OPEX_año_ref − OPEX_año_actual  (positivo = bueno)
 * % Ahorro = Ahorro / OPEX_año_ref × 100
 */
function calcularAhorro(filas: FilaFinanciera[], anos: string[], categorias: string[]): AhorroAnual[] {
  if (anos.length < 2) return []

  // OPEX por año × categoría
  const opexAnocat = new Map<string, number>()
  const opexAno    = new Map<string, number>()
  for (const f of filas) {
    if (f.tipo !== 'OPEX' || f.ano == null) continue
    const ano = String(f.ano)
    const key = `${ano}||${f.categoria}`
    opexAnocat.set(key, (opexAnocat.get(key) ?? 0) + f.monto)
    opexAno.set(ano, (opexAno.get(ano) ?? 0) + f.monto)
  }

  const result: AhorroAnual[] = []
  // Para cada par (año anterior → año actual)
  for (let i = 1; i < anos.length; i++) {
    const anoRef     = anos[i - 1]!
    const anoActual  = anos[i]!
    const opexRef    = r2(opexAno.get(anoRef)    ?? 0)
    const opexActual = r2(opexAno.get(anoActual) ?? 0)
    const ahorro     = r2(opexRef - opexActual)
    const pctAhorro  = opexRef > 0 ? r2((ahorro / opexRef) * 100) : 0

    const porCategoria = categorias.map((cat) => {
      const ref = r2(opexAnocat.get(`${anoRef}||${cat}`)    ?? 0)
      const act = r2(opexAnocat.get(`${anoActual}||${cat}`) ?? 0)
      const aho = r2(ref - act)
      return {
        categoria:  cat,
        opexRef:    ref,
        opexActual: act,
        ahorro:     aho,
        pctAhorro:  ref > 0 ? r2((aho / ref) * 100) : 0,
      }
    })

    result.push({ anoActual, anoRef, opexRef, opexActual, ahorro, pctAhorro, porCategoria })
  }
  return result
}

// ─── Función principal ────────────────────────────────────────────────────────

export function parseFinancialQuerySheet(rows: unknown[][], sheetName: string): GastosFinancieroParse {
  const empty = (adv: string): GastosFinancieroParse => ({
    hoja: sheetName,
    columnasDetectadas: { ano: null, mes: null, categoria: '—', tipo: '—', descripcion: null, monto: '—' },
    tieneMes: false,
    anos: [], categorias: [],
    totalCapex: 0, totalOpex: 0,
    porCategoria: [], porAno: [], porTipoCategoria: [], matriz: [],
    mensual: [], ahorroAnual: [],
    filas: [],
    advertencia: adv,
  })

  const found = findHeaderRow(rows)
  if (!found) {
    // Reportamos qué cabeceras vimos para que el usuario pueda corregir el nombre
    // de la columna sin tener que adivinar.
    const headerSample = (rows[0] ?? [])
      .map((c) => String(c ?? '').trim())
      .filter(Boolean)
      .slice(0, 8)
      .join(' · ')
    return empty(
      'No se detectó encabezado. Se requieren al menos una columna de ' +
      'Categoría (Cuenta, Rubro, Centro de costos…) y una de Monto ' +
      '(Importe, Saldo, Total…). Idealmente también una columna Tipo con valores ' +
      'CAPEX / OPEX.' +
      (headerSample ? ` Cabeceras detectadas: ${headerSample}.` : ''),
    )
  }

  const { idx, cols, raw: headers } = found
  const filas = extractFilas(rows, idx, cols)

  if (!filas.length) {
    return empty(
      'Encabezado detectado pero sin filas válidas. ' +
      'Verifica que el Monto sea numérico' +
      (cols.tipo != null ? ' y que la columna Tipo tenga valores "CAPEX" u "OPEX".' : '.'),
    )
  }

  const anosSet = new Set<string>()
  const catSet  = new Set<string>()
  const tieneMes = filas.some((f) => f.mes != null)

  for (const f of filas) {
    if (f.ano != null) anosSet.add(String(f.ano))
    catSet.add(f.categoria)
  }

  const anos       = [...anosSet].sort()
  const porAnoRaw  = agrupar(filas, (f) => (f.ano != null ? String(f.ano) : 'Sin año') as string, 'key_asc')
  const porCatRaw  = agrupar(filas, (f) => f.categoria as string, 'total_desc')
  const categorias = porCatRaw.map((r) => r.clave)

  let totalCapex = 0, totalOpex = 0
  for (const f of filas) {
    if (f.tipo === 'CAPEX') totalCapex += f.monto; else totalOpex += f.monto
  }

  const porTipoCategoria = agrupar(
    filas, (f) => `${f.tipo}||${f.categoria}` as string, 'total_desc',
  ).map((r) => {
    const [, cat] = r.clave.split('||')
    return { ...r, clave: cat ?? r.clave }
  }) as ResumenDimension[]

  const matriz      = construirMatriz(filas, anos.length ? anos : ['Sin año'], categorias)
  const mensual     = construirMensual(filas, anos)
  const ahorroAnual = calcularAhorro(filas, anos, categorias)

  const MAX = 1200
  const avisos: string[] = []
  if (filas.length > MAX) avisos.push(`Detalle limitado a ${MAX} de ${filas.length} filas.`)
  if (cols.tipo == null) {
    avisos.push(
      'No se encontró columna Tipo (CAPEX/OPEX). Todos los montos se interpretan ' +
      'como OPEX (gasto operativo). Agrega una columna llamada "Tipo" con valores ' +
      'CAPEX/OPEX para separar inversión vs. operación.',
    )
  }
  const adv = avisos.length ? avisos.join(' ') : undefined

  return {
    hoja: sheetName,
    columnasDetectadas: {
      ano:         cols.ano  != null ? (headers[cols.ano]  ?? null) : null,
      mes:         cols.mes  != null ? (headers[cols.mes]  ?? null) : null,
      categoria:   headers[cols.categoria]  ?? '',
      tipo:        cols.tipo != null ? (headers[cols.tipo] ?? '') : '— (asumido OPEX)',
      descripcion: cols.descripcion != null ? (headers[cols.descripcion] ?? null) : null,
      monto:       headers[cols.monto]      ?? '',
    },
    tieneMes,
    anos,
    categorias,
    totalCapex:      r2(totalCapex),
    totalOpex:       r2(totalOpex),
    porCategoria:    porCatRaw,
    porAno:          porAnoRaw,
    porTipoCategoria,
    matriz,
    mensual,
    ahorroAnual,
    filas:           filas.length > MAX ? filas.slice(0, MAX) : filas,
    advertencia:     adv,
  }
}
