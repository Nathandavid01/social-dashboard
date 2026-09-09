import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OnsiteCallsheetPdf } from './onsite-callsheet-pdf'
import type { OnsiteSession } from '@/lib/actions/onsite'
import type { OnsiteShot } from '@/lib/onsite/shot-types'

vi.mock('@/components/reportes/download-pdf-button', () => ({
  DownloadPdfButton: ({ fileName }: { fileName: string }) => (
    <button type="button">Descargar PDF {fileName}</button>
  ),
}))

const session = {
  id: 's1',
  title: 'Grabación',
  date: '2026-09-11',
  clientId: 'c1',
  clientName: 'Karen',
  location: 'San Juan',
  status: 'scheduled',
  perWeek: 3,
  perMonth: 12,
  slotTarget: 18,
  arrivedAt: null,
  arrivedById: null,
  arrivedByName: null,
  editorName: 'Mariliz',
} as OnsiteSession

const shots: OnsiteShot[] = [
  {
    id: 'i1',
    title: 'Hook cocina',
    hook: 'Prueba esto',
    visualBrief: 'Plano medio',
    shootingNotes: null,
    viralityScore: null,
    viralityWhy: null,
    referenceUrl: null,
    shotType: 'sony',
    recorded: false,
  },
]

describe('OnsiteCallsheetPdf', () => {
  it('renders download when there are shots', () => {
    render(<OnsiteCallsheetPdf session={session} shots={shots} />)
    expect(screen.getByRole('button', { name: /Descargar PDF/i })).toBeInTheDocument()
    expect(document.getElementById('onsite-callsheet-s1')).toBeTruthy()
  })

  it('renders nothing without shots', () => {
    const { container } = render(<OnsiteCallsheetPdf session={session} shots={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
