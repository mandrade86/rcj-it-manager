import {
  GraduationCap,
  HelpCircle,
  Home,
  LayoutDashboard,
  FolderKanban,
  Server,
  Settings,
  Target,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { capacitacionesSections } from '@/pages/manual/content/capacitaciones'
import { coordinacionSections } from '@/pages/manual/content/coordinacion'
import { equipoTalentoSections } from '@/pages/manual/content/equipoTalento'
import { gastosSections } from '@/pages/manual/content/gastos'
import { kpisMetasSections } from '@/pages/manual/content/kpisMetas'
import { miEspacioSections } from '@/pages/manual/content/miEspacio'
import { panelInicioSections } from '@/pages/manual/content/panelInicio'
import { preguntasFrecuentesSections } from '@/pages/manual/content/preguntasFrecuentes'
import { primerosPasosSections } from '@/pages/manual/content/primerosPasos'
import { proyectosSections } from '@/pages/manual/content/proyectos'
import { soporteTecnicoSections } from '@/pages/manual/content/soporteTecnico'
import type { ManualGuideDef } from '@/pages/manual/manualTypes'

const ICONS: Record<ManualGuideDef['iconName'], LucideIcon> = {
  home: Home,
  layout: LayoutDashboard,
  folder: FolderKanban,
  target: Target,
  user: User,
  users: Users,
  graduation: GraduationCap,
  wallet: Wallet,
  help: HelpCircle,
  settings: Settings,
  server: Server,
}

export const MANUAL_GUIDES: ManualGuideDef[] = [
  {
    slug: 'primeros-pasos',
    title: 'Primeros pasos',
    subtitle: 'Empiece aquí si es la primera vez',
    description: 'Qué es la plataforma, cómo entrar, el menú y cerrar sesión.',
    audience: 'todos',
    iconName: 'home',
    sections: primerosPasosSections,
  },
  {
    slug: 'panel-inicio',
    title: 'Panel de inicio (Dashboard)',
    subtitle: 'Leer el resumen del día',
    description: 'Tarjetas, gráficas, metas del año y tareas por vencer.',
    audience: 'todos',
    iconName: 'layout',
    sections: panelInicioSections,
  },
  {
    slug: 'proyectos',
    title: 'Proyectos y tareas',
    subtitle: 'Planificar y dar seguimiento',
    description: 'Crear proyectos, agregar tareas, usar el calendario y el avance.',
    audience: 'operacion',
    iconName: 'folder',
    sections: proyectosSections,
  },
  {
    slug: 'kpis-metas',
    title: 'Indicadores (KPIs) y metas',
    subtitle: 'Medir resultados del plan',
    description: 'Registrar valores, conectar proyectos con indicadores y ver metas.',
    audience: 'operacion',
    iconName: 'target',
    sections: kpisMetasSections,
  },
  {
    slug: 'mi-espacio',
    title: 'Mi espacio',
    subtitle: 'Para cada colaborador',
    description: 'Consultar su desempeño y sus capacitaciones asignadas.',
    audience: 'todos',
    iconName: 'user',
    sections: miEspacioSections,
  },
  {
    slug: 'equipo-talento',
    title: 'Equipo y evaluaciones',
    subtitle: 'Para jefes y coordinadores',
    description: 'Organigrama, perfiles, evaluaciones y planes de carrera.',
    audience: 'talento',
    iconName: 'users',
    sections: equipoTalentoSections,
  },
  {
    slug: 'capacitaciones',
    title: 'Capacitaciones',
    subtitle: 'Cursos y entrenamientos',
    description: 'Crear cursos, asignar personas y dar seguimiento.',
    audience: 'talento',
    iconName: 'graduation',
    sections: capacitacionesSections,
  },
  {
    slug: 'gastos',
    title: 'Gastos de tecnología',
    subtitle: 'Consultar presupuesto',
    description: 'Sincronizar y leer el presupuesto TI sin capturar datos a mano.',
    audience: 'gastos',
    iconName: 'wallet',
    sections: gastosSections,
  },
  {
    slug: 'coordinacion',
    title: 'Configuración para coordinadores',
    subtitle: 'Catálogos y permisos',
    description: 'Metas del departamento, categorías, usuarios y roles.',
    audience: 'coordinacion',
    iconName: 'settings',
    sections: coordinacionSections,
  },
  {
    slug: 'preguntas-frecuentes',
    title: 'Preguntas frecuentes',
    subtitle: 'Problemas comunes',
    description: 'Acceso, menú, KPIs, avance y a quién pedir ayuda.',
    audience: 'todos',
    iconName: 'help',
    sections: preguntasFrecuentesSections,
  },
  {
    slug: 'soporte-tecnico',
    title: 'Soporte técnico (TI)',
    subtitle: 'Instalación y mantenimiento',
    description: 'MongoDB, iniciar el sistema y archivos de gastos. Solo personal de TI.',
    audience: 'tecnico',
    iconName: 'server',
    sections: soporteTecnicoSections,
  },
]

export function getManualGuide(slug: string): ManualGuideDef | undefined {
  return MANUAL_GUIDES.find((g) => g.slug === slug)
}

export function getManualGuideIcon(name: ManualGuideDef['iconName']): LucideIcon {
  return ICONS[name]
}
