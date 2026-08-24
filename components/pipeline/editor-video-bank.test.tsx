import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditorVideoBank } from './editor-video-bank'

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/lib/actions/idea-videos-r2', () => ({ getR2DownloadUrl: vi.fn() }))
vi.mock('@/lib/actions/video-preview', () => ({ getVideoPreviewUrl: vi.fn() }))

describe('EditorVideoBank', () => {
  it('muestra una fila por editor y una tabla por cliente con Ver y Bajar', () => {
    render(
      <EditorVideoBank
        rows={[
          {
            editorId: 'ed-maria',
            editorName: 'María R.',
            clients: [{
              clientId: 'c1',
              clientName: 'Blue Chiropractic',
              logoUrl: null,
              approvedCount: 4,
              clips: [{
                ideaId: 'i1',
                title: 'Intro clínica',
                shootingNotes: 'Toma 2',
                queue: 'active',
                files: [{
                  id: 'v1',
                  name: 'crudo.mp4',
                  kind: 'raw',
                  storageProvider: 'r2',
                  driveViewLink: null,
                }],
              }],
            }],
          },
        ]}
      />,
    )
    expect(screen.getByRole('heading', { name: 'María R.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Blue Chiropractic' })).toBeInTheDocument()
    expect(screen.getByText('Intro clínica')).toBeInTheDocument()
    expect(screen.getByText('crudo.mp4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ver/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /bajar/i })).toBeInTheDocument()
    expect(screen.getByTestId('approved-count')).toHaveTextContent('4 aprobados')
  })

  it('los clips en espera no tienen Ver ni Bajar', () => {
    render(
      <EditorVideoBank
        rows={[{
          editorId: 'ed-maria',
          editorName: 'María R.',
          clients: [{
            clientId: 'c1',
            clientName: 'Blue Chiropractic',
            logoUrl: null,
            approvedCount: 0,
            clips: [{
              ideaId: 'i9',
              title: 'Tercera toma',
              shootingNotes: null,
              queue: 'waiting',
              files: [],
            }],
          }],
        }]}
      />,
    )
    expect(screen.getByText('Tercera toma')).toBeInTheDocument()
    expect(screen.getByText(/en espera/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /bajar/i })).not.toBeInTheDocument()
  })
})
