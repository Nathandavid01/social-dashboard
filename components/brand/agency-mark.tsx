'use client'

import { NateLogo } from '@/components/shared/nate-logo'
import { cn } from '@/lib/utils'
import {
  resolveLogoImageSrc,
  splitBrandName,
  type AgencyBranding,
} from '@/lib/utils/agency-branding'

interface AgencyMarkProps {
  branding: AgencyBranding
  /** Square size of the mark in px */
  size?: number
  /** Show wordmark next to the mark */
  showWordmark?: boolean
  /** Dark panel (login left column) uses white text */
  onDark?: boolean
  className?: string
  wordmarkClassName?: string
}

/**
 * Renders the configured agency mark: built-in N, radar, or custom upload.
 */
export function AgencyMark({
  branding,
  size = 32,
  showWordmark = false,
  onDark = false,
  className,
  wordmarkClassName,
}: AgencyMarkProps) {
  const resolved = resolveLogoImageSrc(branding.logo_preset, branding.logo_url)
  const { head, accent } = splitBrandName(branding.brand_name)
  const accentColor = branding.primary_color

  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', className)}>
      {resolved.kind === 'radar' ? (
        <NateLogo size={size} className="shrink-0" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved.src}
          alt={branding.brand_name}
          width={size}
          height={size}
          className="shrink-0 rounded-lg object-cover"
          style={{ width: size, height: size }}
        />
      )}
      {showWordmark && (
        <div className={cn('min-w-0 flex flex-col leading-none', wordmarkClassName)}>
          <span
            className={cn(
              'truncate font-bold tracking-tight',
              onDark ? 'text-white' : 'text-foreground',
            )}
            style={{ fontSize: size >= 48 ? 27 : size >= 36 ? 18 : 16 }}
          >
            {head}
            {accent ? (
              <>
                {' '}
                <span style={{ color: accentColor }}>{accent}</span>
              </>
            ) : null}
          </span>
          {branding.tagline ? (
            <span
              className={cn(
                'mt-0.5 truncate text-xs',
                onDark ? 'text-zinc-400' : 'text-muted-foreground',
              )}
            >
              {branding.tagline}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}
