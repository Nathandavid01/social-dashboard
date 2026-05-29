'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { navItems } from './nav-items'
import { Eye, EyeOff, GripVertical, Check, RotateCcw, Loader2 } from 'lucide-react'
import { saveNavPreferences } from '@/lib/actions/nav-preferences'
import { APP_VERSION } from '@/lib/version'
import { useToast } from '@/lib/hooks/use-toast'
import { useAuth } from '@/lib/context/auth-context'
import { hasPermission } from '@/lib/auth/permissions'
import type { NavPreferences } from '@/lib/supabase/types'

interface SidebarProps {
  overdueCount?: number
  requestsCount?: number
  videoReviewCount?: number
  planningPendingCount?: number
  navPreferences?: NavPreferences
}

const DEFAULT_HREFS = navItems.map((n) => n.href)

function applyPreferences(prefs: NavPreferences | undefined) {
  const order = Array.isArray(prefs?.order) ? prefs!.order!.filter((h) => DEFAULT_HREFS.includes(h)) : []
  const hidden = new Set(prefs?.hidden ?? [])

  // Ordered list: prefs.order first (filtered to known items), then any new items not in prefs.order, in their default order
  const seen = new Set(order)
  const orderedHrefs = [...order, ...DEFAULT_HREFS.filter((h) => !seen.has(h))]
  return { orderedHrefs, hidden }
}

export function Sidebar({
  overdueCount = 0,
  requestsCount = 0,
  videoReviewCount = 0,
  planningPendingCount = 0,
  navPreferences,
}: SidebarProps) {
  const pathname = usePathname()
  const { role } = useAuth()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)

  // Hide items the current role cannot access (independent of user prefs).
  const allowedItems = useMemo(
    () => navItems.filter((n) => !n.permission || hasPermission(role, n.permission)),
    [role],
  )
  const allowedHrefs = useMemo(() => new Set(allowedItems.map((n) => n.href)), [allowedItems])

  // Local working copy during edit mode (optimistic)
  const initial = useMemo(() => applyPreferences(navPreferences), [navPreferences])
  const [orderedHrefs, setOrderedHrefs] = useState<string[]>(initial.orderedHrefs)
  const [hidden, setHidden] = useState<Set<string>>(initial.hidden)
  const [dragHref, setDragHref] = useState<string | null>(null)

  // Long-press (press & hold) to enter reorder mode — works for mouse and touch.
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressStart = useRef<{ x: number; y: number } | null>(null)
  const suppressClick = useRef(false)

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    pressStart.current = null
  }

  function startLongPress(e: React.PointerEvent) {
    if (editing) return
    pressStart.current = { x: e.clientX, y: e.clientY }
    clearTimeoutOnly()
    longPressTimer.current = setTimeout(() => {
      setEditing(true)
      suppressClick.current = true
    }, 450)
  }

  function clearTimeoutOnly() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function onPressMove(e: React.PointerEvent) {
    if (!pressStart.current) return
    const dx = Math.abs(e.clientX - pressStart.current.x)
    const dy = Math.abs(e.clientY - pressStart.current.y)
    if (dx > 8 || dy > 8) clearLongPress()
  }

  const itemsByHref = useMemo(() => new Map(navItems.map((n) => [n.href, n])), [])

  function persist(next: { order: string[]; hidden: string[] }) {
    startTransition(async () => {
      const res = await saveNavPreferences(next)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
    })
  }

  function toggleHidden(href: string) {
    const nextHidden = new Set(hidden)
    if (nextHidden.has(href)) nextHidden.delete(href)
    else nextHidden.add(href)
    setHidden(nextHidden)
    persist({ order: orderedHrefs, hidden: Array.from(nextHidden) })
  }

  function reorder(srcHref: string, destHref: string) {
    if (srcHref === destHref) return
    const next = [...orderedHrefs]
    const srcIdx = next.indexOf(srcHref)
    const destIdx = next.indexOf(destHref)
    if (srcIdx === -1 || destIdx === -1) return
    next.splice(srcIdx, 1)
    next.splice(destIdx, 0, srcHref)
    setOrderedHrefs(next)
    persist({ order: next, hidden: Array.from(hidden) })
  }

  function resetDefaults() {
    setOrderedHrefs(DEFAULT_HREFS)
    setHidden(new Set())
    persist({ order: [], hidden: [] })
    toast({ title: 'Menú restaurado' })
  }

  // Filter to allowed first, then apply user prefs
  const visibleHrefs = (editing ? orderedHrefs : orderedHrefs.filter((h) => !hidden.has(h)))
    .filter((h) => allowedHrefs.has(h))

  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-60 flex-col border-r border-border bg-card lg:flex">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-border px-6 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-512.svg" alt="NMedia" className="h-8 w-8 rounded-lg" />
        <span className="text-lg font-bold tracking-tight">Nate Media</span>
        {isPending && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visibleHrefs.map((href) => {
          const item = itemsByHref.get(href)
          if (!item) return null
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const isHidden = hidden.has(item.href)

          const badge =
            item.href === '/planning' && planningPendingCount > 0 ? planningPendingCount
            : item.href === '/operations' && overdueCount > 0 ? overdueCount
            : item.href === '/inbox' && requestsCount > 0 ? requestsCount
            : item.href === '/video-reviews' && videoReviewCount > 0 ? videoReviewCount
            : 0
          const badgeColor =
            item.href === '/planning' ? 'bg-red-500 animate-pulse'
            : item.href === '/operations' ? 'bg-red-500'
            : item.href === '/video-reviews' ? 'bg-orange-500'
            : 'bg-blue-500'

          const itemEl = (
            <span
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                editing
                  ? 'cursor-grab active:cursor-grabbing bg-muted/40'
                  : isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                isHidden && editing && 'opacity-40',
                dragHref === item.href && 'opacity-50',
              )}
            >
              {editing && <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {!editing && badge > 0 && (
                <span className={cn(
                  'ml-auto min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white',
                  badgeColor,
                )}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
              {editing && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleHidden(item.href) }}
                  className="ml-auto rounded p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                  aria-label={isHidden ? 'Mostrar' : 'Ocultar'}
                  title={isHidden ? 'Mostrar en el menú' : 'Ocultar del menú'}
                >
                  {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              )}
            </span>
          )

          if (editing) {
            return (
              <div
                key={item.href}
                draggable
                onDragStart={(e) => {
                  setDragHref(item.href)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', item.href)
                }}
                onDragEnd={() => setDragHref(null)}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const src = e.dataTransfer.getData('text/plain')
                  if (src) reorder(src, item.href)
                  setDragHref(null)
                }}
                className="rounded-lg outline-none ring-primary/50 transition-all hover:ring-2"
              >
                {itemEl}
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onPointerDown={startLongPress}
              onPointerMove={onPressMove}
              onPointerUp={clearLongPress}
              onPointerLeave={clearLongPress}
              onClick={(e) => {
                if (suppressClick.current) {
                  e.preventDefault()
                  suppressClick.current = false
                }
              }}
            >
              {itemEl}
            </Link>
          )
        })}

        {editing && visibleHrefs.length < DEFAULT_HREFS.length && (
          <p className="px-3 pt-3 text-[10px] text-muted-foreground">
            {DEFAULT_HREFS.length - visibleHrefs.length} item{DEFAULT_HREFS.length - visibleHrefs.length === 1 ? '' : 's'} oculto{DEFAULT_HREFS.length - visibleHrefs.length === 1 ? '' : 's'}
          </p>
        )}
      </nav>

      {/* Footer */}
      <div className="space-y-2 border-t border-border px-3 py-3">
        {editing ? (
          <div className="flex gap-1.5">
            <button
              onClick={() => setEditing(false)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              <Check className="h-3.5 w-3.5" /> Listo
            </button>
            <button
              onClick={resetDefaults}
              title="Restaurar default"
              className="flex items-center justify-center rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <p className="text-center text-[10px] text-muted-foreground/70">
            Mantén presionado un ítem para reordenar
          </p>
        )}
        <Link
          href="/changelog"
          title="Ver novedades / changelog"
          className="block text-center text-[10px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Nate Media · v{APP_VERSION}
        </Link>
      </div>
    </aside>
  )
}
