export type CategoriaOpex = {
  nombre: string
  meses: Record<string, number>
  total: number
  meta20: number
}

export type GastosContexto = {
  departamento_id: string
  departamento_codigo: string
  departamento_nombre: string
  archivoRelativo: string
}

export type GastosOpexPayload = {
  archivo: string
  archivoExiste: boolean
  hoja?: string
  periodos: string[]
  categorias: CategoriaOpex[]
  totalAnual: number
  meta20: number
  ahorroProyectado: number
  advertencia?: string
  contexto?: GastosContexto
}

export type GastosUltimoSync = {
  fecha: string | null
  archivo: string
  contexto?: GastosContexto
}

export type GastosDepartamentoOpcion = {
  _id: string
  codigo: string
  nombre: string
  archivoRelativo: string
}

// ─── Tipos del análisis financiero (Query1) ───────────────────────────────────

export type FilaFinanciera = {
  ano:         number | null
  mes:         number | null
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
  mes:    number
  mesNombre: string
  porAno: { ano: string; capex: number; opex: number; total: number }[]
}

export type AhorroAnual = {
  anoActual:    string
  anoRef:       string
  opexRef:      number
  opexActual:   number
  ahorro:       number
  pctAhorro:    number
  porCategoria: {
    categoria:  string
    opexRef:    number
    opexActual: number
    ahorro:     number
    pctAhorro:  number
  }[]
}

export type GastosFinancieroPayload = {
  archivo:   string
  archivoExiste: boolean
  hoja:      string
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
  mensual:         DatoMensual[]
  ahorroAnual:     AhorroAnual[]
  filas:           FilaFinanciera[]
  advertencia?:    string
  contexto?:       GastosContexto
}
