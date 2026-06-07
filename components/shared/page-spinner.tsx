import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Minimal, logo-less route loader — a subtle centered spinner on the app
 * background. Used as the Suspense fallback for route transitions so navigation
 * doesn't flash the full-screen brand splash.
 */
export function PageSpinner({ className }: { className?: string }) {
  return (
    <div
      className={cn('flex w-full items-center justify-center py-24', className)}
      role="status"
      aria-live="polite"
      aria-label="Cargando"
    >
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
    </div>
  )
}
