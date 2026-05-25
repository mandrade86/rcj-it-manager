export type JiraConfig = {
  enabled: boolean
  baseUrl: string
  email: string
  apiToken: string
  projectKey: string
  issueType: string
}

export function getJiraConfig(): JiraConfig & { enabled: boolean } {
  const baseUrl = (process.env.JIRA_BASE_URL ?? '').replace(/\/$/, '')
  const email = process.env.JIRA_EMAIL ?? ''
  const apiToken = process.env.JIRA_API_TOKEN ?? ''
  const projectKey = process.env.JIRA_PROJECT_KEY ?? 'IT'
  const issueType = process.env.JIRA_ISSUE_TYPE ?? 'Task'
  const enabled = Boolean(baseUrl && email && apiToken && projectKey)
  return { enabled, baseUrl, email, apiToken, projectKey, issueType }
}

type AdfDoc = {
  type: 'doc'
  version: 1
  content: unknown[]
}

export function buildJiraAdf(sections: {
  heading?: string
  text?: string
  bullets?: string[]
}[]): AdfDoc {
  const content: unknown[] = []
  for (const s of sections) {
    if (s.heading) {
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: s.heading }],
      })
    }
    if (s.text) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: s.text }],
      })
    }
    if (s.bullets?.length) {
      content.push({
        type: 'bulletList',
        content: s.bullets.map((b) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: b }] }],
        })),
      })
    }
  }
  return { type: 'doc', version: 1, content }
}

const PRIORIDAD_JIRA: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export type CreateJiraIssueInput = {
  summary: string
  descriptionAdf: AdfDoc
  labels?: string[]
  priorityName?: string
}

export type CreateJiraIssueResult = {
  key: string
  id: string
  url: string
}

export async function createJiraIssue(input: CreateJiraIssueInput): Promise<CreateJiraIssueResult> {
  const cfg = getJiraConfig()
  if (!cfg.enabled) {
    throw new Error('Jira no está configurado. Define JIRA_BASE_URL, JIRA_EMAIL y JIRA_API_TOKEN en .env')
  }

  const fields: Record<string, unknown> = {
    project: { key: cfg.projectKey },
    summary: input.summary.slice(0, 255),
    issuetype: { name: cfg.issueType },
    description: input.descriptionAdf,
    labels: (input.labels ?? []).map((l) => l.replace(/\s+/g, '-').slice(0, 50)).filter(Boolean),
  }

  if (input.priorityName) {
    fields.priority = { name: input.priorityName }
  }

  const auth = Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString('base64')
  const res = await fetch(`${cfg.baseUrl}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const err = (await res.json()) as { errorMessages?: string[]; errors?: Record<string, string> }
      detail =
        err.errorMessages?.join('; ') ??
        Object.entries(err.errors ?? {})
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ') ??
        detail
    } catch {
      /* ignore */
    }
    throw new Error(`Jira respondió ${res.status}: ${detail}`)
  }

  const data = (await res.json()) as { key: string; id: string }
  return {
    key: data.key,
    id: data.id,
    url: `${cfg.baseUrl}/browse/${data.key}`,
  }
}

export function prioridadJiraDesdeSeveridad(severidad: string): string | undefined {
  return PRIORIDAD_JIRA[severidad]
}

export type JiraIssueSnapshot = {
  key: string
  statusName: string
  statusCategory: string
  assignee: string | null
  updated: string
}

function jiraAuthHeaders(cfg: JiraConfig): Record<string, string> {
  const auth = Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString('base64')
  return {
    Authorization: `Basic ${auth}`,
    Accept: 'application/json',
  }
}

/** Consulta estado de varios issues en una sola búsqueda JQL. */
export async function fetchJiraIssueSnapshots(
  keys: string[],
): Promise<Map<string, JiraIssueSnapshot>> {
  const result = new Map<string, JiraIssueSnapshot>()
  const unique = [...new Set(keys.map((k) => k.trim()).filter(Boolean))]
  if (!unique.length) return result

  const cfg = getJiraConfig()
  if (!cfg.enabled) {
    throw new Error('Jira no está configurado')
  }

  const chunkSize = 50
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const jql = `key in (${chunk.join(',')})`
    const url = new URL(`${cfg.baseUrl}/rest/api/3/search`)
    url.searchParams.set('jql', jql)
    url.searchParams.set('maxResults', String(chunk.length))
    url.searchParams.set('fields', 'status,assignee,updated')

    const res = await fetch(url.toString(), { headers: jiraAuthHeaders(cfg) })
    if (!res.ok) {
      let detail = res.statusText
      try {
        const err = (await res.json()) as { errorMessages?: string[] }
        detail = err.errorMessages?.join('; ') ?? detail
      } catch {
        /* ignore */
      }
      throw new Error(`Jira search ${res.status}: ${detail}`)
    }

    const data = (await res.json()) as {
      issues?: {
        key: string
        fields?: {
          status?: { name?: string; statusCategory?: { key?: string } }
          assignee?: { displayName?: string } | null
          updated?: string
        }
      }[]
    }

    for (const issue of data.issues ?? []) {
      const st = issue.fields?.status
      result.set(issue.key, {
        key: issue.key,
        statusName: st?.name ?? 'Desconocido',
        statusCategory: st?.statusCategory?.key ?? '',
        assignee: issue.fields?.assignee?.displayName ?? null,
        updated: issue.fields?.updated ?? '',
      })
    }
  }

  return result
}

export async function fetchJiraIssueSnapshot(key: string): Promise<JiraIssueSnapshot | null> {
  const map = await fetchJiraIssueSnapshots([key])
  return map.get(key) ?? null
}
