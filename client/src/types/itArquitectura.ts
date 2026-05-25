export interface SistemaIT {
  _id: string
  nombre: string
  descripcion: string
  estado: 'stable' | 'warning' | 'legacy'
  stack: string
  integraciones: string
  responsable: string
  notas: string
  tags: string[]
  orden: number
  activo: boolean
  createdAt?: string
  updatedAt?: string
}

export interface DeudaTecnica {
  _id: string
  titulo: string
  sistema: string
  severidad: 'high' | 'medium' | 'low'
  riesgo: string
  descripcion: string
  urgencia: number
  estado: 'abierta' | 'en_progreso' | 'resuelta'
  responsable: string
  trimestre_roadmap: string
  fecha_estimada_resolucion?: string
  creado_por_nombre?: string
  jira_issue_key?: string
  jira_issue_url?: string
  jira_issue_id?: string
  jira_created_at?: string
  jira_status_name?: string
  jira_status_category?: string
  jira_assignee?: string
  jira_updated_at?: string
  jira_synced_at?: string
  createdAt?: string
}

export type JiraStatusResumen = {
  total_vinculados: number
  por_categoria: {
    todo: number
    in_progress: number
    done: number
    other: number
    sin_sync: number
  }
  por_nombre: { nombre: string; count: number }[]
}

export type JiraConfigIT = {
  enabled: boolean
  baseUrl: string | null
  projectKey: string
  issueType: string
}

export type DeudaJiraSugerencia = {
  summary: string
  que_hacer: string[]
  que_aplicar: string[]
  labels: string[]
  prioridad: string | null
  descripcion_preview: string
}

export interface ApiEndpointIT {
  _id: string
  grupo: string
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  descripcion: string
  version: string
  notas: string
  activo: boolean
  orden: number
}

export interface ChecklistItemIT {
  _id: string
  categoria: string
  texto: string
  orden: number
  activo: boolean
}
