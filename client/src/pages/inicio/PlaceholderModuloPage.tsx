import { Construction } from 'lucide-react'

import { BOARD } from '@/components/board/BoardPrimitives'

type Props = {
  titulo: string
  descripcion: string
}

export function PlaceholderModuloPage({ titulo, descripcion }: Props) {
  return (
    <div className="mx-auto max-w-xl space-y-3 py-16 text-center">
      <Construction className="mx-auto size-8" style={{ color: BOARD.muted }} />
      <h1 className="text-xl font-semibold" style={{ color: BOARD.text }}>
        {titulo}
      </h1>
      <p className="text-sm" style={{ color: BOARD.muted }}>
        {descripcion}
      </p>
    </div>
  )
}
