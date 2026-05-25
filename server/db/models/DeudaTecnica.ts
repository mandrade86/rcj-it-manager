import mongoose, { Schema } from 'mongoose'

export const DEUDA_SEVERIDADES = ['high', 'medium', 'low'] as const
export const DEUDA_ESTADOS = ['abierta', 'en_progreso', 'resuelta'] as const

const DeudaTecnicaSchema = new Schema(
  {
    titulo: { type: String, required: true },
    sistema: { type: String, required: true },
    severidad: { type: String, enum: DEUDA_SEVERIDADES, default: 'medium' },
    riesgo: { type: String, default: '' },
    descripcion: { type: String, default: '' },
    urgencia: { type: Number, default: 50, min: 0, max: 100 },
    estado: { type: String, enum: DEUDA_ESTADOS, default: 'abierta' },
    responsable: { type: String, default: '' },
    trimestre_roadmap: { type: String, default: '' },
    fecha_estimada_resolucion: { type: Date },
    creado_por_id: { type: Schema.Types.ObjectId, ref: 'Usuario' },
    creado_por_nombre: { type: String },
    jira_issue_key: { type: String, default: '' },
    jira_issue_url: { type: String, default: '' },
    jira_issue_id: { type: String, default: '' },
    jira_created_at: { type: Date },
    jira_status_name: { type: String, default: '' },
    jira_status_category: { type: String, default: '' },
    jira_assignee: { type: String, default: '' },
    jira_updated_at: { type: Date },
    jira_synced_at: { type: Date },
  },
  { timestamps: true },
)

export const DeudaTecnica =
  mongoose.models.DeudaTecnica ?? mongoose.model('DeudaTecnica', DeudaTecnicaSchema)
