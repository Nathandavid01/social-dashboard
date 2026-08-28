import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemberPipelineHistory } from './member-pipeline-history'
import type { EditorHistoryItem } from '@/lib/pipeline/editor-history'

const items: EditorHistoryItem[] = [
  {
    ideaId: 'a',
    title: 'Reel Lucky Pet',
    clientName: 'Lucky Pet',
    bucket: 'revision',
    at: '2026-08-10T18:14:00.000Z',
    ageDays: 15,
    thumbUrl: 'https://cdn.example/lucky.jpg',
  },
  {
    ideaId: 'b',
    title: 'Promo Speedy',
    clientName: 'Speedy Net',
    bucket: 'approved',
    at: '2026-08-20T15:00:00.000Z',
    ageDays: 5,
    thumbUrl: null,
  },
]

describe('MemberPipelineHistory', () => {
  it('muestra corte, banco, aprobados y los videos', () => {
    render(<MemberPipelineHistory editorName="Jeander Loop" items={items} />)
    expect(screen.getByTestId('member-pipeline-history')).toHaveTextContent('Historial de pipeline')
    expect(screen.getByText('Reel Lucky Pet')).toBeInTheDocument()
    expect(screen.getByText('Lucky Pet')).toBeInTheDocument()
    expect(screen.getByText(/promedio 15d/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Promo Speedy' })).toHaveAttribute('href', '/produccion/idea/b')
    expect(screen.getByRole('img', { name: 'Reel Lucky Pet' })).toHaveAttribute('src', 'https://cdn.example/lucky.jpg')
    expect(screen.getAllByText(/ago \d{4}.*\d+d/i).length).toBeGreaterThan(0)
  })

  it('vacío dice que no hay videos', () => {
    render(<MemberPipelineHistory editorName="David Grafico" items={[]} />)
    expect(screen.getByText(/David no tiene videos/i)).toBeInTheDocument()
  })
})
