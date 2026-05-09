import { Badge } from '@/components/ui/badge'
import { cn, platformColors, platformLabels } from '@/lib/utils'
import type { SocialPlatform } from '@/lib/supabase/types'

export function PlatformBadges({ platforms }: { platforms: SocialPlatform[] }) {
  if (!platforms.length) return <span className="text-muted-foreground text-xs">None</span>

  return (
    <div className="flex flex-wrap gap-1">
      {platforms.map((platform) => (
        <Badge
          key={platform}
          variant="outline"
          className={cn('text-xs', platformColors[platform])}
        >
          {platformLabels[platform]}
        </Badge>
      ))}
    </div>
  )
}
