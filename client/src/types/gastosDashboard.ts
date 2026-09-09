export type SemafaroEstado = 'controlado' | 'atencion' | 'critico'

export type GastoItFila = {
  row_hash: string
  fecha: string | null
  mes: string
  anio: number | null
  monto: number
  descripcion: string
  proveedor: string
  documento: string
  cuenta: string
  empresa: string
  departamento: string
  categoria_id: string
  subcategoria_id: string
  categoria: string
  subcategoria: string
  tipo_gasto: 'recurrente' | 'no_recurrente' | 'extraordinario' | 'por_determinar'
  fuente_clasificacion: string
  confianza: number
}

export type GastosItCategoria = {
  id: string
  nombre: string
  activo: boolean
  subcategorias: Array<{ id: string; nombre: string; activo: boolean }>
}

export type GastosDashboard = {
  moneda: 'USD'
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
  por_tipo: Array<{ tipo: string; monto: number; pct: number; transacciones: number }>
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
  filas: GastoItFila[]
  empresas: string[]
  categorias: GastosItCategoria[]
  vista: string
  ultimo_sync: string | null
  aviso?: string | null
}
