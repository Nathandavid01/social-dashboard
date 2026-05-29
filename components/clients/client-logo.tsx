import { cn } from '@/lib/utils'

/**
 * Client logo (Metricool-style) — shows the uploaded `logo_url` when present,
 * otherwise the client's initials. Reuse anywhere a client appears so the brand
 * is consistent across cards. Size via `className` (defaults to 44px).
 */
export function ClientLogo({
  name,
  logoUrl,
  className,
}: {
  name: string | null | undefined
  logoUrl: string | null | undefined
  className?: string
}) {
  const initials = name?.slice(0, 2).toUpperCase() || '??'
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name ?? 'Cliente'}
        className={cn('shrink-0 rounded-lg border object-contain bg-background p-0.5', className ?? 'h-11 w-11')}
      />
    )
  }
  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center rounded-lg border bg-muted font-bold text-muted-foreground',
        className ?? 'h-11 w-11 text-sm',
      )}
      aria-label={name ?? 'Cliente'}
    >
      {initials}
    </div>
  )
}
