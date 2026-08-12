import * as XLSX from 'xlsx'

import type {
  RecetaDetallePayload,
  RecetaMatrizItem,
  VentaAnalisisPayload,
} from '@/types/costeoMuestras'

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function sheetFromRows(rows: Record<string, unknown>[], name: string): XLSX.WorkSheet {
  const ws = XLSX.utils.json_to_sheet(rows)
  const keys = rows[0] ? Object.keys(rows[0]) : []
  if (keys.length) {
    ws['!cols'] = keys.map((k) => ({
      wch: Math.min(40, Math.max(12, k.length + 2, ...rows.slice(0, 40).map((r) => String(r[k] ?? '').length + 1))),
    }))
  }
  // sheet name max 31 chars
  void name
  return ws
}

/** Exporta matriz General Recetas (resumen + ingredientes). */
export function exportGeneralRecetasExcel(
  recetas: RecetaMatrizItem[],
  meta?: { vista?: string; vista_produccion?: string },
): void {
  const wb = XLSX.utils.book_new()

  const resumen = recetas.map((r) => ({
    Código: r.receta_code,
    Nombre: r.receta_nombre,
    Ingredientes: r.total_ingredientes,
    'Costo unit. teórico (Lps)': r.costo_total,
    'Cantidad producida': r.cantidad_producida ?? 0,
    'Costo teórico × qty (Lps)': r.costo_teorico_prod ?? 0,
    'Costo producción (Lps)': r.costo_produccion ?? 0,
    'Variación (Lps)': r.variacion ?? 0,
    'Variación %': r.variacion_pct ?? 0,
    Órdenes: r.ordenes ?? 0,
    Flag: r.flag_costo || '',
  }))

  const ingredientes: Record<string, unknown>[] = []
  for (const r of recetas) {
    for (const ing of r.ingredientes) {
      ingredientes.push({
        'Código receta': r.receta_code,
        'Nombre receta': r.receta_nombre,
        'Código componente': ing.componente_code,
        Componente: ing.componente_nombre,
        Cantidad: ing.cantidad,
        Unidad: ing.unidad,
        'Costo unitario (Lps)': ing.costo_unitario,
        'Costo teórico (Lps)': ing.costo_teorico,
        '% costo': ing.pct_costo,
      })
    }
  }

  const produccion: Record<string, unknown>[] = []
  for (const r of recetas) {
    for (const d of r.produccion_detalle ?? []) {
      produccion.push({
        'Código receta': r.receta_code,
        'Nombre receta': r.receta_nombre,
        Fecha: d.fecha || '',
        Periodo: d.periodo || '',
        Orden: d.orden,
        Almacén: d.almacen,
        Estado: d.estado,
        Cantidad: d.cantidad,
        'Costo (Lps)': d.costo,
      })
    }
  }

  XLSX.utils.book_append_sheet(wb, sheetFromRows(resumen, 'Recetas'), 'Recetas')
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(ingredientes.length ? ingredientes : [{ Nota: 'Sin ingredientes' }], 'Ingredientes'),
    'Ingredientes',
  )
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(produccion.length ? produccion : [{ Nota: 'Sin producción' }], 'Produccion'),
    'Produccion',
  )

  if (meta?.vista) {
    XLSX.utils.book_append_sheet(
      wb,
      sheetFromRows(
        [
          {
            Vista: meta.vista,
            'Vista producción': meta.vista_produccion || '',
            Exportado: new Date().toISOString(),
          },
        ],
        'Info',
      ),
      'Info',
    )
  }

  downloadWorkbook(wb, `BI-General-Recetas-${stamp()}.xlsx`)
}

/** Exporta detalle de una receta (ingredientes). */
export function exportRecetaDetalleExcel(detalle: RecetaDetallePayload): void {
  const wb = XLSX.utils.book_new()
  const r = detalle.receta

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      [
        {
          Código: r.receta_code,
          Nombre: r.receta_nombre,
          'Costo total (Lps)': detalle.resumen.costo_total,
          Ingredientes: detalle.resumen.total_ingredientes,
          Flag: r.flag_costo || '',
          Vista: detalle.vista,
        },
      ],
      'Receta',
    ),
    'Receta',
  )

  const ings = detalle.ingredientes.map((ing) => ({
    Código: ing.componente_code,
    Componente: ing.componente_nombre,
    Cantidad: ing.cantidad,
    Unidad: ing.unidad,
    'Costo unitario (Lps)': ing.costo_unitario,
    'Costo teórico (Lps)': ing.costo_teorico,
    '% costo': ing.pct_costo,
  }))

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(ings.length ? ings : [{ Nota: 'Sin ingredientes' }], 'Ingredientes'),
    'Ingredientes',
  )

  const safe = (r.receta_code || 'receta').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40)
  downloadWorkbook(wb, `BI-Receta-${safe}-${stamp()}.xlsx`)
}

/** Exporta análisis ventas/margen (resumen, por receta, detalle). */
export function exportVentasAnalisisExcel(data: VentaAnalisisPayload): void {
  const wb = XLSX.utils.book_new()
  const s = data.resumen

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      [
        {
          'Venta total (Lps)': s.total_venta,
          'Costo teórico (Lps)': s.total_costo_teorico,
          'Costo producción (Lps)': s.total_costo,
          'Variación (Lps)': s.total_variacion,
          'Variación %': s.variacion_pct,
          'Margen (Lps)': s.total_margen,
          'Margen %': s.margen_pct,
          Registros: s.total_registros,
          Vista: data.vista,
          'Último sync': data.ultimo_sync || '',
        },
      ],
      'Resumen',
    ),
    'Resumen',
  )

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      data.por_receta.map((r) => ({
        Código: r.receta_code,
        Nombre: r.receta_nombre,
        Cantidad: r.cantidad,
        'Venta (Lps)': r.venta,
        'Teórico (Lps)': r.costo_teorico,
        'Producción (Lps)': r.costo_produccion,
        'Variación (Lps)': r.variacion,
        'Variación %': r.variacion_pct,
        'Margen (Lps)': r.margen,
        'Margen %': r.margen_pct,
        Registros: r.registros,
      })),
      'Por receta',
    ),
    'Por receta',
  )

  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      data.detalle.map((d) => ({
        Factura: d.factura || '',
        'Orden OP': d.orden_produccion || '',
        Fecha: d.fecha || '',
        Periodo: d.periodo || '',
        'Código cliente': d.codigo_cliente,
        Cliente: d.cliente,
        'Código receta': d.receta_code,
        Receta: d.receta_nombre,
        Cantidad: d.cantidad,
        'Venta (Lps)': d.venta,
        'Teórico (Lps)': d.costo_teorico,
        'Costo línea (Lps)': d.costo,
        'Variación (Lps)': d.variacion,
        'Variación %': d.variacion_pct,
        'Margen (Lps)': d.margen,
        'Margen %': d.margen_pct,
      })),
      'Detalle',
    ),
    'Detalle',
  )

  if (data.relacion_venta_op?.length) {
    XLSX.utils.book_append_sheet(
      wb,
      sheetFromRows(
        data.relacion_venta_op.map((r) => ({
          Factura: r.factura,
          'Fecha venta': r.fecha_venta || '',
          Cliente: r.cliente,
          'Código receta': r.receta_code,
          Receta: r.receta_nombre,
          'Venta (Lps)': r.venta,
          'Orden OP': r.orden_produccion,
          'Fecha OP': r.fecha_op || '',
          'Cant. OP': r.cantidad_op,
          'Costo OP (Lps)': r.costo_op,
          Almacén: r.almacen,
          Estado: r.estado_op,
          Cruce: r.match,
        })),
        'Venta-OP',
      ),
      'Venta-OP',
    )
  }

  downloadWorkbook(wb, `BI-Ventas-Margen-${stamp()}.xlsx`)
}
