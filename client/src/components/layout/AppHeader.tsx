import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { BookOpen, LogOut, User } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { esPerfilSoloBiCosteo } from '@/lib/permisosNav'
import { useAuthStore } from '@/store/authStore'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/resumen-departamento': 'Resumen metas y plan',
  '/proyectos': 'Proyectos',
  '/reportes': 'Reportería',
  '/proyectos-reporte-semanal': 'Reportería',
  '/proyectos/roadmap': 'Roadmap de proyectos',
  '/equipo': 'Equipo',
  '/capacitaciones': 'Capacitaciones',
  '/gastos': 'Gastos TI (CAPEX / OPEX)',
  '/kpis': 'KPIs',
  '/mi-evaluacion': 'Mi desempeño',
  '/mis-capacitaciones': 'Mis capacitaciones',
  '/maestros/metas': 'Objetivos estratégicos',
  '/maestros/empresas': 'Maestro · Empresas',
  '/maestros/departamentos': 'Maestro · Departamentos',
  '/maestros/ejes-proyecto': 'Maestro · Ejes de proyecto',
  '/maestros/empleados': 'Maestro · Empleados y Organigrama',
  '/maestros/planes-carrera': 'Maestro · Planes de Carrera',
  '/maestros/perfiles-puesto': 'Maestro · Perfiles de Puesto',
  '/maestros/proveedores-capacitacion': 'Maestro · Proveedores de Capacitación',
  '/admin/usuarios': 'Administración · Usuarios',
  '/admin/roles': 'Administración · Roles y Permisos',
  '/manual': 'Centro de ayuda',
  '/bi/costeo-muestras': 'BI · Costeo muestras',
}

function titleFromPath(pathname: string, search: string): string {
  if (pathname === '/proyectos') {
    if (new URLSearchParams(search).get('vista') === 'roadmap') return 'Roadmap de proyectos'
    if (new URLSearchParams(search).get('vista') === 'gantt') return 'Proyectos · Gantt'
    return 'Proyectos'
  }
  if (pathname.startsWith('/manual/') && pathname !== '/manual') {
    const slug = pathname.replace('/manual/', '').split('/')[0]
    const labels: Record<string, string> = {
      'primeros-pasos': 'Guía · Primeros pasos',
      'panel-inicio': 'Guía · Panel de inicio',
      proyectos: 'Guía · Proyectos',
      'kpis-metas': 'Guía · KPIs y metas',
      'mi-espacio': 'Guía · Mi espacio',
      'equipo-talento': 'Guía · Equipo',
      capacitaciones: 'Guía · Capacitaciones',
      gastos: 'Guía · Gastos',
      coordinacion: 'Guía · Coordinación',
      'preguntas-frecuentes': 'Guía · Preguntas frecuentes',
      'soporte-tecnico': 'Guía · Soporte técnico',
    }
    return labels[slug] ?? 'Centro de ayuda'
  }
  if (titles[pathname]) return titles[pathname]
  if (pathname === '/proyectos/nuevo') return 'Nuevo proyecto'
  if (/\/proyectos\/.+\/editar$/.test(pathname)) return 'Editar proyecto'
  if (/^\/proyectos\/.+/.test(pathname)) return 'Detalle de proyecto'
  if (/\/equipo\/.+\/evaluaciones\//.test(pathname)) return 'Evaluación desarrolladores'
  if (/^\/equipo\/.+/.test(pathname)) return 'Perfil de colaborador'
  const base = pathname.split('/')[1]
  const map: Record<string, string> = {
    proyectos: 'Proyectos',
    equipo: 'Equipo',
    capacitaciones: 'Capacitaciones',
    gastos: 'Gastos TI (CAPEX / OPEX)',
    kpis: 'KPIs',
    maestros: 'Maestros',
    admin: 'Administración',
  }
  return map[base] ?? 'Project Management & Talent'
}

export function AppHeader() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const hasPermiso = useAuthStore((s) => s.hasPermiso)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [menuOpen, setMenuOpen] = useState(false)
  const soloBiCosteo = esPerfilSoloBiCosteo(hasPermiso)

  const title = titleFromPath(pathname, search)
  const today = format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })

  function handleLogout() {
    clearAuth()
    navigate('/login', { replace: true })
  }

  const initials = user
    ? user.nombre.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
    : '?'

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6 shadow-sm">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
        <p className="truncate text-xs capitalize text-muted-foreground">{today}</p>
      </div>

      <div className="relative flex items-center gap-3">
        {user && (
          <div className="hidden text-right text-xs sm:block">
            <p className="font-medium leading-tight text-foreground">{user.nombre}</p>
            <p className="text-muted-foreground">{user.rol}</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex size-9 items-center justify-center rounded-full bg-[var(--navy)] text-sm font-semibold text-white transition hover:bg-[var(--navy)]/90"
          aria-label="Menú de usuario"
        >
          {initials}
        </button>
        {menuOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-10 cursor-default"
              aria-label="Cerrar menú"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-12 z-20 w-56 overflow-hidden rounded-md border bg-card shadow-lg">
              <div className="border-b bg-muted/30 px-3 py-2.5">
                <p className="truncate text-sm font-medium">{user?.nombre}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
              {!soloBiCosteo && (
                <div className="px-2 py-1">
                  <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Mi espacio
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex h-9 w-full items-center gap-2 justify-start rounded-md px-2 text-sm font-normal"
                    onClick={() => {
                      setMenuOpen(false)
                      navigate('/mi-evaluacion')
                    }}
                  >
                    <User className="size-4 text-[var(--navy)]" />
                    Mi desempeño
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex h-9 w-full items-center gap-2 justify-start rounded-md px-2 text-sm font-normal"
                    onClick={() => {
                      setMenuOpen(false)
                      navigate('/mis-capacitaciones')
                    }}
                  >
                    <BookOpen className="size-4 text-[var(--navy)]" />
                    Mis capacitaciones
                  </Button>
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-none border-t px-3 py-2 text-left text-sm font-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="size-4" />
                Cerrar sesión
              </Button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
