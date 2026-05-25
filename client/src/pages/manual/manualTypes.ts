import type { ReactNode } from 'react'

export type ManualAudience =
  | 'todos'
  | 'operacion'
  | 'talento'
  | 'gastos'
  | 'coordinacion'
  | 'tecnico'

export type ManualSection = {
  id: string
  title: string
  content: ReactNode
}

export type ManualGuideDef = {
  slug: string
  title: string
  subtitle: string
  description: string
  audience: ManualAudience
  iconName: 'home' | 'layout' | 'folder' | 'target' | 'user' | 'users' | 'graduation' | 'wallet' | 'help' | 'settings' | 'server'
  sections: ManualSection[]
}

export const AUDIENCE_LABELS: Record<ManualAudience, string> = {
  todos: 'Todos los usuarios',
  operacion: 'Proyectos y seguimiento',
  talento: 'Talento y equipo',
  gastos: 'Presupuesto',
  coordinacion: 'Coordinadores y jefatura',
  tecnico: 'Soporte técnico (TI)',
}

export const AUDIENCE_ORDER: ManualAudience[] = [
  'todos',
  'operacion',
  'talento',
  'gastos',
  'coordinacion',
  'tecnico',
]
