import { cn } from '@/lib/utils'

export function scoreTier(score: number): 'good' | 'warn' | 'bad' {
  if (score >= 80) return 'good'
  if (score >= 60) return 'warn'
  return 'bad'
}

const tierClasses = {
  good: 'bg-green-500/10 text-green-500 border-green-500/30',
  warn: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  bad: 'bg-red-500/10 text-red-500 border-red-500/30',
}

export function ScoreBadge({ score }: { score: number }) {
  const tier = scoreTier(score)
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-sm font-semibold tabular-nums w-12',
        tierClasses[tier],
      )}
    >
      {score}
    </span>
  )
}
