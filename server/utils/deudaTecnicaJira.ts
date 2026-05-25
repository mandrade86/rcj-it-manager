import { buildJiraAdf, prioridadJiraDesdeSeveridad, type CreateJiraIssueInput } from './jiraClient.js'

export type DeudaJiraSugerencia = {
  summary: string
  que_hacer: string[]
  que_aplicar: string[]
  labels: string[]
  prioridad: string | null
  descripcion_preview: string
  createPayload: CreateJiraIssueInput
}

type DeudaLike = {
  _id?: unknown
  titulo: string
  sistema: string
  severidad: string
  riesgo?: string
  descripcion?: string
  urgencia?: number
  trimestre_roadmap?: string
  responsable?: string
  estado: string
}

const SEVERIDAD_LABEL: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
}

const ESTADO_LABEL: Record<string, string> = {
  abierta: 'Abierta',
  en_progreso: 'En progreso',
  resuelta: 'Resuelta',
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
}

function matchAny(text: string, patterns: string[]): boolean {
  const t = norm(text)
  return patterns.some((p) => t.includes(norm(p)))
}

function pasosPorSistema(sistema: string, titulo: string, descripcion: string): string[] {
  const ctx = `${sistema} ${titulo} ${descripcion}`
  if (matchAny(ctx, ['eproc', 'procurement', 'compra'])) {
    return [
      'Inventariar endpoints y reglas de negocio hoy en controllers.',
      'Extraer lógica a services + DTOs con class-validator.',
      'Enrutar integraciones SAP por la capa de integración RCJ (Service Layer).',
      'Agregar pruebas unitarias en flujos de aprobación y órdenes de compra.',
      'Documentar contrato API en Swagger del hub de integración.',
    ]
  }
  if (matchAny(ctx, ['ecash', 'cash', 'cierre', 'banco'])) {
    return [
      'Mapear flujos de cierre y conciliación actuales (manual vs automático).',
      'Definir transacciones que deben escribirse en SAP vía Service Layer.',
      'Implementar tabla de auditoría (quién, cuándo, monto, documento SAP).',
      'Completar validaciones y estados faltantes en UI.',
      'Prueba de punta a punta con ambiente SAP de pruebas.',
    ]
  }
  if (matchAny(ctx, ['elab', 'laboratorio', 'log'])) {
    return [
      'Reemplazar console.log por Winston con niveles y correlation-id.',
      'Centralizar configuración de logs (rotación, retención).',
      'Definir alertas mínimas en errores 5xx del API.',
      'Revisar lecturas a maestros SAP solo vía hub (no conexión directa).',
    ]
  }
  if (matchAny(ctx, ['eticket', 'ticket', 'nest'])) {
    return [
      'Usar eTickets como plantilla: módulos, guards, interceptors.',
      'Verificar SSO con Active Directory en login.',
      'Revisar almacenamiento de adjuntos (file server / Azure Files).',
      'Alinear manejo de errores y logs con estándar NestJS del área.',
    ]
  }
  if (matchAny(ctx, ['sap', 'service layer', 'hana', 'erp', 'integracion'])) {
    return [
      'Catalogar endpoints Service Layer usados por cada portal.',
      'Crear usuario técnico de integración por ambiente (DEV/QA/PROD).',
      'Estandarizar reintentos, timeout y manejo de errores OData.',
      'Registrar auditoría de escrituras financieras en el hub RCJ.',
      'Publicar matriz de impacto ante cambios de maestros SAP.',
    ]
  }
  if (matchAny(ctx, ['active directory', 'ad ', 'sso', 'identidad', 'entra', 'ldap'])) {
    return [
      'Inventariar aplicaciones con login local vs AD.',
      'Definir flujo SSO (LDAP bind o OIDC vía Entra) en capa de integración.',
      'Migrar usuarios de prueba y validar grupos de seguridad.',
      'Documentar mapeo rol AD → permisos en cada portal.',
      'Plan de rollback y ventana de cambio con IT Infra.',
    ]
  }
  if (matchAny(ctx, ['iis', 'legacy', 'windows', 'migr'])) {
    return [
      'Listar aplicaciones hospedadas en IIS y dependencias (.NET, COM).',
      'Empaquetar en contenedor o despliegue Linux + Nginx según stack.',
      'Pruebas de regresión funcionales con dueño de negocio.',
      'Plan de corte DNS y rollback documentado.',
    ]
  }
  if (matchAny(ctx, ['ci/cd', 'devops', 'deploy', 'pipeline'])) {
    return [
      'Seleccionar repositorio piloto (recomendado: eTickets).',
      'Pipeline: lint → test → build → deploy a ambiente QA.',
      'Secretos en vault / variables de pipeline (no en repo).',
      'Gate de aprobación manual a producción.',
    ]
  }
  if (matchAny(ctx, ['swagger', 'document', 'api'])) {
    return [
      'Generar OpenAPI desde NestJS (@nestjs/swagger) en cada API.',
      'Publicar catálogo en portal interno o repositorio docs.',
      'Vincular endpoints del módulo Arquitectura IT con código real.',
    ]
  }
  return [
    'Analizar causa raíz y alcance con dueño del sistema.',
    'Definir criterios de aceptación medibles.',
    'Implementar en rama feature y revisión de pares.',
    'Desplegar en QA y validar con usuario clave.',
    'Actualizar documentación en Arquitectura IT y cerrar ítem.',
  ]
}

function aplicarPorRiesgoYSistema(riesgo: string, sistema: string, severidad: string): string[] {
  const base = [
    'Checklist Dev (módulo Arquitectura IT): seguridad, BD, integraciones.',
    'Patrón NestJS: Services + DTOs + manejo centralizado de errores.',
    'Variables en .env; sin credenciales en código.',
  ]
  const extra: string[] = []

  if (matchAny(riesgo, ['seguridad', 'security'])) {
    extra.push(
      'Validar inputs (class-validator), CORS restrictivo, rate limiting en APIs públicas.',
      'Revisión de permisos por rol y principio de mínimo privilegio en AD.',
    )
  }
  if (matchAny(riesgo, ['mantenibilidad', 'onboarding', 'calidad'])) {
    extra.push(
      'Swagger/OpenAPI actualizado; README de módulo con diagrama de flujo.',
      'Cobertura mínima de tests en lógica crítica (>60% en services).',
    )
  }
  if (matchAny(riesgo, ['operacional', 'monitoreo'])) {
    extra.push(
      'Logs estructurados (Winston) + health check /api/v1/integracion/health.',
      'Runbook de incidentes vinculado en descripción del ticket.',
    )
  }
  if (matchAny(sistema, ['sap', 'hana', 'b1'])) {
    extra.push(
      'Solo Service Layer para lectura/escritura SAP; usuario técnico dedicado.',
      'No usar DI API desde portales web.',
    )
  }
  if (severidad === 'high') {
    extra.push('Priorizar en sprint actual; daily de seguimiento hasta mitigar riesgo.')
  }
  return [...base, ...extra]
}

function labelsFor(deuda: DeudaLike): string[] {
  const labels = ['tech-debt', 'rcj-it-manager']
  const sis = norm(deuda.sistema).replace(/[^a-z0-9]+/g, '-').slice(0, 20)
  if (sis) labels.push(`sistema-${sis}`)
  if (deuda.severidad === 'high') labels.push('severidad-alta')
  if (deuda.trimestre_roadmap) {
    const q = deuda.trimestre_roadmap.replace(/\s+/g, '-').toLowerCase()
    labels.push(q)
  }
  return labels.slice(0, 10)
}

export function buildDeudaJiraSugerencia(deuda: DeudaLike): DeudaJiraSugerencia {
  const que_hacer = pasosPorSistema(deuda.sistema, deuda.titulo, deuda.descripcion ?? '')
  const que_aplicar = aplicarPorRiesgoYSistema(
    deuda.riesgo ?? '',
    deuda.sistema,
    deuda.severidad ?? 'medium',
  )

  const summary = `[Deuda técnica] ${deuda.titulo}`.slice(0, 240)

  const contexto = [
    deuda.descripcion?.trim() || 'Sin descripción adicional en RCJ IT Manager.',
    '',
    `Sistema: ${deuda.sistema}`,
    `Severidad: ${SEVERIDAD_LABEL[deuda.severidad] ?? deuda.severidad}`,
    `Riesgo: ${deuda.riesgo || '—'}`,
    `Urgencia: ${deuda.urgencia ?? 50}%`,
    `Estado RCJ: ${ESTADO_LABEL[deuda.estado] ?? deuda.estado}`,
    deuda.trimestre_roadmap ? `Roadmap: ${deuda.trimestre_roadmap}` : '',
    deuda.responsable ? `Responsable sugerido: ${deuda.responsable}` : '',
    deuda._id ? `ID RCJ IT Manager: ${String(deuda._id)}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const descripcion_preview = [
    '## Contexto',
    contexto,
    '',
    '## Qué hacer',
    ...que_hacer.map((p) => `• ${p}`),
    '',
    '## Qué aplicar',
    ...que_aplicar.map((p) => `• ${p}`),
  ].join('\n')

  const descriptionAdf = buildJiraAdf([
    { heading: 'Contexto', text: contexto },
    { heading: 'Qué hacer (pasos sugeridos)', bullets: que_hacer },
    { heading: 'Qué aplicar (estándares y herramientas)', bullets: que_aplicar },
    {
      heading: 'Origen',
      text: 'Generado desde RCJ IT Manager — módulo Arquitectura IT / Tech Debt.',
    },
  ])

  const labels = labelsFor(deuda)
  const prioridad = prioridadJiraDesdeSeveridad(deuda.severidad ?? 'medium') ?? null

  return {
    summary,
    que_hacer,
    que_aplicar,
    labels,
    prioridad,
    descripcion_preview,
    createPayload: {
      summary,
      descriptionAdf,
      labels,
      priorityName: prioridad ?? undefined,
    },
  }
}
