'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Loader2, RefreshCw, Copy, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import { createTeamUser } from '@/lib/actions/users'
import { ASSIGNABLE_ROLES, ROLE_LABEL, ROLE_DESCRIPTION } from '@/lib/auth/permissions'
import type { UserRole } from '@/lib/supabase/types'

/** A readable temporary password (the new user changes it on first login). */
function makeTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const buf = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? crypto.getRandomValues(new Uint32Array(10))
    : Array.from({ length: 10 }, (_, i) => i * 7 + 11)
  const body = Array.from(buf, (n) => chars[n % chars.length]).join('')
  return `Nm${body}9!`
}

export function CreateUserDialog() {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('editor')
  const [password, setPassword] = useState(makeTempPassword())
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setEmail('')
    setFullName('')
    setRole('editor')
    setPassword(makeTempPassword())
    setCopied(false)
  }

  function copyPassword() {
    navigator.clipboard?.writeText(password).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function submit() {
    startTransition(async () => {
      const res = await createTeamUser({ email, fullName, role, password })
      if (res.error) {
        toast({ title: 'No se pudo crear el usuario', description: res.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Usuario creado', description: `${fullName} · ${ROLE_LABEL[role]}. Comparte la contraseña temporal.` })
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
      <DialogTrigger asChild>
        <Button size="sm" className="shrink-0 whitespace-nowrap">
          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
          Crear usuario
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear usuario</DialogTitle>
          <DialogDescription>
            Crea una cuenta y asígnale un rol — el rol define sus permisos. Comparte la contraseña temporal;
            el usuario la cambia al entrar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Email
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@nmedia.pr"
              className="h-9 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Nombre completo
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: María Rodríguez"
              className="h-9 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Rol (permisos)
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[11px] leading-snug text-muted-foreground/80">{ROLE_DESCRIPTION[role]}</span>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Contraseña temporal
            <div className="flex items-center gap-1.5">
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 font-mono text-sm"
              />
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
            <Button size="sm" onClick={submit} disabled={isPending || !email.trim() || !fullName.trim()}>
              {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserPlus className="mr-1.5 h-3.5 w-3.5" />}
              Crear usuario
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
