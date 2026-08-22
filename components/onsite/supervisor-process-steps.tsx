'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supervisorProcessView } from '@/lib/onsite/supervisor-process'

export function SupervisorProcessSteps({ pathname }: { pathname: string }) {
  const steps = supervisorProcessView(pathname)
  return (
    <nav aria-label="Proceso" className="flex flex-wrap items-center gap-1.5">
      {steps.map((s, i) => (
        <span key={s.href} className="flex items-center gap-1.5">
          <Link
            href={s.href}
            aria-current={s.current ? 'step' : undefined}
            className={cn(
              'inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-[12px] font-semibold transition',
              s.current && 'bg-primary text-primary-foreground',
              s.done && 'bg-emerald-500/15 text-emerald-500',
              !s.current && !s.done && 'border text-muted-foreground hover:bg-muted',
            )}
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-black/20 text-[12px] tabular-nums">
              {s.done ? <Check className="h-3 w-3" aria-hidden /> : s.n}
            </span>
            {s.label}
          </Link>
          {i < steps.length - 1 && (
            <span className="text-muted-foreground/40" aria-hidden>
              →
            </span>
          )}
        </span>
      ))}
    </nav>
  )
}
