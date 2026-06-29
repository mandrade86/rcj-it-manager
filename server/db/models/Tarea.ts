import mongoose, { Schema } from 'mongoose'

/**
 * Archivo adjunto de una tarea. Se guarda físicamente en `data/adjuntos-tareas/`
 * y se referencia desde aquí.
 */
const AdjuntoTareaSchema = new Schema(
  {
    nombre_original: { type: String, required: true },
    archivo: { type: String, required: true }, // nombre del archivo en disco
    mime_type: { type: String, default: '' },
    size_bytes: { type: Number, default: 0 },
    subido_por: { type: String, default: '' },
    subido_en: { type: Date, default: Date.now },
  },
  { _id: true },
)

const ComentarioTareaSchema = new Schema(
  {
    texto: { type: String, required: true },
    autor: { type: String, default: '' },
    autor_id: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
  },
  { timestamps: true },
)

const TareaSchema = new Schema(
  {
    proyecto_id: { type: String, ref: 'Proyecto', required: true },
    nombre: { type: String, required: true },
    descripcion: { type: String },
    /** Nombre del responsable (texto). Se mantiene por compatibilidad. */
    responsable: { type: String },
    /** Referencia al empleado responsable (opcional, fuente de verdad). */
    responsable_id: { type: Schema.Types.ObjectId, ref: 'Empleado', default: null },
    fecha_inicio: { type: Date },
    fecha_fin: { type: Date },
    estado: {
      type: String,
      enum: ['Pendiente', 'En progreso', 'Completado', 'Bloqueado'],
      default: 'Pendiente',
    },
    porcentaje: { type: Number, default: 0 },
    eje: { type: String },
    /** Archivos adjuntos (evidencia, anexos, etc.). */
    adjuntos: { type: [AdjuntoTareaSchema], default: [] },
    /** Tareas que deben completarse antes de iniciar esta (predecesoras). */
    depende_de_ids: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Tarea' }],
      default: [],
    },
    /** Comentarios de seguimiento (bitácora de la tarea). */
    comentarios: { type: [ComentarioTareaSchema], default: [] },
    /** Etiquetas libres para clasificar y filtrar tareas. */
    tags: { type: [String], default: [] },
  },
  { timestamps: true },
)

export const Tarea = mongoose.models.Tarea ?? mongoose.model('Tarea', TareaSchema)
