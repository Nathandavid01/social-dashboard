import type { Metadata } from 'next'
import { ClientRequestForm } from '@/components/portal/client-request-form'
import { Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Portal de Clientes | NMedia PR',
  description: 'Envía tu solicitud al equipo de NMedia PR',
}

export default function PortalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg mb-4">
            <Zap className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">NMedia PR</h1>
          <p className="text-muted-foreground mt-1.5">Portal de Clientes</p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Equipo disponible · Lunes a Sábado
          </div>
        </div>

        <ClientRequestForm />

        <p className="text-center text-xs text-muted-foreground mt-6">
          ¿Tienes una emergencia? Llámanos directamente al equipo de NMedia PR.
        </p>
      </div>
    </div>
  )
}
