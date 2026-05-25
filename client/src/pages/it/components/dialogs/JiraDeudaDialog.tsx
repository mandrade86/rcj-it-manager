import { useEffect, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createDeudaJiraIssueApi,
  getDeudaJiraSugerenciaApi,
} from '@/lib/api/itArquitectura'
import type { DeudaJiraSugerencia, DeudaTecnica } from '@/types/itArquitectura'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  deuda: DeudaTecnica | null
  onCreated: (updated: DeudaTecnica) => void
}

export function JiraDeudaDialog({ open, onOpenChange, deuda, onCreated }: Props) {
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sugerencia, setSugerencia] = useState<DeudaJiraSugerencia | null>(null)
  const [summary, setSummary] = useState('')

  useEffect(() => {
    if (!open || !deuda) {
      setSugerencia(null)
      setSummary('')
      setErr(null)
      return
    }
    setLoading(true)
    setErr(null)
    void getDeudaJiraSugerenciaApi(deuda._id)
      .then((s) => {
        setSugerencia(s)
        setSummary(s.summary)
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Error cargando sugerencia'))
      .finally(() => setLoading(false))
  }, [open, deuda])

  async function handleCreate() {
    if (!deuda) return
    setCreating(true)
    setErr(null)
    try {
      const { deuda: updated } = await createDeudaJiraIssueApi(deuda._id, {
        summary: summary.trim() || undefined,
      })
      onCreated(updated)
      onOpenChange(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error creando issue en Jira')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear tarea en Jira</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {deuda?.titulo} — la descripción incluirá pasos sugeridos y estándares a aplicar.
          </p>
        </DialogHeader>

        {loading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Generando sugerencias…
          </p>
        )}

        {err && <p className="text-sm text-destructive">{err}</p>}

        {sugerencia && !loading && (
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="jira-summary">Resumen (summary)</Label>
              <Input
                id="jira-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {sugerencia.labels.map((l) => (
                <Badge key={l} variant="secondary" className="text-[10px]">
                  {l}
                </Badge>
              ))}
              {sugerencia.prioridad && (
                <Badge variant="outline" className="text-[10px]">
                  Prioridad: {sugerencia.prioridad}
                </Badge>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-[var(--navy)]">Qué hacer</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                {sugerencia.que_hacer.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-[var(--navy)]">Qué aplicar</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                {sugerencia.que_aplicar.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>

            <details className="rounded-md border border-border bg-muted/30 p-3">
              <summary className="cursor-pointer text-xs font-medium text-[var(--navy)]">
                Vista previa de descripción en Jira
              </summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                {sugerencia.descripcion_preview}
              </pre>
            </details>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={creating || loading || !sugerencia}
            className="bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90"
            onClick={() => void handleCreate()}
          >
            {creating ? (
              <>
                <Loader2 className="mr-1 size-4 animate-spin" />
                Creando…
              </>
            ) : (
              'Crear issue en Jira'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function JiraLinkButton({ url, issueKey }: { url: string; issueKey: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-[var(--navy)] hover:bg-muted"
    >
      {issueKey}
      <ExternalLink className="size-3" />
    </a>
  )
}
