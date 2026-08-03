import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./submit-video-card', () => ({
  SubmitVideoCard: () => <div data-testid="form" />,
  MAX_VIDEO_BYTES: 5 * 1024 * 1024 * 1024,
}))
vi.mock('./use-submit-videos', () => ({
  useSubmitVideos: () => ({ submit: vi.fn(), rows: [], running: false, clear: vi.fn() }),
}))

import { EditorSubmitSlot } from './editor-submit-slot'

const clientes = [{ id: 'c1', name: 'Kavanna' }]

/**
 * La fecha la elige el editor por video, asi que el formulario ya no depende de
 * la pestaña abierta. El rotulo "Entregando para X" desaparecio con ella:
 * anunciaba un dia que ya no decide nada.
 */
describe('EditorSubmitSlot', () => {
  it('monta el formulario', () => {
    render(<EditorSubmitSlot clients={clientes} dia={1} />)
    expect(screen.getByTestId('form')).toBeInTheDocument()
  })

  it('ya no anuncia un dia: lo dice cada video', () => {
    render(<EditorSubmitSlot clients={clientes} dia={1} />)
    expect(screen.queryByText(/Entregando para/i)).toBeNull()
  })

  it('la pestaña abierta no cambia lo que se ve', () => {
    const { container: lunes } = render(<EditorSubmitSlot clients={clientes} dia={1} />)
    const { container: viernes } = render(<EditorSubmitSlot clients={clientes} dia={5} />)
    expect(lunes.textContent).toBe(viernes.textContent)
  })
})
