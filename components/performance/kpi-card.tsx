import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { statusClasses } from '@/lib/utils/status-color'
import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  description?: string
  highlight?: 'default' | 'success' | 'warning' | 'danger'
  href?: string
}

const highlightMap = {
  default: 'text-primary',
  success: statusClasses('success').text,
  warning: statusClasses('warning').text,
  danger: statusClasses('danger').text,
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  description,
  highlight = 'default',
  href,
}: KpiCardProps) {
  const content = (
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
  )

  if (href) {
    return (
      <Card className={cn('transition-colors', href && 'hover:border-primary/50 cursor-pointer')}>
        <Link href={href} className="block">
          {content}
        </Link>
      </Card>
    )
  }

  return <Card>{content}</Card>
}
