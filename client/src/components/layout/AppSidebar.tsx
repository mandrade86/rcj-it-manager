import type { LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  BookMarked,
  Building2,
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
  PanelLeft,
  Route,
  Shield,
  ShieldCheck,
  Tags,
  Target,
  Users,
  UsersRound,
  Wallet,
  Briefcase,
  Layers,
  Server,
  Store,
  PieChart,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { cumplePermiso } from '@/lib/permisosNav'
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

const dashboardNav: NavItemDef = {
  to: '/',
  label: 'Dashboard',
  icon: LayoutDashboard,
  end: true,
  permiso: 'dashboard:ver',
}

const operacionNav: NavItemDef[] = [
  { to: '/resumen-departamento', label: 'Resumen metas y plan', icon: BarChart3, permiso: 'dashboard:ver' },
  { to: '/proyectos', label: 'Proyectos', icon: FolderKanban, permiso: 'proyectos:ver' },
  { to: '/proyectos?vista=roadmap', label: 'Roadmap', icon: Map, permiso: 'proyectos:ver' },
  { to: '/reportes', label: 'Reportería', icon: FileText, permiso: 'proyectos:ver' },
  { to: '/equipo', label: 'Equipo', icon: Users, permiso: 'equipo:ver' },
  { to: '/kpis', label: 'KPIs', icon: Target, permiso: 'kpis:ver' },
]

const gastosNav: NavItemDef = {
  to: '/gastos',
  label: 'Gastos',
  icon: Wallet,
  permiso: 'gastos:ver',
}

const talentoNav: NavItemDef[] = [
  { to: '/maestros/empleados', label: 'Empleados', icon: UsersRound, permiso: 'empleados:ver' },
  { to: '/maestros/planes-carrera', label: 'Plan de carrera', icon: Route, permiso: 'maestros:ver' },
  { to: '/maestros/perfiles-puesto', label: 'Perfiles de puesto', icon: BookOpen, permiso: 'maestros:ver' },
  { to: '/capacitaciones', label: 'Capacitaciones', icon: GraduationCap, permiso: 'capacitaciones:ver' },
  { to: '/maestros/proveedores-capacitacion', label: 'Proveedores', icon: Store, permiso: 'maestros:ver' },
]

const estructuraNav: NavItemDef[] = [
  { to: '/maestros/departamentos', label: 'Departamentos', icon: Building2, permiso: 'maestros:ver' },
  { to: '/maestros/empresas', label: 'Empresas', icon: Factory, permiso: 'maestros:ver' },
  { to: '/maestros/ejes-proyecto', label: 'Ejes de proyecto', icon: Tags, permiso: 'maestros:ver' },
  { to: '/maestros/metas', label: 'Objetivos estratégicos', icon: Target, permiso: 'maestros:ver' },
]

const adminNav: { to: string; label: string; icon: LucideIcon; permiso: string }[] = [
  { to: '/admin/usuarios', label: 'Usuarios', icon: Users, permiso: 'usuarios:ver' },
  { to: '/admin/roles', label: 'Roles y permisos', icon: ShieldCheck, permiso: 'roles:ver' },
]

const navGroupsBase: NavGroupDef[] = [
  { id: 'operacion', label: 'Operación', icon: Briefcase, items: operacionNav },
  { id: 'talento', label: 'Talento', icon: UsersRound, items: talentoNav },
  { id: 'estructura', label: 'Estructura', icon: Layers, items: estructuraNav },
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

function GroupLabel({ icon: Icon, label, collapsed }: { icon: LucideIcon; label: string; collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="mb-1 mt-3 flex justify-center">
        <Icon className="size-4 text-white/40" />
      </div>
    )
  }
  return (
    <div className="mb-1 mt-3 flex items-center gap-2 px-2">
      <Icon className="size-3.5 text-white/40" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
        {label}
      </span>
    </div>
  )
}

function NavGroup({
  group,
  collapsed,
}: {
  group: NavGroupDef
  collapsed: boolean
}) {
  if (group.items.length === 0) return null

  return (
    <>
      <GroupLabel icon={group.icon} label={group.label} collapsed={collapsed} />
      <div className="flex flex-col gap-0.5">
        {group.items.map(({ to, label, icon, end }) => (
          <NavItem key={to} to={to} label={label} icon={icon} end={end} collapsed={collapsed} />
        ))}
      </div>
    </>
  )
}

export function AppSidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggle = useUiStore((s) => s.toggleSidebar)
  const hasPermiso = useAuthStore((s) => s.hasPermiso)
  const user = useAuthStore((s) => s.user)

  const adminItems = adminNav.filter((i) => hasPermiso(i.permiso))
  const mostrarArqIT = hasPermiso('it:arquitectura:ver') || hasPermiso('*')
  const mostrarBiCosteo = hasPermiso('bi:costeo:ver') || hasPermiso('*')

  const isAdmin = hasPermiso('*')
  const llevaGastos = Boolean(user?.departamento_lleva_gastos)

  const puedeVerItem = (item: NavItemDef) =>
    cumplePermiso(item.permiso, hasPermiso, {
      llevaGastos: item.permiso === 'gastos:ver' && llevaGastos,
    })

  const navGroups = navGroupsBase
    .map((g) => {
      if (g.id !== 'operacion') return g
      const items = [...g.items]
      if (isAdmin || llevaGastos || hasPermiso('gastos:ver')) {
        items.push(gastosNav)
      }
      return { ...g, items }
    })
    .map((g) => ({ ...g, items: g.items.filter(puedeVerItem) }))
    .filter((g) => g.items.length > 0)

  const mostrarDashboard = puedeVerItem(dashboardNav)

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-white/10 bg-[var(--navy)] text-white transition-[width] duration-200 ease-out',
        collapsed ? 'w-[72px]' : 'w-[240px]',
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center gap-2 border-b border-white/10 px-3',
          collapsed && 'justify-center px-2',
        )}
      >
        <div className={cn('flex min-w-0 flex-1 flex-col leading-tight', collapsed && 'hidden')}>
          <span className="text-lg font-semibold tracking-tight text-[var(--navy)]">
            <span className="rounded bg-white px-1.5 py-0.5">RCJ</span>
          </span>
          <span className="text-xs font-medium leading-snug text-[var(--lime)]">
            Project Management
            <br />
            &amp; Talent
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

      <ScrollArea className="flex-1 py-2">
        <nav className="flex flex-col gap-0.5 px-2">
          {mostrarDashboard && (
            <NavItem
              to={dashboardNav.to}
              label={dashboardNav.label}
              icon={dashboardNav.icon}
              end={dashboardNav.end}
              collapsed={collapsed}
            />
          )}

          {navGroups.map((group) => (
            <NavGroup key={group.id} group={group} collapsed={collapsed} />
          ))}

          {mostrarBiCosteo && (
            <>
              <GroupLabel icon={PieChart} label="Business Intelligence" collapsed={collapsed} />
              <div className="flex flex-col gap-0.5">
                <NavItem to="/bi/costeo-muestras" label="Costeo muestras" icon={FlaskConical} collapsed={collapsed} />
              </div>
            </>
          )}

          {mostrarArqIT && (
            <>
              <GroupLabel icon={Server} label="IT Técnico" collapsed={collapsed} />
              <div className="flex flex-col gap-0.5">
                <NavItem to="/it/arquitectura" label="Arquitectura IT" icon={Server} collapsed={collapsed} />
              </div>
            </>
          )}

          {adminItems.length > 0 && (
            <>
              <GroupLabel icon={Shield} label="Administración" collapsed={collapsed} />
              <div className="flex flex-col gap-0.5">
                {adminItems.map(({ to, label, icon }) => (
                  <NavItem key={to} to={to} label={label} icon={icon} collapsed={collapsed} />
                ))}
              </div>
            </>
          )}

          <GroupLabel icon={BookMarked} label="Ayuda" collapsed={collapsed} />
          <div className="flex flex-col gap-0.5">
            {ayudaNav.map(({ to, label, icon, end }) => (
              <NavItem key={to} to={to} label={label} icon={icon} end={end} collapsed={collapsed} />
            ))}
          </div>
        </nav>
      </ScrollArea>

      <Separator className="bg-white/10" />
      <div className={cn('p-2', collapsed && 'flex justify-center')}>
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
