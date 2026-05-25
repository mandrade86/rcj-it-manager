export type EstadoVacacion = 'Programado' | 'Aprobado' | 'Gozado' | 'Cancelado'

export type RegistroVacacionDoc = {
  _id: string
  empleado_id: string
  fecha_inicio: string
  fecha_fin: string
  dias_habiles: number
  estado: EstadoVacacion
  notas?: string
  registrado_por?: string | null
  createdAt?: string
  updatedAt?: string
}

export type VacacionesCalculo = {
  fechaIngreso: string | null
  fechaCorte: string
  aniosServicio: number
  mesesServicio: number
  diasDerechoPorAnioActual: number
  diasProporcionalesAnioActual: number
  diasAcumuladosTotales: number
  diasGozados: number
  diasDisponibles: number
  proximoAniversario: string | null
  proximoDerecho: number
}

export type VacacionesEmpleadoResponse = {
  empleado: {
    _id: string
    codigo: string
    nombre: string
    puesto?: string
    activo?: boolean
    fecha_ingreso?: string | null
  }
  calculo: VacacionesCalculo
  registros: RegistroVacacionDoc[]
}

export type VacacionesResumenItem = {
  empleado_id: string
  fecha_ingreso?: string | null
  aniosServicio: number
  diasAcumuladosTotales: number
  diasGozados: number
  diasDisponibles: number
  proximoAniversario: string | null
  proximoDerecho: number
}
