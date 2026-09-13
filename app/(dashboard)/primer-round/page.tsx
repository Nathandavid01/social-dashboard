import { getPrimerRoundStudio } from '@/lib/actions/primer-round'
import { PrimerRoundStudio } from '@/components/primer-round/primer-round-studio'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Primer Round — upload mp4; AI caption + overlay verify + Metricool Reel.
 * Permisos: pipeline.read O recording.read (misma familia que Pipeline / On Site).
 */
export default async function PrimerRoundPage() {
  const { studio, error } = await getPrimerRoundStudio()

  if (error || !studio) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error ?? 'No se pudo cargar Primer Round.'}
      </p>
    )
  }

  return <PrimerRoundStudio studio={studio} />
}
