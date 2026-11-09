/**
 * Envía un mensaje de prueba al chat de Teams de un usuario usando TEAMS_WEBHOOK_URL.
 *
 * Uso:
 *   npm run teams:probar -- marcela.hernandez@rcjcorp.hn
 */
import 'dotenv/config'

import { appPublicUrl } from '../utils/mailer.js'
import { enviarTeams, isTeamsConfigured } from '../utils/teams.js'

const destinatario = (process.argv[2] ?? '').trim()

if (!destinatario || !destinatario.includes('@')) {
  console.error('Indica el correo de Microsoft 365 del destinatario: npm run teams:probar -- usuario@dominio')
  process.exit(1)
}
if (!isTeamsConfigured()) {
  console.error('TEAMS_WEBHOOK_URL no está definida (en .env o en las variables del servicio).')
  process.exit(1)
}

const r = await enviarTeams({
  destinatario,
  titulo: 'Prueba de avisos de RCJ IT Manager',
  mensaje: 'Si ves este mensaje, la integración con Teams está funcionando.',
  url: appPublicUrl(),
  boton: 'Abrir IT Manager',
})

if (r.ok) {
  console.log(`Enviado al flujo para ${destinatario}. Revisa el chat con "Workflows" / "Flow bot" en Teams.`)
} else {
  console.error(`Falló: ${r.error}`)
  process.exit(1)
}
