'use client'

import { useState } from 'react'
import type { SceneCheckReport } from '@/lib/llm/scene-check-types'

function fmtSecond(s: number): string {
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}

/** Badge del resultado de la revisión AI de subtítulos. Solo informa — nunca bloquea. */
export function SceneCheckBadge({ report }: { report: SceneCheckReport | null | undefined }) {
  const [open, setOpen] = useState(false)
  if (!report) return null

  if (report.status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
        ✓ Subtítulos revisados por AI
      </span>
    )
  }

  if (report.status === 'issues') {
    const n = report.issues.length
    return (
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap"
        >
          ⚠ {n} {n === 1 ? 'posible error' : 'posibles errores'} en subtítulos
        </button>
        {open && (
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-300">
            {report.issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="shrink-0 text-amber-500">•</span>
                <span className="min-w-0">
                  {issue.problem}
                  {issue.approxSecond != null && (
                    <span className="ml-1 text-[10px] opacity-70">({fmtSecond(issue.approxSecond)})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // error | skipped — discreto, sin alarmar
  return (
    <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap">
      Revisión AI no disponible
    </span>
  )
}
