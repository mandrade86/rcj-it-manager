import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import type { ApiEndpointIT } from '@/types/itArquitectura'
import { useApiEndpointsIT } from '@/pages/it/hooks/useITData'
import { EndpointDialog } from '@/pages/it/components/dialogs/EndpointDialog'

const metodoClass: Record<ApiEndpointIT['metodo'], string> = {
  GET: 'bg-emerald-100 text-emerald-800',
  POST: 'bg-blue-100 text-blue-800',
  PUT: 'bg-amber-100 text-amber-800',
  PATCH: 'bg-orange-100 text-orange-800',
  DELETE: 'bg-red-100 text-red-800',
}

export function ApiReference() {
  const { endpoints, loading, error, create } = useApiEndpointsIT()
  const canEdit = useAuthStore((s) => s.hasPermiso('it:arquitectura:editar'))
  const [dialogOpen, setDialogOpen] = useState(false)

  const byGrupo = useMemo(() => {
    const m = new Map<string, ApiEndpointIT[]>()
    for (const ep of endpoints) {
      const list = m.get(ep.grupo) ?? []
      list.push(ep)
      m.set(ep.grupo, list)
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [endpoints])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Respuesta estándar</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-[var(--navy)] p-3 text-xs text-white">
{`{
  "success": true,
  "message": "",
  "data": {}
}`}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Headers requeridos</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
{`Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json`}
            </pre>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Catálogo de endpoints</h3>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1 size-4" />
              Endpoint
            </Button>
          )}
        </div>
        {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && byGrupo.map(([grupo, eps]) => (
          <Card key={grupo}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">{grupo}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-3 pt-0">
              {eps.map((ep) => (
                <div key={ep._id} className="flex flex-wrap items-center gap-2 rounded border border-border px-2 py-1.5 text-sm">
                  <Badge className={cn('font-mono text-[10px]', metodoClass[ep.metodo])}>{ep.metodo}</Badge>
                  <code className="text-xs text-[var(--navy)]">{ep.path}</code>
                  <span className="text-xs text-muted-foreground">{ep.descripcion}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <EndpointDialog open={dialogOpen} onOpenChange={setDialogOpen} onSave={create} />
    </div>
  )
}
