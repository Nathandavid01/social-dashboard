import type { ComponentType, SVGProps } from 'react'
import { cn, platformColors, platformLabels } from '@/lib/utils'
import type { SocialPlatform } from '@/lib/supabase/types'

type IconProps = SVGProps<SVGSVGElement>

function InstagramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function FacebookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M13.5 21v-7h2.4l.4-2.9h-2.8V9.3c0-.84.26-1.41 1.46-1.41h1.44V5.3A20 20 0 0 0 14.7 5.2c-2.08 0-3.5 1.27-3.5 3.6v2.3H8.8V14h2.4v7z" />
    </svg>
  )
}

function TikTokIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1 0-5.18c.27 0 .53.04.78.12V9.69a5.74 5.74 0 0 0-.78-.05A5.69 5.69 0 1 0 15.55 15.3V8.83a7.34 7.34 0 0 0 4.3 1.38V7.12a4.28 4.28 0 0 1-3.25-1.3z" />
    </svg>
  )
}

function LinkedinIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M6.94 5a1.94 1.94 0 1 1-3.88 0 1.94 1.94 0 0 1 3.88 0zM3.3 8.4h3.28V21H3.3zM9.2 8.4h3.14v1.72h.05c.44-.83 1.5-1.7 3.1-1.7 3.32 0 3.93 2.18 3.93 5v7.58h-3.28v-6.72c0-1.6-.03-3.66-2.23-3.66-2.24 0-2.58 1.74-2.58 3.54V21H9.2z" />
    </svg>
  )
}

const platformIcons: Record<SocialPlatform, ComponentType<IconProps>> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: TikTokIcon,
  linkedin: LinkedinIcon,
}

export function PlatformBadges({ platforms }: { platforms: SocialPlatform[] }) {
  if (!platforms.length) return <span className="text-muted-foreground text-xs">—</span>

  return (
    <div className="flex items-center gap-1.5">
      {platforms.map((platform) => {
        const Icon = platformIcons[platform]
        return (
          <span
            key={platform}
            title={platformLabels[platform]}
            aria-label={platformLabels[platform]}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-transform hover:scale-105',
              platformColors[platform],
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        )
      })}
    </div>
  )
}
