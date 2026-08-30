'use client'

import { useEffect, useState } from 'react'
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { signIn } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const REMEMBER_KEY = 'nm_remember_email'

function safeStorage(): Storage | null {
  try {
    const ls = typeof window !== 'undefined' ? window.localStorage : null
    // Guard against partial/broken stubs (some test envs) and privacy modes.
    if (
      ls &&
      typeof ls.getItem === 'function' &&
      typeof ls.setItem === 'function' &&
      typeof ls.removeItem === 'function'
    ) {
      return ls
    }
    return null
  } catch {
    return null
  }
}

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [email, setEmail] = useState('')
  const [remember, setRemember] = useState(true)
  const [googlePending, setGooglePending] = useState(false)

  async function onGoogle() {
    setError(null)
    setGooglePending(true)
    try {
      const supabase = createClient()
      // PKCE: must run in the browser client so the code verifier cookie is
      // set here and readable by /auth/callback on the server.
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (oauthError) {
        setError(oauthError.message)
        setGooglePending(false)
      }
      // On success the browser navigates away to Google — leave pending on.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar con Google.')
      setGooglePending(false)
    }
  }

  // Prefill the remembered email on the client only (avoids SSR mismatch).
  useEffect(() => {
    const saved = safeStorage()?.getItem(REMEMBER_KEY)
    if (saved) {
      setEmail(saved)
      setRemember(true)
    }
  }, [])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    // Persist BEFORE the action — on success signIn redirects, so code after
    // the await may not run.
    const store = safeStorage()
    if (store) {
      if (remember && email.trim()) store.setItem(REMEMBER_KEY, email.trim())
      else store.removeItem(REMEMBER_KEY)
    }

    setError(null)
    setPending(true)
    try {
      const result = await signIn(formData)
      // On success the server action redirects; otherwise it returns { error }.
      if (result?.error) setError(result.error)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6 space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Bienvenido de nuevo</h2>
        <p className="text-sm text-muted-foreground">Entra a tu panel de Nate Media para seguir trabajando.</p>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onGoogle}
        disabled={googlePending}
        className="mb-4 h-11 w-full gap-2.5 text-sm font-semibold"
      >
        {googlePending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
            <path
              fill="#4285F4"
              d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
            />
          </svg>
        )}
        Continuar con Google
      </Button>

      <div className="mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" aria-hidden />
        <span className="text-xs text-muted-foreground">o con tu correo</span>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="tu@natemedia.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 pl-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              className="h-11 px-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="remember"
            value="1"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          Mantener sesión iniciada
        </label>

        <Button type="submit" className="h-11 w-full text-sm font-semibold shadow-sm shadow-primary/20" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Entrando…
            </>
          ) : (
            'Iniciar sesión'
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        ¿Problemas para entrar? Escríbele a un administrador de Nate Media.
      </p>
    </div>
  )
}
