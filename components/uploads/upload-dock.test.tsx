import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { UploadDock } from './upload-dock'
import { useUploadStore } from '@/lib/stores/upload-store'

function seed(id: string, overrides: Partial<Parameters<typeof useUploadStore.setState>[0]> = {}) {
  useUploadStore.setState((s) => ({
    uploads: {
      ...s.uploads,
      [id]: {
        id,
        fileName: 'clip.mp4',
        sizeBytes: 1024,
        ideaId: 'idea-1',
        kind: 'edited',
        provider: 'r2',
        phase: 'subiendo',
        pct: 45,
        partsDone: 0,
        partsTotal: 1,
        attempt: 1,
        ...overrides,
      },
    },
  }))
}

beforeEach(() => {
  useUploadStore.setState({ uploads: {} })
})

describe('UploadDock', () => {
  it('renders nothing when there are no uploads', () => {
    render(<UploadDock />)
    expect(screen.queryByTestId('upload-dock')).not.toBeInTheDocument()
  })

  it('appears with an active upload and shows the phase text', async () => {
    seed('u1', { phase: 'subiendo', pct: 45 })
    render(<UploadDock />)
    expect(await screen.findByTestId('upload-dock')).toBeInTheDocument()
    expect(screen.getByText(/45%/)).toBeInTheDocument()
  })

  it('shows the count when there is more than one upload', async () => {
    seed('u1', { phase: 'subiendo' })
    seed('u2', { phase: 'reintentando', attempt: 2 })
    render(<UploadDock />)
    expect(await screen.findByText(/2 subidas/)).toBeInTheDocument()
  })

  it('each phase renders its own explanatory text, not a mute bar', async () => {
    const cases: Array<[string, RegExp]> = [
      ['reintentando', /reintentando.*2 de 5/i],
      ['ensamblando', /ensamblando/i],
      ['registrando', /registrando/i],
      ['analizando', /viendo el video/i],
      ['listo', /listo/i],
    ]
    for (const [phase, matcher] of cases) {
      useUploadStore.setState({ uploads: {} })
      seed('u1', { phase: phase as never, attempt: 2 })
      const { unmount } = render(<UploadDock />)
      fireEvent.click(await screen.findByTestId('upload-dock'))
      expect(screen.getAllByText(matcher).length).toBeGreaterThan(0)
      unmount()
    }
  })

  it('expands to show a cancel button per active upload', async () => {
    seed('u1', { phase: 'subiendo' })
    render(<UploadDock />)
    fireEvent.click(await screen.findByTestId('upload-dock'))
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()
  })

  it('cancelling calls the store', async () => {
    seed('u1', { phase: 'subiendo' })
    render(<UploadDock />)
    fireEvent.click(await screen.findByTestId('upload-dock'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    })
    expect(useUploadStore.getState().uploads['u1'].phase).toBe('cancelado')
  })

  it('warns before closing the tab while an upload is active', async () => {
    seed('u1', { phase: 'subiendo' })
    render(<UploadDock />)
    await screen.findByTestId('upload-dock')
    const evt = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
    const prevented = !window.dispatchEvent(evt)
    expect(prevented).toBe(true)
  })

  it('does NOT warn before closing the tab once uploads are all finished', async () => {
    seed('u1', { phase: 'listo' })
    render(<UploadDock />)
    await screen.findByTestId('upload-dock')
    const evt = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
    const prevented = !window.dispatchEvent(evt)
    expect(prevented).toBe(false)
  })

  it('disappears again once every upload is dismissed', async () => {
    seed('u1', { phase: 'listo', pct: 100 })
    render(<UploadDock />)
    expect(await screen.findByTestId('upload-dock')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('upload-dock'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cerrar/i }))
    })
    expect(screen.queryByTestId('upload-dock')).not.toBeInTheDocument()
  })
})
