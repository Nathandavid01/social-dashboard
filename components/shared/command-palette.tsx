'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Search, LayoutDashboard, Users, Inbox, Film, Globe, UserSquare2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchResult {
  id: string
  type: 'task' | 'client' | 'request' | 'video'
  title: string
  subtitle?: string
  href: string
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // ⌘P or ⌘/ to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'p' || e.key === '/') && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setResults([])
      setSelected(0)
    }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); return }
    setLoading(true)
    const supabase = createClient()

    const [{ data: tasks }, { data: clients }, { data: requests }, { data: videos }] = await Promise.all([
      supabase.from('tasks').select('id, title, status, client:clients(name)').ilike('title', `%${q}%`).neq('status', 'completed').limit(4),
      supabase.from('clients').select('id, name, industry').ilike('name', `%${q}%`).limit(4),
      supabase.from('client_requests').select('id, company_name, description').ilike('company_name', `%${q}%`).in('status', ['new', 'in_review']).limit(3),
      supabase.from('video_reviews').select('id, title, status, client:clients(name)').ilike('title', `%${q}%`).neq('status', 'approved').limit(3),
    ])

    const r: SearchResult[] = [
      ...(tasks ?? []).map((t) => ({
        id: t.id,
        type: 'task' as const,
        title: t.title,
        subtitle: `${(t.client as { name?: string } | null)?.name ?? 'Sin cliente'} · ${t.status.replace('_', ' ')}`,
        href: '/operations',
      })),
      ...(clients ?? []).map((c) => ({
        id: c.id,
        type: 'client' as const,
        title: c.name,
        subtitle: c.industry ?? 'Cliente',
        href: `/clients/${c.id}`,
      })),
      ...(requests ?? []).map((r) => ({
        id: r.id,
        type: 'request' as const,
        title: r.company_name,
        subtitle: r.description.slice(0, 60) + (r.description.length > 60 ? '…' : ''),
        href: '/inbox',
      })),
      ...(videos ?? []).map((v) => ({
        id: v.id,
        type: 'video' as const,
        title: v.title,
        subtitle: `${(v.client as { name?: string } | null)?.name ?? 'Sin cliente'} · ${v.status.replace('_', ' ')}`,
        href: '/video-reviews',
      })),
    ]

    setResults(r)
    setSelected(0)
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 200)
    return () => clearTimeout(timer)
  }, [query, search])

  function navigate(result: SearchResult) {
    router.push(result.href)
    setOpen(false)
  }

  if (!open) return null

  const Icon = {
    task: LayoutDashboard,
    client: Users,
    request: Inbox,
    video: Film,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar tareas, clientes, solicitudes..."
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
              if (e.key === 'Enter' && results[selected]) navigate(results[selected])
            }}
          />
          <kbd className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <div className="py-2 max-h-80 overflow-y-auto">
            {results.map((r, i) => {
              const I = Icon[r.type]
              return (
                <button
                  key={r.id}
                  onClick={() => navigate(r)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    i === selected ? 'bg-primary/10' : 'hover:bg-muted/50'
                  )}
                  onMouseEnter={() => setSelected(i)}
                >
                  <I className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    {r.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5 capitalize shrink-0">
                    {r.type === 'request' ? 'solicitud' : r.type === 'task' ? 'tarea' : r.type === 'video' ? 'video' : 'cliente'}
                  </span>
                </button>
              )
            })}
          </div>
        ) : query.length >= 2 && !loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Sin resultados para &ldquo;{query}&rdquo;
          </div>
        ) : query.length < 2 ? (
          <div className="py-4 px-4 space-y-1">
            <p className="text-xs text-muted-foreground font-medium mb-2">Accesos rápidos</p>
            {[
              { label: 'Operaciones', href: '/operations', icon: LayoutDashboard },
              { label: 'Clientes', href: '/clients', icon: Users },
              { label: 'Bandeja de Clientes', href: '/inbox', icon: Inbox },
              { label: 'Video QC', href: '/video-reviews', icon: Film },
              { label: 'Publicados', href: '/published', icon: Globe },
              { label: 'Equipo', href: '/team', icon: UserSquare2 },
            ].map((item) => (
              <button
                key={item.href}
                onClick={() => { router.push(item.href); setOpen(false) }}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted transition-colors"
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{item.label}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="border-t border-border px-4 py-2 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>↑↓ navegar</span>
          <span>↵ ir</span>
          <span className="ml-auto">⌘P para cerrar</span>
        </div>
      </div>
    </div>
  )
}
