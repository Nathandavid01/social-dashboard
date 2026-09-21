'use client'

import { useMemo, useState, useTransition } from 'react'
import { Layers, Loader2 } from 'lucide-react'
import { ClientLogo } from '@/components/clients/client-logo'
import { ReciboVideoPreview } from '@/components/recibo/recibo-video-preview'
import { RoleGate } from '@/components/auth/role-gate'
import { useToast } from '@/lib/hooks/use-toast'
import { sendHumanReciboToPool } from '@/lib/actions/recibo'
import { ideaTieneEditadoEntregas } from '@/lib/entregas/enviar-al-cliente'
import {
  canSendHumanReciboToPool,
  humanPoolGate,
  humanPoolGateMessage,
} from '@/lib/utils/client-pool-state'
import { cn } from '@/lib/utils'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

/**
 * Recibo — puente humano → pool Listo.
 * Explicit CTA only. Does not auto-send when the client approves.
 */

function ideaTitle(idea: IdeaWithPipeline): string {
  return idea.title?.trim() || idea.hook?.trim() || 'Sin título'
}

export function HumanPoolBridge({
  ideas,
  humanClients,
  reviewByIdea = {},
}: {
  ideas: IdeaWithPipeline[]
  humanClients: { id: string; name: string; logo_url?: string | null }[]
  reviewByIdea?: Record<string, string>
}) {
  const { toast } = useToast()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [sent, setSent] = useState<Record<string, boolean>>({})
  const [isPending, start] = useTransition()

  const byClient = useMemo(() => {
    const map = new Map<string, { client: { id: string; name: string; logo_url?: string | null }; ideas: IdeaWithPipeline[] }>()
    for (const c of humanClients) {
      map.set(c.id, { client: c, ideas: [] })
    }
    for (const idea of ideas) {
      if (idea.status === 'descartada') continue
      const entry = map.get(idea.client_id)
      if (entry) entry.ideas.push(idea)
      else {
        map.set(idea.client_id, {
          client: {
            id: idea.client_id,
            name: idea.client?.name?.trim() || 'Cliente',
            logo_url: idea.client?.logo_url ?? null,
          },
          ideas: [idea],
        })
      }
    }
    return [...map.values()]
      .filter((row) => row.ideas.length > 0)
      .sort((a, b) => a.client.name.localeCompare(b.client.name, 'es'))
  }, [ideas, humanClients])

  function send(ideaId: string) {
    setPendingId(ideaId)
    setSent((cur) => ({ ...cur, [ideaId]: true }))
    start(async () => {
      const res = await sendHumanReciboToPool({ ideaId })
      if (res.error) {
        setSent((cur) => {
          const next = { ...cur }
          delete next[ideaId]
          return next
        })
        toast({ title: 'No se pudo enviar al pool', description: res.error, variant: 'destructive' })
      } else {
        toast({ title: 'Listo en el pool', description: 'Ya puedes agendarlo desde el Panel.' })
      }
      setPendingId(null)
    })
  }

  if (byClient.length === 0) return null

  return (
    <section className="space-y-4" data-testid="human-pool-bridge">
      <header className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight sm:text-lg">
          <Layers className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
          Puente humano → pool
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Un corte de Recibo humano no entra solo al <strong>pool</strong>. Si el
          cliente ya aprobó y pasó <strong>Revisión</strong>, envíalo como{' '}
          <strong>Listo</strong>.
        </p>
      </header>

      <ul className="space-y-6">
        {byClient.map(({ client, ideas: clientIdeas }) => (
          <li key={client.id} className="space-y-3">
            <div className="flex items-center gap-3 px-1">
              <ClientLogo name={client.name} logoUrl={client.logo_url} className="h-10 w-10 ring-2 ring-border" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold">{client.name}</span>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                    Humano
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {clientIdeas.length} video{clientIdeas.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {clientIdeas.map((idea) => {
                const gateInput = {
                  status: idea.status,
                  approval_status: idea.approval_status,
                  staff_client_approval: idea.staff_client_approval ?? null,
                  client_review_status: idea.client_review_status ?? null,
                  entregas_review_status: reviewByIdea[idea.id] ?? null,
                  staff_pool_ready: sent[idea.id] || Boolean(idea.staff_pool_ready),
                  client_edit_mode: 'human' as const,
                }
                const reason = humanPoolGate(gateInput)
                const canSend = canSendHumanReciboToPool(gateInput)
                const busy = isPending && pendingId === idea.id
                const hasEdit = ideaTieneEditadoEntregas(idea)
                return (
                  <li
                    key={idea.id}
                    data-testid={`human-recibo-${idea.id}`}
                    className="flex flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card to-card/80"
                  >
                    <div className="bg-zinc-950 px-3 pb-2 pt-3 sm:px-4">
                      <div className="mx-auto w-full max-w-[min(100%,280px)]">
                        <ReciboVideoPreview ideaId={idea.id} hasEdited={hasEdit} />
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
                      <h3 className="break-words text-[15px] font-semibold leading-snug">
                        {ideaTitle(idea)}
                      </h3>
                      <RoleGate perm="pool.send_human">
                        {canSend ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => send(idea.id)}
                            className={cn(
                              'inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 text-sm font-semibold text-amber-100 touch-manipulation',
                              busy && 'opacity-50',
                            )}
                          >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                            Enviar al pool · Listo
                          </button>
                        ) : (
                          <p
                            data-testid={`human-gate-${idea.id}`}
                            className={cn(
                              'rounded-xl border px-3 py-2 text-xs font-medium',
                              reason === 'already_listo'
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                                : 'border-amber-500/30 bg-amber-500/5 text-amber-100',
                            )}
                          >
                            {reason === 'already_listo' ? 'Listo en el pool' : humanPoolGateMessage(reason)}
                          </p>
                        )}
                      </RoleGate>
                    </div>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}
