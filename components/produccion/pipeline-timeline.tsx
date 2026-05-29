'use client'

import { useEffect, useState } from 'react'
import {
  Lightbulb, Sparkles, Scissors, Palette, Clapperboard, CheckCircle2, Megaphone, Check, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TimelineStage {
  id: string          // anchor id of the section in the page
  label: string
  icon: 'idea' | 'caption' | 'material' | 'assets' | 'edited' | 'approval' | 'published'
  done: boolean
  count?: { current: number; total: number }
  detail?: string
}

const ICONS: Record<TimelineStage['icon'], LucideIcon> = {
  idea: Lightbulb,
  caption: Sparkles,
  material: Scissors,
  assets: Palette,
  edited: Clapperboard,
  approval: CheckCircle2,
  published: Megaphone,
}

/**
 * Horizontal, clickable pipeline timeline for the editor workspace.
 * Clicking a stage smooth-scrolls to its section. Highlights the section
 * currently in view via IntersectionObserver.
 */
export function PipelineTimeline({ stages }: { stages: TimelineStage[] }) {
  const [active, setActive] = useState<string | null>(stages[0]?.id ?? null)

  useEffect(() => {
    const sections = stages
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null)
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0.1, 0.5, 1] },
    )
    sections.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [stages])

  function goTo(id: string) {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActive(id)
    }
  }

  return (
    <nav
      className="sticky top-0 z-20 -mx-4 border-b bg-background/85 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6"
      aria-label="Etapas de producción"
    >
      <ol className="no-scrollbar flex items-center gap-1 overflow-x-auto">
        {stages.map((s, i) => {
          const Icon = ICONS[s.icon]
          const isActive = active === s.id
          return (
            <li key={`${s.id}-${i}`} className="flex shrink-0 items-center">
              <button
                onClick={() => goTo(s.id)}
                className={cn(
                  'group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : s.done
                      ? 'border-green-500/30 bg-green-500/10 text-green-600 hover:border-green-500/50'
                      : 'border-border bg-muted text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                <span className={cn(
                  'grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px]',
                  isActive ? 'bg-primary-foreground/20' : s.done ? 'bg-green-500/20' : 'bg-background',
                )}>
                  {s.done && !isActive ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                </span>
                <span className="whitespace-nowrap">{s.label}</span>
                {s.count && (
                  <span className="tabular-nums opacity-80">{s.count.current}/{s.count.total}</span>
                )}
                {s.detail && !s.count && (
                  <span className="whitespace-nowrap opacity-70">· {s.detail}</span>
                )}
              </button>
              {i < stages.length - 1 && (
                <span className={cn('mx-0.5 h-px w-4 shrink-0 sm:w-6', s.done ? 'bg-green-500/40' : 'bg-border')} />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
