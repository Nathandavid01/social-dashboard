'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { AlertOctagon, Home, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: Props) {
  useEffect(() => {
    console.error('Dashboard route error:', error)
  }, [error])

  const isAccessDenied = error.message.toLowerCase().includes('acceso denegado') ||
    error.message.toLowerCase().includes('owner')

  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="w-full max-w-md space-y-5 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-500/10 text-red-500">
          <AlertOctagon className="h-8 w-8" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold">
            {isAccessDenied ? 'Acceso denegado' : 'Algo salió mal'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAccessDenied
              ? 'Tu rol actual no tiene permiso para esta acción. Habla con un Owner si necesitas acceso.'
              : 'La página no pudo cargar. Si el problema persiste, reporta el digest abajo.'}
          </p>
          {!isAccessDenied && error.digest && (
            <p className="font-mono text-[10px] text-muted-foreground">digest: {error.digest}</p>
          )}
        </div>
        <div className="flex justify-center gap-2">
          {!isAccessDenied && (
            <Button onClick={reset} variant="default" size="sm">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reintentar
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/home">
              <Home className="mr-1.5 h-3.5 w-3.5" /> Volver al inicio
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
