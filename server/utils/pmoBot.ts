import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  ConfigurationServiceClientCredentialFactory,
  CardFactory,
  MessageFactory,
  TeamsInfo,
  TurnContext,
} from 'botbuilder'
import type { Request, Response } from 'express'

import { resolverUsuarioPorEmail } from './pmoAuth.js'
import { responderPmo } from './pmoIntents.js'
import { puedePmoPersonal } from './pmoPermisos.js'
import { appPublicUrl } from './mailer.js'

function botAuthConfigured(): boolean {
  return Boolean((process.env.PMO_BOT_APP_ID ?? '').trim() && (process.env.PMO_BOT_APP_PASSWORD ?? '').trim())
}

export function isPmoBotConfigured(): boolean {
  return botAuthConfigured()
}

let adapter: CloudAdapter | null = null

function getAdapter(): CloudAdapter | null {
  if (!botAuthConfigured()) return null
  if (adapter) return adapter
  const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
    MicrosoftAppId: process.env.PMO_BOT_APP_ID,
    MicrosoftAppPassword: process.env.PMO_BOT_APP_PASSWORD,
    MicrosoftAppType: process.env.PMO_BOT_APP_TYPE || 'MultiTenant',
    MicrosoftAppTenantId: process.env.PMO_BOT_TENANT_ID || undefined,
  })
  const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(
    {},
    credentialsFactory,
  )
  adapter = new CloudAdapter(botFrameworkAuthentication)
  adapter.onTurnError = async (context, error) => {
    console.error('[pmo-bot] onTurnError:', error)
    try {
      await context.sendActivity('PMO Personal tuvo un error interno. Intenta de nuevo en un momento.')
    } catch {
      /* ignore */
    }
  }
  return adapter
}

function cardRespuesta(texto: string, href?: string) {
  const body: Array<Record<string, unknown>> = [
    { type: 'TextBlock', text: 'PMO Personal', size: 'Small', weight: 'Bolder', color: 'Accent' },
    { type: 'TextBlock', text: texto, wrap: true },
  ]
  const actions = [
    { type: 'Action.OpenUrl', title: href ? 'Abrir en el portal' : 'Abrir portal', url: href || appPublicUrl() },
  ]
  return CardFactory.adaptiveCard({
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
    body,
    actions,
  })
}

async function resolverEmailTurn(context: TurnContext): Promise<string | null> {
  try {
    const fromId = context.activity.from?.id
    if (fromId) {
      const member = await TeamsInfo.getMember(context, fromId)
      const mail = (member.email || member.userPrincipalName || '').trim().toLowerCase()
      if (mail.includes('@')) return mail
    }
  } catch (e) {
    console.warn('[pmo-bot] TeamsInfo.getMember:', e instanceof Error ? e.message : e)
  }

  const name = (context.activity.from?.name || '').trim().toLowerCase()
  if (name.includes('@')) return name
  return null
}

async function handleTurn(context: TurnContext): Promise<void> {
  if (context.activity.type === 'conversationUpdate') {
    const members = context.activity.membersAdded ?? []
    for (const m of members) {
      if (m.id !== context.activity.recipient?.id) {
        await context.sendActivity(
          MessageFactory.attachment(
            cardRespuesta(
              'Hola, soy **PMO Personal**. Escribe `ayuda` para ver qué puedo hacer con tus proyectos.',
              appPublicUrl(),
            ),
          ),
        )
      }
    }
    return
  }

  if (context.activity.type !== 'message') return

  const texto = String(context.activity.text ?? '').trim()
  if (!texto) {
    await context.sendActivity('Escribe `ayuda` para ver los comandos.')
    return
  }

  const email = await resolverEmailTurn(context)
  if (!email) {
    await context.sendActivity(
      MessageFactory.attachment(
        cardRespuesta(
          'No pude identificar tu correo de Microsoft 365. Chatea desde tu cuenta corporativa vinculada al portal.',
          appPublicUrl(),
        ),
      ),
    )
    return
  }

  const ctx = await resolverUsuarioPorEmail(email)
  if (!ctx) {
    await context.sendActivity(
      MessageFactory.attachment(
        cardRespuesta(
          `No encontré el usuario \`${email}\` en el portal. Pide a IT que te den acceso a RCJ IT Manager.`,
          appPublicUrl(),
        ),
      ),
    )
    return
  }
  if (!puedePmoPersonal(ctx.permisos)) {
    await context.sendActivity(
      'Tu usuario no tiene permiso para PMO Personal (`pmo:personal` o `proyectos:ver`).',
    )
    return
  }

  const resp = await responderPmo(texto, ctx)
  await context.sendActivity(MessageFactory.attachment(cardRespuesta(resp.texto, resp.href)))
}

/** Handler Express para POST /api/pmo/messages (Bot Framework). */
export async function handlePmoBotMessages(req: Request, res: Response): Promise<void> {
  const ad = getAdapter()
  if (!ad) {
    res.status(503).json({
      error: 'PMO bot no configurado. Define PMO_BOT_APP_ID y PMO_BOT_APP_PASSWORD en el .env.',
    })
    return
  }
  try {
    // Express normaliza headers a minúsculas. Si IIS/ARR quita Authorization, auth=false.
    const authHeader = req.headers.authorization || req.headers['x-authorization']
    if (typeof authHeader === 'string' && authHeader && !req.headers.authorization) {
      req.headers.authorization = authHeader
    }
    const headerNames = Object.keys(req.headers).sort().join(',')
    console.log(
      `[pmo-bot] POST /api/pmo/messages auth=${Boolean(req.headers.authorization)} content-type=${req.headers['content-type'] ?? ''} headers=${headerNames}`,
    )
    await ad.process(req, res, async (context) => {
      await handleTurn(context)
    })
  } catch (err) {
    console.error('[pmo-bot] process falló:', err)
    if (!res.headersSent) {
      const msg = err instanceof Error ? err.message : 'Error del bot'
      // Sin Authorization de Bot Framework es normal que falle la validación.
      const status = /authorization|authenticate|unauthorized|401/i.test(msg) ? 401 : 500
      res.status(status).json({ error: msg })
    }
  }
}
