// Semantic status → Tailwind class sets, built on the design tokens in
// globals.css (--success / --warning / --info / --destructive). Use this
// instead of hardcoding bg-green-500 / text-red-500 / etc. so status colors
// stay consistent and adapt to light/dark automatically.

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export interface StatusClasses {
  /** Soft badge/pill: tinted background + readable foreground. */
  badge: string
  /** Just the accent text color. */
  text: string
  /** A small status dot / indicator background. */
  dot: string
}

const MAP: Record<StatusTone, StatusClasses> = {
  success: {
    badge: 'bg-success/10 text-success border-success/20',
    text: 'text-success',
    dot: 'bg-success',
  },
  warning: {
    badge: 'bg-warning/10 text-warning border-warning/20',
    text: 'text-warning',
    dot: 'bg-warning',
  },
  danger: {
    badge: 'bg-destructive/10 text-destructive border-destructive/20',
    text: 'text-destructive',
    dot: 'bg-destructive',
  },
  info: {
    badge: 'bg-info/10 text-info border-info/20',
    text: 'text-info',
    dot: 'bg-info',
  },
  neutral: {
    badge: 'bg-muted text-muted-foreground border-border',
    text: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
}

export function statusClasses(tone: StatusTone): StatusClasses {
  return MAP[tone] ?? MAP.neutral
}

/** Shorthand for the soft badge class string. */
export function statusBadge(tone: StatusTone): string {
  return statusClasses(tone).badge
}
