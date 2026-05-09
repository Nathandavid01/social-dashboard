import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  description?: string
  highlight?: 'default' | 'success' | 'warning' | 'danger'
}

const highlightMap = {
  default: 'text-primary',
  success: 'text-green-500',
  warning: 'text-yellow-500',
  danger: 'text-red-500',
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  description,
  highlight = 'default',
}: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {label}
            </p>
            <p className={cn('text-3xl font-bold', highlightMap[highlight])}>{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className={cn('h-5 w-5', highlightMap[highlight])} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
