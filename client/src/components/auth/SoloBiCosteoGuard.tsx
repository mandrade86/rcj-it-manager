import { Navigate, Outlet } from 'react-router-dom'

import { esPerfilSoloBiCosteo } from '@/lib/permisosNav'
import { useAuthStore } from '@/store/authStore'

/** Bloquea rutas personales/ayuda para perfiles restringidos solo a BI Costeo. */
export function SoloBiCosteoGuard() {
  const hasPermiso = useAuthStore((s) => s.hasPermiso)

  if (esPerfilSoloBiCosteo(hasPermiso)) {
    return <Navigate to="/bi/costeo-muestras" replace />
  }

  return <Outlet />
}
