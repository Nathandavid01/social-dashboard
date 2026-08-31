import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditorVideoBank } from './editor-video-bank'
import type { EditorBankRow } from '@/lib/pipeline/editor-video-bank'

function clip(over: EditorBankRow['clients'][0]['clips'][0] extends infer C ? Partial<C> : never) {
  return {
    ideaId: 'i1',
    title: 'Intro clínica',
    hook: null,
    visualBrief: null,
    shootingNotes: null,
    recordedBy: null,
    recordedAt: null,
    deadline: null,
    location: null,
    contentType: 'R' as const,
    yours: false,
    queue: 'waiting' as const,
    files: [] as EditorBankRow['clients'][0]['clips'][0]['files'],
    ...over,
  }
}

function row(over: Partial<EditorBankRow> = {}): EditorBankRow {
  return {
    editorId: 'ed-maria',
    editorName: 'María R.',
    remainingInBank: 1,
    nowCount: 1,
    inRevision: 0,
    wipLimit: 2,
    nextSlots: [],
    clients: [],
    ...over,
  }
}

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
          row({
            nowCount: 1,
            remainingInBank: 1,
            inRevision: 2,
            clients: [{
              clientId: 'c1',
              clientName: 'Blue Chiropractic',
              logoUrl: null,
              cardColor: '#E11D48',
              approvedCount: 4,
              remainingInBank: 1,
              inRevision: 2,
              postingDays: [],
              clips: [{
                ideaId: 'i1',
                title: 'Intro clínica',
                hook: null,
                visualBrief: null,
                shootingNotes: 'Toma 2',
                recordedBy: 'Diego',
                recordedAt: null,
                deadline: null,
                location: null,
                contentType: 'R',
                yours: true,
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
          }),
        ]}
      />,
    )
    expect(screen.getByRole('heading', { name: 'María R.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Blue Chiropractic' })).toBeInTheDocument()
    expect(screen.getByText('Intro clínica')).toBeInTheDocument()
    expect(screen.getByText('Te toca')).toBeInTheDocument()
    expect(screen.getByText(/anotaciones/i)).toBeInTheDocument()
    expect(screen.getByText('crudo.mp4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ver/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /bajar/i })).toBeInTheDocument()
    expect(screen.getByTestId('approved-count')).toHaveTextContent('4 aprobados')
    const load = screen.getByTestId('editor-load-ed-maria')
    expect(load).toHaveTextContent('1')
    expect(load).toHaveTextContent('Ahora')
    expect(load).toHaveTextContent('Banco')
    expect(load).toHaveTextContent('Revisión')
    expect(screen.getByTestId('editor-profile-ed-maria')).toHaveAttribute('href', '/team/ed-maria')
  })

  it('Sin asignar no abre perfil', () => {
    render(
      <EditorVideoBank
        rows={[row({
          editorId: null,
          editorName: 'Sin asignar',
          remainingInBank: 1,
          clients: [{
            clientId: 'c1',
            clientName: 'X',
            logoUrl: null,
            cardColor: '#111',
            approvedCount: 0,
            remainingInBank: 1,
            inRevision: 0,
            postingDays: [],
            clips: [clip({ title: 'Toma' })],
          }],
        })]}
      />,
    )
    expect(screen.queryByTestId('editor-profile-unassigned')).toBeNull()
    expect(screen.getByTestId('editor-load-unassigned')).toBeInTheDocument()
  })

  it('sección Admins lista owners y supervisores, no mezcla clips', () => {
    render(
      <EditorVideoBank
        admins={[
          { id: 'o1', name: 'Eric Pérez', email: 'eric@nate.media', role: 'owner', roleLabel: 'Owner' },
          { id: 's1', name: 'Ana', email: 'ana@nate.media', role: 'supervisor', roleLabel: 'Supervisor' },
        ]}
        rows={[
          row({
            nowCount: 0,
            remainingInBank: 1,
            clients: [{
              clientId: 'c1',
              clientName: 'Blue Chiropractic',
              logoUrl: null,
              cardColor: '#E11D48',
              approvedCount: 0,
              remainingInBank: 1,
              inRevision: 0,
              postingDays: [],
              clips: [clip({ title: 'Intro clínica', queue: 'waiting' })],
            }],
          }),
        ]}
      />,
    )
    const section = screen.getByTestId('bank-admins')
    expect(section).toHaveTextContent('Admins')
    expect(section).toHaveTextContent('Eric Pérez')
    expect(section).toHaveTextContent('Owner')
    expect(section).toHaveTextContent('Ana')
    expect(section).toHaveTextContent('Supervisor')
    expect(section).not.toHaveTextContent('Intro clínica')
  })

  it('los clips en espera no tienen Ver ni Bajar', () => {
    render(
      <EditorVideoBank
        rows={[row({
          nowCount: 0,
          remainingInBank: 1,
          clients: [{
            clientId: 'c1',
            clientName: 'Blue Chiropractic',
            logoUrl: null,
            cardColor: '#10B981',
            approvedCount: 0,
            remainingInBank: 1,
            inRevision: 0,
            postingDays: [],
            clips: [clip({ ideaId: 'i9', title: 'Tercera toma', queue: 'waiting' })],
          }],
        })]}
      />,
    )
    expect(screen.getByText('Tercera toma')).toBeInTheDocument()
    expect(screen.getByText(/en espera/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /bajar/i })).not.toBeInTheDocument()
  })

  it('pinta el logo real, no las iniciales, y el color de tarjeta del cliente', () => {
    const { container } = render(
      <EditorVideoBank
        rows={[row({
          clients: [{
            clientId: 'c-speedy',
            clientName: 'Speedy Net',
            logoUrl: 'https://cdn.example/speedy.png',
            cardColor: '#E11D48',
            approvedCount: 1,
            remainingInBank: 1,
            inRevision: 0,
            postingDays: [],
            clips: [clip({
              title: 'Promo',
              yours: true,
              queue: 'active',
              files: [{
                id: 'v1',
                name: 'crudo.mp4',
                kind: 'raw',
                storageProvider: 'r2',
                driveViewLink: null,
              }],
            })],
          }],
        })]}
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
        rows={[row({
          nowCount: 0,
          remainingInBank: 1,
          clients: [{
            clientId: 'c-speedy',
            clientName: 'Speedy Net',
            logoUrl: null,
            cardColor: '#E11D48',
            approvedCount: 0,
            remainingInBank: 1,
            inRevision: 0,
            postingDays: [],
            clips: [clip({ title: 'Promo', queue: 'waiting' })],
          }],
        })]}
      />,
    )
    expect(screen.getByText('SP')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /subir logo/i })
    expect(link).toHaveAttribute('href', '/clients/c-speedy')
  })
})
