'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'

/** One-click PDF download of the report node — captures it client-side (no print dialog). */
export function DownloadPdfButton({ targetId, fileName }: { targetId: string; fileName: string }) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  async function download() {
    const el = document.getElementById(targetId)
    if (!el) return
    setBusy(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const img = canvas.toDataURL('image/jpeg', 0.92)

      const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgW = pageW
      const imgH = (canvas.height / canvas.width) * imgW

      if (imgH <= pageH) {
        pdf.addImage(img, 'JPEG', 0, 0, imgW, imgH)
      } else {
        // Slice the tall capture across pages by shifting the image up each page.
        let position = 0
        while (position < imgH) {
          pdf.addImage(img, 'JPEG', 0, -position, imgW, imgH)
          position += pageH
          if (position < imgH) pdf.addPage()
        }
      }
      pdf.save(fileName)
    } catch {
      toast({ title: 'No se pudo generar el PDF', description: 'Intenta de nuevo o usa Imprimir.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="default" size="sm" onClick={download} disabled={busy} className="h-9">
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
      {busy ? 'Generando…' : 'Descargar PDF'}
    </Button>
  )
}
