'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Loader2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification,
} from '@/lib/actions/notifications'
import { useToast } from '@/lib/hooks/use-toast'
import type { Notification, NotificationSeverity } from '@/lib/supabase/types'

interface Props {
  initialNotifications: Notification[]
  initialUnreadCount: number
  userId: string
}

const severityIcon: Record<NotificationSeverity, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
}

const severityTone: Record<NotificationSeverity, string> = {
  info: 'text-blue-500 bg-blue-500/10',
  success: 'text-green-500 bg-green-500/10',
  warning: 'text-yellow-500 bg-yellow-500/10',
  error: 'text-red-500 bg-red-500/10',
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return 'ahora'
  const min = Math.floor(sec / 60)
  if (min < 60) return `hace ${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `hace ${hr} h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `hace ${day} d`
  return new Date(iso).toLocaleDateString('es-PR', { month: 'short', day: 'numeric' })
}

export function NotificationBell({ initialNotifications, initialUnreadCount, userId }: Props) {
  const [items, setItems] = useState<Notification[]>(initialNotifications)
  const [unread, setUnread] = useState(initialUnreadCount)
  const [open, setOpen] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notification
          setItems((prev) => [n, ...prev].slice(0, 50))
          setUnread((c) => c + 1)
          setHighlightId(n.id)
          window.setTimeout(() => setHighlightId(null), 1500)
          // Surface as toast too — but only if dropdown is closed
          if (!open) {
            toast({
              title: n.title,
              description: n.body ?? undefined,
            })
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notification
          setItems((prev) => prev.map((p) => (p.id === n.id ? n : p)))
          // recount unread from local state next tick
          setUnread((c) => {
            const before = items.find((i) => i.id === n.id)
            if (before && !before.read_at && n.read_at) return Math.max(c - 1, 0)
            return c
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const old = payload.old as Notification
          setItems((prev) => prev.filter((p) => p.id !== old.id))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Periodic tick to refresh relative timestamps
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  function onItemClick(n: Notification) {
    if (!n.read_at) {
      // Optimistic mark
      setItems((prev) => prev.map((p) => (p.id === n.id ? { ...p, read_at: new Date().toISOString() } : p)))
      setUnread((c) => Math.max(c - 1, 0))
      void markNotificationRead(n.id)
    }
    if (n.link) {
      setOpen(false)
      router.push(n.link)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'relative flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted',
            unread > 0 && 'animate-[wiggle_3.5s_ease-in-out_infinite]',
          )}
          title="Notificaciones"
          aria-label={unread > 0 ? `${unread} notificaciones sin leer` : 'Notificaciones'}
        >
          {unread > 0 ? (
            <BellRing className="h-4 w-4 text-foreground" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {unread > 0 && (
            <>
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                {unread > 99 ? '99+' : unread}
              </span>
              <span className="absolute -right-1 -top-1 h-4 w-4 animate-ping rounded-full bg-red-500 opacity-60" />
            </>
          )}
          <style>{`
            @keyframes wiggle {
              0%, 92%, 100% { transform: rotate(0); }
              94% { transform: rotate(-10deg); }
              96% { transform: rotate(10deg); }
              98% { transform: rotate(-6deg); }
            }
          `}</style>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[360px] p-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Notificaciones</p>
            {unread > 0 && (
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-500">
                {unread} nueva{unread === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {unread > 0 && (
            <MarkAllReadButton
              onDone={() => {
                setItems((prev) => prev.map((p) => ({ ...p, read_at: p.read_at ?? new Date().toISOString() })))
                setUnread(0)
              }}
            />
          )}
        </div>

        {/* Body */}
        {items.length === 0 ? (
          <div className="grid place-items-center px-3 py-10 text-center">
            <Bell className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">Todo al día</p>
            <p className="text-xs text-muted-foreground">No tienes notificaciones aún.</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <ul className="divide-y">
              {items.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  highlight={highlightId === n.id}
                  onClick={() => onItemClick(n)}
                  onDelete={() => {
                    setItems((prev) => prev.filter((p) => p.id !== n.id))
                    if (!n.read_at) setUnread((c) => Math.max(c - 1, 0))
                    void deleteNotification(n.id)
                  }}
                />
              ))}
            </ul>
          </ScrollArea>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t bg-muted/20 px-3 py-2">
          <Link
            href="/alerts"
            onClick={() => setOpen(false)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Ver todas en /alerts →
          </Link>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Realtime
          </span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NotificationItem({
  notification,
  highlight,
  onClick,
  onDelete,
}: {
  notification: Notification
  highlight: boolean
  onClick: () => void
  onDelete: () => void
}) {
  const Icon = severityIcon[notification.severity]
  const tone = severityTone[notification.severity]
  const isUnread = !notification.read_at

  return (
    <li
      className={cn(
        'group relative cursor-pointer px-3 py-3 transition-colors',
        isUnread ? 'bg-primary/[0.03]' : '',
        'hover:bg-muted/60',
        highlight && 'animate-in fade-in slide-in-from-top-1 duration-500 bg-yellow-500/10',
      )}
      onClick={onClick}
    >
      {isUnread && (
        <span className="absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-blue-500 animate-pulse" />
      )}
      <div className="flex items-start gap-3 pl-3">
        <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', tone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-sm', isUnread ? 'font-semibold' : 'font-medium')}>{notification.title}</p>
          {notification.body && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
          )}
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {relativeTime(notification.created_at)}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Eliminar"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      </div>
    </li>
  )
}

function MarkAllReadButton({ onDone }: { onDone: () => void }) {
  const [isPending, startTransition] = useTransition()
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1 text-xs"
      disabled={isPending}
      onClick={() => {
        // Optimistic
        onDone()
        startTransition(async () => {
          await markAllNotificationsRead()
        })
      }}
    >
      {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
      Marcar todas
    </Button>
  )
}
