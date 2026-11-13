import mongoose, { Schema } from 'mongoose'

const FormSchema = new Schema(
  {
    formId: String,
    template: String,
    systemName: String,
    ownerEmail: String,
    ownerName: String,
  },
  { _id: false },
)

const ServicioEticketSchema = new Schema(
  {
    externalId: { type: String, required: true, unique: true, index: true },
    ticketNumber: { type: String, default: '', index: true },
    source: { type: String, default: 'eticket' },
    sourceUrl: { type: String, default: '' },
    type: { type: String, default: 'desarrollo' },
    title: { type: String, required: true },
    descriptionHtml: { type: String, default: '' },
    descriptionText: { type: String, default: '' },
    status: { type: String, default: '' },
    priority: { type: String, default: 'medium' },
    system: { type: String, default: '' },
    department: { type: String, default: '' },
    requesterEmail: { type: String, default: '' },
    requesterName: { type: String, default: '' },
    assigneeEmail: { type: String, default: '' },
    tags: { type: [String], default: [] },
    authorizationStatus: { type: String, default: null },
    developmentAdminApproval: { type: String, default: null },
    form: { type: FormSchema, default: null },
    eticketCreatedAt: { type: Date },
    eticketUpdatedAt: { type: Date },
    markedAt: { type: Date },
    markedBy: { type: String, default: '' },
    importStatus: {
      type: String,
      enum: ['pending', 'imported'],
      default: 'imported',
    },
    importedAt: { type: Date },
    importedBy: { type: String, default: 'it-rcj-manager' },
    raw: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
)

export const ServicioEticket =
  mongoose.models.ServicioEticket ??
  mongoose.model('ServicioEticket', ServicioEticketSchema)
