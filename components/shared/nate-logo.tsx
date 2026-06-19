import { cn } from '@/lib/utils'

/**
 * Nate Media brand mark — the gold "N" monogram (negro + dorado). Reusable
 * wherever the brand needs to appear (auth, headers, emails-as-HTML, etc.).
 * `size` is the square px size of the monogram.
 */
export function NateLogo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-amber-600 font-bold text-black shadow-lg shadow-primary/25 ring-1 ring-white/10',
        className,
      )}
      style={{ height: size, width: size, fontSize: Math.round(size * 0.5) }}
      aria-label="Nate Media"
      role="img"
    >
      N
    </span>
  )
}
