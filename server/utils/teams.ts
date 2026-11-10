export type TeamsResult = { ok: true } | { ok: false; error: string }

function webhookUrl(): string {
  return (process.env.TEAMS_WEBHOOK_URL ?? '').trim()
}

export function isTeamsConfigured(): boolean {
  return Boolean(webhookUrl())
}

/**
 * Envía un aviso al chat de Teams del usuario a través de un flujo de Power Automate
 * ("When a Teams webhook request is received" → "Post card in a chat or channel" como Flow bot).
 * El flujo lee `destinatario` (UPN/correo) y publica `tarjeta` (Adaptive Card ya serializada,
 * que es lo que espera el campo "Adaptive Card" de la acción).
 */
export async function enviarTeams(opts: {
  destinatario: string
  titulo: string
  mensaje: string
  url?: string
  boton?: string
}): Promise<TeamsResult> {
  const endpoint = webhookUrl()
  if (!endpoint) return { ok: false, error: 'Teams no configurado (TEAMS_WEBHOOK_URL).' }

  const destinatario = opts.destinatario.trim().toLowerCase()
  if (!destinatario || !destinatario.includes('@')) {
    return { ok: false, error: 'Destinatario de Teams inválido.' }
  }

  const card = {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      { type: 'TextBlock', text: 'RCJ IT Manager', size: 'Small', color: 'Accent', weight: 'Bolder' },
      { type: 'TextBlock', text: opts.titulo, size: 'Medium', weight: 'Bolder', wrap: true },
      { type: 'TextBlock', text: opts.mensaje, wrap: true },
    ],
    actions: opts.url
      ? [{ type: 'Action.OpenUrl', title: opts.boton ?? 'Abrir en IT Manager', url: opts.url }]
      : [],
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destinatario,
        titulo: opts.titulo,
        mensaje: opts.mensaje,
        url: opts.url ?? '',
        tarjeta: JSON.stringify(card),
        type: 'message',
        attachments: [
          { contentType: 'application/vnd.microsoft.card.adaptive', contentUrl: null, content: card },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (res.ok) return { ok: true }
    return { ok: false, error: `Teams: HTTP ${res.status} ${res.statusText}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo enviar a Teams' }
  }
}
