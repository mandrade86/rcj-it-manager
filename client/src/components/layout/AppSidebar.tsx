import { useEffect, useState } from 'react'
import { fetchWorkspaceNombre } from '@/lib/api/workspace'
import type { LucideIcon } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  BookMarked,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Factory,
  FileText,
  FlaskConical,
  FolderKanban,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  Map,
  Bell,
  CalendarCheck,
  ClipboardList,
  ListChecks,
  PanelLeft,
  Route,
  Settings,
  ScrollText,
  Shield,
  ShieldCheck,
  Target,
  Users,
  UsersRound,
  Wallet,
  Briefcase,
  Server,
  Store,
  PieChart,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { cumplePermiso, esPerfilSoloBiCosteo } from '@/lib/permisosNav'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'

type NavItemDef = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  permiso?: string | string[]
}

type NavGroupDef = {
  id: string
  label: string
  icon: LucideIcon
  items: NavItemDef[]
}

const ayudaNav: NavItemDef[] = [
  { to: '/manual', label: 'Centro de ayuda', icon: BookMarked, end: true },
  { to: '/manual/primeros-pasos', label: 'Primeros pasos', icon: BookOpen },
  { to: '/manual/preguntas-frecuentes', label: 'Preguntas frecuentes', icon: HelpCircle },
]

const workspaceNav: NavItemDef[] = [
  { to: '/', label: 'Mi día', icon: CalendarCheck, end: true, permiso: 'dashboard:ver' },
  { to: '/dashboard', label: 'Dashboards', icon: LayoutDashboard, permiso: 'dashboard:ver' },
  { to: '/mis-tareas', label: 'Mis tareas', icon: ListChecks, permiso: 'dashboard:ver' },
  { to: '/notificaciones', label: 'Notificaciones', icon: Bell, permiso: 'dashboard:ver' },
]

const pmNav: NavItemDef[] = [
  { to: '/proyectos', label: 'Proyectos', icon: FolderKanban, permiso: 'proyectos:ver' },
  { to: '/proyectos?mios=1', label: 'Mis proyectos', icon: ClipboardList, permiso: 'proyectos:ver' },
  { to: '/proyectos?vista=roadmap', label: 'Roadmap', icon: Map, permiso: 'proyectos:ver' },
  { to: '/kpis', label: 'KPIs', icon: Target, permiso: 'kpis:ver' },
  { to: '/reportes', label: 'Reportería', icon: FileText, permiso: 'proyectos:ver' },
  { to: '/resumen-departamento', label: 'Resumen del plan', icon: BarChart3, permiso: 'dashboard:ver' },
]

const rrHHNav: NavItemDef[] = [
  { to: '/maestros/empleados', label: 'Empleados', icon: UsersRound, permiso: 'empleados:ver' },
  { to: '/equipo', label: 'Organigrama', icon: Users, permiso: 'equipo:ver' },
  { to: '/maestros/perfiles-puesto', label: 'Perfiles de puesto', icon: BookOpen, permiso: 'maestros:ver' },
  { to: '/maestros/planes-carrera', label: 'Plan de carrera', icon: Route, permiso: 'maestros:ver' },
  { to: '/capacitaciones', label: 'Capacitaciones', icon: GraduationCap, permiso: 'capacitaciones:ver' },
  { to: '/equipo', label: 'Evaluaciones', icon: ClipboardList, permiso: 'equipo:ver' },
  { to: '/maestros/proveedores-capacitacion', label: 'Proveedores', icon: Store, permiso: 'maestros:ver' },
]

const adminNav: NavItemDef[] = [
  { to: '/admin/usuarios', label: 'Usuarios', icon: Users, permiso: 'usuarios:ver' },
  { to: '/admin/roles', label: 'Roles y permisos', icon: ShieldCheck, permiso: 'roles:ver' },
  { to: '/maestros/empresas', label: 'Empresas', icon: Factory, permiso: 'maestros:ver' },
  { to: '/maestros/departamentos', label: 'Departamentos', icon: Building2, permiso: 'maestros:ver' },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings, permiso: 'usuarios:editar' },
  { to: '/admin/auditoria', label: 'Auditoría', icon: ScrollText, permiso: 'roles:ver' },
]

const navGroupsBase: NavGroupDef[] = [
  { id: 'workspace', label: 'Workspace', icon: CalendarCheck, items: workspaceNav },
  { id: 'pm', label: 'Project Management', icon: Briefcase, items: pmNav },
  { id: 'rrhh', label: 'RRHH / Talento', icon: UsersRound, items: rrHHNav },
  { id: 'admin', label: 'Administración', icon: Shield, items: adminNav },
]

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  collapsed,
}: {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  collapsed: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
          collapsed && 'justify-center px-2',
          isActive
            ? 'bg-[var(--lime)] text-[var(--navy)] shadow-sm'
            : 'text-white/90 hover:bg-white/10 hover:text-white',
        )
      }
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  )
}

function itemMatches(to: string, end: boolean | undefined, pathname: string, search: string) {
  const [path, query] = to.split('?')
  if (query) {
    return pathname === path && (search === `?${query}` || search.includes(query))
  }
  if (end || path === '/') return pathname === path
  return pathname === path || pathname.startsWith(`${path}/`)
}

function groupHasActive(group: NavGroupDef, pathname: string, search: string) {
  return group.items.some((item) => itemMatches(item.to, item.end, pathname, search))
}

function NavGroup({
  group,
  collapsed,
  open,
  onToggle,
}: {
  group: NavGroupDef
  collapsed: boolean
  open: boolean
  onToggle: () => void
}) {
  if (group.items.length === 0) return null
  const { pathname, search } = useLocation()
  const active = groupHasActive(group, pathname, search)

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={onToggle}
        title={collapsed ? group.label : undefined}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors',
          collapsed && 'justify-center px-1',
          active ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white/80',
        )}
      >
        <group.icon className="size-4 shrink-0" aria-hidden />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-widest">
              {group.label}
            </span>
            <ChevronDown
              className={cn('size-3.5 shrink-0 transition-transform duration-200', open && 'rotate-180')}
              aria-hidden
            />
          </>
        )}
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-0.5 pt-0.5">
            {group.items.map(({ to, label, icon, end }) => (
              <NavItem key={`${to}-${label}`} to={to} label={label} icon={icon} end={end} collapsed={collapsed} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppSidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggle = useUiStore((s) => s.toggleSidebar)
  const hasPermiso = useAuthStore((s) => s.hasPermiso)
  const { pathname, search } = useLocation()
  const [openIds, setOpenIds] = useState<string[]>(['workspace'])
  const [areaNombre, setAreaNombre] = useState('Project Management & Talent')

  useEffect(() => {
    void fetchWorkspaceNombre().then(setAreaNombre).catch(() => {})
    function onNombre(ev: Event) {
      const detail = (ev as CustomEvent<string>).detail
      if (typeof detail === 'string' && detail.trim()) setAreaNombre(detail.trim())
    }
    window.addEventListener('rcj-workspace-nombre', onNombre)
    return () => window.removeEventListener('rcj-workspace-nombre', onNombre)
  }, [])

  const mostrarArqIT = hasPermiso('it:arquitectura:ver') || hasPermiso('*')
  const mostrarBiCosteo = hasPermiso('bi:costeo:ver') || hasPermiso('*')
  const mostrarGastosIt = hasPermiso('it:gastos:ver') || hasPermiso('*')

  const puedeVerItem = (item: NavItemDef) => cumplePermiso(item.permiso, hasPermiso)

  const navGroups: NavGroupDef[] = [
    ...navGroupsBase
      .map((g) => ({ ...g, items: g.items.filter(puedeVerItem) }))
      .filter((g) => g.items.length > 0),
    ...(mostrarGastosIt
      ? [
          {
            id: 'finanzas',
            label: 'Finanzas IT',
            icon: Wallet,
            items: [
              { to: '/it/gastos-dashboard', label: 'Dashboard de Gastos', icon: BarChart3 },
              { to: '/it/gastos-presupuesto', label: 'Presupuesto IT', icon: Target },
              { to: '/it/gastos-control', label: 'Control gastos IT', icon: Wallet },
            ],
          } satisfies NavGroupDef,
        ]
      : []),
    ...(mostrarBiCosteo
      ? [
          {
            id: 'bi',
            label: 'Business Intelligence',
            icon: PieChart,
            items: [{ to: '/bi/costeo-muestras', label: 'Costeo muestras', icon: FlaskConical }],
          } satisfies NavGroupDef,
        ]
      : []),
    ...(mostrarArqIT
      ? [
          {
            id: 'it',
            label: 'IT Técnico',
            icon: Server,
            items: [{ to: '/it/arquitectura', label: 'Arquitectura IT', icon: Server }],
          } satisfies NavGroupDef,
        ]
      : []),
    ...(!esPerfilSoloBiCosteo(hasPermiso)
      ? [{ id: 'ayuda', label: 'Ayuda', icon: BookMarked, items: ayudaNav } satisfies NavGroupDef]
      : []),
  ]

  const activeGroupId = navGroups.find((g) => groupHasActive(g, pathname, search))?.id

  useEffect(() => {
    if (!activeGroupId) return
    setOpenIds((prev) => (prev.includes(activeGroupId) ? prev : [...prev, activeGroupId]))
  }, [activeGroupId])

  function toggleGroup(id: string) {
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <aside
      className={cn(
        'flex h-svh shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[var(--navy)] text-white transition-[width] duration-200 ease-out',
        collapsed ? 'w-[72px]' : 'w-[240px]',
      )}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-3',
          collapsed && 'justify-center px-2',
        )}
      >
        <div className={cn('flex min-w-0 flex-1 flex-col leading-tight', collapsed && 'hidden')}>
          <span className="text-lg font-semibold tracking-tight text-[var(--navy)]">
            <span className="rounded bg-white px-1.5 py-0.5">RCJ</span>
          </span>
          <span className="text-xs font-medium leading-snug text-[var(--lime)]">
            {areaNombre}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggle}
          className={cn('shrink-0 text-white hover:bg-white/10 hover:text-white', collapsed && 'mx-auto')}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 py-2">
        <nav className="flex flex-col gap-0.5 px-2">
          {navGroups.map((group) => (
            <NavGroup
              key={group.id}
              group={group}
              collapsed={collapsed}
              open={openIds.includes(group.id)}
              onToggle={() => toggleGroup(group.id)}
            />
          ))}
        </nav>
      </ScrollArea>

      <Separator className="shrink-0 bg-white/10" />
      <div className={cn('shrink-0 p-2', collapsed && 'flex justify-center')}>
        <div
          className={cn(
            'flex items-center gap-2 rounded-md bg-white/5 px-3 py-2 text-xs text-white/70',
            collapsed && 'justify-center px-2',
          )}
        >
          <PanelLeft className="size-4 shrink-0 text-[var(--lime)]" />
          {!collapsed && <span>Plan IT 2026</span>}
        </div>
      </div>
    </aside>
  )
}
