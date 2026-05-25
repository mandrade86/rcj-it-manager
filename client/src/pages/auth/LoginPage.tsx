import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, LogIn, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchAuthLoginConfig, loginApi, type AuthLoginConfig } from '@/lib/api/auth'
import { useAuthStore } from '@/store/authStore'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const token = useAuthStore((s) => s.token)
  const setAuth = useAuthStore((s) => s.setAuth)

  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [authConfig, setAuthConfig] = useState<AuthLoginConfig | null>(null)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  useEffect(() => {
    fetchAuthLoginConfig()
      .then(setAuthConfig)
      .catch(() =>
        setAuthConfig({
          activeDirectory: true,
          providerLabel: 'Active Directory RCJ',
          usernameHint: 'usuario@rcjcorp.com',
          localFallback: false,
          emailDomains: ['rcjcorp.com'],
        }),
      )
  }, [])

  if (token) return <Navigate to={from} replace />

  const adEnabled = authConfig?.activeDirectory !== false
  const subtitle = adEnabled
    ? `Inicia sesión con tus credenciales de ${authConfig?.providerLabel ?? 'Active Directory'}.`
    : 'Inicia sesión con tu usuario y contraseña de IT Manager.'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      const { token: tok, user } = await loginApi(usuario.trim(), password)
      setAuth(tok, user)
      navigate(from, { replace: true })
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--navy)] via-[#001440] to-[var(--navy)] p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 inline-flex items-center gap-2">
            <span className="rounded bg-white px-2.5 py-1 text-2xl font-bold tracking-tight text-[var(--navy)]">
              RCJ
            </span>
            <span className="text-lg font-semibold leading-tight text-[var(--lime)]">
              Project Management &amp; Talent
            </span>
          </div>
          <p className="text-sm text-white/60">Plan IT 2026 — Acceso a la plataforma</p>
        </div>

        <Card className="border-white/10 bg-white shadow-2xl">
          <CardContent className="p-6">
            <h2 className="mb-1 text-xl font-semibold">Bienvenida</h2>
            <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p>

            {err && (
              <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="usuario">
                  {adEnabled ? 'Usuario corporativo' : 'Correo electrónico'}
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="usuario"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    placeholder={authConfig?.usernameHint ?? 'usuario@rcjcorp.com'}
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="Contraseña de Windows / dominio"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full gap-2 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
              >
                <LogIn className="size-4" />
                {loading ? 'Validando…' : 'Iniciar sesión'}
              </Button>
            </form>

            {adEnabled && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Autenticación unificada con Active Directory. Debes tener un usuario activo en IT
                Manager (Maestros → Usuarios).
              </p>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-white/40">
          © {new Date().getFullYear()} RCJ Corporación · Uso interno
        </p>
      </div>
    </div>
  )
}
