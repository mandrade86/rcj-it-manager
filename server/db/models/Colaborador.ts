import mongoose, { Schema } from 'mongoose'

const ColaboradorSchema = new Schema(
  {
    codigo: { type: String, required: true, unique: true },
    nombre: { type: String, required: true },
    puesto: { type: String, required: true },
    codigo_puesto: { type: String, required: true },
    departamento_id: { type: Schema.Types.ObjectId, ref: 'Departamento' },
    perfil_puesto_id: { type: Schema.Types.ObjectId, ref: 'PerfilPuesto' },
    /** Vínculo opcional con el maestro de empleados (1:1). */
    empleado_id: { type: Schema.Types.ObjectId, ref: 'Empleado', default: null, index: true },
    frente: { type: String, required: true },
    nivel: { type: String, default: null },
    fecha_ingreso: { type: Date },
    estado: {
      type: String,
      enum: ['Activo', 'Por contratar', 'Futuro'],
      default: 'Activo',
    },
    salario_mensual: { type: Number },
    notas: { type: String },
  },
  { timestamps: true },
)

export const Colaborador =
  mongoose.models.Colaborador ?? mongoose.model('Colaborador', ColaboradorSchema)
