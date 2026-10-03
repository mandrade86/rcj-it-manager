import { Navigate } from 'react-router-dom'

import { resolveDefaultRoute } from '@/lib/permisosNav'
import { MiDiaPage } from '@/pages/inicio/MiDiaPage'
import { useAuthStore } from '@/store/authStore'

/** Inicio: Mi día si puede ver el workspace; si no, el primer módulo permitido. */
export function HomeRedirect() {
  const hasPermiso = useAuthStore((s) => s.hasPermiso)
  const user = useAuthStore((s) => s.user)
  const to = resolveDefaultRoute(hasPermiso, {
    llevaGastos: Boolean(user?.departamento_lleva_gastos),
  })

  if (to === '/') return <MiDiaPage />
  return <Navigate to={to} replace />
}
