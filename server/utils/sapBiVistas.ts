/** Vistas fijas RCJ_BI por pestaña del módulo BI. */
export const VISTA_VENTA_COSTO = 'VW_BI_VENTA_COSTO'
export const VISTA_RECETA_COSTO = 'VW_BI_RECETA_COSTO'

/** alias lógico → columna en VW_BI_VENTA_COSTO */
export const CAMPOS_VENTA_COSTO: Record<string, string> = {
  empresa: 'Empresa',
  fecha: 'Fecha',
  periodo: 'Periodo',
  codigo_cliente: 'CardCode',
  cliente: 'CardName',
  grupo_cliente: 'GrupoCliente',
  receta_code: 'RecetaCode',
  receta_nombre: 'RecetaNombre',
  cantidad: 'Cantidad',
  venta: 'Venta',
  costo: 'CostoReal',
  margen: 'Margen',
}

/** alias lógico → columna en VW_BI_RECETA_COSTO */
export const CAMPOS_RECETA_COSTO: Record<string, string> = {
  receta_code: 'RecetaCode',
  receta_nombre: 'RecetaNombre',
  costo: 'CostoTeorico',
  costo_unitario: 'CostoUnitario',
  flag_costo: 'FlagCosto',
  cantidad: 'Cantidad',
}
