'use client'

import { useRef, useState, useTransition } from 'react'
import { signOut } from '@/lib/actions/auth'
import { uploadAvatar, removeAvatar } from '@/lib/actions/avatar'
import { useAuth } from '@/lib/context/auth-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import { LogOut, Camera, Loader2, Trash2, Activity, Sparkles, KeyRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/lib/hooks/use-toast'

export function UserMenu() {
  const { profile, role } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [optimisticUrl, setOptimisticUrl] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase()
    : profile?.email?.[0]?.toUpperCase() ?? 'U'

  const avatarUrl = optimisticUrl ?? profile?.avatar_url ?? undefined

  function handleFile(file: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Tipo inválido', description: 'Solo imágenes', variant: 'destructive' })
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: 'Imagen grande', description: 'Máximo 4 MB', variant: 'destructive' })
      return
    }
    setOptimisticUrl(URL.createObjectURL(file))
    const fd = new FormData()
    fd.append('file', file)
    startTransition(async () => {
      const res = await uploadAvatar(fd)
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
        setOptimisticUrl(null)
      } else {
        if (res.url) setOptimisticUrl(res.url)
        toast({ title: 'Foto actualizada' })
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative flex items-center gap-2 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {isPending && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-background/70">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative shrink-0"
              title="Cambiar foto"
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 grid place-items-center rounded-full bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-4 w-4" />
              </span>
            </button>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-medium">{profile?.full_name || 'Usuario'}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{profile?.email}</span>
              <Badge variant="secondary" className="mt-0.5 w-fit text-xs capitalize">
                {role?.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); fileRef.current?.click() }} className="cursor-pointer">
          <Camera className="mr-2 h-4 w-4" />
          {avatarUrl ? 'Cambiar foto' : 'Subir foto'}
        </DropdownMenuItem>
        {avatarUrl && (
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={(e) => {
              e.preventDefault()
              setOptimisticUrl(null)
              startTransition(async () => {
                const res = await removeAvatar()
                if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
                else toast({ title: 'Foto eliminada' })
              })
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Quitar foto
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/account/security">
            <KeyRound className="mr-2 h-4 w-4" />
            Cambiar contraseña
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/settings/metricool">
            <Activity className="mr-2 h-4 w-4" />
            Metricool
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/changelog">
            <Sparkles className="mr-2 h-4 w-4" />
            Novedades
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer"
          onClick={() => signOut()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
