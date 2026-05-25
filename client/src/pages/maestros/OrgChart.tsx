import { useMemo, useState } from 'react'
import { BadgeCheck, Briefcase, Crown, Mail, Phone, User, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { EmpleadoDoc } from '@/types/empleado'
import { cn } from '@/lib/utils'

function initialsFromName(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?'
}

function isLoadableImageUrl(url: string | undefined): boolean {
  if (!url) return false
  const v = url.trim()
  if (!v) return false
  return (
    v.startsWith('http://') ||
    v.startsWith('https://') ||
    v.startsWith('data:') ||
    v.startsWith('/')
  )
}

export function Avatar({
  nombre,
  fotoUrl,
  bg,
  size = 'md',
}: {
  nombre: string
  fotoUrl?: string
  bg?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const [errored, setErrored] = useState(false)
  const showImg = isLoadableImageUrl(fotoUrl) && !errored

  const sizeClass = size === 'sm' ? 'size-8 text-xs' : size === 'lg' ? 'size-12 text-base' : 'size-10 text-sm'

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white',
        sizeClass,
      )}
      style={{ background: bg ?? '#002060' }}
    >
      {showImg ? (
        <img
          src={fotoUrl}
          alt={nombre}
          className="size-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <span>{initialsFromName(nombre)}</span>
      )}
    </div>
  )
}

type Node = EmpleadoDoc & {
  children: Node[]
  /** Total de descendientes (recursivo). 0 = nodo hoja. */
  descendantCount: number
  /** El usuario logueado es su jefe (asignación directa). */
  isUserDirect: boolean
  /** Este empleado ES el usuario logueado (su identidad). */
  isSelf: boolean
}

/**
 * Builds a tree from the visible empleados.
 *
 * - `forcedRoots` (typically the user's direct assignees) are guaranteed
 *   to be rendered as roots, even if their `jefe_id` is part of the visible
 *   set. This makes the chart show YOUR subjefaturas at the top.
 * - Empleados whose `jefe_id` is missing or unknown become natural roots.
 * - `descendantCount` is computed per node (recursive).
 */
function buildTree(
  empleados: EmpleadoDoc[],
  forcedRoots?: Set<string>,
  selfId?: string | null,
): { roots: Node[]; orphans: Node[] } {
  const map = new Map<string, Node>()
  empleados.forEach((e) => {
    map.set(e._id, {
      ...e,
      children: [],
      descendantCount: 0,
      isUserDirect: forcedRoots?.has(e._id) ?? false,
      isSelf: selfId != null && e._id === selfId,
    })
  })

  const childrenIds = new Set<string>()

  for (const node of map.values()) {
    if (forcedRoots?.has(node._id)) continue
    const j = node.jefe_id
    const jefeId = typeof j === 'string' ? j : j?._id
    if (jefeId && map.has(jefeId)) {
      map.get(jefeId)!.children.push(node)
      childrenIds.add(node._id)
    }
  }

  const roots: Node[] = []
  for (const node of map.values()) {
    if (childrenIds.has(node._id)) continue
    if (forcedRoots?.has(node._id)) { roots.push(node); continue }
    const j = node.jefe_id
    const jefeId = typeof j === 'string' ? j : j?._id
    if (!jefeId || !map.has(jefeId)) {
      // jefe missing or outside the visible set → natural root
      // (when jefeId is set but outside visible, we still treat as root —
      // these are entry points "from above" into the visible scope.)
      if (!jefeId) roots.push(node)
    }
  }

  // Orphans: have a jefe_id but the jefe is not in the visible set AND the
  // node was not promoted to a forced root.
  const orphans: Node[] = []
  for (const node of map.values()) {
    if (childrenIds.has(node._id)) continue
    if (roots.includes(node)) continue
    const j = node.jefe_id
    const jefeId = typeof j === 'string' ? j : j?._id
    if (jefeId && !map.has(jefeId)) orphans.push(node)
  }

  // Sort: self first, then forced roots, then alphabetical.
  const sortFn = (a: Node, b: Node) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1
    if (a.isUserDirect !== b.isUserDirect) return a.isUserDirect ? -1 : 1
    return a.nombre.localeCompare(b.nombre)
  }
  roots.sort(sortFn)
  orphans.sort(sortFn)
  for (const node of map.values()) node.children.sort(sortFn)

  // Compute descendantCount post-order
  const visit = (n: Node): number => {
    let count = 0
    for (const c of n.children) count += 1 + visit(c)
    n.descendantCount = count
    return count
  }
  for (const r of roots) visit(r)
  for (const o of orphans) visit(o)

  return { roots, orphans }
}

function NodeCard({ node, onSelect, selectedId }: { node: Node; onSelect?: (id: string) => void; selectedId?: string | null }) {
  const dept = node.departamento_id && typeof node.departamento_id !== 'string' ? node.departamento_id : null
  const isSelected = selectedId === node._id
  const isSubManager = node.children.length > 0
  const directReports = node.children.length

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => onSelect?.(node._id)}
        className={cn(
          'group relative w-[230px] cursor-pointer overflow-hidden rounded-lg border bg-card shadow-sm transition-all hover:shadow-md',
          isSelected ? 'border-[var(--lime)] ring-2 ring-[var(--lime)]/40' : 'border-border',
          node.isSelf && !isSelected && 'border-[var(--lime)] ring-1 ring-[var(--lime)]/30',
          !node.isSelf && node.isUserDirect && !isSelected && 'border-[var(--navy)]/40 shadow',
          !node.activo && 'opacity-60',
        )}
      >
        <div
          className="h-1.5 w-full"
          style={{ background: node.isSelf ? 'var(--lime)' : dept?.color ?? '#002060' }}
        />
        {node.isSelf ? (
          <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-[var(--lime)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--navy)]">
            <BadgeCheck className="size-2.5" /> Tú
          </span>
        ) : node.isUserDirect && (
          <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-[var(--navy)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
            <Crown className="size-2.5" /> Reporta a ti
          </span>
        )}
        <div className="flex items-start gap-3 p-3 text-left">
          <Avatar nombre={node.nombre} fotoUrl={node.foto_url} bg={dept?.color} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{node.nombre}</p>
            <p className="truncate text-xs text-muted-foreground">{node.puesto || '—'}</p>
            <p className="mt-1 truncate text-[10px] uppercase tracking-wide text-muted-foreground">
              {dept?.nombre ?? node.departamento ?? ''}
            </p>
            {isSubManager && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Badge variant="secondary" className="gap-1 bg-[var(--lime-lt)] py-0 text-[10px] text-[var(--navy)]">
                  <Users className="size-2.5" /> {directReports} directo{directReports !== 1 && 's'}
                </Badge>
                {node.descendantCount > directReports && (
                  <Badge variant="secondary" className="py-0 text-[10px]">
                    +{node.descendantCount} total
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </button>

      {node.children.length > 0 && (
        <>
          {/* Vertical line down */}
          <div className="h-4 w-0.5 bg-border" />
          {/* Horizontal connector */}
          {node.children.length > 1 && (
            <div className="relative h-0.5 w-full bg-border" style={{ maxWidth: `${node.children.length * 240}px` }} />
          )}
          <div className="flex items-start gap-4 pt-0">
            {node.children.map((child) => (
              <div key={child._id} className="relative flex flex-col items-center">
                {/* Vertical line up to horizontal */}
                <div className="h-4 w-0.5 bg-border" />
                <NodeCard node={child} onSelect={onSelect} selectedId={selectedId} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function OrgChart({
  empleados,
  selectedId,
  onSelect,
  forcedRootIds,
  myEmpleadoId,
}: {
  empleados: EmpleadoDoc[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  /** IDs que deben renderizarse como raíces (típicamente: identidad del
   * usuario + empleados_ids explícitos). */
  forcedRootIds?: string[]
  /** Empleado que ES el usuario logueado — se marca con badge "Tú". */
  myEmpleadoId?: string | null
}) {
  const forced = useMemo(
    () => (forcedRootIds && forcedRootIds.length > 0 ? new Set(forcedRootIds) : undefined),
    [forcedRootIds],
  )
  const { roots, orphans } = useMemo(
    () => buildTree(empleados, forced, myEmpleadoId ?? undefined),
    [empleados, forced, myEmpleadoId],
  )

  if (empleados.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
        <User className="size-10 text-muted-foreground" />
        <p className="font-medium">Sin empleados cargados</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Carga empleados manualmente o configura un servicio externo y sincroniza para construir el organigrama.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-fit space-y-12 p-6">
        {roots.map((root) => (
          <div key={root._id} className="flex justify-center">
            <NodeCard node={root} onSelect={onSelect} selectedId={selectedId} />
          </div>
        ))}

        {orphans.length > 0 && (
          <div>
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Sin jefe visible en este alcance
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {orphans.map((o) => (
                <NodeCard key={o._id} node={o} onSelect={onSelect} selectedId={selectedId} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function OrgDetailPanel({ empleado }: { empleado: EmpleadoDoc | null }) {
  if (!empleado) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Selecciona un empleado en el organigrama para ver el detalle.
      </div>
    )
  }
  const dept = empleado.departamento_id && typeof empleado.departamento_id !== 'string' ? empleado.departamento_id : null
  const jefe = empleado.jefe_id && typeof empleado.jefe_id !== 'string' ? empleado.jefe_id : null

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3 border-b pb-3">
        <Avatar nombre={empleado.nombre} fotoUrl={empleado.foto_url} bg={dept?.color} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{empleado.nombre}</p>
          <p className="text-sm text-muted-foreground">{empleado.puesto || '—'}</p>
          <p className="text-xs text-muted-foreground">Código: {empleado.codigo}</p>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        {dept && (
          <div className="flex items-center gap-2">
            <Briefcase className="size-4 text-muted-foreground" />
            <span>{dept.nombre}</span>
          </div>
        )}
        {empleado.email && (
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" />
            <a href={`mailto:${empleado.email}`} className="text-primary hover:underline">{empleado.email}</a>
          </div>
        )}
        {empleado.telefono && (
          <div className="flex items-center gap-2">
            <Phone className="size-4 text-muted-foreground" />
            <span>{empleado.telefono}</span>
          </div>
        )}
        {jefe && (
          <div className="rounded bg-muted/30 px-2 py-1.5 text-xs">
            <span className="text-muted-foreground">Reporta a: </span>
            <span className="font-medium">{jefe.nombre}</span>
          </div>
        )}
      </div>
    </div>
  )
}
