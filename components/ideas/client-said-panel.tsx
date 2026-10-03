import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import {
  formatSuggestionSource,
  recentSuggestions,
} from '@/lib/utils/client-suggestions'
import { formatDate } from '@/lib/utils'
import type { ClientSuggestion } from '@/lib/supabase/types'

/**
 * Compact read-only panel for Escribir ideas: what the client said + brand voice.
 */
export function ClientSaidPanel({
  clientId,
  brandVoice,
  suggestions,
}: {
  clientId: string
  brandVoice: string | null
  suggestions: ClientSuggestion[]
}) {
  const recent = recentSuggestions(suggestions, 8)
  const hasVoice = !!brandVoice?.trim()
  const empty = !hasVoice && recent.length === 0

  return (
    <aside className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Lo que dijo el cliente
        </h2>
        <Link
          href={`/clients/${clientId}?tab=overview`}
          className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
        >
          Ver / agregar en perfil
        </Link>
      </div>

      {empty ? (
        <p className="text-xs text-muted-foreground">
          Sin sugerencias ni brand voice aún. Pégalas en el perfil del cliente cuando lleguen por
          WhatsApp.
        </p>
      ) : (
        <div className="space-y-2">
          {hasVoice && (
            <div className="rounded-md border border-dashed bg-muted/20 px-2.5 py-2">
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Brand voice
              </p>
              <p className="whitespace-pre-wrap text-[12px] leading-snug">{brandVoice}</p>
            </div>
          )}
          {recent.length > 0 && (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto">
              {recent.map((s) => (
                <li key={s.id} className="rounded-md border bg-background px-2.5 py-1.5">
                  <p className="mb-0.5 text-[10px] text-muted-foreground">
                    {formatSuggestionSource(s.source)} · {formatDate(s.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap text-[12px] leading-snug">{s.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  )
}
