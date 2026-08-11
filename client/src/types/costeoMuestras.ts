export type SapBiColumnMapping = {
  cliente: string
  codigo_cliente?: string
  muestra?: string
  descripcion?: string
  costo: string
  cantidad?: string
  fecha?: string
  moneda?: string
}

export type SapBiCosteoConfig = {
  driver: 'mssql' | 'hana'
  host: string
  port: number
  database: string
  schema: string
  viewName: string
  username: string
  hasPassword: boolean
  configured: boolean
  encrypt: boolean
  trustServerCertificate: boolean
  columnMapping: SapBiColumnMapping
  ultimo_sync?: string | null
}

export type CosteoPorCliente = {
  cliente: string
  codigo_cliente: string
  costo: number
  cantidad_muestras: number
  registros: number
}

export type CosteoMuestraDetalle = {
  cliente: string
  codigo_cliente: string
  muestra: string
  descripcion: string
  costo: number
  cantidad: number
  fecha: string | null
  moneda: string
}

export type CosteoMuestrasPayload = {
  resumen: {
    total_costo: number
    total_muestras: number
    total_clientes: number
    total_registros: number
    moneda: string
  }
  por_cliente: CosteoPorCliente[]
  detalle: CosteoMuestraDetalle[]
  ultimo_sync: string | null
  vista: string
  filas_leidas: number
}

export type CosteoUltimoSync = {
  fecha: string | null
  vista: string
  configured: boolean
}
