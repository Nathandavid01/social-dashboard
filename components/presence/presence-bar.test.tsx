import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PresenceBar } from './presence-bar'

// A channel stub that mimics realtime-js: binding presence callbacks on an
// already-joined channel throws, exactly like the real RealtimeChannel.on().
function makeChannel(state: string, topic = 'realtime:nm-presence-global') {
  const channel: any = {
    topic,
    state,
    on: vi.fn(function (this: unknown, type: string) {
      if (state === 'joined' && type === 'presence') {
        throw new Error('cannot add presence callbacks after joining a channel')
      }
      return channel
    }),
    subscribe: vi.fn(() => channel),
    track: vi.fn(async () => 'ok'),
    untrack: vi.fn(async () => 'ok'),
    presenceState: vi.fn(() => ({})),
  }
  return channel
}

const supabase: any = {
  _channels: [] as any[],
  channel: vi.fn(),
  getChannels: vi.fn(() => supabase._channels),
  removeChannel: vi.fn(),
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => supabase,
}))

const USER = { id: 'u1', full_name: 'Ana Díaz', avatar_url: null }

beforeEach(() => {
  cleanup()
  supabase._channels = []
  supabase.channel.mockReset()
  supabase.getChannels.mockClear()
  supabase.removeChannel.mockClear()
})

describe('PresenceBar channel lifecycle', () => {
  it('binds presence + subscribes on a fresh (closed) channel', () => {
    const channel = makeChannel('closed')
    supabase.channel.mockReturnValue(channel)

    render(<PresenceBar currentUser={USER} />)

    expect(channel.on).toHaveBeenCalledWith('presence', { event: 'sync' }, expect.any(Function))
    expect(channel.subscribe).toHaveBeenCalledTimes(1)
  })

  it('does NOT re-bind presence on a reused, already-joined channel (regression: would throw)', () => {
    // realtime-js returns the same instance for a topic that still exists; if it
    // is already joined, the OLD code called .on('presence') and crashed.
    const live = makeChannel('joined')
    supabase.channel.mockReturnValue(live)

    expect(() => render(<PresenceBar currentUser={USER} />)).not.toThrow()
    expect(live.on).not.toHaveBeenCalled()
    expect(live.subscribe).not.toHaveBeenCalled()
    // It still reflects the current presence state instead.
    expect(live.presenceState).toHaveBeenCalled()
  })

  it('tears down any leftover channel for the topic before creating a new one', () => {
    const stale = makeChannel('joined')
    supabase._channels = [stale]
    const fresh = makeChannel('closed')
    supabase.channel.mockReturnValue(fresh)

    render(<PresenceBar currentUser={USER} />)

    expect(supabase.removeChannel).toHaveBeenCalledWith(stale)
  })

  it('removes its channel on unmount', () => {
    const channel = makeChannel('closed')
    supabase.channel.mockReturnValue(channel)

    const { unmount } = render(<PresenceBar currentUser={USER} />)
    unmount()

    expect(supabase.removeChannel).toHaveBeenCalledWith(channel)
  })
})

function seedPresence(users: Record<string, unknown[]>) {
  const channel = makeChannel('closed')
  channel.presenceState.mockReturnValue(users)
  let sync: () => void = () => {}
  channel.on.mockImplementation((_type: string, _filter: unknown, cb: () => void) => {
    sync = cb
    return channel
  })
  supabase.channel.mockReturnValue(channel)
  return () => sync()
}

describe('PresenceBar stack UI', () => {
  const VALERIA = {
    id: 'u2',
    full_name: 'Valeria Mendez',
    avatar_url: null,
    online_at: '2026-08-18T12:00:00.000Z',
  }

  it('shows an overlapping avatar stack without inline names or a gold Tú chip', () => {
    const fireSync = seedPresence({
      u1: [{ id: USER.id, full_name: USER.full_name, avatar_url: null, online_at: '2026-08-18T12:00:00.000Z' }],
      u2: [VALERIA],
    })

    render(<PresenceBar currentUser={USER} />)
    act(() => {
      fireSync()
    })

    const trigger = screen.getByRole('button', { name: /2 personas en el estudio/i })
    expect(trigger).toBeInTheDocument()
    expect(screen.queryByText('Tú')).not.toBeInTheDocument()
    expect(screen.queryByText('Valeria')).not.toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    expect(trigger.querySelector('[data-presence="tally"]')).toBeInTheDocument()
    expect(trigger.querySelectorAll('[data-presence="online-dot"]')).toHaveLength(0)
  })

  it('lists everyone with equal treatment in the roster, marking only you in the list', async () => {
    const fireSync = seedPresence({
      u1: [{ id: USER.id, full_name: USER.full_name, avatar_url: null, online_at: '2026-08-18T12:00:00.000Z' }],
      u2: [VALERIA],
    })
    const user = userEvent.setup()

    render(<PresenceBar currentUser={USER} />)
    act(() => {
      fireSync()
    })

    await user.click(screen.getByRole('button', { name: /2 personas en el estudio/i }))

    expect(await screen.findByText('Ana Díaz')).toBeInTheDocument()
    expect(screen.getByText('Valeria Mendez')).toBeInTheDocument()
    expect(screen.getByText('Tú')).toBeInTheDocument()
    expect(screen.getByText('En el estudio')).toBeInTheDocument()
  })
})
