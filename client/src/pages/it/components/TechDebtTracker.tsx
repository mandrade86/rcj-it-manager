import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CheckCircle2, ExternalLink, Pencil, Plus, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import type { DeudaTecnica } from '@/types/itArquitectura'
import { useDeudaTecnica } from '@/pages/it/hooks/useITData'
import { DeudaDialog } from '@/pages/it/components/dialogs/DeudaDialog'
import { JiraDeudaDialog, JiraLinkButton } from '@/pages/it/components/dialogs/JiraDeudaDialog'
import { JiraStatusBadge, JiraStatusResumenPanel } from '@/pages/it/components/JiraStatusBadge'
import { getJiraConfigITApi, syncDeudaJiraApi } from '@/lib/api/itArquitectura'
import type { JiraConfigIT } from '@/types/itArquitectura'

const severidadOrder: Record<DeudaTecnica['severidad'], number> = {
  high: 0,
  medium: 1,
  low: 2,
}

const severidadBorder: Record<DeudaTecnica['severidad'], string> = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-emerald-500',
}

const estadoBadge: Record<DeudaTecnica['estado'], string> = {
  abierta: 'bg-red-100 text-red-800',
  en_progreso: 'bg-amber-100 text-amber-800',
  resuelta: 'bg-emerald-100 text-emerald-800',
}

const estadoLabel: Record<DeudaTecnica['estado'], string> = {
  abierta: 'Abierta',
  en_progreso: 'En progreso',
  resuelta: 'Resuelta',
}

export function TechDebtTracker() {
  const {
    deuda,
    jiraResumen,
    loading,
    error,
    saving,
    update,
    create,
    reload,
    applySyncResult,
  } = useDeudaTecnica()
  const canEdit = useAuthStore((s) => s.hasPermiso('it:arquitectura:editar'))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DeudaTecnica | null>(null)
  const [jiraDeuda, setJiraDeuda] = useState<DeudaTecnica | null>(null)
  const [jiraOpen, setJiraOpen] = useState(false)
  const [jiraConfig, setJiraConfig] = useState<JiraConfigIT | null>(null)
  const [jiraSyncing, setJiraSyncing] = useState(false)
  const [jiraSyncErr, setJiraSyncErr] = useState<string | null>(null)

  useEffect(() => {
    void getJiraConfigITApi()
      .then(setJiraConfig)
      .catch(() => setJiraConfig({ enabled: false, baseUrl: null, projectKey: 'IT', issueType: 'Task' }))
  }, [])

  const tieneVinculosJira = useMemo(
    () => deuda.some((d) => Boolean(d.jira_issue_key)),
    [deuda],
  )

  const syncJira = useCallback(async () => {
    if (!jiraConfig?.enabled) return
    setJiraSyncing(true)
    setJiraSyncErr(null)
    try {
      const result = await syncDeudaJiraApi()
      applySyncResult(result.items, result.resumen)
      if (result.sync.errors.length) {
        setJiraSyncErr(result.sync.errors.join(' · '))
      }
    } catch (e) {
      setJiraSyncErr(e instanceof Error ? e.message : 'Error sincronizando Jira')
    } finally {
      setJiraSyncing(false)
    }
  }, [jiraConfig?.enabled, applySyncResult])

  const autoSyncDone = useRef(false)
  useEffect(() => {
    if (!jiraConfig?.enabled || loading || !tieneVinculosJira || autoSyncDone.current) return
    autoSyncDone.current = true
    void syncJira()
  }, [jiraConfig?.enabled, loading, tieneVinculosJira, syncJira])

  const sorted = useMemo(
    () => [...deuda].sort((a, b) => severidadOrder[a.severidad] - severidadOrder[b.severidad]),
    [deuda],
  )

  const chartData = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 }
    for (const d of deuda.filter((x) => x.estado !== 'resuelta')) {
      counts[d.severidad]++
    }
    return [
      { name: 'Alta', count: counts.high },
      { name: 'Media', count: counts.medium },
      { name: 'Baja', count: counts.low },
    ]
  }, [deuda])

  const roadmap = useMemo(() => {
    const m = new Map<string, DeudaTecnica[]>()
    for (const d of deuda.filter((x) => x.trimestre_roadmap && x.estado !== 'resuelta')) {
      const list = m.get(d.trimestre_roadmap) ?? []
      list.push(d)
      m.set(d.trimestre_roadmap, list)
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [deuda])

  return (
    <div className="space-y-4">
      {jiraConfig && !jiraConfig.enabled && canEdit && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Jira no configurado. Agrega <code className="text-xs">JIRA_BASE_URL</code>,{' '}
          <code className="text-xs">JIRA_EMAIL</code> y <code className="text-xs">JIRA_API_TOKEN</code> en el
          archivo <code className="text-xs">.env</code> del servidor para crear issues desde aquí.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Deuda técnica y roadmap por trimestre
          {jiraConfig?.enabled && (
            <span className="ml-1 text-muted-foreground">
              · Jira {jiraConfig.projectKey} ({jiraConfig.issueType})
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {jiraConfig?.enabled && tieneVinculosJira && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={jiraSyncing}
              onClick={() => void syncJira()}
            >
              <RefreshCw className={cn('mr-1 size-4', jiraSyncing && 'animate-spin')} />
              Sincronizar Jira
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}>
              <Plus className="mr-1 size-4" />
              Nueva deuda
            </Button>
          )}
        </div>
      </div>

      {jiraSyncErr && (
        <p className="text-sm text-amber-800">{jiraSyncErr}</p>
      )}

      {jiraConfig?.enabled && jiraResumen && (
        <JiraStatusResumenPanel
          resumen={jiraResumen}
          syncing={jiraSyncing}
          onSync={() => void syncJira()}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Por severidad (abiertas)</CardTitle>
          </CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#002060" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Roadmap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {roadmap.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin items en roadmap con trimestre definido.</p>
            )}
            {roadmap.map(([q, items]) => (
              <div key={q}>
                <p className="text-xs font-semibold uppercase text-[var(--navy)]">{q}</p>
                <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                  {items.map((d) => (
                    <li key={d._id}>• {d.titulo} ({d.sistema})</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        {sorted.map((d) => (
          <Card key={d._id} className={cn('border-l-4', severidadBorder[d.severidad])}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm">{d.titulo}</h3>
                  <p className="text-xs text-muted-foreground">{d.sistema} · {d.riesgo}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {d.jira_issue_key && d.jira_issue_url && (
                    <JiraLinkButton url={d.jira_issue_url} issueKey={d.jira_issue_key} />
                  )}
                  <JiraStatusBadge deuda={d} />
                  <Badge className={cn('text-[10px]', estadoBadge[d.estado])}>
                    {estadoLabel[d.estado]} (RCJ)
                  </Badge>
                  {canEdit && (
                    <>
                      {jiraConfig?.enabled && !d.jira_issue_key && d.estado !== 'resuelta' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setJiraDeuda(d)
                            setJiraOpen(true)
                          }}
                        >
                          <ExternalLink className="mr-1 size-3" />
                          Crear en Jira
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEditing(d); setDialogOpen(true) }}
                      >
                        <Pencil className="mr-1 size-3" />
                        Editar
                      </Button>
                      {d.estado !== 'resuelta' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void update(d._id, { estado: 'resuelta' })}
                        >
                          <CheckCircle2 className="mr-1 size-3" />
                          Resuelta
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
              {d.descripcion && (
                <p className="mt-2 text-sm text-muted-foreground">{d.descripcion}</p>
              )}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Urgencia</span>
                  <span>{d.urgencia}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-[var(--navy)]"
                    style={{ width: `${d.urgencia}%` }}
                  />
                </div>
              </div>
              {d.jira_issue_key && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                  {d.jira_assignee && <span>Asignado Jira: {d.jira_assignee}</span>}
                  {d.jira_synced_at && (
                    <span>
                      Sync:{' '}
                      {new Date(d.jira_synced_at).toLocaleString('es-HN', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  )}
                </div>
              )}
              {d.trimestre_roadmap && (
                <p className="mt-2 text-xs text-muted-foreground">Roadmap: {d.trimestre_roadmap}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <DeudaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        saving={saving}
        onSave={async (body) => {
          if (editing) await update(editing._id, body)
          else await create(body)
        }}
      />

      <JiraDeudaDialog
        open={jiraOpen}
        onOpenChange={setJiraOpen}
        deuda={jiraDeuda}
        onCreated={() => {
          void reload()
          if (jiraConfig?.enabled) void syncJira()
        }}
      />
    </div>
  )
}
