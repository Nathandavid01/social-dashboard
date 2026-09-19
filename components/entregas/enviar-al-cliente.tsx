'use client'

import { useEffect, useMemo, useState } from 'react'
import { Link2, Copy, Check, Loader2, ExternalLink, Send } from 'lucide-react'
import { useHasPermission } from '@/components/auth/role-gate'
import { useToast } from '@/lib/hooks/use-toast'
import { DIAS_DE_VIGENCIA } from '@/lib/entregas/client-review'
import { crearEnlaceCliente } from '@/lib/actions/entregas-client-review'
import { ideaTieneEditadoEntregas } from '@/lib/entregas/enviar-al-cliente'
import { cn } from '@/lib/utils'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

type Props = {
  ideas: IdeaWithPipeline[]
  /** Pre-select this client (Recibo section). */
  defaultClientId?: string
  /** Start with panel open (default true). */
  defaultOpen?: boolean
  className?: string
}

/**
 * One-tap approval link for edited Entregas videos.
 * Auto-picks the only client, selects all videos, generates + copies.
 * No Metricool auto-post.
 */
export function EnviarAlCliente({
  ideas,
  defaultClientId = '',
  defaultOpen = true,
  className,
}: Props) {
  const can = useHasPermission('captions.edit')
  const { toast } = useToast()
  const [clientId, setClientId] = useState(defaultClientId)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const clients = useMemo(() => {
    const map = new Map<string, string>()
    for (const idea of ideas) {
      if (!ideaTieneEditadoEntregas(idea) || idea.status === 'descartada') continue
      const id = idea.client_id
      const name = idea.client?.name?.trim() || 'Cliente'
      if (!map.has(id)) map.set(id, name)
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [ideas])

  const videos = useMemo(() => {
    if (!clientId) return []
    return ideas
      .filter((i) => i.client_id === clientId && i.status !== 'descartada' && ideaTieneEditadoEntregas(i))
      .map((i) => ({
        id: i.id,
        title: i.title?.trim() || i.hook?.trim() || 'Sin título',
      }))
  }, [ideas, clientId])

  // Auto-pick single client / honor defaultClientId
  useEffect(() => {
    if (clientId) return
    if (defaultClientId && clients.some((c) => c.id === defaultClientId)) {
      setClientId(defaultClientId)
      return
    }
    if (clients.length === 1) setClientId(clients[0].id)
  }, [clients, clientId, defaultClientId])

  // When client changes, select ALL edited videos (one less step)
  useEffect(() => {
    if (!clientId) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(videos.map((v) => v.id)))
    setUrl('')
  }, [clientId, videos])

  if (!can) return null

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setUrl('')
  }

  function pickClient(id: string) {
    setClientId(id)
    setUrl('')
  }

  function selectAll() {
    setSelected(new Set(videos.map((v) => v.id)))
    setUrl('')
  }

  async function copiarTexto(texto: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      return true
    } catch {
      return false
    }
  }

  async function generar() {
    if (!clientId || selected.size === 0 || busy) return
    setBusy(true)
    try {
      const res = await crearEnlaceCliente({ clientId, ideaIds: [...selected] })
      if (res.error || !res.token) {
        toast({ title: 'No se pudo generar', description: res.error || 'Resultado sin confirmar', variant: 'destructive' })
        return
      }
      const next = `${window.location.origin}/aprobacion/${res.token}`
      setUrl(next)
      const name = clients.find((c) => c.id === clientId)?.name ?? 'Cliente'
      const copiedOk = await copiarTexto(next)
      toast({
        title: `Listo para ${name}`,
        description: copiedOk
          ? `Enlace copiado · ${selected.size} video(s) · ${DIAS_DE_VIGENCIA} días`
          : `Copia el enlace abajo · ${selected.size} video(s)`,
      })
    } catch {
      toast({ title: 'Creación sin confirmar', description: 'Revisa si el enlace apareció antes de reintentar.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function copiar() {
    if (!url) return
    const ok = await copiarTexto(url)
    if (ok) toast({ title: 'Enlace copiado' })
    else toast({ title: 'No se pudo copiar', description: 'Selecciona el enlace y cópialo a mano.', variant: 'destructive' })
  }

  return (
    <div
      data-testid="enviar-al-cliente"
      className={cn('space-y-3 rounded-2xl border border-border bg-card/80 p-4 shadow-sm', className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Send className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Enviar al cliente</h3>
        {url ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            Enlace listo
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Un toque: elige cliente (si hace falta), genera y el enlace se copia solo. Sin auto-post.
      </p>

      {clients.length === 0 ? (
        <p className="text-xs text-muted-foreground">No hay videos editados listos para mandar.</p>
      ) : (
        <>
          {clients.length > 1 ? (
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Cliente</span>
              <select
                aria-label="Cliente para enlace de aprobación"
                value={clientId}
                onChange={(e) => pickClient(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">¿A qué cliente?</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm font-medium" data-testid="enviar-cliente-unico">
              {clients[0]?.name}
            </p>
          )}

          {clientId && videos.length > 0 ? (
            <fieldset className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <legend className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Videos ({selected.size}/{videos.length})
                </legend>
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Seleccionar todos
                </button>
              </div>
              <ul className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-1">
                {videos.map((v) => (
                  <li key={v.id}>
                    <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                      <input
                        type="checkbox"
                        checked={selected.has(v.id)}
                        onChange={() => toggle(v.id)}
                        className="accent-primary"
                      />
                      <span className="min-w-0 flex-1 break-words text-sm">{v.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          ) : null}

          <button
            type="button"
            disabled={!clientId || selected.size === 0 || busy}
            onClick={() => void generar()}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
            {url ? `Regenerar enlace (${selected.size})` : `Copiar enlace para el cliente (${selected.size})`}
          </button>
        </>
      )}

      {url ? (
        <div
          data-testid="enlace-aprobacion-result"
          className="space-y-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3"
        >
          <p className="text-xs font-semibold text-emerald-300">
            Enlace copiado — pégalo en WhatsApp / email
          </p>
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Enlace de aprobación generado"
            className="h-11 w-full select-all rounded-lg border border-border bg-background px-3 font-mono text-xs text-foreground"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copiar()}
              aria-label="Copiar enlace de aprobación"
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 sm:flex-none"
            >
              {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              {copied ? 'Copiado' : 'Copiar otra vez'}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium hover:bg-muted sm:flex-none"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Abrir
            </a>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * One-click: generate + copy approval link for a single edited idea.
 */
export function EnviarIdeaAlCliente({
  idea,
  className,
}: {
  idea: IdeaWithPipeline
  className?: string
}) {
  const can = useHasPermission('captions.edit')
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState('')
  const ready = ideaTieneEditadoEntregas(idea) && idea.status !== 'descartada'

  if (!can || !ready) return null

  async function enviar() {
    if (busy) return
    setBusy(true)
    try {
      const res = await crearEnlaceCliente({ clientId: idea.client_id, ideaIds: [idea.id] })
      if (res.error || !res.token) {
        toast({ title: 'No se pudo generar', description: res.error || 'Sin token', variant: 'destructive' })
        return
      }
      const next = `${window.location.origin}/aprobacion/${res.token}`
      setUrl(next)
      try {
        await navigator.clipboard.writeText(next)
        toast({ title: 'Enlace copiado', description: 'Listo para mandar al cliente.' })
      } catch {
        toast({ title: 'Enlace listo', description: next })
      }
    } catch {
      toast({ title: 'No se pudo crear el enlace', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <button
        type="button"
        disabled={busy}
        onClick={() => void enviar()}
        data-testid={`enviar-idea-${idea.id}`}
        className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
        Enviar al cliente
      </button>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-[10px] text-muted-foreground underline-offset-2 hover:underline"
        >
          {url.replace(/^https?:\/\//, '')}
        </a>
      ) : null}
    </div>
  )
}
