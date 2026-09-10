'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Loader2, RefreshCw, Link2, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/lib/hooks/use-toast'
import { updateClientProfile } from '@/lib/actions/client-profile'
import { suggestMetricoolBlogs } from '@/lib/utils/metricool-import-core'
import { cn } from '@/lib/utils'

interface MetricoolBlog {
  id: string
  name: string
  url?: string
  networks?: string[]
}

interface Props {
  clientId: string
  clientName: string
  initialBlogId: string | null
}

export function MetricoolBlogEditor({ clientId, clientName, initialBlogId }: Props) {
  const { toast } = useToast()
  const [blogId, setBlogId] = useState(initialBlogId ?? '')
  const [draft, setDraft] = useState(initialBlogId ?? '')
  const [blogs, setBlogs] = useState<MetricoolBlog[]>([])
  const [fetched, setFetched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const linkedName = useMemo(() => {
    if (!blogId) return null
    return blogs.find((b) => b.id === blogId)?.name ?? null
  }, [blogId, blogs])

  const suggestions = useMemo(
    () => (fetched ? suggestMetricoolBlogs(clientName, blogs.map((b) => ({ id: b.id, name: b.name }))) : []),
    [fetched, clientName, blogs],
  )

  async function fetchBlogs() {
    setLoading(true)
    try {
      const res = await fetch('/api/metricool/blogs')
      const data = await res.json()
      if (data.error) {
        toast({ title: 'No se pudo cargar Metricool', description: data.error, variant: 'destructive' })
        return
      }
      setBlogs(data.blogs ?? [])
      setFetched(true)
    } catch {
      toast({ title: 'No se pudo cargar Metricool', description: 'Revisa la conexión.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchBlogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function save(next: string) {
    const value = next.trim()
    startTransition(async () => {
      const res = await updateClientProfile(clientId, { metricool_blog_id: value })
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
        return
      }
      setBlogId(value)
      setDraft(value)
      toast({
        title: value ? 'Metricool enlazado' : 'Metricool desenlazado',
        description: value ? `Blog ID ${value}` : 'Este cliente ya no publica desde el dashboard.',
      })
    })
  }

  const dirty = draft.trim() !== (blogId ?? '').trim()

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {blogId ? (
          <p>
            Enlazado{linkedName ? `: ` : ': blog '}
            {linkedName ? <span className="font-medium text-foreground">{linkedName}</span> : null}
            <span className="ml-1 tabular-nums text-foreground">({blogId})</span>
          </p>
        ) : (
          <p>Sin Metricool — no se puede programar/publicar desde el dashboard hasta enlazar un blog.</p>
        )}
      </div>

      {fetched && blogs.length > 0 ? (
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Marca en Metricool</span>
          <select
            aria-label="Marca en Metricool"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            value={draft}
            disabled={isPending}
            onChange={(e) => setDraft(e.target.value)}
          >
            <option value="">Sin enlazar</option>
            {blogs.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.id})
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="flex gap-2">
          <Input
            aria-label="Metricool Blog ID"
            placeholder="ej. 6170821"
            value={draft}
            disabled={isPending}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void fetchBlogs()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}

      {suggestions.length > 0 && !blogId && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Sugerencias por nombre</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={isPending}
                onClick={() => {
                  setDraft(s.id)
                  save(s.id)
                }}
                className={cn(
                  'rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-foreground',
                  'hover:bg-primary/10',
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={!dirty || isPending} onClick={() => save(draft)}>
          {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Link2 className="mr-1.5 h-3.5 w-3.5" />}
          Guardar
        </Button>
        {blogId ? (
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => save('')}>
            <Unlink className="mr-1.5 h-3.5 w-3.5" />
            Quitar
          </Button>
        ) : null}
      </div>
    </div>
  )
}
