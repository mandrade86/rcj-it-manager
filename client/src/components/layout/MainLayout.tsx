import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'

import { AppHeader } from '@/components/layout/AppHeader'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { getSesionApi } from '@/lib/api/auth'
import { useAuthStore } from '@/store/authStore'

export function MainLayout() {
  const token = useAuthStore((s) => s.token)
  const setUser = useAuthStore((s) => s.setUser)

  // Al entrar al layout autenticado, refrescamos los datos planos del usuario
  // para asegurar que campos nuevos (departamento_lleva_gastos, etc.) estén
  // disponibles incluso si el JWT actual fue emitido antes de esos cambios.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    void (async () => {
      try {
        const u = await getSesionApi()
        if (!cancelled) setUser(u)
      } catch {
        // Silencioso: si falla, seguimos con el cached user.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, setUser])

  return (
    <div className="flex h-svh w-full overflow-hidden">
      <AppSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="min-h-0 min-w-0 flex-1 overflow-auto bg-[var(--gray-bg)] p-4 lg:p-5">
          <div className="w-full min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
