'use client'

import { useState, useTransition } from 'react'
import { MessageSquare, Send, Loader2, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/lib/hooks/use-toast'
import { sendOwnerMessage } from '@/lib/actions/messages'
import { cn } from '@/lib/utils'

interface Props {
  clientId: string
  clientName: string
  ownerName: string | null
  ownerPhone: string | null
  goalReached: boolean
  targetSemana: number
  publicadasSemana: number
  /** Renders nothing if false (e.g. you only want it visible on goal). */
  alwaysShow?: boolean
  size?: 'sm' | 'default'
}

function buildSuggestion({
  ownerName,
  clientName,
  goalReached,
  targetSemana,
}: {
  ownerName: string | null
  clientName: string
  goalReached: boolean
  targetSemana: number
}): string {
  const hi = ownerName ? `¡Hola ${ownerName}!` : '¡Hola!'
  if (goalReached) {
    return `${hi} Soy del equipo de NMedia. Ya cumplimos los ${targetSemana} posts de esta semana para ${clientName}. ¿Cuándo nos vemos para grabar el próximo lote? 🎬`
  }
  return `${hi} Soy del equipo de NMedia. Queremos agendar la próxima sesión de grabación para ${clientName}. ¿Cuándo te queda mejor esta semana?`
}

export function NotifyOwnerButton({
  clientId,
  clientName,
  ownerName,
  ownerPhone,
  goalReached,
  targetSemana,
  publicadasSemana,
  alwaysShow = true,
  size = 'sm',
}: Props) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState(buildSuggestion({ ownerName, clientName, goalReached, targetSemana }))
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  if (!alwaysShow && !goalReached) return null

  const noPhone = !ownerPhone || ownerPhone.trim() === ''

  function send() {
    startTransition(async () => {
      const res = await sendOwnerMessage(clientId, {
        body,
        triggerKind: goalReached ? 'goal_reached' : 'manual',
      })
      if (res.error) toast({ title: 'No se pudo enviar', description: res.error, variant: 'destructive' })
      else {
        toast({ title: 'SMS enviado', description: `A ${ownerName ?? ownerPhone}` })
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v)
      // re-seed body when opening so suggestion reflects current goal state
      if (v) setBody(buildSuggestion({ ownerName, clientName, goalReached, targetSemana }))
    }}>
      <DialogTrigger asChild>
        <Button
          size={size}
          variant={goalReached ? 'default' : 'outline'}
          className={cn(
            'transition-all',
            goalReached && 'animate-pulse hover:animate-none bg-green-600 hover:bg-green-700',
          )}
        >
          {goalReached ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <MessageSquare className="mr-1.5 h-3.5 w-3.5" />}
          {goalReached ? 'Confirmar próxima sesión' : 'SMS al owner'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            SMS a {ownerName ?? 'owner'}
          </DialogTitle>
          <DialogDescription>
            {noPhone
              ? 'El owner no tiene teléfono guardado.'
              : `A ${ownerPhone} · ${publicadasSemana}/${targetSemana} esta semana`}
          </DialogDescription>
        </DialogHeader>

        {noPhone ? (
          <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>Agrega el teléfono del owner en la pestaña <strong>Resumen</strong> antes de enviar.</p>
          </div>
        ) : (
          <div className="space-y-2 py-1">
            <Label htmlFor="sms_body" className="text-xs">Mensaje</Label>
            <Textarea
              id="sms_body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={1500}
              className="resize-none"
            />
            <p className="text-right text-xs text-muted-foreground tabular-nums">{body.length}/1500</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={send} disabled={noPhone || !body.trim() || isPending}>
            {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-2 h-3.5 w-3.5" />}
            Enviar SMS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
