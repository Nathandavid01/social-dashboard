import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EditorVideoBank } from './editor-video-bank'
import type { EditorBankRow } from '@/lib/pipeline/editor-video-bank'
import type { VideoBank } from '@/lib/pipeline/video-bank'
import type { EditorPace } from '@/lib/pipeline/editor-pace'

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
    approvalAt: null,
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
    approvalRate: null,
    nextSlots: [],
    clients: [],
    ...over,
  }
}

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
const actionMocks = vi.hoisted(() => ({ reassignVideo: vi.fn() }))
vi.mock('@/lib/actions/content-ideas', () => ({ reassignVideo: actionMocks.reassignVideo }))
vi.mock('@/lib/actions/idea-videos-r2', () => ({ getR2DownloadUrl: vi.fn() }))
vi.mock('@/lib/actions/video-preview', () => ({ getVideoPreviewUrl: vi.fn() }))
vi.mock('@/lib/actions/video-thumbs', () => ({
  getPipelineVideoThumbViewUrls: vi.fn(() => new Promise(() => {})),
}))
vi.mock('@/components/auth/role-gate', () => ({
  useHasPermission: () => true,
}))

describe('EditorVideoBank', () => {
  it('dice si cada cliente va adelantado o atrasado según su runway', () => {
    const bank: VideoBank = {
      totals: { videos: 2, clients: 2, unassigned: 0 },
      rails: [
        {
          clientId: 'c1', clientName: 'Lucky Pet', logoUrl: null, cardColor: '#A97845',
          postingDays: [1, 3, 5], videoCount: 1, editorId: 'ed-maria', editorName: 'María R.', assignedVia: 'idea',
          videos: [{ videoId: 'v1', ideaId: 'i1', productionTaskId: null, title: 'Video uno', kind: 'raw', durationSec: null, thumbKeys: [], hasCover: false, recordedBy: null, uploadedAt: null, clientId: 'c1', clientName: 'Lucky Pet', editorId: 'ed-maria', editorName: 'María R.', assignedVia: 'idea' }],
        },
        {
          clientId: 'c2', clientName: 'Speedy Net', logoUrl: null, cardColor: '#835CF0',
          postingDays: [1, 3, 5], videoCount: 1, editorId: 'ed-maria', editorName: 'María R.', assignedVia: 'idea',
          videos: [{ videoId: 'v2', ideaId: 'i2', productionTaskId: null, title: 'Video dos', kind: 'raw', durationSec: null, thumbKeys: [], hasCover: false, recordedBy: null, uploadedAt: null, clientId: 'c2', clientName: 'Speedy Net', editorId: 'ed-maria', editorName: 'María R.', assignedVia: 'idea' }],
        },
      ],
    }

    render(
      <EditorVideoBank
        rows={[]}
        videoBank={bank}
        clientRunway={{
          c1: { ideasWeeks: 5, recordedWeeks: 4, editedWeeks: 4, minWeeks: 4, status: 'ok' },
          c2: { ideasWeeks: 3, recordedWeeks: 1, editedWeeks: 2, minWeeks: 1, status: 'risk' },
        }}
      />,
    )

    expect(screen.getByTestId('client-runway-c1')).toHaveTextContent('Adelantado · 4 sem')
    expect(screen.getByTestId('client-runway-c2')).toHaveTextContent('Atrasado · 1 sem')
  })

  it('presenta los dos espacios, el banco visual por cliente y el ritmo como en el preview v3.90', () => {
    const bank: VideoBank = {
      totals: { videos: 1, clients: 1, unassigned: 0 },
      rails: [{
        clientId: 'c1',
        clientName: 'Lucky Pet',
        logoUrl: null,
        cardColor: '#A97845',
        postingDays: [1, 3, 5],
        videoCount: 1,
        editorId: 'ed-maria',
        editorName: 'María R.',
        assignedVia: 'idea',
        videos: [{
          videoId: 'v1',
          ideaId: 'i1',
          productionTaskId: 'pt1',
          title: 'Baño y corte, antes y después',
          kind: 'raw',
          durationSec: 134,
          thumbKeys: [],
          hasCover: false,
          recordedBy: 'Neitan',
          uploadedAt: '2026-08-24T10:00:00.000Z',
          clientId: 'c1',
          clientName: 'Lucky Pet',
          editorId: 'ed-maria',
          editorName: 'María R.',
          assignedVia: 'idea',
        }],
      }],
    }
    const paces: EditorPace[] = [{
      editorId: 'ed-maria',
      medianDays: 1.9,
      delivered: 14,
      previousMedianDays: 2.1,
      trendDays: -0.2,
    }]

    render(
      <EditorVideoBank
        rows={[row({
          editorName: 'María R.',
          nowCount: 1,
          nextSlots: [{ ideaId: 'i1', title: 'Baño y corte, antes y después', clientName: 'Lucky Pet' }],
          clients: [{
            clientId: 'c1', clientName: 'Lucky Pet', logoUrl: null, cardColor: '#A97845',
            approvedCount: 0, remainingInBank: 1, inRevision: 0, postingDays: [1, 3, 5],
            clips: [clip({ ideaId: 'i1', title: 'Baño y corte, antes y después', yours: true, queue: 'active' })],
          }],
        })]}
        videoBank={bank}
        paces={paces}
        teamMembers={[{ id: 'ed-maria', name: 'María R.' }]}
      />,
    )

    expect(screen.getByRole('heading', { name: /espacios de edición/i })).toBeInTheDocument()
    expect(screen.getByTestId('editor-slot-ed-maria-0')).toHaveTextContent('Baño y corte, antes y después')
    expect(screen.getByTestId('editor-slot-ed-maria-1')).toHaveTextContent('Espacio libre')
    expect(screen.getByRole('heading', { name: /banco de videos crudos/i })).toBeInTheDocument()
    expect(screen.getByTestId('raw-video-v1')).toHaveTextContent('2:14')
    expect(screen.getByRole('heading', { name: /ritmo de los editores/i })).toBeInTheDocument()
    expect(screen.getByTestId('editor-pace-ed-maria')).toHaveTextContent('1.9 d')
    expect(screen.getByTestId('editor-pace-ed-maria')).toHaveTextContent('14 en 30 d')
  })

  it('reasigna un crudo desde su selector del banco', async () => {
    actionMocks.reassignVideo.mockResolvedValue({ success: true })
    const bank: VideoBank = {
      totals: { videos: 1, clients: 1, unassigned: 1 },
      rails: [{
        clientId: 'c1', clientName: 'Lucky Pet', logoUrl: null, cardColor: '#A97845',
        postingDays: [], videoCount: 1, editorId: null, editorName: null, assignedVia: null,
        videos: [{
          videoId: 'v1', ideaId: 'i1', productionTaskId: 'pt-77', title: 'Crudo nuevo',
          kind: 'raw', durationSec: 60, thumbKeys: [], hasCover: false,
          recordedBy: null, uploadedAt: null, clientId: 'c1', clientName: 'Lucky Pet',
          editorId: null, editorName: null, assignedVia: null,
        }],
      }],
    }
    render(<EditorVideoBank rows={[]} videoBank={bank} teamMembers={[{ id: 'ed-2', name: 'Alexa' }]} />)

    fireEvent.change(screen.getByRole('combobox', { name: /asignar crudo nuevo/i }), { target: { value: 'ed-2' } })

    await waitFor(() => expect(actionMocks.reassignVideo).toHaveBeenCalledWith('pt-77', 'ed-2'))
  })

  it('muestra una fila por editor y permite bajar sin reproducir el video', () => {
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
                approvalAt: null,
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
    expect(screen.queryByRole('button', { name: /ver/i })).not.toBeInTheDocument()
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

describe('hora de aprobación en el espacio activo', () => {
  it('muestra "Aprobado para …" calculado, o pide la fecha si no hay', () => {
    const withDate = row({ clients: [{ clientId: 'c1', clientName: 'Blue Chiropractic', logoUrl: null, cardColor: '#c8a34a', approvedCount: 0, remainingInBank: 1, inRevision: 0, postingDays: [],
      clips: [clip({ ideaId: 'i1', yours: true, queue: 'active', approvalAt: { at: '2026-09-02T10:00', basis: 'publish', publishAt: '2026-09-03T10:00' } })] }] })
    render(<EditorVideoBank rows={[withDate]} videoBank={{ rails: [], totals: { videos: 0, clients: 0, unassigned: 0 } }} />)
    expect(screen.getByTestId('approval-target')).toHaveTextContent('Aprobado para mié 2 sep · 10:00 a. m. · publica jue 3 sep · 10:00 a. m.')
  })
  it('sin fecha lo dice en rojo suave', () => {
    const noDate = row({ clients: [{ clientId: 'c1', clientName: 'Blue Chiropractic', logoUrl: null, cardColor: '#c8a34a', approvedCount: 0, remainingInBank: 1, inRevision: 0, postingDays: [],
      clips: [clip({ ideaId: 'i1', yours: true, queue: 'active', approvalAt: null })] }] })
    render(<EditorVideoBank rows={[noDate]} videoBank={{ rails: [], totals: { videos: 0, clients: 0, unassigned: 0 } }} />)
    expect(screen.getByTestId('approval-target')).toHaveTextContent(/Sin fecha de publicación/)
  })
})
