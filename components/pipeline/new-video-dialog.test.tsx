import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { NewVideoDialog } from './new-video-dialog'
import type { ClientPipelineSummary } from '@/lib/utils/content-batches'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const createContentIdeaManual = vi.fn<(...a: unknown[]) => Promise<{ idea?: unknown; error?: string }>>(async () => ({ idea: { id: 'new' } }))
vi.mock('@/lib/actions/content-ideas', () => ({
  createContentIdeaManual: (...a: unknown[]) => createContentIdeaManual(...a),
}))

// Radix Select needs scrollIntoView/pointer APIs jsdom lacks; stub Select to a native control.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
    <select aria-label="select" value={value} onChange={(e) => onValueChange(e.target.value)}>{children}</select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}))

const clients = [{ id: 'c1', name: 'Nora Fitness' }, { id: 'c2', name: 'Lumen' }]

beforeEach(() => {
  cleanup()
  refresh.mockClear()
  createContentIdeaManual.mockClear()
  createContentIdeaManual.mockResolvedValue({ idea: { id: 'new' } })
})

describe('NewVideoDialog', () => {
  it('creates an idea with the chosen client, title and type, then refreshes', async () => {
    render(<NewVideoDialog clients={clients} />)
    fireEvent.click(screen.getByRole('button', { name: /nuevo video/i }))

    const selects = screen.getAllByLabelText('select')
    fireEvent.change(selects[0], { target: { value: 'c2' } }) // client
    fireEvent.change(screen.getByPlaceholderText(/título/i), { target: { value: 'Mi nuevo reel' } })

    fireEvent.click(screen.getByRole('button', { name: /^crear$/i }))
    await waitFor(() =>
      expect(createContentIdeaManual).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'c2', title: 'Mi nuevo reel', contentType: 'R' }),
      ),
    )
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('disables Crear until a client and title are provided', () => {
    render(<NewVideoDialog clients={clients} />)
    fireEvent.click(screen.getByRole('button', { name: /nuevo video/i }))
    expect(screen.getByRole('button', { name: /^crear$/i })).toBeDisabled()
  })

  it('offers a format per network with sensible defaults selected', () => {
    render(<NewVideoDialog clients={clients} />)
    fireEvent.click(screen.getByRole('button', { name: /nuevo video/i }))
    expect(screen.getByText('Formato por red')).toBeInTheDocument()
    expect(screen.getByLabelText('Instagram')).toBeChecked()
    expect(screen.getByLabelText('TikTok')).toBeChecked()
    expect(screen.getByLabelText('LinkedIn')).not.toBeChecked()
    expect((screen.getByLabelText('Formato Instagram') as HTMLSelectElement).value).toBe('reel')
  })

  it('sends the selected per-network formats on create', async () => {
    render(<NewVideoDialog clients={clients} />)
    fireEvent.click(screen.getByRole('button', { name: /nuevo video/i }))
    const selects = screen.getAllByLabelText('select')
    fireEvent.change(selects[0], { target: { value: 'c1' } })
    fireEvent.change(screen.getByPlaceholderText(/título/i), { target: { value: 'Rutina' } })
    fireEvent.click(screen.getByRole('button', { name: /^crear$/i }))
    await waitFor(() =>
      expect(createContentIdeaManual).toHaveBeenCalledWith(
        expect.objectContaining({
          platformFormats: expect.objectContaining({ instagram: 'reel', tiktok: 'video', facebook: 'reel' }),
        }),
      ),
    )
  })

  it('shows pipeline status when a client with videos is selected', () => {
    const pipelineByClient: Record<string, ClientPipelineSummary> = {
      c1: {
        total: 2,
        published: 0,
        batchStage: 'caption',
        batchStageLabel: 'Caption',
        metricoolScheduled: 1,
        hasMetricool: true,
        nextPublish: {
          title: 'Reel verano',
          whenLabel: '20 jun 2026 · 10:00',
          inMetricool: true,
        },
        nextNewVideo: {
          title: null,
          whenLabel: '25 jun 2026 · 10:00',
          inMetricool: false,
          isCadenceSlot: true,
        },
        videos: [
          { id: 'v1', title: 'Reel verano', stage: 'caption', stageLabel: 'Caption', inMetricool: true, publishLabel: '20 jun 2026 · 10:00' },
          { id: 'v2', title: 'Tips gym', stage: 'video', stageLabel: 'Video', inMetricool: false, publishLabel: null },
        ],
      },
    }
    render(<NewVideoDialog clients={clients} pipelineByClient={pipelineByClient} />)
    fireEvent.click(screen.getByRole('button', { name: /nuevo video/i }))
    fireEvent.change(screen.getAllByLabelText('select')[0], { target: { value: 'c1' } })
    expect(screen.getByText(/2 videos en el batch/i)).toBeInTheDocument()
    expect(screen.getByText(/programado en Metricool/i)).toBeInTheDocument()
    expect(screen.getByText(/Próxima publicación/i)).toBeInTheDocument()
    expect(screen.getByText(/Si creas un video ahora/i)).toBeInTheDocument()
    expect(screen.getAllByText('Reel verano').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Tips gym')).toBeInTheDocument()
  })

  it('shows empty state when the client has no videos in the pipeline', () => {
    render(<NewVideoDialog clients={clients} pipelineByClient={{}} />)
    fireEvent.click(screen.getByRole('button', { name: /nuevo video/i }))
    fireEvent.change(screen.getAllByLabelText('select')[0], { target: { value: 'c2' } })
    expect(screen.getByText(/no tiene videos en el pipeline/i)).toBeInTheDocument()
  })
})
