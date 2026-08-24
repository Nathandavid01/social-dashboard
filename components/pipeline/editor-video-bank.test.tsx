import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditorVideoBank } from './editor-video-bank'

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/lib/actions/idea-videos-r2', () => ({ getR2DownloadUrl: vi.fn() }))
vi.mock('@/lib/actions/video-preview', () => ({ getVideoPreviewUrl: vi.fn() }))
vi.mock('@/components/auth/role-gate', () => ({
  useHasPermission: () => true,
}))

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
              cardColor: '#E11D48',
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
            cardColor: '#10B981',
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

  it('pinta el logo real, no las iniciales, y el color de tarjeta del cliente', () => {
    const { container } = render(
      <EditorVideoBank
        rows={[{
          editorId: 'ed-maria',
          editorName: 'María R.',
          clients: [{
            clientId: 'c-speedy',
            clientName: 'Speedy Net',
            logoUrl: 'https://cdn.example/speedy.png',
            cardColor: '#E11D48',
            approvedCount: 1,
            clips: [{
              ideaId: 'i1',
              title: 'Promo',
              shootingNotes: null,
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
        }]}
      />,
    )
    expect(screen.getByRole('img', { name: 'Speedy Net' })).toHaveAttribute('src', 'https://cdn.example/speedy.png')
    expect(screen.queryByText('SP')).not.toBeInTheDocument()
    const card = container.querySelector('[data-testid="client-bank-card"]')
    expect(card).toHaveStyle({ borderColor: '#E11D48' })
  })

  it('sin logo, owner/supervisor ve el camino para subir uno', () => {
    render(
      <EditorVideoBank
        rows={[{
          editorId: 'ed-maria',
          editorName: 'María R.',
          clients: [{
            clientId: 'c-speedy',
            clientName: 'Speedy Net',
            logoUrl: null,
            cardColor: '#E11D48',
            approvedCount: 0,
            clips: [{
              ideaId: 'i1',
              title: 'Promo',
              shootingNotes: null,
              queue: 'waiting',
              files: [],
            }],
          }],
        }]}
      />,
    )
    expect(screen.getByText('SP')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /subir logo/i })
    expect(link).toHaveAttribute('href', '/clients/c-speedy')
  })
})
