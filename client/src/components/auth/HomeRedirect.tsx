import { Navigate } from 'react-router-dom'

import { resolveDefaultRoute } from '@/lib/permisosNav'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { useAuthStore } from '@/store/authStore'

/** Inicio inteligente: dashboard o el primer módulo permitido (p. ej. BI Costeo). */
export function HomeRedirect() {
  const hasPermiso = useAuthStore((s) => s.hasPermiso)
  const user = useAuthStore((s) => s.user)
  const to = resolveDefaultRoute(hasPermiso, {
    llevaGastos: Boolean(user?.departamento_lleva_gastos),
  })

  if (to === '/') return <DashboardPage />
  return <Navigate to={to} replace />
}
