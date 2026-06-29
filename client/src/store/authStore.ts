import { create } from 'zustand'

export type AuthUser = {
  _id: string
  nombre: string
  email: string
  rol: string
  permisos: string[]
  /** Identidad del usuario en el maestro de empleados (su "número de empleado"). */
  empleado_id?: string | null
  empleado_nombre?: string | null
  empleado_codigo?: string | null
  /** Departamento asignado al usuario (no al empleado). */
  departamento_id?: string | null
  departamento_codigo?: string | null
  departamento_nombre?: string | null
  /** Si su departamento maneja presupuesto/gastos. */
  departamento_lleva_gastos?: boolean
}

type AuthState = {
  token: string | null
  user: AuthUser | null
  setAuth: (token: string, user: AuthUser) => void
  /** Actualiza el usuario sin tocar el token (útil para refrescar permisos/departamento). */
  setUser: (user: AuthUser) => void
  clearAuth: () => void
  hasPermiso: (permiso: string) => boolean
  hasAnyPermiso: (permisos: string[]) => boolean
}

const TOKEN_KEY = 'rcj_token'
const USER_KEY = 'rcj_user'

function loadFromStorage(): { token: string | null; user: AuthUser | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const raw = localStorage.getItem(USER_KEY)
    const user = raw ? (JSON.parse(raw) as AuthUser) : null
    return { token, user }
  } catch {
    return { token: null, user: null }
  }
}

const stored = loadFromStorage()

export const useAuthStore = create<AuthState>((set, get) => ({
  token: stored.token,
  user: stored.user,

  setAuth: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    set({ token, user })
  },

  setUser: (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    set({ user })
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    set({ token: null, user: null })
  },

  hasPermiso: (permiso: string) => {
    const { user } = get()
    if (!user) return false
    return user.permisos.includes('*') || user.permisos.includes(permiso)
  },

  hasAnyPermiso: (permisos: string[]) => {
    const { user } = get()
    if (!user) return false
    if (user.permisos.includes('*')) return true
    return permisos.some((p) => user.permisos.includes(p))
  },
}))
