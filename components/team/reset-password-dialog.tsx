'use client'

import { useState, useTransition } from 'react'
import { KeyRound, Loader2, RefreshCw, Copy, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/lib/hooks/use-toast'
import { resetUserPassword } from '@/lib/actions/users'
import { makeTempPassword } from '@/lib/utils/temp-password'
import { MIN_PASSWORD_LENGTH } from '@/lib/utils/password-core'

/**
 * Asigna una contraseña nueva desde Usuarios. Se queda abierta después de
 * guardar para que se pueda copiar: Auth no la vuelve a mostrar.
 */
export function ResetPasswordDialog({
  userId,
  userName,
  userEmail,
}: {
  userId: string
  userName: string
  userEmail: string
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState(makeTempPassword())
  const [visible, setVisible] = useState(true)
  const [copied, setCopied] = useState(false)
  const [assigned, setAssigned] = useState(false)
  const [isPending, startTransition] = useTransition()

  function resetDraft() {
    setPassword(makeTempPassword())
    setVisible(true)
    setCopied(false)
    setAssigned(false)
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast({
        title: 'No se pudo copiar',
        description: 'Selecciona la contraseña y cópiala a mano.',
        variant: 'destructive',
      })
    }
  }

  function submit() {
    startTransition(async () => {
      const res = await resetUserPassword(userId, password)
      if (res.error) {
        toast({ title: 'No se pudo asignar', description: res.error, variant: 'destructive' })
        return
      }
      setAssigned(true)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) resetDraft()
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 whitespace-nowrap text-muted-foreground"
          aria-label={`Nueva contraseña de ${userName}`}
        >
          <KeyRound className="mr-1 h-3.5 w-3.5" />
          Nueva contraseña
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar contraseña</DialogTitle>
          <DialogDescription>
            {assigned
              ? 'La clave sigue visible para copiarla. No se vuelve a mostrar al cerrar.'
              : <>Contraseña nueva para <strong>{userName}</strong> ({userEmail}). Compártela por un canal privado. Al cerrar esta ventana no se vuelve a mostrar.</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label htmlFor="admin-new-password" className="flex flex-col gap-1 text-xs text-muted-foreground">
            Nueva contraseña
            <div className="flex items-center gap-1.5">
              <Input
                id="admin-new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                readOnly={assigned}
                type={visible ? 'text' : 'password'}
                autoComplete="new-password"
                spellCheck={false}
                className="h-9 font-mono text-sm"
              />
              {!assigned && (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="h-9 w-9 shrink-0"
                  >
                    {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => { setPassword(makeTempPassword()); setCopied(false) }}
                    aria-label="Generar otra"
                    disabled={isPending}
                    className="h-9 w-9 shrink-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={copyPassword}
                aria-label="Copiar contraseña"
                className="h-9 w-9 shrink-0"
              >
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </label>

          <p className="text-xs text-muted-foreground">
            Mínimo {MIN_PASSWORD_LENGTH} caracteres. La persona entra con esta contraseña y puede cambiarla en Cuenta → Seguridad.
          </p>

          {assigned && (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              Contraseña asignada. La anterior ya no sirve para entrar. Si tiene el dashboard abierto, que cierre sesión desde el menú.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            {assigned ? (
              <Button size="sm" onClick={() => setOpen(false)}>
                Listo
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={submit} disabled={isPending || password.length < MIN_PASSWORD_LENGTH}>
                  {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <KeyRound className="mr-1.5 h-3.5 w-3.5" />}
                  Asignar contraseña
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
