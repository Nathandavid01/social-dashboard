import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VideoUploadLog } from './video-upload-log'

describe('VideoUploadLog', () => {
  it('shows the current editor upload history with context and status', () => {
    render(<VideoUploadLog items={[{
      id: 'video-1',
      ideaId: 'idea-1',
      ideaTitle: 'Especial de verano',
      clientId: 'client-1',
      clientName: 'Cliente Demo',
      name: 'corte-final.mp4',
      kind: 'edited',
      status: 'uploaded',
      sizeBytes: 25 * 1024 * 1024,
      uploadedAt: '2026-08-08T18:30:00.000Z',
    }]} />)

    expect(screen.getByRole('link', { name: 'corte-final.mp4' })).toHaveAttribute('href', '/produccion/idea/idea-1')
    expect(screen.getByText('Cliente Demo · Especial de verano')).toBeInTheDocument()
    expect(screen.getByText('Editado')).toBeInTheDocument()
    expect(screen.getByText('Subido')).toBeInTheDocument()
    expect(screen.getByText('25.0 MB')).toBeInTheDocument()
  })

  it('explains when the editor has no uploads', () => {
    render(<VideoUploadLog items={[]} />)
    expect(screen.getByText('Todavía no has subido videos')).toBeInTheDocument()
  })
})
