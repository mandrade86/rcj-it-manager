import type { HydratedDocument } from 'mongoose'

import { DeudaTecnica } from '../db/models/DeudaTecnica.js'
import { fetchJiraIssueSnapshots, type JiraIssueSnapshot } from './jiraClient.js'

export type DeudaJiraSyncResult = {
  synced: number
  notFound: string[]
  errors: string[]
  updatedIds: string[]
}

function mapEstadoDesdeJira(category: string, estadoActual: string): string | null {
  if (category === 'done' && estadoActual !== 'resuelta') return 'resuelta'
  if (category === 'indeterminate' && estadoActual === 'abierta') return 'en_progreso'
  return null
}

export async function applyJiraSnapshotToDeuda(
  doc: HydratedDocument<InstanceType<typeof DeudaTecnica>>,
  snap: {
    statusName: string
    statusCategory: string
    assignee: string | null
    updated: string
  },
): Promise<void> {
  doc.jira_status_name = snap.statusName
  doc.jira_status_category = snap.statusCategory
  doc.jira_assignee = snap.assignee ?? ''
  doc.jira_updated_at = snap.updated ? new Date(snap.updated) : undefined
  doc.jira_synced_at = new Date()

  const nuevoEstado = mapEstadoDesdeJira(snap.statusCategory, doc.estado)
  if (nuevoEstado) {
    doc.estado = nuevoEstado as 'abierta' | 'en_progreso' | 'resuelta'
  }
}

/** Sincroniza estado Jira de todas las deudas con issue vinculado (o una por id). */
export async function syncDeudaTecnicaFromJira(deudaId?: string): Promise<DeudaJiraSyncResult> {
  const out: DeudaJiraSyncResult = {
    synced: 0,
    notFound: [],
    errors: [],
    updatedIds: [],
  }

  const filter = deudaId
    ? { _id: deudaId, jira_issue_key: { $exists: true, $ne: '' } }
    : { jira_issue_key: { $exists: true, $ne: '' } }

  const items = await DeudaTecnica.find(filter)
  if (!items.length) return out

  const keys = items.map((i) => i.jira_issue_key).filter(Boolean) as string[]
  let snapshots: Map<string, JiraIssueSnapshot>

  try {
    snapshots = await fetchJiraIssueSnapshots(keys)
  } catch (e) {
    out.errors.push(e instanceof Error ? e.message : 'Error consultando Jira')
    return out
  }

  for (const item of items) {
    const key = item.jira_issue_key
    if (!key) continue
    const snap = snapshots.get(key)
    if (!snap) {
      out.notFound.push(key)
      continue
    }
    try {
      await applyJiraSnapshotToDeuda(item, snap)
      await item.save()
      out.synced += 1
      out.updatedIds.push(String(item._id))
    } catch (e) {
      out.errors.push(`${key}: ${e instanceof Error ? e.message : 'Error guardando'}`)
    }
  }

  return out
}

export function buildJiraStatusResumen(
  items: { jira_status_name?: string; jira_status_category?: string; jira_issue_key?: string }[],
) {
  const linked = items.filter((i) => i.jira_issue_key)
  const byCategory = { todo: 0, in_progress: 0, done: 0, other: 0, sin_sync: 0 }
  const byStatusName = new Map<string, number>()

  for (const i of linked) {
    const cat = i.jira_status_category
    if (!i.jira_status_name) {
      byCategory.sin_sync += 1
      continue
    }
    const name = i.jira_status_name
    byStatusName.set(name, (byStatusName.get(name) ?? 0) + 1)
    if (cat === 'new') byCategory.todo += 1
    else if (cat === 'indeterminate') byCategory.in_progress += 1
    else if (cat === 'done') byCategory.done += 1
    else byCategory.other += 1
  }

  return {
    total_vinculados: linked.length,
    por_categoria: byCategory,
    por_nombre: [...byStatusName.entries()].map(([nombre, count]) => ({ nombre, count })),
  }
}
