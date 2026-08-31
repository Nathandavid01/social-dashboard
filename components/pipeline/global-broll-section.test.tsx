import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GlobalBrollSection } from './global-broll-section'

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const download = vi.fn(async () => ({ url: 'https://r2/x' }))
vi.mock('@/lib/actions/idea-videos-r2', () => ({
  getR2DownloadUrl: (...args: unknown[]) => download(...(args as [])),
}))

describe('GlobalBrollSection', () => {
  it('enseña el b-roll de TODOS los clientes con botón de bajar', () => {
    render(
      <GlobalBrollSection
        groups={[
          { clientId: 'c1', clientName: 'ARASIBO', files: [{ id: 'b1', name: 'playa.mp4', storageProvider: 'r2', driveViewLink: null }] },
          { clientId: 'c2', clientName: 'Otro', files: [{ id: 'b2', name: 'gym.mp4', storageProvider: 'r2', driveViewLink: null }] },
        ]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /b-roll y files globales/i }))
    expect(screen.getByText('playa.mp4')).toBeInTheDocument()
    expect(screen.getByText('gym.mp4')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /bajar/i })).toHaveLength(2)
  })

  it('sin b-roll no renderiza nada', () => {
    const { container } = render(<GlobalBrollSection groups={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
