import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Colaborador } from '@/types/colaborador'

type OrgNode = {
  codigo: string
  children?: OrgNode[]
}

/** Estructura del organigrama Plan IT / perfiles RCJ IT */
const ORG_TREE: OrgNode = {
  codigo: 'IT-01',
  children: [
    {
      codigo: 'IT-02',
      children: [
        { codigo: 'IT-04A' },
        { codigo: 'IT-04B', children: [{ codigo: 'IT-04C' }] },
      ],
    },
    {
      codigo: 'IT-03',
      children: [{ codigo: 'IT-06A' }, { codigo: 'IT-06B' }],
    },
  ],
}

function findColaborador(
  codigo: string,
  list: Colaborador[],
): Colaborador | undefined {
  return list.find((c) => c.codigo === codigo || c.codigo_puesto === codigo)
}

function OrgCard({
  codigo,
  colaborador,
}: {
  codigo: string
  colaborador?: Colaborador
}) {
  const vacante =
    !colaborador ||
    colaborador.estado === 'Por contratar' ||
    colaborador.estado === 'Futuro'
  const label = colaborador?.nombre ?? 'Vacante'
  const sub = colaborador?.puesto ?? codigo

  const inner = (
    <Card
      className={cn(
        'min-w-[160px] max-w-[200px] border bg-card shadow-sm transition-shadow hover:shadow-md',
        vacante && 'border-dashed border-muted-foreground/50 bg-muted/30',
      )}
    >
      <CardContent className="p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {codigo}
        </p>
        <p className="line-clamp-2 text-sm font-semibold text-foreground">{label}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{sub}</p>
        {colaborador && (
          <Badge
            variant="secondary"
            className={cn(
              'mt-2 text-[10px]',
              colaborador.estado === 'Activo' && 'bg-[var(--lime-lt)] text-[var(--navy)]',
            )}
          >
            {colaborador.estado}
          </Badge>
        )}
      </CardContent>
    </Card>
  )

  if (colaborador && colaborador.estado === 'Activo') {
    return (
      <Link to={`/equipo/${colaborador._id}`} className="inline-block">
        {inner}
      </Link>
    )
  }

  return inner
}

function OrgBranch({
  node,
  list,
}: {
  node: OrgNode
  list: Colaborador[]
}) {
  const col = findColaborador(node.codigo, list)
  const children = node.children ?? []
  if (children.length === 0) {
    return <OrgCard codigo={node.codigo} colaborador={col} />
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <OrgCard codigo={node.codigo} colaborador={col} />
      <div className="h-3 w-px shrink-0 bg-border" aria-hidden />
      <div className="flex flex-wrap items-start justify-center gap-6">
        {children.map((ch) => (
          <div key={ch.codigo} className="flex flex-col items-center gap-3">
            <OrgBranch node={ch} list={list} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function OrganigramaEquipo({ list }: { list: Colaborador[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card p-6 shadow-sm">
      <p className="mb-6 text-center text-xs text-muted-foreground">
        Puestos &quot;Por contratar&quot; o &quot;Futuro&quot; se muestran con borde punteado. Clic en
        colaborador activo abre el perfil.
      </p>
      <div className="flex justify-center pb-4">
        <OrgBranch node={ORG_TREE} list={list} />
      </div>
    </div>
  )
}
