import mongoose, { Schema } from 'mongoose'

/** Estados del flujo de un proyecto (workflow). */
export const PROYECTO_ESTADOS = [
  'Idea',
  'Planificado',
  'En revisión',
  'Aprobado',
  'En progreso',
  'Bloqueado',
  'En pausa',
  'Completado',
  'Cancelado',
] as const

/**
 * Cambio en el flujo del proyecto. Se guarda como historial inmutable.
 */
const ProyectoCambioSchema = new Schema(
  {
    fecha: { type: Date, default: Date.now },
    de: { type: String },
    a: { type: String, required: true },
    usuario_id: { type: Schema.Types.ObjectId, ref: 'Usuario' },
    usuario_nombre: { type: String },
    comentario: { type: String },
  },
  { _id: false },
)

const ProyectoSchema = new Schema(
  {
    _id: { type: String, required: true },
    nombre: { type: String, required: true },
    descripcion: { type: String, default: '' },
    /** Eje temático libre (originalmente IT). Ahora puede ser cualquier categoría. */
    eje: { type: String, default: '' },
    fase: { type: Number },
    /**
     * Tipo de proyecto: individual (de un usuario) o departamental (compartido).
     * Permite diferenciar el flujo y la visibilidad.
     */
    tipo: {
      type: String,
      enum: ['individual', 'departamental'],
      default: 'individual',
    },
    /** Usuario propietario / responsable directo del proyecto. */
    usuario_id: { type: Schema.Types.ObjectId, ref: 'Usuario', index: true },
    /** Departamento al que pertenece el proyecto. */
    departamento_id: { type: Schema.Types.ObjectId, ref: 'Departamento', index: true },
    /** Empresas del grupo RCJ involucradas en el proyecto (multiselección). */
    empresa_ids: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Empresa' }],
      default: [],
      index: true,
    },
    /** Nombre libre del responsable (compat, p.ej. proyectos importados). */
    responsable: { type: String },
    fecha_inicio: { type: Date },
    fecha_fin: { type: Date },
    prioridad: {
      type: String,
      enum: ['Alta', 'Media', 'Baja'],
      default: 'Media',
    },
    estado: {
      type: String,
      enum: PROYECTO_ESTADOS,
      default: 'Planificado',
    },
    /** KPI del departamento vinculado a la meta (catálogo /api/kpis). */
    kpi_id: { type: Schema.Types.ObjectId, ref: 'KPI', default: null, index: true },
    /** Meta objetivo (sincronizada con el KPI seleccionado o texto legacy). */
    meta_kpi: { type: String },
    porcentaje_avance: { type: Number, default: 0 },
    notas: { type: String },
    historial: { type: [ProyectoCambioSchema], default: [] },
  },
  { timestamps: true },
)

export const Proyecto =
  mongoose.models.Proyecto ?? mongoose.model('Proyecto', ProyectoSchema)
