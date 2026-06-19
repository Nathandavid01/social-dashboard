import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { clientOnboardingStatus } from '@/lib/utils/client-onboarding'

const activateClient = vi.fn(async (_id: string) => ({ success: true }) as { success?: boolean; error?: string })
vi.mock('@/lib/actions/clients', () => ({ activateClient: (id: string) => activateClient(id) }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

import { ClientOnboardingCard } from './client-onboarding-card'

afterEach(() => {
  cleanup()
  activateClient.mockClear()
})

describe('ClientOnboardingCard', () => {
  it('renders nothing once onboarding is complete', () => {
    const status = clientOnboardingStatus({
      status: 'active', metricool_blog_id: 'x', posting_days: [1], brand_voice: 'v', hasVideos: true,
    })
    const { container } = render(<ClientOnboardingCard clientId="c1" status={status} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows pending items, the progress count, and an action per item', () => {
    const status = clientOnboardingStatus({ status: 'onboarding' })
    render(<ClientOnboardingCard clientId="c1" status={status} />)
    expect(screen.getByText('Listo para automatizar')).toBeInTheDocument()
    expect(screen.getByText('0/5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /activar/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /conectar/i })).toHaveAttribute('href', '/clients/c1/edit')
    expect(screen.getByRole('link', { name: /definir días/i })).toHaveAttribute('href', '/clients/c1?tab=schedule')
    expect(screen.getByRole('link', { name: /crear lote/i })).toHaveAttribute('href', '/clients/c1/batch')
  })

  it('activates the client when "Activar" is clicked', async () => {
    const status = clientOnboardingStatus({ status: 'onboarding', metricool_blog_id: 'x', posting_days: [1] })
    render(<ClientOnboardingCard clientId="c1" status={status} />)
    fireEvent.click(screen.getByRole('button', { name: /activar/i }))
    await waitFor(() => expect(activateClient).toHaveBeenCalledWith('c1'))
  })
})
