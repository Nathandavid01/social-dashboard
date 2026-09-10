import { jsPDF } from 'jspdf'
import type { ProposalIdea } from './client-proposal'

/** Text PDF: selectable text, complete briefs, clean page breaks. */
export function buildProposalPdf(clientName: string, date: string, ideas: ProposalIdea[]) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const w = pdf.internal.pageSize.getWidth(), h = pdf.internal.pageSize.getHeight()
  const margin = 48, width = w - margin * 2
  let y = 0
  function header() {
    pdf.setFillColor(178, 139, 63); pdf.rect(margin, 36, 32, 4, 'F')
    pdf.setTextColor(80); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
    pdf.text('NATE MEDIA  /  PROPUESTA DE CONTENIDO', margin + 42, 41)
    pdf.setTextColor(25); pdf.setFontSize(23); pdf.text(clientName.trim(), margin, 78)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(90)
    pdf.text(`${ideas.length} ideas para aprobación del cliente  |  ${date}`, margin, 99)
    pdf.setDrawColor(220); pdf.line(margin, 115, w - margin, 115)
    y = 140
  }
  function page() { pdf.addPage(); header() }
  function paragraph(text: string, size = 11, bold = false) {
    pdf.setFontSize(size); pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setTextColor(35)
    const lines = pdf.splitTextToSize(text, width) as string[]
    for (const line of lines) {
      if (y > h - 70) { page(); pdf.setFontSize(size); pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setTextColor(35) }
      pdf.text(line, margin, y); y += size * 1.45
    }
  }
  header()
  ideas.forEach((idea, n) => {
    const measured = (text: string, size: number, bold = false) => {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size)
      return (pdf.splitTextToSize(text, width) as string[]).length * size * 1.45
    }
    const bodyHeight = measured(`${String(n + 1).padStart(2, '0')}  ${idea.title}`, 13, true) + 6
      + (idea.hook ? measured(idea.hook, 11) : 0)
      + (idea.visualBrief ? 8 + measured(idea.visualBrief, 11) : 0)
      + (!idea.hook && !idea.visualBrief ? measured('Sin descripción adicional.', 10) : 0)
      + (idea.referenceUrl ? 8 + measured(`Referencia: ${idea.referenceUrl}`, 9) : 0)
    if (y + Math.min(bodyHeight, 200) > h - 70) page()
    paragraph(`${String(n + 1).padStart(2, '0')}  ${idea.title}`, 13, true); y += 6
    if (idea.hook) paragraph(idea.hook)
    if (idea.visualBrief) { y += 8; paragraph(idea.visualBrief) }
    if (!idea.hook && !idea.visualBrief) paragraph('Sin descripción adicional.', 10)
    if (idea.referenceUrl) { y += 8; paragraph(`Referencia: ${idea.referenceUrl}`, 9) }
    y += 20
    if (y < h - 70) { pdf.setDrawColor(230); pdf.line(margin, y, w - margin, y); y += 24 }
  })
  const pages = pdf.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(110)
    pdf.text('Propuesta para revisión', margin, h - 32)
    pdf.text(`${p} / ${pages}`, w - margin, h - 32, { align: 'right' })
  }
  return pdf
}
