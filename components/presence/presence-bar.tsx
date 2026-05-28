'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface PresenceUser {
  id: string
  full_name: string | null
  avatar_url: string | null
  online_at: string
}

interface Props {
  currentUser: { id: string; full_name: string | null; avatar_url: string | null }
}

const PRESENCE_CHANNEL = 'nm-presence-global'
const MAX_VISIBLE = 5

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function PresenceBar({ currentUser }: Props) {
  const [users, setUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: currentUser.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>()
        // state shape: { [key]: PresenceUser[] }
        const flat: PresenceUser[] = []
        const seen = new Set<string>()
        for (const arr of Object.values(state)) {
          for (const u of arr) {
            if (!seen.has(u.id)) {
              seen.add(u.id)
              flat.push(u)
            }
          }
        }
        // Sort: current user first, then by online_at desc
        flat.sort((a, b) => {
          if (a.id === currentUser.id) return -1
          if (b.id === currentUser.id) return 1
          return b.online_at.localeCompare(a.online_at)
        })
        setUsers(flat)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: currentUser.id,
            full_name: currentUser.full_name,
            avatar_url: currentUser.avatar_url,
            online_at: new Date().toISOString(),
          } satisfies PresenceUser)
        }
      })

    return () => {
      channel.untrack().then(() => supabase.removeChannel(channel))
    }
  }, [currentUser.id, currentUser.full_name, currentUser.avatar_url])

  if (users.length === 0) return null

  const visible = users.slice(0, MAX_VISIBLE)
  const extra = users.length - MAX_VISIBLE

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-2">
        {visible.map((u, i) => (
          <Tooltip key={u.id}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'group flex items-center gap-1.5 rounded-full bg-muted/40 py-0.5 pl-0.5 pr-2.5 transition-colors hover:bg-muted',
                  'animate-in fade-in slide-in-from-left-1 duration-300',
                  u.id === currentUser.id && 'ring-1 ring-primary/40',
                )}
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
              >
                <div className="relative">
                  <Avatar className="h-6 w-6 transition-transform group-hover:scale-110">
                    {u.avatar_url ? <AvatarImage src={u.avatar_url} alt={u.full_name ?? 'Usuario'} /> : null}
                    <AvatarFallback className="text-[10px] font-semibold">{initials(u.full_name)}</AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500 ring-2 ring-background" />
                  </span>
                </div>
                <span className="hidden text-xs font-medium sm:inline">
                  {u.id === currentUser.id ? 'Tú' : (u.full_name?.split(' ')[0] ?? 'Usuario')}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p className="font-medium">{u.full_name ?? 'Usuario'}</p>
              <p className="text-[10px] text-muted-foreground">
                {u.id === currentUser.id ? 'Tú · conectado' : 'Conectado ahora'}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
        {extra > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="grid h-7 min-w-[28px] place-items-center rounded-full bg-muted px-2 text-[10px] font-semibold text-muted-foreground">
                +{extra}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>{extra} más conectado{extra === 1 ? '' : 's'}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
