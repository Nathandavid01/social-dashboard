'use client'

import { useState, useTransition } from 'react'
import { KeyRound, Loader2, RefreshCw, Copy, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/lib/hooks/use-toast'
import { resetUserPassword } from '@/lib/actions/users'
import { makeTempPassword } from '@/lib/utils/temp-password'
import { MIN_PASSWORD_LENGTH } from '@/lib/utils/password-core'

/** Owner action: set a new temporary password for a user who forgot theirs. */
export function ResetPasswordDialog({ userId, userName }: { userId: string; userName: string }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState(makeTempPassword())
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function copyPassword() {
    navigator.clipboard?.writeText(password).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function submit() {
    startTransition(async () => {
      const res = await resetUserPassword(userId, password)
      if (res.error) {
        toast({ title: 'No se pudo resetear', description: res.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Contraseña reseteada', description: `Comparte la nueva contraseña con ${userName}. La cambia al entrar.` })
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setPassword(makeTempPassword()); setCopied(false) } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 whitespace-nowrap text-muted-foreground">
          <KeyRound className="mr-1 h-3.5 w-3.5" />
          Contraseña
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resetear contraseña</DialogTitle>
          <DialogDescription>
            Genera una contraseña temporal para <strong>{userName}</strong> y compártela. El usuario la cambia al entrar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Nueva contraseña temporal
            <div className="flex items-center gap-1.5">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} className="h-9 font-mono text-sm" />
              <Button type="button" size="icon" variant="outline" onClick={() => setPassword(makeTempPassword())} aria-label="Generar otra" className="h-9 w-9 shrink-0">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="outline" onClick={copyPassword} aria-label="Copiar contraseña" className="h-9 w-9 shrink-0">
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button size="sm" onClick={submit} disabled={isPending || password.length < MIN_PASSWORD_LENGTH}>
              {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <KeyRound className="mr-1.5 h-3.5 w-3.5" />}
              Resetear contraseña
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
