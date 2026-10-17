import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CalendarPostControls } from './calendar-post-controls'
const h = vi.hoisted(() => ({ allowed: true, deleteAllowed: true }))
vi.mock('@/components/auth/role-gate', () => ({ useHasPermission: (perm: string) => h.allowed && (perm !== 'posting.calendar.delete_draft' || h.deleteAllowed) }))
const post = { id: 4, uuid: 'u', clientId: 'c', blogId: '1', text: 'Caption', draft: false, autoPublish: true, publicationDate: '2099-10-20T10:00:00', timezone: 'America/Puerto_Rico', media: [], platforms: ['instagram'], providerStatuses: ['PENDING'] }
afterEach(() => { cleanup(); h.allowed = true; h.deleteAllowed = true; vi.unstubAllGlobals() })
describe('calendar draft and schedule controls', () => {
  it('sends the chosen date to schedule the existing post', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, confirmed: true, postId: 9 }) })
    vi.stubGlobal('fetch', fetcher)
    const changed = vi.fn()
    render(<CalendarPostControls post={post} onChanged={changed} onVerify={() => {}} />)
    fireEvent.change(screen.getByLabelText('Fecha y hora de publicación'), { target: { value: '2099-10-22T18:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Programar' }))
    await waitFor(() => expect(changed).toHaveBeenCalled())
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ action: 'schedule', postId: 4, dateTime: '2099-10-22T18:30' })
  })
  it('saves a draft without a scheduling request', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, confirmed: true }) })
    vi.stubGlobal('fetch', fetcher)
    render(<CalendarPostControls post={post} onChanged={() => {}} onVerify={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar como borrador' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ action: 'draft', postId: 4 })
  })
  it('blocks duplicate retries when the outcome is unknown and offers verification', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ uncertain: true, error: 'Verifica antes de repetir.' }) }))
    const verify = vi.fn()
    render(<CalendarPostControls post={post} onChanged={() => {}} onVerify={verify} />)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar como borrador' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Verifica antes de repetir.')
    expect(screen.getByRole('button', { name: 'Programar' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Verificar calendario' }))
    expect(verify).toHaveBeenCalled()
  })
  it('keeps published posts immutable and hides writes without permission', () => {
    render(<CalendarPostControls post={{ ...post, providerStatuses: ['PUBLISHED'] }} onChanged={() => {}} onVerify={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Programar' })).toBeNull()
    cleanup(); h.allowed = false
    render(<CalendarPostControls post={post} onChanged={() => {}} onVerify={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Programar' })).toBeNull()
  })
})
describe('deleting a draft from the calendar', () => {
  const draft = { ...post, draft: true, autoPublish: false }
  it('asks for confirmation before deleting the draft in Metricool', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, confirmed: true, postId: 4 }) })
    vi.stubGlobal('fetch', fetcher)
    const changed = vi.fn()
    render(<CalendarPostControls post={draft} onChanged={changed} onVerify={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar borrador' }))
    expect(fetcher).not.toHaveBeenCalled()
    expect(screen.getByText(/Se borra de Metricool/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }))
    await waitFor(() => expect(changed).toHaveBeenCalledWith(expect.objectContaining({ action: 'delete', confirmed: true })))
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ action: 'delete', postId: 4, uuid: 'u', expected: { draft: true } })
  })
  it('cancelling the confirmation sends nothing', () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    render(<CalendarPostControls post={draft} onChanged={() => {}} onVerify={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar borrador' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('button', { name: 'Sí, eliminar' })).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('only offers deletion for drafts and to people allowed to delete them', () => {
    render(<CalendarPostControls post={post} onChanged={() => {}} onVerify={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Eliminar borrador' })).toBeNull()
    cleanup(); h.deleteAllowed = false
    render(<CalendarPostControls post={draft} onChanged={() => {}} onVerify={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Eliminar borrador' })).toBeNull()
  })
})
