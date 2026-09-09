import { findColumnByPatterns, findColumnInList } from './sapBiColumnDetect.js'

export const VISTA_COSTOS_IT = 'VW_COSTOS_IT'

export type CostosItFieldMap = {
  fecha?: string
  monto?: string
  descripcion?: string
  proveedor?: string
  documento?: string
  cuenta?: string
  cuenta_nombre?: string
  empresa?: string
  categoria_origen?: string
  departamento?: string
  tipo?: string
}

const CANDIDATES: Record<keyof Required<CostosItFieldMap>, string[]> = {
  fecha: ['Fecha_Contabilizacion', 'Fecha', 'DocDate', 'FECHA', 'PostingDate', 'FechaContable', 'FechaDoc', 'Periodo'],
  monto: [
    'Total_Linea', 'TotalLinea', 'SubTotal', 'Monto', 'Importe', 'Total', 'Debit', 'Credito', 'Amount', 'Valor', 'Costo',
    'LineTotal', 'MontoML', 'MontoUSD', 'Saldo',
  ],
  descripcion: [
    'Descripcion', 'Concepto', 'Detalle', 'Memo', 'LineMemo', 'Comentario',
    'NombreCuenta', 'AcctName', 'Glosa',
  ],
  proveedor: [
    'nombre_proveedor',
    'Nombre_Proveedor',
    'NombreProveedor',
    'Proveedor',
    'CardName',
    'Acreedor',
    'VendorName',
    'Codigo_Proveedor',
    'CardCode',
  ],
  documento: ['Numero_Documento', 'DocNum', 'NumeroDoc', 'Factura', 'Folio', 'Ref', 'NumDocumento', 'NoDoc'],
  cuenta: ['Codigo_De_Formato', 'Cuenta', 'AcctCode', 'AccountCode', 'CodCuenta', 'CuentaContable'],
  cuenta_nombre: ['NombreCuenta', 'AcctName', 'Nombre_Cuenta', 'AccountName', 'GlosaCuenta'],
  empresa: ['Empresa', 'Company', 'Filial', 'Compania', 'BPLName'],
  categoria_origen: [
    'categoria_sap',
    'Categoria_SAP',
    'Categoria',
    'TipoGasto',
    'Grupo',
    'Clase',
    'Tipo',
    'Rubro',
    'Tipo_Doc',
  ],
  departamento: [
    'Centro de costos 1', 'Centro de costos 2', 'Departamento', 'Dept', 'OcrCode2', 'CentroCosto', 'ProfitCode', 'Dimension',
  ],
  tipo: ['Tipo_Doc', 'TipoDoc', 'DocType', 'TipoDocumento', 'ObjectType'],
}

export function suggestCostosItFields(columns: string[]): CostosItFieldMap {
  const fields: CostosItFieldMap = {}
  const used = new Set<string>()

  for (const [alias, candidates] of Object.entries(CANDIDATES) as [keyof CostosItFieldMap, string[]][]) {
    const col = findColumnInList(columns, candidates)
    if (col && !used.has(col)) {
      fields[alias] = col
      used.add(col)
    }
  }

  if (!fields.monto) {
    const col = findColumnByPatterns(
      columns,
      [/monto/i, /importe/i, /total/i, /debit/i, /amount/i, /valor/i, /costo/i],
      used,
    )
    if (col) {
      fields.monto = col
      used.add(col)
    }
  }

  if (!fields.descripcion) {
    const col = findColumnByPatterns(
      columns,
      [/descrip/i, /concepto/i, /detalle/i, /memo/i, /glosa/i],
      used,
    )
    if (col) fields.descripcion = col
  }

  if (!fields.fecha) {
    const col = findColumnByPatterns(columns, [/fecha/i, /date/i, /periodo/i], used)
    if (col) fields.fecha = col
  }

  if (!fields.proveedor) {
    const col = findColumnByPatterns(
      columns,
      [/nombre_proveedor/i, /nombre.*proveedor/i, /^proveedor$/i],
      used,
    )
    if (col) fields.proveedor = col
  } else {
    const preferido = findColumnInList(columns, ['nombre_proveedor', 'Nombre_Proveedor', 'NombreProveedor'])
    if (preferido) fields.proveedor = preferido
  }

  if (!fields.categoria_origen) {
    const col = findColumnByPatterns(
      columns,
      [/categoria_sap/i, /categoria.*sap/i, /^categoria$/i],
      used,
    )
    if (col) fields.categoria_origen = col
  } else {
    const preferido = findColumnInList(columns, ['categoria_sap', 'Categoria_SAP', 'Categoria'])
    if (preferido) fields.categoria_origen = preferido
  }

  return fields
}

export function costosItFieldsValid(fields: CostosItFieldMap): boolean {
  return Boolean(fields.monto?.trim() && (fields.descripcion?.trim() || fields.cuenta?.trim()))
}
