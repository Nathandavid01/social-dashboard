'use client'

import { useEffect, useRef, useState } from 'react'
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'
import { signIn } from '@/lib/actions/auth'
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
  const submitting = useRef(false)
  const [email, setEmail] = useState('')

  // Prefill the remembered email on the client only (avoids SSR mismatch).
  useEffect(() => {
    const saved = safeStorage()?.getItem(REMEMBER_KEY)
    if (saved) setEmail(saved)
  }, [])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting.current) return
    submitting.current = true
    const formData = new FormData(e.currentTarget)

    // Persist BEFORE the action — on success signIn redirects, so code after
    // the await may not run.
    const store = safeStorage()
    try {
      if (store && email.trim()) store.setItem(REMEMBER_KEY, email.trim())
    } catch {
      // Remembering the email is optional; storage restrictions must not block login.
    }

    setError(null)
    setPending(true)
    try {
      const result = await signIn(formData)
      // On success the server action redirects; otherwise it returns { error }.
      if (result?.error) setError(result.error)
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <div className="w-full">
      <div className="mb-5 space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Bienvenido de nuevo</h2>
        <p className="text-sm text-muted-foreground">Entra a tu panel de Nate Media para seguir trabajando.</p>
      </div>

      <form aria-label="Acceso a Nate Media" aria-busy={pending} onSubmit={onSubmit} className="space-y-4">
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
              className="h-12 rounded-xl bg-background/60 pl-10 text-base md:text-base"
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
              className="h-12 rounded-xl bg-background/60 pl-10 pr-12 text-base md:text-base"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <input type="hidden" name="remember" value="1" />
        <p className="flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3.5 py-3 text-xs leading-5 text-muted-foreground">
          <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>Tu sesión se mantiene en este dispositivo hasta que cierres sesión.</span>
        </p>

        <Button type="submit" className="h-12 w-full rounded-xl text-sm font-semibold shadow-lg shadow-primary/10" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Entrando…
            </>
          ) : (
            'Iniciar sesión'
          )}
        </Button>
      </form>

      <p className="mt-5 border-t border-border/60 pt-4 text-center text-xs leading-5 text-muted-foreground">
        ¿Problemas para entrar? Escríbele a un administrador de Nate Media.
      </p>
    </div>
  )
}
