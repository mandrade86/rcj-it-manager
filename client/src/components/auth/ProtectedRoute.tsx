import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuthStore } from '@/store/authStore'

type Props = {
  permiso?: string
}

export function ProtectedRoute({ permiso }: Props) {
  const token = useAuthStore((s) => s.token)
  const hasPermiso = useAuthStore((s) => s.hasPermiso)
  const location = useLocation()

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (permiso && !hasPermiso(permiso)) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-semibold">Sin permiso</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Tu rol actual no tiene el permiso <code className="rounded bg-muted px-1 py-0.5">{permiso}</code> requerido para esta sección.
        </p>
      </div>
    )
  }

  return <Outlet />
}
