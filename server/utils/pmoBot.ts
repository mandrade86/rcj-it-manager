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

function envTrim(key: string): string {
  let v = (process.env[key] ?? '').trim()
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim()
  }
  return v
}

function botAuthConfigured(): boolean {
  return Boolean(envTrim('PMO_BOT_APP_ID') && envTrim('PMO_BOT_APP_PASSWORD'))
}

export function isPmoBotConfigured(): boolean {
  return botAuthConfigured()
}

let adapter: CloudAdapter | null = null

function getAdapter(): CloudAdapter | null {
  if (!botAuthConfigured()) return null
  if (adapter) return adapter

  const appId = envTrim('PMO_BOT_APP_ID')
  const appPassword = envTrim('PMO_BOT_APP_PASSWORD')
  const appType = envTrim('PMO_BOT_APP_TYPE') || 'MultiTenant'
  const tenantId = envTrim('PMO_BOT_TENANT_ID') || undefined

  console.log(
    `[pmo-bot] auth config: appId=${appId.slice(0, 8)}… type=${appType} tenant=${tenantId ? tenantId.slice(0, 8) + '…' : '(none)'}`,
  )

  const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
    MicrosoftAppId: appId,
    MicrosoftAppPassword: appPassword,
    MicrosoftAppType: appType,
    MicrosoftAppTenantId: tenantId,
  })
  const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(
    {
      MicrosoftAppId: appId,
      MicrosoftAppPassword: appPassword,
      MicrosoftAppType: appType,
      MicrosoftAppTenantId: tenantId,
    },
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

async function sendTextoOCard(context: TurnContext, texto: string, href?: string) {
  const channel = (context.activity.channelId || '').toLowerCase()
  // Web Chat del portal Azure a veces renderiza mal Adaptive Cards; texto plano siempre se ve.
  if (channel === 'webchat' || channel === 'emulator' || channel === 'directline') {
    await context.sendActivity(texto)
    if (href) await context.sendActivity(`Portal: ${href}`)
    return
  }
  await context.sendActivity(MessageFactory.attachment(cardRespuesta(texto, href)))
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

  // Permite forzar usuario en pruebas: PMO_BOT_TEST_EMAIL=usuario@rcjcorp.hn
  const testEmail = envTrim('PMO_BOT_TEST_EMAIL').toLowerCase()
  if (testEmail.includes('@')) {
    console.warn(`[pmo-bot] usando PMO_BOT_TEST_EMAIL=${testEmail}`)
    return testEmail
  }
  return null
}

async function handleTurn(context: TurnContext): Promise<void> {
  const channel = context.activity.channelId ?? ''
  console.log(
    `[pmo-bot] turn type=${context.activity.type} channel=${channel} text=${JSON.stringify(context.activity.text ?? '')}`,
  )

  if (context.activity.type === 'conversationUpdate') {
    const members = context.activity.membersAdded ?? []
    for (const m of members) {
      if (m.id !== context.activity.recipient?.id) {
        await sendTextoOCard(
          context,
          'Hola, soy PMO Personal. Escribe ayuda para ver qué puedo hacer con tus proyectos.',
          appPublicUrl(),
        )
      }
    }
    return
  }

  if (context.activity.type !== 'message') return

  const texto = String(context.activity.text ?? '').trim()
  if (!texto) {
    await context.sendActivity('Escribe ayuda para ver los comandos.')
    return
  }

  const email = await resolverEmailTurn(context)
  if (!email) {
    await sendTextoOCard(
      context,
      'Hola desde PMO Personal (Web Chat). Aquí no tengo tu correo de Microsoft 365. En Teams con tu cuenta corporativa sí puedo ver tus proyectos. Escribe ayuda cuando estés en Teams, o define PMO_BOT_TEST_EMAIL en el servidor para pruebas.',
      appPublicUrl(),
    )
    return
  }

  const ctx = await resolverUsuarioPorEmail(email)
  if (!ctx) {
    await sendTextoOCard(
      context,
      `No encontré el usuario ${email} en el portal. Pide a IT que te den acceso a RCJ IT Manager.`,
      appPublicUrl(),
    )
    return
  }
  if (!puedePmoPersonal(ctx.permisos)) {
    await context.sendActivity(
      'Tu usuario no tiene permiso para PMO Personal (pmo:personal o proyectos:ver).',
    )
    return
  }

  const resp = await responderPmo(texto, ctx)
  await sendTextoOCard(context, resp.texto, resp.href)
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
    const authHeader = req.headers.authorization || req.headers['x-authorization']
    if (typeof authHeader === 'string' && authHeader && !req.headers.authorization) {
      req.headers.authorization = authHeader
    }
    const body = req.body as { type?: unknown; channelId?: unknown; text?: unknown } | undefined
    const activityType = body && typeof body === 'object' ? String(body.type ?? '') : ''
    const channelId = body && typeof body === 'object' ? String(body.channelId ?? '') : ''
    const contentLen = req.headers['content-length'] ?? '?'
    console.log(
      `[pmo-bot] POST /api/pmo/messages auth=${Boolean(req.headers.authorization)} type=${activityType || '(vacío)'} channel=${channelId || '-'} content-length=${contentLen}`,
    )
    if (!activityType) {
      res.status(400).json({
        error: 'Falta activity.type. Azure/Teams envían JSON con type (message, conversationUpdate, etc.).',
      })
      return
    }
    await ad.process(req, res, async (context) => {
      await handleTurn(context)
    })
    console.log('[pmo-bot] process OK')
  } catch (err) {
    console.error('[pmo-bot] process falló:', err)
    if (!res.headersSent) {
      const msg = err instanceof Error ? err.message : 'Error del bot'
      const status = /authorization|authenticate|unauthorized|401/i.test(msg)
        ? 401
        : /activity type|invalid request body|BadRequest/i.test(msg)
          ? 400
          : 500
      res.status(status).json({ error: msg })
    }
  }
}
