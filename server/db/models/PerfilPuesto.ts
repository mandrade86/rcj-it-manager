import mongoose, { Schema } from 'mongoose'

/** Criterio individual de la rúbrica de evaluación, embebido en el perfil. */
const RubricaCriterioSchema = new Schema(
  {
    categoria: { type: String, required: true },
    criterio: { type: String, required: true },
    descripcion: { type: String, default: '' },
  },
  { _id: false },
)

/**
 * Definición de un KPI que se utilizará para la evaluación por
 * cumplimiento del colaborador con este perfil. Solo el rol Administrador
 * (permiso `*`) puede crear/modificar esta lista.
 */
const KpiEvaluacionSchema = new Schema(
  {
    kpi_id: { type: Schema.Types.ObjectId, ref: 'KPI', required: true },
    peso: { type: Number, required: true, min: 0, max: 100 },
    descripcion: { type: String, default: '' },
  },
  { _id: false },
)

const PerfilPuestoSchema = new Schema(
  {
    codigo: { type: String, required: true, unique: true },
    titulo: { type: String, required: true },
    departamento_id: { type: Schema.Types.ObjectId, ref: 'Departamento' },
    nivel: { type: String, default: '' },
    reporta_a: { type: String, default: '' },
    objetivo: { type: String, default: '' },
    requisitos: [{ type: String }],
    responsabilidades: [{ type: String }],
    autoridad: [{ type: String }],
    educacion: { type: String, default: '' },
    experiencia: { type: String, default: '' },
    competencias: [{ type: String }],
    /**
     * Indica si el perfil corresponde a una posición de jefatura
     * (tiene personal a cargo). Se usa para sugerir permisos y para
     * identificar puestos gerenciales en organigramas/reportes.
     */
    tiene_personal_a_cargo: { type: Boolean, default: false },
    /**
     * Rúbrica de evaluación específica del perfil. Si está vacía, se intenta
     * resolver por código de puesto (legacy) o se cae a la rúbrica de
     * desarrolladores por defecto.
     */
    rubrica_criterios: { type: [RubricaCriterioSchema], default: [] },
    /**
     * KPIs ponderados que componen la EVALUACIÓN POR CUMPLIMIENTO DE KPI.
     * Solo el rol Administrador puede modificarla (endpoints protegidos).
     * La suma de pesos debe ser 100 (validación en la ruta PUT).
     */
    kpis_evaluacion: { type: [KpiEvaluacionSchema], default: [] },
    notas: { type: String, default: '' },
  },
  { timestamps: true },
)

export const PerfilPuesto =
  mongoose.models.PerfilPuesto ?? mongoose.model('PerfilPuesto', PerfilPuestoSchema)
