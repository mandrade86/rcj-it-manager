import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loginApi } from '@/lib/api/auth'
import { useAuthStore } from '@/store/authStore'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const token = useAuthStore((s) => s.token)
  const setAuth = useAuthStore((s) => s.setAuth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (token) return <Navigate to={from} replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setLoading(true)
    try {
      const { token: tok, user } = await loginApi(email.trim(), password)
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
            <p className="mb-6 text-sm text-muted-foreground">Inicia sesión con tu cuenta corporativa.</p>

            {err && (
              <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="usuario@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
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
                {loading ? 'Ingresando…' : 'Iniciar sesión'}
              </Button>
            </form>

            <div className="mt-6 rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium">Acceso inicial:</p>
              <p>Usuario: <code className="rounded bg-background px-1">admin@rcj.hn</code></p>
              <p>Contraseña: <code className="rounded bg-background px-1">Admin2026!</code></p>
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
