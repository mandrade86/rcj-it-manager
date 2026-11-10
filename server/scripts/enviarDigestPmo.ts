/**
 * Envía digests PMO Personal (misma lógica que POST /api/pmo/digest/enviar).
 *
 * Uso:
 *   npm run pmo:digest
 */
import 'dotenv/config'

import { connectDb } from '../db/connection.js'
import { enviarDigestsPmo } from '../utils/pmoDigest.js'
import { isTeamsConfigured } from '../utils/teams.js'

if (!isTeamsConfigured()) {
  console.error('TEAMS_WEBHOOK_URL no está definida.')
  process.exit(1)
}

await connectDb()
const r = await enviarDigestsPmo()
console.log(JSON.stringify(r, null, 2))
process.exit(0)
