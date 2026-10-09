import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CalendarPostControls } from './calendar-post-controls'
const h = vi.hoisted(() => ({ allowed: true }))
vi.mock('@/components/auth/role-gate', () => ({ useHasPermission: () => h.allowed }))
const post = { id: 4, uuid: 'u', clientId: 'c', blogId: '1', text: 'Caption', draft: false, autoPublish: true, publicationDate: '2099-10-20T10:00:00', timezone: 'America/Puerto_Rico', media: [], platforms: ['instagram'], providerStatuses: ['PENDING'] }
afterEach(() => { cleanup(); h.allowed = true; vi.unstubAllGlobals() })
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
