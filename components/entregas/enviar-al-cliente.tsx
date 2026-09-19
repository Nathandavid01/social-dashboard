'use client'

import { useMemo, useState } from 'react'
import { Link2, Copy, Check, Loader2 } from 'lucide-react'
import { useHasPermission } from '@/components/auth/role-gate'
import { useToast } from '@/lib/hooks/use-toast'
import { DIAS_DE_VIGENCIA } from '@/lib/entregas/client-review'
import { crearEnlaceCliente } from '@/lib/actions/entregas-client-review'
import { ideaTieneEditadoEntregas } from '@/lib/entregas/enviar-al-cliente'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

/**
 * Staff picks which edited videos of a client go in ONE /aprobacion/{token}.
 * Reuses crearEnlaceCliente({ clientId, ideaIds }) — no auto-post.
 */
export function EnviarAlCliente({ ideas }: { ideas: IdeaWithPipeline[] }) {
  const can = useHasPermission('captions.edit')
  const { toast } = useToast()
  const [clientId, setClientId] = useState('')
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
    setSelected(new Set())
    setUrl('')
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
      toast({ title: `Enlace de ${name}`, description: `${selected.size} video(s) · vence en ${DIAS_DE_VIGENCIA} días.` })
    } catch {
      toast({ title: 'Creación sin confirmar', description: 'Consulta el enlace antes de intentar otra vez.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function copiar() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast({ title: 'Enlace copiado' })
    } catch {
      toast({ title: 'No se pudo copiar', description: 'Abre el enlace y cópialo desde la barra.', variant: 'destructive' })
    }
  }

  return (
    <details className="rounded-lg border border-border bg-card/50 px-3 py-2 text-xs">
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 font-semibold text-foreground">
        <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        Enviar al cliente
      </summary>
      <div className="mt-2 space-y-2 border-t border-border pt-2">
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Cliente</span>
          <select
            aria-label="Cliente para enlace de aprobación"
            value={clientId}
            onChange={(e) => pickClient(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">¿A qué cliente?</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        {clientId && (
          <fieldset className="space-y-1.5">
            <legend className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Videos editados ({videos.length})
            </legend>
            {videos.length === 0 ? (
              <p className="text-muted-foreground">Este cliente aún no tiene cortes editados listos.</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {videos.map((v) => (
                  <li key={v.id}>
                    <label className="flex min-h-9 cursor-pointer items-start gap-2 rounded-md border border-border/60 px-2 py-1.5 hover:bg-muted/40">
                      <input
                        type="checkbox"
                        checked={selected.has(v.id)}
                        onChange={() => toggle(v.id)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1 break-words">{v.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        )}

        <button
          type="button"
          disabled={!clientId || selected.size === 0 || busy}
          onClick={() => void generar()}
          className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Link2 className="h-3.5 w-3.5" aria-hidden="true" />}
          Generar enlace ({selected.size})
        </button>

        {url && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void copiar()}
              aria-label="Copiar enlace de aprobación"
              className="flex items-center gap-1 rounded-md border px-2 py-1.5 text-[10px] font-medium hover:bg-muted"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
              Copiar enlace
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-[10px] text-muted-foreground underline-offset-2 hover:underline"
            >
              {url.replace(/^https?:\/\//, '')}
            </a>
          </div>
        )}
      </div>
    </details>
  )
}
