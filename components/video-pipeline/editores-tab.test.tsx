import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditoresTab } from './editores-tab'
import type { EditQueueItem } from './editor-video-card'

vi.mock('./editor-video-card', () => ({
  EditorVideoCard: ({ item }: { item: { video: { title: string } } }) => <div>{item.video.title}</div>,
}))

describe('EditoresTab', () => {
  it('renders a card per item', () => {
    const items = [
      { video: { id: '1', title: 'A' }, client: { id: 'c1', name: 'Acme', logo_url: null } },
      { video: { id: '2', title: 'B' }, client: { id: 'c1', name: 'Acme', logo_url: null } },
    ] as unknown as EditQueueItem[]
    render(<EditoresTab items={items} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('shows an empty state when there is nothing to edit', () => {
    render(<EditoresTab items={[]} />)
    expect(screen.getByText(/Nada por editar/i)).toBeInTheDocument()
  })
})
