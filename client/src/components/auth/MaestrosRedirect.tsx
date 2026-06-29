import { Navigate } from 'react-router-dom'

import { useAuthStore } from '@/store/authStore'

/** Redirige /maestros al primer catálogo que el rol pueda ver. */
export function MaestrosRedirect() {
  const hasPermiso = useAuthStore((s) => s.hasPermiso)

  if (hasPermiso('maestros:ver')) {
    return <Navigate to="/maestros/departamentos" replace />
  }
  if (hasPermiso('empleados:ver')) {
    return <Navigate to="/maestros/empleados" replace />
  }
  return <Navigate to="/" replace />
}
