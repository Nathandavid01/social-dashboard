import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
const h = vi.hoisted(() => ({ shots: {} as any, ideas: {} as any, canShare: true }))
vi.mock('@/lib/auth/server', () => ({
  requirePermission: async () => {},
  currentUserHas: async (perm: string) => (perm === 'ideas.read' ? h.canShare : true),
  getEffectiveUserId: async () => 'u',
}))
vi.mock('@/lib/actions/onsite', () => ({
  getOnsiteSessions: async () => ({ sessions: [{ id: 's' }] }),
  getOnsiteShots: async () => h.shots,
  getAddableIdeas: async () => h.ideas,
}))
vi.mock('@/lib/onsite/slot-count', () => ({ pickOnsiteSession: () => ({ id: 's' }) }))
vi.mock('@/components/onsite/onsite-studio', () => ({ OnsiteStudio: () => <div>Call Sheet</div> }))
vi.mock('@/components/onsite/supervisor-process-steps', () => ({ SupervisorProcessSteps: () => null }))
vi.mock('@/components/ideas/client-proposal-panel', () => ({ ClientProposalPanel: () => <div>Export Panel</div> }))
import Page from './page'
beforeEach(() => {
  h.shots = { shots: [] }
  h.ideas = { ideas: [] }
  h.canShare = true
})
it('shows a recoverable error instead of an empty call sheet when shots fail', async () => {
  h.shots = { error: 'offline' }
  render(await Page({ searchParams: Promise.resolve({ s: 's' }) }))
  expect(screen.getByRole('alert')).toBeInTheDocument()
  expect(screen.queryByText('Call Sheet')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver A Cargar La Sesión' })).toHaveAttribute('href', '/onsite?s=s')
})
it('sigue mostrando el call sheet si solo fallan las ideas añadibles', async () => {
  h.ideas = { error: 'offline' }
  render(await Page({ searchParams: Promise.resolve({ s: 's' }) }))
  expect(screen.getByText('Call Sheet')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
it('renders a genuinely empty loaded session', async () => {
  render(await Page({ searchParams: Promise.resolve({ s: 's' }) }))
  expect(screen.getByText('Call Sheet')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
it('muestra el panel de exportación con ideas.read (no solo ideas.share)', async () => {
  h.canShare = true
  render(await Page({ searchParams: Promise.resolve({ s: 's' }) }))
  expect(screen.getByText('Export Panel')).toBeInTheDocument()
})
it('oculta el panel de exportación sin ideas.read', async () => {
  h.canShare = false
  render(await Page({ searchParams: Promise.resolve({ s: 's' }) }))
  expect(screen.queryByText('Export Panel')).not.toBeInTheDocument()
})
