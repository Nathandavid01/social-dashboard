import { describe, expect, it } from 'vitest'
import { assertDeletableDraft } from './calendar-state'
const draft = { id: 4, uuid: 'u', text: 'Caption', draft: true, providers: [{ network: 'instagram', status: 'PENDING' }, { network: 'facebook' }], publicationDate: { dateTime: '2026-10-20T10:00:00', timezone: 'America/Puerto_Rico' } }
describe('deleting calendar drafts', () => {
  it('allows a draft that has not gone out on any network', () => {
    expect(() => assertDeletableDraft(draft)).not.toThrow()
  })
  it('never deletes a scheduled post from the calendar', () => {
    expect(() => assertDeletableDraft({ ...draft, draft: false })).toThrow(/borrador/)
  })
  it('never deletes a post that already went out on a network', () => {
    expect(() => assertDeletableDraft({ ...draft, providers: [{ network: 'instagram', status: 'PUBLISHED' }] })).toThrow()
  })
})
