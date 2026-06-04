/**
 * Uso: npx tsx server/scripts/lookupColaborador.ts "Joel"
 */
import { connectDb, disconnectDb } from '../db/connection.js'
import { Colaborador } from '../db/models/Colaborador.js'
import { PlanCarrera } from '../db/models/PlanCarrera.js'
import { Evaluacion } from '../db/models/Evaluacion.js'
import { EvaluacionKPI } from '../db/models/EvaluacionKPI.js'
import { PerfilPuesto } from '../db/models/PerfilPuesto.js'

const q = process.argv[2] ?? 'Joel'

async function main() {
  await connectDb()
  const cols = await Colaborador.find({ nombre: new RegExp(q, 'i') }).lean()
  if (cols.length === 0) {
    console.log(JSON.stringify({ found: 0, query: q }))
    return
  }
  const out = []
  for (const c of cols) {
    const id = c._id
    const plan = await PlanCarrera.findOne({ colaborador_id: id }).lean()
    const evals = await Evaluacion.find({ colaborador_id: id }).sort({ fecha: -1 }).lean()
    const evalKpi = await EvaluacionKPI.find({ colaborador_id: id }).sort({ fecha: -1 }).lean()
    const perfil = c.perfil_puesto_id
      ? await PerfilPuesto.findById(c.perfil_puesto_id).lean()
      : null
    out.push({
      colaborador: c,
      perfil,
      plan,
      evaluaciones: evals,
      evaluacionesKpi: evalKpi,
    })
  }
  console.log(JSON.stringify({ found: out.length, query: q, data: out }, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => disconnectDb())
