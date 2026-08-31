import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BancoView } from './banco-view'
import type { VideoBank, BankVideoTile } from '@/lib/pipeline/video-bank'
import type { ProjectedCalendar } from '@/lib/pipeline/projected-calendar'

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/lib/actions/video-bank-covers', () => ({
  getBankCoverUrls: vi.fn(async () => ({ urls: {} })),
}))
vi.mock('@/lib/actions/content-ideas', () => ({ reassignVideo: vi.fn(async () => ({ success: true })) }))
vi.mock('@/lib/actions/client-assignments', () => ({ setClientAssignment: vi.fn(async () => ({ ok: true })) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

function tile(over: Partial<BankVideoTile> = {}): BankVideoTile {
  return {
    videoId: 'v1',
    ideaId: 'i1',
    productionTaskId: 'pt1',
    title: 'Intro clínica',
    kind: 'raw',
    durationSec: 62,
    thumbKeys: ['t/v1-0.jpg'],
    hasCover: true,
    recordedBy: null,
    uploadedAt: '2026-08-30T10:00:00Z',
    clientId: 'c1',
    clientName: 'ARASIBO',
    editorId: 'e1',
    editorName: 'María',
    assignedVia: 'idea',
    ...over,
  }
}

function bank(): VideoBank {
  return {
    rails: [
      {
        clientId: 'c1',
        clientName: 'ARASIBO',
        logoUrl: null,
        cardColor: '#eab308',
        postingDays: [1, 3],
        videoCount: 2,
        editorId: 'e1',
        editorName: 'María',
        assignedVia: 'idea',
        videos: [tile(), tile({ videoId: 'v2', ideaId: 'i2', title: 'Testimonio', hasCover: false, thumbKeys: [] })],
      },
    ],
    totals: { videos: 2, clients: 1, unassigned: 0 },
  }
}

const CALENDAR: ProjectedCalendar = {
  posts: [
    { ideaId: 'i9', title: 'Video listo', clientId: 'c1', clientName: 'ARASIBO', date: '2026-09-02', time: '18:00', dayOfWeek: 3 },
  ],
  overflow: [{ ideaId: 'i10', title: 'Sin espacio', clientId: 'c1', clientName: 'ARASIBO' }],
}

function view(over: Partial<Parameters<typeof BancoView>[0]> = {}) {
  return render(
    <BancoView
      bank={bank()}
      calendar={CALENDAR}
      devueltos={[{ ideaId: 'i5', title: 'Reel virado', clientName: 'ARASIBO', editorName: 'María' }]}
      editors={[{ id: 'e1', name: 'María', wipLimit: 3, approved: 12, returned: 2, queueCount: 4 }]}
      teamEditors={[{ id: 'e1', name: 'María' }, { id: 'e2', name: 'Pablo' }]}
      clientLogos={{}}
      {...over}
    />,
  )
}

describe('BancoView', () => {
  it('enseña el carril del cliente con su conteo de videos y los tiles de carátula', () => {
    view()
    expect(screen.getByText('ARASIBO')).toBeInTheDocument()
    expect(screen.getByTestId('rail-count-c1')).toHaveTextContent('2')
    expect(screen.getByText('Intro clínica')).toBeInTheDocument()
    expect(screen.getByText('Testimonio')).toBeInTheDocument()
    // Solo carátula: jamás un <video> en el banco.
    expect(document.querySelector('video')).toBeNull()
  })

  it('la sección Devueltos enseña lo virado por QC IA o admins', () => {
    view()
    expect(screen.getByTestId('devueltos')).toHaveTextContent('Reel virado')
  })

  it('la tira de editores enseña el WIP dinámico y su % de aprobación', () => {
    view()
    const strip = screen.getByTestId('editor-strip')
    expect(strip).toHaveTextContent('María')
    expect(strip).toHaveTextContent('3 a la vez')
    expect(strip).toHaveTextContent('86%') // 12/(12+2)
  })

  it('la pestaña Calendario proyecta fechas y enseña el overflow', () => {
    view()
    fireEvent.mouseDown(screen.getByRole('tab', { name: /calendario/i }), { button: 0 })
    fireEvent.click(screen.getByRole('tab', { name: /calendario/i }))
    expect(screen.getByText('Video listo')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-overflow')).toHaveTextContent('Sin espacio')
  })

  it('banco vacío → estado vacío claro, sin carriles', () => {
    view({ bank: { rails: [], totals: { videos: 0, clients: 0, unassigned: 0 } }, devueltos: [] })
    expect(screen.getByText(/no hay crudos/i)).toBeInTheDocument()
  })
})
