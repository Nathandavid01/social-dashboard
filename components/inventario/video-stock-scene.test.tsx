import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { buildVideoStock } from '@/lib/inventario/video-stock-core'
import { VideoStockScene } from './video-stock-scene'

const stock = buildVideoStock(
  [{ id: 'c1', name: 'La Guira', posting_days: [1, 3, 5] }],
  [{ id: 'a', client_id: 'c1', status: 'grabada', videos: [{ kind: 'raw', status: 'uploaded' }] }],
  '2026-10-14',
)

describe('VideoStockScene', () => {
  it('falls back to a clear message when the browser has no WebGL (jsdom has none)', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <VideoStockScene clients={stock.clients} today={stock.today} selectedId={null} onSelect={() => {}} />,
    )
    expect(screen.getByText(/no puede mostrar la vista 3D/i)).toBeInTheDocument()
    err.mockRestore()
  })

  it('unmounts cleanly without WebGL', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = render(
      <VideoStockScene clients={stock.clients} today={stock.today} selectedId={null} onSelect={() => {}} />,
    )
    expect(() => unmount()).not.toThrow()
    err.mockRestore()
  })
})
