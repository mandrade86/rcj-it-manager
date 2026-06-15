import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react'

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
          activeDirectory: false,
          platformLogin: true,
          providerLabel: 'IT Manager',
          usernameHint: 'nombre.apellido@rcjcorp.com',
          localFallback: true,
          emailDomains: ['rcjcorp.com'],
          helpText:
            'Inicia sesión con el correo y contraseña asignados a tu usuario en IT Manager.',
        }),
      )
  }, [])

  if (token) return <Navigate to={from} replace />

  const adEnabled = authConfig?.activeDirectory === true
  const subtitle =
    authConfig?.helpText ??
    'Inicia sesión con el correo y contraseña de tu cuenta en IT Manager.'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr(null)

    const formEl = e.currentTarget
    const fd = new FormData(formEl)
    const usuarioVal = String(fd.get('username') ?? usuario).trim()
    const passwordVal = String(fd.get('password') ?? password)

    if (!usuarioVal) {
      setErr(
        adEnabled
          ? 'Indica tu usuario de Windows (ej. RCJ\\nombre.apellido o nombre.apellido@rcjcorp.com).'
          : 'Indica tu correo electrónico registrado en IT Manager.',
      )
      return
    }
    if (!passwordVal) {
      setErr(adEnabled ? 'Indica tu contraseña de Windows / dominio.' : 'Indica tu contraseña.')
      return
    }

    setUsuario(usuarioVal)
    setPassword(passwordVal)
    setLoading(true)
    try {
      const { token: tok, user } = await loginApi(usuarioVal, passwordVal)
      setAuth(tok, user)
      navigate(from, { replace: true })
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : 'No se pudo iniciar sesión'
      if (msg.includes('502') || msg.includes('Failed to fetch') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) {
        setErr('No se pudo contactar al servidor. Reinicia con Ctrl+C y npm run dev, espera a ver "API lista" y vuelve a intentar.')
      } else {
        setErr(msg)
      }
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

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
              <div className="grid gap-2">
                <Label htmlFor="usuario">
                  {adEnabled ? 'Usuario de Windows / dominio' : 'Correo electrónico'}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="usuario"
                    name="username"
                    type={adEnabled ? 'text' : 'email'}
                    autoComplete="username"
                    placeholder={authConfig?.usernameHint ?? 'nombre.apellido@rcjcorp.com'}
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
                {adEnabled ? (
                  <p className="text-xs text-muted-foreground">
                    Usa las mismas credenciales con las que entras a Windows.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Usa el correo con el que te dieron de alta en Maestros → Usuarios.
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">
                  {adEnabled ? 'Contraseña de Windows' : 'Contraseña'}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={adEnabled ? 'Contraseña de dominio' : 'Contraseña de IT Manager'}
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
                {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
              </Button>
            </form>

            {!adEnabled && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Si no tienes acceso, solicita tu usuario al área de IT.
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
