import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const getMetrics = vi.fn(async (..._a: unknown[]) => [] as unknown[])
vi.mock('@/lib/actions/video-uploads', () => ({
  getVideoUploadMetricsByUser: (...a: unknown[]) => getMetrics(...a),
}))

import { MemberUploadHistory } from './member-upload-history'

const counts = (over = {}) => ({ userId: 'u1', userName: 'Ana', raw: 4, broll: 1, edited: 2, total: 7, lastUploadAt: '2020-01-01T00:00:00Z', ...over })

afterEach(() => { cleanup(); getMetrics.mockClear() })

describe('MemberUploadHistory', () => {
  it('renders the initial all-time counts + edited ratio', () => {
    render(<MemberUploadHistory userId="u1" initial={counts() as never} />)
    expect(screen.getByText('Raw')).toBeInTheDocument()
    expect(screen.getByText('Editados')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument() // 2 edited / 4 raw
    expect(screen.getByText('7')).toBeInTheDocument()    // total badge
  })

  it('refetches scoped counts when a range preset is clicked', async () => {
    getMetrics.mockResolvedValueOnce([counts({ raw: 1, broll: 0, edited: 1, total: 2 })])
    render(<MemberUploadHistory userId="u1" initial={counts() as never} />)
    fireEvent.click(screen.getByRole('button', { name: 'Esta semana' }))
    await waitFor(() => expect(getMetrics).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', since: expect.any(String) })))
  })

  it('shows an empty message when there are no uploads', () => {
    render(<MemberUploadHistory userId="u1" initial={null} />)
    expect(screen.getByText('Sin subidas en este rango.')).toBeInTheDocument()
  })
})
