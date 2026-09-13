import { describe, expect, it } from 'vitest'
import {
  confirmationChip,
  confirmationStatusLabel,
  effectiveConfirmationStatus,
  hasClientConfirmed,
  hasVideographerConfirmed,
  isRecordingSessionComplete,
  isRecordingSessionIncomplete,
  resolveConfirmationStatus,
} from './recording-confirmation'

describe('recording dual confirmation helper', () => {
  const both = {
    videographer_confirmed_at: '2026-09-13T12:00:00Z',
    client_confirmed_at: '2026-09-13T12:05:00Z',
  }

  it('Confirmada only when BOTH timestamps are set', () => {
    expect(effectiveConfirmationStatus(both)).toBe('confirmed')
    expect(resolveConfirmationStatus(both)).toBe('confirmed')
    expect(effectiveConfirmationStatus({ ...both, client_confirmed_at: null })).toBe('unconfirmed')
    expect(effectiveConfirmationStatus({ ...both, videographer_confirmed_at: '' })).toBe('unconfirmed')
    expect(effectiveConfirmationStatus({})).toBe('unconfirmed')
  })

  it('ignores legacy confirmation_status and field-completeness for Confirmada', () => {
    expect(
      effectiveConfirmationStatus({
        confirmation_status: 'confirmed',
        videographer_confirmed_at: null,
        client_confirmed_at: null,
      }),
    ).toBe('unconfirmed')
    expect(
      effectiveConfirmationStatus({
        confirmation_status: 'unconfirmed',
        ...both,
      }),
    ).toBe('confirmed')
  })

  it('party helpers detect each side', () => {
    expect(hasVideographerConfirmed(both)).toBe(true)
    expect(hasClientConfirmed({ client_confirmed_at: null })).toBe(false)
  })

  it('chips name the missing side(s)', () => {
    expect(confirmationChip(both)).toBe('confirmed')
    expect(confirmationChip({ client_confirmed_at: both.client_confirmed_at })).toBe(
      'missing_videographer',
    )
    expect(confirmationChip({ videographer_confirmed_at: both.videographer_confirmed_at })).toBe(
      'missing_client',
    )
    expect(confirmationChip({})).toBe('unconfirmed')
  })

  it('confirmationStatusLabel uses Spanish chips', () => {
    expect(confirmationStatusLabel('confirmed')).toBe('Confirmada')
    expect(confirmationStatusLabel('missing_videographer')).toBe('Falta videógrafo')
    expect(confirmationStatusLabel('missing_client')).toBe('Falta cliente')
    expect(confirmationStatusLabel('unconfirmed')).toBe('Sin confirmar')
  })

  it('schedule completeness stays separate from confirmation', () => {
    const complete = { client_id: 'c1', videographer_id: 'v1', start_time: '09:00' }
    expect(isRecordingSessionComplete(complete)).toBe(true)
    expect(isRecordingSessionIncomplete({ ...complete, start_time: null })).toBe(true)
    // Field-complete alone is NOT Confirmada
    expect(effectiveConfirmationStatus({})).toBe('unconfirmed')
  })
})
