import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { cumplePermiso, permisoParaRuta } from '@/lib/permisosNav'
import { useAuthStore } from '@/store/authStore'

type Props = {
  permiso?: string | string[]
  /** Permite acceso a Gastos si el departamento del usuario lleva presupuesto. */
  allowGastosDept?: boolean
}

export function ProtectedRoute({ permiso, allowGastosDept }: Props) {
  const token = useAuthStore((s) => s.token)
  const hasPermiso = useAuthStore((s) => s.hasPermiso)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const required = permiso ?? permisoParaRuta(location.pathname)
  const allowed = cumplePermiso(required, hasPermiso, {
    llevaGastos: allowGastosDept && Boolean(user?.departamento_lleva_gastos),
  })

  if (required && !allowed) {
    const label = Array.isArray(required) ? required.join(' | ') : required
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-semibold">Sin permiso</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Tu rol actual no tiene el permiso{' '}
          <code className="rounded bg-muted px-1 py-0.5">{label}</code> requerido para esta sección.
          Cierra sesión y vuelve a entrar si acaban de cambiar tu rol.
        </p>
      </div>
    )
  }

  return <Outlet />
}
