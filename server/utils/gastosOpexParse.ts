/** Interpreta hoja tipo "Base OPEX": fila con meses + filas categoría × montos mensuales. */

export type CategoriaOpex = {
  nombre: string
  meses: Record<string, number>
  total: number
  meta20: number
}

export type OpexParseResult = {
  hoja: string
  periodos: string[]
  categorias: CategoriaOpex[]
  totalAnual: number
  meta20: number
  ahorroProyectado: number
  advertencia?: string
}

const MONTH_HINT =
  /^(ene(ro)?|feb(rero)?|mar(zo)?|abr(il)?|may(o)?|jun(io)?|jul(io)?|ago(sto)?|sep(t|t\.)?(tiembre)?|oct(ubre)?|nov(iembre)?|dic(iembre)?|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i

export function parseMonto(v: unknown): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  let s = String(v)
    .replace(/lps/gi, '')
    .replace(/hnl/gi, '')
    .replace(/usd/gi, '')
    .replace(/[$]/g, '')
    .replace(/\s/g, '')
  // Notación contable: (1,234.56) representa -1234.56
  let negativo = false
  const parens = s.match(/^\(([^)]+)\)$/)
  if (parens) { negativo = true; s = parens[1]! }
  if (s.startsWith('-')) { negativo = !negativo; s = s.slice(1) }

  // Decide separador decimal: si hay tanto coma como punto, el último es decimal.
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) {
      // 1.234,56 → decimal es coma
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // 1,234.56 → decimal es punto
      s = s.replace(/,/g, '')
    }
  } else if (lastComma >= 0 && lastDot < 0) {
    // Solo coma: si tiene exactamente 3 dígitos después puede ser miles (1,234) o decimal (1,5).
    const decimals = s.length - lastComma - 1
    if (decimals === 3) s = s.replace(/,/g, '')
    else s = s.replace(',', '.')
  } else if (lastDot >= 0 && lastComma < 0) {
    // Solo punto: ya está en formato standard, pero remueve puntos que sean separadores de miles si son varios.
    const dots = (s.match(/\./g) ?? []).length
    if (dots > 1) s = s.replace(/\./g, '')
  }
  // Caracteres remanentes no válidos
  s = s.replace(/[^0-9.]/g, '')
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return 0
  return negativo ? -n : n
}

function isMonthHeader(cell: unknown): boolean {
  const s = String(cell ?? '').trim()
  if (!s) return false
  if (MONTH_HINT.test(s)) return true
  if (/^m\d{1,2}$/i.test(s)) return true
  return false
}

function findHeaderRow(rows: unknown[][]): number {
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const row = rows[r] ?? []
    let hits = 0
    for (let c = 1; c < row.length; c++) {
      if (isMonthHeader(row[c])) hits++
    }
    if (hits >= 4) return r
  }
  return -1
}

export function parseOpexSheet(rows: unknown[][], sheetName: string): OpexParseResult {
  const headerIdx = findHeaderRow(rows)
  if (headerIdx < 0) {
    return {
      hoja: sheetName,
      periodos: [],
      categorias: [],
      totalAnual: 0,
      meta20: 0,
      ahorroProyectado: 0,
      advertencia:
        'No se detectó una fila de encabezado con nombres de meses. Usa la primera columna para la categoría y columnas siguientes para montos mensuales.',
    }
  }

  const headerRow = rows[headerIdx] as unknown[]
  const periodos: string[] = []
  for (let c = 1; c < headerRow.length; c++) {
    const h = String(headerRow[c] ?? '').trim()
    if (!h) break
    if (/^total\b/i.test(h)) break
    periodos.push(h)
  }

  const categorias: CategoriaOpex[] = []
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] as unknown[]
    const nombre = String(row[0] ?? '').trim()
    if (!nombre) continue
    if (/^total\b/i.test(nombre)) continue
    const meses: Record<string, number> = {}
    let sum = 0
    for (let i = 0; i < periodos.length; i++) {
      const key = periodos[i] ?? `M${i + 1}`
      const v = parseMonto(row[1 + i])
      meses[key] = v
      sum += v
    }
    if (sum === 0 && Object.keys(meses).length === 0) continue
    categorias.push({
      nombre,
      meses,
      total: sum,
      meta20: Math.round(sum * 0.8 * 100) / 100,
    })
  }

  const totalAnual = Math.round(categorias.reduce((a, c) => a + c.total, 0) * 100) / 100
  const meta20 = Math.round(totalAnual * 0.8 * 100) / 100
  const ahorroProyectado = Math.round((totalAnual - meta20) * 100) / 100

  return {
    hoja: sheetName,
    periodos,
    categorias,
    totalAnual,
    meta20,
    ahorroProyectado,
  }
}
