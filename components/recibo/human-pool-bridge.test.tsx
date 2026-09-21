import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('@/components/auth/role-gate', () => ({
  RoleGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useHasPermission: () => true,
}))
vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))
const sendHumanReciboToPool = vi.fn()
vi.mock('@/lib/actions/recibo', () => ({
  sendHumanReciboToPool: (...a: unknown[]) => sendHumanReciboToPool(...a),
  getReciboIdeaPreviewUrl: vi.fn(async () => ({ url: 'https://signed.example/play.mp4' })),
}))
vi.mock('@/components/recibo/recibo-video-preview', () => ({
  ReciboVideoPreview: () => <div data-testid="preview" />,
}))

import { HumanPoolBridge } from './human-pool-bridge'

const humanIdea = {
  id: 'h1',
  client_id: 'hum',
  title: 'Reel humano',
  status: 'producida',
  approval_status: 'approved',
  staff_client_approval: 'approved',
  staff_pool_ready: false,
  client: { id: 'hum', name: 'Cliente humano', industry: null, logo_url: null, edit_mode: 'human' },
  videos: [
    {
      id: 'v1',
      idea_id: 'h1',
      kind: 'edited',
      storage_provider: 'entregas-r2',
      status: 'uploaded',
    },
  ],
} as any

describe('HumanPoolBridge', () => {
  it('muestra CTA Enviar al pool · Listo cuando Revisión y el cliente ya aprobaron', () => {
    render(
      <HumanPoolBridge
        ideas={[humanIdea]}
        humanClients={[{ id: 'hum', name: 'Cliente humano', logo_url: null }]}
        reviewByIdea={{}}
      />,
    )
    expect(screen.getByTestId('human-pool-bridge')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Puente humano → pool/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Enviar al pool · Listo/i })).toBeInTheDocument()
  })

  it('documenta el gate: Falta Revisión — no se envía al pool', () => {
    render(
      <HumanPoolBridge
        ideas={[{ ...humanIdea, approval_status: 'submitted' }]}
        humanClients={[{ id: 'hum', name: 'Cliente humano', logo_url: null }]}
        reviewByIdea={{}}
      />,
    )
    expect(screen.getByText(/Falta Revisión/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Enviar al pool · Listo/i })).not.toBeInTheDocument()
  })

  it('no muestra CTA si ya está Listo en el pool', () => {
    render(
      <HumanPoolBridge
        ideas={[{ ...humanIdea, staff_pool_ready: true }]}
        humanClients={[{ id: 'hum', name: 'Cliente humano', logo_url: null }]}
        reviewByIdea={{}}
      />,
    )
    expect(screen.getByText('Listo en el pool')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Enviar al pool · Listo/i })).not.toBeInTheDocument()
  })

  it('el clic llama sendHumanReciboToPool (CTA explícito)', async () => {
    sendHumanReciboToPool.mockResolvedValue({ ok: true })
    render(
      <HumanPoolBridge
        ideas={[humanIdea]}
        humanClients={[{ id: 'hum', name: 'Cliente humano', logo_url: null }]}
        reviewByIdea={{}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Enviar al pool · Listo/i }))
    await waitFor(() => {
      expect(sendHumanReciboToPool).toHaveBeenCalledWith({ ideaId: 'h1' })
    })
  })
})
