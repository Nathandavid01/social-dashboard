'use client'

import { DownloadPdfButton } from '@/components/reportes/download-pdf-button'
import type { OnsiteShot } from '@/lib/onsite/shot-types'
import { shotTypeLabel } from '@/lib/onsite/shot-types'
import type { OnsiteSession } from '@/lib/actions/onsite'

function todayStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function slugify(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'cliente'
  )
}

/**
 * Call sheet PDF for On Site — ideas de la sesión para llevar a grabar.
 * Reuses DownloadPdfButton (html2canvas + jspdf).
 */
export function OnsiteCallsheetPdf({
  session,
  shots,
}: {
  session: OnsiteSession
  shots: OnsiteShot[]
}) {
  if (shots.length === 0) return null

  const fileName = `onsite-${slugify(session.clientName)}-${session.date || todayStamp()}.pdf`
  const targetId = `onsite-callsheet-${session.id}`

  return (
    <div className="flex items-center gap-2">
      <DownloadPdfButton targetId={targetId} fileName={fileName} />
      <div
        id={targetId}
        className="pointer-events-none fixed left-[-10000px] top-0 w-[720px] bg-white p-8 text-black"
        aria-hidden
      >
        <header className="mb-6 border-b border-neutral-300 pb-4">
          <p className="text-xs uppercase tracking-wide text-neutral-500">On Site · Call sheet</p>
          <h1 className="mt-1 text-2xl font-bold">{session.clientName}</h1>
          <p className="mt-1 text-sm text-neutral-700">
            {session.date}
            {session.location ? ` · ${session.location}` : ''}
            {session.title ? ` · ${session.title}` : ''}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {shots.length} idea{shots.length === 1 ? '' : 's'}
            {session.slotTarget > 0 ? ` · meta ${session.slotTarget}` : ''}
            {session.editorName ? ` · editor ${session.editorName}` : ''}
          </p>
        </header>

        <ol className="space-y-5">
          {shots.map((s, i) => (
            <li key={s.id} className="break-inside-avoid border-b border-neutral-200 pb-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-bold tabular-nums text-neutral-500">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h2 className="text-base font-semibold">{s.title}</h2>
                {s.shotType ? (
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-neutral-600">
                    {shotTypeLabel(s.shotType)}
                  </span>
                ) : null}
              </div>
              {s.hook ? (
                <p className="mt-1 text-sm italic text-neutral-800">&ldquo;{s.hook}&rdquo;</p>
              ) : null}
              {s.visualBrief ? (
                <p className="mt-2 text-sm text-neutral-800">
                  <span className="font-medium">Visual: </span>
                  {s.visualBrief}
                </p>
              ) : null}
              {s.shootingNotes ? (
                <p className="mt-1 text-sm text-neutral-800">
                  <span className="font-medium">Notas: </span>
                  {s.shootingNotes}
                </p>
              ) : null}
              {s.referenceUrl ? (
                <p className="mt-1 break-all text-xs text-neutral-600">Ref: {s.referenceUrl}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
