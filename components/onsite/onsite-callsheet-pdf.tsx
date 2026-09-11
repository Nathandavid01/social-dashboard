'use client'

import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'
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
 * Mounts the printable node only while generating, so it doesn't pollute the UI DOM/tests.
 */
export function OnsiteCallsheetPdf({
  session,
  shots,
}: {
  session: OnsiteSession
  shots: OnsiteShot[]
}) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [mountDoc, setMountDoc] = useState(false)

  const fileName = `onsite-${slugify(session.clientName)}-${session.date || todayStamp()}.pdf`
  const targetId = `onsite-callsheet-${session.id}`

  useEffect(() => {
    if (!mountDoc || !busy) return
    let cancelled = false
    ;(async () => {
      const el = document.getElementById(targetId)
      if (!el) {
        setBusy(false)
        setMountDoc(false)
        return
      }
      try {
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
          import('html2canvas'),
          import('jspdf'),
        ])
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
        if (cancelled) return
        const img = canvas.toDataURL('image/jpeg', 0.92)
        const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
        const pageW = pdf.internal.pageSize.getWidth()
        const pageH = pdf.internal.pageSize.getHeight()
        const imgW = pageW
        const imgH = (canvas.height / canvas.width) * imgW
        if (imgH <= pageH) {
          pdf.addImage(img, 'JPEG', 0, 0, imgW, imgH)
        } else {
          let position = 0
          while (position < imgH) {
            pdf.addImage(img, 'JPEG', 0, -position, imgW, imgH)
            position += pageH
            if (position < imgH) pdf.addPage()
          }
        }
        pdf.save(fileName)
      } catch {
        toast({
          title: 'No se pudo generar el PDF',
          description: 'Intenta de nuevo.',
          variant: 'destructive',
        })
      } finally {
        if (!cancelled) {
          setBusy(false)
          setMountDoc(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mountDoc, busy, targetId, fileName, toast])

  if (shots.length === 0) return null

  return (
    <>
      <Button
        variant="default"
        size="sm"
        className="h-10"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          setMountDoc(true)
        }}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        {busy ? 'Generando…' : 'Descargar PDF'}
      </Button>
      {mountDoc ? (
        <div
          id={targetId}
          className="pointer-events-none fixed left-[-10000px] top-0 w-[720px] bg-white p-8 text-black"
          aria-hidden="true"
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
                {s.objective ? (
                  <p className="mt-1 text-sm text-amber-900">
                    <span className="font-medium">Objetivo: </span>
                    {s.objective}
                    {s.funnelStage ? ` · ${s.funnelStage}` : ''}
                  </p>
                ) : null}
                {s.hook ? <p className="mt-1 text-sm italic text-neutral-800">&ldquo;{s.hook}&rdquo;</p> : null}
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
      ) : null}
    </>
  )
}
