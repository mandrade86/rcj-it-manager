import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, Lock, LogIn, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  fetchAuthLoginConfig,
  loginApi,
  loginCodigoApi,
  solicitarCodigoApi,
  type AuthLoginConfig,
} from '@/lib/api/auth'
import { resolvePostLoginPath } from '@/lib/permisosNav'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

type Modo = 'password' | 'codigo'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const hasPermiso = useAuthStore((s) => s.hasPermiso)
  const setAuth = useAuthStore((s) => s.setAuth)

  const [modo, setModo] = useState<Modo>('password')
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [codigo, setCodigo] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [enviandoCodigo, setEnviandoCodigo] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
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

  if (token) {
    const dest = resolvePostLoginPath(from, hasPermiso, {
      llevaGastos: Boolean(user?.departamento_lleva_gastos),
    })
    return <Navigate to={dest} replace />
  }

  const subtitle =
    modo === 'codigo'
      ? 'Usa el código de 6 dígitos que te enviaron por correo.'
      : (authConfig?.helpText
        ?? 'Inicia sesión con el correo y contraseña de tu cuenta en IT Manager.')

  function completarLogin(tok: string, loggedIn: Parameters<typeof setAuth>[1]) {
    setAuth(tok, loggedIn)
    const has = (p: string) => (p === '*' ? loggedIn.permisos.includes('*') : loggedIn.permisos.includes(p))
    const dest = resolvePostLoginPath(from, has, {
      llevaGastos: Boolean(loggedIn.departamento_lleva_gastos),
    })
    navigate(dest, { replace: true })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr(null)
    setInfo(null)

    const formEl = e.currentTarget
    const fd = new FormData(formEl)
    const usuarioVal = String(fd.get('username') ?? usuario).trim()

    if (!usuarioVal) {
      setErr('Indica tu correo electrónico registrado en IT Manager.')
      return
    }

    setUsuario(usuarioVal)
    setLoading(true)
    try {
      if (modo === 'codigo') {
        const codigoVal = String(fd.get('codigo') ?? codigo).trim()
        if (!codigoVal || codigoVal.length < 6) {
          setErr('Indica el código de 6 dígitos.')
          return
        }
        setCodigo(codigoVal)
        const { token: tok, user: loggedIn } = await loginCodigoApi(usuarioVal, codigoVal)
        completarLogin(tok, loggedIn)
      } else {
        const passwordVal = String(fd.get('password') ?? password)
        if (!passwordVal) {
          setErr('Indica tu contraseña.')
          return
        }
        setPassword(passwordVal)
        const { token: tok, user: loggedIn } = await loginApi(usuarioVal, passwordVal)
        completarLogin(tok, loggedIn)
      }
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

  async function handlePedirCodigo() {
    setErr(null)
    setInfo(null)
    const email = usuario.trim()
    if (!email || !email.includes('@')) {
      setErr('Escribe tu correo y luego pide el código.')
      return
    }
    setEnviandoCodigo(true)
    try {
      const r = await solicitarCodigoApi(email)
      setInfo(r.mensaje)
      setModo('codigo')
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'No se pudo enviar el código')
    } finally {
      setEnviandoCodigo(false)
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
            <p className="mb-4 text-sm text-muted-foreground">{subtitle}</p>

            <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              <button
                type="button"
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition',
                  modo === 'password' ? 'bg-white text-[var(--navy)] shadow-sm' : 'text-muted-foreground',
                )}
                onClick={() => { setModo('password'); setErr(null); setInfo(null) }}
              >
                Contraseña
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition',
                  modo === 'codigo' ? 'bg-white text-[var(--navy)] shadow-sm' : 'text-muted-foreground',
                )}
                onClick={() => { setModo('codigo'); setErr(null); setInfo(null) }}
              >
                Código de acceso
              </button>
            </div>

            {err && (
              <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            {info && (
              <div className="mb-4 rounded-md bg-[var(--lime-lt)] px-3 py-2 text-sm text-[var(--navy)]">
                {info}
              </div>
            )}

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
              <div className="grid gap-2">
                <Label htmlFor="usuario">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="usuario"
                    name="username"
                    type="email"
                    autoComplete="username"
                    placeholder={authConfig?.usernameHint ?? 'nombre.apellido@rcjcorp.com'}
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
              </div>

              {modo === 'password' ? (
                <div className="grid gap-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type={showPwd ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Contraseña de IT Manager"
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
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="codigo">Código de 6 dígitos</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="codigo"
                      name="codigo"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      maxLength={8}
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="pl-9 tracking-[0.3em]"
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full gap-2 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
              >
                <LogIn className="size-4" />
                {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
              </Button>
            </form>

            <div className="mt-4 space-y-2 text-center text-xs text-muted-foreground">
              <button
                type="button"
                className="text-[var(--navy)] underline-offset-2 hover:underline disabled:opacity-50"
                disabled={enviandoCodigo}
                onClick={() => void handlePedirCodigo()}
              >
                {enviandoCodigo ? 'Enviando…' : 'Enviarme un código al correo'}
              </button>
              <p>Si no tienes acceso, solicita tu usuario al área de IT.</p>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-white/40">
          © {new Date().getFullYear()} RCJ Corporación · Uso interno
        </p>
      </div>
    </div>
  )
}
