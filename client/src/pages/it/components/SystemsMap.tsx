import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import type { SistemaIT } from '@/types/itArquitectura'
import { useSistemasIT } from '@/pages/it/hooks/useITData'
import { SistemaDialog } from '@/pages/it/components/dialogs/SistemaDialog'

const estadoDot: Record<SistemaIT['estado'], string> = {
  stable: 'bg-emerald-500',
  warning: 'bg-amber-500',
  legacy: 'bg-red-500',
}

const estadoLabel: Record<SistemaIT['estado'], string> = {
  stable: 'Estable',
  warning: 'Advertencia',
  legacy: 'Legacy',
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  )
}

export function SystemsMap() {
  const { sistemas, loading, error, saving, update, create } = useSistemasIT()
  const canEdit = useAuthStore((s) => s.hasPermiso('it:arquitectura:editar'))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SistemaIT | null>(null)

  const selected = sistemas.find((s) => s._id === selectedId)

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {sistemas.length} sistemas registrados — clic en tarjeta para detalle
        </p>
        {canEdit && (
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="mr-1 size-4" />
            Nuevo sistema
          </Button>
        )}
      </div>

      {loading ? (
        <SkeletonGrid />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sistemas.map((s) => (
            <Card
              key={s._id}
              className={cn(
                'cursor-pointer transition-shadow hover:shadow-md',
                selectedId === s._id && 'ring-2 ring-[var(--lime)]',
              )}
              onClick={() => setSelectedId(selectedId === s._id ? null : s._id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('size-2.5 shrink-0 rounded-full', estadoDot[s.estado])} />
                    <h3 className="truncate font-semibold text-sm">{s.nombre}</h3>
                  </div>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 size-8"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditing(s)
                        setDialogOpen(true)
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{s.stack}</p>
                <Badge variant="outline" className="mt-2 text-[10px]">
                  {estadoLabel[s.estado]}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <Card className="border-[var(--blue-lt)] bg-[var(--blue-lt)]/30">
          <CardContent className="space-y-2 p-4 text-sm">
            <h3 className="font-semibold text-[var(--navy)]">{selected.nombre}</h3>
            <p><span className="font-medium">Stack:</span> {selected.stack}</p>
            <p><span className="font-medium">Integraciones:</span> {selected.integraciones || '—'}</p>
            <p><span className="font-medium">Responsable:</span> {selected.responsable || '—'}</p>
            {selected.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selected.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                ))}
              </div>
            )}
            {selected.notas && <p className="text-muted-foreground">{selected.notas}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Flujo de integraciones (referencia)
          </p>
          <svg viewBox="0 0 600 120" className="w-full max-w-2xl" aria-hidden>
            <rect x="20" y="40" width="100" height="40" rx="4" fill="#002060" opacity="0.9" />
            <text x="70" y="65" textAnchor="middle" fill="#fff" fontSize="10">SAP B1</text>
            <line x1="120" y1="60" x2="180" y2="60" stroke="#70AD47" strokeWidth="2" />
            <rect x="180" y="40" width="90" height="40" rx="4" fill="#1F4E79" />
            <text x="225" y="65" textAnchor="middle" fill="#fff" fontSize="9">eTickets</text>
            <line x1="270" y1="60" x2="330" y2="60" stroke="#70AD47" strokeWidth="2" />
            <rect x="330" y="40" width="80" height="40" rx="4" fill="#7F6000" />
            <text x="370" y="65" textAnchor="middle" fill="#fff" fontSize="9">eProc</text>
            <line x1="410" y1="60" x2="470" y2="60" stroke="#70AD47" strokeWidth="2" />
            <rect x="470" y="40" width="90" height="40" rx="4" fill="#0F6E56" />
            <text x="515" y="65" textAnchor="middle" fill="#fff" fontSize="9">M365</text>
          </svg>
        </CardContent>
      </Card>

      <SistemaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        saving={saving}
        onSave={async (body) => {
          if (editing) await update(editing._id, body)
          else await create(body)
        }}
      />
    </div>
  )
}
