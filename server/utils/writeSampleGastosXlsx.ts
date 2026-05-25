import fs from 'fs'
import path from 'path'
import xlsx from 'xlsx'

/**
 * Crea `data/gastos.xlsx` de demostración si NO existe (nunca sobrescribe).
 *
 * Solo genera la hoja "Base OPEX (Gastos)" con datos mensuales de ejemplo.
 * La hoja "Query1" debe ser exportada por el usuario desde Power Query
 * con las columnas reales de su presupuesto.
 */
export function ensureSampleGastosXlsx(): void {
  const dir = path.join(process.cwd(), 'data')
  const fp = path.join(dir, 'gastos.xlsx')
  if (fs.existsSync(fp)) return   // ← nunca sobreescribe archivo del usuario
  fs.mkdirSync(dir, { recursive: true })

  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const rows: (string | number)[][] = [
    ['Plan OPEX — demo RCJ IT (reemplazar con archivo real)'],
    ['Categoría', ...months],
  ]

  const bases: [string, number][] = [
    ['Salarios y beneficios',             385_000],
    ['Licencias de software',              42_000],
    ['Tercerización / outsourcing',       180_000],
    ['Conectividad y telecomunicaciones',  95_000],
    ['Servicios Cloud',                    72_000],
    ['Hardware y mantenimiento',           55_000],
    ['Capacitación técnica',               18_000],
    ['Otros gastos IT',                    28_000],
  ]

  for (const [name, base] of bases) {
    const r: (string | number)[] = [name]
    for (let m = 0; m < 12; m++) r.push(Math.round(base * (1 + (m % 4) * 0.015)))
    rows.push(r)
  }

  const wb = xlsx.utils.book_new()
  const ws = xlsx.utils.aoa_to_sheet(rows)
  xlsx.utils.book_append_sheet(wb, ws, 'Base OPEX (Gastos)')
  xlsx.writeFile(wb, fp)
}
