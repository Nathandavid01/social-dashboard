'use client'

import { useState } from 'react'
import type { ClientMatchResult, SceneCheckReport } from '@/lib/llm/scene-check-types'

function fmtSecond(s: number): string {
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}

function ClientMatchBadge({ result }: { result: ClientMatchResult }) {
  const [open, setOpen] = useState(false)
  const config = {
    match: {
      label: '✓ Corresponde al cliente',
      className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    },
    mismatch: {
      label: '⚠ No parece ser del cliente',
      className: 'bg-red-500/15 text-red-600 dark:text-red-400',
    },
    uncertain: {
      label: '? Cliente no confirmado',
      className: 'bg-muted text-muted-foreground',
    },
  }[result.status]

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${config.className}`}
      >
        {config.label}
      </button>
      {open && (
        <div className="mt-2 max-w-sm space-y-1 text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-300">
          <p>{result.reason}</p>
          {result.evidence.length > 0 && (
            <ul className="space-y-0.5">
              {result.evidence.map((item, index) => <li key={index}>• {item}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function SubtitleCheck({ report }: { report: SceneCheckReport }) {
  const [open, setOpen] = useState(false)

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
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap"
        >
          ⚠ {n} {n === 1 ? 'posible error' : 'posibles errores'} en subtítulos
        </button>
        {open && (
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-300">
            {report.issues.map((issue, index) => (
              <li key={index} className="flex items-start gap-2">
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

  return (
    <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap">
      Revisión AI no disponible
    </span>
  )
}

/** Resultado de ortografía + pertenencia al cliente. Solo informa; no bloquea. */
export function SceneCheckBadge({ report }: { report: SceneCheckReport | null | undefined }) {
  if (!report) return null
  return (
    <div className="flex min-w-0 flex-wrap items-start gap-2">
      <SubtitleCheck report={report} />
      {report.clientMatch && <ClientMatchBadge result={report.clientMatch} />}
    </div>
  )
}
