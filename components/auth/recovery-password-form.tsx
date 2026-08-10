'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, KeyRound, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { validateNewPassword } from '@/lib/utils/password-core'
import { recoveryTokensFromHref } from '@/lib/utils/recovery-core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type RecoveryState = 'checking' | 'ready' | 'invalid'

export function RecoveryPasswordForm() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<RecoveryState>('checking')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let mounted = true
    const finish = (hasSession: boolean) => {
      if (mounted) setState(hasSession ? 'ready' : 'invalid')
    }

    const recoveryTokens = recoveryTokensFromHref(window.location.href)
    const sessionPromise = recoveryTokens
      ? supabase.auth.setSession({
          access_token: recoveryTokens.accessToken,
          refresh_token: recoveryTokens.refreshToken,
        })
      : supabase.auth.getSession()

    sessionPromise.then(({ data, error: sessionError }) => {
      if (!sessionError && data.session && recoveryTokens) {
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
      }
      finish(!sessionError && Boolean(data.session))
    })

    // The browser client emits PASSWORD_RECOVERY after consuming a hash token.
    // Listen as well as calling getSession so the form works on a cold load.
    const listener = supabase.auth.onAuthStateChange?.((_event, session) => {
      if (session) finish(true)
    })

    return () => {
      mounted = false
      listener?.data.subscription.unsubscribe()
    }
  }, [supabase])

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const valid = validateNewPassword(next)
    if (!valid.ok) {
      setError(valid.error)
      return
    }
    if (next !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setPending(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: next })
    if (updateError) {
      setError(updateError.message)
      setPending(false)
      return
    }

    // End the one-time recovery session and make the user sign in normally.
    await supabase.auth.signOut()
    router.replace('/login?reset=1')
  }

  if (state === 'checking') {
    return <p className="text-center text-sm text-muted-foreground">Validando el enlace…</p>
  }

  if (state === 'invalid') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" aria-hidden />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Enlace no disponible</h2>
          <p className="text-sm text-muted-foreground">
            El enlace de recuperación expiró o ya fue utilizado. Solicita uno nuevo a un administrador.
          </p>
        </div>
        <a className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/login">
          Volver al inicio de sesión
        </a>
      </div>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-xl font-bold">
          <KeyRound className="h-5 w-5 text-primary" />
          Establecer contraseña
        </CardTitle>
        <CardDescription>Elige una contraseña nueva para tu cuenta de Nate Media.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="recovery-next">Nueva contraseña</Label>
            <Input
              id="recovery-next"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="Al menos 8 caracteres"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recovery-confirm">Confirmar nueva contraseña</Label>
            <Input
              id="recovery-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar contraseña
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
