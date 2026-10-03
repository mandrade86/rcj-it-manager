import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Bell,
  BookOpen,
  HelpCircle,
  Inbox,
  LayoutGrid,
  LogOut,
  Search,
  User,
  UserPlus,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { esPerfilSoloBiCosteo } from '@/lib/permisosNav'
import { useAuthStore } from '@/store/authStore'

const titles: Record<string, string> = {
  '/': 'Mi día',
  '/mi-dia': 'Mi día',
  '/mis-tareas': 'Mis tareas',
  '/dashboard': 'Dashboards',
  '/notificaciones': 'Notificaciones',
  '/admin/configuracion': 'Configuración',
  '/admin/auditoria': 'Auditoría',
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
  '/maestros/empleados': 'Maestro · Empleados y Organigrama',
  '/maestros/planes-carrera': 'Maestro · Planes de Carrera',
  '/maestros/perfiles-puesto': 'Maestro · Perfiles de Puesto',
  '/maestros/proveedores-capacitacion': 'Maestro · Proveedores de Capacitación',
  '/admin/usuarios': 'Administración · Usuarios',
  '/admin/roles': 'Administración · Roles y Permisos',
  '/manual': 'Centro de ayuda',
  '/bi/costeo-muestras': 'BI · Costeo muestras',
}

const QUICK_LINKS: Array<{ label: string; to: string; hint?: string }> = [
  { label: 'Mi día', to: '/', hint: 'Bandeja del día' },
  { label: 'Dashboards', to: '/dashboard', hint: 'Proyectos, RRHH y admin' },
  { label: 'Mis tareas', to: '/mis-tareas', hint: 'Tareas asignadas' },
  { label: 'Proyectos', to: '/proyectos', hint: 'Tablero y lista' },
  { label: 'Roadmap', to: '/proyectos?vista=roadmap', hint: 'Vista ejecutiva' },
  { label: 'Reportería', to: '/reportes', hint: 'Resumen de proyectos' },
  { label: 'Equipo', to: '/equipo', hint: 'Organigrama' },
  { label: 'Capacitaciones', to: '/capacitaciones' },
  { label: 'KPIs', to: '/kpis' },
  { label: 'Centro de ayuda', to: '/manual', hint: 'Guías' },
  { label: 'Notificaciones', to: '/notificaciones' },
]

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
  return map[base] ?? 'RCJ IT Manager'
}

function HeaderIconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-md text-[#323338] transition hover:bg-[#e6e9ef]"
    >
      {children}
    </button>
  )
}

export function AppHeader() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const hasPermiso = useAuthStore((s) => s.hasPermiso)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [hits, setHits] = useState<Array<{ tipo: string; id: string; titulo: string; subtitulo: string; href: string }>>([])
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const soloBiCosteo = esPerfilSoloBiCosteo(hasPermiso)

  const title = titleFromPath(pathname, search)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return QUICK_LINKS.slice(0, 6)
    return QUICK_LINKS.filter(
      (l) =>
        l.label.toLowerCase().includes(q)
        || (l.hint?.toLowerCase().includes(q) ?? false)
        || l.to.toLowerCase().includes(q),
    ).slice(0, 8)
  }, [query])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      return
    }
    const timer = window.setTimeout(() => {
      void fetch(`/api/buscar?q=${encodeURIComponent(q)}`)
        .then(async (res) => (res.ok ? res.json() as Promise<{ resultados: typeof hits }> : { resultados: [] }))
        .then((data) => setHits(data.resultados ?? []))
        .catch(() => setHits([]))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!searchWrapRef.current?.contains(e.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function handleLogout() {
    clearAuth()
    navigate('/login', { replace: true })
  }

  function go(to: string) {
    setSearchOpen(false)
    setQuery('')
    navigate(to)
  }

  const initials = user
    ? user.nombre
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
    : '?'

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-[#e6e9ef] bg-[#f5f6f8] px-3 sm:px-4">
      {/* Izquierda: marca + título de página */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#e2445c]" />
          <span className="size-2.5 rounded-full bg-[#ffcb00]" />
          <span className="size-2.5 rounded-full bg-[#00c875]" />
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="hidden items-center gap-1.5 rounded-md border border-[#0073ea]/50 bg-white px-2.5 py-1 text-xs font-semibold text-[#0073ea] shadow-sm transition hover:bg-[#e6f2ff] sm:inline-flex"
        >
          <span className="inline-block size-1.5 rotate-45 rounded-[1px] bg-[#0073ea]" />
          RCJ IT
        </button>
        <span className="hidden h-5 w-px bg-[#d0d4e4] md:block" />
        <h1 className="hidden min-w-0 truncate text-sm font-medium text-[#323338] md:block">
          {title}
        </h1>
      </div>

      {/* Derecha: búsqueda + utilidades */}
      <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-1.5">
        <div ref={searchWrapRef} className="relative w-full max-w-[280px] sm:max-w-[360px] lg:max-w-[420px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#676879]" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSearchOpen(true)
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const dest = hits[0]?.href ?? results[0]?.to
                if (dest) {
                  e.preventDefault()
                  go(dest)
                }
              }
              if (e.key === 'Escape') setSearchOpen(false)
            }}
            placeholder="Buscar proyectos, tareas, personas o KPIs…"
            className="h-9 w-full rounded-full border-0 bg-[#e6e9ef] py-1.5 pl-9 pr-3 text-sm text-[#323338] outline-none placeholder:text-[#676879] focus:bg-white focus:ring-2 focus:ring-[#0073ea]/35"
          />
          {searchOpen && (
            <div className="absolute right-0 top-10 z-30 w-full min-w-[260px] overflow-hidden rounded-lg border border-[#e6e9ef] bg-white shadow-lg">
              <p className="border-b border-[#f0f1f5] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#676879]">
                {query.trim().length >= 2 ? 'Resultados' : 'Ir a'}
              </p>
              {query.trim().length >= 2 ? (
                hits.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-[#676879]">Sin proyectos, tareas, personas ni KPIs con ese texto.</p>
                ) : (
                  <ul className="max-h-80 overflow-y-auto py-1">
                    {hits.map((r) => (
                      <li key={`${r.tipo}-${r.id}`}>
                        <button
                          type="button"
                          className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-[#f0f3ff]"
                          onClick={() => go(r.href)}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#676879]">
                            {r.tipo === 'proyecto' ? 'Proyecto' : r.tipo === 'tarea' ? 'Tarea' : r.tipo === 'empleado' ? 'Empleado' : 'KPI'}
                          </span>
                          <span className="text-sm font-medium text-[#323338]">{r.titulo}</span>
                          {r.subtitulo && (
                            <span className="text-[11px] text-[#676879]">{r.subtitulo}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : results.length === 0 ? (
                <p className="px-3 py-4 text-sm text-[#676879]">Sin coincidencias</p>
              ) : (
                <ul className="max-h-72 overflow-y-auto py-1">
                  {results.map((r) => (
                    <li key={r.to + r.label}>
                      <button
                        type="button"
                        className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-[#f0f3ff]"
                        onClick={() => go(r.to)}
                      >
                        <span className="text-sm font-medium text-[#323338]">{r.label}</span>
                        {r.hint && (
                          <span className="text-[11px] text-[#676879]">{r.hint}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <HeaderIconButton label="Notificaciones" onClick={() => navigate('/notificaciones')}>
          <Bell className="size-[18px]" strokeWidth={1.75} />
        </HeaderIconButton>
        <HeaderIconButton label="Mi día" onClick={() => navigate('/')}>
          <Inbox className="size-[18px]" strokeWidth={1.75} />
        </HeaderIconButton>
        {!soloBiCosteo && (
          <HeaderIconButton label="Mis tareas" onClick={() => navigate('/mis-tareas')}>
            <UserPlus className="size-[18px]" strokeWidth={1.75} />
          </HeaderIconButton>
        )}
        <HeaderIconButton label="Centro de ayuda" onClick={() => navigate('/manual')}>
          <HelpCircle className="size-[18px]" strokeWidth={1.75} />
        </HeaderIconButton>

        <span className="mx-0.5 hidden h-5 w-px bg-[#d0d4e4] sm:block" />

        <HeaderIconButton label="Menú de módulos" onClick={() => navigate('/proyectos')}>
          <LayoutGrid className="size-[18px]" strokeWidth={1.75} />
        </HeaderIconButton>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              'flex size-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm transition',
              'bg-[#70AD47] hover:brightness-95',
            )}
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
              <div className="absolute right-0 top-10 z-20 w-56 overflow-hidden rounded-lg border border-[#e6e9ef] bg-white shadow-lg">
                <div className="border-b border-[#f0f1f5] bg-[#f5f6f8] px-3 py-2.5">
                  <p className="truncate text-sm font-medium text-[#323338]">{user?.nombre}</p>
                  <p className="truncate text-xs text-[#676879]">{user?.rol || user?.email}</p>
                </div>
                {!soloBiCosteo && (
                  <div className="px-1.5 py-1">
                    <Button
                      type="button"
                      variant="ghost"
                      className="flex h-9 w-full items-center justify-start gap-2 rounded-md px-2 text-sm font-normal"
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
                      className="flex h-9 w-full items-center justify-start gap-2 rounded-md px-2 text-sm font-normal"
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
                  className="flex w-full items-center gap-2 rounded-none border-t border-[#f0f1f5] px-3 py-2 text-left text-sm font-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="size-4" />
                  Cerrar sesión
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
