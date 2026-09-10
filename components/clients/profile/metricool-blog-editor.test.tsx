import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MetricoolBlogEditor } from './metricool-blog-editor'
import { updateClientProfile } from '@/lib/actions/client-profile'

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/lib/actions/client-profile', () => ({
  updateClientProfile: vi.fn(async () => ({ ok: true })),
}))

describe('MetricoolBlogEditor', () => {
  beforeEach(() => {
    vi.mocked(updateClientProfile).mockClear()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        json: async () => ({
          blogs: [
            { id: '111', name: 'Nordwave' },
            { id: '222', name: 'Other Brand' },
          ],
        }),
      })),
    )
  })

  it('loads blogs and saves a selected id', async () => {
    const user = userEvent.setup()
    render(<MetricoolBlogEditor clientId="c1" clientName="Nordwave" initialBlogId={null} />)
    await waitFor(() => expect(screen.getByLabelText('Marca en Metricool')).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText('Marca en Metricool'), '111')
    await user.click(screen.getByRole('button', { name: /Guardar/i }))
    await waitFor(() =>
      expect(updateClientProfile).toHaveBeenCalledWith('c1', { metricool_blog_id: '111' }),
    )
  })
})
