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
    <div className="flex h-screen w-full overflow-hidden">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
