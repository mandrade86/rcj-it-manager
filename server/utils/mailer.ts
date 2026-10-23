export type MailResult = { ok: true; messageId?: string } | { ok: false; error: string }

function sendgridApiKey(): string {
  return (process.env.SENDGRID_API_KEY ?? process.env.SMTP_PASS ?? '').trim()
}

function mailFrom(): string {
  return (process.env.SENDGRID_FROM ?? process.env.SMTP_FROM ?? '').trim()
}

/** Preferido: SENDGRID_API_KEY + SENDGRID_FROM (o SMTP_FROM). */
export function isMailConfigured(): boolean {
  return Boolean(sendgridApiKey() && mailFrom())
}

function parseFrom(raw: string): { email: string; name?: string } {
  const m = raw.match(/^\s*(?:"?([^"]*)"?\s*)?<([^>]+)>\s*$/)
  if (m) {
    const name = (m[1] ?? '').trim()
    const email = (m[2] ?? '').trim()
    return name ? { email, name } : { email }
  }
  return { email: raw }
}

async function enviarConSendGrid(opts: {
  to: string
  subject: string
  text: string
  html?: string
}): Promise<MailResult> {
  const apiKey = sendgridApiKey()
  const fromRaw = mailFrom()
  if (!apiKey || !fromRaw) {
    return {
      ok: false,
      error: 'Correo no configurado. Define SENDGRID_API_KEY y SENDGRID_FROM en el servidor.',
    }
  }

  const from = parseFrom(fromRaw)
  const content: Array<{ type: string; value: string }> = [
    { type: 'text/plain', value: opts.text },
  ]
  if (opts.html?.trim()) {
    content.push({ type: 'text/html', value: opts.html })
  }

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: opts.to }] }],
        from,
        subject: opts.subject,
        content,
      }),
    })

    if (res.status === 202 || res.ok) {
      return { ok: true, messageId: res.headers.get('x-message-id') ?? undefined }
    }

    let detail = res.statusText
    try {
      const body = (await res.json()) as { errors?: Array<{ message?: string }> }
      detail = body.errors?.[0]?.message ?? detail
    } catch {
      /* ignore */
    }
    return { ok: false, error: `SendGrid: ${detail}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo enviar el correo' }
  }
}

export async function enviarCorreo(opts: {
  to: string
  subject: string
  text: string
  html?: string
}): Promise<MailResult> {
  return enviarConSendGrid(opts)
}

export function generarPasswordTemporal(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = 'RcJ-'
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

export function generarCodigoAcceso(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function appPublicUrl(): string {
  return (process.env.APP_PUBLIC_URL ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
}

export function cuerpoReseteoClave(opts: {
  nombre: string
  email: string
  password?: string
  codigo: string
}): { text: string; html: string } {
  const url = appPublicUrl()
  const pwdLine = opts.password
    ? `Contraseña temporal: ${opts.password}\n`
    : ''
  const text = [
    `Hola ${opts.nombre},`,
    '',
    'Se generó un acceso temporal a RCJ IT Manager.',
    '',
    `Correo: ${opts.email}`,
    pwdLine.trim() ? pwdLine.trim() : null,
    `Código de acceso (válido 24 h): ${opts.codigo}`,
    '',
    `Entra en: ${url}`,
    'Puedes iniciar sesión con la contraseña temporal o con el código de 6 dígitos.',
    'Te recomendamos cambiar la contraseña después de entrar.',
    '',
    'Si no solicitaste este correo, avisa al área de IT.',
  ].filter((l) => l != null).join('\n')

  const html = `
    <p>Hola <strong>${escapeHtml(opts.nombre)}</strong>,</p>
    <p>Se generó un acceso temporal a <strong>RCJ IT Manager</strong>.</p>
    <ul>
      <li>Correo: <code>${escapeHtml(opts.email)}</code></li>
      ${opts.password ? `<li>Contraseña temporal: <code>${escapeHtml(opts.password)}</code></li>` : ''}
      <li>Código de acceso (válido 24 h): <code style="font-size:18px;letter-spacing:2px">${escapeHtml(opts.codigo)}</code></li>
    </ul>
    <p><a href="${escapeHtml(url)}">Abrir IT Manager</a></p>
    <p>Puedes entrar con la contraseña temporal o con el código de 6 dígitos. Te recomendamos cambiar la contraseña después.</p>
    <p style="color:#6b7280;font-size:12px">Si no solicitaste este correo, avisa al área de IT.</p>
  `
  return { text, html }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
