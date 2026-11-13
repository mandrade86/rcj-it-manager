import { ServicioEticket } from '../db/models/ServicioEticket.js'
import {
  ackEticketImported,
  fetchEticketServicios,
  isEticketConfigured,
  type EticketServicioItem,
} from './eticketClient.js'

export type EticketSyncResult = {
  configurado: boolean
  consultados: number
  creados: number
  actualizados: number
  confirmados: number
  ya_confirmados: number
  errores: Array<{ externalId: string; error: string }>
}

function parseDate(v?: string | null): Date | undefined {
  if (!v) return undefined
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function toDoc(item: EticketServicioItem) {
  return {
    externalId: String(item.externalId),
    ticketNumber: item.ticketNumber ?? '',
    source: item.source ?? 'eticket',
    sourceUrl: item.sourceUrl ?? '',
    type: item.type ?? 'desarrollo',
    title: item.title || `(sin título) ${item.ticketNumber || item.externalId}`,
    descriptionHtml: item.descriptionHtml ?? '',
    descriptionText: item.descriptionText ?? '',
    status: item.status ?? '',
    priority: item.priority ?? 'medium',
    system: item.system ?? '',
    department: item.department ?? '',
    requesterEmail: item.requesterEmail ?? '',
    requesterName: item.requesterName ?? '',
    assigneeEmail: item.assigneeEmail ?? '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    authorizationStatus: item.authorizationStatus ?? null,
    developmentAdminApproval: item.developmentAdminApproval ?? null,
    form: item.form ?? null,
    eticketCreatedAt: parseDate(item.createdAt),
    eticketUpdatedAt: parseDate(item.updatedAt),
    markedAt: parseDate(item.markedAt),
    markedBy: item.markedBy ?? '',
    importStatus: 'imported' as const,
    importedAt: new Date(),
    importedBy: 'it-rcj-manager',
    raw: item,
  }
}

/** Importa pendientes desde eTicket, upsert por externalId y confirma con POST /imported. */
export async function sincronizarServiciosEticket(): Promise<EticketSyncResult> {
  const out: EticketSyncResult = {
    configurado: isEticketConfigured(),
    consultados: 0,
    creados: 0,
    actualizados: 0,
    confirmados: 0,
    ya_confirmados: 0,
    errores: [],
  }
  if (!out.configurado) return out

  const { items } = await fetchEticketServicios('pending')
  out.consultados = items.length

  for (const item of items) {
    const externalId = String(item.externalId || '').trim()
    if (!externalId) {
      out.errores.push({ externalId: '(vacío)', error: 'Sin externalId' })
      continue
    }
    try {
      const existing = await ServicioEticket.findOne({ externalId }).select('_id').lean()
      const doc = toDoc(item)
      const saved = await ServicioEticket.findOneAndUpdate(
        { externalId },
        { $set: doc },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      if (existing) out.actualizados++
      else out.creados++

      const remoteId = String(saved._id)
      const ack = await ackEticketImported(externalId, remoteId, 'it-rcj-manager')
      if (ack.already) out.ya_confirmados++
      else out.confirmados++
    } catch (e) {
      out.errores.push({
        externalId,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  console.log('[eticket-sync]', {
    consultados: out.consultados,
    creados: out.creados,
    actualizados: out.actualizados,
    confirmados: out.confirmados,
    errores: out.errores.length,
  })
  return out
}

let syncTimer: ReturnType<typeof setInterval> | null = null

/** Poll periódico si ETICKET_SYNC_CRON=true (minutos, default 15). */
export function startEticketSyncCron(): void {
  if (process.env.ETICKET_SYNC_CRON !== 'true') return
  if (syncTimer) return
  if (!isEticketConfigured()) {
    console.warn('[eticket-sync] cron pedido pero faltan ETICKET_API_BASE_URL / ETICKET_API_KEY')
    return
  }
  const mins = Math.max(1, Number(process.env.ETICKET_SYNC_INTERVAL_MINUTES) || 15)
  const ms = mins * 60 * 1000
  console.log(`[eticket-sync] cron activo cada ${mins} min`)
  syncTimer = setInterval(() => {
    void sincronizarServiciosEticket().catch((e) =>
      console.warn('[eticket-sync] cron falló', e),
    )
  }, ms)
  setTimeout(() => {
    void sincronizarServiciosEticket().catch((e) =>
      console.warn('[eticket-sync] primer sync falló', e),
    )
  }, 90_000)
}
