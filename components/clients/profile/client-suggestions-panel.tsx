'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Loader2, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RoleGate } from '@/components/auth/role-gate'
import { useToast } from '@/lib/hooks/use-toast'
import { addClientSuggestion } from '@/lib/actions/client-suggestions'
import {
  CLIENT_SUGGESTION_SOURCES,
  CLIENT_SUGGESTION_SOURCE_LABELS,
  formatSuggestionSource,
} from '@/lib/utils/client-suggestions'
import { formatDateTime } from '@/lib/utils'
import type { ClientSuggestion, ClientSuggestionSource } from '@/lib/supabase/types'

interface Props {
  clientId: string
  initial: ClientSuggestion[]
}

/**
 * Perfil del cliente — Sugerencias del cliente (entrada manual desde WhatsApp/mensajes).
 */
export function ClientSuggestionsPanel({ clientId, initial }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [items, setItems] = useState(initial)
  const [body, setBody] = useState('')
  const [source, setSource] = useState<ClientSuggestionSource>('whatsapp')
  const [isPending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const res = await addClientSuggestion({ clientId, body, source })
      if (res.error) {
        toast({ title: 'No se pudo guardar', description: res.error, variant: 'destructive' })
        return
      }
      if (res.suggestion) {
        setItems((prev) => [res.suggestion!, ...prev])
        setBody('')
        setSource('whatsapp')
        toast({ title: 'Sugerencia guardada' })
        router.refresh()
      }
    })
  }

  return (
    <Card className="animate-in fade-in duration-500 md:col-span-2 xl:col-span-3">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4" />
          Sugerencias del cliente
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Pega aquí lo que el cliente dijo por WhatsApp o mensaje para que el equipo lo vea al
          escribir ideas (gráficas / video). Solo entrada manual.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <RoleGate
          any={['clients.edit', 'clients.brand.edit']}
          fallback={
            <p className="text-xs text-muted-foreground">
              Solo lectura — pide a un admin o team member que agregue la sugerencia.
            </p>
          }
        >
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="client-suggestion-body" className="text-xs">
                Qué dijo el cliente
              </Label>
              <Textarea
                id="client-suggestion-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="Ej: Quiere un reel de cocina con tip rápido…"
                className="resize-none"
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="client-suggestion-source" className="text-xs">
                  Fuente
                </Label>
                <select
                  id="client-suggestion-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value as ClientSuggestionSource)}
                  className="h-9 rounded-md border bg-background px-2 text-sm outline-none"
                >
                  {CLIENT_SUGGESTION_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {CLIENT_SUGGESTION_SOURCE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={submit}
                disabled={isPending || !body.trim()}
                className="ml-auto"
              >
                {isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                )}
                Agregar
              </Button>
            </div>
          </div>
        </RoleGate>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay sugerencias registradas.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((s) => (
              <li key={s.id} className="rounded-md border bg-background px-3 py-2">
                <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
                    {formatSuggestionSource(s.source)}
                  </span>
                  <span>{formatDateTime(s.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{s.body}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
