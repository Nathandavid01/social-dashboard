'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function estudioLabel(count: number): string {
  return count === 1 ? '1 persona en el estudio' : `${count} personas en el estudio`
}

export function PresenceBar({ currentUser }: Props) {
  const [users, setUsers] = useState<PresenceUser[]>([])
  // Latest profile, read inside the effect without re-subscribing when the
  // name/avatar change (only `id` keys the subscription).
  const userRef = useRef(currentUser)
  userRef.current = currentUser

  useEffect(() => {
    const supabase = createClient()
    const userId = currentUser.id
    const realtimeTopic = `realtime:${PRESENCE_CHANNEL}`

    // `createBrowserClient` is a singleton, so a previous mount's channel can
    // linger in the client registry while its async teardown is still in flight.
    // realtime-js returns that same instance for this topic, and binding presence
    // callbacks to an already-joined channel throws ("cannot add presence
    // callbacks after joining a channel"). Drop any leftover first.
    for (const stale of supabase.getChannels()) {
      if (stale.topic === realtimeTopic) supabase.removeChannel(stale)
    }

    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: userId } },
    })

    const syncUsers = () => {
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
        if (a.id === userId) return -1
        if (b.id === userId) return 1
        return b.online_at.localeCompare(a.online_at)
      })
      setUsers(flat)
    }

    // Only wire up + join a freshly-created channel (`state === 'closed'`). If the
    // teardown above hasn't settled and we still got a live one, reflect its
    // current state without re-binding presence callbacks (which would throw).
    if (channel.state === 'closed') {
      channel.on('presence', { event: 'sync' }, syncUsers).subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const u = userRef.current
          await channel.track({
            id: u.id,
            full_name: u.full_name,
            avatar_url: u.avatar_url,
            online_at: new Date().toISOString(),
          } satisfies PresenceUser)
        }
      })
    } else {
      syncUsers()
    }

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser.id])

  if (users.length === 0) return null

  const visible = users.slice(0, MAX_VISIBLE)
  const extra = users.length - MAX_VISIBLE

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={estudioLabel(users.length)}
          className={cn(
            'group flex h-9 shrink-0 items-center gap-2 rounded-full',
            'border border-white/[0.07] bg-white/[0.035] pl-1 pr-2.5',
            'outline-none transition-[border-color,background-color,box-shadow] duration-200',
            'hover:border-primary/30 hover:bg-white/[0.055] hover:shadow-[0_0_20px_-8px_hsl(var(--primary)/0.55)]',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          )}
        >
          <span className="flex items-center -space-x-2.5 motion-safe:transition-[margin] group-hover:-space-x-1.5">
            {visible.map((u, i) => (
              <PresenceFace
                key={u.id}
                user={u}
                zIndex={visible.length - i}
                ringClass="ring-[1.5px] ring-background"
              />
            ))}
            {extra > 0 ? (
              <span
                className="relative z-0 grid h-8 w-8 place-items-center rounded-full bg-[#141414] text-[10px] font-semibold tracking-tight text-primary ring-[1.5px] ring-background"
                aria-hidden
              >
                +{extra}
              </span>
            ) : null}
          </span>
          <span
            data-presence="tally"
            className="relative grid h-2 w-2 place-items-center"
            aria-hidden
          >
            <span className="absolute inset-0 rounded-full bg-primary/35 motion-safe:animate-ping" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.9)]" />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60 p-1.5">
        <DropdownMenuLabel className="flex items-center justify-between px-2 py-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            En el estudio
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            En vivo
          </span>
        </DropdownMenuLabel>
        <ul className="flex flex-col gap-0.5">
          {users.map((u) => {
            const isYou = u.id === currentUser.id
            return (
              <li key={u.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                <PresenceFace user={u} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium tracking-tight">
                  {u.full_name ?? 'Usuario'}
                </span>
                {isYou ? (
                  <span className="shrink-0 text-[11px] font-medium text-primary">Tú</span>
                ) : (
                  <span className="sr-only">Conectado ahora</span>
                )}
              </li>
            )
          })}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PresenceFace({
  user,
  zIndex,
  ringClass,
}: {
  user: PresenceUser
  zIndex?: number
  ringClass?: string
}) {
  return (
    <span className="relative inline-flex" style={zIndex == null ? undefined : { zIndex }}>
      <Avatar className={cn('h-8 w-8', ringClass)}>
        {user.avatar_url ? (
          <AvatarImage
            src={user.avatar_url}
            alt=""
            className="object-cover object-center scale-[1.18]"
          />
        ) : null}
        <AvatarFallback className="bg-[#161616] text-[10px] font-semibold tracking-[0.08em] text-primary">
          {initials(user.full_name)}
        </AvatarFallback>
      </Avatar>
    </span>
  )
}
