'use client'

import { Button } from '@/components/ui/button'
import { Bot } from 'lucide-react'

export const OPEN_CHAT_EVENT = 'nmedia:open-chat'

export function QuickBriefingButton() {
  const handleClick = () => {
    window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, {
      detail: { message: 'Dame un resumen completo del estado de la agencia hoy: tareas vencidas, bloqueadas, solicitudes de clientes pendientes, lo que está programado para publicar esta semana, y cualquier alerta activa.' }
    }))
  }

  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={handleClick}>
      <Bot className="h-3.5 w-3.5" />
      Resumen AI
    </Button>
  )
}
