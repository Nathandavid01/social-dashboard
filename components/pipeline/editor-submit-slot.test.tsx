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
    render(<EditorSubmitSlot clients={clientes} />)
    expect(screen.getByTestId('form')).toBeInTheDocument()
  })

  it('ya no anuncia un dia: lo dice cada video', () => {
    render(<EditorSubmitSlot clients={clientes} />)
    expect(screen.queryByText(/Entregando para/i)).toBeNull()
  })

  // La pestaña ya no llega hasta aquí: el componente no acepta día ni semana,
  // así que no puede influir en la fecha. La garantía es estructural — la fecha
  // la escribe el editor en el formulario, video a video.
  it('no anuncia ningún día: la fecha la dice el formulario', () => {
    render(<EditorSubmitSlot clients={clientes} />)
    expect(screen.queryByText(/lunes|martes|miércoles|jueves|viernes|sábado|domingo/i)).toBeNull()
  })
})
