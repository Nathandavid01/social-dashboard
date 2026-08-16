import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationBell } from './notification-bell'
import type { Notification } from '@/lib/supabase/types'

// jsdom doesn't implement the Pointer Events APIs Radix's dropdown/popper
// rely on to open on click — polyfill just enough for it to work in tests.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
})

function makeChannel() {
  const channel: any = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
  }
  return channel
}

const supabase: any = {
  channel: vi.fn(() => makeChannel()),
  removeChannel: vi.fn(),
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => supabase,
}))

vi.mock('@/lib/actions/notifications', () => ({
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  deleteNotification: vi.fn(),
}))

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

afterEach(() => cleanup())

const LONG_TITLE =
  'Video editado subido — Dr. Rodriguez Cardiología y Medicina Interna de Puerto Rico'
const LONG_BODY =
  'Cafe Don Rogelio actualizó el material creativo con un nombre de archivo bastante largo y descriptivo que antes se cortaba a hachazo'

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    user_id: 'u1',
    kind: 'system',
    title: LONG_TITLE,
    body: LONG_BODY,
    link: null,
    severity: 'info',
    meta: {},
    read_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('NotificationBell', () => {
  it('keeps truncate on the title and line-clamp-2 on the body for long text, instead of overflowing raw', async () => {
    const user = userEvent.setup()
    render(
      <NotificationBell
        initialNotifications={[makeNotification()]}
        initialUnreadCount={1}
        userId="u1"
      />,
    )

    // Open the dropdown so the list renders (Radix portals it outside the
    // render container, so we query `screen`, not the render() result).
    await user.click(screen.getByRole('button', { name: /notificaciones/i }))

    const title = await screen.findByText(LONG_TITLE)
    expect(title.tagName).toBe('P')
    expect(title.className).toContain('truncate')

    const body = screen.getByText(LONG_BODY)
    expect(body.tagName).toBe('P')
    expect(body.className).toContain('line-clamp-2')
  })
})
