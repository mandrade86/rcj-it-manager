export type EmpresaDoc = {
  _id: string
  codigo: string
  nombre: string
  descripcion?: string
  color?: string
  activo?: boolean
  /** `empresaId` del EHR cuando `origen === 'ehr'`. */
  ehr_empresa_id?: number
  origen?: 'manual' | 'ehr'
  createdAt?: string
  updatedAt?: string
}
