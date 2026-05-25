import mongoose, { Schema } from 'mongoose'

import { META_TIPOS_CALCULO } from '../data/kpiCalculoTipos.js'
const MetaEstrategicaDeptoSchema = new Schema(
  {
    /** Slug único por departamento (ej. continuidad, equipo_it). */
    id: { type: String, required: true },
    titulo: { type: String, default: '' },
    objetivo: { type: String, default: '' },
    valor_objetivo: { type: String, default: '' },
    /** Agregación del avance de KPIs bajo esta meta (promedio, mínimo, máximo). */
    tipo_calculo: {
      type: String,
      enum: META_TIPOS_CALCULO,
      default: 'promedio_kpis',
    },
    activa: { type: Boolean, default: true },
  },
  { _id: false },
)

const DepartamentoSchema = new Schema(
  {
    codigo: { type: String, required: true, unique: true },
    nombre: { type: String, required: true },
    descripcion: { type: String, default: '' },
    color: { type: String, default: '#002060' },
    /** ID departamento en EHR (Depto # en listados de empleados). Único en el catálogo. */
    ehr_departamento_id: { type: Number, sparse: true, unique: true },
    /** ID empresa en EHR (empresaId en Company/list). */
    ehr_empresa_id: { type: Number, default: null, index: true },
    empresa_id: { type: Schema.Types.ObjectId, ref: 'Empresa', default: null },
    /** Catálogo de ejes/categorías de proyectos permitidos para este departamento. */
    ejes_proyecto: { type: [String], default: [] },
    /**
     * Indica si este departamento maneja presupuesto/gastos. Cuando es false,
     * el módulo "Gastos" se oculta del sidebar a sus usuarios y el backend
     * rechaza las consultas a /api/gastos.
     */
    lleva_gastos: { type: Boolean, default: false },
    /**
     * Ruta relativa del archivo Excel de gastos del departamento. Si está vacío,
     * se usa el patrón automático `data/gastos-{codigo}.xlsx` con fallback a
     * `data/gastos.xlsx`.
     */
    archivo_gastos: { type: String, default: '' },
    /** Cinco metas anuales del departamento; los KPIs se vinculan por meta_id. */
    metas_estrategicas: { type: [MetaEstrategicaDeptoSchema], default: [] },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const Departamento =
  mongoose.models.Departamento ?? mongoose.model('Departamento', DepartamentoSchema)
